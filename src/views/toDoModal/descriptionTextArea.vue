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
      textArea.style.height = Math.max(textArea.scrollHeight, 90) + "px";
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
  line-height: 19px;
  min-height: 90px;
  overflow: hidden;
  width: 100%;
  resize: none;
  background: unset;
  cursor: text;
  outline: unset;
  border: 2px solid rgba(0, 0, 0, 0.12);
  border-radius: 6px;
  padding: 8px 10px;
  white-space: pre-wrap;
  word-break: break-word;
  transition: border-color 0.15s ease-out;
}

.todo-description-textarea:focus {
  border-color: black;
}

.dark-theme .todo-description-textarea {
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: #c9d1d9;
}

.dark-theme .todo-description-textarea:focus {
  border-color: rgba(255, 255, 255, 0.658);
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
