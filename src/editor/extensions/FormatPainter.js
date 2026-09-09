import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

/* FOCUS_UI_SYSTEM_20260909_V4 */

/**
 * 关键修复（原实现会必现 RangeError: Applying a mismatched transaction）：
 *
 * 旧版在 applySampledFormat 命令体内部直接调用了 editor.view.dispatch(tr)。
 * 但 tiptap 的 CommandManager 在调用命令之前就已经从当时的 state 建好了自己的
 * transaction，命令返回 true 之后它会再 dispatch 一次。第一次手动 dispatch 改了
 * 文档，第二次那个 tr 的 tr.before 就和最新的 state.doc 对不上，
 * ProseMirror 的 EditorState.applyInner 直接抛 RangeError。
 *
 * 现在所有写操作都只往 tiptap 传进来的 tr 上叠加，由 CommandManager 统一派发，
 * 全程只有一个事务。
 */

export const formatPainterKey = new PluginKey("focusFormatPainter");

export const PAINTABLE_MARKS = [
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
  "highlight",
  "textStyle",
];

const MARK_LABELS = {
  bold: "加粗",
  italic: "斜体",
  underline: "下划线",
  strike: "删除线",
  code: "行内代码",
  highlight: "高亮",
};

function collectMarks(state) {
  const { empty, from, to, $from } = state.selection;

  if (empty) {
    const marks = state.storedMarks || $from.marks();
    return marks.filter((mark) => PAINTABLE_MARKS.includes(mark.type.name));
  }

  let found = null;

  state.doc.nodesBetween(from, to, (node) => {
    if (found || !node.isText) return;
    found = node.marks;
  });

  return (found || $from.marks()).filter((mark) =>
    PAINTABLE_MARKS.includes(mark.type.name)
  );
}

function collectBlock(state) {
  const node = state.selection.$from.parent;

  if (!node || !node.isTextblock) return null;

  return { type: node.type.name, attrs: { ...node.attrs } };
}

function describeSample(sample) {
  if (!sample) return "";

  const labels = [];

  sample.marks.forEach((mark) => {
    if (MARK_LABELS[mark.type]) {
      labels.push(MARK_LABELS[mark.type]);
      return;
    }

    if (mark.type === "textStyle") {
      if (mark.attrs && mark.attrs.color) labels.push("文字颜色");
      if (mark.attrs && mark.attrs.fontSize) labels.push("字号");
    }
  });

  if (sample.block && sample.block.type === "heading") {
    labels.push(((sample.block.attrs || {}).level || 1) + " 级标题");
  }

  return labels.length ? labels.join(" · ") : "默认样式";
}

function serializeSample(sample) {
  if (!sample) return null;

  return {
    sticky: Boolean(sample.sticky),
    summary: describeSample(sample),
    marks: sample.marks.map((mark) => ({
      type: mark.type,
      attrs: { ...mark.attrs },
    })),
    block: sample.block ? { ...sample.block } : null,
  };
}

export const FormatPainter = Extension.create({
  name: "formatPainter",

  addOptions() {
    return {
      /** (state|null) => void，供工具栏同步高亮态。 */
      onChange: null,
      /** 是否连同段落 / 标题级别一起刷。 */
      copyBlockStyle: true,
    };
  },

  addStorage() {
    return { sample: null };
  },

  onDestroy() {
    this.storage.sample = null;
  },

  addCommands() {
    const notify = () => {
      if (typeof this.options.onChange === "function") {
        this.options.onChange(serializeSample(this.storage.sample));
      }
    };

    return {
      sampleFormat:
        (options = {}) =>
        ({ state, dispatch }) => {
          // dispatch 为空说明是 editor.can() 的干跑，不能改 storage。
          if (!dispatch) return true;

          this.storage.sample = {
            marks: collectMarks(state).map((mark) => ({
              type: mark.type.name,
              attrs: { ...mark.attrs },
            })),
            block: collectBlock(state),
            sticky: Boolean(options.sticky),
          };

          notify();
          return true;
        },

      stopFormatPainter:
        () =>
        ({ dispatch }) => {
          if (!this.storage.sample) return false;
          if (!dispatch) return true;

          this.storage.sample = null;
          notify();
          return true;
        },

      applySampledFormat:
        () =>
        ({ tr, state, dispatch }) => {
          const sample = this.storage.sample;

          if (!sample) return false;

          const { from, to, empty } = state.selection;

          if (empty) return false;
          if (!dispatch) return true;

          PAINTABLE_MARKS.forEach((name) => {
            const type = state.schema.marks[name];
            if (type) tr.removeMark(from, to, type);
          });

          sample.marks.forEach((mark) => {
            const type = state.schema.marks[mark.type];
            if (!type) return;

            tr.addMark(from, to, type.create(mark.attrs || {}));
          });

          if (this.options.copyBlockStyle && sample.block) {
            const type = state.schema.nodes[sample.block.type];

            const canConvert =
              type &&
              type.isTextblock &&
              type.name !== "codeBlock" &&
              !state.selection.$from.parent.type.spec.code;

            if (canConvert) {
              try {
                tr.setBlockType(from, to, type, sample.block.attrs || {});
              } catch (error) {
                // 选区跨越多种块类型时，静默降级为只刷行内样式。
              }
            }
          }

          tr.setMeta(formatPainterKey, { applied: true });

          if (!sample.sticky) {
            this.storage.sample = null;
            notify();
          }

          return true;
        },

      clearInlineFormat:
        () =>
        ({ tr, state, dispatch }) => {
          const { from, to, empty } = state.selection;

          if (empty) return false;
          if (!dispatch) return true;

          PAINTABLE_MARKS.forEach((name) => {
            const type = state.schema.marks[name];
            if (type) tr.removeMark(from, to, type);
          });

          const link = state.schema.marks.link;
          if (link) tr.removeMark(from, to, link);

          const paragraph = state.schema.nodes.paragraph;

          if (paragraph) {
            try {
              tr.setBlockType(from, to, paragraph);
            } catch (error) {
              // 选区内含代码块等不可转换节点时忽略。
            }
          }

          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Alt-c": () => this.editor.commands.sampleFormat(),
      "Mod-Alt-v": () => this.editor.commands.applySampledFormat(),
      "Mod-\\": () => this.editor.commands.clearInlineFormat(),
      Escape: () => this.editor.commands.stopFormatPainter(),
    };
  },

  addProseMirrorPlugins() {
    const extension = this;

    const scheduleApply = () => {
      if (!extension.storage.sample) return;

      // 等浏览器把这次选区确定下来再套用，命令内部会重新取最新 state。
      setTimeout(() => {
        const editor = extension.editor;

        if (!editor || editor.isDestroyed) return;
        if (!extension.storage.sample) return;
        if (editor.state.selection.empty) return;

        try {
          editor.commands.applySampledFormat();
        } catch (error) {
          // 任何异常都不应该让整个编辑器崩掉，退出格式刷即可。
          console.error("[FormatPainter] 套用样式失败：", error);
          extension.storage.sample = null;

          if (typeof extension.options.onChange === "function") {
            extension.options.onChange(null);
          }
        }
      }, 0);
    };

    return [
      new Plugin({
        key: formatPainterKey,

        props: {
          handleDOMEvents: {
            mouseup: () => {
              scheduleApply();
              return false;
            },

            keyup: (_view, event) => {
              if (event.shiftKey || event.key === "Shift") scheduleApply();
              return false;
            },
          },
        },
      }),
    ];
  },
});

export default FormatPainter;
