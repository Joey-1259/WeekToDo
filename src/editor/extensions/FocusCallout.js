/* FOCUS_EXPERIENCE_20261005_V2 */
import {
  Node,
  createBlockMarkdownSpec,
} from "@tiptap/core";
import { VueNodeViewRenderer } from "@tiptap/vue-3";
import FocusCalloutNodeView from "../../views/focusDocuments/FocusCalloutNodeView.vue";

import {
  CALLOUT_PRESETS,
  normalizeCalloutTone,
  normalizeCalloutColor,
  getCalloutPresentation,
  readCalloutPreference,
} from "../../services/focusCalloutPresentation.mjs";

export {
  CALLOUT_PRESETS,
  normalizeCalloutTone,
  normalizeCalloutColor,
};

export default Node.create({
  name: "focusCallout",
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,
  priority: 1100,

  addAttributes() {
    return {
      tone: {
        default: "info",
        parseHTML: (element) =>
          normalizeCalloutTone(element.getAttribute("data-tone")),
        renderHTML: () => ({}),
      },
      color: {
        default: "default",
        parseHTML: (element) =>
          normalizeCalloutColor(element.getAttribute("data-color")),
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'aside[data-type="focus-callout"]' }];
  },

  renderHTML({ node }) {
    const tone = normalizeCalloutTone(node.attrs.tone);
    const color = normalizeCalloutColor(node.attrs.color);
    const palette = getCalloutPresentation(tone, color);

    return [
      "aside",
      {
        "data-type": "focus-callout",
        "data-tone": tone,
        "data-color": color,
        class: `focus-callout is-${tone}`,
        style:
          `background:${palette.background};` +
          `border:1px solid ${palette.border};` +
          "border-radius:8px;padding:14px 16px;color:#29313d;",
      },
      0,
    ];
  },

  ...createBlockMarkdownSpec({
    nodeName: "focusCallout",
    defaultAttributes: { tone: "info", color: "default" },
    allowedAttributes: ["tone", "color"],
    content: "block",
  }),

  addCommands() {
    return {
      insertFocusCallout:
        (attributes = {}) =>
        ({ editor, commands }) => {
          if (editor.isActive(this.name)) return false;

          const preference = readCalloutPreference();
          const attrs = {
            tone: normalizeCalloutTone(attributes.tone ?? preference.tone),
            color: normalizeCalloutColor(attributes.color ?? preference.color),
          };

          if (!editor.state.selection.empty) {
            return commands.wrapIn(this.name, attrs);
          }

          return commands.insertContent({
            type: this.name,
            attrs,
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
      Enter: () => {
        const { state } = this.editor;
        const { $from, empty } = state.selection;

        if (
          !empty ||
          this.editor.isActive(this.name) ||
          $from.parent.type.name !== "paragraph" ||
          $from.parentOffset !== $from.parent.content.size
        ) {
          return false;
        }

        const matched = $from.parent.textContent.match(
          /^:::(info|warning|success|danger|tips|tip)?$/
        );

        if (!matched) return false;

        const preference = readCalloutPreference();
        const from = $from.before();
        const to = $from.after();

        return this.editor
          .chain()
          .insertContentAt({ from, to }, {
            type: this.name,
            attrs: {
              tone: matched[1]
                ? normalizeCalloutTone(matched[1])
                : preference.tone,
              color: preference.color,
            },
            content: [{ type: "paragraph" }],
          })
          .setTextSelection(from + 2)
          .run();
      },

      "Mod-Enter": () => {
        const { $from } = this.editor.state.selection;

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
