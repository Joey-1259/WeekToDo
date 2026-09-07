<template>
  <div class="life-rich-editor">
    <div
      v-if="editor"
      class="life-rich-toolbar"
      role="toolbar"
      aria-label="未来图景文字格式"
    >
      <select
        :value="currentFontSize"
        title="字体大小"
        aria-label="字体大小"
        @change="setFontSize($event.target.value)"
      >
        <option value="12px">12px</option>
        <option value="">14px</option>
        <option value="16px">16px</option>
        <option value="18px">18px</option>
        <option value="20px">20px</option>
        <option value="24px">24px</option>
        <option value="28px">28px</option>
      </select>

      <span class="toolbar-divider"></span>

      <button
        type="button"
        :class="{ active: editor.isActive('bold') }"
        title="粗体"
        aria-label="粗体"
        @click="run('toggleBold')"
      >
        <strong>B</strong>
      </button>

      <button
        type="button"
        :class="{ active: editor.isActive('italic') }"
        title="斜体"
        aria-label="斜体"
        @click="run('toggleItalic')"
      >
        <em>I</em>
      </button>

      <button
        type="button"
        :class="{ active: editor.isActive('underline') }"
        title="下划线"
        aria-label="下划线"
        @click="run('toggleUnderline')"
      >
        <u>U</u>
      </button>

      <button
        type="button"
        :class="{ active: editor.isActive('strike') }"
        title="删除线"
        aria-label="删除线"
        @click="run('toggleStrike')"
      >
        <s>S</s>
      </button>

      <span class="toolbar-divider"></span>

      <label
        class="color-control"
        title="文字颜色"
      >
        <span class="color-letter">A</span>
        <i :style="{ backgroundColor: textColor }"></i>
        <input
          type="color"
          :value="textColor"
          aria-label="选择文字颜色"
          @input="applyTextColor($event.target.value)"
        />
      </label>

      <button
        type="button"
        class="reset-color"
        title="恢复默认文字颜色"
        @click="clearTextColor"
      >
        自动
      </button>

      <label
        class="color-control highlight-control"
        title="文字背景色"
      >
        <span class="color-letter">A</span>
        <i :style="{ backgroundColor: highlightColor }"></i>
        <input
          type="color"
          :value="highlightColor"
          aria-label="选择文字背景色"
          @input="applyHighlight($event.target.value)"
        />
      </label>

      <button
        type="button"
        class="reset-color"
        title="取消文字背景色"
        @click="clearHighlight"
      >
        无背景
      </button>

      <span class="toolbar-divider"></span>

      <button
        type="button"
        :class="{ active: editor.isActive('bulletList') }"
        title="无序列表"
        aria-label="无序列表"
        @click="run('toggleBulletList')"
      >
        ☷
      </button>

      <button
        type="button"
        :class="{ active: editor.isActive('orderedList') }"
        title="有序列表"
        aria-label="有序列表"
        @click="run('toggleOrderedList')"
      >
        1.
      </button>

      <button
        type="button"
        title="清除文字格式"
        aria-label="清除文字格式"
        @click="clearFormatting"
      >
        清除格式
      </button>
    </div>

    <EditorContent
      :editor="editor"
      class="life-rich-content"
    />

    <footer class="life-rich-footer">
      <span>支持基础排版，默认字号 14px</span>
      <span>{{ plainText.length }} / {{ maxLength }}</span>
    </footer>
  </div>
</template>

<script>
import { Editor, EditorContent } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import {
  TextStyle,
  Color,
  FontSize,
} from "@tiptap/extension-text-style";

const EMPTY_CONTENT = "<p></p>";

export default {
  name: "LifeVisionRichEditor",

  components: {
    EditorContent,
  },

  props: {
    modelValue: {
      type: String,
      default: "",
    },

    maxLength: {
      type: Number,
      default: 8000,
    },
  },

  emits: [
    "update:modelValue",
    "update:plainText",
  ],

  data() {
    return {
      editor: null,
      applyingExternalValue: false,
      textColor: "#343b44",
      highlightColor: "#fff0a6",
    };
  },

  computed: {
    currentFontSize() {
      if (!this.editor) return "";

      return (
        this.editor.getAttributes("textStyle").fontSize ||
        ""
      );
    },

    plainText() {
      return this.editor?.getText() || "";
    },
  },

  watch: {
    modelValue(value) {
      if (
        !this.editor ||
        this.applyingExternalValue ||
        value === this.editor.getHTML()
      ) {
        return;
      }

      this.applyingExternalValue = true;
      this.editor.commands.setContent(
        value || EMPTY_CONTENT,
        { emitUpdate: false }
      );
      this.applyingExternalValue = false;
    },
  },

  mounted() {
    this.editor = new Editor({
      content: this.modelValue || EMPTY_CONTENT,

      extensions: [
        StarterKit,
        Placeholder.configure({
          placeholder:
            "到了那个年份，我希望自己的工作、生活、关系、能力与内在状态是……",
        }),
        TextStyle,
        Color,
        FontSize,
        Highlight.configure({
          multicolor: true,
        }),
      ],

      editorProps: {
        attributes: {
          class: "life-vision-prosemirror",
          spellcheck: "true",
        },

        handleTextInput: (view, from, to, text) => {
          const currentLength =
            view.state.doc.textContent.length;
          const selectedLength = to - from;

          return (
            currentLength -
              selectedLength +
              text.length >
            this.maxLength
          );
        },

        handlePaste: (view, event) => {
          const pasted =
            event.clipboardData?.getData("text/plain") ||
            "";

          const currentLength =
            view.state.doc.textContent.length;
          const selectionLength =
            view.state.selection.to -
            view.state.selection.from;

          if (
            currentLength -
              selectionLength +
              pasted.length <=
            this.maxLength
          ) {
            return false;
          }

          event.preventDefault();

          const available = Math.max(
            0,
            this.maxLength -
              currentLength +
              selectionLength
          );

          view.dispatch(
            view.state.tr.insertText(
              pasted.slice(0, available)
            )
          );

          return true;
        },
      },

      onSelectionUpdate: ({ editor }) => {
        const color =
          editor.getAttributes("textStyle").color;
        const highlight =
          editor.getAttributes("highlight").color;

        if (color) this.textColor = color;
        if (highlight) {
          this.highlightColor = highlight;
        }
      },

      onUpdate: ({ editor }) => {
        if (this.applyingExternalValue) return;

        this.$emit(
          "update:modelValue",
          editor.getHTML()
        );
        this.$emit(
          "update:plainText",
          editor.getText()
        );
      },
    });
  },

  beforeUnmount() {
    this.editor?.destroy();
  },

  methods: {
    run(command) {
      this.editor?.chain().focus()[command]().run();
    },

    setFontSize(value) {
      if (!this.editor) return;

      const chain = this.editor.chain().focus();

      if (value) {
        chain.setFontSize(value).run();
      } else {
        chain.unsetFontSize().run();
      }
    },

    applyTextColor(color) {
      if (!color || !this.editor) return;

      this.editor
        .chain()
        .focus()
        .setColor(color)
        .run();

      this.textColor = color;
    },

    clearTextColor() {
      this.editor
        ?.chain()
        .focus()
        .unsetColor()
        .run();

      this.textColor = "#343b44";
    },

    applyHighlight(color) {
      if (!color || !this.editor) return;

      this.editor
        .chain()
        .focus()
        .setHighlight({ color })
        .run();

      this.highlightColor = color;
    },

    clearHighlight() {
      this.editor
        ?.chain()
        .focus()
        .unsetHighlight()
        .run();

      this.highlightColor = "#fff0a6";
    },

    clearFormatting() {
      this.editor
        ?.chain()
        .focus()
        .unsetAllMarks()
        .clearNodes()
        .run();
    },

    focus() {
      this.editor?.commands.focus("end");
    },
  },
};
</script>

<style scoped lang="scss">
.life-rich-editor {
  overflow: hidden;
  border: 1px solid #dfe3e8;
  border-radius: 10px;
  background: #fff;
  transition:
    border-color 0.16s ease,
    box-shadow 0.16s ease;

  &:focus-within {
    border-color: #a692dc;
    box-shadow: 0 0 0 3px rgba(121, 80, 199, 0.08);
  }
}

.life-rich-toolbar {
  display: flex;
  min-height: 42px;
  align-items: center;
  gap: 3px;
  padding: 5px 7px;
  border-bottom: 1px solid #eceef1;
  overflow-x: auto;
  background: #fafbfc;
}

.life-rich-toolbar button,
.life-rich-toolbar select,
.color-control {
  height: 30px;
  box-sizing: border-box;
  flex: 0 0 auto;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #4b525c;
  font-family: inherit;
  font-size: 11px;
}

.life-rich-toolbar select {
  min-width: 70px;
  padding: 0 7px;
  cursor: pointer;
}

.life-rich-toolbar button {
  min-width: 30px;
  padding: 0 8px;
  cursor: pointer;

  &:hover,
  &.active {
    background: #eeeaf7;
    color: #7950c7;
  }
}

.life-rich-toolbar .reset-color {
  min-width: auto;
  color: #777f89;
  font-size: 9px;
}

.toolbar-divider {
  width: 1px;
  height: 18px;
  margin: 0 4px;
  flex: 0 0 1px;
  background: #dfe3e8;
}

.color-control {
  position: relative;
  display: grid;
  width: 30px;
  place-items: center;
  cursor: pointer;

  &:hover {
    background: #eeeaf7;
  }

  input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }

  i {
    position: absolute;
    right: 5px;
    bottom: 3px;
    left: 5px;
    height: 3px;
    border-radius: 999px;
  }
}

.color-letter {
  font-size: 13px;
  font-weight: 700;
}

.highlight-control .color-letter {
  padding: 1px 3px;
  border-radius: 2px;
  background: #fff0a6;
}

.life-rich-content {
  min-height: 300px;
  max-height: min(430px, 48vh);
  overflow-y: auto;
}

:deep(.life-vision-prosemirror) {
  min-height: 300px;
  padding: 18px 20px 50px;
  outline: none;
  color: #343b44;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.85;
  overflow-wrap: anywhere;
}

:deep(.life-vision-prosemirror p) {
  margin: 0.5em 0;
}

:deep(.life-vision-prosemirror ul),
:deep(.life-vision-prosemirror ol) {
  margin: 0.65em 0;
  padding-left: 1.7em;
}

:deep(.life-vision-prosemirror .is-editor-empty:first-child::before) {
  height: 0;
  float: left;
  color: #adb2b9;
  content: attr(data-placeholder);
  pointer-events: none;
}

:deep(.life-vision-prosemirror mark) {
  padding: 1px 2px;
  border-radius: 3px;
}

.life-rich-footer {
  display: flex;
  min-height: 28px;
  align-items: center;
  justify-content: space-between;
  padding: 4px 10px;
  border-top: 1px solid #f0f1f3;
  color: #a0a6ae;
  font-size: 8px;
}

.dark-theme {
  .life-rich-editor {
    border-color: #36404a;
    background: #20262e;
  }

  .life-rich-toolbar {
    border-color: #343d47;
    background: #1b2128;
  }

  .life-rich-toolbar button,
  .life-rich-toolbar select,
  .color-control {
    color: #d2d7dd;
  }

  .life-rich-toolbar button:hover,
  .life-rich-toolbar button.active,
  .color-control:hover {
    background: #302744;
    color: #c5b2ee;
  }

  .toolbar-divider,
  .life-rich-footer {
    border-color: #343d47;
  }

  :deep(.life-vision-prosemirror) {
    color: #d8dde3;
  }
}
</style>
