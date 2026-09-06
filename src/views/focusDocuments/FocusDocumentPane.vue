<template>
  <section class="focus-document-pane">
    <div class="document-pane-header">
      <input
        v-model="localTitle"
        class="document-title-input"
        maxlength="120"
        placeholder="文档标题"
        @blur="saveTitle"
        @keydown.enter.prevent="$event.target.blur()"
      />

      <div class="document-actions">
        <button
          type="button"
          title="归档文档"
          @click="$emit('archive', documentData.id)"
        >
          <i class="bi-archive"></i>
        </button>
      </div>
    </div>

    <div class="document-tag-row">
      <button
        v-for="tag in documentTags"
        :key="tag.id"
        type="button"
        class="document-tag"
        :data-color="tag.color"
        :title="`移除标签：${tag.name}`"
        @click="$emit('removeTag', tag.id)"
      >
        {{ tag.name }}
        <i class="bi-x"></i>
      </button>

      <select
        class="tag-add-select"
        :value="''"
        @change="addTag"
      >
        <option value="">＋ 标签</option>

        <option
          v-for="tag in availableTags"
          :key="tag.id"
          :value="tag.id"
        >
          {{ tag.name }}
        </option>

        <option value="__new__">
          ＋ 新建标签
        </option>
      </select>
    </div>

    <focus-document-editor
      :key="documentData.id"
      :document-data="documentData"
      @save="$emit('saveContent', $event)"
    />
  </section>
</template>

<script>
import FocusDocumentEditor from "./FocusDocumentEditor.vue";

export default {
  name: "FocusDocumentPane",

  components: {
    FocusDocumentEditor,
  },

  props: {
    documentData: {
      type: Object,
      required: true,
    },

    tags: {
      type: Array,
      default: () => [],
    },
  },

  emits: [
    "saveTitle",
    "saveContent",
    "addTag",
    "createTag",
    "removeTag",
    "archive",
  ],

  data() {
    return {
      localTitle:
        this.documentData.title || "",
    };
  },

  computed: {
    documentTags() {
      return this.tags.filter((tag) =>
        (this.documentData.tagIds || [])
          .includes(tag.id)
      );
    },

    availableTags() {
      return this.tags.filter(
        (tag) =>
          !(this.documentData.tagIds || [])
            .includes(tag.id)
      );
    },
  },

  watch: {
    "documentData.id"() {
      this.localTitle =
        this.documentData.title || "";
    },

    "documentData.title"(value) {
      this.localTitle = value || "";
    },
  },

  methods: {
    saveTitle() {
      const title =
        String(this.localTitle || "").trim() ||
        "未命名文档";

      this.localTitle = title;
      this.$emit("saveTitle", title);
    },

    addTag(event) {
      const tagId = event.target.value;
      event.target.value = "";

      if (!tagId) {
        return;
      }

      if (tagId === "__new__") {
        this.$emit("createTag");
        return;
      }

      this.$emit("addTag", tagId);
    },
  },
};
</script>

<style scoped lang="scss">
.focus-document-pane {
  display: flex;
  min-width: 360px;
  height: 100%;
  flex: 1 0 0;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #e2e6ea;
  border-radius: 9px;
  background: #fff;
}

.document-pane-header {
  display: flex;
  align-items: center;
  padding: 10px 12px 5px;
  gap: 8px;
}

.document-title-input {
  min-width: 0;
  flex: 1;
  border: 0;
  background: transparent;
  color: #24292f;
  font-size: 18px;
  font-weight: 650;
  outline: none;
}

.document-actions button {
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #8c959f;
}

.document-actions button:hover {
  background: #f1f3f5;
  color: #d9480f;
}

.document-tag-row {
  display: flex;
  min-height: 34px;
  padding: 2px 12px 8px;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
}

.document-tag {
  padding: 2px 7px;
  border: 0;
  border-radius: 10px;
  background: #edf2ff;
  color: #4263eb;
  font-size: 11px;
}

.tag-add-select {
  max-width: 110px;
  border: 0;
  background: transparent;
  color: #8c959f;
  font-size: 11px;
  outline: none;
}

.dark-theme .focus-document-pane {
  border-color: #30363d;
  background: #161b22;
}

.dark-theme .document-title-input {
  color: #e6edf3;
}

.dark-theme .document-actions button:hover {
  background: #262c36;
}

.dark-theme .document-tag {
  background: #212b40;
  color: #8ea6ff;
}

.dark-theme .tag-add-select {
  color: #9da7b3;
}
</style>
