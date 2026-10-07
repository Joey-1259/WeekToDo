/*
 * 高亮块（参考语雀）：一个入口 + 一个属性（背景色）。
 *
 * · 节点不声明 priority：否则它会成为 doc 的默认块，TrailingNode 会在文末
 *   追加零内容高亮块（无法输入 / setNodeMarkup 抛 RangeError）。
 * · 转为正文不用 liftTarget：它遇到 isolating 节点即返回 null。
 *   改为用块内容直接替换整个块，替换前 canReplace 校验。
 * · 退格（块内首行行首）：整块为空 → 删除整块；有缩进 → 交给 SmartFormatting；
 *   首行为空且后面有内容 → 只删空行；否则 → 转为正文。
 */
import { Extension, Node, createBlockMarkdownSpec } from "@tiptap/core";
import { Plugin, PluginKey, Selection, TextSelection } from "@tiptap/pm/state";
import { findWrapping } from "@tiptap/pm/transform";
import { VueNodeViewRenderer } from "@tiptap/vue-3";
import FocusCalloutNodeView from "../../views/focusDocuments/FocusCalloutNodeView.vue";

import {
  CALLOUT_PRESETS,
  normalizeCalloutTone,
  normalizeCalloutColor,
  resolveCalloutColor,
  getCalloutPresentation,
  readCalloutPreference,
} from "../../services/focusCalloutPresentation.mjs";

export { CALLOUT_PRESETS, normalizeCalloutTone, normalizeCalloutColor };

const NAME = "focusCallout";
const TRIGGER = /^:::(info|warning|success|danger|tips|tip)?$/i;
const repairKey = new PluginKey("focusCalloutRepair");

function buildAttrs(attributes = {}) {
  const tone = normalizeCalloutTone(attributes.tone);
  const requested =
    attributes.color === undefined ? readCalloutPreference().color : attributes.color;
  return { tone, color: resolveCalloutColor(tone, requested) };
}

function isValidCallout(node) {
  return node.childCount > 0 && node.type.validContent(node.content);
}

function isBlankCallout(node) {
  let blank = true;
  node.forEach((child) => {
    if (!child.isTextblock || child.content.size > 0) blank = false;
  });
  return blank;
}

function findCallout(state, pos) {
  if (Number.isInteger(pos)) {
    const node = state.doc.nodeAt(pos);
    return node && node.type.name === NAME ? { pos, node } : null;
  }

  const { selection } = state;
  if (selection.node && selection.node.type.name === NAME) {
    return { pos: selection.from, node: selection.node };
  }

  const { $from } = selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name === NAME) return { pos: $from.before(depth), node };
  }
  return null;
}

/** 删除整个块；它是父容器唯一子块时换成空段落。光标回到上一块末尾。 */
function removeBlock(tr, pos, node, schema) {
  const end = pos + node.nodeSize;

  if (tr.doc.resolve(pos).parent.childCount === 1) {
    tr.replaceWith(pos, end, schema.nodes.paragraph.create());
    tr.setSelection(TextSelection.create(tr.doc, pos + 1));
  } else {
    tr.delete(pos, end);
    tr.setSelection(Selection.near(tr.doc.resolve(Math.min(pos, tr.doc.content.size)), -1));
  }
  return tr.scrollIntoView();
}

/** 转为正文：用块内容替换整个块，光标随内容平移。 */
function unwrapAt(tr, pos, node, schema, dispatch) {
  const end = pos + node.nodeSize;

  if (!isValidCallout(node)) {
    if (dispatch) {
      tr.replaceWith(pos, end, schema.nodes.paragraph.create());
      tr.setSelection(TextSelection.create(tr.doc, pos + 1)).scrollIntoView();
    }
    return true;
  }

  const $pos = tr.doc.resolve(pos);
  const index = $pos.index();
  if (!$pos.parent.canReplace(index, index + 1, node.content)) return false;
  if (!dispatch) return true;

  const { selection } = tr;
  const inside =
    selection instanceof TextSelection && selection.from > pos && selection.to < end;
  const { anchor, head } = selection;

  tr.replaceWith(pos, end, node.content);

  if (inside) {
    tr.setSelection(TextSelection.create(tr.doc, anchor - 1, head - 1));
  } else {
    tr.setSelection(Selection.near(tr.doc.resolve(Math.min(pos, tr.doc.content.size)), 1));
  }
  tr.scrollIntoView();
  return true;
}

function repairCallouts(tr) {
  const positions = [];
  tr.doc.descendants((node, pos) => {
    if (node.type.name === NAME && !isValidCallout(node)) positions.push(pos);
    return !node.isTextblock;
  });
  if (!positions.length) return false;

  const { schema } = tr.doc.type;
  const paragraph = schema.nodes.paragraph;

  for (let i = positions.length - 1; i >= 0; i -= 1) {
    const pos = positions[i];
    const node = tr.doc.nodeAt(pos);
    if (!node || node.type.name !== NAME || isValidCallout(node)) continue;

    const end = pos + node.nodeSize;
    const text = node.textContent;

    if (text) {
      tr.replaceWith(pos, end, node.type.create(node.attrs, paragraph.create(null, schema.text(text))));
    } else if (tr.doc.resolve(pos).parent.childCount === 1) {
      tr.replaceWith(pos, end, paragraph.create());
    } else {
      tr.delete(pos, end);
    }
  }

  tr.setMeta(repairKey, true);
  tr.setMeta("addToHistory", false);
  return tr.docChanged;
}

function createRepairPlugin() {
  return new Plugin({
    key: repairKey,
    appendTransaction(transactions, _old, state) {
      if (!transactions.some((tr) => tr.docChanged)) return null;
      if (transactions.some((tr) => tr.getMeta(repairKey))) return null;
      const tr = state.tr;
      return repairCallouts(tr) ? tr : null;
    },
    view(view) {
      const timer = setTimeout(() => {
        if (view.isDestroyed) return;
        const tr = view.state.tr;
        if (repairCallouts(tr)) view.dispatch(tr);
      }, 0);
      return { destroy: () => clearTimeout(timer) };
    },
  });
}

function handleTrigger(editor) {
  const { state } = editor;
  const { $from, empty } = state.selection;

  if (
    !empty ||
    $from.parent.type.name !== "paragraph" ||
    $from.parentOffset !== $from.parent.content.size ||
    findCallout(state)
  ) {
    return false;
  }

  const matched = $from.parent.textContent.match(TRIGGER);
  if (!matched) return false;

  const type = state.schema.nodes[NAME];
  const depth = $from.depth - 1;
  const index = $from.index(depth);
  if (!$from.node(depth).canReplaceWith(index, index + 1, type)) return false;

  const attrs = matched[1]
    ? buildAttrs({ tone: matched[1].toLowerCase(), color: "default" })
    : buildAttrs();

  const from = $from.before();
  const tr = state.tr.replaceWith(
    from,
    $from.after(),
    type.create(attrs, state.schema.nodes.paragraph.create())
  );
  tr.setSelection(TextSelection.create(tr.doc, from + 2)).scrollIntoView();
  editor.view.dispatch(tr);
  return true;
}

function handleExit(editor) {
  const { state } = editor;
  const { $from, empty } = state.selection;

  if (!empty || !$from.parent.isTextblock || $from.parent.content.size !== 0) return false;

  const depth = $from.depth - 1;
  if (depth < 1) return false;

  const callout = $from.node(depth);
  if (
    callout.type.name !== NAME ||
    callout.childCount < 2 ||
    $from.index(depth) !== callout.childCount - 1
  ) {
    return false;
  }

  const tr = state.tr.delete($from.before(), $from.after());
  const after = tr.mapping.map($from.after(depth));
  tr.insert(after, state.schema.nodes.paragraph.create());
  tr.setSelection(TextSelection.create(tr.doc, after + 1)).scrollIntoView();
  editor.view.dispatch(tr);
  return true;
}

function handleModEnter(editor) {
  const hit = findCallout(editor.state);
  if (!hit) return false;

  const after = hit.pos + hit.node.nodeSize;
  const tr = editor.state.tr.insert(after, editor.state.schema.nodes.paragraph.create());
  tr.setSelection(TextSelection.create(tr.doc, after + 1)).scrollIntoView();
  editor.view.dispatch(tr);
  return true;
}

function handleBackspace(editor) {
  const { state } = editor;
  const { $from, empty } = state.selection;

  if (!empty || $from.parentOffset !== 0 || !$from.parent.isTextblock) return false;

  const depth = $from.depth - 1;
  if (depth < 1) return false;

  const callout = $from.node(depth);
  if (callout.type.name !== NAME || $from.index(depth) !== 0) return false;

  if (isBlankCallout(callout)) {
    editor.view.dispatch(removeBlock(state.tr, $from.before(depth), callout, state.schema));
    return true;
  }

  if (Number($from.parent.attrs?.indent) > 0) return false;

  if ($from.parent.content.size === 0 && callout.childCount > 1) {
    const from = $from.before();
    const tr = state.tr.delete(from, $from.after());
    tr.setSelection(Selection.near(tr.doc.resolve(from), 1)).scrollIntoView();
    editor.view.dispatch(tr);
    return true;
  }

  return editor.commands.unwrapFocusCallout();
}

/** 按键扩展：priority 只影响按键顺序（先于 SmartFormatting），不影响默认块。 */
export const FocusCalloutKeymap = Extension.create({
  name: "focusCalloutKeymap",
  priority: 1100,

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        if (this.editor.view.composing) return false;
        return handleTrigger(this.editor) || handleExit(this.editor);
      },
      "Mod-Enter": () => handleModEnter(this.editor),
      Backspace: () => handleBackspace(this.editor),
    };
  },
});

const FocusCallout = Node.create({
  name: NAME,
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      tone: {
        default: "info",
        parseHTML: (el) => normalizeCalloutTone(el.getAttribute("data-tone")),
        renderHTML: () => ({}),
      },
      color: {
        default: "default",
        parseHTML: (el) => normalizeCalloutColor(el.getAttribute("data-color")),
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'aside[data-type="focus-callout"]' }];
  },

  renderHTML({ node }) {
    const palette = getCalloutPresentation(node.attrs.tone, node.attrs.color);
    return [
      "aside",
      {
        "data-type": "focus-callout",
        "data-tone": normalizeCalloutTone(node.attrs.tone),
        "data-color": normalizeCalloutColor(node.attrs.color),
        class: "focus-callout",
        style:
          `background:${palette.background};border:1px solid ${palette.border};` +
          "border-radius:8px;padding:12px 16px;color:#29313d;",
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
        ({ state, tr, dispatch }) => {
          const type = state.schema.nodes[NAME];
          const paragraph = state.schema.nodes.paragraph;
          if (!type || !paragraph || findCallout(state)) return false;

          const attrs = buildAttrs(attributes);
          const { $from, $to, empty, to } = state.selection;
          const blankLine =
            empty && $from.parent.type === paragraph && $from.parent.content.size === 0;

          if (!empty || blankLine) {
            const range = $from.blockRange($to);
            const wrapping = range && findWrapping(range, type, attrs);
            if (wrapping) {
              if (dispatch) tr.wrap(range, wrapping).scrollIntoView();
              return true;
            }
          }

          const pos = $from.depth >= 1 ? $from.after(1) : to;
          if (dispatch) {
            tr.insert(pos, type.create(attrs, paragraph.create()));
            tr.setSelection(TextSelection.create(tr.doc, pos + 2)).scrollIntoView();
          }
          return true;
        },

      toggleFocusCallout:
        (attributes = {}) =>
        ({ state, commands }) =>
          findCallout(state)
            ? commands.unwrapFocusCallout()
            : commands.insertFocusCallout(attributes),

      updateFocusCallout:
        (attributes = {}, pos) =>
        ({ state, tr, dispatch }) => {
          const hit = findCallout(state, pos);
          if (!hit) return false;

          const attrs = { ...hit.node.attrs };
          if (attributes.tone !== undefined) attrs.tone = normalizeCalloutTone(attributes.tone);
          if (attributes.color !== undefined) attrs.color = normalizeCalloutColor(attributes.color);

          if (dispatch) {
            if (isValidCallout(hit.node)) {
              tr.setNodeMarkup(hit.pos, undefined, attrs);
            } else {
              tr.replaceWith(
                hit.pos,
                hit.pos + hit.node.nodeSize,
                hit.node.type.create(attrs, state.schema.nodes.paragraph.create())
              );
            }
          }
          return true;
        },

      unwrapFocusCallout:
        (pos) =>
        ({ state, tr, dispatch }) => {
          const hit = findCallout(state, pos);
          return hit ? unwrapAt(tr, hit.pos, hit.node, state.schema, dispatch) : false;
        },

      deleteFocusCallout:
        (pos) =>
        ({ state, tr, dispatch }) => {
          const hit = findCallout(state, pos);
          if (!hit) return false;
          if (dispatch) removeBlock(tr, hit.pos, hit.node, state.schema);
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [createRepairPlugin()];
  },

  addNodeView() {
    return VueNodeViewRenderer(FocusCalloutNodeView);
  },
});

export default FocusCallout;
