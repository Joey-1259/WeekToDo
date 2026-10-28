/*
 * FOCUS_EDITOR_ENHANCE_20261028_V1：标题折叠（参考语雀）
 * · H1–H6 左侧悬停出现箭头，点击折叠到下一个「同级或更高级」标题之前。
 * · 折叠状态存为 heading.attrs.collapsed（随文档保存），不进撤销栈。
 * · ⌘. 切换光标所在章节；折叠标题末尾回车 → 新段落插在章节之后。
 */
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import "./focusEditorEnhance.css";

export const headingFoldKey = new PluginKey("focusHeadingFold");

/** 顶层 heading 所辖章节的结束位置（不含） */
function sectionEnd(doc, headingPos) {
  const heading = doc.nodeAt(headingPos);
  let end = doc.content.size;
  let passed = false;
  doc.forEach((node, offset) => {
    if (end !== doc.content.size) return;
    if (offset === headingPos) { passed = true; return; }
    if (passed && node.type.name === "heading" && node.attrs.level <= heading.attrs.level) end = offset;
  });
  return end;
}

function buildDecorations(doc) {
  const decorations = [];
  let hideUntil = 0;

  doc.forEach((node, offset) => {
    const isHeading = node.type.name === "heading";
    const level = isHeading ? node.attrs.level : 0;

    if (hideUntil) {
      if (isHeading && level <= hideUntil) {
        hideUntil = 0;
      } else {
        decorations.push(Decoration.node(offset, offset + node.nodeSize, { class: "hf-hidden" }));
        return;
      }
    }

    if (!isHeading) return;
    const collapsed = Boolean(node.attrs.collapsed);

    decorations.push(
      Decoration.widget(
        offset + 1,
        () => {
          const button = document.createElement("span");
          button.className = "hf-toggle" + (collapsed ? " is-collapsed" : "");
          button.dataset.pos = String(offset);
          button.contentEditable = "false";
          button.setAttribute("role", "button");
          button.setAttribute("aria-label", collapsed ? "展开章节" : "折叠章节");
          button.title = (collapsed ? "展开章节" : "折叠章节") + "（⌘.）";
          return button;
        },
        { side: -1, ignoreSelection: true, key: `hf-${offset}-${collapsed ? 1 : 0}` }
      )
    );

    if (collapsed) {
      hideUntil = level;
      decorations.push(Decoration.node(offset, offset + node.nodeSize, { class: "hf-collapsed" }));
    }
  });

  return DecorationSet.create(doc, decorations);
}

function currentHeadingPos(state) {
  const { $from } = state.selection;
  if ($from.depth < 1) return null;
  const top = $from.before(1);
  let found = null;
  state.doc.forEach((node, offset) => {
    if (offset <= top && node.type.name === "heading") found = offset;
  });
  return found;
}

export default Extension.create({
  name: "focusHeadingFold",
  priority: 1200,

  addGlobalAttributes() {
    return [
      {
        types: ["heading"],
        attributes: {
          collapsed: {
            default: false,
            parseHTML: (el) => el.getAttribute("data-collapsed") === "true",
            renderHTML: (attrs) => (attrs.collapsed ? { "data-collapsed": "true" } : {}),
          },
        },
      },
    ];
  },

  addCommands() {
    const setFold = (pos, value) => ({ state, tr, dispatch }) => {
      const target = Number.isInteger(pos) ? pos : currentHeadingPos(state);
      if (target === null) return false;
      const node = state.doc.nodeAt(target);
      if (!node || node.type.name !== "heading") return false;
      const next = value === undefined ? !node.attrs.collapsed : Boolean(value);
      if (dispatch) {
        const end = sectionEnd(state.doc, target);
        tr.setNodeMarkup(target, undefined, { ...node.attrs, collapsed: next });
        tr.setMeta("addToHistory", false);
        const from = state.selection.from;
        if (next && from > target + node.nodeSize && from < end) {
          tr.setSelection(TextSelection.create(tr.doc, target + node.nodeSize - 1));
        }
      }
      return true;
    };

    const setAll = (value) => ({ state, tr, dispatch }) => {
      if (dispatch) {
        state.doc.forEach((node, offset) => {
          if (node.type.name === "heading" && Boolean(node.attrs.collapsed) !== value) {
            tr.setNodeMarkup(offset, undefined, { ...node.attrs, collapsed: value });
          }
        });
        tr.setMeta("addToHistory", false);
        if (value) {
          const pos = currentHeadingPos(state);
          if (pos !== null) {
            const heading = tr.doc.nodeAt(pos);
            tr.setSelection(TextSelection.create(tr.doc, pos + heading.nodeSize - 1));
          }
        }
      }
      return true;
    };

    return {
      toggleHeadingFold: (pos) => setFold(pos),
      foldAllHeadings: () => setAll(true),
      unfoldAllHeadings: () => setAll(false),
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-.": () => this.editor.commands.toggleHeadingFold(),
      "Mod-Alt-.": () => this.editor.commands.unfoldAllHeadings(),
      Enter: () => {
        const { state, view } = this.editor;
        if (view.composing) return false;
        const { $from, empty } = state.selection;
        if (!empty || $from.depth !== 1) return false;
        const node = $from.parent;
        if (node.type.name !== "heading" || !node.attrs.collapsed) return false;
        if ($from.parentOffset !== node.content.size) return false;

        const end = sectionEnd(state.doc, $from.before(1));
        const tr = state.tr.insert(end, state.schema.nodes.paragraph.create());
        tr.setSelection(TextSelection.create(tr.doc, end + 1)).scrollIntoView();
        view.dispatch(tr);
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: headingFoldKey,
        state: {
          init: (_, state) => buildDecorations(state.doc),
          apply: (tr, old) => (tr.docChanged ? buildDecorations(tr.doc) : old),
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
          handleDOMEvents: {
            mousedown: (_view, event) => {
              const toggle = event.target?.closest?.(".hf-toggle");
              if (!toggle) return false;
              event.preventDefault();
              event.stopPropagation();
              editor.commands.toggleHeadingFold(Number(toggle.dataset.pos));
              return true;
            },
          },
        },
      }),
    ];
  },
});
