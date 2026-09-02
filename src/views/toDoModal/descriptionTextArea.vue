<template>
  <div class="position-relative">
    <textarea
      class="todo-description-textarea"
      @input="resizeTextArea"
      :placeholder="$t('todoDetails.notes')"
      ref="descriptionInput"
      @blur="doneEditDescription"
      v-model="desc"
    ></textarea>
    <i class="bi-markdown-fill" @mousedown="goToMarkDown" :title="$t('todoDetails.markdown')"></i>
  </div>
</template>

<script>
export default {
  name: "descriptionTextArea",
  emits: ["updatedDescription"],
  data() {
    return {
      desc: "",
    };
  },
  props: {
    todoDesc: { required: true },
  },
  mounted() {
    this.desc = this.todoDesc || "";
    this.$nextTick(this.resizeTextArea);
  },
  methods: {
    resizeTextArea: function () {
      let textArea = this.$refs["descriptionInput"];
      if (!textArea) return;
      textArea.style.height = "auto";
      // 最小高度从 90px 提升到 170px，让"任务细节"这一块有更宽裕的书写空间
      textArea.style.height = Math.max(textArea.scrollHeight, 170) + "px";
    },
    doneEditDescription: function () {
      this.$emit("updatedDescription", this.desc);
    },
    goToMarkDown: function () {
      window.open("https://commonmark.org/help/", "_blank");
    },
  },
  watch: {
    todoDesc(newValue) {
      this.desc = newValue || "";
      this.$nextTick(this.resizeTextArea);
    },
    desc: function () {
      this.$nextTick(this.resizeTextArea);
    },
  },
};
</script>

<style scoped>
.todo-description-textarea {
  font-size: 14px;
  line-height: 20px;
  min-height: 170px;
  overflow: hidden;
  width: 100%;
  resize: none;
  background: unset;
  cursor: text;
  outline: unset;
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  padding: 10px 12px;
  white-space: pre-wrap;
  word-break: break-word;
  transition: border-color 0.15s ease-out;
}

.todo-description-textarea:focus {
  border-color: #4263eb;
}

.dark-theme .todo-description-textarea {
  border: 1px solid rgba(255, 255, 255, 0.22);
  color: #c9d1d9;
}

.dark-theme .todo-description-textarea:focus {
  border-color: #6c8fff;
}

.bi-markdown-fill {
  font-size: 18px;
  position: absolute;
  right: 10px;
  bottom: 8px;
  opacity: 0.3;
  cursor: pointer;
}

.bi-markdown-fill:hover {
  opacity: 1;
}
</style>
