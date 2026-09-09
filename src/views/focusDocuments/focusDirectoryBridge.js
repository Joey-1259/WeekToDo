/* FOCUS_UI_SYSTEM_20260912_V8 */

/**
 * 目录浏览器桥接层。
 *
 * 本版新增：
 *   document-action → 转发给宿主既有的 handleDocumentAction。
 *     复制 / 导出 / 移动在 FocusDocumentsView 里已经有完整实现，
 *     目录里不再另写一套 —— 两套导出逻辑各自演化是必然的长期债务。
 *
 *   pick 模式 → fdOpenPicker / fdConfirmPick，
 *     取代原来那个只能选目录的独立 move 弹窗。
 */

import FocusDirectoryBrowser from "./FocusDirectoryBrowser.vue";
import focusFolderService from "../../services/focusFolderService";
import focusDocumentService from "../../services/focusDocumentService";

function byManualOrder(a, b) {
  const left = Number.isFinite(a.manualOrder) ? a.manualOrder : 0;
  const right = Number.isFinite(b.manualOrder) ? b.manualOrder : 0;

  if (left !== right) return left - right;

  return String(a.title || "").localeCompare(String(b.title || ""), "zh-CN");
}

function byOrder(a, b) {
  return (a.order ?? 0) - (b.order ?? 0);
}

function spliceOrder(siblings, movedId, beforeId, afterId) {
  const rest = siblings.filter((item) => item.id !== movedId);
  const anchorId = beforeId || afterId;

  if (!anchorId) return [...rest.map((item) => item.id), movedId];

  const index = rest.findIndex((item) => item.id === anchorId);

  if (index < 0) return [...rest.map((item) => item.id), movedId];

  const at = beforeId ? index : index + 1;

  return [
    ...rest.slice(0, at).map((item) => item.id),
    movedId,
    ...rest.slice(at).map((item) => item.id),
  ];
}

export default {
  components: { FocusDirectoryBrowser },

  methods: {
    async fdRefresh() {
      if (typeof this.reload === "function") {
        await this.reload();
        return;
      }

      this.folders = focusFolderService.listFolders();
      this.documents = await focusDocumentService.listDocuments();
    },

    fdSelectFolder(folderId) {
      this.selectedFolderId = folderId || null;
    },

    async fdCreateFolder({ name, parentId }) {
      focusFolderService.createFolder(name, parentId || null);
      await this.fdRefresh();
    },

    async fdRenameFolder({ id, name }) {
      focusFolderService.renameFolder(id, name);
      await this.fdRefresh();
    },

    async fdDeleteFolder(id) {
      const folder = focusFolderService.getFolder(id);
      const label = folder ? folder.name : "该目录";

      const ok = window.confirm(
        "删除目录「" + label + "」？\n\n" +
          "目录里的文档不会被删除，会移到「未归档」。"
      );

      if (!ok) return;

      await focusDocumentService.releaseFolder(id);
      focusFolderService.deleteFolder(id);

      if (this.selectedFolderId === id) this.selectedFolderId = null;

      await this.fdRefresh();
    },

    async fdRenameDocument({ id, name }) {
      await focusDocumentService.updateDocument(id, { title: name });
      await this.fdRefresh();
    },

    async fdDeleteDocument(id) {
      const doc = (this.documents || []).find((item) => item.id === id);
      const label = doc && doc.title ? doc.title : "未命名文档";

      const ok = window.confirm(
        "删除文档「" + label + "」？此操作不可撤销。"
      );

      if (!ok) return;

      await focusDocumentService.deleteDocument(id);
      await this.fdRefresh();
    },

    async fdMoveDocument({ id, folderId, beforeId, afterId }) {
      const target = folderId || null;

      await focusDocumentService.moveDocument(id, target);

      if (beforeId || afterId) {
        const siblings = (this.documents || [])
          .filter((item) => (item.folderId || null) === target)
          .sort(byManualOrder);

        const ordered = spliceOrder(siblings, id, beforeId, afterId);

        await focusDocumentService.reorderDocuments(ordered);
      }

      await this.fdRefresh();
    },

    async fdMoveFolder({ id, parentId, beforeId, afterId }) {
      const target = parentId || null;

      try {
        focusFolderService.moveFolder(id, target);
      } catch (error) {
        window.alert(error.message || "无法移动到该位置");
        return;
      }

      if (beforeId || afterId) {
        const siblings = focusFolderService
          .listFolders()
          .filter((item) => (item.parentId || null) === target)
          .sort(byOrder);

        const ordered = spliceOrder(siblings, id, beforeId, afterId);

        focusFolderService.reorderFolders(ordered, target);
      }

      await this.fdRefresh();
    },

    /** 目录里的复制 / 导出 / 移动，全部复用宿主已有实现。 */
    async fdDocumentAction({ action, id }) {
      const doc = (this.documents || []).find((item) => item.id === id);
      if (!doc) return;

      if (action === "move") {
        this.fdOpenPicker(doc);
        return;
      }

      if (typeof this.handleDocumentAction === "function") {
        await this.handleDocumentAction({ action, document: doc });
        await this.fdRefresh();
      }
    },

    /* ---------- pick 模式 ---------- */

    fdOpenPicker(document) {
      this.moveDialogDocument = document;
    },

    fdClosePicker() {
      this.moveDialogDocument = null;
    },

    async fdConfirmPick(folderId) {
      const doc = this.moveDialogDocument;
      if (!doc) return;

      try {
        const saved = await focusDocumentService.moveDocument(
          doc.id,
          folderId || null
        );

        if (typeof this.replaceDocument === "function") {
          this.replaceDocument(saved);
        }
      } catch (error) {
        console.error(error);
        window.alert("移动文档失败，请重试。");
      } finally {
        this.moveDialogDocument = null;
        await this.fdRefresh();
      }
    },
  },
};
