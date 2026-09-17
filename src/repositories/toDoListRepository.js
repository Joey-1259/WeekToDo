import dbRepository from "./dbRepository";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function runWrite(operation) {
  return new Promise((resolve, reject) => {
    const openRequest = dbRepository.open();

    openRequest.onerror = () => {
      reject(
        openRequest.error ||
          new Error("无法打开 WeekToDo 数据库")
      );
    };

    openRequest.onsuccess = (event) => {
      const db = event.target.result;

      try {
        const transaction = db.transaction(
          ["todo_lists"],
          "readwrite"
        );
        const store =
          transaction.objectStore("todo_lists");

        operation(store);

        transaction.oncomplete = () => {
          db.close();
          resolve();
        };

        transaction.onerror = () => {
          const error =
            transaction.error ||
            new Error("事项列表保存失败");

          db.close();
          reject(error);
        };

        transaction.onabort = () => {
          const error =
            transaction.error ||
            new Error("事项列表保存事务已中止");

          db.close();
          reject(error);
        };
      } catch (error) {
        db.close();
        reject(error);
      }
    };
  });
}

export default {
  update(toDoListId, toDoList) {
    const safeList = clone(
      Array.isArray(toDoList) ? toDoList : []
    );

    return runWrite((store) => {
      store.put(safeList, toDoListId);
    });
  },

  remove(toDoListId) {
    return runWrite((store) => {
      store.delete(toDoListId);
    });
  },
};
