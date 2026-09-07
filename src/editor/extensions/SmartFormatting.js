import { Extension } from "@tiptap/core";

const MAX_INDENT = 8;

const CHINESE_DIGITS = [
  "一", "二", "三", "四", "五",
  "六", "七", "八", "九", "十",
];

const CIRCLED_DIGITS = [
  "①", "②", "③", "④", "⑤",
  "⑥", "⑦", "⑧", "⑨", "⑩",
  "⑪", "⑫", "⑬", "⑭", "⑮",
  "⑯", "⑰", "⑱", "⑲", "⑳",
];

function nextArrayValue(values, current) {
  const index = values.indexOf(current);
  return index >= 0 && index < values.length - 1
    ? values[index + 1]
    : null;
}

function incrementDecimalPath(value) {
  const parts = String(value).split(".").map(Number);

  if (
    !parts.length ||
    parts.some((item) => !Number.isFinite(item))
  ) {
    return null;
  }

  parts[parts.length - 1] += 1;
  return parts.join(".");
}

function nextAlphabet(value) {
  if (!/^[A-Za-z]$/.test(value)) return null;

  const code = value.charCodeAt(0);
  const end = value === value.toUpperCase() ? 90 : 122;

  return code < end ? String.fromCharCode(code + 1) : null;
}

/**
 * 常见中文办公文档与笔记编号：
 * 1. / 1、 / 1) / （1）
 * 1.2.3. / 1.2.3、
 * 一、 / （一）
 * A. / a)
 * ① / ②
 */
function nextMarker(text) {
  const value = String(text || "");

  let match = value.match(
    /^(\s*)(\d+(?:\.\d+)*)([.．、])\s*(.+)$/
  );

  if (match) {
    const next = incrementDecimalPath(match[2]);

    return next
      ? `${match[1]}${next}${match[3]} `
      : null;
  }

  match = value.match(
    /^(\s*)([(（])(\d+)([)）])\s*(.+)$/
  );

  if (match) {
    return (
      `${match[1]}${match[2]}` +
      `${Number(match[3]) + 1}${match[4]} `
    );
  }

  match = value.match(/^(\s*)(\d+)([)）])\s*(.+)$/);

  if (match) {
    return (
      `${match[1]}${Number(match[2]) + 1}` +
      `${match[3]} `
    );
  }

  match = value.match(
    /^(\s*)([一二三四五六七八九十])([、.．])\s*(.+)$/
  );

  if (match) {
    const next = nextArrayValue(CHINESE_DIGITS, match[2]);

    return next
      ? `${match[1]}${next}${match[3]} `
      : null;
  }

  match = value.match(
    /^(\s*)([(（])([一二三四五六七八九十])([)）])\s*(.+)$/
  );

  if (match) {
    const next = nextArrayValue(CHINESE_DIGITS, match[3]);

    return next
      ? `${match[1]}${match[2]}${next}${match[4]} `
      : null;
  }

  match = value.match(
    /^(\s*)([A-Za-z])([.．、)）])\s*(.+)$/
  );

  if (match) {
    const next = nextAlphabet(match[2]);

    return next
      ? `${match[1]}${next}${match[3]} `
      : null;
  }

  match = value.match(
    /^(\s*)([(（])([A-Za-z])([)）])\s*(.+)$/
  );

  if (match) {
    const next = nextAlphabet(match[3]);

    return next
      ? `${match[1]}${match[2]}${next}${match[4]} `
      : null;
  }

  match = value.match(
    /^(\s*)([①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳])\s*(.+)$/
  );

  if (match) {
    const next = nextArrayValue(CIRCLED_DIGITS, match[2]);
    return next ? `${match[1]}${next} ` : null;
  }

  return null;
}

function activeTextBlock(editor) {
  return editor.isActive("heading")
    ? "heading"
    : "paragraph";
}

function currentIndent(editor) {
  const type = activeTextBlock(editor);
  return Number(editor.getAttributes(type).indent || 0);
}

export default Extension.create({
  name: "focusSmartFormatting",

  // 必须高于 StarterKit 默认键盘映射，
  // 保证 Backspace 优先执行缩进降级。
  priority: 1000,

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => {
              const value = Number(
                element.getAttribute("data-indent") || 0
              );

              return Math.max(
                0,
                Math.min(MAX_INDENT, value)
              );
            },
            renderHTML: ({ indent }) => {
              const value = Math.max(
                0,
                Math.min(MAX_INDENT, Number(indent || 0))
              );

              if (!value) return {};

              return {
                "data-indent": value,
                style: `margin-left: ${value * 2}em`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      increaseIndent:
        () =>
        ({ editor, commands }) => {
          const type = activeTextBlock(editor);

          return commands.updateAttributes(type, {
            indent: Math.min(
              MAX_INDENT,
              currentIndent(editor) + 1
            ),
          });
        },

      decreaseIndent:
        () =>
        ({ editor, commands }) => {
          const type = activeTextBlock(editor);

          return commands.updateAttributes(type, {
            indent: Math.max(
              0,
              currentIndent(editor) - 1
            ),
          });
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        if (this.editor.isActive("taskItem")) {
          return this.editor.commands.sinkListItem("taskItem");
        }

        if (this.editor.isActive("listItem")) {
          return this.editor.commands.sinkListItem("listItem");
        }

        return this.editor.commands.increaseIndent();
      },

      "Shift-Tab": () => {
        if (this.editor.isActive("taskItem")) {
          return this.editor.commands.liftListItem("taskItem");
        }

        if (this.editor.isActive("listItem")) {
          return this.editor.commands.liftListItem("listItem");
        }

        return this.editor.commands.decreaseIndent();
      },

      Backspace: () => {
        const { state } = this.editor;
        const { $from, empty } = state.selection;

        if (!empty || $from.parentOffset !== 0) {
          return false;
        }

        if (this.editor.isActive("taskItem")) {
          return this.editor.commands.liftListItem("taskItem");
        }

        if (this.editor.isActive("listItem")) {
          return this.editor.commands.liftListItem("listItem");
        }

        if (currentIndent(this.editor) > 0) {
          return this.editor.commands.decreaseIndent();
        }

        // 已经处于最小缩进时交回 StarterKit，
        // 此时才允许合并到上一行。
        return false;
      },

      Enter: () => {
        const { state } = this.editor;
        const { $from, empty } = state.selection;

        if (
          !empty ||
          !$from.parent.isTextblock ||
          $from.parentOffset !== $from.parent.content.size ||
          this.editor.isActive("listItem") ||
          this.editor.isActive("taskItem") ||
          this.editor.isActive("codeBlock")
        ) {
          return false;
        }

        const marker = nextMarker($from.parent.textContent);
        if (!marker) return false;

        return this.editor
          .chain()
          .splitBlock()
          .insertContent(marker)
          .run();
      },
    };
  },
});
