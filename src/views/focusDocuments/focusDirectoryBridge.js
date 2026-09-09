/* FOCUS_UI_SYSTEM_20260911_V6 */

/**
 * 目录浏览器桥接层。
 *
 * 为什么做成 mixin 而不是让补丁脚本去改 FocusDocumentsView 的
 * import / components / methods：那三处都是"成员顺序敏感"的位置，
 * 用正则去插入极易失配（上一轮就是这么崩的）。mixin 的 components
 * 会被 Vue 合并进宿主组件，所以脚本只需要替换模板里那一个标签。
 *
 * 契约（新组件 emits → 这里的实现）：
 *   close            → closeDirectory（宿主已有）
 *   open-document    → openDirectoryDocument（宿主已有）
 *   select-folder    → 记录当前目录
 *   create-folder    → focusFolderService.createFolder
 *   rename-folder    → focusFolderService.renameFolder
 *   delete-folder    → releaseFolder + deleteFolder（先释放文档，避免幽灵数据）
 *   rename-document  → focusDocumentService.updateDocument
 *   delete-document  → focusDocumentService.deleteDocument
 *   move-document    → moveDocument + reorderDocuments（真正落地排序）
 *   move-folder      → moveFolder + reorderFolders（真正落地排序）
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

/**
 * 把"拖到 anchor 的前面 / 后面"翻译成完整的兄弟 id 序列。
 * 服务层的 reorder 接口要的是全序列，不是相对位置。
 */
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
    /** 宿主的 reload 名字可能不同，统一收口一次。 */
    async fdRefresh() {
      if (typeof this.reload === "function") {
        await this.reload();
        return;
      }

      if (typeof this.loadAll === "function") {
        await this.loadAll();
        return;
      }

      // 兜底：至少把两份列表拉新，界面不会停在旧数据上。
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

      // 顺序很重要：先释放文档，再删目录。反过来会留下
      // folderId 指向已不存在目录的幽灵文档。
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
        // 服务层已经拦了"移到自己子树"，这里只做提示。
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
  },
};
