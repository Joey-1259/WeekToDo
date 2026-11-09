<template>
  <aside class="fdx-sidebar" aria-label="文档目录">
    <div class="fdx-sb-head">
      <label class="fdx-sb-search">
        <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" /></svg>
        <input
          v-model.trim="query"
          type="text"
          placeholder="搜索文档"
          @keydown.esc="onSearchEsc"
        />
      </label>
      <button
        type="button"
        class="fdx-sb-icon"
        :title="allCollapsed ? '全部展开' : '全部折叠'"
        @click="toggleAll"
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path v-if="allCollapsed" d="m6 4 4 4 4-4M6 12l4 4 4-4" />
          <path v-else d="m6 8 4-4 4 4M6 16l4-4 4 4" />
        </svg>
      </button>
    </div>

    <div ref="tree" class="fdx-sb-tree" role="tree">
      <div
        v-for="row in rows"
        :key="row.key"
        class="fdx-sb-row"
        :class="{
          'is-folder': row.type === 'folder',
          'is-current': row.type === 'doc' && row.id === currentId,
        }"
        :style="{ '--depth': row.depth }"
        role="treeitem"
        :aria-expanded="row.type === 'folder' ? String(!isCollapsed(row.id)) : undefined"
        :title="row.name"
        @click="onClick(row)"
      >
        <span
          class="fdx-sb-twisty"
          :class="{
            'is-folder': row.type === 'folder',
            'is-collapsed': row.type === 'folder' && isCollapsed(row.id),
          }"
        ></span>
        <svg v-if="row.type === 'folder'" class="fdx-sb-ico" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.6l1.4 1.5h5A1.5 1.5 0 0 1 14 6v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5Z" />
        </svg>
        <svg v-else class="fdx-sb-ico" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M9.5 2H4.5A1.5 1.5 0 0 0 3 3.5v9A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5V5.5Z" />
          <path d="M9.5 2v3.5H13" />
        </svg>
        <span class="fdx-sb-name">
          {{ row.name || (row.type === "folder" ? "未命名目录" : "未命名文档") }}
        </span>
        <span v-if="row.type === 'folder' && row.count" class="fdx-sb-count">{{ row.count }}</span>
        <i
          v-else-if="row.type === 'doc' && row.id !== currentId && openIds.includes(row.id)"
          class="fdx-sb-dot"
          title="已在分栏中"
        ></i>
      </div>

      <p v-if="!rows.length" class="fdx-sb-empty">
        {{ query ? "没有匹配的文档" : "还没有文档" }}
      </p>
    </div>

    <div
      class="fdx-sb-resizer"
      title="拖动调整宽度 · 双击还原"
      @pointerdown="startResize"
      @dblclick="$emit('resize', 248)"
    ></div>
  </aside>
</template>

<script>
/* FOCUS_POLISH_20261028_V3：全屏专注模式左侧目录栏 */
const COLLAPSE_KEY = "focusDirCollapsed";

function readCollapsed() {
  try {
    const value = JSON.parse(localStorage.getItem(COLLAPSE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export default {
  name: "FocusDialogSidebar",

  props: {
    folders: { type: Array, default: () => [] },
    documents: { type: Array, default: () => [] },
    currentId: { type: String, default: null },
    currentTitle: { type: String, default: "" },
    openIds: { type: Array, default: () => [] },
  },

  emits: ["select", "resize"],

  data() {
    return { query: "", collapsed: new Set(readCollapsed()) };
  },

  computed: {
    folderMap() {
      return new Map(this.folders.map((folder) => [folder.id, folder]));
    },

    docs() {
      return this.documents.map((doc) =>
        doc.id === this.currentId ? { ...doc, title: this.currentTitle } : doc
      );
    },

    childFolders() {
      const map = new Map();
      this.folders.forEach((folder) => {
        const key = folder.parentId && this.folderMap.has(folder.parentId) ? folder.parentId : "__root__";
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(folder);
      });
      map.forEach((list) => list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
      return map;
    },

    childDocs() {
      const map = new Map();
      this.docs.forEach((doc) => {
        const key = doc.folderId && this.folderMap.has(doc.folderId) ? doc.folderId : "__root__";
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(doc);
      });
      map.forEach((list) =>
        list.sort(
          (a, b) =>
            (a.manualOrder ?? 0) - (b.manualOrder ?? 0) ||
            String(a.title || "").localeCompare(String(b.title || ""), "zh-CN")
        )
      );
      return map;
    },

    allCollapsed() {
      return this.folders.length > 0 && this.folders.every((f) => this.collapsed.has(f.id));
    },

    rows() {
      const q = this.query.toLowerCase();
      const match = (doc) => !q || String(doc.title || "").toLowerCase().includes(q);
      const docRow = (doc, depth) => ({ key: "d:" + doc.id, type: "doc", id: doc.id, name: doc.title, depth });

      const walk = (parentKey, depth) => {
        const out = [];
        (this.childFolders.get(parentKey) || []).forEach((folder) => {
          const ownDocs = this.childDocs.get(folder.id) || [];
          const children = [
            ...walk(folder.id, depth + 1),
            ...ownDocs.filter(match).map((doc) => docRow(doc, depth + 1)),
          ];
          if (q && !children.length) return;

          out.push({
            key: "f:" + folder.id,
            type: "folder",
            id: folder.id,
            name: folder.name,
            depth,
            count: (this.childFolders.get(folder.id) || []).length + ownDocs.length,
          });

          if (q || !this.collapsed.has(folder.id)) out.push(...children);
        });
        return out;
      };

      return [
        ...walk("__root__", 0),
        ...(this.childDocs.get("__root__") || []).filter(match).map((doc) => docRow(doc, 0)),
      ];
    },
  },

  watch: {
    currentId() {
      this.reveal();
    },
  },

  mounted() {
    this.reveal();
  },

  beforeUnmount() {
    this.stopResize();
  },

  methods: {
    /* FOCUS_POLISH_20261109_V3_1：Esc 一次退一层——有内容先清空，空则失焦，再按才退出全屏 */
    onSearchEsc(event) {
      event.preventDefault();
      event.stopPropagation();
      if (this.query) this.query = "";
      else event.target.blur();
    },

    isCollapsed(id) {
      return this.collapsed.has(id);
    },

    persist() {
      try {
        localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...this.collapsed]));
      } catch {
        /* ignore */
      }
    },

    toggle(id) {
      const next = new Set(this.collapsed);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      this.collapsed = next;
      this.persist();
    },

    toggleAll() {
      this.collapsed = this.allCollapsed ? new Set() : new Set(this.folders.map((f) => f.id));
      this.persist();
    },

    onClick(row) {
      if (row.type === "folder") {
        this.toggle(row.id);
        return;
      }
      if (row.id !== this.currentId) this.$emit("select", row.id);
    },

    /** 展开当前文档的所有祖先目录，并滚动到可见 */
    reveal() {
      const doc = this.documents.find((item) => item.id === this.currentId);
      let cursor = doc?.folderId;
      const next = new Set(this.collapsed);
      const seen = new Set();
      let changed = false;

      while (cursor && !seen.has(cursor)) {
        seen.add(cursor);
        if (next.delete(cursor)) changed = true;
        cursor = this.folderMap.get(cursor)?.parentId;
      }

      if (changed) {
        this.collapsed = next;
        this.persist();
      }

      this.$nextTick(() => {
        this.$refs.tree?.querySelector(".fdx-sb-row.is-current")?.scrollIntoView({ block: "nearest" });
      });
    },

    startResize(event) {
      if (event.button !== 0) return;
      event.preventDefault();
      const aside = this.$el;
      this._resize = { x: event.clientX, w: aside.getBoundingClientRect().width };
      document.body.classList.add("fdx-sb-resizing");
      window.addEventListener("pointermove", this.onResize, true);
      window.addEventListener("pointerup", this.stopResize, true);
    },

    onResize(event) {
      if (!this._resize) return;
      const width = Math.round(Math.max(200, Math.min(420, this._resize.w + event.clientX - this._resize.x)));
      this.$emit("resize", width);
    },

    stopResize() {
      this._resize = null;
      document.body.classList.remove("fdx-sb-resizing");
      window.removeEventListener("pointermove", this.onResize, true);
      window.removeEventListener("pointerup", this.stopResize, true);
    },
  },
};
</script>

<style lang="scss">
.fdx-sidebar {
  position: relative;
  display: flex;
  min-width: 0;
  flex-direction: column;
  border-right: 1px solid #eceef1;
  background: #fafbfc;
}

.fdx-sb-head {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
  padding: 12px 10px 8px 12px;
}

.fdx-sb-search {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 8px;
  border: 1px solid #e3e6ea;
  border-radius: 7px;
  background: #fff;
  color: #9aa1aa;

  &:focus-within { border-color: #4263eb; }

  svg { width: 13px; height: 13px; flex: 0 0 13px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; }

  input {
    min-width: 0;
    flex: 1;
    border: 0;
    background: transparent;
    color: #2f353d;
    font: inherit;
    font-size: 12px;
    outline: none;
  }
}

.fdx-sb-icon {
  display: grid;
  width: 26px;
  height: 26px;
  flex: 0 0 26px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #7a818b;
  cursor: pointer;

  &:hover { background: #eef0f3; color: #24282e; }

  svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
}

.fdx-sb-tree {
  min-height: 0;
  flex: 1;
  padding: 2px 6px 16px;
  overflow-y: auto;
}

.fdx-sb-row {
  display: flex;
  height: 30px;
  align-items: center;
  gap: 6px;
  padding-right: 8px;
  padding-left: calc(6px + var(--depth, 0) * 16px);
  border-radius: 6px;
  color: #4a515b;
  font-size: 12.5px;
  cursor: pointer;
  user-select: none;

  &:hover { background: #eef0f3; }

  &.is-folder { color: #3a4048; font-weight: 550; }

  &.is-current {
    background: #e8edff;
    color: #2f4bc4;
    font-weight: 600;
  }
}

.fdx-sb-twisty {
  display: grid;
  width: 14px;
  height: 14px;
  flex: 0 0 14px;
  place-items: center;

  &.is-folder::before {
    width: 5px;
    height: 5px;
    border-right: 1.5px solid #8a919b;
    border-bottom: 1.5px solid #8a919b;
    content: "";
    transform: translate(0, -1px) rotate(45deg);
    transition: transform 0.15s ease;
  }

  &.is-folder.is-collapsed::before { transform: translate(-1px, 0) rotate(-45deg); }
}

.fdx-sb-ico {
  width: 14px;
  height: 14px;
  flex: 0 0 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.3;
  stroke-linejoin: round;
  opacity: 0.75;
}

.fdx-sb-name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fdx-sb-count { color: #a7adb5; font-size: 11px; font-weight: 400; }

.fdx-sb-dot {
  width: 6px;
  height: 6px;
  flex: 0 0 6px;
  border-radius: 50%;
  background: #8da2fb;
}

.fdx-sb-empty {
  margin: 24px 0;
  color: #a7adb5;
  font-size: 12px;
  text-align: center;
}

.fdx-sb-resizer {
  position: absolute;
  z-index: 2;
  top: 0;
  right: -3px;
  bottom: 0;
  width: 6px;
  cursor: col-resize;

  &:hover { background: linear-gradient(90deg, transparent 2px, #4263eb 2px, #4263eb 4px, transparent 4px); }
}

body.fdx-sb-resizing,
body.fdx-sb-resizing * {
  cursor: col-resize !important;
  user-select: none !important;
}

.dark-theme .fdx-sidebar { border-color: #262d36; background: #12171d; }
.dark-theme .fdx-sb-search { border-color: #333a44; background: #1a2027; }
.dark-theme .fdx-sb-search input { color: #dfe3e8; }
.dark-theme .fdx-sb-row { color: #b6bdc6; }
.dark-theme .fdx-sb-row.is-folder { color: #d3d8de; }
.dark-theme .fdx-sb-row:hover { background: #1f262f; }
.dark-theme .fdx-sb-row.is-current { background: #1e2740; color: #a9bbff; }
.dark-theme .fdx-sb-icon:hover { background: #1f262f; color: #eef1f4; }
</style>
