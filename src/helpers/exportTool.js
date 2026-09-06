import storageRepository from "../repositories/storageRepository";
import dbRepository from "../repositories/dbRepository";
import {
  FOCUS_STORE_NAMES,
} from "../repositories/focusDataRepository";
import { Toast, Modal } from "bootstrap";
import migrations from "../migrations/migrations";

const LEGACY_STORE_MAP = Object.freeze({
  todo_lists: "todoLists",
  repeating_events: "repeating_events",
  repeating_events_by_date:
    "repeating_events_by_date",
});

const DATABASE_STORES = Object.freeze([
  "todo_lists",
  "repeating_events",
  "repeating_events_by_date",
  ...FOCUS_STORE_NAMES,
]);

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = dbRepository.open();

    request.onsuccess = () =>
      resolve(request.result);

    request.onerror = () =>
      reject(
        request.error ||
          new Error(
            "无法打开 WeekToDo IndexedDB"
          )
      );
  });
}

function readStoreAsObject(db, storeName) {
  return new Promise((resolve, reject) => {
    const result = {};

    try {
      const transaction = db.transaction(
        [storeName],
        "readonly"
      );

      const request = transaction
        .objectStore(storeName)
        .openCursor();

      request.onsuccess = () => {
        const cursor = request.result;

        if (cursor) {
          result[cursor.key] = cursor.value;
          cursor.continue();
          return;
        }

        resolve(result);
      };

      request.onerror = () =>
        reject(
          request.error ||
            new Error(
              `读取备份数据失败：${storeName}`
            )
        );
    } catch (error) {
      reject(error);
    }
  });
}

async function exportIndexedDb() {
  const db = await openDatabase();
  const result = {};

  try {
    for (const storeName of DATABASE_STORES) {
      if (!db.objectStoreNames.contains(storeName)) {
        result[storeName] = {};
        continue;
      }

      result[storeName] =
        await readStoreAsObject(
          db,
          storeName
        );
    }

    return result;
  } finally {
    db.close();
  }
}

function createExportLink(filename, data) {
  const blob = new Blob(
    [JSON.stringify(data, null, 2)],
    { type: "application/json;charset=utf-8" }
  );

  const url = URL.createObjectURL(blob);
  const element =
    document.createElement("a");

  element.href = url;
  element.download = filename;
  element.style.display = "none";

  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);

  URL.revokeObjectURL(url);

  setTimeout(() => {
    const modal = Modal.getInstance(
      document.getElementById(
        "exportingModal"
      )
    );

    if (modal) {
      modal.hide();
    }
  }, 500);
}

function showInvalidFileToast() {
  const element =
    document.getElementById("invalidFile");

  if (element) {
    new Toast(element).show();
  }
}

function readFile(files) {
  return new Promise((resolve, reject) => {
    const file = files && files[0];

    if (!file) {
      reject(new Error("未选择备份文件"));
      return;
    }

    const reader = new FileReader();

    reader.onload = () =>
      resolve(reader.result);

    reader.onerror = () =>
      reject(
        reader.error ||
          new Error("读取备份文件失败")
      );

    reader.readAsText(file);
  });
}

function validateBackup(data) {
  if (
    !data ||
    typeof data !== "object"
  ) {
    throw new Error("备份内容不是对象");
  }

  const localData =
    data.localStorage || data;

  if (!("config" in localData)) {
    throw new Error(
      "备份中不存在 config"
    );
  }
}

function restoreLocalStorage(data) {
  const source =
    data.localStorage &&
    typeof data.localStorage === "object"
      ? data.localStorage
      : data;

  const excludedKeys = new Set([
    "backupSchemaVersion",
    "appVersion",
    "exportedAt",
    "indexedDB",
    "todoLists",
    "repeating_events",
    "repeating_events_by_date",
    ...FOCUS_STORE_NAMES,
  ]);

  const values = {};

  Object.entries(source).forEach(
    ([key, value]) => {
      if (
        !excludedKeys.has(key) &&
        typeof value === "string"
      ) {
        values[key] = value;
      }
    }
  );

  if (!values.config) {
    throw new Error(
      "备份中不存在有效 config"
    );
  }

  const config = JSON.parse(values.config);

  config.importing = true;
  values.config = JSON.stringify(config);

  storageRepository.clean();

  Object.entries(values).forEach(
    ([key, value]) => {
      localStorage.setItem(key, value);
    }
  );
}

function getBackupStore(data, storeName) {
  if (
    data.indexedDB &&
    typeof data.indexedDB === "object" &&
    data.indexedDB[storeName]
  ) {
    return data.indexedDB[storeName];
  }

  const legacyName =
    LEGACY_STORE_MAP[storeName] ||
    storeName;

  return data[legacyName] || {};
}

function replaceStore(db, storeName, records) {
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(storeName)) {
      resolve();
      return;
    }

    try {
      const transaction = db.transaction(
        [storeName],
        "readwrite"
      );

      const store =
        transaction.objectStore(storeName);

      store.clear();

      Object.entries(records || {}).forEach(
        ([key, value]) => {
          store.put(value, key);
        }
      );

      transaction.oncomplete = () =>
        resolve();

      transaction.onerror = () =>
        reject(
          transaction.error ||
            new Error(
              `导入 Store 失败：${storeName}`
            )
        );

      transaction.onabort = () =>
        reject(
          transaction.error ||
            new Error(
              `导入 Store 已中止：${storeName}`
            )
        );
    } catch (error) {
      reject(error);
    }
  });
}

async function restoreIndexedDb(data) {
  const db = await openDatabase();

  try {
    for (const storeName of DATABASE_STORES) {
      const records =
        getBackupStore(data, storeName);

      await replaceStore(
        db,
        storeName,
        records
      );
    }
  } finally {
    db.close();
  }
}

async function clearIndexedDb() {
  const db = await openDatabase();

  try {
    for (const storeName of DATABASE_STORES) {
      if (!db.objectStoreNames.contains(storeName)) {
        continue;
      }

      await replaceStore(
        db,
        storeName,
        {}
      );
    }
  } finally {
    db.close();
  }
}

export default {
  async export() {
    try {
      const localData =
        storageRepository.as_json();

      const indexedDbData =
        await exportIndexedDb();

      const backup = {
        backupSchemaVersion: 2,
        appVersion: "2.5.0",
        exportedAt:
          new Date().toISOString(),
        localStorage: localData,
        indexedDB: indexedDbData,

        // 保留旧字段，便于识别旧版数据结构。
        config: localData.config,
        customTodoListIds:
          localData.customTodoListIds,
        todoLists:
          indexedDbData.todo_lists,
        repeating_events:
          indexedDbData.repeating_events,
        repeating_events_by_date:
          indexedDbData
            .repeating_events_by_date,
      };

      createExportLink(
        "WeekToDoBackup.wtdb",
        backup
      );
    } catch (error) {
      console.error(
        "[backup] 导出失败：",
        error
      );

      showInvalidFileToast();
    }
  },

  async import(event) {
    try {
      const text = await readFile(
        event.target.files
      );

      const data = JSON.parse(text);

      validateBackup(data);
      restoreLocalStorage(data);
      await restoreIndexedDb(data);

      migrations.migrate();
      location.reload();
    } catch (error) {
      console.error(
        "[backup] 导入失败：",
        error
      );

      showInvalidFileToast();
    } finally {
      if (event.target) {
        event.target.value = "";
      }
    }
  },

  async clear() {
    try {
      const desktopApi =
        window.weekToDoDesktop;

      if (
        desktopApi &&
        desktopApi.isElectron
      ) {
        desktopApi.clearMainConfig();
      }

      storageRepository.clean();
      await clearIndexedDb();

      location.reload();
    } catch (error) {
      console.error(
        "[backup] 清除数据失败：",
        error
      );

      throw error;
    }
  },
};
