/* FOCUS_POLISH_20261028_V2：目录树增强（参考语雀 / Notion）
 * 拖拽：把手 + 预览 + 悬停自动展开 + 边缘滚动 + 落点即时计算（修复 dragleave 清空落点）
 * 撤销：移动后 5 秒内可撤销
 * 右键菜单 / + 号二选一 / ⌥↑↓ 同级排序 / ⌘↵ 全屏 / 折叠状态记忆 / 全部展开折叠
 */
import "./focusDirectoryEnhance.css";

const COLLAPSE_KEY = "focusDirCollapsed";
const EXPAND_DELAY = 650;
const SCROLL_EDGE = 40;
const SCROLL_STEP = 14;
const DOCUMENT_DRAG_TYPE = "application/x-weektodo-document";

export default {
  data() {
    return {
      fxToast: null,
      fxToastTimer: null,
      fxExpandTimer: null,
      fxExpandKey: null,
      fxAddMenu: { row: null, style: {} },
    };
  },

  computed: {
    fxAllCollapsed() {
      return this.folders.length > 0 && this.folders.every((f) => this.collapsed.has(f.id));
    },
  },

  watch: {
    collapsed: {
      deep: true,
      handler(value) {
        if (this.mode !== "manage") return;
        try {
          localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...value]));
        } catch {
          /* 存储不可用时静默 */
        }
      },
    },
  },

  mounted() {
    if (this.mode === "manage") {
      this.$nextTick(() => {
        try {
          const saved = JSON.parse(localStorage.getItem(COLLAPSE_KEY) || "null");
          if (Array.isArray(saved)) {
            const known = new Set(this.folders.map((f) => f.id));
            this.collapsed = new Set(saved.filter((id) => known.has(id)));
          }
        } catch {
          /* ignore */
        }
      });
    }
    document.addEventListener("mousedown", this.fxCloseAddMenu);
  },

  beforeUnmount() {
    document.removeEventListener("mousedown", this.fxCloseAddMenu);
    clearTimeout(this.fxToastTimer);
    clearTimeout(this.fxExpandTimer);
  },

  methods: {
    /* ---------- 工具 ---------- */

    fxFolderName(id) {
      if (!id) return "未归档";
      return this.folders.find((f) => f.id === id)?.name || "目录";
    },

    fxShowToast(text, undo = null) {
      clearTimeout(this.fxToastTimer);
      this.fxToast = { text, undo };
      this.fxToastTimer = setTimeout(() => {
        this.fxToast = null;
      }, 5000);
    },

    fxSiblings(row) {
      const parent = row.parentId || null;
      if (row.type === "doc") {
        return this.allRows.filter((r) => r.type === "doc" && (r.parentId || null) === parent);
      }
      return (this.childFolders.get(parent || "__root__") || []).map((f) => ({ ...f, type: "folder" }));
    },

    /** 记录移动前的位置，供撤销使用 */
    fxSnapshot(row) {
      const siblings = this.fxSiblings(row);
      const index = siblings.findIndex((item) => item.id === row.id);
      const next = siblings[index + 1];
      const prev = siblings[index - 1];
      return {
        type: row.type,
        id: row.id,
        parentId: row.parentId || null,
        beforeId: next ? next.id : null,
        afterId: next ? null : prev ? prev.id : null,
      };
    },

    fxAfterMove(dragged, undo, newParent) {
      const moved = (undo.parentId || null) !== (newParent || null);
      if (newParent && this.collapsed.has(newParent)) this.toggleCollapse(newParent);
      this.activeKey = dragged.key;
      this.fxShowToast(moved ? `已移动到「${this.fxFolderName(newParent)}」` : "已调整顺序", undo);
    },

    fxUndo() {
      const undo = this.fxToast?.undo;
      this.fxToast = null;
      clearTimeout(this.fxToastTimer);
      if (!undo) return;

      if (undo.type === "doc") {
        this.$emit("move-document", {
          id: undo.id,
          folderId: undo.parentId,
          beforeId: undo.beforeId,
          afterId: undo.afterId,
        });
      } else {
        this.$emit("move-folder", {
          id: undo.id,
          parentId: undo.parentId,
          beforeId: undo.beforeId,
          afterId: undo.afterId,
        });
      }
    },

    fxAutoScroll(event) {
      const tree = this.$refs.tree;
      if (!tree) return;
      const rect = tree.getBoundingClientRect();
      if (event.clientY < rect.top + SCROLL_EDGE) tree.scrollTop -= SCROLL_STEP;
      else if (event.clientY > rect.bottom - SCROLL_EDGE) tree.scrollTop += SCROLL_STEP;
    },

    fxClearExpand() {
      clearTimeout(this.fxExpandTimer);
      this.fxExpandTimer = null;
      this.fxExpandKey = null;
    },

    /* ---------- 拖拽 ---------- */

    fxDragStart(row, event) {
      this.onDragStart(row, event);
      if (!this.dragged || !event.dataTransfer) return;

      if (row.type === "doc") {
        try {
          event.dataTransfer.setData(DOCUMENT_DRAG_TYPE, row.id);
        } catch {
          /* ignore */
        }
      }

      const ghost = document.createElement("div");
      ghost.className = "dir-drag-ghost";
      ghost.textContent = row.name || (row.type === "folder" ? "未命名目录" : "未命名文档");
      document.body.appendChild(ghost);
      event.dataTransfer.setDragImage(ghost, 14, 14);
      setTimeout(() => ghost.remove(), 0);
    },

    fxDragEnd() {
      this.fxClearExpand();
      this.resetDrop();
    },

    fxRowDragOver(row, event) {
      this.onRowDragOver(row, event);
      this.fxAutoScroll(event);

      const hovering =
        row.type === "folder" &&
        this.collapsed.has(row.id) &&
        this.dropTarget.key === row.key &&
        this.dropTarget.zone === "into";

      if (!hovering) {
        if (this.fxExpandKey === row.key) this.fxClearExpand();
        return;
      }

      if (this.fxExpandKey === row.key) return;

      this.fxClearExpand();
      this.fxExpandKey = row.key;
      this.fxExpandTimer = setTimeout(() => {
        if (this.dragged && this.collapsed.has(row.id)) this.toggleCollapse(row.id);
        this.fxExpandKey = null;
      }, EXPAND_DELAY);
    },

    /** 只有真正离开整行才清落点；在行内子元素之间移动不算离开 */
    fxRowDragLeave(row, event) {
      const to = event.relatedTarget;
      if (to && event.currentTarget.contains(to)) return;
      this.onRowDragLeave(row);
      if (this.fxExpandKey === row.key) this.fxClearExpand();
    },

    /** 落点在 drop 时按指针位置即时计算，不依赖可能被清空的 dropTarget */
    fxRowDrop(row, event) {
      this.fxClearExpand();
      const dragged = this.dragged;

      if (!dragged || dragged.key === row.key) {
        this.resetDrop();
        return;
      }
      if (dragged.type === "folder" && this.isDescendant(row, dragged.id)) {
        this.resetDrop();
        return;
      }

      let zone = this.zoneOf(event, event.currentTarget);
      if (zone === "into" && row.type === "doc") zone = "after";

      const undo = this.fxSnapshot(dragged);
      const newParent = zone === "into" ? row.id : row.parentId || null;

      this.dropTarget = { key: row.key, zone };
      this.onRowDrop(row);
      this.fxAfterMove(dragged, undo, newParent);
    },

    fxTreeDragOver(event) {
      this.onRootDragOver(event);
      this.fxAutoScroll(event);
    },

    fxRootDrop() {
      this.fxClearExpand();
      const dragged = this.dragged;
      if (!dragged) return;

      if (!dragged.parentId) {
        this.resetDrop();
        return;
      }

      const undo = this.fxSnapshot(dragged);
      this.dropTarget = { key: "__root__", zone: "into" };
      this.onRootDrop();
      this.fxAfterMove(dragged, undo, null);
    },

    /* ---------- 键盘 ---------- */

    fxTreeKeydown(event) {
      if (this.editingKey || this.creating) return;
      const row = this.activeRow;

      if (this.canManage && row && event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        event.preventDefault();
        this.fxNudge(row, event.key === "ArrowUp" ? -1 : 1);
        return;
      }

      if (this.canManage && row && row.type === "doc" && (event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        this.$emit("edit-document", row.id);
        return;
      }

      this.onTreeKeydown(event);
    },

    fxNudge(row, direction) {
      const siblings = this.fxSiblings(row);
      const index = siblings.findIndex((item) => item.id === row.id);
      const target = siblings[index + direction];
      if (!target) return;

      const payload = {
        id: row.id,
        beforeId: direction < 0 ? target.id : null,
        afterId: direction > 0 ? target.id : null,
      };

      if (row.type === "doc") {
        this.$emit("move-document", { ...payload, folderId: row.parentId || null });
      } else {
        this.$emit("move-folder", { ...payload, parentId: row.parentId || null });
      }
    },

    /* ---------- 菜单 ---------- */

    fxContextMenu(row, event) {
      if (!this.canManage) return;
      this.activeKey = row.key;

      const width = 188;
      const height = row.type === "doc" ? 280 : 180;
      const left = Math.max(12, Math.min(window.innerWidth - width - 12, event.clientX));
      const top =
        event.clientY + height > window.innerHeight - 12
          ? Math.max(12, event.clientY - height)
          : event.clientY;

      this.rowMenu = {
        row,
        style: { position: "fixed", width: `${width}px`, left: `${left}px`, top: `${top}px` },
      };
    },

    fxOpenAddMenu(row, event) {
      this.activeKey = row.key;
      const rect = event.currentTarget.getBoundingClientRect();
      const width = 160;
      this.fxAddMenu = {
        row,
        style: {
          position: "fixed",
          width: `${width}px`,
          left: `${Math.max(12, Math.min(window.innerWidth - width - 12, rect.right - width))}px`,
          top: `${rect.bottom + 6}px`,
        },
      };
    },

    fxCloseAddMenu(event) {
      if (event?.target?.closest?.(".dir-add-menu")) return;
      this.fxAddMenu = { row: null, style: {} };
    },

    fxAddDocument() {
      const row = this.fxAddMenu.row;
      this.fxAddMenu = { row: null, style: {} };
      if (row) this.$emit("create-document", { folderId: row.id, title: "" });
    },

    fxAddFolder() {
      const row = this.fxAddMenu.row;
      this.fxAddMenu = { row: null, style: {} };
      if (row) this.beginCreate(row.id);
    },

    fxMenuOpenColumn() {
      const row = this.rowMenu.row;
      this.closeRowMenu();
      if (row) this.$emit("open-document", row.id);
    },

    fxMenuEdit() {
      const row = this.rowMenu.row;
      this.closeRowMenu();
      if (row) this.$emit("edit-document", row.id);
    },

    fxMenuNewDocument() {
      const row = this.rowMenu.row;
      this.closeRowMenu();
      if (row) this.$emit("create-document", { folderId: row.id, title: "" });
    },

    fxCreateDocumentHere() {
      this.$emit("create-document", { folderId: this.selectedCreationFolder, title: "" });
    },

    fxToggleAll() {
      this.collapsed = this.fxAllCollapsed ? new Set() : new Set(this.folders.map((f) => f.id));
    },
  },
};
