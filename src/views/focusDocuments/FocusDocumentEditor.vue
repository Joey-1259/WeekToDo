<template>
  <div class="focus-editor-shell">
    <div class="focus-editor-toolbar">
      <button
        type="button"
        :class="{ active: editor?.isActive('bold') }"
        title="粗体"
        @click="editor?.chain().focus().toggleBold().run()"
      >
        <i class="bi-type-bold"></i>
      </button>

      <button
        type="button"
        :class="{ active: editor?.isActive('italic') }"
        title="斜体"
        @click="editor?.chain().focus().toggleItalic().run()"
      >
        <i class="bi-type-italic"></i>
      </button>

      <button
        type="button"
        :class="{
          active: editor?.isActive(
            'heading',
            { level: 2 }
          )
        }"
        title="标题"
        @click="
          editor
            ?.chain()
            .focus()
            .toggleHeading({ level: 2 })
            .run()
        "
      >
        H2
      </button>

      <button
        type="button"
        :class="{
          active: editor?.isActive('bulletList')
        }"
        title="无序列表"
        @click="
          editor
            ?.chain()
            .focus()
            .toggleBulletList()
            .run()
        "
      >
        <i class="bi-list-ul"></i>
      </button>

      <button
        type="button"
        :class="{
          active: editor?.isActive('taskList')
        }"
        title="清单"
        @click="
          editor
            ?.chain()
            .focus()
            .toggleTaskList()
            .run()
        "
      >
        <i class="bi-list-check"></i>
      </button>

      <span class="editor-save-state">
        {{ saveStateText }}
      </span>
    </div>

    <div class="focus-editor-area">
      <editor-content
        v-if="editor"
        :editor="editor"
      />

      <div
        v-if="slashVisible"
        class="slash-command-menu"
      >
        <button
          v-for="(item, index) in filteredCommands"
          :key="item.id"
          type="button"
          :class="{ active: index === slashIndex }"
          @mousedown.prevent="runSlashCommand(item)"
        >
          <i :class="item.icon"></i>

          <span>
            <strong>{{ item.label }}</strong>
            <small>{{ item.description }}</small>
          </span>
        </button>

        <div
          v-if="filteredCommands.length === 0"
          class="slash-empty"
        >
          没有匹配的命令
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {
  Editor,
  EditorContent,
  Node,
  mergeAttributes,
} from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";

const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      tone: {
        default: "info",
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-callout]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(
        HTMLAttributes,
        {
          "data-callout":
            HTMLAttributes.tone || "info",
        }
      ),
      0,
    ];
  },
});

const ToggleSummary = Node.create({
  name: "toggleSummary",
  group: "block",
  content: "inline*",
  defining: true,

  parseHTML() {
    return [{ tag: "summary" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "summary",
      mergeAttributes(HTMLAttributes),
      0,
    ];
  },
});

const ToggleDetails = Node.create({
  name: "toggleDetails",
  group: "block",
  content: "toggleSummary block+",
  defining: true,

  parseHTML() {
    return [{ tag: "details" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "details",
      mergeAttributes(HTMLAttributes),
      0,
    ];
  },
});

export default {
  name: "FocusDocumentEditor",

  components: {
    EditorContent,
  },

  props: {
    documentData: {
      type: Object,
      required: true,
    },
  },

  emits: ["save"],

  data() {
    return {
      editor: null,
      saveTimer: null,
      saveState: "saved",
      slashVisible: false,
      slashQuery: "",
      slashRange: null,
      slashIndex: 0,
    };
  },

  computed: {
    saveStateText() {
      const labels = {
        saved: "已保存",
        waiting: "等待保存",
        saving: "正在保存…",
        error: "保存失败",
      };

      return labels[this.saveState] || "";
    },

    slashCommands() {
      return [
        {
          id: "text",
          label: "正文",
          keywords: "正文 text paragraph",
          description: "普通文本段落",
          icon: "bi-text-paragraph",
          action: () =>
            this.editor
              .chain()
              .focus()
              .setParagraph()
              .run(),
        },
        {
          id: "h2",
          label: "大标题",
          keywords: "标题 h2 heading",
          description: "二级标题",
          icon: "bi-type-h2",
          action: () =>
            this.editor
              .chain()
              .focus()
              .setHeading({ level: 2 })
              .run(),
        },
        {
          id: "h3",
          label: "小标题",
          keywords: "小标题 h3 heading",
          description: "三级标题",
          icon: "bi-type-h3",
          action: () =>
            this.editor
              .chain()
              .focus()
              .setHeading({ level: 3 })
              .run(),
        },
        {
          id: "bullet",
          label: "无序列表",
          keywords: "无序 列表 bullet",
          description: "项目符号列表",
          icon: "bi-list-ul",
          action: () =>
            this.editor
              .chain()
              .focus()
              .toggleBulletList()
              .run(),
        },
        {
          id: "ordered",
          label: "有序列表",
          keywords: "有序 编号 number",
          description: "数字编号列表",
          icon: "bi-list-ol",
          action: () =>
            this.editor
              .chain()
              .focus()
              .toggleOrderedList()
              .run(),
        },
        {
          id: "check",
          label: "清单",
          keywords: "清单 检查 checkbox task",
          description: "仅存在于文档中的检查项",
          icon: "bi-list-check",
          action: () =>
            this.editor
              .chain()
              .focus()
              .toggleTaskList()
              .run(),
        },
        {
          id: "quote",
          label: "引用",
          keywords: "引用 quote",
          description: "引用一段内容",
          icon: "bi-quote",
          action: () =>
            this.editor
              .chain()
              .focus()
              .toggleBlockquote()
              .run(),
        },
        {
          id: "toggle",
          label: "折叠块",
          keywords: "折叠 展开 toggle details",
          description: "可展开和收起的内容",
          icon: "bi-chevron-right",
          action: () =>
            this.insertToggle(),
        },
        {
          id: "info",
          label: "信息块",
          keywords: "信息 蓝色 info",
          description: "背景资料或一般说明",
          icon: "bi-info-circle",
          action: () =>
            this.insertCallout("info"),
        },
        {
          id: "warning",
          label: "注意块",
          keywords: "注意 黄色 warning",
          description: "需要特别关注",
          icon: "bi-exclamation-circle",
          action: () =>
            this.insertCallout("warning"),
        },
        {
          id: "danger",
          label: "风险块",
          keywords: "风险 红色 danger",
          description: "风险或阻塞",
          icon: "bi-exclamation-triangle",
          action: () =>
            this.insertCallout("danger"),
        },
        {
          id: "success",
          label: "结论块",
          keywords: "结论 绿色 success",
          description: "已确认的结论",
          icon: "bi-check-circle",
          action: () =>
            this.insertCallout("success"),
        },
        {
          id: "divider",
          label: "分割线",
          keywords: "分割线 divider horizontal",
          description: "分隔不同内容",
          icon: "bi-dash-lg",
          action: () =>
            this.editor
              .chain()
              .focus()
              .setHorizontalRule()
              .run(),
        },
      ];
    },

    filteredCommands() {
      const query = String(
        this.slashQuery || ""
      ).toLocaleLowerCase();

      return this.slashCommands.filter(
        (item) =>
          `${item.label} ${item.keywords}`
            .toLocaleLowerCase()
            .includes(query)
      );
    },
  },

  watch: {
    "documentData.id"() {
      this.loadDocument();
    },
  },

  mounted() {
    this.createEditor();
  },

  beforeUnmount() {
    this.flushSave();

    if (this.editor) {
      this.editor.destroy();
      this.editor = null;
    }
  },

  methods: {
    createEditor() {
      this.editor = new Editor({
        content:
          this.documentData.content || {
            type: "doc",
            content: [
              { type: "paragraph" },
            ],
          },

        extensions: [
          StarterKit.configure({
            heading: {
              levels: [2, 3],
            },
          }),
          Placeholder.configure({
            placeholder:
              "输入内容，或在空行输入 / 插入内容块…",
          }),
          TaskList,
          TaskItem.configure({
            nested: true,
          }),
          Callout,
          ToggleSummary,
          ToggleDetails,
        ],

        editorProps: {
          attributes: {
            class: "focus-prosemirror",
          },

          handleKeyDown: (view, event) => {
            if (!this.slashVisible) {
              return false;
            }

            if (event.key === "ArrowDown") {
              event.preventDefault();

              this.slashIndex =
                (this.slashIndex + 1) %
                Math.max(
                  this.filteredCommands.length,
                  1
                );

              return true;
            }

            if (event.key === "ArrowUp") {
              event.preventDefault();

              this.slashIndex =
                (
                  this.slashIndex -
                  1 +
                  Math.max(
                    this.filteredCommands.length,
                    1
                  )
                ) %
                Math.max(
                  this.filteredCommands.length,
                  1
                );

              return true;
            }

            if (event.key === "Enter") {
              const item =
                this.filteredCommands[
                  this.slashIndex
                ];

              if (item) {
                event.preventDefault();
                this.runSlashCommand(item);
                return true;
              }
            }

            if (event.key === "Escape") {
              this.slashVisible = false;
              return true;
            }

            return false;
          },
        },

        onUpdate: ({ editor }) => {
          this.detectSlash(editor);
          this.scheduleSave();
        },

        onSelectionUpdate: ({ editor }) => {
          this.detectSlash(editor);
        },
      });
    },

    loadDocument() {
      if (!this.editor) {
        return;
      }

      clearTimeout(this.saveTimer);

      this.editor.commands.setContent(
        this.documentData.content || {
          type: "doc",
          content: [
            { type: "paragraph" },
          ],
        },
        { emitUpdate: false }
      );

      this.saveState = "saved";
      this.slashVisible = false;
    },

    detectSlash(editor) {
      const { $from } =
        editor.state.selection;

      if (!$from.parent.isTextblock) {
        this.slashVisible = false;
        return;
      }

      const text =
        $from.parent.textBetween(
          0,
          $from.parentOffset,
          "",
          ""
        );

      if (!text.startsWith("/")) {
        this.slashVisible = false;
        return;
      }

      this.slashQuery = text.slice(1);
      this.slashRange = {
        from: $from.start(),
        to: $from.pos,
      };
      this.slashIndex = 0;
      this.slashVisible = true;
    },

    clearSlashText() {
      if (!this.slashRange) {
        return;
      }

      this.editor
        .chain()
        .focus()
        .deleteRange(this.slashRange)
        .run();
    },

    runSlashCommand(item) {
      this.clearSlashText();
      this.slashVisible = false;
      this.slashQuery = "";
      this.slashRange = null;

      item.action();
    },

    insertCallout(tone) {
      this.editor
        .chain()
        .focus()
        .insertContent({
          type: "callout",
          attrs: { tone },
          content: [
            {
              type: "paragraph",
            },
          ],
        })
        .run();
    },

    insertToggle() {
      this.editor
        .chain()
        .focus()
        .insertContent({
          type: "toggleDetails",
          content: [
            {
              type: "toggleSummary",
              content: [
                {
                  type: "text",
                  text: "折叠标题",
                },
              ],
            },
            {
              type: "paragraph",
            },
          ],
        })
        .run();
    },

    scheduleSave() {
      clearTimeout(this.saveTimer);
      this.saveState = "waiting";

      this.saveTimer = setTimeout(
        () => this.flushSave(),
        700
      );
    },

    async flushSave() {
      clearTimeout(this.saveTimer);

      if (!this.editor) {
        return;
      }

      this.saveState = "saving";

      try {
        await this.$emit("save", {
          content: this.editor.getJSON(),
          plainText: this.editor.getText(),
        });

        this.saveState = "saved";
      } catch (error) {
        console.error(
          "[focus-editor] 保存失败：",
          error
        );

        this.saveState = "error";
      }
    },
  },
};
</script>

<style lang="scss">
.focus-editor-shell {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
}

.focus-editor-toolbar {
  display: flex;
  align-items: center;
  min-height: 38px;
  padding: 4px 10px;
  border-bottom: 1px solid #e5e7eb;
  gap: 3px;
}

.focus-editor-toolbar button {
  width: 29px;
  height: 29px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #57606a;
}

.focus-editor-toolbar button:hover,
.focus-editor-toolbar button.active {
  background: #eef1ff;
  color: #4263eb;
}

.editor-save-state {
  margin-left: auto;
  color: #8c959f;
  font-size: 11px;
}

.focus-editor-area {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.focus-prosemirror {
  min-height: 100%;
  padding: 16px 18px 100px;
  color: #24292f;
  font-size: 14px;
  line-height: 1.75;
  outline: none;
}

.focus-prosemirror p {
  margin: 0 0 8px;
}

.focus-prosemirror h2 {
  margin: 22px 0 9px;
  font-size: 21px;
}

.focus-prosemirror h3 {
  margin: 18px 0 8px;
  font-size: 17px;
}

.focus-prosemirror p.is-editor-empty:first-child::before {
  float: left;
  height: 0;
  color: #a0a7b0;
  content: attr(data-placeholder);
  pointer-events: none;
}

.focus-prosemirror blockquote {
  margin: 12px 0;
  padding: 3px 14px;
  border-left: 3px solid #9aa5b1;
  color: #57606a;
}

.focus-prosemirror ul[data-type="taskList"] {
  padding-left: 0;
  list-style: none;
}

.focus-prosemirror ul[data-type="taskList"] li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.focus-prosemirror ul[data-type="taskList"] li > div {
  flex: 1;
}

.focus-prosemirror [data-callout] {
  margin: 12px 0;
  padding: 11px 13px;
  border-radius: 7px;
  border-left: 4px solid #4c6ef5;
  background: #eef3ff;
}

.focus-prosemirror [data-callout="warning"] {
  border-left-color: #f59f00;
  background: #fff8db;
}

.focus-prosemirror [data-callout="danger"] {
  border-left-color: #e03131;
  background: #fff0f0;
}

.focus-prosemirror [data-callout="success"] {
  border-left-color: #2f9e44;
  background: #ebfbee;
}

.focus-prosemirror details {
  margin: 12px 0;
  padding: 9px 12px;
  border: 1px solid #dfe3e8;
  border-radius: 7px;
}

.focus-prosemirror summary {
  cursor: pointer;
  font-weight: 600;
}

.slash-command-menu {
  position: absolute;
  z-index: 20;
  top: 12px;
  left: 18px;
  width: 270px;
  max-height: 360px;
  padding: 6px;
  overflow-y: auto;
  border: 1px solid #dfe3e8;
  border-radius: 9px;
  background: #fff;
  box-shadow: 0 10px 30px rgba(31, 35, 40, 0.16);
}

.slash-command-menu button {
  display: flex;
  width: 100%;
  padding: 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  text-align: left;
  gap: 10px;
}

.slash-command-menu button:hover,
.slash-command-menu button.active {
  background: #f1f3f5;
}

.slash-command-menu button i {
  width: 22px;
  color: #4263eb;
  font-size: 17px;
}

.slash-command-menu button span {
  display: flex;
  flex-direction: column;
}

.slash-command-menu small {
  color: #8c959f;
}

.slash-empty {
  padding: 12px;
  color: #8c959f;
  text-align: center;
}

.dark-theme .focus-editor-toolbar {
  border-bottom-color: #30363d;
}

.dark-theme .focus-editor-toolbar button {
  color: #9da7b3;
}

.dark-theme .focus-editor-toolbar button:hover,
.dark-theme .focus-editor-toolbar button.active {
  background: #212b40;
  color: #8ea6ff;
}

.dark-theme .focus-prosemirror {
  color: #c9d1d9;
}

.dark-theme .focus-prosemirror blockquote {
  color: #9da7b3;
  border-left-color: #6e7681;
}

.dark-theme .focus-prosemirror [data-callout] {
  background: rgba(76, 110, 245, 0.12);
}

.dark-theme .focus-prosemirror [data-callout="warning"] {
  background: rgba(245, 159, 0, 0.12);
}

.dark-theme .focus-prosemirror [data-callout="danger"] {
  background: rgba(224, 49, 49, 0.12);
}

.dark-theme .focus-prosemirror [data-callout="success"] {
  background: rgba(47, 158, 68, 0.12);
}

.dark-theme .focus-prosemirror details {
  border-color: #30363d;
}

.dark-theme .slash-command-menu {
  border-color: #30363d;
  background: #1c2128;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
}

.dark-theme .slash-command-menu button {
  color: #c9d1d9;
}

.dark-theme .slash-command-menu button:hover,
.dark-theme .slash-command-menu button.active {
  background: #262c36;
}
</style>
