import dbRepository from "./dbRepository";

export const FOCUS_STORES = Object.freeze({
  documents: "focus_documents",
  tags: "focus_tags",
  taskLinks: "focus_task_links",
  revisions: "focus_document_revisions",
});

export const FOCUS_STORE_NAMES = Object.freeze(
  Object.values(FOCUS_STORES)
);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = dbRepository.open();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      reject(
        request.error ||
          new Error("无法打开 WeekToDo IndexedDB")
      );
    };
  });
}

async function runTransaction(storeName, mode, operation) {
  if (!FOCUS_STORE_NAMES.includes(storeName)) {
    throw new Error(`不允许访问未知 Store：${storeName}`);
  }

  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    let result;
    let request;

    try {
      const transaction = db.transaction(
        [storeName],
        mode
      );

      const store =
        transaction.objectStore(storeName);

      request = operation(store);

      if (request) {
        request.onsuccess = () => {
          result = request.result;
        };

        request.onerror = () => {
          reject(
            request.error ||
              new Error(
                `IndexedDB 请求失败：${storeName}`
              )
          );
        };
      }

      transaction.oncomplete = () => {
        db.close();
        resolve(result);
      };

      transaction.onerror = () => {
        db.close();
        reject(
          transaction.error ||
            new Error(
              `IndexedDB 事务失败：${storeName}`
            )
        );
      };

      transaction.onabort = () => {
        db.close();
        reject(
          transaction.error ||
            new Error(
              `IndexedDB 事务已中止：${storeName}`
            )
        );
      };
    } catch (error) {
      db.close();
      reject(error);
    }
  });
}

function assertRecord(record) {
  if (
    !record ||
    typeof record !== "object" ||
    !String(record.id || "").trim()
  ) {
    throw new TypeError(
      "重点档案数据必须包含非空 id"
    );
  }
}

const focusDataRepository = {
  stores: FOCUS_STORES,

  get(storeName, id) {
    return runTransaction(
      storeName,
      "readonly",
      (store) => store.get(id)
    );
  },

  getAll(storeName) {
    return runTransaction(
      storeName,
      "readonly",
      (store) => store.getAll()
    );
  },

  getAllByIndex(storeName, indexName, value) {
    return runTransaction(
      storeName,
      "readonly",
      (store) =>
        store.index(indexName).getAll(value)
    );
  },

  put(storeName, record) {
    assertRecord(record);

    const safeRecord = clone(record);

    return runTransaction(
      storeName,
      "readwrite",
      (store) =>
        store.put(safeRecord, safeRecord.id)
    );
  },

  remove(storeName, id) {
    return runTransaction(
      storeName,
      "readwrite",
      (store) => store.delete(id)
    );
  },

  clear(storeName) {
    return runTransaction(
      storeName,
      "readwrite",
      (store) => store.clear()
    );
  },

  async replaceAll(storeName, records) {
    const safeRecords = Array.isArray(records)
      ? records.map(clone)
      : [];

    safeRecords.forEach(assertRecord);

    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(
          [storeName],
          "readwrite"
        );

        const store =
          transaction.objectStore(storeName);

        store.clear();

        safeRecords.forEach((record) => {
          store.put(record, record.id);
        });

        transaction.oncomplete = () => {
          db.close();
          resolve();
        };

        transaction.onerror = () => {
          db.close();
          reject(
            transaction.error ||
              new Error(
                `替换 Store 数据失败：${storeName}`
              )
          );
        };

        transaction.onabort = () => {
          db.close();
          reject(
            transaction.error ||
              new Error(
                `替换 Store 数据已中止：${storeName}`
              )
          );
        };
      } catch (error) {
        db.close();
        reject(error);
      }
    });
  },
};

export default focusDataRepository;
