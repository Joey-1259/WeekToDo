<template>
  <div class="dir-backdrop" @mousedown.self="$emit('close')">
    <section
      ref="dialog"
      class="dir-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dir-title"
      tabindex="-1"
      @keydown="onDialogKeydown"
    >
      <header class="dir-header">
        <span class="dir-header-icon" aria-hidden="true">
          <i class="bi-folder2-open"></i>
        </span>

        <div class="dir-header-text">
          <strong id="dir-title">文件目录</strong>
          <small>{{ folderCount }} 个目录 · {{ documents.length }} 篇文档</small>
        </div>

        <label class="dir-search">
          <AppIcon name="search" />
          <input
            ref="search"
            v-model.trim="query"
            type="text"
            placeholder="搜索目录与文档"
            @keydown.down.prevent="focusTree"
            @keydown.esc.prevent="clearSearch"
          />
          <button
            v-if="query"
            type="button"
            class="dir-search-clear"
            aria-label="清空搜索"
            @click="clearSearch"
          >
            <AppIcon name="close" />
          </button>
        </label>

        <button
          type="button"
          class="dir-icon-btn"
          v-tip="{ label: '新建根目录' }"
          @click="beginCreate(null)"
        >
          <AppIcon name="plus" />
        </button>

        <button
          type="button"
          class="dir-icon-btn"
          v-tip="{ label: '关闭', keys: 'esc' }"
          @click="$emit('close')"
        >
          <AppIcon name="close" />
        </button>
      </header>

      <!-- 单一树：目录与文档同处一棵树，层级关系直接可见。
           这是替换旧版左右双栏的核心原因——双栏永远看不到
           "这个目录里装着什么"，而目录的意义正是这个关系。 -->
      <div
        ref="tree"
        class="dir-tree"
        role="tree"
        aria-label="文件目录"
        tabindex="0"
        @keydown="onTreeKeydown"
        @dragover.prevent="onRootDragOver"
        @drop.prevent="onRootDrop"
      >
        <div
          v-for="row in visibleRows"
          :key="row.key"
          class="dir-row"
          :class="{
            'is-folder': row.type === 'folder',
            'is-doc': row.type === 'doc',
            'is-active': activeKey === row.key,
            'is-open-doc': row.type === 'doc' && openIds.includes(row.id),
            'drop-into': dropTarget.key === row.key && dropTarget.zone === 'into',
            'drop-before': dropTarget.key === row.key && dropTarget.zone === 'before',
            'drop-after': dropTarget.key === row.key && dropTarget.zone === 'after',
          }"
          :style="{ '--depth': row.depth }"
          role="treeitem"
          :aria-level="row.depth + 1"
          :aria-selected="activeKey === row.key"
          :aria-expanded="
            row.type === 'folder' ? String(!collapsed.has(row.id)) : undefined
          "
          :draggable="editingKey !== row.key"
          @click="activeKey = row.key"
          @dblclick="onRowActivate(row)"
          @dragstart="onDragStart(row, $event)"
          @dragend="resetDrop"
          @dragover.prevent.stop="onRowDragOver(row, $event)"
          @dragleave="onRowDragLeave(row)"
          @drop.prevent.stop="onRowDrop(row)"
        >
          <button
            v-if="row.type === 'folder'"
            type="button"
            class="dir-twisty"
            :class="{ 'is-collapsed': collapsed.has(row.id) }"
            :aria-label="collapsed.has(row.id) ? '展开' : '折叠'"
            @click.stop="toggleCollapse(row.id)"
          >
            <AppIcon name="chevronDown" />
          </button>
          <span v-else class="dir-twisty-spacer"></span>

          <span class="dir-row-icon" aria-hidden="true">
            <AppIcon :name="row.type === 'folder' ? 'folder' : 'markdown'" />
          </span>

          <input
            v-if="editingKey === row.key"
            ref="renameInput"
            v-model="renameDraft"
            class="dir-rename"
            maxlength="120"
            @click.stop
            @keydown.enter.prevent="commitRename(row)"
            @keydown.esc.stop.prevent="cancelRename"
            @blur="onRenameBlur(row)"
          />

          <span v-else class="dir-row-name" :title="row.name">
            {{ row.name || (row.type === "folder" ? "未命名目录" : "未命名文档") }}
          </span>

          <span
            v-if="row.type === 'folder' && !editingKey"
            class="dir-row-count"
          >
            {{ row.childCount || "" }}
          </span>

          <span v-if="row.type === 'doc' && openIds.includes(row.id)"
            class="dir-row-badge">已并列</span>

          <span class="dir-row-actions">
            <button
              v-if="row.type === 'folder'"
              type="button"
              class="dir-row-btn"
              v-tip="{ label: '在此新建子目录' }"
              @click.stop="beginCreate(row.id)"
            >
              <AppIcon name="plus" />
            </button>

            <button
              type="button"
              class="dir-row-btn"
              v-tip="{ label: '重命名', keys: 'F2' }"
              @click.stop="beginRename(row)"
            >
              <AppIcon name="eraser" />
            </button>

            <button
              type="button"
              class="dir-row-btn is-danger"
              v-tip="{ label: '删除', keys: 'Delete' }"
              @click.stop="requestDelete(row)"
            >
              <AppIcon name="close" />
            </button>
          </span>
        </div>

        <div v-if="creating" class="dir-row is-editing" :style="{ '--depth': createDepth }">
          <span class="dir-twisty-spacer"></span>
          <span class="dir-row-icon"><AppIcon name="folder" /></span>
          <input
            ref="createInput"
            v-model="createDraft"
            class="dir-rename"
            maxlength="60"
            placeholder="目录名称"
            @keydown.enter.prevent="commitCreate"
            @keydown.esc.stop.prevent="cancelCreate"
            @blur="commitCreate"
          />
        </div>

        <p v-if="!visibleRows.length && !creating" class="dir-empty">
          {{ query ? "没有匹配的目录或文档" : "还没有目录，右上角可以新建" }}
        </p>
      </div>

      <footer class="dir-footer">
        <span class="dir-breadcrumb" :title="breadcrumb">
          {{ breadcrumb || "未选择" }}
        </span>

        <span class="dir-footer-spacer"></span>

        <span class="dir-tips">
          <kbd>↑↓</kbd> 移动 · <kbd>→</kbd> 展开 · <kbd>F2</kbd> 重命名 ·
          <kbd>Enter</kbd> 打开
        </span>

        <button
          type="button"
          class="dir-primary"
          :disabled="!activeDoc"
          @click="openActiveDoc"
        >
          在新分栏打开
        </button>
      </footer>
    </section>
  </div>
</template>

<script>
/* FOCUS_UI_SYSTEM_20260910_V5 */
import AppIcon from "../../components/ui/AppIcon.vue";
import { tip } from "../../directives/tooltip";

/**
 * 文件目录浏览器。
 *
 * 相对旧版 FocusDirectoryManager 的三个结构性改变：
 *
 * 1) 单一树。旧版左栏目录、右栏"当前目录的文档"，导致层级关系不可见。
 *    Notion / 语雀都是文件夹与文档同处一棵树，文档即文件夹的子节点。
 *
 * 2) 拖拽三段落点取代菜单。旧版靠每行 ··· 菜单里的"向上移动 / 向下移动"
 *    改顺序，一次操作两次点击两级菜单。现在拖到行的上缘 = 排在它前面，
 *    中间 = 放进它里面，下缘 = 排在它后面，一个手势覆盖三个旧菜单项。
 *
 * 3) 重命名不再失焦即提交。旧版 @blur="commit" 会在用户点开别的节点时
 *    把改名坐实，且与 Esc 取消语义冲突（Esc 也会触发 blur）。
 *    现在：Enter 提交，Esc 取消，失焦仅在"内容确有变化且非空"时提交。
 */

const EDGE_RATIO = 0.28;

export default {
  name: "FocusDirectoryBrowser",

  components: { AppIcon },

  directives: { tip },

  props: {
    folders: { type: Array, default: () => [] },
    documents: { type: Array, default: () => [] },
    selectedFolderId: { type: String, default: null },
    openIds: { type: Array, default: () => [] },
  },

  emits: [
    "close",
    "open-document",
    "select-folder",
    "create-folder",
    "rename-folder",
    "delete-folder",
    "rename-document",
    "delete-document",
    "move-document",
    "move-folder",
    "reorder",
  ],

  data() {
    return {
      query: "",
      activeKey: null,
      collapsed: new Set(),
      editingKey: null,
      renameDraft: "",
      creating: false,
      createParentId: null,
      createDraft: "",
      dragged: null,
      dropTarget: { key: null, zone: null },
    };
  },

  computed: {
    folderCount() {
      return this.folders.length;
    },

    childFolders() {
      const map = new Map();

      this.folders.forEach((folder) => {
        const parent = folder.parentId || "__root__";
        if (!map.has(parent)) map.set(parent, []);
        map.get(parent).push(folder);
      });

      map.forEach((list) =>
        list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      );

      return map;
    },

    childDocs() {
      const map = new Map();

      this.documents.forEach((doc) => {
        const parent = doc.folderId || "__root__";
        if (!map.has(parent)) map.set(parent, []);
        map.get(parent).push(doc);
      });

      map.forEach((list) =>
        list.sort(
          (a, b) =>
            (a.manualOrder ?? 0) - (b.manualOrder ?? 0) ||
            String(a.title).localeCompare(String(b.title), "zh-CN")
        )
      );

      return map;
    },

    /** 全量树（不含搜索过滤），文档挂在所属目录下面。 */
    allRows() {
      const rows = [];

      const walk = (parentId, depth) => {
        (this.childFolders.get(parentId) || []).forEach((folder) => {
          const docs = this.childDocs.get(folder.id) || [];
          const subs = this.childFolders.get(folder.id) || [];

          rows.push({
            key: "f:" + folder.id,
            type: "folder",
            id: folder.id,
            name: folder.name,
            parentId: folder.parentId || null,
            depth,
            childCount: docs.length + subs.length,
          });

          walk(folder.id, depth + 1);

          docs.forEach((doc) =>
            rows.push({
              key: "d:" + doc.id,
              type: "doc",
              id: doc.id,
              name: doc.title,
              parentId: folder.id,
              depth: depth + 1,
            })
          );
        });
      };

      walk("__root__", 0);

      // 未归档文档放在树的末尾，和 Notion 的 Private 区一个意思。
      (this.childDocs.get("__root__") || []).forEach((doc) =>
        rows.push({
          key: "d:" + doc.id,
          type: "doc",
          id: doc.id,
          name: doc.title,
          parentId: null,
          depth: 0,
        })
      );

      return rows;
    },

    /** 搜索命中项 + 其祖先链（语雀行为，不把树打平）。 */
    matchedKeys() {
      if (!this.query) return null;

      const needle = this.query.toLowerCase();
      const keep = new Set();

      const parentOf = new Map();
      this.allRows.forEach((row) => parentOf.set(row.key, row.parentId));

      this.allRows.forEach((row) => {
        if (!String(row.name || "").toLowerCase().includes(needle)) return;

        keep.add(row.key);

        let cursor = row.parentId;
        while (cursor) {
          keep.add("f:" + cursor);
          const parent = this.folders.find((f) => f.id === cursor);
          cursor = parent ? parent.parentId : null;
        }
      });

      return keep;
    },

    visibleRows() {
      const hiddenUnder = new Set();

      return this.allRows.filter((row) => {
        if (this.matchedKeys && !this.matchedKeys.has(row.key)) return false;

        // 折叠只在非搜索态生效，搜索时强制展开命中路径。
        if (!this.matchedKeys) {
          let cursor = row.parentId;

          while (cursor) {
            if (this.collapsed.has(cursor)) return false;
            const parent = this.folders.find((f) => f.id === cursor);
            cursor = parent ? parent.parentId : null;
          }
        }

        if (hiddenUnder.size) hiddenUnder.clear();
        return true;
      });
    },

    activeRow() {
      return this.visibleRows.find((row) => row.key === this.activeKey) || null;
    },

    activeDoc() {
      return this.activeRow && this.activeRow.type === "doc"
        ? this.activeRow
        : null;
    },

    createDepth() {
      if (!this.createParentId) return 0;

      const row = this.allRows.find(
        (item) => item.key === "f:" + this.createParentId
      );

      return row ? row.depth + 1 : 0;
    },

    breadcrumb() {
      if (!this.activeRow) return "";

      const parts = [this.activeRow.name || "未命名"];
      let cursor = this.activeRow.parentId;

      while (cursor) {
        const folder = this.folders.find((item) => item.id === cursor);
        if (!folder) break;

        parts.unshift(folder.name || "未命名目录");
        cursor = folder.parentId;
      }

      return parts.join("  ›  ");
    },
  },

  mounted() {
    this.folders.forEach((folder) => {
      if (folder.collapsed) this.collapsed.add(folder.id);
    });

    this.$nextTick(() => {
      this.$refs.dialog?.focus();
      if (this.visibleRows.length) this.activeKey = this.visibleRows[0].key;
    });
  },

  methods: {
    focusTree() {
      this.$refs.tree?.focus();
      if (!this.activeKey && this.visibleRows.length) {
        this.activeKey = this.visibleRows[0].key;
      }
    },

    clearSearch() {
      this.query = "";
    },

    toggleCollapse(id) {
      const next = new Set(this.collapsed);

      if (next.has(id)) next.delete(id);
      else next.add(id);

      this.collapsed = next;
    },

    onRowActivate(row) {
      if (row.type === "folder") {
        this.toggleCollapse(row.id);
        this.$emit("select-folder", row.id);
        return;
      }

      this.$emit("open-document", row.id);
    },

    openActiveDoc() {
      if (this.activeDoc) this.$emit("open-document", this.activeDoc.id);
    },

    /* ---------- 键盘流 ---------- */

    onDialogKeydown(event) {
      if (event.key === "Escape" && !this.editingKey && !this.creating) {
        event.preventDefault();
        this.$emit("close");
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === "f") {
        event.preventDefault();
        this.$refs.search?.focus();
      }
    },

    onTreeKeydown(event) {
      if (this.editingKey || this.creating) return;

      const rows = this.visibleRows;
      if (!rows.length) return;

      const index = rows.findIndex((row) => row.key === this.activeKey);
      const row = rows[index] || null;

      const step = (delta) => {
        event.preventDefault();
        const next = Math.max(0, Math.min(rows.length - 1, index + delta));
        this.activeKey = rows[next].key;
        this.scrollActiveIntoView();
      };

      switch (event.key) {
        case "ArrowDown":
          step(index < 0 ? 0 : 1);
          break;

        case "ArrowUp":
          step(index < 0 ? 0 : -1);
          break;

        case "ArrowRight":
          event.preventDefault();
          if (row && row.type === "folder" && this.collapsed.has(row.id)) {
            this.toggleCollapse(row.id);
          } else {
            step(1);
          }
          break;

        case "ArrowLeft":
          event.preventDefault();
          if (row && row.type === "folder" && !this.collapsed.has(row.id)) {
            this.toggleCollapse(row.id);
          } else if (row && row.parentId) {
            this.activeKey = "f:" + row.parentId;
            this.scrollActiveIntoView();
          }
          break;

        case "Enter":
          event.preventDefault();
          if (row) this.onRowActivate(row);
          break;

        case "F2":
          event.preventDefault();
          if (row) this.beginRename(row);
          break;

        case "Backspace":
        case "Delete":
          event.preventDefault();
          if (row) this.requestDelete(row);
          break;

        default:
          break;
      }
    },

    scrollActiveIntoView() {
      this.$nextTick(() => {
        this.$refs.tree
          ?.querySelector(".dir-row.is-active")
          ?.scrollIntoView({ block: "nearest" });
      });
    },

    /* ---------- 重命名 ---------- */

    beginRename(row) {
      this.editingKey = row.key;
      this.renameDraft = row.name || "";
      this.activeKey = row.key;

      this.$nextTick(() => {
        const input = this.$refs.renameInput;
        const el = Array.isArray(input) ? input[0] : input;

        el?.focus();
        el?.select();
      });
    },

    commitRename(row) {
      const name = String(this.renameDraft || "").trim();

      this.editingKey = null;

      if (!name || name === row.name) return;

      this.$emit(
        row.type === "folder" ? "rename-folder" : "rename-document",
        { id: row.id, name }
      );
    },

    cancelRename() {
      this.editingKey = null;
      this.renameDraft = "";
    },

    /** 失焦只在内容确有变化且非空时提交，其余视为放弃。 */
    onRenameBlur(row) {
      const name = String(this.renameDraft || "").trim();

      if (!name || name === row.name) {
        this.cancelRename();
        return;
      }

      this.commitRename(row);
    },

    /* ---------- 新建目录 ---------- */

    beginCreate(parentId) {
      this.creating = true;
      this.createParentId = parentId || null;
      this.createDraft = "";

      if (parentId) this.collapsed.delete(parentId);

      this.$nextTick(() => this.$refs.createInput?.focus());
    },

    commitCreate() {
      if (!this.creating) return;

      const name = String(this.createDraft || "").trim();
      const parentId = this.createParentId;

      this.creating = false;
      this.createDraft = "";

      if (!name) return;

      this.$emit("create-folder", { name, parentId });
    },

    cancelCreate() {
      this.creating = false;
      this.createDraft = "";
    },

    requestDelete(row) {
      this.$emit(
        row.type === "folder" ? "delete-folder" : "delete-document",
        row.id
      );
    },

    /* ---------- 拖拽：上缘 / 中间 / 下缘 三段落点 ---------- */

    onDragStart(row, event) {
      this.dragged = row;

      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", row.key);
    },

    zoneOf(event, element) {
      const rect = element.getBoundingClientRect();
      const offset = (event.clientY - rect.top) / rect.height;

      if (offset < EDGE_RATIO) return "before";
      if (offset > 1 - EDGE_RATIO) return "after";

      return "into";
    },

    onRowDragOver(row, event) {
      if (!this.dragged || this.dragged.key === row.key) return;

      // 目录不能拖进自己的子树。
      if (this.dragged.type === "folder" && this.isDescendant(row, this.dragged.id)) {
        return;
      }

      let zone = this.zoneOf(event, event.currentTarget);

      // 文档不能"装进"另一篇文档，退化为前后排序。
      if (zone === "into" && row.type === "doc") zone = "after";

      this.dropTarget = { key: row.key, zone };
    },

    onRowDragLeave(row) {
      if (this.dropTarget.key === row.key) this.resetDrop();
    },

    isDescendant(row, folderId) {
      let cursor = row.type === "folder" ? row.id : row.parentId;

      while (cursor) {
        if (cursor === folderId) return true;
        const parent = this.folders.find((item) => item.id === cursor);
        cursor = parent ? parent.parentId : null;
      }

      return false;
    },

    onRowDrop(row) {
      const dragged = this.dragged;
      const zone = this.dropTarget.zone;

      this.resetDrop();

      if (!dragged || !zone || dragged.key === row.key) return;

      const targetParent = zone === "into" ? row.id : row.parentId;

      if (dragged.type === "doc") {
        this.$emit("move-document", {
          id: dragged.id,
          folderId: zone === "into" ? row.id : row.parentId || null,
          beforeId: zone === "before" ? row.id : null,
          afterId: zone === "after" ? row.id : null,
        });
        return;
      }

      this.$emit("move-folder", {
        id: dragged.id,
        parentId: zone === "into" ? row.id : targetParent || null,
        beforeId: zone === "before" ? row.id : null,
        afterId: zone === "after" ? row.id : null,
      });
    },

    onRootDragOver() {
      if (this.dragged) this.dropTarget = { key: "__root__", zone: "into" };
    },

    onRootDrop() {
      const dragged = this.dragged;
      this.resetDrop();

      if (!dragged) return;

      if (dragged.type === "doc") {
        this.$emit("move-document", { id: dragged.id, folderId: null });
      } else {
        this.$emit("move-folder", { id: dragged.id, parentId: null });
      }
    },

    resetDrop() {
      this.dragged = null;
      this.dropTarget = { key: null, zone: null };
    },
  },
};
</script>

<style scoped lang="scss">
.dir-backdrop {
  position: fixed;
  z-index: 21000;
  display: grid;
  inset: 0;
  place-items: center;
  padding: 32px;
  background: rgba(20, 24, 31, 0.42);
  backdrop-filter: blur(2px);
}

.dir-dialog {
  display: flex;
  width: min(720px, 100%);
  max-height: min(680px, 100%);
  flex-direction: column;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 24px 68px rgba(18, 22, 30, 0.28);
  outline: none;
  overflow: hidden;
}

.dir-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid #eef0f3;
}

.dir-header-icon {
  display: grid;
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  place-items: center;
  border-radius: 8px;
  background: #eef2ff;
  color: #4263eb;
  font-size: 14px;
}

.dir-header-text {
  display: flex;
  min-width: 0;
  flex-direction: column;

  strong {
    color: #24282e;
    font-size: 14.5px;
    font-weight: 650;
  }

  small {
    color: #9aa0a9;
    font-size: 11px;
  }
}

.dir-search {
  position: relative;
  display: flex;
  min-width: 0;
  flex: 1 1 auto;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 8px;
  border: 1px solid #e4e7eb;
  border-radius: 8px;
  color: #8d949d;
  transition: border-color 0.14s ease;

  &:focus-within {
    border-color: #4263eb;
  }

  input {
    min-width: 0;
    flex: 1 1 auto;
    border: 0;
    color: #2f353d;
    font-family: inherit;
    font-size: 12.5px;
    outline: none;
  }
}

.dir-search-clear,
.dir-icon-btn {
  display: grid;
  width: 26px;
  height: 26px;
  flex: 0 0 26px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #6d747e;
  cursor: pointer;

  &:hover {
    background: #f0f2f5;
    color: #24282e;
  }
}

.dir-tree {
  flex: 1 1 auto;
  padding: 6px;
  overflow-y: auto;
  outline: none;
}

.dir-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding-right: 6px;
  padding-left: calc(6px + var(--depth, 0) * 18px);
  border-radius: 7px;
  color: #3f454e;
  font-size: 12.5px;
  cursor: pointer;
  user-select: none;

  &:hover {
    background: #f5f7f9;
  }

  &.is-active {
    background: #eef2ff;
    color: #2f4bc4;
  }

  &.is-folder .dir-row-name {
    font-weight: 560;
  }

  /* 落点反馈：中间 = 整行高亮框，上下缘 = 2px 指示线 */
  &.drop-into {
    background: #e4ecff;
    box-shadow: inset 0 0 0 1.5px #4263eb;
  }

  &.drop-before::before,
  &.drop-after::after {
    position: absolute;
    left: calc(6px + var(--depth, 0) * 18px);
    right: 6px;
    height: 2px;
    background: #4263eb;
    border-radius: 2px;
    content: "";
  }

  &.drop-before::before { top: -1px; }
  &.drop-after::after { bottom: -1px; }
}

.dir-twisty {
  display: grid;
  width: 18px;
  height: 18px;
  flex: 0 0 18px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #98a0aa;
  cursor: pointer;

  &:hover {
    background: #e6eaef;
    color: #4a515b;
  }

  :deep(.app-icon) {
    width: 13px;
    height: 13px;
    transition: transform 0.14s ease;
  }

  &.is-collapsed :deep(.app-icon) {
    transform: rotate(-90deg);
  }
}

.dir-twisty-spacer {
  width: 18px;
  flex: 0 0 18px;
}

.dir-row-icon {
  display: grid;
  flex: 0 0 16px;
  place-items: center;
  color: #8d949d;
}

.dir-row.is-folder .dir-row-icon { color: #6f86d6; }
.dir-row.is-active .dir-row-icon { color: #4263eb; }

.dir-row-name {
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dir-row-count {
  flex: 0 0 auto;
  color: #aeb4bd;
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
}

.dir-row-badge {
  flex: 0 0 auto;
  padding: 1px 6px;
  border-radius: 8px;
  background: #e6f0ff;
  color: #3b62d4;
  font-size: 10px;
}

.dir-row-actions {
  display: none;
  flex: 0 0 auto;
  align-items: center;
  gap: 1px;
}

.dir-row:hover .dir-row-actions,
.dir-row.is-active .dir-row-actions {
  display: flex;
}

.dir-row-btn {
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #79808a;
  cursor: pointer;

  &:hover {
    background: #e2e6ec;
    color: #24282e;
  }

  &.is-danger:hover {
    background: #ffe8e6;
    color: #d14343;
  }

  :deep(.app-icon) {
    width: 13px;
    height: 13px;
  }
}

.dir-rename {
  min-width: 0;
  flex: 1 1 auto;
  height: 24px;
  padding: 0 6px;
  border: 1px solid #4263eb;
  border-radius: 5px;
  color: #24282e;
  font-family: inherit;
  font-size: 12.5px;
  outline: none;
}

.dir-empty {
  padding: 40px 12px;
  color: #9aa0a9;
  font-size: 12.5px;
  text-align: center;
}

.dir-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-top: 1px solid #eef0f3;
  background: #fafbfc;
}

.dir-breadcrumb {
  max-width: 40%;
  overflow: hidden;
  color: #6d747e;
  font-size: 11.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dir-footer-spacer {
  flex: 1 1 auto;
}

.dir-tips {
  color: #a8aeb7;
  font-size: 10.5px;

  kbd {
    padding: 1px 4px;
    border-radius: 3px;
    background: #eceef1;
    color: #79808a;
    font-family: inherit;
    font-size: 10px;
  }
}

.dir-primary {
  padding: 6px 13px;
  border: 0;
  border-radius: 7px;
  background: #4263eb;
  color: #fff;
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: #3853cc;
  }

  &:disabled {
    background: #dfe3e8;
    color: #a8aeb7;
    cursor: default;
  }
}

.dark-theme {
  .dir-dialog { background: #1d232b; }
  .dir-header, .dir-footer { border-color: #2a323c; }
  .dir-footer { background: #191f26; }
  .dir-header-icon { background: #1c2333; color: #6c8fff; }
  .dir-header-text strong { color: #e3e7ec; }
  .dir-search { border-color: #39414c; }
  .dir-search input { color: #dfe3e8; }
  .dir-row { color: #c3c9d1; }
  .dir-row:hover { background: #242b34; }
  .dir-row.is-active { background: #1e2740; color: #a8bcfb; }
  .dir-rename { background: #161b22; color: #dfe3e8; }
  .dir-primary:disabled { background: #333a44; color: #6d747e; }
}
</style>
