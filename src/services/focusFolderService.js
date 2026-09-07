const STORAGE_KEY = "weektodo.focus-folders.v1";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return `folder-${globalThis.crypto.randomUUID()}`;
  }

  return `folder-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

function readFolders() {
  try {
    const value = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]"
    );

    return Array.isArray(value)
      ? value
          .filter((item) => item?.id)
          .map((item, index) => ({
            id: String(item.id),
            name: String(item.name || "未命名目录").slice(0, 60),
            parentId: item.parentId || null,
            order: Number.isFinite(item.order)
              ? item.order
              : index,
            collapsed: Boolean(item.collapsed),
            createdAt:
              item.createdAt || new Date().toISOString(),
            updatedAt:
              item.updatedAt || new Date().toISOString(),
          }))
      : [];
  } catch {
    return [];
  }
}

function saveFolders(folders) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(clone(folders))
  );

  window.dispatchEvent(
    new CustomEvent("weektodo:focus-folders-changed")
  );
}

const focusFolderService = {
  listFolders() {
    return readFolders().sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a.name.localeCompare(b.name, "zh-CN");
    });
  },

  getFolder(id) {
    return (
      readFolders().find((item) => item.id === id) || null
    );
  },

  createFolder(name, parentId = null) {
    const folders = readFolders();
    const now = new Date().toISOString();

    const folder = {
      id: createId(),
      name: String(name || "新建目录").trim().slice(0, 60),
      parentId: parentId || null,
      order: folders.length,
      collapsed: false,
      createdAt: now,
      updatedAt: now,
    };

    folders.push(folder);
    saveFolders(folders);
    return clone(folder);
  },

  renameFolder(id, name) {
    const folders = readFolders();
    const folder = folders.find((item) => item.id === id);

    if (!folder) {
      throw new Error(`目录不存在：${id}`);
    }

    folder.name =
      String(name || "").trim().slice(0, 60) || folder.name;
    folder.updatedAt = new Date().toISOString();
    saveFolders(folders);

    return clone(folder);
  },

  moveFolder(id, parentId = null) {
    const folders = readFolders();
    const folder = folders.find((item) => item.id === id);

    if (!folder) {
      throw new Error(`目录不存在：${id}`);
    }

    if (id === parentId) {
      throw new Error("目录不能移动到自身内部");
    }

    let cursor = parentId;

    while (cursor) {
      if (cursor === id) {
        throw new Error("目录不能移动到自己的子目录");
      }

      cursor =
        folders.find((item) => item.id === cursor)?.parentId ||
        null;
    }

    folder.parentId = parentId || null;
    folder.updatedAt = new Date().toISOString();
    saveFolders(folders);

    return clone(folder);
  },

  toggleFolder(id) {
    const folders = readFolders();
    const folder = folders.find((item) => item.id === id);
    if (!folder) return null;

    folder.collapsed = !folder.collapsed;
    folder.updatedAt = new Date().toISOString();
    saveFolders(folders);

    return clone(folder);
  },

  deleteFolder(id) {
    const folders = readFolders();
    const children = folders.filter(
      (item) => item.parentId === id
    );

    children.forEach((item) => {
      item.parentId = null;
      item.updatedAt = new Date().toISOString();
    });

    saveFolders(
      folders.filter((item) => item.id !== id)
    );
  },
};

export default focusFolderService;
