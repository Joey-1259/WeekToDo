import storageRepository from "./storageRepository";
import defaultAnniversaryTags from "../data/defaultAnniversaryTags";

const STORAGE_KEY = "anniversaryTags";

export default {
  load() {
    let list = storageRepository.get(STORAGE_KEY);
    if (!list || !list.length) {
      list = defaultAnniversaryTags.slice();
      storageRepository.set(STORAGE_KEY, list);
    }
    return list;
  },
  update(list) {
    storageRepository.set(STORAGE_KEY, list);
  },
  add(tag) {
    let list = this.load();
    list.push(tag);
    this.update(list);
    return list;
  },
  findById(id) {
    return this.load().find((t) => t.id === id) || null;
  },
};
