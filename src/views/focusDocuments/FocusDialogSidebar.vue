<template>
  <aside
    class="fdx-sidebar sb"
    :class="{ 'is-peek': peek, 'is-dragging': dragging }"
    aria-label="文档目录"
  >
    <header class="sb-head">
      <span class="sb-title">重点事项</span>
      <div class="sb-head-acts">
        <button
          type="button"
          class="sb-ib"
          :title="allCollapsed ? '全部展开' : '全部折叠'"
          @click="toggleAll"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path v-if="allCollapsed" d="m5 3.5 3 3 3-3M5 9.5l3 3 3-3" />
            <path v-else d="m5 6.5 3-3 3 3M5 12.5l3-3 3 3" />
          </svg>
        </button>
        <button
          type="button"
          class="sb-ib"
          title="新建文档或目录"
          @click.stop="openMenu(null, $event)"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.5v9M3.5 8h9" /></svg>
        </button>
        <button
          v-if="peek"
          type="button"
          class="sb-ib"
          title="固定侧边栏（⌘⇧\）"
          @click="$emit('command', { type: 'dock' })"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2.5" width="12" height="11" rx="2" /><path d="M6 2.5v11" /></svg>
        </button>
      </div>
    </header>

    <label class="sb-search">
      <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3 3" /></svg>
      <input
        ref="search"
        v-model.trim="query"
        type="text"
        placeholder="搜索文档"
        @keydown.esc="onSearchEsc"
        @keydown.enter.prevent="openFirstMatch"
        @keydown.down.prevent="focusTree(0)"
      />
      <kbd v-if="!query">⌘P</kbd>
      <button v-else type="button" class="sb-search-x" aria-label="清空搜索" @click="query = ''">×</button>
    </label>

    <div
      ref="tree"
      class="sb-tree"
      role="tree"
      tabindex="0"
      @keydown="onTreeKey"
      @focus="onTreeFocus"
      @scroll.passive="onTreeScroll"
    >
      <div
        v-for="row in rows"
        :key="row.key"
        class="sb-row"
        :class="rowClass(row)"
        :style="{ '--depth': row.depth }"
        :data-sb-key="row.key"
        role="treeitem"
        :aria-level="row.depth + 1"
        :aria-expanded="row.type === 'folder' ? String(row.expanded) : undefined"
        :aria-selected="String(row.type === 'doc' && row.id === currentId)"
        :title="label(row)"
        @pointerdown="onRowPointerDown(row, $event)"
        @click="onRowClick(row, $event)"
        @dblclick="startRename(row)"
        @contextmenu.prevent="openMenu(row, $event)"
      >
        <i
          v-for="g in row.depth"
          :key="g"
          class="sb-guide"
          :style="{ '--g': g - 1 }"
          aria-hidden="true"
        ></i>

        <span
          class="sb-twisty"
          :class="{
            'is-folder': row.type === 'folder',
            'is-collapsed': row.type === 'folder' && !row.expanded,
            'is-empty': row.type === 'folder' && !row.hasChildren,
          }"
          @click.stop="row.type === 'folder' ? toggle(row.id) : onRowClick(row, $event)"
        >
          <svg v-if="row.type === 'folder'" viewBox="0 0 16 16" aria-hidden="true"><path d="m4.5 6 3.5 3.5L11.5 6" /></svg>
          <svg v-else class="sb-doc-ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M9.5 2.5h-5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V5.5Z" /><path d="M9.5 2.5v3h3" /></svg>
        </span>

        <input
          v-if="renaming && renaming.key === row.key"
          :ref="setRenameEl"
          v-model="renaming.value"
          class="sb-rename"
          :maxlength="row.type === 'folder' ? 60 : 120"
          @keydown.enter.prevent="commitRename"
          @keydown.esc.stop.prevent="cancelRename"
          @blur="commitRename"
          @pointerdown.stop
          @click.stop
          @dblclick.stop
        />
        <span v-else class="sb-name" :class="{ 'is-untitled': !row.name }">
          <template v-for="(seg, i) in parts(row)" :key="i">
            <mark v-if="seg.m">{{ seg.t }}</mark>
            <template v-else>{{ seg.t }}</template>
          </template>
        </span>

        <span v-if="!renaming || renaming.key !== row.key" class="sb-acts" @pointerdown.stop @click.stop>
          <button type="button" class="sb-ib sm" title="更多操作" @click="openMenu(row, $event)">
            <svg viewBox="0 0 16 16" aria-hidden="true" class="is-fill"><circle cx="3.5" cy="8" r="1.2" /><circle cx="8" cy="8" r="1.2" /><circle cx="12.5" cy="8" r="1.2" /></svg>
          </button>
          <button
            v-if="row.type === 'folder'"
            type="button"
            class="sb-ib sm"
            title="在此目录新建文档"
            @click="createDocument(row.id)"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.5v9M3.5 8h9" /></svg>
          </button>
        </span>
      </div>

      <div
        v-if="dragging && dragItem && dragItem.parentId"
        class="sb-root-drop"
        :class="{ 'is-over': drop && drop.key === ROOT_KEY }"
        data-sb-root
      >
        移到最外层
      </div>

      <div v-if="!rows.length" class="sb-empty">
        <template v-if="query">没有匹配「{{ query }}」的文档</template>
        <template v-else>
          还没有文档
          <button type="button" @click="createDocument(null)">新建文档</button>
        </template>
      </div>
    </div>

    <div
      class="sb-resizer"
      title="拖动调整宽度 · 双击还原"
      @pointerdown="startResize"
      @dblclick="$emit('resize', 248)"
    ></div>

    <!-- 菜单：position:fixed，挂在 aside 内（浮出态下悬停判定仍算在侧栏内） -->
    <div
      v-if="menu"
      ref="menu"
      class="sb-menu"
      :style="menuStyle"
      role="menu"
      @contextmenu.prevent
    >
      <template v-if="menu.view === 'main'">
        <template v-if="!menu.row">
          <button type="button" class="sb-mi" role="menuitem" @click="menuAction('new-doc')">
            <svg viewBox="0 0 16 16"><path d="M9.5 2.5h-5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V5.5Z" /><path d="M9.5 2.5v3h3" /></svg>
            新建文档
          </button>
          <button type="button" class="sb-mi" role="menuitem" @click="menuAction('new-folder')">
            <svg viewBox="0 0 16 16"><path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.6l1.4 1.5h5A1.5 1.5 0 0 1 14 6v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5Z" /></svg>
            新建目录
          </button>
        </template>

        <template v-else-if="menu.row.type === 'folder'">
          <button type="button" class="sb-mi" role="menuitem" @click="menuAction('new-doc')">
            <svg viewBox="0 0 16 16"><path d="M8 3.5v9M3.5 8h9" /></svg>
            新建文档
          </button>
          <button type="button" class="sb-mi" role="menuitem" @click="menuAction('new-folder')">
            <svg viewBox="0 0 16 16"><path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.6l1.4 1.5h5A1.5 1.5 0 0 1 14 6v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5Z" /></svg>
            新建子目录
          </button>
          <div class="sb-sep"></div>
          <button type="button" class="sb-mi" role="menuitem" @click="menuAction('rename')">
            <svg viewBox="0 0 16 16"><path d="M3 13h3l7-7-3-3-7 7Z" /></svg>
            重命名<kbd>F2</kbd>
          </button>
          <button type="button" class="sb-mi" role="menuitem" @click="menuAction('move')">
            <svg viewBox="0 0 16 16"><path d="M3 8h9M9 5l3 3-3 3" /></svg>
            移动到…<kbd>›</kbd>
          </button>
          <div class="sb-sep"></div>
          <button type="button" class="sb-mi is-danger" role="menuitem" @click="menuAction('delete')">
            <svg viewBox="0 0 16 16"><path d="M3 4.5h10M6.5 2.5h3l.5 2h-4ZM4.5 4.5l.6 9h5.8l.6-9" /></svg>
            删除目录
          </button>
        </template>

        <template v-else>
          <button
            v-if="!openIds.includes(menu.row.id)"
            type="button"
            class="sb-mi"
            role="menuitem"
            @click="menuAction('pin')"
          >
            <svg viewBox="0 0 16 16"><rect x="2" y="3.5" width="12" height="9" rx="1.5" /><path d="M2 6.5h12" /></svg>
            固定到标签栏<kbd>⌘ 点击</kbd>
          </button>
          <button type="button" class="sb-mi" role="menuitem" @click="menuAction('rename')">
            <svg viewBox="0 0 16 16"><path d="M3 13h3l7-7-3-3-7 7Z" /></svg>
            重命名<kbd>F2</kbd>
          </button>
          <button type="button" class="sb-mi" role="menuitem" @click="menuAction('duplicate')">
            <svg viewBox="0 0 16 16"><rect x="5" y="5" width="8" height="8" rx="1.5" /><path d="M3 10.5v-6A1.5 1.5 0 0 1 4.5 3h6" /></svg>
            创建副本
          </button>
          <button type="button" class="sb-mi" role="menuitem" @click="menuAction('move')">
            <svg viewBox="0 0 16 16"><path d="M3 8h9M9 5l3 3-3 3" /></svg>
            移动到…<kbd>›</kbd>
          </button>
          <div class="sb-sep"></div>
          <button type="button" class="sb-mi is-danger" role="menuitem" @click="menuAction('delete')">
            <svg viewBox="0 0 16 16"><path d="M3 4.5h10M6.5 2.5h3l.5 2h-4ZM4.5 4.5l.6 9h5.8l.6-9" /></svg>
            删除
          </button>
        </template>
      </template>

      <template v-else>
        <div class="sb-mv-head">
          <button type="button" class="sb-ib sm" aria-label="返回" @click="menuBack">
            <svg viewBox="0 0 16 16"><path d="m10 3.5-4.5 4.5 4.5 4.5" /></svg>
          </button>
          <span>移动「{{ label(menu.row) }}」到</span>
        </div>
        <input
          ref="moveFilter"
          v-model="menu.filter"
          class="sb-mv-filter"
          placeholder="搜索目录"
          @keydown.enter.prevent="moveToFirst"
        />
        <div class="sb-mv-list">
          <button
            v-for="opt in moveTargets"
            :key="opt.id || ROOT_KEY"
            type="button"
            class="sb-mi"
            :class="{ 'is-current': opt.current }"
            :style="{ paddingLeft: 9 + opt.depth * 14 + 'px' }"
            :disabled="opt.current"
            @click="moveTo(opt)"
          >
            <svg viewBox="0 0 16 16"><path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.6l1.4 1.5h5A1.5 1.5 0 0 1 14 6v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5Z" /></svg>
            <span class="sb-mi-text">{{ opt.name }}</span>
            <svg v-if="opt.current" class="sb-check" viewBox="0 0 16 16"><path d="m3.5 8.5 3 3 6-6.5" /></svg>
          </button>
          <p v-if="!moveTargets.length" class="sb-mv-empty">没有匹配的目录</p>
        </div>
      </template>
    </div>

    <div
      v-if="dragging && dragItem"
      class="sb-ghost"
      :class="{ 'is-invalid': !drop }"
      :style="{ transform: `translate(${pointer.x + 14}px, ${pointer.y + 12}px)` }"
    >
      <strong>{{ dragItem.name }}</strong>
      <small>{{ dropHint }}</small>
    </div>
  </aside>
</template>

<script>
/* FOCUS_SIDEBAR_20261109_V1：全屏模式侧栏（参考语雀 / Notion）
 * 继承 FOCUS_POLISH_20261028_V3 的落点规则；本版把「只能看」的目录栏变成完整操作面：
 *   单击=当前窗口打开 · ⌘单击=固定到标签栏 · 双击=改名 · 右键/⋯=菜单 · 拖拽=整理
 *   键盘：↑↓ ←→ Enter ⌘Enter F2 ⌘⌫ Esc；⌘P 由宿主聚焦搜索
 * 数据操作全部以 command 事件交给宿主（先落盘再执行），组件本身不写存储。
 */
import { DRAG_THRESHOLD, resolveDropZone, buildMovePayload } from "./focusTreeDnd";
import {
  ROOT,
  buildRows,
  descendantFolderIds,
  folderOptions,
  ancestorFolderIds,
  matchRange,
} from "./focusSidebarTree";

const COLLAPSE_KEY = "focusDirCollapsed";
const EXPAND_DELAY = 600;
const SCROLL_EDGE = 32;

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
    peek: { type: Boolean, default: false },
  },

  emits: ["command", "resize"],

  data() {
    return {
      ROOT_KEY: ROOT,
      query: "",
      collapsed: new Set(readCollapsed()),
      focusKey: null,
      renaming: null,
      menu: null,
      menuStyle: {},
      press: null,
      dragging: false,
      dragItem: null,
      drop: null,
      pointer: { x: 0, y: 0 },
      suppressClick: false,
    };
  },

  computed: {
    docs() {
      return this.documents.map((doc) =>
        doc.id === this.currentId ? { ...doc, title: this.currentTitle } : doc
      );
    },

    rows() {
      return buildRows({
        folders: this.folders,
        documents: this.docs,
        collapsed: this.collapsed,
        query: this.query,
      });
    },

    rowMap() {
      return new Map(this.rows.map((row) => [row.key, row]));
    },

    allCollapsed() {
      return this.folders.length > 0 && this.folders.every((f) => this.collapsed.has(f.id));
    },

    /** 宿主据此决定浮出态是否可以收起 */
    busy() {
      return Boolean(this.renaming || this.menu || this.press);
    },

    dropHint() {
      const d = this.drop;
      if (!d) return "此处不可放置";
      if (d.key === ROOT) return "移到最外层";
      const row = this.rowMap.get(d.key);
      const name = row ? this.label(row) : "";
      if (d.zone === "into") return `移入「${name}」`;
      return d.zone === "before" ? `排在「${name}」之前` : `排在「${name}」之后`;
    },

    moveTargets() {
      const m = this.menu;
      if (!m || !m.row || m.view !== "move") return [];
      const row = m.row;
      const blocked = row.type === "folder" ? descendantFolderIds(this.folders, row.id) : new Set();
      const current = row.parentId || null;
      const q = String(m.filter || "").trim().toLowerCase();

      return [{ id: null, name: "最外层", depth: 0 }, ...folderOptions(this.folders)]
        .filter((opt) => !opt.id || !blocked.has(opt.id))
        .filter((opt) => !q || String(opt.name).toLowerCase().includes(q))
        .map((opt) => ({ ...opt, depth: q ? 0 : opt.depth, current: (opt.id || null) === current }));
    },
  },

  watch: {
    currentId() {
      this.reveal();
    },

    query() {
      this.focusKey = null;
    },
  },

  mounted() {
    this.reveal();
  },

  beforeUnmount() {
    this.endDrag();
    this.stopResize();
    this.closeMenu();
  },

  methods: {
    /* ---------- 展示 ---------- */
    label(row) {
      if (!row) return "";
      return row.name || (row.type === "folder" ? "未命名目录" : "未命名文档");
    },

    parts(row) {
      const name = this.label(row);
      const range = matchRange(name, this.query);
      if (!range) return [{ t: name }];
      return [
        { t: name.slice(0, range[0]) },
        { t: name.slice(range[0], range[1]), m: true },
        { t: name.slice(range[1]) },
      ];
    },

    rowClass(row) {
      const d = this.drop;
      const onRow = d && d.key === row.key;
      return {
        "is-folder": row.type === "folder",
        "is-current": row.type === "doc" && row.id === this.currentId,
        "is-focus": this.focusKey === row.key,
        "is-menu": this.menu && this.menu.row && this.menu.row.key === row.key,
        "is-drag-src": this.dragging && this.dragItem && this.dragItem.key === row.key,
        "drop-into": onRow && d.zone === "into",
        "drop-before": onRow && d.zone === "before",
        "drop-after": onRow && d.zone === "after",
      };
    },

    scrollToKey(key) {
      if (!key) return;
      this.$nextTick(() => {
        const el = this.$refs.tree?.querySelector(`[data-sb-key="${CSS.escape(key)}"]`);
        el?.scrollIntoView({ block: "nearest" });
      });
    },

    /* ---------- 折叠 ---------- */
    persist() {
      try {
        localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...this.collapsed]));
      } catch {
        /* 存储不可用时静默 */
      }
    },

    expand(id) {
      if (!id || !this.collapsed.has(id)) return;
      const next = new Set(this.collapsed);
      next.delete(id);
      this.collapsed = next;
      this.persist();
    },

    collapse(id) {
      if (!id || this.collapsed.has(id)) return;
      const next = new Set(this.collapsed);
      next.add(id);
      this.collapsed = next;
      this.persist();
    },

    toggle(id) {
      if (this.collapsed.has(id)) this.expand(id);
      else this.collapse(id);
    },

    toggleAll() {
      this.collapsed = this.allCollapsed ? new Set() : new Set(this.folders.map((f) => f.id));
      this.persist();
    },

    /** 展开当前文档的祖先目录并滚动到可见 */
    reveal() {
      const doc = this.documents.find((item) => item.id === this.currentId);
      const ids = ancestorFolderIds(this.folders, doc && doc.folderId);
      if (ids.some((id) => this.collapsed.has(id))) {
        const next = new Set(this.collapsed);
        ids.forEach((id) => next.delete(id));
        this.collapsed = next;
        this.persist();
      }
      if (this.currentId) this.focusKey = "d:" + this.currentId;
      this.scrollToKey(this.focusKey);
    },

    /* ---------- 搜索 ---------- */
    focusSearch() {
      this.$nextTick(() => {
        this.$refs.search?.focus();
        this.$refs.search?.select();
      });
    },

    onSearchEsc(event) {
      event.preventDefault();
      event.stopPropagation();
      if (this.query) this.query = "";
      else event.target.blur();
    },

    openFirstMatch() {
      const first = this.rows.find((row) => row.type === "doc");
      if (first) this.$emit("command", { type: "open", id: first.id });
    },

    /* ---------- 点击 / 键盘 ---------- */
    onRowClick(row, event) {
      if (this.suppressClick) return;
      this.focusKey = row.key;
      if (row.type === "folder") {
        this.toggle(row.id);
        return;
      }
      if (event && (event.metaKey || event.ctrlKey)) {
        this.$emit("command", { type: "pin", id: row.id });
        return;
      }
      if (row.id !== this.currentId) this.$emit("command", { type: "open", id: row.id });
    },

    focusTree(index) {
      const row = this.rows[index];
      if (row) this.focusKey = row.key;
      this.$refs.tree?.focus();
    },

    onTreeFocus() {
      if (!this.focusKey || !this.rowMap.has(this.focusKey)) {
        this.focusKey = this.rows[0] ? this.rows[0].key : null;
      }
    },

    onTreeScroll() {
      if (this.menu) this.closeMenu();
    },

    onTreeKey(event) {
      if (this.renaming || event.target !== this.$refs.tree) return;
      const rows = this.rows;
      if (!rows.length) return;

      let i = rows.findIndex((r) => r.key === this.focusKey);
      const row = rows[i];
      const mod = event.metaKey || event.ctrlKey;

      switch (event.key) {
        case "ArrowDown":
          i = Math.min(rows.length - 1, i + 1);
          break;
        case "ArrowUp":
          i = Math.max(0, i - 1);
          break;
        case "Home":
          i = 0;
          break;
        case "End":
          i = rows.length - 1;
          break;
        case "ArrowRight":
          if (row && row.type === "folder") {
            if (!row.expanded) this.expand(row.id);
            else if (rows[i + 1] && rows[i + 1].depth > row.depth) i += 1;
          }
          break;
        case "ArrowLeft":
          if (row && row.type === "folder" && row.expanded && !this.query) {
            this.collapse(row.id);
          } else if (row && row.parentId) {
            const p = rows.findIndex((r) => r.key === "f:" + row.parentId);
            if (p >= 0) i = p;
          }
          break;
        case "Enter":
          if (!row) return;
          if (row.type === "folder") this.toggle(row.id);
          else this.$emit("command", { type: mod ? "pin" : "open", id: row.id });
          break;
        case "F2":
          if (row) this.startRename(row);
          break;
        case "Backspace":
        case "Delete":
          if (!mod || !row) return;
          this.$emit("command", { type: "delete", kind: row.type, id: row.id });
          break;
        case "Escape":
          this.$refs.tree.blur();
          break;
        default:
          return;
      }

      event.preventDefault();
      event.stopPropagation();
      if (i < 0) i = 0;
      this.focusKey = rows[i] ? rows[i].key : null;
      this.scrollToKey(this.focusKey);
    },

    /* ---------- 改名 ---------- */
    setRenameEl(el) {
      this._renameEl = el;
    },

    startRename(row) {
      if (!row) return;
      this.closeMenu();
      this.renaming = { key: row.key, kind: row.type, id: row.id, value: row.name || "", original: row.name || "" };
      this.$nextTick(() => {
        this._renameEl?.focus();
        this._renameEl?.select();
      });
    },

    commitRename() {
      const r = this.renaming;
      if (!r) return;
      this.renaming = null;
      const name = String(r.value || "").trim();
      if (!name || name === r.original) return;
      this.$emit("command", { type: "rename", kind: r.kind, id: r.id, name });
    },

    cancelRename() {
      this.renaming = null;
      this.$refs.tree?.focus();
    },

    /* ---------- 新建 ---------- */
    createDocument(folderId) {
      this.query = "";
      if (folderId) this.expand(folderId);
      this.$emit("command", { type: "create-document", folderId: folderId || null });
    },

    createFolder(parentId) {
      this.query = "";
      if (parentId) this.expand(parentId);
      this.$emit("command", {
        type: "create-folder",
        parentId: parentId || null,
        name: "新建目录",
        done: (folder) => {
          if (!folder) return;
          this.$nextTick(() => {
            const row = this.rowMap.get("f:" + folder.id);
            if (!row) return;
            this.scrollToKey(row.key);
            this.startRename(row);
          });
        },
      });
    },

    /* ---------- 菜单 ---------- */
    openMenu(row, event) {
      if (this.dragging) return;
      const isContext = event.type === "contextmenu";
      const rect = !isContext && event.currentTarget && event.currentTarget.getBoundingClientRect
        ? event.currentTarget.getBoundingClientRect()
        : null;
      const x = rect ? rect.left : event.clientX;
      const y = rect ? rect.bottom + 4 : event.clientY;

      if (row) this.focusKey = row.key;
      this.menu = { row, view: "main", filter: "", x, y };
      this.menuStyle = { left: `${x}px`, top: `${y}px` };
      this.bindMenu();
      this.$nextTick(this.clampMenu);
    },

    clampMenu() {
      const el = this.$refs.menu;
      const m = this.menu;
      if (!el || !m) return;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      this.menuStyle = {
        left: `${Math.max(8, Math.min(m.x, window.innerWidth - w - 8))}px`,
        top: `${Math.max(8, Math.min(m.y, window.innerHeight - h - 8))}px`,
      };
    },

    bindMenu() {
      if (this._menuBound) return;
      this._menuBound = true;
      window.addEventListener("pointerdown", this.onMenuOutside, true);
      window.addEventListener("keydown", this.onMenuKey, true);
      window.addEventListener("resize", this.closeMenu);
    },

    closeMenu() {
      this.menu = null;
      if (!this._menuBound) return;
      this._menuBound = false;
      window.removeEventListener("pointerdown", this.onMenuOutside, true);
      window.removeEventListener("keydown", this.onMenuKey, true);
      window.removeEventListener("resize", this.closeMenu);
    },

    onMenuOutside(event) {
      if (this.$refs.menu && this.$refs.menu.contains(event.target)) return;
      this.closeMenu();
    },

    onMenuKey(event) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      if (this.menu && this.menu.view === "move") this.menuBack();
      else this.closeMenu();
    },

    menuBack() {
      if (!this.menu) return;
      this.menu.view = "main";
      this.$nextTick(this.clampMenu);
    },

    menuAction(action) {
      const row = this.menu && this.menu.row;

      if (action === "move") {
        this.menu.view = "move";
        this.menu.filter = "";
        this.$nextTick(() => {
          this.clampMenu();
          this.$refs.moveFilter?.focus();
        });
        return;
      }

      this.closeMenu();

      if (action === "new-doc") this.createDocument(row ? row.id : null);
      else if (action === "new-folder") this.createFolder(row ? row.id : null);
      else if (!row) return;
      else if (action === "rename") this.startRename(row);
      else if (action === "pin") this.$emit("command", { type: "pin", id: row.id });
      else if (action === "duplicate") this.$emit("command", { type: "duplicate", id: row.id });
      else if (action === "delete") this.$emit("command", { type: "delete", kind: row.type, id: row.id });
    },

    moveTo(opt) {
      const row = this.menu && this.menu.row;
      if (!row || !opt || opt.current) return;
      this.closeMenu();
      if (opt.id) this.expand(opt.id);
      this.$emit("command", row.type === "doc"
        ? { type: "move", event: "move-document", payload: { id: row.id, folderId: opt.id || null } }
        : { type: "move", event: "move-folder", payload: { id: row.id, parentId: opt.id || null } });
    },

    moveToFirst() {
      const first = this.moveTargets.find((opt) => !opt.current);
      if (first) this.moveTo(first);
    },

    /* ---------- 拖拽（Pointer 事件，规则见 focusTreeDnd.js） ---------- */
    onRowPointerDown(row, event) {
      if (event.button !== 0 || this.renaming) return;
      this.press = { row, x: event.clientX, y: event.clientY };
      window.addEventListener("pointermove", this.onDragMove, true);
      window.addEventListener("pointerup", this.onDragUp, true);
      window.addEventListener("pointercancel", this.endDrag, true);
      window.addEventListener("keydown", this.onDragKey, true);
    },

    onDragMove(event) {
      const p = this.press;
      if (!p) return;

      if (!this.dragging) {
        if (Math.hypot(event.clientX - p.x, event.clientY - p.y) < DRAG_THRESHOLD) return;
        if (this.query) {
          this.endDrag(); /* 搜索结果是过滤视图，位置关系不完整，不允许拖拽 */
          return;
        }
        this.dragging = true;
        this.dragItem = {
          key: p.row.key,
          type: p.row.type,
          id: p.row.id,
          parentId: p.row.parentId || null,
          name: this.label(p.row),
        };
        this._blocked = p.row.type === "folder" ? descendantFolderIds(this.folders, p.row.id) : new Set();
        document.body.classList.add("sb-dragging");
        window.getSelection?.()?.removeAllRanges();
        this.closeMenu();
      }

      event.preventDefault();
      this.pointer = { x: event.clientX, y: event.clientY };
      this.hitTest();
      this.autoScroll();
    },

    isValidDrop(row, zone) {
      const d = this.dragItem;
      if (!d || row.key === d.key) return false;
      if (d.type === "folder") {
        const parent = zone === "into" ? row.id : row.parentId;
        if (parent && this._blocked && this._blocked.has(parent)) return false;
      }
      return Boolean(buildMovePayload(d, { key: row.key, zone }, row));
    },

    hitTest() {
      const { x, y } = this.pointer;
      const tree = this.$refs.tree;
      const el = document.elementFromPoint(x, y);
      let drop = null;

      if (el && tree && tree.contains(el)) {
        if (el.closest("[data-sb-root]")) {
          if (buildMovePayload(this.dragItem, { key: ROOT, zone: "into" }, null)) {
            drop = { key: ROOT, zone: "into" };
          }
        } else {
          const rowEl = el.closest("[data-sb-key]");
          const row = rowEl && this.rowMap.get(rowEl.dataset.sbKey);
          if (row) {
            const rect = rowEl.getBoundingClientRect();
            const zone = resolveDropZone(this.dragItem.type, row.type, (y - rect.top) / rect.height);
            if (zone && this.isValidDrop(row, zone)) drop = { key: row.key, zone };
          }
        }
      }

      this.drop = drop;
      this.scheduleExpand(drop);
    },

    scheduleExpand(drop) {
      const row = drop && drop.zone === "into" ? this.rowMap.get(drop.key) : null;
      const key = row && row.type === "folder" && !row.expanded ? row.id : null;
      if (key === this._expandKey) return;
      clearTimeout(this._expandTimer);
      this._expandKey = key;
      if (!key) return;
      this._expandTimer = setTimeout(() => {
        this.expand(key);
        this._expandKey = null;
      }, EXPAND_DELAY);
    },

    autoScroll() {
      if (this._scrollRaf) return;
      const step = () => {
        this._scrollRaf = 0;
        if (!this.dragging) return;
        const tree = this.$refs.tree;
        if (!tree) return;
        const r = tree.getBoundingClientRect();
        const { y } = this.pointer;
        let dy = 0;
        if (y < r.top + SCROLL_EDGE) dy = -Math.min(16, Math.ceil((r.top + SCROLL_EDGE - y) / 3));
        else if (y > r.bottom - SCROLL_EDGE) dy = Math.min(16, Math.ceil((y - (r.bottom - SCROLL_EDGE)) / 3));
        if (!dy) return;
        tree.scrollTop += dy;
        this.hitTest();
        this._scrollRaf = requestAnimationFrame(step);
      };
      this._scrollRaf = requestAnimationFrame(step);
    },

    onDragUp() {
      const wasDragging = this.dragging;
      const drop = this.drop;
      const item = this.dragItem;
      this.endDrag();
      if (!wasDragging) return;

      this.suppressClick = true;
      setTimeout(() => {
        this.suppressClick = false;
      }, 0);

      if (!drop || !item) return;
      const row = drop.key === ROOT ? null : this.rowMap.get(drop.key);
      const move = buildMovePayload(item, drop, row);
      if (!move) return;
      if (drop.zone === "into" && row) this.expand(row.id);
      this.$emit("command", { type: "move", ...move });
    },

    onDragKey(event) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      const was = this.dragging;
      this.endDrag();
      if (was) {
        this.suppressClick = true;
        setTimeout(() => {
          this.suppressClick = false;
        }, 0);
      }
    },

    endDrag() {
      window.removeEventListener("pointermove", this.onDragMove, true);
      window.removeEventListener("pointerup", this.onDragUp, true);
      window.removeEventListener("pointercancel", this.endDrag, true);
      window.removeEventListener("keydown", this.onDragKey, true);
      clearTimeout(this._expandTimer);
      this._expandKey = null;
      if (this._scrollRaf) cancelAnimationFrame(this._scrollRaf);
      this._scrollRaf = 0;
      document.body.classList.remove("sb-dragging");
      this.press = null;
      this.dragging = false;
      this.dragItem = null;
      this.drop = null;
    },

    /* ---------- 宽度 ---------- */
    startResize(event) {
      if (event.button !== 0) return;
      event.preventDefault();
      this._resize = { x: event.clientX, w: this.$el.getBoundingClientRect().width };
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
.fdx-sidebar.sb {
  position: relative;
  display: flex;
  min-width: 0;
  flex-direction: column;
  border-right: 1px solid #eceef1;
  background: #f8f9fa;
  color: #3d434b;
  font-size: 13px;
}

.sb svg {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.sb svg.is-fill { fill: currentColor; stroke: none; }

/* 头部 */
.sb-head {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
  height: 38px;
  padding: 6px 8px 0 14px;
}

.sb-title {
  flex: 1;
  min-width: 0;
  color: #8a919b;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.sb-head-acts {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.12s ease;
}

.sb:hover .sb-head-acts,
.sb-head-acts:focus-within,
.sb.is-peek .sb-head-acts { opacity: 1; }

.sb-ib {
  display: grid;
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #7a818b;
  cursor: pointer;

  &:hover { background: #e6e9ed; color: #24282e; }

  svg { width: 14px; height: 14px; }

  &.sm { width: 22px; height: 22px; }
}

/* 搜索：平时像一行，聚焦才成为输入框 */
.sb-search {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 7px;
  height: 28px;
  margin: 4px 8px 6px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 7px;
  color: #9aa1aa;
  cursor: text;

  &:hover { background: #eef0f3; }

  &:focus-within {
    border-color: #d5dbe3;
    background: #fff;
  }

  > svg { width: 13px; height: 13px; flex: 0 0 13px; }

  input {
    min-width: 0;
    flex: 1;
    border: 0;
    background: transparent;
    color: #2f353d;
    font: inherit;
    font-size: 12.5px;
    outline: none;

    &::placeholder { color: #9aa1aa; }
  }

  kbd {
    color: #b3b9c1;
    font-family: inherit;
    font-size: 10.5px;
  }
}

.sb-search-x {
  padding: 0 2px;
  border: 0;
  background: transparent;
  color: #9aa1aa;
  font-size: 15px;
  line-height: 1;
  cursor: pointer;

  &:hover { color: #3d434b; }
}

/* 树 */
.sb-tree {
  position: relative;
  min-height: 0;
  flex: 1;
  padding: 2px 6px 28px;
  overflow-y: auto;
  outline: none;
}

.sb-row {
  position: relative;
  display: flex;
  height: 28px;
  align-items: center;
  gap: 4px;
  padding-right: 4px;
  padding-left: calc(4px + var(--depth, 0) * 16px);
  border-radius: 6px;
  color: #4a515b;
  cursor: pointer;
  user-select: none;

  &:hover { background: #eceef2; }

  &.is-folder { color: #30353c; font-weight: 500; }

  &.is-current {
    background: #e5e8ed;
    color: #1f2329;
    font-weight: 600;
  }

  &.is-drag-src { opacity: 0.4; }

  &.drop-into {
    background: #e8edff;
    box-shadow: inset 0 0 0 1.5px #4263eb;
  }

  &.drop-before::before,
  &.drop-after::after {
    position: absolute;
    z-index: 2;
    right: 6px;
    left: calc(26px + var(--depth, 0) * 16px);
    height: 2px;
    border-radius: 2px;
    background: #4263eb;
    content: "";
    pointer-events: none;
  }

  &.drop-before::before { top: -1px; }
  &.drop-after::after { bottom: -1px; }
}

.sb-tree:focus-visible .sb-row.is-focus { box-shadow: inset 0 0 0 1.5px #9db0f5; }

.sb-guide {
  position: absolute;
  top: 0;
  bottom: 0;
  left: calc(13px + var(--g) * 16px);
  width: 1px;
  background: #e2e5ea;
  opacity: 0;
  transition: opacity 0.12s ease;
  pointer-events: none;
}

.sb-tree:hover .sb-guide { opacity: 1; }

.sb-twisty {
  display: grid;
  width: 18px;
  height: 18px;
  flex: 0 0 18px;
  place-items: center;
  border-radius: 4px;
  color: #9aa1aa;

  svg { width: 12px; height: 12px; transition: transform 0.15s ease; }

  &.is-folder:hover { background: #dde1e7; color: #30353c; }
  &.is-collapsed svg { transform: rotate(-90deg); }
  &.is-empty svg { opacity: 0.4; }

  .sb-doc-ico { width: 13px; height: 13px; opacity: 0.55; }
}

.sb-name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &.is-untitled { color: #a3a9b1; font-weight: 400; }

  mark {
    padding: 0 1px;
    border-radius: 2px;
    background: #fff0b3;
    color: inherit;
  }
}

.sb-acts {
  display: none;
  flex: 0 0 auto;
  gap: 1px;
}

.sb-row:hover .sb-acts,
.sb-row.is-menu .sb-acts { display: flex; }

.sb-row.is-menu { background: #eceef2; }

.sb-rename {
  min-width: 0;
  height: 22px;
  flex: 1;
  padding: 0 6px;
  border: 1px solid #4263eb;
  border-radius: 5px;
  outline: none;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(66, 99, 235, 0.12);
  color: #1f2329;
  font: inherit;
  font-weight: 500;
}

.sb-root-drop {
  display: grid;
  height: 32px;
  margin: 8px 4px 0;
  place-items: center;
  border: 1px dashed #cfd5dd;
  border-radius: 7px;
  color: #8a919b;
  font-size: 12px;

  &.is-over {
    border-color: #4263eb;
    background: #eef2ff;
    color: #4263eb;
  }
}

.sb-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px 12px;
  color: #a3a9b1;
  font-size: 12px;
  text-align: center;

  button {
    padding: 4px 10px;
    border: 1px solid #dfe3e8;
    border-radius: 6px;
    background: #fff;
    color: #4a515b;
    font: inherit;
    cursor: pointer;

    &:hover { border-color: #a8b8f0; color: #4263eb; }
  }
}

.sb-resizer {
  position: absolute;
  z-index: 3;
  top: 0;
  right: -3px;
  bottom: 0;
  width: 6px;
  cursor: col-resize;

  &:hover { background: linear-gradient(90deg, transparent 2px, #4263eb 2px, #4263eb 4px, transparent 4px); }
}

/* 浮出态 */
.fdx-sidebar.sb.is-peek {
  border: 1px solid #e3e6ea;
  border-radius: 10px;
  background: #fbfbfc;
  box-shadow: 0 16px 48px rgba(24, 29, 38, 0.16), 0 2px 8px rgba(24, 29, 38, 0.06);
  animation: sb-peek-in 0.12s ease-out;

  .sb-resizer { display: none; }
}

@keyframes sb-peek-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* 菜单 */
.sb-menu {
  position: fixed;
  z-index: 60;
  min-width: 200px;
  max-width: 280px;
  padding: 5px;
  border: 1px solid rgba(31, 35, 41, 0.1);
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 16px 44px rgba(24, 29, 38, 0.16), 0 2px 8px rgba(24, 29, 38, 0.07);
  font-size: 12.5px;
  font-weight: 400;
}

.sb-mi {
  display: flex;
  width: 100%;
  height: 30px;
  align-items: center;
  gap: 8px;
  padding: 0 9px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #2f353d;
  font: inherit;
  text-align: left;
  cursor: pointer;

  > svg { width: 14px; height: 14px; flex: 0 0 14px; color: #7a818b; }

  kbd {
    margin-left: auto;
    color: #a3a9b1;
    font-family: inherit;
    font-size: 11px;
  }

  &:hover { background: #f1f3f6; }

  &.is-danger { color: #d64545; }
  &.is-danger > svg { color: #d64545; }
  &.is-danger:hover { background: #fdeeee; }

  &.is-current { color: #a3a9b1; cursor: default; }
  &.is-current:hover { background: transparent; }
}

.sb-mi-text {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sb-check { width: 14px; height: 14px; color: #4263eb; }

.sb-sep {
  height: 1px;
  margin: 4px 6px;
  background: #eef0f3;
}

.sb-mv-head {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 1px 2px 6px;
  color: #6b727c;
  font-size: 12px;

  span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
}

.sb-mv-filter {
  width: 100%;
  height: 28px;
  box-sizing: border-box;
  padding: 0 8px;
  border: 1px solid #e1e5ea;
  border-radius: 6px;
  outline: none;
  font: inherit;

  &:focus { border-color: #91a5e9; }
}

.sb-mv-list {
  max-height: 260px;
  margin-top: 4px;
  overflow-y: auto;
}

.sb-mv-empty {
  margin: 12px 0;
  color: #a3a9b1;
  font-size: 12px;
  text-align: center;
}

/* 跟手提示 */
.sb-ghost {
  position: fixed;
  z-index: 70;
  top: 0;
  left: 0;
  display: flex;
  max-width: 260px;
  flex-direction: column;
  gap: 2px;
  padding: 6px 10px;
  border-radius: 8px;
  background: #1f2329;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  color: #fff;
  font-size: 12px;
  pointer-events: none;

  strong { overflow: hidden; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
  small { color: #aab3bf; font-size: 11px; }
  &.is-invalid small { color: #f2a7a7; }
}

body.sb-dragging,
body.sb-dragging * {
  cursor: grabbing !important;
  user-select: none !important;
}

body.fdx-sb-resizing,
body.fdx-sb-resizing * {
  cursor: col-resize !important;
  user-select: none !important;
}

/* 深色 */
.dark-theme .fdx-sidebar.sb { border-color: #262d36; background: #12171d; color: #c4cad1; }
.dark-theme .fdx-sidebar.sb.is-peek { border-color: #2c333d; background: #161b22; }
.dark-theme .sb-ib:hover,
.dark-theme .sb-search:hover,
.dark-theme .sb-row:hover,
.dark-theme .sb-row.is-menu { background: #1f262f; color: #eef1f4; }
.dark-theme .sb-search:focus-within { border-color: #333a44; background: #1a2027; }
.dark-theme .sb-search input { color: #dfe3e8; }
.dark-theme .sb-row { color: #b6bdc6; }
.dark-theme .sb-row.is-folder { color: #d3d8de; }
.dark-theme .sb-row.is-current { background: #232a34; color: #f1f3f5; }
.dark-theme .sb-row.drop-into { background: #1e2740; box-shadow: inset 0 0 0 1.5px #6d86f0; }
.dark-theme .sb-guide { background: #2a313b; }
.dark-theme .sb-rename { background: #1a2027; color: #eef1f4; }
.dark-theme .sb-name mark { background: #5a4a12; }
.dark-theme .sb-menu { border-color: #39414c; background: #1d232b; }
.dark-theme .sb-mi { color: #d3d8de; }
.dark-theme .sb-mi:hover { background: #262e38; }
.dark-theme .sb-sep { background: #2c333d; }
.dark-theme .sb-mv-filter { border-color: #39414c; background: #161b22; color: #dfe3e8; }
.dark-theme .sb-root-drop { border-color: #3a424d; color: #7d8590; }
.dark-theme .sb-root-drop.is-over { border-color: #6d86f0; background: #1e2740; color: #a9bbff; }
</style>
