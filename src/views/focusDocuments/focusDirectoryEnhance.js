/* FOCUS_POLISH_20261028_V3：目录树增强（参考语雀 / Notion）
 * 拖拽：放弃 HTML5 DnD，改用 Pointer 事件——落点确定、无 dragleave 抖动、Electron 下稳定
 *       跟手预览卡写明"松手会发生什么"；悬停 0.6s 展开折叠目录；边缘自动滚动；Esc 取消
 * 撤销：移动后 5 秒内可撤销
 * 右键菜单 / + 号二选一 / ⌥↑↓ 同级排序 / ⌘↵ 全屏 / 折叠状态记忆 / 全部展开折叠
 */
import "./focusDirectoryEnhance.css";
import { DRAG_THRESHOLD, resolveDropZone, buildMovePayload } from "./focusTreeDnd";

const COLLAPSE_KEY = "focusDirCollapsed";
const EXPAND_DELAY = 600;
const SCROLL_EDGE = 44;

export default {
  data() {
    return {
      fxToast: null,
      fxToastTimer: null,
      fxExpandTimer: null,
      fxExpandKey: null,
      fxAddMenu: { row: null, style: {} },
      fxPress: null,
      fxDragging: false,
      fxGhost: null,
      fxPointer: { x: 0, y: 0 },
      fxScrollRaf: 0,
      fxSuppressClick: false,
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
    this.fxEndDrag();
  },

  methods: {
    /* ================= 工具 ================= */

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

      const base = { id: undo.id, beforeId: undo.beforeId, afterId: undo.afterId };
      if (undo.type === "doc") this.$emit("move-document", { ...base, folderId: undo.parentId });
      else this.$emit("move-folder", { ...base, parentId: undo.parentId });
    },

    fxRowName(row) {
      return row?.name || (row?.type === "folder" ? "未命名目录" : "未命名文档");
    },

    /* ================= Pointer 拖拽 ================= */

    fxRowClick(row) {
      if (this.fxSuppressClick) return;
      this.activeKey = row.key;
    },

    fxPointerDown(row, event) {
      if (!this.canDrag || event.button !== 0 || this.editingKey || this.creating) return;
      if (event.target.closest("button, input, textarea, a")) return;

      this.fxPress = { row, x: event.clientX, y: event.clientY };
      window.addEventListener("pointermove", this.fxOnMove, true);
      window.addEventListener("pointerup", this.fxOnUp, true);
      window.addEventListener("pointercancel", this.fxEndDrag, true);
      window.addEventListener("keydown", this.fxOnKey, true);
    },

    fxOnMove(event) {
      const press = this.fxPress;
      if (!press) return;
      this.fxPointer = { x: event.clientX, y: event.clientY };

      if (!this.fxDragging) {
        if (Math.hypot(event.clientX - press.x, event.clientY - press.y) < DRAG_THRESHOLD) return;
        this.fxBeginDrag(press.row);
      }

      event.preventDefault();
      this.fxMoveGhost(event.clientX, event.clientY);
      this.fxUpdateTarget(event.clientX, event.clientY);
    },

    fxBeginDrag(row) {
      this.fxDragging = true;
      this.dragged = row;
      this.activeKey = row.key;
      this.closeRowMenu?.();
      this.fxAddMenu = { row: null, style: {} };
      document.body.classList.add("dir-is-dragging");
      window.getSelection?.()?.removeAllRanges(); /* FOCUS_POLISH_20261109_V3_1 */

      const ghost = document.createElement("div");
      ghost.className = "dir-drag-ghost";
      const name = document.createElement("strong");
      name.textContent = this.fxRowName(row);
      const hint = document.createElement("small");
      ghost.append(name, hint);
      document.body.appendChild(ghost);
      this.fxGhost = ghost;

      cancelAnimationFrame(this.fxScrollRaf);
      this.fxScrollRaf = requestAnimationFrame(this.fxScrollLoop);
    },

    fxMoveGhost(x, y) {
      if (this.fxGhost) this.fxGhost.style.transform = `translate(${x + 14}px, ${y + 10}px)`;
    },

    fxComputeTarget(x, y) {
      const dragged = this.dragged;
      const tree = this.$refs.tree;
      if (!dragged || !tree) return null;

      const element = document.elementFromPoint(x, y);
      if (!element || !tree.contains(element)) return null;
      if (element.closest("[data-root-drop]")) return { key: "__root__", zone: "into" };

      const rowElement = element.closest(".dir-row[data-key]");
      if (!rowElement) return dragged.parentId ? { key: "__root__", zone: "into" } : null;

      const row = this.visibleRows.find((item) => item.key === rowElement.dataset.key);
      if (!row || row.key === dragged.key) return null;
      if (dragged.type === "folder" && this.isDescendant(row, dragged.id)) return null;

      const rect = rowElement.getBoundingClientRect();
      const zone = resolveDropZone(dragged.type, row.type, (y - rect.top) / rect.height);
      if (!zone) return null;
      if (zone === "into" && (dragged.parentId || null) === row.id) return null;

      return { key: row.key, zone };
    },

    fxUpdateTarget(x, y) {
      const target = this.fxComputeTarget(x, y);
      this.dropTarget = target || { key: null, zone: null };

      if (this.fxGhost) {
        const hint = this.fxGhost.querySelector("small");
        let text = "";
        if (target?.key === "__root__") text = "移出目录（未归档）";
        else if (target) {
          const row = this.visibleRows.find((item) => item.key === target.key);
          const name = this.fxRowName(row);
          text = target.zone === "into" ? `移入「${name}」` : `排在「${name}」${target.zone === "before" ? "之前" : "之后"}`;
        }
        hint.textContent = text;
        this.fxGhost.classList.toggle("is-invalid", !target);
      }

      const expandable =
        target && target.zone === "into" && target.key.startsWith("f:") && this.collapsed.has(target.key.slice(2));

      if (!expandable) {
        this.fxClearExpand();
      } else if (this.fxExpandKey !== target.key) {
        this.fxClearExpand();
        this.fxExpandKey = target.key;
        const id = target.key.slice(2);
        this.fxExpandTimer = setTimeout(() => {
          this.fxExpandKey = null;
          if (this.fxDragging && this.collapsed.has(id)) this.toggleCollapse(id);
        }, EXPAND_DELAY);
      }
    },

    fxScrollLoop() {
      if (!this.fxDragging) return;
      const tree = this.$refs.tree;
      if (tree) {
        const rect = tree.getBoundingClientRect();
        const y = this.fxPointer.y;
        let delta = 0;
        if (y < rect.top + SCROLL_EDGE) delta = -Math.min(18, Math.ceil((rect.top + SCROLL_EDGE - y) / 3));
        else if (y > rect.bottom - SCROLL_EDGE) delta = Math.min(18, Math.ceil((y - rect.bottom + SCROLL_EDGE) / 3));
        if (delta) {
          tree.scrollTop += delta;
          this.fxUpdateTarget(this.fxPointer.x, this.fxPointer.y);
        }
      }
      this.fxScrollRaf = requestAnimationFrame(this.fxScrollLoop);
    },

    fxOnUp(event) {
      const wasDragging = this.fxDragging;
      const dragged = this.dragged;
      const target = wasDragging ? this.fxComputeTarget(event.clientX, event.clientY) : null;

      this.fxEndDrag();
      if (!wasDragging) return;

      this.fxSuppressClick = true;
      setTimeout(() => {
        this.fxSuppressClick = false;
      }, 0);

      if (target && dragged) this.fxCommitDrop(dragged, target);
    },

    fxOnKey(event) {
      if (event.key !== "Escape" || !this.fxPress) return;
      event.preventDefault();
      event.stopPropagation();
      this.fxEndDrag();
    },

    fxEndDrag() {
      window.removeEventListener("pointermove", this.fxOnMove, true);
      window.removeEventListener("pointerup", this.fxOnUp, true);
      window.removeEventListener("pointercancel", this.fxEndDrag, true);
      window.removeEventListener("keydown", this.fxOnKey, true);
      cancelAnimationFrame(this.fxScrollRaf);
      this.fxClearExpand();
      this.fxGhost?.remove();
      this.fxGhost = null;
      document.body.classList.remove("dir-is-dragging");
      this.fxPress = null;
      this.fxDragging = false;
      this.dragged = null;
      this.dropTarget = { key: null, zone: null };
    },

    fxCommitDrop(dragged, target) {
      const row = target.key === "__root__" ? null : this.allRows.find((item) => item.key === target.key);
      const move = buildMovePayload(dragged, target, row);
      if (!move) return;

      const undo = this.fxSnapshot(dragged);
      this.$emit(move.event, move.payload);
      const newParent = move.event === "move-document" ? move.payload.folderId : move.payload.parentId;
      this.fxAfterMove(dragged, undo, newParent);
    },

    fxClearExpand() {
      clearTimeout(this.fxExpandTimer);
      this.fxExpandTimer = null;
      this.fxExpandKey = null;
    },

    /* ================= 键盘 ================= */

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

      if (row.type === "doc") this.$emit("move-document", { ...payload, folderId: row.parentId || null });
      else this.$emit("move-folder", { ...payload, parentId: row.parentId || null });
    },

    /* ================= 菜单 ================= */

    fxContextMenu(row, event) {
      if (!this.canManage) return;
      this.activeKey = row.key;

      const width = 188;
      const height = row.type === "doc" ? 320 : 190;
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
