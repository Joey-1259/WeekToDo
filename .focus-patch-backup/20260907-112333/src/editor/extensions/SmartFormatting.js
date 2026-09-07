import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

const pluginKey = new PluginKey("focusSmartFormatting");
const MAX_INDENT = 8;

const CHINESE_NUMBERS = [
  "一",
  "二",
  "三",
  "四",
  "五",
  "六",
  "七",
  "八",
  "九",
  "十",
];

function incrementChinese(value) {
  const index = CHINESE_NUMBERS.indexOf(value);
  return index >= 0 && index < CHINESE_NUMBERS.length - 1
    ? CHINESE_NUMBERS[index + 1]
    : null;
}

function incrementDecimalPath(value) {
  const parts = value.split(".").map(Number);

  if (
    !parts.length ||
    parts.some((item) => !Number.isFinite(item))
  ) {
    return null;
  }

  parts[parts.length - 1] += 1;
  return parts.join(".");
}

function nextMarker(text) {
  const value = String(text || "");

  const decimal = value.match(
    /^(\s*)(\d+(?:\.\d+)*)([.．、])\s+(.+)$/
  );

  if (decimal) {
    const next = incrementDecimalPath(decimal[2]);
    return next
      ? `${decimal[1]}${next}${decimal[3]} `
      : null;
  }

  const wrappedNumber = value.match(
    /^(\s*)([(（])(\d+)([)）])\s+(.+)$/
  );

  if (wrappedNumber) {
    return (
      `${wrappedNumber[1]}${wrappedNumber[2]}` +
      `${Number(wrappedNumber[3]) + 1}` +
      `${wrappedNumber[4]} `
    );
  }

  const rightNumber = value.match(
    /^(\s*)(\d+)([)）])\s+(.+)$/
  );

  if (rightNumber) {
    return (
      `${rightNumber[1]}${Number(rightNumber[2]) + 1}` +
      `${rightNumber[3]} `
    );
  }

  const chinese = value.match(
    /^(\s*)([一二三四五六七八九十])([、.．])\s+(.+)$/
  );

  if (chinese) {
    const next = incrementChinese(chinese[2]);
    return next
      ? `${chinese[1]}${next}${chinese[3]} `
      : null;
  }

  const wrappedChinese = value.match(
    /^(\s*)([(（])([一二三四五六七八九十])([)）])\s+(.+)$/
  );

  if (wrappedChinese) {
    const next = incrementChinese(wrappedChinese[3]);

    return next
      ? `${wrappedChinese[1]}${wrappedChinese[2]}` +
          `${next}${wrappedChinese[4]} `
      : null;
  }

  const alphabet = value.match(
    /^(\s*)([A-Za-z])([.．、)）])\s+(.+)$/
  );

  if (alphabet) {
    const code = alphabet[2].charCodeAt(0);
    const upper = alphabet[2] === alphabet[2].toUpperCase();
    const end = upper ? 90 : 122;

    if (code < end) {
      return (
        `${alphabet[1]}${String.fromCharCode(code + 1)}` +
        `${alphabet[3]} `
      );
    }
  }

  const wrappedAlphabet = value.match(
    /^(\s*)([(（])([A-Za-z])([)）])\s+(.+)$/
  );

  if (wrappedAlphabet) {
    const code = wrappedAlphabet[3].charCodeAt(0);
    const upper =
      wrappedAlphabet[3] === wrappedAlphabet[3].toUpperCase();
    const end = upper ? 90 : 122;

    if (code < end) {
      return (
        `${wrappedAlphabet[1]}${wrappedAlphabet[2]}` +
        `${String.fromCharCode(code + 1)}` +
        `${wrappedAlphabet[4]} `
      );
    }
  }

  return null;
}

function activeTextBlock(editor) {
  if (editor.isActive("heading")) return "heading";
  return "paragraph";
}

export default Extension.create({
  name: "focusSmartFormatting",
  priority: 120,

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
          const current = Number(
            editor.getAttributes(type).indent || 0
          );

          return commands.updateAttributes(type, {
            indent: Math.min(MAX_INDENT, current + 1),
          });
        },

      decreaseIndent:
        () =>
        ({ editor, commands }) => {
          const type = activeTextBlock(editor);
          const current = Number(
            editor.getAttributes(type).indent || 0
          );

          return commands.updateAttributes(type, {
            indent: Math.max(0, current - 1),
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

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: pluginKey,
      }),
    ];
  },
});
