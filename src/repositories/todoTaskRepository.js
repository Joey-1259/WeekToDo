import dbRepository from "./dbRepository";
import { createId } from "../helpers/idHelper";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("IndexedDB 请求失败"));
  });
}

function openDatabase() {
  return requestResult(dbRepository.open());
}

async function readList(listId) {
  const db = await openDatabase();

  try {
    const transaction = db.transaction(
      ["todo_lists"],
      "readonly"
    );

    return (
      (await requestResult(
        transaction.objectStore("todo_lists").get(listId)
      )) || []
    );
  } finally {
    db.close();
  }
}

async function writeList(listId, list) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      ["todo_lists"],
      "readwrite"
    );

    transaction
      .objectStore("todo_lists")
      .put(clone(list), listId);

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };

    transaction.onerror = () => {
      const error =
        transaction.error ||
        new Error(`保存事项列表失败：${listId}`);
      db.close();
      reject(error);
    };
  });
}

function normalizeTask(task, listId) {
  return {
    id: task.id || createId("task"),
    text: String(task.text || ""),
    checked: Boolean(task.checked),
    listId,
    desc: task.desc || "",
    subTaskList: Array.isArray(task.subTaskList)
      ? task.subTaskList
      : [],
    color: task.color || "none",
    priority: Number(task.priority || 0),
    tags: Array.isArray(task.tags) ? task.tags : [],
    time: task.time || null,
    alarm: Boolean(task.alarm),
    reminders: Array.isArray(task.reminders)
      ? task.reminders
      : [],
    repeatingEvent: task.repeatingEvent || null,
    ...task,
    listId,
  };
}

async function scanForTask(taskId) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      ["todo_lists"],
      "readonly"
    );
    const request = transaction
      .objectStore("todo_lists")
      .openCursor();

    request.onsuccess = () => {
      const cursor = request.result;

      if (!cursor) {
        db.close();
        resolve(null);
        return;
      }

      const list = Array.isArray(cursor.value)
        ? cursor.value
        : [];
      const index = list.findIndex(
        (task) => task?.id === taskId
      );

      if (index >= 0) {
        const result = {
          task: normalizeTask(list[index], String(cursor.key)),
          listId: String(cursor.key),
          index,
          list,
        };
        db.close();
        resolve(result);
        return;
      }

      cursor.continue();
    };

    request.onerror = () => {
      const error =
        request.error || new Error("查找事项失败");
      db.close();
      reject(error);
    };
  });
}

const todoTaskRepository = {
  async ensureAllTaskIds() {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      let changedCount = 0;
      const transaction = db.transaction(
        ["todo_lists"],
        "readwrite"
      );
      const request = transaction
        .objectStore("todo_lists")
        .openCursor();

      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;

        const listId = String(cursor.key);
        const list = Array.isArray(cursor.value)
          ? cursor.value
          : [];
        let changed = false;

        list.forEach((task) => {
          if (!task.id) {
            task.id = createId("task");
            changed = true;
            changedCount += 1;
          }

          if (!task.listId) {
            task.listId = listId;
            changed = true;
          }
        });

        if (changed) cursor.update(list);
        cursor.continue();
      };

      transaction.oncomplete = () => {
        db.close();
        resolve(changedCount);
      };

      transaction.onerror = () => {
        const error =
          transaction.error ||
          new Error("事项 ID 初始化失败");
        db.close();
        reject(error);
      };
    });
  },

  async getTask(taskId, listId = null) {
    if (listId) {
      const list = await readList(listId);
      const index = list.findIndex(
        (task) => task?.id === taskId
      );

      if (index >= 0) {
        return {
          task: normalizeTask(list[index], listId),
          listId,
          index,
          list,
        };
      }
    }

    return scanForTask(taskId);
  },

  async createTask(input) {
    const listId = String(input.listId);
    const list = await readList(listId);

    const task = normalizeTask(
      {
        id: createId("task"),
        text: input.text,
        checked: false,
        desc: input.desc || "",
        subTaskList: [],
        color: "none",
        priority: Number(input.priority || 0),
        tags: [],
        time: input.time || null,
        alarm: Boolean(input.alarm),
        reminders: [],
        repeatingEvent: null,
      },
      listId
    );

    list.push(task);
    await writeList(listId, list);

    return task;
  },

  async updateTask(taskId, patch, listHint = null) {
    const found = await this.getTask(taskId, listHint);

    if (!found) {
      throw new Error("关联事项不存在或已被删除");
    }

    const updated = normalizeTask(
      {
        ...found.task,
        ...clone(patch),
        id: taskId,
      },
      found.listId
    );

    found.list.splice(found.index, 1, updated);
    await writeList(found.listId, found.list);

    return updated;
  },

  async toggleTask(taskId, listHint = null) {
    const found = await this.getTask(taskId, listHint);

    if (!found) {
      throw new Error("关联事项不存在或已被删除");
    }

    return this.updateTask(
      taskId,
      { checked: !found.task.checked },
      found.listId
    );
  },

  async deleteTask(taskId, listHint = null) {
    const found = await this.getTask(taskId, listHint);
    if (!found) return false;

    found.list.splice(found.index, 1);
    await writeList(found.listId, found.list);
    return true;
  },
};

export default todoTaskRepository;
