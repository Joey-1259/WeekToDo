<template>
  <section
    class="focus-folder-picker"
    aria-label="选择目标目录"
  >
    <label class="focus-folder-picker-search">
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="8.5" cy="8.5" r="5.5" />
        <path d="m13 13 4 4" />
      </svg>

      <input
        ref="searchInput"
        v-model.trim="query"
        type="search"
        placeholder="搜索目录名称或路径"
        @keydown.down.prevent="focusFirstRow"
      />
    </label>

    <div
      ref="tree"
      class="focus-folder-picker-tree"
      role="tree"
      aria-label="目录树"
      @keydown="onTreeKeydown"
    >
      <button
        type="button"
        class="focus-folder-picker-row is-root"
        :class="{
          selected: modelValue === '__root__',
          current: normalizedCurrentId === '__root__',
        }"
        role="treeitem"
        aria-level="1"
        :aria-selected="String(modelValue === '__root__')"
        data-folder-row
        data-folder-id="__root__"
        @click="selectFolder('__root__')"
      >
        <span class="focus-folder-picker-spacer"></span>

        <svg
          class="focus-folder-picker-icon"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path d="M3 5h5l1.5 2H17v8H3Z" />
        </svg>

        <span class="focus-folder-picker-copy">
          <strong>未分类</strong>
          <small>不属于任何目录</small>
        </span>

        <em v-if="normalizedCurrentId === '__root__'">
          当前
        </em>

        <svg
          v-if="modelValue === '__root__'"
          class="focus-folder-picker-check"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path d="m5 10 3 3 7-7" />
        </svg>
      </button>

      <template v-if="visibleRows.length">
        <div
          v-for="entry in visibleRows"
          :key="entry.folder.id"
          class="focus-folder-picker-entry"
          :style="{ '--tree-depth': entry.depth }"
        >
          <button
            type="button"
            class="focus-folder-picker-toggle"
            :class="{
              hidden: !entry.hasChildren,
              expanded: entry.expanded,
            }"
            :title="
              entry.expanded ? '折叠目录' : '展开目录'
            "
            :aria-label="
              entry.expanded ? '折叠目录' : '展开目录'
            "
            :tabindex="entry.hasChildren ? 0 : -1"
            @click.stop="toggleFolder(entry.folder.id)"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="m7.5 5 5 5-5 5" />
            </svg>
          </button>

          <button
            type="button"
            class="focus-folder-picker-row"
            :class="{
              selected:
                modelValue === entry.folder.id,
              current:
                normalizedCurrentId === entry.folder.id,
            }"
            role="treeitem"
            :aria-level="entry.depth + 1"
            :aria-selected="
              String(modelValue === entry.folder.id)
            "
            :aria-expanded="
              entry.hasChildren
                ? String(entry.expanded)
                : undefined
            "
            data-folder-row
            :data-folder-id="entry.folder.id"
            @click="selectFolder(entry.folder.id)"
            @dblclick="toggleFolder(entry.folder.id)"
          >
            <svg
              class="focus-folder-picker-icon"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path d="M3 5h5l1.5 2H17v8H3Z" />
            </svg>

            <span class="focus-folder-picker-copy">
              <strong>{{ entry.folder.name }}</strong>
              <small>{{ entry.parentPath }}</small>
            </span>

            <em
              v-if="
                normalizedCurrentId === entry.folder.id
              "
            >
              当前
            </em>

            <svg
              v-if="modelValue === entry.folder.id"
              class="focus-folder-picker-check"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path d="m5 10 3 3 7-7" />
            </svg>
          </button>
        </div>
      </template>

      <div v-else class="focus-folder-picker-empty">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 6h6l2 2h8v10H4Z" />
          <path d="m16.5 15.5 3 3M18 14a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />
        </svg>
        <strong>没有匹配的目录</strong>
        <small>可以换一个名称或路径搜索</small>
      </div>
    </div>

    <footer class="focus-folder-picker-path">
      <span>目标位置</span>

      <div>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M3 5h5l1.5 2H17v8H3Z" />
        </svg>
        <strong>{{ selectedPath }}</strong>
      </div>

      <small v-if="targetUnchanged">
        文档已在此位置
      </small>
    </footer>
  </section>
</template>

<script>
/* FOCUS_FOLDER_TREE_SYSTEM_20260907_V1 */

export default {
  name: "FocusFolderPicker",

  props: {
    folders: {
      type: Array,
      default: () => [],
    },

    modelValue: {
      type: String,
      default: "__root__",
    },

    currentFolderId: {
      default: null,
    },
  },

  emits: ["update:modelValue"],

  data() {
    return {
      query: "",
      collapsedIds: [],
    };
  },

  computed: {
    normalizedCurrentId() {
      return this.currentFolderId || "__root__";
    },

    targetUnchanged() {
      return this.modelValue === this.normalizedCurrentId;
    },

    folderMap() {
      return new Map(
        this.folders.map((folder) => [
          folder.id,
          folder,
        ])
      );
    },

    selectedPath() {
      if (
        !this.modelValue ||
        this.modelValue === "__root__"
      ) {
        return "未分类";
      }

      return this.folderPath(this.modelValue);
    },

    visibleRows() {
      const grouped = new Map();

      this.folders.forEach((folder) => {
        const key = folder.parentId || "__root__";
        const children = grouped.get(key) || [];
        children.push(folder);
        grouped.set(key, children);
      });

      grouped.forEach((children) => {
        children.sort((a, b) => {
          if (a.order !== b.order) {
            return a.order - b.order;
          }

          return a.name.localeCompare(
            b.name,
            "zh-CN"
          );
        });
      });

      const query = this.query.toLowerCase();
      const matchingIds = new Set();

      if (query) {
        this.folders.forEach((folder) => {
          const searchable = [
            folder.name,
            this.folderPath(folder.id),
          ]
            .join(" ")
            .toLowerCase();

          if (!searchable.includes(query)) return;

          let cursor = folder;

          while (cursor) {
            matchingIds.add(cursor.id);
            cursor = cursor.parentId
              ? this.folderMap.get(cursor.parentId)
              : null;
          }
        });
      }

      const result = [];
      const visited = new Set();

      const walk = (parentId, depth) => {
        const children =
          grouped.get(parentId || "__root__") || [];

        children.forEach((folder) => {
          if (visited.has(folder.id)) return;
          visited.add(folder.id);

          if (query && !matchingIds.has(folder.id)) {
            return;
          }

          const descendants =
            grouped.get(folder.id) || [];

          const expanded =
            query ||
            !this.collapsedIds.includes(folder.id);

          result.push({
            folder,
            depth,
            expanded,
            hasChildren: descendants.length > 0,
            parentPath: this.parentPath(folder),
          });

          if (expanded) {
            walk(folder.id, depth + 1);
          }
        });
      };

      walk(null, 0);
      return result;
    },
  },

  methods: {
    focus() {
      this.$nextTick(() => {
        this.$refs.searchInput?.focus();
      });
    },

    folderPath(folderId) {
      const names = [];
      const visited = new Set();
      let cursor = this.folderMap.get(folderId);

      while (cursor && !visited.has(cursor.id)) {
        visited.add(cursor.id);
        names.unshift(cursor.name);

        cursor = cursor.parentId
          ? this.folderMap.get(cursor.parentId)
          : null;
      }

      return names.length
        ? names.join(" / ")
        : "目录不存在";
    },

    parentPath(folder) {
      if (!folder.parentId) {
        return "根目录";
      }

      return this.folderPath(folder.parentId);
    },

    selectFolder(folderId) {
      this.$emit("update:modelValue", folderId);
    },

    toggleFolder(folderId) {
      const values = new Set(this.collapsedIds);

      if (values.has(folderId)) {
        values.delete(folderId);
      } else {
        values.add(folderId);
      }

      this.collapsedIds = [...values];
    },

    focusFirstRow() {
      this.$nextTick(() => {
        this.$el
          .querySelector("[data-folder-row]")
          ?.focus();
      });
    },

    onTreeKeydown(event) {
      const rows = Array.from(
        this.$el.querySelectorAll(
          "[data-folder-row]"
        )
      );

      const index = rows.indexOf(event.target);

      if (index < 0) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        rows[index + 1]?.focus();
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();

        if (index === 0) {
          this.$refs.searchInput?.focus();
        } else {
          rows[index - 1]?.focus();
        }

        return;
      }

      const folderId =
        event.target.dataset.folderId;

      if (
        !folderId ||
        folderId === "__root__"
      ) {
        return;
      }

      const hasChildren = this.folders.some(
        (folder) => folder.parentId === folderId
      );

      if (
        event.key === "ArrowRight" &&
        hasChildren &&
        this.collapsedIds.includes(folderId)
      ) {
        event.preventDefault();
        this.toggleFolder(folderId);
        return;
      }

      if (
        event.key === "ArrowLeft" &&
        hasChildren &&
        !this.collapsedIds.includes(folderId)
      ) {
        event.preventDefault();
        this.toggleFolder(folderId);
        return;
      }

      if (
        event.key === "Enter" ||
        event.key === " "
      ) {
        event.preventDefault();
        this.selectFolder(folderId);
      }
    },
  },
};
</script>

<style scoped lang="scss">
.focus-folder-picker {
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: 10px;
}

.focus-folder-picker-search {
  display: flex;
  height: 36px;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  padding: 0 11px;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  background: #f8f9fb;
}

.focus-folder-picker-search:focus-within {
  border-color: #8da3ec;
  box-shadow: 0 0 0 3px rgba(66, 99, 235, 0.09);
}

.focus-folder-picker-search svg {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  fill: none;
  stroke: #8d949e;
  stroke-width: 1.5;
  stroke-linecap: round;
}

.focus-folder-picker-search input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: none;
  background: transparent;
  color: #343a42;
  font-family: inherit;
  font-size: 12px;
}

.focus-folder-picker-tree {
  min-height: 220px;
  max-height: min(350px, 44vh);
  padding: 6px;
  border: 1px solid #e5e8ec;
  border-radius: 9px;
  outline: none;
  background: #fff;
  overflow-y: auto;
  scrollbar-gutter: stable;
  overscroll-behavior: contain;
}

.focus-folder-picker-entry {
  position: relative;
  display: flex;
  align-items: center;
  padding-left: calc(var(--tree-depth, 0) * 18px);
}

.focus-folder-picker-toggle,
.focus-folder-picker-spacer {
  width: 24px;
  height: 36px;
  flex: 0 0 24px;
}

.focus-folder-picker-toggle {
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #8d949e;
  cursor: pointer;
}

.focus-folder-picker-toggle:hover {
  background: #edf0f4;
  color: #4f5965;
}

.focus-folder-picker-toggle.hidden {
  pointer-events: none;
  visibility: hidden;
}

.focus-folder-picker-toggle svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform 0.14s ease;
}

.focus-folder-picker-toggle.expanded svg {
  transform: rotate(90deg);
}

.focus-folder-picker-row {
  display: flex;
  min-width: 0;
  min-height: 38px;
  flex: 1;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  padding: 4px 9px;
  border: 1px solid transparent;
  border-radius: 7px;
  outline: none;
  background: transparent;
  color: #414750;
  text-align: left;
  cursor: pointer;
}

.focus-folder-picker-row.is-root {
  width: 100%;
  margin-bottom: 3px;
}

.focus-folder-picker-row:hover {
  background: #f3f5f7;
}

.focus-folder-picker-row:focus-visible {
  border-color: #9baded;
  box-shadow: 0 0 0 2px rgba(66, 99, 235, 0.1);
}

.focus-folder-picker-row.selected {
  border-color: #d5defd;
  background: #edf2ff;
  color: #3657cd;
}

.focus-folder-picker-icon {
  width: 18px;
  height: 18px;
  flex: 0 0 18px;
  fill: rgba(79, 99, 169, 0.08);
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.focus-folder-picker-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 1px;
}

.focus-folder-picker-copy strong,
.focus-folder-picker-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.focus-folder-picker-copy strong {
  font-size: 12px;
  font-weight: 550;
}

.focus-folder-picker-copy small {
  color: #9aa0a8;
  font-size: 9px;
  font-weight: 400;
}

.focus-folder-picker-row em {
  flex: 0 0 auto;
  padding: 2px 6px;
  border-radius: 999px;
  background: #eef0f3;
  color: #89919b;
  font-size: 9px;
  font-style: normal;
}

.focus-folder-picker-check {
  width: 17px;
  height: 17px;
  flex: 0 0 17px;
  fill: none;
  stroke: #4263eb;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.focus-folder-picker-empty {
  display: flex;
  min-height: 190px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #969da6;
  text-align: center;
}

.focus-folder-picker-empty svg {
  width: 31px;
  height: 31px;
  margin-bottom: 9px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.35;
}

.focus-folder-picker-empty strong {
  color: #626a75;
  font-size: 12px;
  font-weight: 550;
}

.focus-folder-picker-empty small {
  margin-top: 4px;
  font-size: 10px;
}

.focus-folder-picker-path {
  display: grid;
  min-height: 53px;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  padding: 0 11px;
  border: 1px solid #e7e9ed;
  border-radius: 8px;
  background: #fafbfc;
}

.focus-folder-picker-path > span {
  color: #969ca5;
  font-size: 10px;
}

.focus-folder-picker-path > div {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 7px;
}

.focus-folder-picker-path svg {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  fill: none;
  stroke: #69727e;
  stroke-width: 1.5;
}

.focus-folder-picker-path strong {
  overflow: hidden;
  color: #4c535d;
  font-size: 11px;
  font-weight: 550;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.focus-folder-picker-path small {
  color: #a17b19;
  font-size: 9px;
}

.dark-theme .focus-folder-picker-search,
.dark-theme .focus-folder-picker-tree,
.dark-theme .focus-folder-picker-path {
  border-color: #38414b;
  background: #20262e;
}

.dark-theme .focus-folder-picker-search input,
.dark-theme .focus-folder-picker-row {
  color: #dce1e7;
}

.dark-theme .focus-folder-picker-row:hover {
  background: #29313b;
}

.dark-theme .focus-folder-picker-row.selected {
  border-color: #425487;
  background: #27304a;
  color: #9aafff;
}

.dark-theme .focus-folder-picker-toggle:hover,
.dark-theme .focus-folder-picker-row em {
  background: #303844;
}

.dark-theme .focus-folder-picker-copy small,
.dark-theme .focus-folder-picker-path > span {
  color: #9098a3;
}

.dark-theme .focus-folder-picker-path strong {
  color: #d0d5dc;
}
</style>
