<template>
  <div
    class="focus-dialog-backdrop"
    role="presentation"
    @mousedown.self="close"
  >
    <section
      class="focus-dialog"
      role="dialog"
      aria-modal="true"
      aria-label="文档编辑"
    >
      <header>
        <div class="focus-dialog-heading">
          <FocusDocumentTitle
            ref="title"
            v-model="draft.title"
            :styles="draft.titleStyle"
            variant="dialog"
            @update:model-value="scheduleSave"
            @update:styles="onTitleStyle"
            @submit="focusEditor"
          />

          <div class="focus-dialog-tags">
            <span v-for="tag in draft.tags" :key="tag">
              {{ tag }}
              <button
                type="button"
                :aria-label="`移除标签 ${tag}`"
                @click="removeTag(tag)"
              >
                ×
              </button>
            </span>

            <input
              v-if="tagEditing"
              ref="tagInput"
              v-model="tagInput"
              class="focus-tag-input"
              maxlength="24"
              aria-label="标签名称"
              placeholder="输入标签"
              @keydown.enter.prevent="confirmTag"
              @keydown.esc.stop.prevent="cancelTag"
              @blur="confirmTag"
            />
            <button v-else type="button" @click="addTag">
              + 标签
            </button>
          </div>
        </div>

        <div class="focus-dialog-status">
          <span :class="`is-${saveState}`">{{ statusLabel }}</span>
          <button
            type="button"
            title="关闭（内容已自动保存）"
            aria-label="关闭"
            @click="close"
          >
            ×
          </button>
        </div>
      </header>

      <FocusDocumentEditor
        ref="editor"
        v-model="draft.content"
        :document-id="draft.id"
        spacious
        @update:model-value="scheduleSave"
        @request-task="requestTask"
        @open-task="$emit('open-task', $event)"
        @jump-task="$emit('jump-task', $event)"
      />

      <footer>
        <div class="focus-dialog-location">
          <span>存储位置</span>

          <button
            ref="folderButton"
            type="button"
            class="focus-dialog-folder"
            :class="{ active: folderPanel }"
            @click.stop="folderPanel = !folderPanel"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M3 5h5l1.5 2H17v8H3Z" />
            </svg>
            <span>{{ folderLabel }}</span>
            <i aria-hidden="true">▾</i>
          </button>

          <Teleport to="body">
            <div
              v-if="folderPanel"
              class="focus-dialog-folder-panel"
              :style="folderPanelStyle"
              @mousedown.stop
            >
              <FocusFolderPicker
                v-model="folderId"
                :folders="folders"
                :current-folder-id="draft.folderId"
              />

              <footer>
                <button type="button" @click="folderPanel = false">
                  取消
                </button>
                <button
                  type="button"
                  class="primary"
                  @click="applyFolder"
                >
                  移动到此处
                </button>
              </footer>
            </div>
          </Teleport>
        </div>

        <!-- FOCUS_UI_SYSTEM_20260911_V6
          原本一行塞了三条快捷键。提示位一次只教一件事，
          三条并列等于零条——用户不会在写作时停下来读一排 kbd。
          留最高频的 /，格式刷与 esc 交给工具栏悬停提示。 -->
        <span class="focus-dialog-hint">
          <kbd>/</kbd>
          <span>插入进阶内容</span>
        </span>
      </footer>
    </section>
  </div>
</template>

<script>
/* FOCUS_COLUMN_LAYOUT_20260909_V1 */
import FocusDocumentEditor from "./FocusDocumentEditor.vue";
import FocusDocumentTitle, {
  DEFAULT_TITLE_STYLE,
} from "./FocusDocumentTitle.vue";
import FocusFolderPicker from "./FocusFolderPicker.vue";
import focusDocumentService from "../../services/focusDocumentService";
import focusFolderService from "../../services/focusFolderService";

export default {
  name: "FocusDocumentDialog",

  components: {
    FocusDocumentEditor,
    FocusDocumentTitle,
    FocusFolderPicker,
  },

  props: {
    document: { type: Object, required: true },
    folderPaths: { type: Object, default: () => ({}) },
  },

  emits: [
    "close",
    "saved",
    "open-task",
    "jump-task",
    "create-task",
  ],

  data() {
    const draft = JSON.parse(JSON.stringify(this.document));

    draft.titleStyle = {
      ...DEFAULT_TITLE_STYLE,
      ...(draft.titleStyle || {}),
    };

    return {
      draft,
      folders: focusFolderService.listFolders(),
      folderId: this.document.folderId || "__root__",
      folderPanel: false,
      folderPanelStyle: {},
      saveState: "saved",
      dirty: false,
      timer: null,
      tagEditing: false,
      tagInput: "",
    };
  },

  computed: {
    statusLabel() {
      if (this.saveState === "saving") return "保存中…";
      if (this.saveState === "failed") return "保存失败";
      return "已自动保存";
    },

    folderLabel() {
      if (!this.draft.folderId) return "未分类";
      return this.folderPaths[this.draft.folderId] || "未分类";
    },
  },

  watch: {
    folderPanel(value) {
      if (!value) return;

      const rect =
        this.$refs.folderButton?.getBoundingClientRect();

      if (!rect) return;

      const width = 380;
      const height = 380;

      this.folderPanelStyle = {
        position: "fixed",
        width: `${width}px`,
        left: `${Math.max(
          12,
          Math.min(window.innerWidth - width - 12, rect.left)
        )}px`,
        bottom: `${window.innerHeight - rect.top + 8}px`,
        maxHeight: `${height}px`,
      };
    },
  },

  mounted() {
    this.$refs.title?.focus();
    window.addEventListener("keydown", this.onKeydown);
    document.addEventListener("mousedown", this.onPointerDown);
  },

  beforeUnmount() {
    window.removeEventListener("keydown", this.onKeydown);
    document.removeEventListener(
      "mousedown",
      this.onPointerDown
    );
    clearTimeout(this.timer);
  },

  methods: {
    onPointerDown(event) {
      if (
        event.target.closest(".focus-dialog-folder-panel") ||
        event.target.closest(".focus-dialog-folder")
      ) {
        return;
      }

      this.folderPanel = false;
    },

    onKeydown(event) {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "s"
      ) {
        event.preventDefault();
        this.flush();
        return;
      }

      if (event.key !== "Escape") return;

      if (this.tagEditing) {
        event.preventDefault();
        this.cancelTag();
        return;
      }

      if (this.folderPanel) {
        event.preventDefault();
        this.folderPanel = false;
        return;
      }

      this.close();
    },

    focusEditor() {
      this.$refs.editor?.focus();
    },

    onTitleStyle(styles) {
      this.draft.titleStyle = styles;
      this.scheduleSave();
    },

    addTag() {
      if (this.draft.tags.length >= 8) {
        window.alert("每篇文档最多添加 8 个标签。");
        return;
      }

      this.tagInput = "";
      this.tagEditing = true;

      this.$nextTick(() => this.$refs.tagInput?.focus());
    },

    confirmTag() {
      if (!this.tagEditing) return;

      const tag = String(this.tagInput || "")
        .trim()
        .slice(0, 24);

      this.tagEditing = false;
      this.tagInput = "";

      if (!tag || this.draft.tags.includes(tag)) return;

      this.draft.tags.push(tag);
      this.scheduleSave();
    },

    cancelTag() {
      this.tagEditing = false;
      this.tagInput = "";
    },

    removeTag(tag) {
      this.draft.tags = this.draft.tags.filter(
        (item) => item !== tag
      );
      this.scheduleSave();
    },

    scheduleSave() {
      this.dirty = true;
      this.saveState = "saving";

      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.persist(), 650);
    },

    flush() {
      if (!this.dirty) return Promise.resolve(this.draft);

      clearTimeout(this.timer);
      return this.persist();
    },

    async persist() {
      clearTimeout(this.timer);

      try {
        const saved =
          await focusDocumentService.updateDocument(
            this.draft.id,
            {
              title: this.draft.title,
              titleStyle: this.draft.titleStyle,
              tags: this.draft.tags,
              content: this.draft.content,
            }
          );

        this.draft = {
          ...saved,
          titleStyle: {
            ...DEFAULT_TITLE_STYLE,
            ...(saved.titleStyle || {}),
          },
        };

        this.dirty = false;
        this.saveState = "saved";
        this.$emit("saved", saved);

        return saved;
      } catch (error) {
        console.error(error);
        this.saveState = "failed";
        throw error;
      }
    },

    async applyFolder() {
      this.folderPanel = false;

      const target =
        this.folderId === "__root__" ? null : this.folderId;

      if (target === (this.draft.folderId || null)) return;

      try {
        const saved =
          await focusDocumentService.moveDocument(
            this.draft.id,
            target
          );

        this.draft.folderId = saved.folderId;
        this.$emit("saved", saved);
      } catch (error) {
        console.error(error);
        window.alert("移动文档失败，请重试。");
      }
    },

    async requestTask() {
      await this.flush();

      this.$emit("create-task", {
        documentId: this.draft.id,
        insert: (attrs) => {
          this.$refs.editor?.insertLinkedTask(attrs);
          this.scheduleSave();
        },
      });
    },

    async close() {
      try {
        await this.flush();
      } catch (error) {
        if (
          !window.confirm("内容保存失败，仍要关闭吗？")
        ) {
          return;
        }
      }

      this.$emit("close", this.draft);
    },
  },
};
</script>

<style scoped lang="scss">
.focus-dialog-backdrop {
  position: fixed;
  z-index: 19000;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 26px;
  background: rgba(18, 22, 28, 0.46);
  backdrop-filter: blur(5px);
}

.focus-dialog {
  display: flex;
  width: min(1100px, 95vw);
  height: min(860px, 93vh);
  flex-direction: column;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 30px 90px rgba(14, 19, 28, 0.28);
  overflow: hidden;
}

.focus-dialog > header {
  display: flex;
  align-items: flex-start;
  gap: 18px;
  padding: 22px 26px 12px;
}

.focus-dialog-heading {
  min-width: 0;
  flex: 1;
}

.focus-dialog-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.focus-dialog-tags > span,
.focus-dialog-tags > button,
.focus-tag-input {
  padding: 4px 8px;
  border: 0;
  border-radius: 12px;
  background: #eff2f6;
  color: #6d747e;
  font-family: inherit;
  font-size: 11px;
}

.focus-dialog-tags button {
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.focus-tag-input {
  width: 96px;
  outline: none;
}

.focus-dialog-status {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;
  color: #9298a1;
  font-size: 11px;
}

.focus-dialog-status .is-saving {
  color: #d99a17;
}

.focus-dialog-status .is-failed {
  color: #d64545;
}

.focus-dialog-status button {
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #767d87;
  font-size: 23px;
  cursor: pointer;
}

.focus-dialog-status button:hover {
  background: #eef1f5;
}

.focus-dialog > footer {
  display: flex;
  min-height: 48px;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 8px 18px;
  border-top: 1px solid #eceef1;
  background: #fafbfc;
}

.focus-dialog-location {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  color: #949aa3;
  font-size: 11px;
}

.focus-dialog-folder {
  display: flex;
  max-width: 340px;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border: 1px solid #e2e5ea;
  border-radius: 20px;
  background: #fff;
  color: #545b65;
  font-family: inherit;
  font-size: 11px;
  cursor: pointer;
}

.focus-dialog-folder.active,
.focus-dialog-folder:hover {
  border-color: #a8b8f0;
  background: #eef2ff;
  color: #4263eb;
}

.focus-dialog-folder svg {
  width: 13px;
  height: 13px;
  flex: 0 0 13px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linejoin: round;
}

.focus-dialog-folder span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.focus-dialog-folder i {
  font-style: normal;
  opacity: 0.6;
}

.focus-dialog-hint {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 3px;
  color: #a5abb4;
  font-size: 10px;
}

.focus-dialog-hint kbd {
  padding: 1px 5px;
  border: 1px solid #dfe2e7;
  border-radius: 4px;
  background: #fff;
  font-family: inherit;
  font-size: 9px;
}

.dark-theme .focus-dialog {
  background: #161b22;
}

.dark-theme .focus-dialog > footer {
  border-color: #262d36;
  background: #131920;
}

.dark-theme .focus-dialog-tags > span,
.dark-theme .focus-dialog-tags > button,
.dark-theme .focus-tag-input {
  background: #252c35;
  color: #b6bdc6;
}

.dark-theme .focus-dialog-folder {
  border-color: #3a424d;
  background: #20262e;
  color: #cdd3da;
}
</style>

<style lang="scss">
.focus-dialog-folder-panel {
  z-index: 21000;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(31, 35, 41, 0.12);
  border-radius: 12px;
  background: #fff;
  box-shadow:
    0 20px 56px rgba(24, 29, 38, 0.18),
    0 3px 12px rgba(24, 29, 38, 0.08);
  overflow: hidden;
}

.focus-dialog-folder-panel > footer {
  display: flex;
  justify-content: flex-end;
  gap: 7px;
  padding: 9px 11px;
  border-top: 1px solid #eef0f3;
  background: #fafbfc;
}

.focus-dialog-folder-panel > footer button {
  height: 30px;
  padding: 0 13px;
  border: 1px solid #dfe2e7;
  border-radius: 7px;
  background: #fff;
  color: #545b65;
  font-family: inherit;
  font-size: 11.5px;
  cursor: pointer;
}

.focus-dialog-folder-panel > footer button.primary {
  border-color: #4263eb;
  background: #4263eb;
  color: #fff;
}

.dark-theme .focus-dialog-folder-panel {
  border-color: #39414c;
  background: #1d232b;
}

.dark-theme .focus-dialog-folder-panel > footer {
  border-color: #333a44;
  background: #181e25;
}

.dark-theme .focus-dialog-folder-panel > footer button {
  border-color: #3a424d;
  background: #20262e;
  color: #d8dde3;
}

/* FOCUS_UI_SYSTEM_20260911_V6
   全屏态的提示钉在 footer 右下角，和分栏卡底部的提示同一套量值，
   两种形态之间切换时这条线不会跳。 */
.focus-dialog-hint {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  color: #aeb4bd;
  font-size: 10.5px;
}

.focus-dialog-hint kbd {
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

.dark-theme .focus-dialog-hint kbd {
  border-color: #39414c;
  background: #20262e;
  color: #9aa1ab;
}
</style>