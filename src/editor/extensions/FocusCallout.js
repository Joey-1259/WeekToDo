/* FOCUS_CALLOUT_COLOR_20261007_V3
 *
 * 高亮块（参考语雀）：一个入口 + 一个属性（背景色）。
 *
 * 根因 —— 上一版节点声明了 priority: 1100。
 *   Tiptap 按扩展优先级生成 schema，focusCallout 因此排到 block 组第一位，
 *   成了 doc 的 contentMatch.defaultType。StarterKit 自带的 TrailingNode
 *   未配置 node 时正是取这个默认类型，且 disabledNodes 只含它自己：
 *   任何以正文段落结尾的文档都会被 tr.insert(end, type.create()) 追加一个
 *   「零内容」高亮块 ——
 *     · 新文档一点击就多出高亮块；
 *     · 里面没有文本块，光标进不去，无法输入；
 *     · 内容不满足 block+，setNodeMarkup 校验失败 →
 *       RangeError: Invalid content for node type focusCallout。
 *
 * 修复 ——
 *   1) 节点不再声明 priority，默认块回到 paragraph；
 *   2) 需要抢在 SmartFormatting 之前处理的按键放进 FocusCalloutKeymap
 *      （扩展 priority 只影响插件/按键顺序，不影响 schema 默认块）；
 *   3) 修复插件：加载时与每次改动后清理历史遗留空壳，不进撤销栈；
 *   4) 所有命令先校验内容，不合法则重建节点，永不抛错。
 */
import { Extension, Node, createBlockMarkdownSpec } from "@tiptap/core";
import { Plugin, PluginKey, Selection, TextSelection } from "@tiptap/pm/state";
import { findWrapping, liftTarget } from "@tiptap/pm/transform";
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

/* ---------------- 工具函数 ---------------- */

function buildAttrs(attributes = {}) {
  const tone = normalizeCalloutTone(attributes.tone);
  const requested =
    attributes.color === undefined
      ? readCalloutPreference().color
      : attributes.color;

  return { tone, color: resolveCalloutColor(tone, requested) };
}

function isValidCallout(node) {
  return node.childCount > 0 && node.type.validContent(node.content);
}

/** pos 给定时取该位置的高亮块；否则取选区所在（或被选中）的高亮块。 */
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

/** 清理不合法的高亮块。返回 true 表示 tr 有改动。 */
function repairCallouts(tr) {
  const positions = [];

  tr.doc.descendants((node, pos) => {
    if (node.type.name === NAME && !isValidCallout(node)) positions.push(pos);
    return !node.isTextblock;
  });

  if (!positions.length) return false;

  const { schema } = tr.doc.type;
  const paragraph = schema.nodes.paragraph;

  for (let index = positions.length - 1; index >= 0; index -= 1) {
    const pos = positions[index];
    const node = tr.doc.nodeAt(pos);

    if (!node || node.type.name !== NAME || isValidCallout(node)) continue;

    const end = pos + node.nodeSize;
    const text = node.textContent;

    if (text) {
      /* 结构坏了但有文字：保住文字，重建为合法高亮块。 */
      tr.replaceWith(
        pos,
        end,
        node.type.create(node.attrs, paragraph.create(null, schema.text(text)))
      );
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

    appendTransaction(transactions, _oldState, state) {
      if (!transactions.some((tr) => tr.docChanged)) return null;
      if (transactions.some((tr) => tr.getMeta(repairKey))) return null;

      const tr = state.tr;
      return repairCallouts(tr) ? tr : null;
    },

    /* 初次加载没有事务，单独跑一次：已存进文档的空壳在打开时即被清理并回写保存。 */
    view(view) {
      const timer = setTimeout(() => {
        if (view.isDestroyed) return;
        const tr = view.state.tr;
        if (repairCallouts(tr)) view.dispatch(tr);
      }, 0);

      return {
        destroy() {
          clearTimeout(timer);
        },
      };
    },
  });
}

/* ---------------- 按键行为 ---------------- */

/** ::: / :::warning 等 + 回车 → 当前空段落原地变高亮块。 */
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
  const paragraph = state.schema.nodes.paragraph;
  const parentDepth = $from.depth - 1;
  const container = $from.node(parentDepth);
  const index = $from.index(parentDepth);

  /* 例如列表项首段不能被替换成高亮块，此时交还默认回车。 */
  if (!container.canReplaceWith(index, index + 1, type)) return false;

  const attrs = matched[1]
    ? buildAttrs({ tone: matched[1].toLowerCase(), color: "default" })
    : buildAttrs();

  const from = $from.before();
  const to = $from.after();
  const tr = state.tr.replaceWith(from, to, type.create(attrs, paragraph.create()));

  tr.setSelection(TextSelection.create(tr.doc, from + 2)).scrollIntoView();
  editor.view.dispatch(tr);
  return true;
}

/** 高亮块最后一行是空行时回车：删掉空行，光标跳到块后的新正文段落。 */
function handleExit(editor) {
  const { state } = editor;
  const { $from, empty } = state.selection;

  if (!empty || !$from.parent.isTextblock || $from.parent.content.size !== 0) {
    return false;
  }

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

/** ⌘↩：块内任意位置跳出。 */
function handleModEnter(editor) {
  const hit = findCallout(editor.state);
  if (!hit) return false;

  const after = hit.pos + hit.node.nodeSize;
  const tr = editor.state.tr.insert(after, editor.state.schema.nodes.paragraph.create());

  tr.setSelection(TextSelection.create(tr.doc, after + 1)).scrollIntoView();
  editor.view.dispatch(tr);
  return true;
}

/** 块内首段段首退格 → 转为正文（段落有缩进时交给 SmartFormatting 先减缩进）。 */
function handleBackspace(editor) {
  const { $from, empty } = editor.state.selection;

  if (!empty || $from.parentOffset !== 0 || !$from.parent.isTextblock) return false;

  const depth = $from.depth - 1;
  if (depth < 1) return false;

  const callout = $from.node(depth);
  if (callout.type.name !== NAME || $from.index(depth) !== 0) return false;
  if (Number($from.parent.attrs?.indent) > 0) return false;

  return editor.commands.unwrapFocusCallout();
}

/**
 * 按键扩展：priority 1100 让它先于 SmartFormatting / ListKeymap 执行。
 * 只在明确命中高亮块场景时返回 true，其余一律交还默认行为。
 */
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

/* ---------------- 节点 ---------------- */

const FocusCallout = Node.create({
  name: NAME,
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,
  /* 刻意不声明 priority —— 见文件头。 */

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
    const palette = getCalloutPresentation(node.attrs.tone, node.attrs.color);

    return [
      "aside",
      {
        "data-type": "focus-callout",
        "data-tone": normalizeCalloutTone(node.attrs.tone),
        "data-color": normalizeCalloutColor(node.attrs.color),
        class: "focus-callout",
        style:
          `background:${palette.background};` +
          `border:1px solid ${palette.border};` +
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
      /**
       * 空行 → 原地变高亮块；有选区 → 包裹所选块；
       * 其他位置（含列表内等无法包裹处）→ 插在当前顶层块之后。
       */
      insertFocusCallout:
        (attributes = {}) =>
        ({ state, tr, dispatch }) => {
          const type = state.schema.nodes[NAME];
          const paragraph = state.schema.nodes.paragraph;

          if (!type || !paragraph || findCallout(state)) return false;

          const attrs = buildAttrs(attributes);
          const { selection } = state;
          const { $from, $to, empty } = selection;
          const blankLine =
            empty &&
            $from.parent.type === paragraph &&
            $from.parent.content.size === 0;

          if (!empty || blankLine) {
            const range = $from.blockRange($to);
            const wrapping = range && findWrapping(range, type, attrs);

            if (wrapping) {
              if (dispatch) tr.wrap(range, wrapping).scrollIntoView();
              return true;
            }
          }

          const pos = $from.depth >= 1 ? $from.after(1) : selection.to;

          if (dispatch) {
            tr.insert(pos, type.create(attrs, paragraph.create()));
            tr.setSelection(TextSelection.create(tr.doc, pos + 2)).scrollIntoView();
          }

          return true;
        },

      /** 工具栏入口：块外＝插入，块内＝转为正文。 */
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

      /** 去掉底色、保留内容。 */
      unwrapFocusCallout:
        (pos) =>
        ({ state, tr, dispatch }) => {
          const hit = findCallout(state, pos);
          if (!hit) return false;

          const start = hit.pos;
          const end = start + hit.node.nodeSize;

          if (!isValidCallout(hit.node)) {
            if (dispatch) tr.replaceWith(start, end, state.schema.nodes.paragraph.create());
            return true;
          }

          const range = tr.doc.resolve(start + 1).blockRange(tr.doc.resolve(end - 1));
          const target = range ? liftTarget(range) : null;

          if (!range || target === null || target === undefined) return false;

          if (dispatch) {
            tr.lift(range, target);

            if (Number.isInteger(pos)) {
              tr.setSelection(Selection.near(tr.doc.resolve(Math.min(start, tr.doc.content.size))));
            }

            tr.scrollIntoView();
          }

          return true;
        },

      /** 删除高亮块及其内容；它是唯一子块时换成空段落，保证结构合法。 */
      deleteFocusCallout:
        (pos) =>
        ({ state, tr, dispatch }) => {
          const hit = findCallout(state, pos);
          if (!hit) return false;

          if (dispatch) {
            const end = hit.pos + hit.node.nodeSize;

            if (tr.doc.resolve(hit.pos).parent.childCount === 1) {
              tr.replaceWith(hit.pos, end, state.schema.nodes.paragraph.create());
            } else {
              tr.delete(hit.pos, end);
            }

            const near = Math.min(hit.pos, tr.doc.content.size);
            tr.setSelection(Selection.near(tr.doc.resolve(near))).scrollIntoView();
          }

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
