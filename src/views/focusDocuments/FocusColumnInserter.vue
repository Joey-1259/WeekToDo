<template>
  <Teleport to="body">
    <div
      class="focus-inserter-layer"
      role="presentation"
      @mousedown.self="$emit('close')"
    >
      <section
        ref="panel"
        class="focus-inserter"
        :style="panelStyle"
        role="dialog"
        aria-label="在此处添加分栏"
        @mousedown.stop
        @keydown.esc.stop.prevent="$emit('close')"
        @keydown.down.prevent="moveActive(1)"
        @keydown.up.prevent="moveActive(-1)"
        @keydown.enter.prevent="confirmActive"
      >
        <label class="focus-inserter-search">
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="8.5" cy="8.5" r="5.5" />
            <path d="m13 13 4 4" />
          </svg>
          <input
            ref="search"
            v-model="query"
            type="text"
            placeholder="搜索文档，或直接输入标题新建"
          />
        </label>

        <div v-if="!folderPanel" class="focus-inserter-list">
          <button
            type="button"
            class="focus-inserter-row is-create"
            :class="{ active: activeIndex === 0 }"
            @mouseenter="activeIndex = 0"
            @click="createDocument"
          >
            <span class="focus-inserter-icon is-accent">＋</span>
            <span class="focus-inserter-copy">
              <strong>
                {{
                  query
                    ? `新建文档「${query}」`
                    : "新建空白文档"
                }}
              </strong>
              <small>立即保存到 {{ folderLabel }}</small>
            </span>
            <kbd>↵</kbd>
          </button>

          <p v-if="rows.length" class="focus-inserter-hint">
            {{ query ? "匹配的文档" : "最近编辑" }}
          </p>

          <button
            v-for="(row, index) in rows"
            :key="row.id"
            type="button"
            class="focus-inserter-row"
            :class="{ active: activeIndex === index + 1 }"
            @mouseenter="activeIndex = index + 1"
            @click="$emit('pick', row.id)"
          >
            <span class="focus-inserter-icon">▤</span>
            <span class="focus-inserter-copy">
              <strong>{{ row.title || "未命名文档" }}</strong>
              <small>{{ row.path }}</small>
            </span>
          </button>

          <p
            v-if="query && !rows.length"
            class="focus-inserter-empty"
          >
            没有匹配的文档，回车即可新建。
          </p>
        </div>

        <div v-else class="focus-inserter-folder">
          <FocusFolderPicker
            ref="picker"
            v-model="localFolderId"
            :folders="folders"
            :current-folder-id="localFolderId"
          />
        </div>

        <footer>
          <button
            type="button"
            class="focus-inserter-folder-chip"
            :class="{ active: folderPanel }"
            :title="`新文档的存储位置：${folderLabel}`"
            @click="folderPanel = !folderPanel"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M3 5h5l1.5 2H17v8H3Z" />
            </svg>
            <span>{{ folderLabel }}</span>
          </button>

          <span class="focus-inserter-tip">
            <kbd>↑</kbd><kbd>↓</kbd> 选择 · <kbd>esc</kbd> 关闭
          </span>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<script>
import focusOwnership from "../../mixins/focusOwnership";
/* FOCUS_COLUMN_LAYOUT_20260909_V1 */
import FocusFolderPicker from "./FocusFolderPicker.vue";

/* HARDENING_20260911_V13 · 焦点守卫
   本组件 Teleport 到 body，一旦在 Bootstrap modal 打开期间被唤起，
   内部输入框会拿不到焦点。成因与修法见 mixin 注释。
   若根元素的 ref 不叫 panel 或 dialog，请覆写 focusOwnershipRoot。 */
export default {
  name: "FocusColumnInserter",

  mixins: [focusOwnership],

  components: { FocusFolderPicker },

  props: {
    anchor: { type: Object, required: true },
    documents: { type: Array, default: () => [] },
    folders: { type: Array, default: () => [] },
    folderPaths: { type: Object, default: () => ({}) },
    excludeIds: { type: Array, default: () => [] },
    defaultFolderId: { default: null },
  },

  emits: ["close", "pick", "create"],

  data() {
    return {
      query: "",
      activeIndex: 0,
      folderPanel: false,
      localFolderId: this.defaultFolderId || "__root__",
    };
  },

  computed: {
    panelStyle() {
      const width = 330;
      const height = 420;
      const gap = 10;

      const left = Math.max(
        12,
        Math.min(
          window.innerWidth - width - 12,
          (this.anchor.x || 0) - width / 2
        )
      );

      const openAbove =
        (this.anchor.y || 0) + height >
        window.innerHeight - 12;

      return {
        width: `${width}px`,
        left: `${left}px`,
        top: openAbove
          ? "auto"
          : `${(this.anchor.y || 0) + gap}px`,
        bottom: openAbove
          ? `${
              window.innerHeight -
              (this.anchor.top || this.anchor.y || 0) +
              gap
            }px`
          : "auto",
      };
    },

    folderLabel() {
      if (
        !this.localFolderId ||
        this.localFolderId === "__root__"
      ) {
        return "未分类";
      }

      return this.folderPaths[this.localFolderId] || "未分类";
    },

    rows() {
      const excluded = new Set(this.excludeIds);
      const query = this.query.trim().toLowerCase();

      const list = this.documents
        .filter((item) => !excluded.has(item.id))
        .filter((item) => {
          if (!query) return true;

          return [
            item.title,
            ...(item.tags || []),
            this.folderPaths[item.folderId] || "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(query);
        })
        .sort((a, b) =>
          String(b.updatedAt).localeCompare(String(a.updatedAt))
        )
        .slice(0, 40);

      return list.map((item) => ({
        id: item.id,
        title: item.title,
        path: item.folderId
          ? this.folderPaths[item.folderId] || "未分类"
          : "未分类",
      }));
    },
  },

  watch: {
    query() {
      this.activeIndex = 0;
    },
  },

  mounted() {
    this.$nextTick(() => this.$refs.search?.focus());
  },

  methods: {
    moveActive(step) {
      const max = this.rows.length;
      const next = this.activeIndex + step;

      this.activeIndex = Math.max(0, Math.min(max, next));
    },

    confirmActive() {
      if (this.activeIndex === 0) {
        this.createDocument();
        return;
      }

      const row = this.rows[this.activeIndex - 1];
      if (row) this.$emit("pick", row.id);
    },

    createDocument() {
      this.$emit("create", {
        title: this.query.trim(),
        folderId:
          this.localFolderId === "__root__"
            ? null
            : this.localFolderId,
      });
    },
  },
};
</script>

<style lang="scss">
.focus-inserter-layer {
  position: fixed;
  z-index: 20000;
  inset: 0;
}

.focus-inserter {
  position: fixed;
  display: flex;
  max-height: min(420px, calc(100vh - 40px));
  flex-direction: column;
  border: 1px solid rgba(31, 35, 41, 0.12);
  border-radius: 13px;
  outline: none;
  background: rgba(255, 255, 255, 0.985);
  box-shadow:
    0 20px 56px rgba(24, 29, 38, 0.18),
    0 3px 12px rgba(24, 29, 38, 0.08);
  overflow: hidden;
  backdrop-filter: blur(16px);
  animation: focus-inserter-in 0.13s ease-out;
}

@keyframes focus-inserter-in {
  from {
    opacity: 0;
    transform: translateY(-4px) scale(0.985);
  }
}

.focus-inserter-search {
  display: flex;
  min-height: 44px;
  align-items: center;
  gap: 8px;
  padding: 0 13px;
  border-bottom: 1px solid #eef0f3;
}

.focus-inserter-search svg {
  width: 15px;
  height: 15px;
  flex: 0 0 15px;
  fill: none;
  stroke: #a2a8b1;
  stroke-width: 1.6;
  stroke-linecap: round;
}

.focus-inserter-search input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: none;
  background: transparent;
  color: #2c313a;
  font-family: inherit;
  font-size: 13px;
}

.focus-inserter-list,
.focus-inserter-folder {
  min-height: 0;
  flex: 1;
  padding: 6px;
  overflow-y: auto;
}

.focus-inserter-folder {
  padding: 10px;
}

.focus-inserter-row {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 9px;
  padding: 7px 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #3f454e;
  text-align: left;
  cursor: pointer;
}

.focus-inserter-row.active {
  background: #eef2ff;
}

.focus-inserter-icon {
  display: grid;
  width: 26px;
  height: 26px;
  flex: 0 0 26px;
  place-items: center;
  border-radius: 7px;
  background: #f1f3f6;
  color: #8a919b;
  font-size: 13px;
}

.focus-inserter-icon.is-accent {
  background: #4263eb;
  color: #fff;
  font-weight: 600;
}

.focus-inserter-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 1px;
}

.focus-inserter-copy strong {
  overflow: hidden;
  color: #2f343c;
  font-size: 12.5px;
  font-weight: 560;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.focus-inserter-copy small {
  overflow: hidden;
  color: #9aa0a9;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.focus-inserter-row kbd,
.focus-inserter-tip kbd {
  padding: 1px 5px;
  border: 1px solid #dfe3e8;
  border-radius: 4px;
  background: #fff;
  color: #9097a1;
  font-family: inherit;
  font-size: 9px;
}

.focus-inserter-hint {
  margin: 9px 0 3px;
  padding: 0 9px;
  color: #a0a6af;
  font-size: 10px;
}

.focus-inserter-empty {
  margin: 14px 0;
  color: #a0a6af;
  font-size: 11px;
  text-align: center;
}

.focus-inserter > footer {
  display: flex;
  min-height: 40px;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 0 10px;
  border-top: 1px solid #eef0f3;
  background: #fafbfc;
}

.focus-inserter-folder-chip {
  display: flex;
  max-width: 62%;
  align-items: center;
  gap: 5px;
  padding: 4px 9px;
  border: 1px solid #e2e5ea;
  border-radius: 20px;
  background: #fff;
  color: #5c636d;
  font-family: inherit;
  font-size: 10.5px;
  cursor: pointer;
}

.focus-inserter-folder-chip.active {
  border-color: #a8b8f0;
  background: #eef2ff;
  color: #4263eb;
}

.focus-inserter-folder-chip svg {
  width: 13px;
  height: 13px;
  flex: 0 0 13px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linejoin: round;
}

.focus-inserter-folder-chip span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.focus-inserter-tip {
  display: flex;
  align-items: center;
  gap: 3px;
  color: #a5abb4;
  font-size: 10px;
}

.dark-theme .focus-inserter {
  border-color: #39414c;
  background: rgba(29, 35, 43, 0.985);
}

.dark-theme .focus-inserter-search {
  border-color: #333a44;
}

.dark-theme .focus-inserter-search input,
.dark-theme .focus-inserter-copy strong {
  color: #dfe4ea;
}

.dark-theme .focus-inserter-row.active {
  background: #28303c;
}

.dark-theme .focus-inserter-icon {
  background: #262d36;
  color: #99a1ac;
}

.dark-theme .focus-inserter > footer {
  border-color: #333a44;
  background: #181e25;
}

.dark-theme .focus-inserter-folder-chip {
  border-color: #3a424d;
  background: #20262e;
  color: #cdd3da;
}
</style>
