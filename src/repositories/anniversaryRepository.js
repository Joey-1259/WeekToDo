import storageRepository from "./storageRepository";

const STORAGE_KEY = "anniversaryList";

export default {
  load() {
    let list = storageRepository.get(STORAGE_KEY);
    return list || [];
  },
  update(list) {
    storageRepository.set(STORAGE_KEY, list);
  },
  add(item) {
    let list = this.load();
    list.push(item);
    this.update(list);
    return list;
  },
  remove(id) {
    let list = this.load().filter((x) => x.id !== id);
    this.update(list);
    return list;
  },
  edit(id, patch) {
    let list = this.load();
    let idx = list.findIndex((x) => x.id === id);
    if (idx !== -1) {
      list[idx] = Object.assign({}, list[idx], patch);
      this.update(list);
    }
    return list;
  },
};
