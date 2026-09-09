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
          <strong id="dir-title">{{ isPick ? "移动到目录" : "文件目录" }}</strong>
          <small>{{ subtitle }}</small>
        </div>

        <label class="dir-search">
          <AppIcon name="search" />
          <input
            ref="search"
            v-model.trim="query"
            type="text"
            :placeholder="isPick ? '搜索目录' : '搜索目录与文档'"
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
        <!-- 根目录在选择模式下是一个真实可选项。
             "移出所有目录"是高频意图，不该只能靠拖到空白处完成。 -->
        <div
          v-if="isPick"
          class="dir-row is-folder is-root-row"
          :class="{ 'is-active': activeKey === '__root__' }"
          @click="activeKey = '__root__'"
          @dblclick="confirmPick"
        >
          <span class="dir-twisty-spacer"></span>
          <span class="dir-row-icon"><AppIcon name="folder" /></span>
          <span class="dir-row-name">未归档（不放入任何目录）</span>
        </div>

        <div
          v-for="row in visibleRows"
          :key="row.key"
          class="dir-row"
          :class="{
            'is-folder': row.type === 'folder',
            'is-doc': row.type === 'doc',
            'is-active': activeKey === row.key,
            'is-open-doc': row.type === 'doc' && openIds.includes(row.id),
            'is-self': isPick && row.type === 'doc',
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
          :draggable="canDrag && editingKey !== row.key"
          @click="activeKey = row.key"
          @dblclick="onRowActivate(row)"
          @dragstart="onDragStart(row, $event)"
          @dragend="resetDrop"
          @dragover.prevent.stop="onRowDragOver(row, $event)"
          @dragleave.stop="onRowDragLeave(row)"
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

          <span
            v-if="!isPick && row.type === 'doc' && openIds.includes(row.id)"
            class="dir-row-badge"
          >
            已并列
          </span>

          <span v-if="!isPick" class="dir-row-actions">
            <button
              v-if="row.type === 'folder'"
              type="button"
              class="dir-row-btn"
              v-tip="{ label: '在此新建子目录' }"
              @click.stop="beginCreate(row.id)"
            >
              <AppIcon name="plus" />
            </button>

            <!--
              五项操作用 ··· 收纳而不是平铺图标：
              超过 2~3 个之后，辨认一排陌生图标的成本高于多点一次。
              Notion / 语雀在同一位置的选择也是 ···。
            -->
            <button
              type="button"
              class="dir-row-btn"
              v-tip="{ label: '更多操作' }"
              @click.stop="openRowMenu(row, $event)"
            >
              <svg viewBox="0 0 20 20" class="dir-dots" aria-hidden="true">
                <circle cx="4.5" cy="10" r="1.4" />
                <circle cx="10" cy="10" r="1.4" />
                <circle cx="15.5" cy="10" r="1.4" />
              </svg>
            </button>
          </span>
        </div>

        <div
          v-if="creating"
          class="dir-row is-editing"
          :style="{ '--depth': createDepth }"
        >
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

        <span v-if="!isPick" class="dir-tips">
          <kbd>↑↓</kbd> 移动 · <kbd>→</kbd> 展开 · <kbd>F2</kbd> 重命名 ·
          <kbd>拖拽</kbd> 排序
        </span>

        <button
          v-if="isPick"
          type="button"
          class="dir-ghost"
          @click="$emit('close')"
        >
          取消
        </button>

        <button
          type="button"
          class="dir-primary"
          :disabled="isPick ? !pickChanged : !activeDoc"
          @click="isPick ? confirmPick() : openActiveDoc()"
        >
          {{ isPick ? pickLabel : "在新分栏打开" }}
        </button>
      </footer>
    </section>

    <Teleport to="body">
      <div
        v-if="rowMenu.row"
        class="dir-menu"
        :style="rowMenu.style"
        role="menu"
        @mousedown.stop
        @click.stop
      >
        <button type="button" role="menuitem" @click="menuRename">
          重命名<kbd>F2</kbd>
        </button>

        <template v-if="rowMenu.row.type === 'doc'">
          <button type="button" role="menuitem" @click="menuAction('move')">
            移动到目录…
          </button>
          <button type="button" role="menuitem" @click="menuAction('duplicate')">
            创建副本
          </button>
          <button type="button" role="menuitem" @click="menuAction('export')">
            导出 Markdown
          </button>
        </template>

        <template v-else>
          <button type="button" role="menuitem" @click="menuNewChild">
            新建子目录
          </button>
        </template>

        <div class="dir-menu-divider" role="separator"></div>

        <button type="button" role="menuitem" class="danger" @click="menuDelete">
          删除{{ rowMenu.row.type === "folder" ? "目录" : "文档" }}
        </button>
      </div>
    </Teleport>
  </div>
</template>

<script>
/* FOCUS_UI_SYSTEM_20260912_V8 */
import AppIcon from "../../components/ui/AppIcon.vue";
import { tip } from "../../directives/tooltip";

/**
 * 文件目录浏览器。一个组件，两种模式。
 *
 * 为什么合并：此前"顶部目录按钮"和"卡片左下角目录按钮"是两个独立实现，
 * 搜索、折叠、键盘、拖拽各写一遍。同一个心智对象有两个化身，用户每次
 * 都要重新学。现在 mode="manage" 与 mode="pick" 共用同一棵树，
 * 差异只在"能做什么"，不在"长什么样、怎么操作"。
 *
 * 本版修掉的关键缺陷：
 *   onRowDragLeave 原本调用 resetDrop()，而 resetDrop 会把 this.dragged
 *   一并置空。dragleave 在跨行移动时必然触发，于是拖拽刚开始就丢失了
 *   拖拽源，onRowDragOver 首行短路，落点永远算不出来 —— 表现为
 *   "能拖起来，但放哪儿都没反应"。目录和文档同样中招。
 *   现在拆成两个动作：dragleave 只清落点，dragend/drop 才清拖拽源。
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

    /** manage = 完整管理；pick = 只选目录，用于"移动到…" */
    mode: { type: String, default: "manage" },

    /** pick 模式下正在移动的文档，用于显示名称与判断是否有变化 */
    pickDocument: { type: Object, default: null },
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
    "document-action",
    "pick",
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
      rowMenu: { row: null, style: {} },
    };
  },

  computed: {
    isPick() {
      return this.mode === "pick";
    },

    canDrag() {
      return !this.isPick;
    },

    subtitle() {
      if (this.isPick) {
        return this.pickDocument?.title || "未命名文档";
      }

      return `${this.folders.length} 个目录 · ${this.documents.length} 篇文档`;
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

      if (this.isPick) return map;

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

    matchedKeys() {
      if (!this.query) return null;

      const needle = this.query.toLowerCase();
      const keep = new Set();

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
      return this.allRows.filter((row) => {
        if (this.matchedKeys && !this.matchedKeys.has(row.key)) return false;

        if (!this.matchedKeys) {
          let cursor = row.parentId;

          while (cursor) {
            if (this.collapsed.has(cursor)) return false;
            const parent = this.folders.find((f) => f.id === cursor);
            cursor = parent ? parent.parentId : null;
          }
        }

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

    /** pick 模式：当前选中的目标目录 id（null = 未归档） */
    pickTargetId() {
      if (this.activeKey === "__root__") return null;
      return this.activeRow && this.activeRow.type === "folder"
        ? this.activeRow.id
        : undefined;
    },

    pickChanged() {
      if (this.pickTargetId === undefined) return false;

      const current = this.pickDocument?.folderId || null;
      return this.pickTargetId !== current;
    },

    pickLabel() {
      if (this.pickTargetId === undefined) return "选择目标目录";
      if (this.pickTargetId === null) return "移出目录";

      const folder = this.folders.find((f) => f.id === this.pickTargetId);
      const name = folder?.name || "目录";

      return `移动到「${name.length > 8 ? name.slice(0, 8) + "…" : name}」`;
    },

    createDepth() {
      if (!this.createParentId) return 0;

      const row = this.allRows.find(
        (item) => item.key === "f:" + this.createParentId
      );

      return row ? row.depth + 1 : 0;
    },

    breadcrumb() {
      if (this.activeKey === "__root__") return "未归档";
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

    document.addEventListener("mousedown", this.closeRowMenu);
    window.addEventListener("resize", this.closeRowMenu);

    this.$nextTick(() => {
      this.$refs.dialog?.focus();

      if (this.isPick) {
        const current = this.pickDocument?.folderId;
        this.activeKey = current ? "f:" + current : "__root__";
      } else if (this.visibleRows.length) {
        this.activeKey = this.visibleRows[0].key;
      }
    });
  },

  beforeUnmount() {
    document.removeEventListener("mousedown", this.closeRowMenu);
    window.removeEventListener("resize", this.closeRowMenu);
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
      if (this.isPick) {
        if (row.type === "folder") this.confirmPick();
        return;
      }

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

    confirmPick() {
      if (!this.pickChanged) return;
      this.$emit("pick", this.pickTargetId);
    },

    /* ---------- 行菜单 ---------- */

    openRowMenu(row, event) {
      this.activeKey = row.key;

      const rect = event.currentTarget.getBoundingClientRect();
      const width = 178;
      const height = row.type === "doc" ? 214 : 130;

      const openAbove = rect.bottom + height > window.innerHeight - 12;

      this.rowMenu = {
        row,
        style: {
          position: "fixed",
          width: width + "px",
          left:
            Math.max(
              12,
              Math.min(window.innerWidth - width - 12, rect.right - width)
            ) + "px",
          top: openAbove ? "auto" : rect.bottom + 6 + "px",
          bottom: openAbove ? window.innerHeight - rect.top + 6 + "px" : "auto",
        },
      };
    },

    closeRowMenu(event) {
      if (event?.target?.closest?.(".dir-menu")) return;
      this.rowMenu = { row: null, style: {} };
    },

    menuRename() {
      const row = this.rowMenu.row;
      this.closeRowMenu();
      if (row) this.beginRename(row);
    },

    menuNewChild() {
      const row = this.rowMenu.row;
      this.closeRowMenu();
      if (row) this.beginCreate(row.id);
    },

    menuDelete() {
      const row = this.rowMenu.row;
      this.closeRowMenu();
      if (row) this.requestDelete(row);
    },

    /** 复制 / 导出 / 移动全部转发给宿主既有的 handleDocumentAction，
        不在目录里另起一套实现，避免两套导出逻辑各自演化。 */
    menuAction(action) {
      const row = this.rowMenu.row;
      this.closeRowMenu();
      if (row) this.$emit("document-action", { action, id: row.id });
    },

    /* ---------- 键盘流 ---------- */

    onDialogKeydown(event) {
      if (event.key === "Escape" && !this.editingKey && !this.creating) {
        event.preventDefault();

        if (this.rowMenu.row) {
          this.closeRowMenu();
          return;
        }

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
          if (this.isPick) this.confirmPick();
          else if (row) this.onRowActivate(row);
          break;

        case "F2":
          event.preventDefault();
          if (row && !this.isPick) this.beginRename(row);
          break;

        case "Backspace":
        case "Delete":
          if (this.isPick) return;
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
      if (!this.canDrag) return;

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

      if (
        this.dragged.type === "folder" &&
        this.isDescendant(row, this.dragged.id)
      ) {
        return;
      }

      event.dataTransfer.dropEffect = "move";

      let zone = this.zoneOf(event, event.currentTarget);

      if (zone === "into" && row.type === "doc") zone = "after";

      this.dropTarget = { key: row.key, zone };
    },

    /**
     * 只清落点高亮，绝不清 dragged。
     *
     * 这正是上一版拖拽完全失效的原因：这里原本调用 resetDrop()，
     * 而 dragleave 在跨行移动时必然触发，于是拖拽源在第一次移动
     * 时就被置空，之后所有 dragover 全部短路。
     */
    onRowDragLeave(row) {
      if (this.dropTarget.key === row.key) {
        this.dropTarget = { key: null, zone: null };
      }
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
        parentId: zone === "into" ? row.id : row.parentId || null,
        beforeId: zone === "before" ? row.id : null,
        afterId: zone === "after" ? row.id : null,
      });
    },

    onRootDragOver(event) {
      if (!this.dragged) return;

      event.dataTransfer.dropEffect = "move";
      this.dropTarget = { key: "__root__", zone: "into" };
    },

    onRootDrop() {
      const dragged = this.dragged;
      const zone = this.dropTarget.zone;

      this.resetDrop();

      if (!dragged || !zone) return;

      if (dragged.type === "doc") {
        this.$emit("move-document", { id: dragged.id, folderId: null });
      } else {
        this.$emit("move-folder", { id: dragged.id, parentId: null });
      }
    },

    /** 拖拽真正结束时才清拖拽源：dragend 与 drop。 */
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

/* 显式给高度。只写 max-height 时 flex 容器会收缩到内容高度，
   目录少的时候弹窗就是一条窄条 —— 那与它承担的管理职责不匹配。
   给一个稳定高度，它才读起来像"工作面板"而不是"提示框"。 */
.dir-dialog {
  display: flex;
  width: min(760px, 100%);
  height: min(680px, 100%);
  flex-direction: column;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 24px 68px rgba(18, 22, 30, 0.28);
  outline: none;
  overflow: hidden;
}

.dir-header {
  display: flex;
  flex: 0 0 auto;
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
  max-width: 190px;
  flex-direction: column;

  strong {
    color: #24282e;
    font-size: 14.5px;
    font-weight: 650;
  }

  small {
    overflow: hidden;
    color: #9aa0a9;
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
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
  min-height: 0;
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

  &.is-root-row {
    margin-bottom: 2px;
    border-bottom: 1px dashed #eceef1;
    border-radius: 7px 7px 0 0;
    color: #6d747e;
  }

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

  :deep(.app-icon) {
    width: 13px;
    height: 13px;
  }
}

.dir-dots {
  width: 14px;
  height: 14px;

  circle {
    fill: currentColor;
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
  flex: 0 0 auto;
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

.dir-ghost {
  padding: 6px 13px;
  border: 1px solid #dfe2e7;
  border-radius: 7px;
  background: #fff;
  color: #505761;
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;

  &:hover { background: #f2f4f7; }
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
  .dir-row.is-root-row { border-color: #2a323c; }
  .dir-rename { background: #161b22; color: #dfe3e8; }
  .dir-ghost { border-color: #3a424d; background: #20262e; color: #d8dde3; }
  .dir-primary:disabled { background: #333a44; color: #6d747e; }
}
</style>

<style lang="scss">
/* 行菜单走 Teleport，所以不能 scoped。 */
.dir-menu {
  z-index: 21050;
  padding: 5px;
  border: 1px solid rgba(31, 35, 41, 0.12);
  border-radius: 10px;
  background: #fff;
  box-shadow:
    0 16px 42px rgba(24, 29, 38, 0.16),
    0 2px 8px rgba(24, 29, 38, 0.07);
}

.dir-menu button {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  padding: 7px 10px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #464c55;
  font-family: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}

.dir-menu button:hover {
  background: #eef1f5;
}

.dir-menu button kbd {
  padding: 1px 5px;
  border-radius: 4px;
  background: #f0f2f5;
  color: #969ca5;
  font-family: inherit;
  font-size: 10px;
}

.dir-menu button.danger {
  color: #d64545;
}

.dir-menu button.danger:hover {
  background: #fdecec;
}

.dir-menu-divider {
  height: 1px;
  margin: 4px 6px;
  background: #eef0f3;
}

.dark-theme .dir-menu {
  border-color: #39414c;
  background: #1d232b;
}

.dark-theme .dir-menu button {
  color: #d3d8de;
}

.dark-theme .dir-menu button:hover {
  background: #28303a;
}

.dark-theme .dir-menu button kbd {
  background: #262e38;
  color: #868d96;
}

.dark-theme .dir-menu-divider {
  background: #333a44;
}
</style>
