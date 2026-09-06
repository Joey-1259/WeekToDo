<template>
  <article class="focus-pane">
    <header>
      <input
        v-model="localTitle"
        maxlength="120"
        placeholder="未命名文档"
        @input="scheduleTitleSave"
      />

      <div>
        <span>{{ statusLabel }}</span>
        <button title="沉浸式编辑" @click="$emit('edit', document.id)">⛶</button>
        <button title="归档" @click="$emit('archive', document.id)">⋯</button>
      </div>
    </header>

    <div class="focus-pane-tags">
      <span v-for="tag in document.tags" :key="tag">{{ tag }}</span>
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
  },
  emits: ["saved", "edit", "archive", "open-task"],
  data() {
    return {
      localTitle: this.document.title,
      localContent: this.document.content,
      timer: null,
      saveState: "saved",
      taskComposerVisible: false,
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
  beforeUnmount() {
    clearTimeout(this.timer);
  },
  methods: {
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

.focus-pane > header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 12px 7px;
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
</style>
