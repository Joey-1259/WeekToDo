<template>
  <article class="focus-pane">
    <header>
      <span class="focus-drag-handle" title="拖动调整位置">
        ⠿
      </span>

      <input
        v-model="localTitle"
        maxlength="120"
        placeholder="未命名文档"
        @input="scheduleTitleSave"
      />

      <div>
        <span>{{ statusLabel }}</span>

        <button
          title="沉浸式编辑"
          @click="$emit('edit', document.id)"
        >
          ⛶
        </button>

        <div class="focus-document-menu">
          <button
            ref="menuButton"
            title="文档操作"
            @click.stop="toggleDocumentMenu"
          >
            ⋯
          </button>

          <Teleport to="body">
            <div
              v-if="menuVisible"
              class="focus-document-menu-popover"
              :style="menuStyle"
              @mousedown.stop
            >
              <button @click="runAction('duplicate')">
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <rect x="6" y="6" width="10" height="10" rx="1.5" />
                  <path d="M4 13H3.5A1.5 1.5 0 0 1 2 11.5v-8A1.5 1.5 0 0 1 3.5 2h8A1.5 1.5 0 0 1 13 3.5V4" />
                </svg>
                <span>复制文档</span>
              </button>

              <button @click="runAction('move')">
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M3 5h5l1.5 2H17v8H3Z" />
                  <path d="m9 11 2-2 2 2M11 9v5" />
                </svg>
                <span>移动到目录</span>
              </button>

              <button @click="runAction('export')">
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M10 2v10M6 8l4 4 4-4M3 15v2h14v-2" />
                </svg>
                <span>导出 Markdown</span>
              </button>

              <div class="menu-divider"></div>

              <button
                class="danger"
                @click="runAction('delete')"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M5 6h10M8 6V4h4v2M6.5 6l.7 10h5.6l.7-10" />
                </svg>
                <span>删除文档</span>
              </button>
            </div>
          </Teleport>
        </div>
      </div>
    </header>

    <div class="focus-pane-tags">
      <span v-for="tag in document.tags" :key="tag">
        {{ tag }}
      </span>
      <span v-if="document.draft" class="draft">草稿</span>
    </div>

    <FocusDocumentEditor
      ref="editor"
      v-model="localContent"
      :document-id="document.id"
      @update:model-value="scheduleContentSave"
      @request-task="taskComposerVisible = true"
      @open-task="$emit('open-task', $event)"
    />

    <footer class="focus-pane-footer">
      <button
        type="button"
        class="focus-pane-swap"
        :disabled="!canSwapLeft"
        :aria-disabled="String(!canSwapLeft)"
        title="与左侧文档交换位置"
        @click="$emit('swap', -1)"
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M10 3.5 5.5 8 10 12.5" />
        </svg>
      </button>

      <button
        type="button"
        class="focus-pane-hint"
        title="聚焦编辑器"
        @click="focusEditor"
      >
        <span>输入</span>
        <kbd>/</kbd>
        <span>插入进阶内容</span>
      </button>

      <button
        type="button"
        class="focus-pane-swap"
        :disabled="!canSwapRight"
        :aria-disabled="String(!canSwapRight)"
        title="与右侧文档交换位置"
        @click="$emit('swap', 1)"
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M6 3.5 10.5 8 6 12.5" />
        </svg>
      </button>
    </footer>

    <FocusTaskComposer
      v-if="taskComposerVisible"
      :document-id="document.id"
      @close="taskComposerVisible = false"
      @created="insertTask"
    />
  </article>
</template>

<script>
import FocusDocumentEditor from "./FocusDocumentEditor.vue";
import FocusTaskComposer from "./FocusTaskComposer.vue";
import focusDocumentService from "../../services/focusDocumentService";

export default {
  name: "FocusDocumentPane",
  components: {
    FocusDocumentEditor,
    FocusTaskComposer,
  },
  props: {
    document: {
      type: Object,
      required: true,
    },
    canSwapLeft: {
      type: Boolean,
      default: true,
    },
    canSwapRight: {
      type: Boolean,
      default: true,
    },
  },
  emits: [
    "saved",
    "edit",
    "document-action",
    "open-task",
    "swap",
  ],
  data() {
    return {
      localTitle: this.document.title,
      localContent: this.document.content,
      timer: null,
      saveState: "saved",
      taskComposerVisible: false,
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
  },
  watch: {
    document: {
      deep: true,
      handler(value) {
        this.localTitle = value.title;
        this.localContent = value.content;
      },
    },
  },
  mounted() {
    document.addEventListener(
      "mousedown",
      this.closeDocumentMenu
    );
  },
  beforeUnmount() {
    clearTimeout(this.timer);
    document.removeEventListener(
      "mousedown",
      this.closeDocumentMenu
    );
  },
  methods: {
    focusEditor() {
      this.$el
        .querySelector(".ProseMirror")
        ?.focus();
    },

    closeDocumentMenu(event) {
      if (!event.target.closest(".focus-document-menu")) {
        this.menuVisible = false;
      }
    },

    toggleDocumentMenu() {
      if (this.menuVisible) {
        this.menuVisible = false;
        return;
      }

      const rect =
        this.$refs.menuButton?.getBoundingClientRect();

      if (!rect) return;

      const width = 176;
      const estimatedHeight = 174;
      const left = Math.max(
        10,
        Math.min(
          window.innerWidth - width - 10,
          rect.right - width
        )
      );

      const openAbove =
        rect.bottom + estimatedHeight >
        window.innerHeight - 10;

      this.menuStyle = {
        position: "fixed",
        width: `${width}px`,
        left: `${left}px`,
        top: openAbove
          ? "auto"
          : `${rect.bottom + 6}px`,
        bottom: openAbove
          ? `${window.innerHeight - rect.top + 6}px`
          : "auto",
      };

      this.menuVisible = true;
    },

    runAction(action) {
      this.menuVisible = false;
      this.$emit("document-action", {
        action,
        document: this.document,
      });
    },

    scheduleTitleSave() {
      this.scheduleSave({ title: this.localTitle });
    },

    scheduleContentSave() {
      this.scheduleSave({ content: this.localContent });
    },

    scheduleSave(patch) {
      this.saveState = "saving";
      clearTimeout(this.timer);

      this.timer = setTimeout(async () => {
        try {
          const saved =
            await focusDocumentService.updateDocument(
              this.document.id,
              patch
            );

          this.saveState = "saved";
          this.$emit("saved", saved);
        } catch (error) {
          console.error(error);
          this.saveState = "failed";
        }
      }, 800);
    },

    insertTask(attrs) {
      this.taskComposerVisible = false;
      this.$refs.editor?.insertLinkedTask(attrs);
    },
  },
};
</script>

<style scoped lang="scss">
.focus-pane {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  border: 1px solid #e1e5e9;
  border-radius: 11px;
  background: #fff;
  overflow: hidden;
}

.focus-pane.is-dragging {
  opacity: 0.52;
}

.focus-pane > header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 12px 7px;
}

.focus-drag-handle {
  color: #a1a7af;
  cursor: grab;
  user-select: none;
}

.focus-drag-handle:active {
  cursor: grabbing;
}

.focus-pane > header input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: none;
  background: transparent;
  color: #282c32;
  font-size: 16px;
  font-weight: 650;
}

.focus-pane > header > div {
  display: flex;
  align-items: center;
  gap: 3px;
}

.focus-pane > header span {
  color: #999fa8;
  font-size: 10px;
}

.focus-pane > header button {
  width: 29px;
  height: 29px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
}

.focus-pane > header button:hover {
  background: #eef1f5;
}

.focus-document-menu {
  position: relative;
}

.focus-document-menu-popover {
  position: fixed;
  z-index: 16000;
  width: 176px;
  padding: 5px;
  border: 1px solid #e0e4e8;
  border-radius: 9px;
  background: #fff;
  box-shadow: 0 12px 34px rgba(20, 25, 34, 0.18);
}

.focus-document-menu-popover button {
  display: flex;
  width: 100%;
  height: 34px;
  align-items: center;
  gap: 9px;
  padding: 0 9px;
  text-align: left;
}

.focus-document-menu-popover button:hover {
  background: #f0f2f5;
}

.focus-document-menu-popover button.danger {
  color: #d14343;
}

.menu-divider {
  height: 1px;
  margin: 4px 5px;
  background: #eceef1;
}

.focus-pane-tags {
  display: flex;
  min-height: 25px;
  flex-wrap: wrap;
  gap: 5px;
  padding: 0 12px 7px;
}

.focus-pane-tags span {
  padding: 3px 7px;
  border-radius: 10px;
  background: #eef1f6;
  color: #68707b;
  font-size: 10px;
}

.focus-pane-tags .draft {
  background: #fff3cd;
  color: #856404;
}

.dark-theme .focus-pane {
  border-color: #30363d;
  background: #161b22;
}

.dark-theme .focus-pane > header input {
  color: #e1e5ea;
}

.dark-theme .focus-pane-tags span {
  background: #252c35;
  color: #bcc2ca;
}

.dark-theme .focus-document-menu-popover {
  border-color: #38414b;
  background: #1d232b;
}

.dark-theme .focus-document-menu-popover button {
  color: #d8dde3;
}

.dark-theme .focus-document-menu-popover button:hover {
  background: #29313b;
}

.dark-theme .menu-divider {
  background: #343b45;
}

.focus-pane-footer {
  display: grid;
  min-height: 34px;
  grid-template-columns: 34px minmax(0, 1fr) 34px;
  align-items: center;
  border-top: 1px solid #eef0f2;
  color: #969ca5;
  font-size: 11px;
}

.focus-pane-footer > span {
  overflow: hidden;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.focus-pane-footer button {
  height: 28px;
  margin: 3px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #8d949e;
  font-size: 21px;
  cursor: pointer;
}

.focus-pane-footer button:hover {
  background: #eef1f5;
  color: #4263eb;
}

.focus-pane-footer kbd {
  padding: 1px 5px;
  border: 1px solid #dfe3e8;
  border-radius: 4px;
  background: transparent;
  font: inherit;
}

.dark-theme .focus-pane-footer {
  border-color: #30363d;
}

.dark-theme .focus-pane-footer button:hover {
  background: #252c35;
}

/*
 * 文档底部只保留一条 32px 的灰色功能栏。
 */
.focus-pane-footer {
  display: grid;
  min-height: 32px;
  grid-template-columns: 32px minmax(0, 1fr) 32px;
  align-items: center;
  border-top: 1px solid #eef0f2;
  background: #fafbfc;
  color: #969ca5;
}

.focus-pane-footer button {
  border: 0;
  background: transparent;
  font: inherit;
}

.focus-pane-swap {
  display: grid;
  width: 26px;
  height: 26px;
  margin: auto;
  place-items: center;
  padding: 0;
  border-radius: 6px;
  color: #8e959f;
  cursor: pointer;
}

.focus-pane-swap svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.focus-pane-swap:hover:not(:disabled) {
  background: #eceff3;
  color: #4263eb;
}

.focus-pane-swap:disabled {
  color: #d2d6db;
  cursor: default;
  opacity: 0.62;
}

.focus-pane-hint {
  display: flex;
  min-width: 0;
  height: 28px;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 0 8px;
  border-radius: 6px;
  color: #999fa7;
  font-size: 10px;
  cursor: text;
  overflow: hidden;
  white-space: nowrap;
}

.focus-pane-hint:hover {
  background: #f1f3f5;
  color: #737b86;
}

.focus-pane-hint kbd {
  display: inline-grid;
  min-width: 17px;
  height: 17px;
  place-items: center;
  padding: 0 4px;
  border: 1px solid #dfe3e8;
  border-radius: 4px;
  background: #fff;
  color: #777f89;
  font: inherit;
  line-height: 1;
}

.dark-theme .focus-pane-footer {
  border-color: #30363d;
  background: #181e25;
}

.dark-theme .focus-pane-swap:hover:not(:disabled),
.dark-theme .focus-pane-hint:hover {
  background: #252c35;
}

.dark-theme .focus-pane-hint kbd {
  border-color: #3a424d;
  background: #20262e;
}

.focus-document-menu > button {
  display: grid;
  place-items: center;
  color: #737b86;
  font-size: 0;
}

.focus-document-menu > button::before {
  content: "";
  width: 17px;
  height: 4px;
  background:
    radial-gradient(
      circle,
      currentColor 1.4px,
      transparent 1.6px
    )
    0 0 / 6px 4px;
}

.focus-document-menu-popover {
  width: 190px;
  padding: 6px;
  border-color: rgba(31, 35, 41, 0.12);
  border-radius: 10px;
  box-shadow:
    0 16px 42px rgba(20, 25, 34, 0.16),
    0 3px 10px rgba(20, 25, 34, 0.07);
}

.focus-document-menu-popover button {
  min-height: 36px;
  gap: 10px;
  padding: 0 10px;
  border-radius: 7px;
  color: #505863;
  font-size: 11px;
  font-weight: 450;
}

.focus-document-menu-popover svg {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.focus-document-menu-popover button.danger {
  color: #c84444;
}

.focus-document-menu-popover .menu-divider {
  margin: 4px 6px;
}
</style>
