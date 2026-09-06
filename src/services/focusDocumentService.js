import focusDataRepository, {
  FOCUS_STORES,
} from "../repositories/focusDataRepository";
import focusTaskService from "./focusTaskService";
import { createId } from "../helpers/idHelper";

const EMPTY_CONTENT = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

const revisionTimes = new Map();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalize(record) {
  const now = new Date().toISOString();

  return {
    id: record.id,
    title: record.title || "",
    tags: Array.isArray(record.tags) ? record.tags : [],
    content: record.content || clone(EMPTY_CONTENT),
    draft: Boolean(record.draft),
    pinned: Boolean(record.pinned),
    archivedAt: record.archivedAt || null,
    deletedAt: record.deletedAt || null,
    createdAt: record.createdAt || now,
    updatedAt: record.updatedAt || now,
    lastOpenedAt: record.lastOpenedAt || now,
  };
}

async function createRevision(document) {
  const last = revisionTimes.get(document.id) || 0;
  const now = Date.now();

  if (now - last < 10 * 60 * 1000) return;

  revisionTimes.set(document.id, now);

  await focusDataRepository.put(
    FOCUS_STORES.revisions,
    {
      id: createId("revision"),
      documentId: document.id,
      title: document.title,
      content: clone(document.content),
      createdAt: new Date(now).toISOString(),
    }
  );

  const revisions =
    await focusDataRepository.getAllByIndex(
      FOCUS_STORES.revisions,
      "documentId",
      document.id
    );

  const overflow = revisions
    .sort((a, b) =>
      String(b.createdAt).localeCompare(String(a.createdAt))
    )
    .slice(30);

  await Promise.all(
    overflow.map((item) =>
      focusDataRepository.remove(
        FOCUS_STORES.revisions,
        item.id
      )
    )
  );
}

const focusDocumentService = {
  emptyContent() {
    return clone(EMPTY_CONTENT);
  },

  createDraftRecord() {
    const now = new Date().toISOString();

    return normalize({
      id: createId("doc"),
      title: "",
      tags: [],
      content: clone(EMPTY_CONTENT),
      draft: true,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
    });
  },

  async listDocuments({
    includeArchived = false,
    includeDeleted = false,
  } = {}) {
    const records = await focusDataRepository.getAll(
      FOCUS_STORES.documents
    );

    return records
      .map(normalize)
      .filter(
        (item) =>
          (includeArchived || !item.archivedAt) &&
          (includeDeleted || !item.deletedAt)
      )
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return String(b.updatedAt).localeCompare(
          String(a.updatedAt)
        );
      });
  },

  async getDocument(id) {
    const record = await focusDataRepository.get(
      FOCUS_STORES.documents,
      id
    );

    return record ? normalize(record) : null;
  },

  async saveDocument(document, { final = false } = {}) {
    const current =
      (await this.getDocument(document.id)) || document;
    const now = new Date().toISOString();

    const saved = normalize({
      ...current,
      ...clone(document),
      id: document.id,
      title: String(document.title || "").slice(0, 120),
      draft: final ? false : Boolean(document.draft),
      createdAt: current.createdAt || now,
      updatedAt: now,
      lastOpenedAt: now,
    });

    await focusDataRepository.put(
      FOCUS_STORES.documents,
      saved
    );

    await createRevision(saved);
    return saved;
  },

  async updateDocument(id, patch) {
    const current = await this.getDocument(id);
    if (!current) throw new Error(`文档不存在：${id}`);

    return this.saveDocument({
      ...current,
      ...clone(patch),
      id,
    });
  },

  async archiveDocument(id) {
    return this.updateDocument(id, {
      archivedAt: new Date().toISOString(),
    });
  },

  async deleteDocument(id) {
    await focusTaskService.removeDocumentLinks(id);
    await focusDataRepository.remove(
      FOCUS_STORES.documents,
      id
    );
  },
};

export default focusDocumentService;
