import dbRepository from "../repositories/dbRepository";
import packageInfo from "../../package.json";

const FORMAT = "weektodo.full-backup";
const SCHEMA_VERSION = 3;

const STORE_NAMES = Object.freeze([
  "todo_lists",
  "repeating_events",
  "repeating_events_by_date",
  "focus_documents",
  "focus_tags",
  "focus_task_links",
  "focus_document_revisions",
  "focus_assets",
]);

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = dbRepository.open();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        request.error ||
          new Error("无法打开 WeekToDo 数据库")
      );
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        request.error ||
          new Error("IndexedDB 请求失败")
      );
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(
        transaction.error ||
          new Error("数据事务执行失败")
      );
    transaction.onabort = () =>
      reject(
        transaction.error ||
          new Error("数据事务已回滚")
      );
  });
}

function bytesToBase64(bytes) {
  const chunkSize = 0x8000;
  let binary = "";

  for (
    let offset = 0;
    offset < bytes.length;
    offset += chunkSize
  ) {
    binary += String.fromCharCode(
      ...bytes.subarray(
        offset,
        Math.min(offset + chunkSize, bytes.length)
      )
    );
  }

  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function encodeValue(value) {
  if (value instanceof Blob) {
    return {
      __weektodoType: "Blob",
      type: value.type || "application/octet-stream",
      data: bytesToBase64(
        new Uint8Array(await value.arrayBuffer())
      ),
    };
  }

  if (value instanceof ArrayBuffer) {
    return {
      __weektodoType: "ArrayBuffer",
      data: bytesToBase64(new Uint8Array(value)),
    };
  }

  if (ArrayBuffer.isView(value)) {
    return {
      __weektodoType: "Uint8Array",
      data: bytesToBase64(
        new Uint8Array(
          value.buffer,
          value.byteOffset,
          value.byteLength
        )
      ),
    };
  }

  if (Array.isArray(value)) {
    return Promise.all(value.map(encodeValue));
  }

  if (value && typeof value === "object") {
    const result = {};

    for (const [key, child] of Object.entries(value)) {
      result[key] = await encodeValue(child);
    }

    return result;
  }

  return value;
}

async function decodeValue(value) {
  if (!value || typeof value !== "object") {
    return value;
  }

  if (value.__weektodoType === "Blob") {
    return new Blob(
      [base64ToBytes(value.data || "")],
      {
        type:
          value.type ||
          "application/octet-stream",
      }
    );
  }

  if (value.__weektodoType === "ArrayBuffer") {
    return base64ToBytes(value.data || "").buffer;
  }

  if (value.__weektodoType === "Uint8Array") {
    return base64ToBytes(value.data || "");
  }

  if (Array.isArray(value)) {
    return Promise.all(value.map(decodeValue));
  }

  const result = {};

  for (const [key, child] of Object.entries(value)) {
    result[key] = await decodeValue(child);
  }

  return result;
}

function readLocalStorage() {
  const result = {};

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);

    if (key !== null) {
      result[key] = localStorage.getItem(key);
    }
  }

  return result;
}

async function readStore(db, storeName) {
  if (!db.objectStoreNames.contains(storeName)) {
    return [];
  }

  const transaction = db.transaction(
    [storeName],
    "readonly"
  );
  const store = transaction.objectStore(storeName);

  const [keys, records] = await Promise.all([
    requestResult(store.getAllKeys()),
    requestResult(store.getAll()),
  ]);

  await transactionDone(transaction);

  const entries = [];

  for (let index = 0; index < keys.length; index += 1) {
    entries.push([
      keys[index],
      await encodeValue(records[index]),
    ]);
  }

  return entries;
}

async function readIndexedDB() {
  const db = await openDatabase();
  const result = {};

  try {
    for (const storeName of STORE_NAMES) {
      result[storeName] = await readStore(
        db,
        storeName
      );
    }
  } finally {
    db.close();
  }

  return result;
}

function moduleCounts(localData, indexedData) {
  function parsedLength(key) {
    try {
      const value = JSON.parse(localData[key] || "[]");
      return Array.isArray(value)
        ? value.length
        : value?.cards?.length || 0;
    } catch {
      return 0;
    }
  }

  function storeLength(name) {
    return Array.isArray(indexedData[name])
      ? indexedData[name].length
      : Object.keys(indexedData[name] || {}).length;
  }

  return {
    weeklyLists: storeLength("todo_lists"),
    anniversaries: parsedLength("anniversaryList"),
    financialSnapshots: parsedLength(
      "financialSnapshots"
    ),
    lifeImprintCards: parsedLength("lifeImprint"),
    focusDocuments: storeLength("focus_documents"),
    focusAssets: storeLength("focus_assets"),
  };
}

async function capture() {
  const localData = readLocalStorage();
  const indexedData = await readIndexedDB();

  return {
    format: FORMAT,
    schemaVersion: SCHEMA_VERSION,
    appVersion: packageInfo.version,
    exportedAt: new Date().toISOString(),
    manifest: {
      modules: [
        "weekly",
        "calendar",
        "focus",
        "settings",
      ],
      counts: moduleCounts(
        localData,
        indexedData
      ),
    },
    localStorage: localData,
    indexedDB: indexedData,
  };
}

function normalizeLegacyStore(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value && typeof value === "object") {
    return Object.entries(value);
  }

  return [];
}

function normalizeBackup(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error("备份文件内容无效");
  }

  if (raw.format === FORMAT) {
    if (
      !Number.isInteger(raw.schemaVersion) ||
      raw.schemaVersion > SCHEMA_VERSION
    ) {
      throw new Error(
        "该备份由更高版本生成，请升级 WeekToDo 后导入"
      );
    }

    if (
      !raw.localStorage ||
      typeof raw.localStorage !== "object" ||
      !raw.indexedDB ||
      typeof raw.indexedDB !== "object"
    ) {
      throw new Error("完整备份缺少必要数据区域");
    }

    return raw;
  }

  const legacyLocal =
    raw.localStorage &&
    typeof raw.localStorage === "object"
      ? raw.localStorage
      : Object.fromEntries(
          Object.entries(raw).filter(
            ([, value]) => typeof value === "string"
          )
        );

  const legacyIndexed = raw.indexedDB || {};

  const aliases = {
    todo_lists:
      legacyIndexed.todo_lists ||
      raw.todoLists,
    repeating_events:
      legacyIndexed.repeating_events ||
      raw.repeating_events,
    repeating_events_by_date:
      legacyIndexed.repeating_events_by_date ||
      raw.repeating_events_by_date,
    focus_documents:
      legacyIndexed.focus_documents ||
      raw.focus_documents,
    focus_tags:
      legacyIndexed.focus_tags ||
      raw.focus_tags,
    focus_task_links:
      legacyIndexed.focus_task_links ||
      raw.focus_task_links,
    focus_document_revisions:
      legacyIndexed.focus_document_revisions ||
      raw.focus_document_revisions,
    focus_assets:
      legacyIndexed.focus_assets ||
      raw.focus_assets,
  };

  if (!legacyLocal.config) {
    throw new Error(
      "无法识别该文件：缺少 WeekToDo 配置数据"
    );
  }

  return {
    format: FORMAT,
    schemaVersion: 2,
    appVersion: raw.appVersion || "unknown",
    exportedAt: raw.exportedAt || null,
    localStorage: legacyLocal,
    indexedDB: Object.fromEntries(
      STORE_NAMES.map((name) => [
        name,
        normalizeLegacyStore(aliases[name]),
      ])
    ),
  };
}

async function prepareStores(indexedData) {
  const prepared = {};

  for (const storeName of STORE_NAMES) {
    const entries = normalizeLegacyStore(
      indexedData?.[storeName]
    );

    prepared[storeName] = [];

    for (const entry of entries) {
      if (!Array.isArray(entry) || entry.length !== 2) {
        throw new Error(
          `备份中的 ${storeName} 数据结构无效`
        );
      }

      prepared[storeName].push([
        entry[0],
        await decodeValue(entry[1]),
      ]);
    }
  }

  return prepared;
}

function restoreLocalStorage(values) {
  if (!values || typeof values !== "object") {
    throw new Error("本地配置数据无效");
  }

  const safeEntries = Object.entries(values).filter(
    ([key, value]) =>
      typeof key === "string" &&
      typeof value === "string"
  );

  if (
    !safeEntries.some(([key]) => key === "config")
  ) {
    throw new Error("备份中缺少 config");
  }

  localStorage.clear();

  safeEntries.forEach(([key, value]) => {
    localStorage.setItem(key, value);
  });

  try {
    const config = JSON.parse(
      localStorage.getItem("config")
    );

    config.importing = true;
    localStorage.setItem(
      "config",
      JSON.stringify(config)
    );
  } catch {
    throw new Error("备份中的 config 无法解析");
  }
}

async function replaceIndexedDB(prepared) {
  const db = await openDatabase();

  try {
    const availableStores = STORE_NAMES.filter(
      (name) => db.objectStoreNames.contains(name)
    );

    if (!availableStores.length) return;

    const transaction = db.transaction(
      availableStores,
      "readwrite"
    );

    for (const storeName of availableStores) {
      const store = transaction.objectStore(storeName);
      store.clear();

      for (const [key, value] of prepared[storeName] || []) {
        store.put(value, key);
      }
    }

    await transactionDone(transaction);
  } finally {
    db.close();
  }
}

async function applyBackup(backup) {
  const prepared = await prepareStores(
    backup.indexedDB
  );

  restoreLocalStorage(backup.localStorage);
  await replaceIndexedDB(prepared);
}

function downloadJson(data) {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);

  const blob = new Blob(
    [JSON.stringify(data, null, 2)],
    {
      type: "application/json;charset=utf-8",
    }
  );

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download =
    `WeekToDo完整备份_${timestamp}.wtdb`;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("未选择备份文件"));
      return;
    }

    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () =>
      reject(
        reader.error ||
          new Error("读取备份文件失败")
      );

    reader.readAsText(file);
  });
}

const dataBackupService = {
  format: FORMAT,
  schemaVersion: SCHEMA_VERSION,
  storeNames: STORE_NAMES,

  async exportBackup() {
    const backup = await capture();
    downloadJson(backup);
    return backup.manifest;
  },

  async importBackup(file) {
    const text = await readFile(file);

    let parsed;

    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(
        "文件不是有效的 WeekToDo JSON 备份"
      );
    }

    const target = normalizeBackup(parsed);

    // 导入前保存当前完整状态。
    // 如果 localStorage 或 IndexedDB 任一步骤失败，
    // 自动恢复到导入前状态。
    const rollback = await capture();

    try {
      await applyBackup(target);
    } catch (error) {
      try {
        await applyBackup(rollback);
      } catch (rollbackError) {
        console.error(
          "[backup] 自动回滚失败：",
          rollbackError
        );
      }

      throw error;
    }

    return target.manifest || null;
  },

  async clearAll() {
    const db = await openDatabase();

    try {
      const availableStores = STORE_NAMES.filter(
        (name) => db.objectStoreNames.contains(name)
      );

      if (availableStores.length) {
        const transaction = db.transaction(
          availableStores,
          "readwrite"
        );

        availableStores.forEach((storeName) => {
          transaction.objectStore(storeName).clear();
        });

        await transactionDone(transaction);
      }
    } finally {
      db.close();
    }

    localStorage.clear();
  },

  async inspectBackup(file) {
    const text = await readFile(file);
    return normalizeBackup(JSON.parse(text));
  },

  cloneJson,
};

export default dataBackupService;
