import dbRepository from "./dbRepository";
import { createId } from "../helpers/idHelper";

/* FOCUS_RICH_CONTENT_SYSTEM_20260907_V1 */

const STORE = "focus_assets";
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const GRACE_PERIOD = 10 * 60 * 1000;

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        request.error ||
          new Error("图片存储请求失败")
      );
  });
}

async function openDatabase() {
  return requestResult(dbRepository.open());
}

function collectAssetIds(value, result = new Set()) {
  if (!value || typeof value !== "object") {
    return result;
  }

  if (
    value.type === "focusImage" &&
    value.attrs?.assetId
  ) {
    result.add(value.attrs.assetId);
  }

  if (Array.isArray(value)) {
    value.forEach((item) =>
      collectAssetIds(item, result)
    );
  } else {
    Object.values(value).forEach((item) =>
      collectAssetIds(item, result)
    );
  }

  return result;
}

async function estimateCapacity(requiredBytes) {
  if (!navigator.storage?.estimate) return;

  const { usage = 0, quota = 0 } =
    await navigator.storage.estimate();

  if (
    quota > 0 &&
    quota - usage < requiredBytes * 1.35
  ) {
    throw new Error(
      "设备可用存储空间不足，请清理空间后再插入图片。"
    );
  }
}

const focusAssetRepository = {
  maxFileSize: MAX_FILE_SIZE,

  async saveImage(file, documentId) {
    if (!(file instanceof Blob)) {
      throw new TypeError("只支持图片文件");
    }

    if (!String(file.type || "").startsWith("image/")) {
      throw new TypeError("请选择图片文件");
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error("单张图片不能超过 15MB");
    }

    await estimateCapacity(file.size);

    if (navigator.storage?.persist) {
      navigator.storage.persist().catch(() => {});
    }

    const now = new Date().toISOString();
    const record = {
      id: createId("focus-image"),
      documentId,
      name: file.name || `image-${Date.now()}`,
      type: file.type || "image/png",
      size: file.size,
      blob: file,
      createdAt: now,
      updatedAt: now,
    };

    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [STORE],
        "readwrite"
      );

      transaction.objectStore(STORE).put(
        record,
        record.id
      );

      transaction.oncomplete = () => {
        db.close();
        resolve({
          id: record.id,
          documentId,
          name: record.name,
          type: record.type,
          size: record.size,
        });
      };

      transaction.onerror = () => {
        const error =
          transaction.error ||
          new Error("保存图片失败");

        db.close();

        if (error?.name === "QuotaExceededError") {
          reject(
            new Error(
              "图片存储空间已满，请删除不再使用的图片。"
            )
          );
          return;
        }

        reject(error);
      };
    });
  },

  async get(id) {
    const db = await openDatabase();

    try {
      const transaction = db.transaction(
        [STORE],
        "readonly"
      );

      return await requestResult(
        transaction.objectStore(STORE).get(id)
      );
    } finally {
      db.close();
    }
  },

  async getObjectUrl(id) {
    const record = await this.get(id);

    if (!record?.blob) {
      throw new Error("图片文件不存在或已被清理");
    }

    return {
      url: URL.createObjectURL(record.blob),
      record,
    };
  },

  async remove(id) {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [STORE],
        "readwrite"
      );

      transaction.objectStore(STORE).delete(id);

      transaction.oncomplete = () => {
        db.close();
        resolve();
      };

      transaction.onerror = () => {
        const error =
          transaction.error ||
          new Error("删除图片失败");
        db.close();
        reject(error);
      };
    });
  },

  async list() {
    const db = await openDatabase();

    try {
      const transaction = db.transaction(
        [STORE],
        "readonly"
      );

      return (
        await requestResult(
          transaction.objectStore(STORE).getAll()
        )
      ) || [];
    } finally {
      db.close();
    }
  },

  async pruneUnreferenced(extraUsedIds = []) {
    const db = await openDatabase();

    let documents = [];
    let assets = [];

    try {
      const transaction = db.transaction(
        ["focus_documents", STORE],
        "readonly"
      );

      [documents, assets] = await Promise.all([
        requestResult(
          transaction
            .objectStore("focus_documents")
            .getAll()
        ),
        requestResult(
          transaction.objectStore(STORE).getAll()
        ),
      ]);
    } finally {
      db.close();
    }

    const used = new Set(extraUsedIds);

    documents.forEach((document) => {
      collectAssetIds(document?.content, used);
    });

    const now = Date.now();
    const unused = assets.filter((asset) => {
      if (used.has(asset.id)) return false;

      const created = new Date(
        asset.createdAt || 0
      ).getTime();

      return now - created > GRACE_PERIOD;
    });

    await Promise.all(
      unused.map((asset) => this.remove(asset.id))
    );

    return unused.length;
  },

  collectAssetIds,
};

export default focusAssetRepository;
