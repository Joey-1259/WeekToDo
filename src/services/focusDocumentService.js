import focusDataRepository, {
  FOCUS_STORES,
} from "../repositories/focusDataRepository";

function createId(prefix) {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;
}

function now() {
  return new Date().toISOString();
}

function emptyContent() {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
      },
    ],
  };
}

function normalizeTagName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 24);
}

const focusDocumentService = {
  async listDocuments(options = {}) {
    const includeArchived =
      Boolean(options.includeArchived);

    const documents =
      await focusDataRepository.getAll(
        FOCUS_STORES.documents
      );

    return documents
      .filter((document) => {
        if (document.deletedAt) {
          return false;
        }

        if (
          !includeArchived &&
          document.archivedAt
        ) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) {
          return a.pinned ? -1 : 1;
        }

        if (
          Number(a.sortOrder || 0) !==
          Number(b.sortOrder || 0)
        ) {
          return (
            Number(a.sortOrder || 0) -
            Number(b.sortOrder || 0)
          );
        }

        return String(b.updatedAt || "").localeCompare(
          String(a.updatedAt || "")
        );
      });
  },

  async createDocument(title = "未命名文档") {
    const timestamp = now();

    const document = {
      id: createId("fd"),
      title:
        String(title || "").trim() ||
        "未命名文档",
      tagIds: [],
      content: emptyContent(),
      plainText: "",
      pinned: false,
      archivedAt: null,
      deletedAt: null,
      sortOrder: Date.now(),
      schemaVersion: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastOpenedAt: timestamp,
    };

    await focusDataRepository.put(
      FOCUS_STORES.documents,
      document
    );

    return document;
  },

  async updateDocument(id, patch) {
    const existing =
      await focusDataRepository.get(
        FOCUS_STORES.documents,
        id
      );

    if (!existing) {
      throw new Error("文档不存在或已被删除");
    }

    const document = {
      ...existing,
      ...patch,
      id,
      updatedAt: now(),
    };

    await focusDataRepository.put(
      FOCUS_STORES.documents,
      document
    );

    return document;
  },

  async archiveDocument(id) {
    return this.updateDocument(id, {
      archivedAt: now(),
    });
  },

  async touchDocument(id) {
    return this.updateDocument(id, {
      lastOpenedAt: now(),
    });
  },

  async listTags() {
    const tags =
      await focusDataRepository.getAll(
        FOCUS_STORES.tags
      );

    return tags.sort((a, b) =>
      String(a.name).localeCompare(
        String(b.name),
        "zh-CN"
      )
    );
  },

  async createTag(name, color = "blue") {
    const cleanName = normalizeTagName(name);

    if (!cleanName) {
      throw new Error("标签名称不能为空");
    }

    const normalizedName =
      cleanName.toLocaleLowerCase();

    const existing =
      await focusDataRepository.getAll(
        FOCUS_STORES.tags
      );

    const duplicate = existing.find(
      (tag) =>
        tag.normalizedName === normalizedName
    );

    if (duplicate) {
      return duplicate;
    }

    const timestamp = now();

    const tag = {
      id: createId("ft"),
      name: cleanName,
      normalizedName,
      color,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await focusDataRepository.put(
      FOCUS_STORES.tags,
      tag
    );

    return tag;
  },
};

export default focusDocumentService;
