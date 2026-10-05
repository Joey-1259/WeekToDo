import {
  Node,
  createBlockMarkdownSpec,
} from "@tiptap/core";
import { VueNodeViewRenderer } from "@tiptap/vue-3";
import FocusCalloutNodeView from "../../views/focusDocuments/FocusCalloutNodeView.vue";

export const CALLOUT_PRESETS = Object.freeze({
  info: {
    label: "信息",
    icon: "ℹ",
    background: "#eaf2ff",
    border: "#b9cff5",
    wordFill: "EAF2FF",
  },
  tip: {
    label: "提示",
    icon: "✦",
    background: "#f2edff",
    border: "#d0c3ef",
    wordFill: "F2EDFF",
  },
  success: {
    label: "成功",
    icon: "✓",
    background: "#eaf6ee",
    border: "#b8dcc5",
    wordFill: "EAF6EE",
  },
  warning: {
    label: "注意",
    icon: "!",
    background: "#fff4d9",
    border: "#ead294",
    wordFill: "FFF4D9",
  },
  danger: {
    label: "重要",
    icon: "!",
    background: "#ffeded",
    border: "#edbcbc",
    wordFill: "FFEDED",
  },
});

export function normalizeCalloutTone(value) {
  return Object.hasOwn(CALLOUT_PRESETS, value) ? value : "info";
}

export default Node.create({
  name: "focusCallout",
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      tone: {
        default: "info",
        parseHTML: (element) =>
          normalizeCalloutTone(element.getAttribute("data-tone")),
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'aside[data-type="focus-callout"]' }];
  },

  renderHTML({ node }) {
    const tone = normalizeCalloutTone(node.attrs.tone);
    return [
      "aside",
      {
        "data-type": "focus-callout",
        "data-tone": tone,
        class: `focus-callout is-${tone}`,
      },
      0,
    ];
  },

  ...createBlockMarkdownSpec({
    nodeName: "focusCallout",
    defaultAttributes: { tone: "info" },
    allowedAttributes: ["tone"],
    content: "block",
  }),

  addCommands() {
    return {
      insertFocusCallout:
        (attributes = {}) =>
        ({ editor, commands }) => {
          if (editor.isActive(this.name)) return false;

          const tone = normalizeCalloutTone(attributes.tone);

          if (!editor.state.selection.empty) {
            return commands.wrapIn(this.name, { tone });
          }

          return commands.insertContent({
            type: this.name,
            attrs: { tone },
            content: [{ type: "paragraph" }],
          });
        },

      unwrapFocusCallout:
        () =>
        ({ commands }) =>
          commands.lift(this.name),
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Enter": () => {
        const { state } = this.editor;
        const { $from } = state.selection;

        for (let depth = $from.depth; depth > 0; depth--) {
          if ($from.node(depth).type.name !== this.name) continue;

          const position = $from.after(depth);

          return this.editor
            .chain()
            .insertContentAt(position, { type: "paragraph" })
            .setTextSelection(position + 1)
            .focus()
            .run();
        }

        return false;
      },
    };
  },

  addNodeView() {
    return VueNodeViewRenderer(FocusCalloutNodeView);
  },
});
