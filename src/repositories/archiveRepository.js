import storageRepository from "./storageRepository";

const STORAGE_KEY = "archivedTasks";

export default {
  load() {
    return storageRepository.get(STORAGE_KEY) || [];
  },
  update(list) {
    storageRepository.set(STORAGE_KEY, list);
  },
  /**
   * 将一组已完成的 task 归档
   * @param {string} listId - 来源列表 ID
   * @param {string} listName - 来源列表名称（用于历史展示）
   * @param {Array} tasks - 被归档的 task 数组
   */
  archive(listId, listName, tasks) {
    if (!tasks || !tasks.length) return;
    let list = this.load();
    let now = new Date().toISOString();
    tasks.forEach((task) => {
      list.push({
        text: task.text,
        color: task.color || "none",
        time: task.time || null,
        sourceListId: listId,
        sourceListName: listName,
        archivedAt: now,
      });
    });
    this.update(list);
  },
  clear() {
    this.update([]);
  },
};
