<template>
  <div class="focus-modal-backdrop">
    <section class="focus-modal">
      <header>
        <div class="focus-modal-title">
          <input
            ref="title"
            v-model="draft.title"
            maxlength="120"
            placeholder="未命名文档"
            @input="scheduleSave"
            @keydown.enter.prevent="focusEditor"
          />

          <div class="focus-modal-tags">
            <span v-for="tag in draft.tags" :key="tag">
              {{ tag }}
              <button @click="removeTag(tag)">×</button>
            </span>
            <button @click="addTag">+ 标签</button>
          </div>
        </div>

        <div class="focus-modal-status">
          <span>{{ statusLabel }}</span>
          <button title="保存草稿并关闭" @click="close">×</button>
        </div>
      </header>

      <FocusDocumentEditor
        ref="editor"
        v-model="draft.content"
        :document-id="draft.id"
        spacious
        @update:model-value="scheduleSave"
        @request-task="openTaskComposer"
        @open-task="$emit('open-task', $event)"
        @jump-task="$emit('jump-task', $event)"
      />

      <footer>
        <label class="focus-document-location">
          <span>存储位置</span>
          <select v-model="selectedFolder">
            <option value="" disabled>请选择目录</option>
            <option value="__root__">未分类</option>
            <option
              v-for="folder in folders"
              :key="folder.id"
              :value="folder.id"
            >
              {{ folder.name }}
            </option>
          </select>
        </label>

        <div>
          <button @click="close">稍后继续</button>
          <button
            class="primary"
            :disabled="saving"
            @click="finish"
          >
            {{ saving ? "保存中…" : "完成并退出" }}
          </button>
        </div>
      </footer>
    </section>

    <FocusTaskComposer
      v-if="taskComposerVisible"
      :document-id="draft.id"
      @close="taskComposerVisible = false"
      @created="insertTask"
    />
  </div>
</template>

<script>
import FocusDocumentEditor from "./FocusDocumentEditor.vue";
import FocusTaskComposer from "./FocusTaskComposer.vue";
import focusDocumentService from "../../services/focusDocumentService";
import focusFolderService from "../../services/focusFolderService";

export default {
  name: "FocusDocumentModal",
  components: {
    FocusDocumentEditor,
    FocusTaskComposer,
  },
  props: {
    document: {
      type: Object,
      required: true,
    },
    requireFolder: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["close", "saved", "open-task", "jump-task",],
  data() {
    return {
      draft: JSON.parse(JSON.stringify(this.document)),
      timer: null,
      saving: false,
      saveState: "saved",
      taskComposerVisible: false,
      folders: focusFolderService.listFolders(),
      selectedFolder: this.requireFolder
        ? ""
        : this.document.folderId || "__root__",
    };
  },
  computed: {
    statusLabel() {
      if (this.saveState === "saving") return "保存中…";
      if (this.saveState === "failed") return "保存失败";
      return this.draft.draft ? "草稿已保存" : "已保存";
    },
  },
  mounted() {
    this.$refs.title?.focus();
    window.addEventListener("keydown", this.onKeydown);
  },
  beforeUnmount() {
    clearTimeout(this.timer);
    window.removeEventListener("keydown", this.onKeydown);
  },
  methods: {
    onKeydown(event) {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "s"
      ) {
        event.preventDefault();
        this.finish();
      }

      if (
        event.key === "Escape" &&
        !this.taskComposerVisible
      ) {
        this.close();
      }
    },

    focusEditor() {
      this.$refs.editor?.focus();
    },

    addTag() {
      const value = window.prompt("输入标签名称");
      const tag = String(value || "").trim().slice(0, 24);

      if (!tag || this.draft.tags.includes(tag)) return;

      if (this.draft.tags.length >= 8) {
        window.alert("每篇文档最多添加 8 个标签。");
        return;
      }

      this.draft.tags.push(tag);
      this.scheduleSave();
    },

    removeTag(tag) {
      this.draft.tags = this.draft.tags.filter(
        (item) => item !== tag
      );
      this.scheduleSave();
    },

    scheduleSave() {
      this.saveState = "saving";
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.persist(false), 800);
    },

    ensureFolderSelected() {
      if (this.selectedFolder) return true;

      window.alert("请先选择文档的存储目录。");
      return false;
    },

    async persist(final) {
      if (!this.ensureFolderSelected()) {
        throw new Error("DOCUMENT_FOLDER_REQUIRED");
      }

      clearTimeout(this.timer);
      this.saving = true;
      this.saveState = "saving";

      try {
        const saved =
          await focusDocumentService.saveDocument(
            {
              ...this.draft,
              title: this.draft.title.trim(),
              folderId:
                this.selectedFolder === "__root__"
                  ? null
                  : this.selectedFolder,
            },
            { final }
          );

        this.draft = saved;
        this.saveState = "saved";
        return saved;
      } catch (error) {
        console.error(error);
        this.saveState = "failed";
        throw error;
      } finally {
        this.saving = false;
      }
    },

    async openTaskComposer() {
      try {
        await this.persist(false);
        this.taskComposerVisible = true;
      } catch {
        window.alert("保存草稿失败，暂时无法创建关联事项。");
      }
    },

    insertTask(attrs) {
      this.taskComposerVisible = false;
      this.$refs.editor?.insertLinkedTask(attrs);
      this.scheduleSave();
    },

    async finish() {
      try {
        const saved = await this.persist(true);
        this.$emit("saved", saved);
      } catch (error) {
        if (error?.message !== "DOCUMENT_FOLDER_REQUIRED") {
          window.alert("文档保存失败，请重试。");
        }
      }
    },

    async close() {
      try {
        const saved = await this.persist(false);
        this.$emit("close", saved);
      } catch (error) {
        if (error?.message === "DOCUMENT_FOLDER_REQUIRED") {
          return;
        }

        if (window.confirm("保存失败，仍要关闭吗？")) {
          this.$emit("close", this.draft);
        }
      }
    },
  },
};
</script>

<style scoped lang="scss">
.focus-modal-backdrop {
  position: fixed;
  z-index: 10000;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 26px;
  background: rgba(18, 22, 28, 0.46);
  backdrop-filter: blur(5px);
}

.focus-modal {
  display: flex;
  width: min(1100px, 95vw);
  height: min(860px, 93vh);
  flex-direction: column;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 30px 90px rgba(14, 19, 28, 0.28);
  overflow: hidden;
}

.focus-modal > header {
  display: flex;
  align-items: flex-start;
  gap: 18px;
  padding: 24px 30px 12px;
}

.focus-modal-title {
  min-width: 0;
  flex: 1;
}

.focus-modal-title > input {
  width: 100%;
  border: 0;
  outline: none;
  background: transparent;
  color: #24272d;
  font-size: 29px;
  font-weight: 720;
  letter-spacing: -0.025em;
}

.focus-modal-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.focus-modal-tags > span,
.focus-modal-tags > button {
  padding: 4px 8px;
  border: 0;
  border-radius: 12px;
  background: #eff2f6;
  color: #6d747e;
  font-size: 11px;
}

.focus-modal-tags button {
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.focus-modal-status {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #9298a1;
  font-size: 11px;
}

.focus-modal-status button {
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  font-size: 23px;
  cursor: pointer;
}

.focus-modal > footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-top: 1px solid #eceef1;
  color: #959ba4;
  font-size: 11px;
}

.focus-modal > footer > div {
  display: flex;
  gap: 8px;
}

.focus-modal > footer button {
  padding: 8px 14px;
  border: 1px solid #dfe2e7;
  border-radius: 7px;
  background: #fff;
  cursor: pointer;
}

.focus-modal > footer button.primary {
  border-color: #4263eb;
  background: #4263eb;
  color: #fff;
}

.dark-theme .focus-modal {
  background: #161b22;
}

.dark-theme .focus-modal-title > input {
  color: #e2e6eb;
}

.dark-theme .focus-modal-tags > span,
.dark-theme .focus-modal-tags > button {
  background: #252c35;
  color: #bdc3cb;
}

.dark-theme .focus-modal > footer {
  border-color: #30363d;
}

.focus-document-location {
  display: flex;
  align-items: center;
  gap: 8px;
}

.focus-document-location > span {
  color: #8f969f;
  font-size: 11px;
}

.focus-document-location select {
  min-width: 150px;
  height: 32px;
  padding: 0 28px 0 9px;
  border: 1px solid #dfe2e7;
  border-radius: 7px;
  outline: none;
  background: #fff;
  color: #505761;
  font-size: 12px;
}

.focus-document-location select:focus {
  border-color: #4263eb;
}

.dark-theme .focus-document-location select {
  border-color: #38414b;
  background: #1d232b;
  color: #d7dce2;
}
</style>
