import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

/* FOCUS_FORMAT_PAINTER_20260909_V1 */

export const formatPainterKey = new PluginKey("focusFormatPainter");

/**
 * 可被格式刷复制的行内样式。
 * textStyle 承载颜色与字号（@tiptap/extension-text-style）。
 */
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
    return marks.filter((mark) =>
      PAINTABLE_MARKS.includes(mark.type.name)
    );
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

  return {
    type: node.type.name,
    attrs: { ...node.attrs },
  };
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
      if (mark.attrs?.color) labels.push("文字颜色");
      if (mark.attrs?.fontSize) labels.push("字号");
    }
  });

  if (sample.block?.type === "heading") {
    labels.push(`${sample.block.attrs?.level || 1} 级标题`);
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

function applySample(editor, sample, copyBlockStyle) {
  if (!editor || editor.isDestroyed || !sample) return false;

  const { state } = editor.view;
  const { from, to, empty } = state.selection;

  if (empty) return false;

  const tr = state.tr;

  PAINTABLE_MARKS.forEach((name) => {
    const type = state.schema.marks[name];
    if (type) tr.removeMark(from, to, type);
  });

  sample.marks.forEach((mark) => {
    const type = state.schema.marks[mark.type];
    if (!type) return;

    tr.addMark(from, to, type.create(mark.attrs || {}));
  });

  if (copyBlockStyle && sample.block) {
    const type = state.schema.nodes[sample.block.type];

    if (
      type &&
      type.isTextblock &&
      type.name !== "codeBlock" &&
      !state.selection.$from.parent.type.spec.code
    ) {
      try {
        tr.setBlockType(
          from,
          to,
          type,
          sample.block.attrs || {}
        );
      } catch (error) {
        // 跨越多种块类型时静默降级为仅刷行内样式。
      }
    }
  }

  tr.setMeta(formatPainterKey, { applied: true });
  editor.view.dispatch(tr);

  return true;
}

export const FormatPainter = Extension.create({
  name: "formatPainter",

  addOptions() {
    return {
      /** (state|null) => void，供工具栏同步高亮态。 */
      onChange: null,
      /** 是否连同段落/标题级别一起刷。 */
      copyBlockStyle: true,
    };
  },

  addStorage() {
    return {
      sample: null,
    };
  },

  onDestroy() {
    this.storage.sample = null;
  },

  addCommands() {
    const notify = () => {
      this.options.onChange?.(
        serializeSample(this.storage.sample)
      );
    };

    return {
      sampleFormat:
        (options = {}) =>
        ({ state }) => {
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
        () => {
          if (!this.storage.sample) return false;

          this.storage.sample = null;
          notify();
          return true;
        },

      applySampledFormat:
        () =>
        ({ editor }) => {
          const sample = this.storage.sample;
          if (!sample) return false;

          const applied = applySample(
            editor,
            sample,
            this.options.copyBlockStyle
          );

          if (applied && !sample.sticky) {
            this.storage.sample = null;
            notify();
          }

          return applied;
        },

      clearInlineFormat:
        () =>
        ({ state, dispatch }) => {
          const { from, to, empty } = state.selection;
          if (empty) return false;

          const tr = state.tr;

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

          dispatch?.(tr);
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Alt-c": () => this.editor.commands.sampleFormat(),
      "Mod-Alt-v": () =>
        this.editor.commands.applySampledFormat(),
      "Mod-\\": () =>
        this.editor.commands.clearInlineFormat(),
      Escape: () => this.editor.commands.stopFormatPainter(),
    };
  },

  addProseMirrorPlugins() {
    const extension = this;

    const scheduleApply = () => {
      if (!extension.storage.sample) return;

      setTimeout(() => {
        const editor = extension.editor;

        if (!editor || editor.isDestroyed) return;
        if (editor.state.selection.empty) return;

        editor.commands.applySampledFormat();
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
              if (event.shiftKey || event.key === "Shift") {
                scheduleApply();
              }

              return false;
            },
          },
        },
      }),
    ];
  },
});

export default FormatPainter;
