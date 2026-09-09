<template>
  <article
    class="focus-column-card"
    :class="{ 'is-active': active, 'is-dragging': dragging }"
    @mousedown="$emit('activate')"
  >
    <header class="focus-column-head">
      <span
        class="focus-column-handle"
        title="拖动调整分栏位置"
        aria-label="拖动调整分栏位置"
        draggable="true"
        role="button"
        tabindex="0"
        @dragstart.stop="$emit('drag-start', $event)"
        @dragend.stop="$emit('drag-end', $event)"
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="5" cy="4" r="1" />
          <circle cx="11" cy="4" r="1" />
          <circle cx="5" cy="8" r="1" />
          <circle cx="11" cy="8" r="1" />
          <circle cx="5" cy="12" r="1" />
          <circle cx="11" cy="12" r="1" />
        </svg>
      </span>

      <FocusDocumentTitle
        ref="title"
        v-model="localTitle"
        :styles="localTitleStyle"
        variant="card"
        @update:model-value="scheduleSave"
        @update:styles="onTitleStyle"
      />

      <div class="focus-column-actions">
        <span
          class="focus-column-status"
          :class="`is-${saveState}`"
          role="status"
          aria-live="polite"
          :title="statusLabel"
        >
          <i aria-hidden="true"></i>
        </span>

        <button
          type="button"
          class="focus-column-action"
          title="沉浸式编辑"
          @click="$emit('expand')"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M7 3H4a1 1 0 0 0-1 1v3" />
            <path d="M13 3h3a1 1 0 0 1 1 1v3" />
            <path d="M7 17H4a1 1 0 0 1-1-1v-3" />
            <path d="M13 17h3a1 1 0 0 0 1-1v-3" />
          </svg>
        </button>

        <button
          ref="menuButton"
          type="button"
          class="focus-column-action"
          title="更多操作"
          aria-haspopup="menu"
          :aria-expanded="String(menuVisible)"
          @click.stop="toggleMenu"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="4.5" cy="10" r="1.35" />
            <circle cx="10" cy="10" r="1.35" />
            <circle cx="15.5" cy="10" r="1.35" />
          </svg>
        </button>

        <button
          type="button"
          class="focus-column-action is-close"
          title="关闭分栏（不删除文档）"
          @click="$emit('close')"
        >
          ×
        </button>
      </div>
    </header>

    <div v-if="document.tags?.length" class="focus-column-tags">
      <span v-for="tag in document.tags" :key="tag">{{ tag }}</span>
    </div>

    <FocusDocumentEditor
      ref="editor"
      v-model="localContent"
      :document-id="document.id"
      @update:model-value="scheduleSave"
      @request-task="requestTask"
      @open-task="$emit('open-task', $event)"
      @jump-task="$emit('jump-task', $event)"
    />

    <footer class="focus-column-foot">
      <button
        type="button"
        class="focus-column-folder"
        :title="`存储位置：${folderPath}（点击更改）`"
        @click="emitAction('move')"
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M3 5h5l1.5 2H17v8H3Z" />
        </svg>
        <span>{{ folderPath }}</span>
      </button>

      <!-- FOCUS_UI_SYSTEM_20260911_V6
        字数在个人文稿场景里不驱动任何决策，却占着底部最后一条
        视觉线。把这个位置让给 / 提示：斜杠命令是编辑器里最有价值
        的能力，而它零可发现性——不说，用户就永远不知道有这回事。 -->
      <button
        type="button"
        class="focus-column-hint"
        title="聚焦编辑器"
        @click="focusEditor"
      >
        <kbd>/</kbd>
        <span>插入进阶内容</span>
      </button>
    </footer>

    <Teleport to="body">
      <div
        v-if="menuVisible"
        ref="menu"
        class="focus-column-menu"
        :style="menuStyle"
        role="menu"
        tabindex="-1"
        @mousedown.stop
        @keydown.esc.stop="closeMenu"
      >
        <button
          type="button"
          role="menuitem"
          @click="emitAction('duplicate')"
        >
          复制文档
        </button>
        <button
          type="button"
          role="menuitem"
          @click="emitAction('move')"
        >
          移动到目录…
        </button>
        <button
          type="button"
          role="menuitem"
          @click="emitAction('export')"
        >
          导出 Markdown
        </button>

        <div class="menu-divider" role="separator"></div>

        <button
          type="button"
          role="menuitem"
          @click="closeMenu(); $emit('close')"
        >
          关闭此分栏
        </button>
        <button
          type="button"
          role="menuitem"
          class="danger"
          @click="emitAction('delete')"
        >
          删除文档
        </button>
      </div>
    </Teleport>
  </article>
</template>

<script>
/* FOCUS_COLUMN_LAYOUT_20260909_V1 */
import FocusDocumentEditor from "./FocusDocumentEditor.vue";
import FocusDocumentTitle, {
  DEFAULT_TITLE_STYLE,
} from "./FocusDocumentTitle.vue";
import focusDocumentService from "../../services/focusDocumentService";

function countWords(node) {
  if (!node) return 0;
  if (node.type === "text") return (node.text || "").length;

  return (node.content || []).reduce(
    (total, child) => total + countWords(child),
    0
  );
}

export default {
  name: "FocusColumnCard",

  components: { FocusDocumentEditor, FocusDocumentTitle },

  props: {
    document: { type: Object, required: true },
    folderPath: { type: String, default: "未分类" },
    active: { type: Boolean, default: false },
    dragging: { type: Boolean, default: false },
  },

  emits: [
    "saved",
    "action",
    "expand",
    "close",
    "activate",
    "open-task",
    "jump-task",
    "create-task",
    "drag-start",
    "drag-end",
  ],

  data() {
    return {
      localTitle: this.document.title,
      localTitleStyle: {
        ...DEFAULT_TITLE_STYLE,
        ...(this.document.titleStyle || {}),
      },
      localContent: this.document.content,
      saveState: "saved",
      dirty: false,
      timer: null,
      menuVisible: false,
      menuStyle: {},
    };
  },

  computed: {
    statusLabel() {
      if (this.saveState === "saving") return "保存中…";
      if (this.saveState === "failed") return "保存失败";
      return "已保存";
    },

    wordCount() {
      return countWords(this.localContent);
    },
  },

  watch: {
    "document.id"() {
      this.flush();
      this.syncFromProp();
    },

    "document.updatedAt"() {
      // 外部（目录、移动、复制）改动时才回填，避免打断输入。
      if (!this.dirty) this.syncFromProp();
    },
  },

  mounted() {
    document.addEventListener("mousedown", this.closeMenu);
    window.addEventListener("resize", this.closeMenu);
    window.addEventListener("blur", this.flush);
  },

  beforeUnmount() {
    document.removeEventListener("mousedown", this.closeMenu);
    window.removeEventListener("resize", this.closeMenu);
    window.removeEventListener("blur", this.flush);
    this.flush();
  },

  methods: {
    syncFromProp() {
      this.localTitle = this.document.title;
      this.localTitleStyle = {
        ...DEFAULT_TITLE_STYLE,
        ...(this.document.titleStyle || {}),
      };
      this.localContent = this.document.content;
      this.saveState = "saved";
      this.dirty = false;
    },

    focusTitle() {
      this.$refs.title?.focus();
    },

    /* FOCUS_UI_SYSTEM_20260911_V6：底部提示点一下就把光标放进正文，
       提示本身即入口，而不是一句只能读的说明。 */
    focusEditor() {
      this.$refs.editor?.focus();
    },

    onTitleStyle(styles) {
      this.localTitleStyle = styles;
      this.scheduleSave();
    },

    scheduleSave() {
      this.dirty = true;
      this.saveState = "saving";

      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.persist(), 650);
    },

    flush() {
      if (!this.dirty) return;

      clearTimeout(this.timer);
      this.persist();
    },

    async persist() {
      clearTimeout(this.timer);

      try {
        const saved =
          await focusDocumentService.updateDocument(
            this.document.id,
            {
              title: this.localTitle,
              titleStyle: this.localTitleStyle,
              content: this.localContent,
            }
          );

        this.dirty = false;
        this.saveState = "saved";
        this.$emit("saved", saved);
      } catch (error) {
        console.error(error);
        this.saveState = "failed";
      }
    },

    requestTask() {
      this.flush();

      this.$emit("create-task", {
        documentId: this.document.id,
        insert: (attrs) => {
          this.$refs.editor?.insertLinkedTask(attrs);
          this.scheduleSave();
        },
      });
    },

    toggleMenu() {
      if (this.menuVisible) {
        this.menuVisible = false;
        return;
      }

      const rect =
        this.$refs.menuButton?.getBoundingClientRect();

      if (rect) {
        const width = 190;
        const height = 218;

        const left = Math.max(
          12,
          Math.min(
            window.innerWidth - width - 12,
            rect.right - width
          )
        );

        const openAbove =
          rect.bottom + height > window.innerHeight - 12;

        this.menuStyle = {
          position: "fixed",
          width: `${width}px`,
          left: `${left}px`,
          top: openAbove ? "auto" : `${rect.bottom + 7}px`,
          bottom: openAbove
            ? `${window.innerHeight - rect.top + 7}px`
            : "auto",
        };
      }

      this.menuVisible = true;
    },

    closeMenu(event) {
      if (
        event?.target?.closest?.(".focus-column-menu") ||
        event?.target?.closest?.(".focus-column-action")
      ) {
        return;
      }

      this.menuVisible = false;
    },

    emitAction(action) {
      this.menuVisible = false;
      this.flush();

      this.$emit("action", {
        action,
        document: this.document,
      });
    },
  },
};
</script>

<style scoped lang="scss">
.focus-column-card {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  border: 1px solid #e6e9ed;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(24, 29, 38, 0.04);
  overflow: hidden;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    opacity 0.15s ease;
}

.focus-column-card.is-active {
  border-color: #c3cff5;
  box-shadow:
    0 0 0 3px rgba(66, 99, 235, 0.07),
    0 2px 6px rgba(24, 29, 38, 0.06);
}

.focus-column-card.is-dragging {
  opacity: 0.45;
}

.focus-column-head {
  display: flex;
  min-height: 46px;
  align-items: center;
  gap: 6px;
  padding: 6px 8px 6px 4px;
  border-bottom: 1px solid #f0f2f5;
}

.focus-column-handle {
  display: grid;
  width: 20px;
  height: 28px;
  flex: 0 0 20px;
  place-items: center;
  border-radius: 5px;
  color: #b6bbc3;
  cursor: grab;
}

.focus-column-handle:hover {
  background: #f1f3f6;
  color: #7d848e;
}

.focus-column-handle svg {
  width: 14px;
  height: 14px;
  fill: currentColor;
}

.focus-column-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 1px;
}

.focus-column-status {
  display: grid;
  width: 18px;
  height: 18px;
  place-items: center;
}

.focus-column-status i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #cfd4da;
  transition: background-color 0.2s ease;
}

.focus-column-status.is-saving i {
  background: #f0a52a;
}

.focus-column-status.is-failed i {
  background: #e03131;
}

.focus-column-action {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #868d97;
  font-size: 17px;
  cursor: pointer;
}

.focus-column-action:hover {
  background: #eef1f5;
  color: #4263eb;
}

.focus-column-action.is-close:hover {
  background: #fdecec;
  color: #d64545;
}

.focus-column-action svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.focus-column-action svg circle {
  fill: currentColor;
  stroke: none;
}

.focus-column-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 7px 12px 0;
}

.focus-column-tags span {
  padding: 2px 7px;
  border-radius: 10px;
  background: #f0f2f5;
  color: #767d87;
  font-size: 10px;
}

.focus-column-foot {
  display: flex;
  min-height: 34px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 10px;
  border-top: 1px solid #f0f2f5;
  background: #fcfcfd;
}

.focus-column-folder {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 5px;
  padding: 3px 7px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #8b929b;
  font-family: inherit;
  font-size: 10.5px;
  cursor: pointer;
}

.focus-column-folder:hover {
  background: #eef1f5;
  color: #4263eb;
}

.focus-column-folder svg {
  width: 12px;
  height: 12px;
  flex: 0 0 12px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linejoin: round;
}

.focus-column-folder span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.focus-column-meta {
  flex: 0 0 auto;
  color: #a5abb4;
  font-size: 10px;
}

.dark-theme .focus-column-card {
  border-color: #2f3742;
  background: #161b22;
}

.dark-theme .focus-column-head,
.dark-theme .focus-column-foot {
  border-color: #262d36;
}

.dark-theme .focus-column-foot {
  background: #131920;
}

.dark-theme .focus-column-action:hover,
.dark-theme .focus-column-handle:hover,
.dark-theme .focus-column-folder:hover {
  background: #252c35;
  color: #93a8f5;
}

.dark-theme .focus-column-tags span {
  background: #252c35;
  color: #a6adb7;
}
</style>

<style lang="scss">
.focus-column-menu {
  z-index: 21000;
  padding: 5px;
  border: 1px solid rgba(31, 35, 41, 0.12);
  border-radius: 10px;
  outline: none;
  background: #fff;
  box-shadow:
    0 16px 42px rgba(24, 29, 38, 0.16),
    0 2px 8px rgba(24, 29, 38, 0.07);
}

.focus-column-menu button {
  display: block;
  width: 100%;
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

.focus-column-menu button:hover {
  background: #eef1f5;
}

.focus-column-menu button.danger {
  color: #d64545;
}

.focus-column-menu button.danger:hover {
  background: #fdecec;
}

.focus-column-menu .menu-divider {
  height: 1px;
  margin: 4px 6px;
  background: #eef0f3;
}

.dark-theme .focus-column-menu {
  border-color: #39414c;
  background: #1d232b;
}

.dark-theme .focus-column-menu button {
  color: #d3d8de;
}

.dark-theme .focus-column-menu button:hover {
  background: #28303a;
}

.dark-theme .focus-column-menu .menu-divider {
  background: #333a44;
}

/* FOCUS_UI_SYSTEM_20260911_V6 */
.focus-column-meta {
  display: none;
}

.focus-column-hint {
  display: inline-flex;
  min-width: 0;
  height: 24px;
  flex: 0 0 auto;
  align-items: center;
  gap: 5px;
  padding: 0 7px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #aeb4bd;
  font-family: inherit;
  font-size: 10.5px;
  white-space: nowrap;
  cursor: text;
  transition: color 0.14s ease, background-color 0.14s ease;
}

.focus-column-hint:hover {
  background: #f1f3f6;
  color: #6d747e;
}

.focus-column-hint kbd {
  display: inline-grid;
  min-width: 16px;
  height: 16px;
  place-items: center;
  padding: 0 4px;
  border: 1px solid #e2e6ec;
  border-radius: 4px;
  background: #fff;
  color: #868d96;
  font-family: inherit;
  font-size: 10px;
  line-height: 1;
}

.dark-theme .focus-column-hint:hover {
  background: #252c35;
}

.dark-theme .focus-column-hint kbd {
  border-color: #39414c;
  background: #20262e;
  color: #9aa1ab;
}
</style>
