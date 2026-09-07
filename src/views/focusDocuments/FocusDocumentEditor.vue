<template>
  <div class="focus-editor" :class="{ spacious }">
    <div v-if="editor" class="focus-editor-toolbar">

      <select
        class="focus-block-select"
        :value="currentBlock"
        title="文字样式"
        @change="setBlock($event.target.value)"
      >
        <option value="paragraph">正文</option>
        <option value="h1">一级标题</option>
        <option value="h2">二级标题</option>
        <option value="h3">三级标题</option>
      </select>

      <select
        class="focus-size-select"
        :value="currentFontSize"
        title="字体大小"
        @change="setFontSize($event.target.value)"
      >
        <option value="">16px</option>
        <option value="12px">12px</option>
        <option value="14px">14px</option>
        <option value="16px">16px</option>
        <option value="18px">18px</option>
        <option value="20px">20px</option>
        <option value="24px">24px</option>
        <option value="28px">28px</option>
        <option value="32px">32px</option>
        <option value="40px">40px</option>
      </select>

      <span class="divider"></span>

      <button
        :class="{ active: editor.isActive('bold') }"
        title="粗体"
        @click="run('toggleBold')"
      ><strong>B</strong></button>
      <button
        v-if="spacious"
        :class="{ active: editor.isActive('italic') }"
        title="斜体"
        @click="run('toggleItalic')"
      ><em>I</em></button>
      <button
        v-if="spacious"
        :class="{ active: editor.isActive('underline') }"
        title="下划线"
        @click="run('toggleUnderline')"
      ><u>U</u></button>
      <button
        v-if="spacious"
        :class="{ active: editor.isActive('strike') }"
        title="删除线"
        @click="run('toggleStrike')"
      ><s>S</s></button>
      <div class="focus-color-control">
        <button
          class="focus-color-trigger"
          :class="{ active: activeColorMenu === 'toolbarText' }"
          title="文字颜色"
          @mousedown.prevent
          @click.stop="toggleColorMenu('toolbarText', $event)"
        >
          <span class="focus-color-letter">A</span>
          <i
            class="focus-color-indicator"
            :style="{ backgroundColor: selectedTextColor }"
          ></i>
        </button>

        <div
          v-if="activeColorMenu === 'toolbarText'"
          class="focus-color-menu"
          :style="colorMenuStyle"
          @mousedown.stop
          @click.stop
        >
          <strong>文字颜色</strong>
          <div class="focus-color-grid">
            <button
              class="focus-color-reset"
              title="恢复默认文字颜色"
              @mousedown.prevent
              @click="clearTextColor"
            >自动</button>
            <button
              v-for="color in textColors"
              :key="color"
              class="focus-color-swatch"
              :class="{ selected: selectedTextColor === color }"
              :style="{ backgroundColor: color }"
              :title="color"
              @mousedown.prevent
              @click="applyTextColor(color)"
            ></button>
          </div>

          <label class="focus-custom-color">
            <span>自定义颜色</span>
            <input
              type="color"
              :value="selectedTextColor"
              @input="applyTextColor($event.target.value)"
            />
          </label>
        </div>
      </div>

      <div class="focus-color-control">
        <button
          class="focus-color-trigger"
          :class="{
            active:
              editor.isActive('highlight') ||
              activeColorMenu === 'toolbarHighlight'
          }"
          title="高亮颜色"
          @mousedown.prevent
          @click.stop="toggleColorMenu('toolbarHighlight', $event)"
        >
          <span class="focus-highlight-letter">A</span>
          <i
            class="focus-color-indicator"
            :style="{ backgroundColor: selectedHighlightColor }"
          ></i>
        </button>

        <div
          v-if="activeColorMenu === 'toolbarHighlight'"
          class="focus-color-menu"
          :style="colorMenuStyle"
          @mousedown.stop
          @click.stop
        >
          <strong>高亮颜色</strong>
          <div class="focus-color-grid">
            <button
              class="focus-color-reset"
              title="取消高亮"
              @mousedown.prevent
              @click="clearHighlight"
            >无</button>
            <button
              v-for="color in highlightColors"
              :key="color"
              class="focus-color-swatch"
              :class="{
                selected: selectedHighlightColor === color
              }"
              :style="{ backgroundColor: color }"
              :title="color"
              @mousedown.prevent
              @click="applyHighlight(color)"
            ></button>
          </div>

          <label class="focus-custom-color">
            <span>自定义颜色</span>
            <input
              type="color"
              :value="selectedHighlightColor"
              @input="applyHighlight($event.target.value)"
            />
          </label>
        </div>
      </div>

      <span class="divider"></span>

      <button
        v-if="spacious"
        title="减少缩进（Shift + Tab）"
        @click="decreaseIndent"
      >⇤</button>
      <button
        v-if="spacious"
        title="增加缩进（Tab）"
        @click="increaseIndent"
      >⇥</button>
      <button title="无序列表" @click="run('toggleBulletList')">☷</button>
      <button title="有序列表" @click="run('toggleOrderedList')">1.</button>
      <button title="待办清单" @click="run('toggleTaskList')">☑</button>
      <button
        v-if="spacious"
        title="引用"
        @click="run('toggleBlockquote')"
      >❝</button>
      <button title="关联事项" @click="$emit('request-task')">↗</button>

      <span class="spacer"></span>

      <button
        v-if="spacious"
        title="Markdown 源码"
        @click="openMarkdown"
      >MD</button>
    </div>

    <BubbleMenu
      v-if="editor"
      :editor="editor"
      :options="{ placement: 'top', offset: 8 }"
      class="focus-bubble"
    >
      <button @click="run('toggleBold')"><strong>B</strong></button>
      <button @click="run('toggleItalic')"><em>I</em></button>
      <button @click="run('toggleUnderline')"><u>U</u></button>
      <button @click="run('toggleStrike')"><s>S</s></button>

      <div class="focus-color-control">
        <button
          class="focus-color-trigger"
          title="文字颜色"
          @mousedown.prevent
          @click.stop="toggleColorMenu('bubbleText', $event)"
        >
          <span class="focus-color-letter">A</span>
          <i
            class="focus-color-indicator"
            :style="{ backgroundColor: selectedTextColor }"
          ></i>
        </button>

        <div
          v-if="activeColorMenu === 'bubbleText'"
          class="focus-color-menu is-bubble"
          :style="colorMenuStyle"
          @mousedown.stop
          @click.stop
        >
          <strong>文字颜色</strong>
          <div class="focus-color-grid">
            <button
              class="focus-color-reset"
              @mousedown.prevent
              @click="clearTextColor"
            >自动</button>
            <button
              v-for="color in textColors"
              :key="color"
              class="focus-color-swatch"
              :style="{ backgroundColor: color }"
              @mousedown.prevent
              @click="applyTextColor(color)"
            ></button>
          </div>
        </div>
      </div>

      <div class="focus-color-control">
        <button
          class="focus-color-trigger"
          title="高亮颜色"
          @mousedown.prevent
          @click.stop="toggleColorMenu('bubbleHighlight', $event)"
        >
          <span class="focus-highlight-letter">A</span>
          <i
            class="focus-color-indicator"
            :style="{ backgroundColor: selectedHighlightColor }"
          ></i>
        </button>

        <div
          v-if="activeColorMenu === 'bubbleHighlight'"
          class="focus-color-menu is-bubble"
          :style="colorMenuStyle"
          @mousedown.stop
          @click.stop
        >
          <strong>高亮颜色</strong>
          <div class="focus-color-grid">
            <button
              class="focus-color-reset"
              @mousedown.prevent
              @click="clearHighlight"
            >无</button>
            <button
              v-for="color in highlightColors"
              :key="color"
              class="focus-color-swatch"
              :style="{ backgroundColor: color }"
              @mousedown.prevent
              @click="applyHighlight(color)"
            ></button>
          </div>
        </div>
      </div>

      <button @click="editLink">链接</button>
    </BubbleMenu>

    <EditorContent :editor="editor" class="focus-editor-content" />

    <div
      v-if="markdownVisible"
      class="markdown-backdrop"
      @mousedown.self="markdownVisible = false"
    >
      <section class="markdown-dialog">
        <header>
          <div>
            <strong>Markdown 源码</strong>
            <small>应用后会转换为结构化文档</small>
          </div>
          <button @click="markdownVisible = false">×</button>
        </header>

        <textarea
          ref="markdown"
          v-model="markdownSource"
          spellcheck="false"
        ></textarea>

        <footer>
          <button @click="markdownVisible = false">取消</button>
          <button class="primary" @click="applyMarkdown">
            应用
          </button>
        </footer>
      </section>
    </div>
  </div>
</template>

<script>
import { Editor, EditorContent } from "@tiptap/vue-3";
import { BubbleMenu } from "@tiptap/vue-3/menus";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Highlight from "@tiptap/extension-highlight";
import {
  TextStyle,
  Color,
  FontSize,
} from "@tiptap/extension-text-style";
import {
  Details,
  DetailsSummary,
  DetailsContent,
} from "@tiptap/extension-details";
import { Markdown } from "@tiptap/markdown";
import SlashCommands from "../../editor/extensions/SlashCommands";
import LinkedTask from "../../editor/extensions/LinkedTask";
import SmartFormatting from "../../editor/extensions/SmartFormatting";
import { createSlashCommandItems } from "../../editor/slashCommandItems";
import focusTaskService from "../../services/focusTaskService";

const EMPTY = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

const TEXT_COLORS = [
  "#292d33",
  "#626a75",
  "#d14343",
  "#c26a22",
  "#9a7614",
  "#2f7d4a",
  "#267a8a",
  "#3f63c8",
  "#7354b5",
];

const HIGHLIGHT_COLORS = [
  "#fff0a6",
  "#ffd8a8",
  "#ffc9c9",
  "#d3f9d8",
  "#c5f6fa",
  "#d0ebff",
  "#e5dbff",
  "#f1f3f5",
];

export default {
  name: "FocusDocumentEditor",
  components: { EditorContent, BubbleMenu },
  props: {
    modelValue: {
      type: Object,
      default: () => EMPTY,
    },
    documentId: {
      type: String,
      required: true,
    },
    spacious: Boolean,
  },
  emits: [
    "update:modelValue",
    "request-task",
    "open-task",
    "jump-task",
  ],
  data() {
    return {
      editor: null,
      markdownVisible: false,
      markdownSource: "",
      externalUpdate: false,
      activeColorMenu: null,
      selectedTextColor: "#292d33",
      selectedHighlightColor: "#fff0a6",
      colorMenuStyle: {},
      textColors: TEXT_COLORS,
      highlightColors: HIGHLIGHT_COLORS,
    };
  },
  computed: {
    currentBlock() {
      if (!this.editor) return "paragraph";
      for (const level of [1, 2, 3]) {
        if (this.editor.isActive("heading", { level })) {
          return `h${level}`;
        }
      }
      return "paragraph";
    },

    currentFontSize() {
      if (!this.editor) return "";
      return (
        this.editor.getAttributes("textStyle").fontSize || ""
      );
    },
  },
  watch: {
    modelValue: {
      deep: true,
      handler(value) {
        if (!this.editor || this.externalUpdate) return;

        if (
          JSON.stringify(this.editor.getJSON()) ===
          JSON.stringify(value)
        ) return;

        this.externalUpdate = true;
        this.editor.commands.setContent(value || EMPTY, {
          emitUpdate: false,
        });
        this.externalUpdate = false;
        this.refreshLinkedTasks();
      },
    },
  },
  mounted() {
    this.editor = new Editor({
      content: this.modelValue || EMPTY,
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
          link: {
            openOnClick: false,
            autolink: true,
            linkOnPaste: true,
          },
        }),
        Placeholder.configure({
          includeChildren: true,
          showOnlyCurrent: true,
          placeholder: ({ node }) => {
            if (node.type.name === "detailsSummary") {
              return "折叠标题";
            }

            if (node.type.name === "paragraph") {
              return "输入内容，或使用 / 插入功能……";
            }

            return "";
          },
        }),
        TaskList,
        TaskItem.configure({ nested: true }),
        TextStyle,
        Color,
        FontSize,
        SmartFormatting,
        Highlight.configure({ multicolor: true }),
        Details.configure({ persist: true }),
        DetailsSummary,
        DetailsContent,
        Markdown.configure({
          markedOptions: { gfm: true, breaks: false },
        }),
        LinkedTask,
        SlashCommands.configure({
          items: createSlashCommandItems(() =>
            this.$emit("request-task")
          ),
        }),
      ],
      editorProps: {
        attributes: {
          class: "focus-prosemirror",
          spellcheck: "true",
        },
      },
      onUpdate: ({ editor }) => {
        if (!this.externalUpdate) {
          this.$emit("update:modelValue", editor.getJSON());
        }
      },
    });

    document.addEventListener(
      "mousedown",
      this.onDocumentPointerDown
    );

    window.addEventListener(
      "focus-task-toggle",
      this.onTaskToggle
    );
    window.addEventListener(
      "focus-task-open",
      this.onTaskOpen
    );
    window.addEventListener(
      "focus-task-jump",
      this.onTaskJump
    );
    window.addEventListener(
      "focus-task-unlink",
      this.onTaskUnlink
    );
    window.addEventListener(
      "weektodo:task-changed",
      this.onTaskChanged
    );

    this.refreshLinkedTasks();
  },
  beforeUnmount() {
    document.removeEventListener(
      "mousedown",
      this.onDocumentPointerDown
    );

    window.removeEventListener(
      "focus-task-toggle",
      this.onTaskToggle
    );
    window.removeEventListener(
      "focus-task-open",
      this.onTaskOpen
    );
    window.removeEventListener(
      "focus-task-jump",
      this.onTaskJump
    );
    window.removeEventListener(
      "focus-task-unlink",
      this.onTaskUnlink
    );
    window.removeEventListener(
      "weektodo:task-changed",
      this.onTaskChanged
    );
    this.editor?.destroy();
  },
  methods: {
    run(command) {
      this.editor?.chain().focus()[command]().run();
    },

    toggleColorMenu(name, event) {
      if (this.activeColorMenu === name) {
        this.activeColorMenu = null;
        return;
      }

      const trigger =
        event?.currentTarget?.getBoundingClientRect();

      if (trigger) {
        const width = 224;
        const height = 176;

        const left = Math.max(
          10,
          Math.min(
            window.innerWidth - width - 10,
            trigger.left
          )
        );

        const openAbove =
          trigger.bottom + height >
          window.innerHeight - 10;

        this.colorMenuStyle = {
          position: "fixed",
          width: `${width}px`,
          left: `${left}px`,
          top: openAbove
            ? "auto"
            : `${trigger.bottom + 7}px`,
          bottom: openAbove
            ? `${window.innerHeight - trigger.top + 7}px`
            : "auto",
          transform: "none",
        };
      }

      this.activeColorMenu = name;

      if (!this.editor) return;

      const textColor =
        this.editor.getAttributes("textStyle").color;
      const highlightColor =
        this.editor.getAttributes("highlight").color;

      if (textColor) this.selectedTextColor = textColor;
      if (highlightColor) {
        this.selectedHighlightColor = highlightColor;
      }
    },

    applyTextColor(color) {
      if (!this.editor || !color) return;

      this.editor
        .chain()
        .focus()
        .setColor(color)
        .run();

      this.selectedTextColor = color;
      this.activeColorMenu = null;
    },

    clearTextColor() {
      this.editor
        ?.chain()
        .focus()
        .unsetColor()
        .run();

      this.selectedTextColor = "#292d33";
      this.activeColorMenu = null;
    },

    applyHighlight(color) {
      if (!this.editor || !color) return;

      this.editor
        .chain()
        .focus()
        .setHighlight({ color })
        .run();

      this.selectedHighlightColor = color;
      this.activeColorMenu = null;
    },

    clearHighlight() {
      this.editor
        ?.chain()
        .focus()
        .unsetHighlight()
        .run();

      this.selectedHighlightColor = "#fff0a6";
      this.activeColorMenu = null;
    },

    onDocumentPointerDown(event) {
      if (!event.target.closest(".focus-color-control")) {
        this.activeColorMenu = null;
      }
    },

    setBlock(value) {
      const chain = this.editor.chain().focus();

      if (value === "paragraph") {
        chain.setParagraph().run();
      } else {
        chain
          .setHeading({ level: Number(value.slice(1)) })
          .run();
      }
    },

    setFontSize(value) {
      if (!this.editor) return;

      const chain = this.editor.chain().focus();

      if (!value) {
        chain.unsetFontSize().run();
      } else {
        chain.setFontSize(value).run();
      }
    },

    increaseIndent() {
      if (!this.editor) return;

      if (this.editor.isActive("taskItem")) {
        this.editor
          .chain()
          .focus()
          .sinkListItem("taskItem")
          .run();
        return;
      }

      if (this.editor.isActive("listItem")) {
        this.editor
          .chain()
          .focus()
          .sinkListItem("listItem")
          .run();
        return;
      }

      this.editor.chain().focus().increaseIndent().run();
    },

    decreaseIndent() {
      if (!this.editor) return;

      if (this.editor.isActive("taskItem")) {
        this.editor
          .chain()
          .focus()
          .liftListItem("taskItem")
          .run();
        return;
      }

      if (this.editor.isActive("listItem")) {
        this.editor
          .chain()
          .focus()
          .liftListItem("listItem")
          .run();
        return;
      }

      this.editor.chain().focus().decreaseIndent().run();
    },

    focus() {
      this.editor?.commands.focus("end");
    },

    insertLinkedTask(attrs) {
      this.editor
        ?.chain()
        .focus()
        .insertContent([
          { type: "linkedTask", attrs },
          { type: "paragraph" },
        ])
        .run();
    },

    updateTaskNodes(taskId, attrs) {
      if (!this.editor) return;

      const transaction = this.editor.state.tr;
      let changed = false;

      this.editor.state.doc.descendants((node, pos) => {
        if (
          node.type.name === "linkedTask" &&
          node.attrs.taskId === taskId
        ) {
          transaction.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            ...attrs,
          });
          changed = true;
        }
      });

      if (changed) this.editor.view.dispatch(transaction);
    },

    async refreshLinkedTasks() {
      if (!this.editor) return;

      const nodes = [];
      this.editor.state.doc.descendants((node) => {
        if (node.type.name === "linkedTask") {
          nodes.push(node.attrs);
        }
      });

      for (const attrs of nodes) {
        const task = await focusTaskService.resolveTask(
          attrs.taskId,
          attrs.listId
        );

        this.updateTaskNodes(
          attrs.taskId,
          task
            ? {
                title: task.text,
                checked: task.checked,
                listId: task.listId,
                missing: false,
              }
            : { missing: true }
        );
      }
    },

    normalizeTaskEvent(event) {
      const detail = event?.detail;

      if (!detail) return null;

      if (
        detail.sourceEditor &&
        detail.sourceEditor !== this.editor
      ) {
        return null;
      }

      const {
        sourceEditor: _sourceEditor,
        ...attrs
      } = detail;

      return attrs;
    },

    async onTaskToggle(event) {
      const attrs = this.normalizeTaskEvent(event);
      if (!attrs?.taskId) return;

      try {
        const task = await focusTaskService.toggleTask(
          attrs.taskId,
          attrs.listId
        );

        this.updateTaskNodes(attrs.taskId, {
          title: task.text,
          checked: task.checked,
          missing: false,
        });
      } catch (error) {
        this.updateTaskNodes(attrs.taskId, {
          missing: true,
        });
      }
    },

    onTaskOpen(event) {
      const task = this.normalizeTaskEvent(event);

      if (task?.taskId) {
        this.$emit("open-task", task);
      }
    },

    onTaskJump(event) {
      const task = this.normalizeTaskEvent(event);

      if (task?.taskId && task?.listId) {
        this.$emit("jump-task", task);
      }
    },

    async onTaskUnlink(event) {
      const attrs = this.normalizeTaskEvent(event);
      if (!attrs?.taskId) return;

      const deleteTask = window.confirm(
        "是否同时删除每周事项？\n\n确定：删除事项及关联\n取消：仅解除文档关联"
      );

      await focusTaskService.unlink({
        documentId: this.documentId,
        ...attrs,
        deleteTask,
      });

      this.editor
        ?.chain()
        .focus()
        .deleteSelection()
        .run();
    },

    onTaskChanged(event) {
      const taskId = event.detail?.taskId;
      if (!taskId) return;

      this.refreshLinkedTasks();
    },

    editLink() {
      const current =
        this.editor.getAttributes("link").href || "";
      const value = window.prompt(
        "输入链接地址；留空移除链接",
        current
      );

      if (value === null) return;

      if (!value.trim()) {
        this.editor
          .chain()
          .focus()
          .extendMarkRange("link")
          .unsetLink()
          .run();
      } else {
        this.editor
          .chain()
          .focus()
          .extendMarkRange("link")
          .setLink({ href: value.trim() })
          .run();
      }
    },

    openMarkdown() {
      this.markdownSource =
        this.editor.markdown.serialize(
          this.editor.getJSON()
        );
      this.markdownVisible = true;

      this.$nextTick(() => this.$refs.markdown?.focus());
    },

    applyMarkdown() {
      this.editor.commands.setContent(
        this.markdownSource,
        {
          contentType: "markdown",
          emitUpdate: true,
        }
      );
      this.markdownVisible = false;
      this.editor.commands.focus();
    },
  },
};
</script>

<style lang="scss">
.focus-editor {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  background: #fff;
}

.focus-editor-toolbar {
  position: sticky;
  z-index: 5;
  top: 0;
  display: flex;
  min-height: 42px;
  align-items: center;
  gap: 3px;
  padding: 5px 8px;
  border-bottom: 1px solid #eceef1;
  background: rgba(255, 255, 255, 0.94);
  overflow-x: auto;
  overflow-y: visible;
  scrollbar-width: thin;
}

.focus-editor-toolbar button,
.focus-editor-toolbar select,
.focus-bubble button {
  min-width: 30px;
  height: 30px;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #464b53;
  flex: 0 0 auto;
  cursor: pointer;
}

.focus-editor-toolbar select.focus-block-select {
  min-width: 92px;
}

.focus-editor-toolbar select.focus-size-select {
  min-width: 72px;
}

.focus-editor-toolbar button:disabled {
  cursor: default;
  opacity: 0.35;
}

.focus-editor-toolbar button:hover,
.focus-editor-toolbar button.active,
.focus-bubble button:hover {
  background: #eef1f5;
  color: #4263eb;
}

.focus-editor-toolbar .divider {
  width: 1px;
  height: 18px;
  margin: 0 4px;
  background: #e2e5e9;
}

.focus-editor-toolbar .spacer {
  flex: 1;
}

.focus-editor-content {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
}

.focus-prosemirror {
  min-height: 320px;
  padding: 24px 28px 80px;
  outline: none;
  color: #292d33;
  font-size: 15px;
  line-height: 1.75;
  overflow-wrap: anywhere;
}

.focus-editor.spacious .focus-prosemirror {
  width: min(780px, calc(100% - 56px));
  min-height: 58vh;
  margin: auto;
  padding-top: 42px;
  font-size: 16px;
  line-height: 1.82;
}

.focus-prosemirror p {
  margin: 0.45em 0;
}

.focus-prosemirror h1 {
  margin: 1.35em 0 0.5em;
  font-size: 2em;
}

.focus-prosemirror h2 {
  margin: 1.25em 0 0.45em;
  font-size: 1.55em;
}

.focus-prosemirror h3 {
  margin: 1.1em 0 0.4em;
  font-size: 1.25em;
}

.focus-prosemirror blockquote {
  margin: 1em 0;
  padding: 4px 16px;
  border-left: 3px solid #879de9;
  background: #f7f8fc;
  color: #626a75;
}

.focus-prosemirror pre {
  padding: 14px 16px;
  border-radius: 8px;
  background: #20242b;
  color: #edf0f3;
  overflow-x: auto;
}

.focus-prosemirror mark {
  padding: 1px 2px;
  border-radius: 3px;
  background: #fff0a6;
}

.focus-prosemirror ul[data-type="taskList"] {
  padding-left: 0;
  list-style: none;
}

.focus-prosemirror ul[data-type="taskList"] li {
  display: flex;
  gap: 8px;
}

.focus-prosemirror [data-type="details"] {
  position: relative;
  margin: 12px 0;
  padding: 10px 12px 10px 38px;
  border: 1px solid #e4e7eb;
  border-radius: 8px;
  background: #fafbfc;
}

.focus-prosemirror [data-type="details"] > button {
  position: absolute;
  top: 11px;
  left: 11px;
  border: 0;
  background: transparent;
}

.focus-prosemirror
  [data-type="details"]:not(.is-open)
  [data-type="detailsContent"] {
  display: none;
}

.focus-prosemirror .is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  height: 0;
  color: #a7acb4;
  pointer-events: none;
}

.linked-task-block {
  display: flex;
  min-height: 34px;
  align-items: center;
  gap: 8px;
  margin: 5px 0;
  padding: 3px 4px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  transition: background-color 0.15s ease;
}

.linked-task-block:hover {
  background: #f4f6f9;
}

.linked-task-check {
  width: 20px;
  height: 20px;
  border: 1px solid #9aa7c8;
  border-radius: 50%;
  background: #fff;
  color: #fff;
  cursor: pointer;
}

.linked-task-block.is-checked .linked-task-check {
  border-color: #4263eb;
  background: #4263eb;
}

.linked-task-main {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  align-items: flex-start;
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.linked-task-main small {
  color: #979da6;
}

.linked-task-block.is-checked .linked-task-title {
  color: #969ca5;
  text-decoration: line-through;
}

.linked-task-block.is-missing {
  opacity: 0.58;
}

.linked-task-unlink {
  border: 0;
  background: transparent;
  color: #999fa8;
  cursor: pointer;
}

.focus-editor-help {
  padding: 7px 14px;
  border-top: 1px solid #eef0f2;
  color: #969ca5;
  font-size: 11px;
}

.focus-editor-help kbd,
.focus-slash-title kbd {
  padding: 1px 5px;
  border: 1px solid #dfe2e7;
  border-radius: 4px;
  background: #fff;
  font-family: inherit;
  font-size: 10px;
}

.focus-bubble {
  display: flex;
  gap: 2px;
  padding: 4px;
  border: 1px solid #e0e3e7;
  border-radius: 9px;
  background: #fff;
  box-shadow: 0 10px 30px rgba(20, 25, 34, 0.17);
}


.focus-command-menu {
  z-index: 13000;
  width: min(470px, calc(100vw - 32px));
  max-height: min(620px, calc(100vh - 40px));
  border: 1px solid rgba(31, 35, 41, 0.12);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow:
    0 18px 55px rgba(25, 30, 40, 0.16),
    0 3px 12px rgba(25, 30, 40, 0.08);
  color: #262a30;
  overflow: hidden;
  backdrop-filter: blur(18px);
}

.focus-command-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 11px 15px 8px;
  color: #969ca5;
  font-size: 11px;
}

.focus-command-header kbd {
  padding: 1px 5px;
  border: 1px solid #dfe3e8;
  border-radius: 4px;
  background: #f8f9fa;
  color: #858b94;
  font-family: inherit;
  font-size: 10px;
}

.focus-command-scroll {
  max-height: min(560px, calc(100vh - 100px));
  padding: 0 8px 10px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.focus-command-section {
  padding-top: 7px;
}

.focus-command-section + .focus-command-section {
  margin-top: 7px;
  border-top: 1px solid #f0f1f3;
}

.focus-command-section-title {
  padding: 8px 7px 6px;
  color: #8e949d;
  font-size: 12px;
  font-weight: 500;
}

.focus-command-recent {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  padding: 0 7px 8px;
}

.focus-command-recent .focus-command-item.is-compact {
  width: auto;
  min-width: 0;
  padding: 7px 10px;
  background: #f4f5f6;
}

.focus-command-format-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 5px;
  padding: 0 4px 8px;
}

.focus-command-item {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  gap: 11px;
  padding: 8px 9px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: #2c3036;
  text-align: left;
  cursor: pointer;
  transition:
    background-color 0.12s ease,
    color 0.12s ease;
}

.focus-command-item:hover,
.focus-command-item.is-selected {
  background: #f0f2f4;
}

.focus-command-item.is-compact {
  flex-direction: row;
  justify-content: flex-start;
  gap: 7px;
  padding: 7px;
}

.focus-command-icon {
  display: grid;
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  place-items: center;
  border: 1px solid #dde2e7;
  border-radius: 9px;
  background: #fff;
  color: #343941;
  font-size: 13px;
  font-weight: 650;
  box-shadow: 0 1px 2px rgba(30, 35, 45, 0.04);
}

.focus-command-item.is-compact .focus-command-icon {
  width: 30px;
  height: 30px;
  flex-basis: 30px;
  border: 0;
  background: transparent;
  box-shadow: none;
  font-size: 15px;
}

.focus-command-compact-title {
  overflow: hidden;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.focus-command-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}

.focus-command-copy strong {
  overflow: hidden;
  font-size: 14px;
  font-weight: 550;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.focus-command-copy small {
  overflow: hidden;
  color: #969ca5;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.focus-command-shortcut {
  flex: 0 0 auto;
  color: #b0b5bc;
  font-size: 11px;
}

.focus-command-loading,
.focus-command-empty {
  display: flex;
  min-height: 90px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #9298a1;
  font-size: 12px;
}

.focus-command-empty strong {
  margin-bottom: 4px;
  color: #656c76;
  font-weight: 550;
}

.focus-command-empty small {
  color: #a2a7af;
}

/* 折叠块 */
.focus-prosemirror [data-type="details"] {
  position: relative;
  margin: 12px 0;
  padding: 8px 10px 9px 38px;
  border: 1px solid transparent;
  border-radius: 9px;
  background: #f7f8fa;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;
}

.focus-prosemirror [data-type="details"]:hover,
.focus-prosemirror [data-type="details"].is-open {
  border-color: #e2e5e9;
  background: #fafbfc;
}

.focus-prosemirror [data-type="details"] > button {
  position: absolute;
  top: 11px;
  left: 11px;
  display: grid;
  width: 20px;
  height: 20px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
}

.focus-prosemirror [data-type="details"] > button:hover {
  background: #e8ebef;
}

.focus-prosemirror
  [data-type="details"]
  > button::before {
  content: "";
  width: 0;
  height: 0;
  border-top: 5px solid transparent;
  border-bottom: 5px solid transparent;
  border-left: 7px solid #6d747e;
  transform-origin: 3px center;
  transition: transform 0.15s ease;
}

.focus-prosemirror
  [data-type="details"].is-open
  > button::before {
  transform: rotate(90deg);
}

.focus-prosemirror [data-type="details"] summary {
  display: block;
  min-height: 26px;
  padding: 1px 4px;
  outline: none;
  color: #343940;
  font-weight: 600;
  line-height: 24px;
  cursor: text;
  list-style: none;
}

.focus-prosemirror
  [data-type="details"]
  summary::-webkit-details-marker {
  display: none;
}

.focus-prosemirror
  [data-type="details"]
  [data-type="detailsContent"] {
  margin-top: 5px;
  padding: 7px 4px 2px;
  border-top: 1px solid #e8eaed;
  color: #505761;
}

.focus-prosemirror
  [data-type="details"]:not(.is-open)
  [data-type="detailsContent"] {
  display: none;
}

.focus-prosemirror
  [data-type="details"]
  summary.is-empty::before,
.focus-prosemirror
  [data-type="details"]
  [data-type="detailsContent"]
  .is-empty::before {
  content: attr(data-placeholder);
  float: left;
  height: 0;
  color: #a6abb3;
  font-weight: 400;
  pointer-events: none;
}

.dark-theme .focus-command-menu {
  border-color: #343b45;
  background: rgba(27, 33, 41, 0.98);
  color: #e0e4e9;
}

.dark-theme .focus-command-section + .focus-command-section {
  border-color: #303740;
}

.dark-theme .focus-command-item {
  color: #d9dde3;
}

.dark-theme .focus-command-item:hover,
.dark-theme .focus-command-item.is-selected,
.dark-theme
  .focus-command-recent
  .focus-command-item.is-compact {
  background: #29313b;
}

.dark-theme .focus-command-icon {
  border-color: #3b434e;
  background: #222932;
  color: #dce0e5;
}

.dark-theme .focus-command-header kbd {
  border-color: #3b434e;
  background: #222932;
  color: #adb4bd;
}

.dark-theme .focus-prosemirror [data-type="details"] {
  border-color: transparent;
  background: #1b2129;
}

.dark-theme
  .focus-prosemirror
  [data-type="details"]:hover,
.dark-theme
  .focus-prosemirror
  [data-type="details"].is-open {
  border-color: #38414b;
  background: #1e252e;
}

.dark-theme
  .focus-prosemirror
  [data-type="details"]
  summary {
  color: #dce1e7;
}

.dark-theme
  .focus-prosemirror
  [data-type="details"]
  [data-type="detailsContent"] {
  border-color: #343c46;
  color: #c6cbd2;
}

.markdown-backdrop {
  position: fixed;
  z-index: 14000;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(18, 22, 28, 0.45);
}

.markdown-dialog {
  display: flex;
  width: min(900px, 92vw);
  height: min(720px, 86vh);
  flex-direction: column;
  border-radius: 14px;
  background: #fff;
  overflow: hidden;
}

.markdown-dialog header,
.markdown-dialog footer {
  display: flex;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid #eceef1;
}

.markdown-dialog header div {
  display: flex;
  flex-direction: column;
}

.markdown-dialog header small {
  color: #969ca5;
}

.markdown-dialog textarea {
  min-height: 0;
  flex: 1;
  padding: 20px;
  border: 0;
  outline: none;
  resize: none;
  background: #fafbfc;
  font: 14px/1.7 ui-monospace, monospace;
}

.markdown-dialog footer {
  justify-content: flex-end;
  gap: 8px;
  border-top: 1px solid #eceef1;
  border-bottom: 0;
}

.markdown-dialog button {
  padding: 7px 13px;
  border: 1px solid #dfe2e7;
  border-radius: 7px;
  background: #fff;
  cursor: pointer;
}

.markdown-dialog button.primary {
  border-color: #4263eb;
  background: #4263eb;
  color: #fff;
}

.dark-theme .focus-editor,
.dark-theme .focus-editor-toolbar {
  background: #161b22;
  color: #d8dce2;
}

.dark-theme .focus-editor-toolbar {
  border-color: #30363d;
}

.dark-theme .focus-editor-toolbar button,
.dark-theme .focus-editor-toolbar select {
  color: #cbd0d7;
}

.dark-theme .focus-prosemirror {
  color: #d8dce2;
}

.dark-theme .focus-prosemirror blockquote,
.dark-theme .focus-prosemirror [data-type="details"],
.dark-theme .linked-task-block {
  border-color: #353d47;
  background: #1d232b;
}

.dark-theme .focus-slash-menu,
.dark-theme .focus-bubble {
  border-color: #353d47;
  background: #1d232b;
  color: #e1e5ea;
}

.dark-theme .focus-slash-menu > button {
  color: #e1e5ea;
}

.dark-theme .focus-slash-menu > button:hover,
.dark-theme .focus-slash-menu > button.selected {
  background: #29313b;
}

.dark-theme .focus-slash-icon {
  border-color: #3a424d;
  background: #252c35;
}

/* 颜色选择器 */
.focus-color-control {
  position: relative;
  display: inline-flex;
}

.focus-color-trigger {
  position: relative;
  display: inline-grid;
  place-items: center;
}

.focus-color-letter,
.focus-highlight-letter {
  font-size: 16px;
  font-weight: 600;
  line-height: 1;
}

.focus-highlight-letter {
  padding: 2px 3px;
  border-radius: 2px;
  background: #fff0a6;
}

.focus-color-indicator {
  position: absolute;
  right: 6px;
  bottom: 3px;
  left: 6px;
  height: 2px;
  border-radius: 2px;
}

.focus-color-menu {
  position: fixed;
  z-index: 15000;
  width: 224px;
  padding: 11px;
  border: 1px solid #e1e4e8;
  border-radius: 10px;
  background: #fff;
  box-shadow:
    0 12px 32px rgba(25, 30, 40, 0.16),
    0 2px 8px rgba(25, 30, 40, 0.06);
}

.focus-color-menu.is-bubble {
  position: fixed;
}

.focus-color-menu strong {
  display: block;
  margin: 0 0 9px 2px;
  color: #747b85;
  font-size: 11px;
  font-weight: 550;
}

.focus-color-grid {
  display: grid;
  grid-template-columns: repeat(5, 30px);
  gap: 7px;
}

.focus-color-grid .focus-color-swatch,
.focus-color-grid .focus-color-reset {
  width: 30px;
  min-width: 30px;
  height: 30px;
  padding: 0;
  border: 1px solid rgba(31, 35, 41, 0.12);
  border-radius: 7px;
}

.focus-color-grid .focus-color-swatch:hover,
.focus-color-grid .focus-color-swatch.selected {
  border-color: #4263eb;
  box-shadow: 0 0 0 2px rgba(66, 99, 235, 0.12);
}

.focus-color-grid .focus-color-reset {
  color: #747b85;
  font-size: 10px;
}

.focus-custom-color {
  display: flex;
  height: 34px;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
  padding: 0 3px;
  color: #747b85;
  font-size: 11px;
  cursor: pointer;
}

.focus-custom-color input {
  width: 30px;
  height: 24px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

/*
 * 折叠块采用纯文本披露结构：
 * 无边框、无底色、无分割线，仅保留箭头。
 */
.focus-prosemirror [data-type="details"],
.focus-prosemirror [data-type="details"]:hover,
.focus-prosemirror [data-type="details"].is-open,
.dark-theme .focus-prosemirror [data-type="details"],
.dark-theme .focus-prosemirror [data-type="details"]:hover,
.dark-theme .focus-prosemirror [data-type="details"].is-open {
  margin: 0.5em 0;
  padding: 0 0 0 28px;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.focus-prosemirror [data-type="details"] > button {
  top: 3px;
  left: 2px;
  width: 20px;
  height: 24px;
  border-radius: 4px;
}

.focus-prosemirror [data-type="details"] > button:hover {
  background: rgba(127, 133, 143, 0.12);
}

.focus-prosemirror [data-type="details"] summary,
.dark-theme .focus-prosemirror [data-type="details"] summary {
  min-height: 28px;
  padding: 0;
  color: inherit;
  font-weight: 550;
  line-height: 28px;
}

.focus-prosemirror
  [data-type="details"]
  [data-type="detailsContent"],
.dark-theme
  .focus-prosemirror
  [data-type="details"]
  [data-type="detailsContent"] {
  margin: 2px 0 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
}

.dark-theme .focus-color-menu {
  border-color: #353d47;
  background: #1d232b;
}

.dark-theme .focus-color-menu strong,
.dark-theme .focus-custom-color {
  color: #aeb5be;
}

.dark-theme .focus-color-grid .focus-color-reset {
  border-color: #404954;
  background: #252c35;
  color: #cbd0d7;
}

/*
 * 三栏窄宽度工具栏：
 * 历史操作交给系统快捷键，释放横向空间。
 */
.focus-editor-toolbar {
  min-height: 38px;
  gap: 2px;
  padding: 4px 6px;
}

.focus-editor-toolbar button,
.focus-editor-toolbar select {
  min-width: 28px;
  height: 28px;
  padding: 0 6px;
}

.focus-editor-toolbar select.focus-block-select {
  width: 66px;
  min-width: 66px;
  max-width: 66px;
}

.focus-editor-toolbar select.focus-size-select {
  width: 58px;
  min-width: 58px;
  max-width: 58px;
}

.focus-editor-toolbar .divider {
  margin: 0 2px;
}

/*
 * 文档中的关联事项只使用一行。
 */
.linked-task-block {
  min-height: 28px;
  gap: 7px;
  margin: 3px 0;
  padding: 2px 4px;
  border-radius: 5px;
}

.linked-task-check {
  width: 15px;
  height: 15px;
  flex: 0 0 15px;
  padding: 0;
  border-width: 1px;
  font-size: 9px;
  line-height: 13px;
}

.linked-task-main {
  display: block;
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: #454c55;
  font-size: 12px;
  line-height: 24px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.linked-task-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.linked-task-unlink {
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  padding: 0;
  border-radius: 5px;
  opacity: 0;
}

.linked-task-block:hover .linked-task-unlink,
.linked-task-unlink:focus-visible {
  opacity: 1;
}

.linked-task-unlink:hover {
  background: #e7eaee;
  color: #c84444;
}

/* 关联事项：正文等字号，穿透与解除操作仅在悬停时显现。 */
.linked-task-main,
.linked-task-title {
  min-width: 0;
  color: inherit;
  font: inherit;
  font-size: 14px;
  line-height: 1.55;
}

.linked-task-main {
  flex-direction: row;
  align-items: center;
}

.linked-task-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.linked-task-jump,
.linked-task-unlink {
  display: grid;
  width: 26px;
  height: 26px;
  flex: 0 0 26px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #9299a3;
  opacity: 0;
  cursor: pointer;
  transition:
    opacity 0.14s ease,
    color 0.14s ease,
    background-color 0.14s ease;
}

.linked-task-jump svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.45;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.linked-task-block:hover .linked-task-jump,
.linked-task-block:hover .linked-task-unlink,
.linked-task-jump:focus-visible,
.linked-task-unlink:focus-visible {
  opacity: 1;
}

.linked-task-jump:hover {
  background: #e9eefc;
  color: #4263eb;
}

.linked-task-unlink:hover {
  background: #fbecec;
  color: #c84444;
}

.dark-theme .linked-task-jump:hover {
  background: #29344d;
  color: #87a0ff;
}

.dark-theme .linked-task-unlink:hover {
  background: #44292d;
  color: #ef9292;
}



/* FOCUS CONTENT NEUTRAL SYSTEM
 * 关联事项完成态不使用删除线；
 * 引用块统一为低干扰灰色体系。
 */
.focus-editor
  .focus-prosemirror
  .linked-task-block.is-checked
  .linked-task-title {
  color: #7b828c;
  text-decoration: none !important;
}

.focus-editor
  .focus-prosemirror
  .linked-task-block.is-checked
  .linked-task-main {
  text-decoration: none !important;
}

.focus-editor
  .focus-prosemirror
  blockquote {
  margin: 0.85em 0;
  padding: 9px 14px;
  border: 0;
  border-left: 2px solid #b8bec7;
  border-radius: 0 5px 5px 0;
  background: #f4f5f6;
  color: #626a74;
  font-size: inherit;
  line-height: inherit;
}

.focus-editor
  .focus-prosemirror
  blockquote
  p {
  margin: 0.15em 0;
}

.dark-theme
  .focus-editor
  .focus-prosemirror
  blockquote {
  border-left-color: #59616c;
  background: #20252c;
  color: #aeb5be;
}

.dark-theme
  .focus-editor
  .focus-prosemirror
  .linked-task-block.is-checked
  .linked-task-title {
  color: #858d98;
  text-decoration: none !important;
}



/* FOCUS SLASH MENU DENSITY V2
 * Slash 菜单是工具选择器，不是内容展示卡片。
 */
:global(.focus-command-menu) {
  box-sizing: border-box;
  width: min(320px, calc(100vw - 24px)) !important;
  max-width: 320px !important;
  padding: 7px;
  border: 1px solid rgba(34, 39, 46, 0.11);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.985);
  box-shadow:
    0 18px 46px rgba(23, 28, 36, 0.15),
    0 3px 10px rgba(23, 28, 36, 0.07);
  backdrop-filter: blur(14px);
}

:global(.focus-command-header) {
  min-height: 30px;
  padding: 0 7px 6px;
  color: #969da6;
  font-size: 10px;
  font-weight: 450;
}

:global(.focus-command-header kbd) {
  padding: 1px 4px;
  border: 1px solid #dfe3e8;
  border-radius: 4px;
  background: #f7f8f9;
  color: #7c848e;
  font: inherit;
}

:global(.focus-command-scroll) {
  max-height: min(350px, calc(100vh - 140px));
  padding: 0 1px 2px;
  overscroll-behavior: contain;
}

:global(.focus-command-section) {
  padding: 3px 0;
}

:global(.focus-command-section + .focus-command-section) {
  margin-top: 3px;
  padding-top: 7px;
  border-top: 1px solid #eceef1;
}

:global(.focus-command-section-title) {
  min-height: 23px;
  padding: 4px 7px;
  color: #979ea8;
  font-size: 10px;
  font-weight: 560;
  letter-spacing: 0;
}

:global(.focus-command-list) {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

:global(.focus-command-item) {
  display: grid;
  width: 100%;
  min-height: 48px;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  padding: 5px 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #343a42;
  text-align: left;
  cursor: pointer;
}

:global(.focus-command-item:hover),
:global(.focus-command-item.is-selected) {
  background: #f0f2f5;
}

:global(.focus-command-item.is-selected) {
  box-shadow: inset 2px 0 0 #7288dc;
}

:global(.focus-command-icon) {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 1px solid #e0e4e8;
  border-radius: 8px;
  background: #fff;
  color: #4f5863;
  font-size: 14px;
  font-weight: 560;
}

:global(.focus-command-copy) {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

:global(.focus-command-copy strong) {
  overflow: hidden;
  color: #343a42;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:global(.focus-command-copy small) {
  overflow: hidden;
  color: #969da7;
  font-size: 11px;
  font-weight: 400;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:global(.focus-command-shortcut) {
  padding-left: 7px;
  color: #afb5bd;
  font-size: 10px;
  font-weight: 400;
}

:global(.focus-command-recent) {
  display: flex;
  gap: 5px;
  padding: 0 4px 4px;
}

:global(.focus-command-item.is-compact) {
  display: flex;
  width: auto;
  min-width: 0;
  min-height: 34px;
  flex: 1 1 0;
  gap: 6px;
  padding: 4px 7px;
  border: 1px solid #eceef1;
  background: #fafbfc;
}

:global(
  .focus-command-item.is-compact
  .focus-command-icon
) {
  width: 23px;
  height: 23px;
  flex: 0 0 23px;
  border: 0;
  background: transparent;
  font-size: 12px;
}

:global(.focus-command-compact-title) {
  overflow: hidden;
  color: #565e68;
  font-size: 11px;
  font-weight: 520;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:global(.focus-command-empty),
:global(.focus-command-loading) {
  padding: 24px 14px;
  color: #9299a3;
  font-size: 11px;
  text-align: center;
}

:global(.dark-theme .focus-command-menu) {
  border-color: #343d47;
  background: rgba(27, 32, 39, 0.985);
}

:global(
  .dark-theme
  .focus-command-section
  + .focus-command-section
) {
  border-color: #333b45;
}

:global(
  .dark-theme
  .focus-command-item:hover
),
:global(
  .dark-theme
  .focus-command-item.is-selected
) {
  background: #272e37;
}

:global(
  .dark-theme
  .focus-command-icon
) {
  border-color: #3a434d;
  background: #20262e;
  color: #cbd1d8;
}

:global(
  .dark-theme
  .focus-command-copy strong
) {
  color: #dce1e7;
}

:global(
  .dark-theme
  .focus-command-item.is-compact
) {
  border-color: #333b45;
  background: #20262e;
}

</style>


.focus-editor:not(.spacious) .focus-editor-toolbar {
  min-height: 40px;
  gap: 1px;
  padding: 4px 6px;
}

.focus-editor:not(.spacious) .focus-editor-toolbar button,
.focus-editor:not(.spacious) .focus-editor-toolbar select {
  min-width: 28px;
  height: 29px;
  padding-right: 6px;
  padding-left: 6px;
}

.focus-editor:not(.spacious) .focus-editor-toolbar select.focus-block-select {
  min-width: 76px;
  max-width: 92px;
}

.focus-editor:not(.spacious) .focus-editor-toolbar select.focus-size-select {
  min-width: 60px;
  max-width: 72px;
}

.dark-theme .linked-task-block:hover {
  background: #202730;
}
