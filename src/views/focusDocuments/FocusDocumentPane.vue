<template>
  <article class="focus-pane">
    <header class="focus-pane-header">
      <span
        class="focus-drag-handle"
        title="拖动调整文档位置"
        aria-label="拖动调整文档位置"
        draggable="true"
        role="button"
        tabindex="0"
        @dragstart.stop="$emit('pane-dragstart', $event)"
        @dragend.stop="$emit('pane-dragend', $event)"
      >
        <svg viewBox="0 0 16 16">
          <circle cx="5" cy="4" r="1" />
          <circle cx="11" cy="4" r="1" />
          <circle cx="5" cy="8" r="1" />
          <circle cx="11" cy="8" r="1" />
          <circle cx="5" cy="12" r="1" />
          <circle cx="11" cy="12" r="1" />
        </svg>
      </span>

      <input
        v-model="localTitle"
        maxlength="120"
        aria-label="文档标题"
        placeholder="未命名文档"
        @input="scheduleTitleSave"
      />

      <div class="focus-pane-header-actions">
        <span
          class="focus-save-status"
          :class="`is-${saveState}`"
          role="status"
          aria-live="polite"
        >
          <i aria-hidden="true"></i>
          <span>{{ statusLabel }}</span>
        </span>

        <button
          type="button"
          class="focus-header-action"
          title="沉浸式编辑"
          aria-label="打开沉浸式编辑"
          @click="$emit('edit', document.id)"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M7 3H4a1 1 0 0 0-1 1v3" />
            <path d="M13 3h3a1 1 0 0 1 1 1v3" />
            <path d="M7 17H4a1 1 0 0 1-1-1v-3" />
            <path d="M13 17h3a1 1 0 0 0 1-1v-3" />
          </svg>
        </button>

        <div class="focus-document-menu">
          <button
            ref="menuButton"
            type="button"
            class="focus-header-action"
            title="更多文档操作"
            aria-label="更多文档操作"
            aria-haspopup="menu"
            :aria-expanded="String(menuVisible)"
            @click.stop="toggleDocumentMenu"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <circle cx="4.5" cy="10" r="1.35" />
              <circle cx="10" cy="10" r="1.35" />
              <circle cx="15.5" cy="10" r="1.35" />
            </svg>
          </button>

          <Teleport to="body">
            <div
              v-if="menuVisible"
              ref="documentMenu"
              class="focus-document-menu-popover"
              :style="menuStyle"
              role="menu"
              aria-label="文档操作"
              tabindex="-1"
              @mousedown.stop
              @keydown.esc.stop="closeDocumentMenuAndRestore"
            >
              <button
                type="button"
                role="menuitem"
                @click="runAction('duplicate')"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <rect x="6" y="6" width="10" height="10" rx="1.5" />
                  <path d="M4 13H3.5A1.5 1.5 0 0 1 2 11.5v-8A1.5 1.5 0 0 1 3.5 2h8A1.5 1.5 0 0 1 13 3.5V4" />
                </svg>
                <span>复制文档</span>
              </button>

              <button
                type="button"
                role="menuitem"
                @click="runAction('move')"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M3 5h5l1.5 2H17v8H3Z" />
                  <path d="m9 11 2-2 2 2M11 9v5" />
                </svg>
                <span>移动到目录</span>
              </button>

              <button
                type="button"
                role="menuitem"
                @click="runAction('export')"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M10 2v10M6 8l4 4 4-4M3 15v2h14v-2" />
                </svg>
                <span>导出 Markdown</span>
              </button>

              <div class="menu-divider" role="separator"></div>

              <button
                type="button"
                role="menuitem"
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
      @request-task="requestTask"
      @open-task="$emit('open-task', $event)"
      @jump-task="$emit('jump-task', $event)"
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
        class="focus-pane-manage"
        title="排列工作区文档"
        aria-label="打开工作区排列"
        @click="$emit('manage')"
      >
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
        >
          <path d="M3 4h7M3 8h10M3 12h5" />
          <path d="m11 2 2 2-2 2" />
        </svg>
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

  </article>
</template>

<script>
/* FOCUS_RICH_CONTENT_SYSTEM_20260907_V1 */
import FocusDocumentEditor from "./FocusDocumentEditor.vue";
import focusDocumentService from "../../services/focusDocumentService";

export default {
  name: "FocusDocumentPane",
  components: {
    FocusDocumentEditor,
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
    "jump-task",
    "create-task",
    "manage",
    "swap",
    "pane-dragstart",
    "pane-dragend",
  ],
  data() {
    return {
      localTitle: this.document.title,
      localContent: this.document.content,
      timer: null,
      pendingPatch: {},
      savePromise: null,
      saveState: "saved",
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
    window.addEventListener(
      "keydown",
      this.onDocumentMenuKeydown
    );
    window.addEventListener(
      "resize",
      this.closeDocumentMenu
    );
    window.addEventListener(
      "scroll",
      this.closeDocumentMenu,
      true
    );
  },
  beforeUnmount() {
    void this.flushSave();
    document.removeEventListener(
      "mousedown",
      this.closeDocumentMenu
    );
    window.removeEventListener(
      "keydown",
      this.onDocumentMenuKeydown
    );
    window.removeEventListener(
      "resize",
      this.closeDocumentMenu
    );
    window.removeEventListener(
      "scroll",
      this.closeDocumentMenu,
      true
    );
  },
  methods: {
    focusEditor() {
      this.$el
        .querySelector(".ProseMirror")
        ?.focus();
    },

    closeDocumentMenu(event) {
      if (
        event?.target?.closest?.(".focus-document-menu") ||
        event?.target?.closest?.(
          ".focus-document-menu-popover"
        )
      ) {
        return;
      }

      this.menuVisible = false;
    },

    closeDocumentMenuAndRestore() {
      this.menuVisible = false;

      this.$nextTick(() => {
        this.$refs.menuButton?.focus();
      });
    },

    onDocumentMenuKeydown(event) {
      if (event.key === "Escape" && this.menuVisible) {
        event.preventDefault();
        this.closeDocumentMenuAndRestore();
      }
    },

    positionDocumentMenu() {
      const rect =
        this.$refs.menuButton?.getBoundingClientRect();

      if (!rect) return;

      const width = 220;
      const estimatedHeight = 188;
      const viewportGap = 12;

      const left = Math.max(
        viewportGap,
        Math.min(
          window.innerWidth - width - viewportGap,
          rect.right - width
        )
      );

      const openAbove =
        rect.bottom + estimatedHeight >
        window.innerHeight - viewportGap;

      this.menuStyle = {
        position: "fixed",
        width: `${width}px`,
        left: `${left}px`,
        top: openAbove
          ? "auto"
          : `${rect.bottom + 7}px`,
        bottom: openAbove
          ? `${window.innerHeight - rect.top + 7}px`
          : "auto",
      };
    },

    toggleDocumentMenu() {
      if (this.menuVisible) {
        this.closeDocumentMenuAndRestore();
        return;
      }

      this.positionDocumentMenu();
      this.menuVisible = true;

      this.$nextTick(() => {
        this.$refs.documentMenu?.focus();
      });
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
      this.pendingPatch = {
        ...this.pendingPatch,
        ...patch,
      };

      this.saveState = "saving";
      clearTimeout(this.timer);

      this.timer = setTimeout(() => {
        this.timer = null;
        void this.persistPendingSave();
      }, 800);
    },

    async persistPendingSave() {
      if (this.savePromise) {
        await this.savePromise.catch(
          () => null
        );

        if (
          Object.keys(
            this.pendingPatch
          ).length
        ) {
          return this.persistPendingSave();
        }

        return null;
      }

      if (
        !Object.keys(
          this.pendingPatch
        ).length
      ) {
        return null;
      }

      const patch = {
        ...this.pendingPatch,
      };

      this.pendingPatch = {};
      this.saveState = "saving";

      this.savePromise =
        focusDocumentService.updateDocument(
          this.document.id,
          patch
        );

      try {
        const saved =
          await this.savePromise;

        this.saveState = "saved";
        this.$emit("saved", saved);

        return saved;
      } catch (error) {
        console.error(error);

        this.pendingPatch = {
          ...patch,
          ...this.pendingPatch,
        };

        this.saveState = "failed";
        return null;
      } finally {
        this.savePromise = null;
      }
    },

    async flushSave() {
      clearTimeout(this.timer);
      this.timer = null;

      if (this.savePromise) {
        await this.savePromise.catch(
          () => null
        );
      }

      if (
        Object.keys(
          this.pendingPatch
        ).length
      ) {
        return this.persistPendingSave();
      }

      return null;
    },

    requestTask() {
      this.$emit("create-task", {
        documentId: this.document.id,
        insert: (attrs) => {
          this.$refs.editor?.insertLinkedTask(attrs);
        },
      });
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

/* ==========================================================
 * 重点事项 · 单文档头部与操作菜单统一规范
 * ========================================================== */

.focus-pane > .focus-pane-header {
  display: grid;
  min-height: 52px;
  grid-template-columns: 22px minmax(0, 1fr) auto;
  align-items: center;
  gap: 7px;
  padding: 8px 10px 7px;
  border-bottom: 1px solid #f0f1f3;
  background: rgba(255, 255, 255, 0.96);
}

.focus-pane-header .focus-drag-handle {
  display: grid;
  width: 22px;
  height: 30px;
  place-items: center;
  border-radius: 6px;
  color: #a0a6ae;
}

.focus-pane-header .focus-drag-handle:hover {
  background: #f1f3f5;
  color: #727a85;
}

.focus-pane-header .focus-drag-handle svg {
  width: 14px;
  height: 14px;
  fill: currentColor;
}

.focus-pane > .focus-pane-header input {
  min-width: 0;
  width: 100%;
  height: 34px;
  padding: 0 5px;
  border: 1px solid transparent;
  border-radius: 7px;
  outline: none;
  background: transparent;
  color: #272c33;
  font-size: 15px;
  font-weight: 650;
  line-height: 34px;
  text-overflow: ellipsis;
}

.focus-pane > .focus-pane-header input:hover {
  background: #fafbfc;
}

.focus-pane > .focus-pane-header input:focus {
  border-color: rgba(66, 99, 235, 0.32);
  background: #fff;
  box-shadow: 0 0 0 3px rgba(66, 99, 235, 0.08);
}

.focus-pane-header-actions {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 3px;
}

.focus-save-status {
  display: inline-flex;
  height: 26px;
  align-items: center;
  gap: 5px;
  margin-right: 2px;
  padding: 0 7px;
  border-radius: 999px;
  color: #858c96;
  font-size: 10px;
  line-height: 1;
  white-space: nowrap;
}

.focus-save-status > i {
  width: 6px;
  height: 6px;
  flex: 0 0 6px;
  border-radius: 50%;
  background: #68a67d;
}

.focus-save-status.is-saving > i {
  background: #d39a3b;
  animation: focus-save-pulse 1s ease-in-out infinite;
}

.focus-save-status.is-failed {
  background: #fff1f1;
  color: #c84444;
}

.focus-save-status.is-failed > i {
  background: #d14343;
}

@keyframes focus-save-pulse {
  50% {
    opacity: 0.35;
  }
}

.focus-pane-header .focus-header-action {
  display: grid;
  width: 32px;
  height: 32px;
  min-width: 32px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 7px;
  outline: none;
  background: transparent;
  color: #6f7782;
  cursor: pointer;
  transition:
    background-color 0.14s ease,
    color 0.14s ease,
    box-shadow 0.14s ease;
}

.focus-pane-header .focus-header-action:hover,
.focus-pane-header .focus-header-action[aria-expanded="true"] {
  background: #eef1f5;
  color: #343a43;
}

.focus-pane-header .focus-header-action:focus-visible {
  box-shadow: 0 0 0 2px rgba(66, 99, 235, 0.28);
}

.focus-pane-header .focus-header-action svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.55;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.focus-document-menu-popover {
  box-sizing: border-box;
  z-index: 19000;
  width: 220px;
  padding: 6px;
  border: 1px solid rgba(31, 35, 41, 0.12);
  border-radius: 11px;
  outline: none;
  background: rgba(255, 255, 255, 0.985);
  box-shadow:
    0 18px 48px rgba(20, 25, 34, 0.16),
    0 3px 10px rgba(20, 25, 34, 0.07);
  backdrop-filter: blur(16px);
}

.focus-document-menu-popover button {
  display: flex;
  width: 100%;
  min-height: 38px;
  align-items: center;
  justify-content: flex-start;
  gap: 11px;
  margin: 0;
  padding: 0 10px;
  border: 0 !important;
  border-radius: 7px;
  outline: none;
  background: transparent !important;
  box-shadow: none !important;
  color: #4e5661;
  font-family: inherit;
  font-size: 12px;
  font-weight: 450;
  line-height: 1;
  text-align: left;
  cursor: pointer;
  appearance: none;
}

.focus-document-menu-popover button:hover,
.focus-document-menu-popover button:focus-visible {
  background: #f0f2f5 !important;
  color: #282d34;
}

.focus-document-menu-popover button:focus-visible {
  box-shadow:
    inset 0 0 0 2px rgba(66, 99, 235, 0.24) !important;
}

.focus-document-menu-popover button.danger {
  color: #c84444;
}

.focus-document-menu-popover button.danger:hover,
.focus-document-menu-popover button.danger:focus-visible {
  background: #fff0f0 !important;
  color: #b83232;
}

.focus-document-menu-popover svg {
  width: 17px;
  height: 17px;
  flex: 0 0 17px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.55;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.focus-document-menu-popover .menu-divider {
  height: 1px;
  margin: 5px 7px;
  background: #eceef1;
}

.focus-pane-tags:empty {
  display: none;
  min-height: 0;
  padding: 0;
}

.focus-pane-tags:not(:empty) {
  min-height: 31px;
  align-items: center;
  padding: 5px 12px 6px 39px;
  border-bottom: 1px solid #f4f5f6;
}

.focus-pane-tags span {
  padding: 3px 7px;
  border-radius: 999px;
  background: #f1f3f5;
  color: #737b86;
  font-size: 10px;
  line-height: 1.25;
}

.dark-theme .focus-pane > .focus-pane-header {
  border-color: #292f37;
  background: rgba(22, 27, 34, 0.96);
}

.dark-theme .focus-pane > .focus-pane-header input {
  color: #e1e5ea;
}

.dark-theme .focus-pane > .focus-pane-header input:hover,
.dark-theme .focus-pane > .focus-pane-header input:focus {
  background: #1d232b;
}

.dark-theme .focus-pane-header .focus-header-action:hover,
.dark-theme
  .focus-pane-header
  .focus-header-action[aria-expanded="true"] {
  background: #252c35;
  color: #e0e4e9;
}

.dark-theme .focus-save-status.is-failed {
  background: rgba(209, 67, 67, 0.14);
}

.dark-theme .focus-document-menu-popover {
  border-color: #38414b;
  background: rgba(29, 35, 43, 0.985);
}

.dark-theme .focus-document-menu-popover button {
  color: #d8dde3;
}

.dark-theme .focus-document-menu-popover button:hover,
.dark-theme .focus-document-menu-popover button:focus-visible {
  background: #29313b !important;
  color: #fff;
}

.dark-theme .focus-document-menu-popover button.danger {
  color: #ed7a7a;
}

.dark-theme .focus-document-menu-popover button.danger:hover {
  background: rgba(209, 67, 67, 0.14) !important;
}

.dark-theme .focus-document-menu-popover .menu-divider {
  background: #343b45;
}

@media (max-width: 1100px) {
  .focus-save-status {
    width: 22px;
    justify-content: center;
    padding: 0;
  }

  .focus-save-status > span {
    display: none;
  }
}

/* FOCUS_SYSTEM_FIX_20260907_V3: pane */
.focus-document-menu .focus-header-action svg {
  fill: currentColor;
  stroke: none;
}

.focus-drag-handle {
  flex: 0 0 22px;
  box-sizing: border-box;
  touch-action: none;
}

.focus-pane.is-dragging {
  opacity: 0.55;
  box-shadow: 0 8px 28px rgba(31, 35, 41, 0.12);
}

.focus-pane-header-actions,
.focus-save-status,
.focus-header-action,
.focus-document-menu {
  box-sizing: border-box;
  flex-shrink: 0;
}

.focus-pane-header-actions {
  min-height: 32px;
}

.focus-save-status {
  min-width: 70px;
  justify-content: center;
}

@media (max-width: 1100px) {
  .focus-save-status {
    min-width: 22px;
  }
}

/* FOCUS_WORKSPACE_MANAGER_TRIGGER_20260908_V3 */
.focus-pane-footer {
  grid-template-columns:
    32px minmax(0, 1fr) 32px 32px;
}

.focus-pane-manage {
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

.focus-pane-manage svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.45;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.focus-pane-manage:hover {
  background: #eceff3;
  color: #4263eb;
}

.focus-pane-manage:focus-visible {
  outline: none;
  box-shadow:
    0 0 0 2px
    rgba(66, 99, 235, 0.25);
}

.dark-theme .focus-pane-manage:hover {
  background: #252c35;
  color: #8fa5ee;
}

</style>
