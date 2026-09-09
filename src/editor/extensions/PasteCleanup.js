import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Fragment, Slice } from "@tiptap/pm/model";

/* FOCUS_UI_SYSTEM_20260910_V5 */

/**
 * 粘贴清洗。
 *
 * 上一版的语义是错的：STRIP_MARKS 里放了 textStyle 和 highlight，
 * 于是"默认粘贴"会把来源的文字颜色和背景色一并抹掉。用户复制一段
 * 标了重点的文字过来，重点就没了——这不是清洗，是丢信息。
 *
 * 三态策略（与语雀 / Notion 对齐）：
 *
 *   smart（默认）
 *     保留：语义标签、文字颜色、背景色、粗斜体下划删除线、链接、列表、表格
 *     丢弃：font-family / font-size / line-height / margin / padding /
 *           width / height / mso-* / class / id / 空 span 壳
 *     理由：颜色是作者的语义标注；字体与行高是来源文档的排版残留，
 *           带进来一定破坏本地文档的视觉一致性。
 *
 *   source（工具栏开关打开）
 *     原样保留，不做任何处理。用于从自家文档之间搬运。
 *
 *   plain（⌘⇧V）
 *     纯文本，按行拆段落。
 */

export const pasteCleanupKey = new PluginKey("focusPasteCleanup");

/** 语义标签保留，其余容器拆壳。 */
const KEEP_TAGS = new Set([
  "A", "B", "BLOCKQUOTE", "BR", "CODE", "DEL", "EM",
  "H1", "H2", "H3", "H4", "H5", "H6", "HR", "I", "IMG",
  "LI", "MARK", "OL", "P", "PRE", "S", "STRIKE", "STRONG",
  "SUB", "SUP", "TABLE", "TBODY", "TD", "TH", "THEAD", "TR",
  "U", "UL",
]);

/** 白名单属性。style 单独走声明级过滤，不整体丢。 */
const KEEP_ATTRS = new Set([
  "href", "src", "alt", "title", "colspan", "rowspan", "start", "type",
]);

/**
 * 允许存活的 CSS 声明。
 * 只有这些会被写回 style，其余（尤其是 font-family / font-size /
 * line-height / margin / mso-*）一律丢弃。
 */
const KEEP_STYLE_PROPS = new Set([
  "color",
  "background-color",
  "font-weight",
  "font-style",
  "text-decoration",
  "text-decoration-line",
]);

/** 这些颜色值等于"没设置"，留着只会污染文档。 */
const NEUTRAL_COLORS = new Set([
  "transparent",
  "initial",
  "inherit",
  "unset",
  "currentcolor",
  "windowtext",
  "auto",
  "none",
  "#000",
  "#000000",
  "black",
  "rgb(0,0,0)",
  "rgb(0, 0, 0)",
]);

function isNeutral(prop, value) {
  const v = String(value || "").trim().toLowerCase();

  if (!v) return true;

  if (prop === "color" || prop === "background-color") {
    // 纯黑当作默认正文色丢弃，否则暗色主题下会变成"看不见的黑字"。
    if (NEUTRAL_COLORS.has(v.replace(/\s+/g, ""))) return true;
    if (prop === "background-color" && /^rgba\(.+,\s*0\s*\)$/.test(v)) {
      return true;
    }
  }

  if (prop === "font-weight") {
    // 只有明确的加粗才有意义。
    const numeric = Number(v);
    if (Number.isFinite(numeric)) return numeric < 600;
    return v !== "bold" && v !== "bolder";
  }

  if (prop === "font-style") return v !== "italic" && v !== "oblique";

  if (
    prop === "text-decoration" ||
    prop === "text-decoration-line"
  ) {
    return !/underline|line-through/.test(v);
  }

  return false;
}

function filterStyle(styleText) {
  if (!styleText) return "";

  const kept = [];

  String(styleText)
    .split(";")
    .forEach((chunk) => {
      const index = chunk.indexOf(":");
      if (index < 0) return;

      const prop = chunk.slice(0, index).trim().toLowerCase();
      const value = chunk.slice(index + 1).trim();

      if (!KEEP_STYLE_PROPS.has(prop)) return;
      if (isNeutral(prop, value)) return;

      kept.push(prop + ": " + value);
    });

  return kept.join("; ");
}

function sanitizeHtml(html) {
  if (!html || typeof window === "undefined") return html;

  let doc;

  try {
    doc = new DOMParser().parseFromString(html, "text/html");
  } catch (error) {
    return html;
  }

  doc
    .querySelectorAll("style, script, meta, link, o\\:p, xml")
    .forEach((node) => node.remove());

  // Word / WPS 会塞大量条件注释，先清掉。
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_COMMENT);
  const comments = [];
  while (walker.nextNode()) comments.push(walker.currentNode);
  comments.forEach((node) => node.remove());

  Array.from(doc.body.querySelectorAll("*")).forEach((element) => {
    const survivingStyle = filterStyle(element.getAttribute("style"));

    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();

      if (KEEP_ATTRS.has(name)) return;
      if (name.startsWith("data-")) return;

      element.removeAttribute(attribute.name);
    });

    // 关键改动：把过滤后的颜色类声明写回去，让 tiptap 的
    // textStyle / highlight 扩展能正常解析成 mark。
    if (survivingStyle) {
      element.setAttribute("style", survivingStyle);
    }

    if (KEEP_TAGS.has(element.tagName)) return;

    // span / font / div 等容器：还带着颜色就留成 span，否则拆壳。
    if (survivingStyle) {
      if (element.tagName !== "SPAN") {
        const span = doc.createElement("span");
        span.setAttribute("style", survivingStyle);

        while (element.firstChild) span.appendChild(element.firstChild);

        element.parentNode?.replaceChild(span, element);
      }
      return;
    }

    const parent = element.parentNode;
    if (!parent) return;

    while (element.firstChild) {
      parent.insertBefore(element.firstChild, element);
    }

    parent.removeChild(element);
  });

  return doc.body.innerHTML;
}

/** 仅纯文本模式使用：把所有行内 mark 剥掉。 */
function stripAllMarks(fragment) {
  const nodes = [];

  fragment.forEach((node) => {
    if (node.isText) {
      nodes.push(node.mark([]));
      return;
    }

    nodes.push(
      node.content.size ? node.copy(stripAllMarks(node.content)) : node
    );
  });

  return Fragment.fromArray(nodes);
}

export const PasteCleanup = Extension.create({
  name: "pasteCleanup",

  addOptions() {
    return {
      /**
       * () => boolean
       * true  = 原样保留来源（工具栏开关打开）
       * false = 智能清洗，保留颜色与语义（默认）
       */
      keepSource: () => false,
    };
  },

  addStorage() {
    // ⌘⇧V 期间临时切到纯文本，用完即还原。
    return { forcePlain: false };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Shift-v": () => {
        const editor = this.editor;

        if (!navigator.clipboard?.readText) return false;

        navigator.clipboard
          .readText()
          .then((text) => {
            if (!text || editor.isDestroyed) return;

            editor
              .chain()
              .focus()
              .insertContent(
                text.split(/\r?\n/).map((line) => ({
                  type: "paragraph",
                  content: line ? [{ type: "text", text: line }] : [],
                }))
              )
              .run();
          })
          .catch(() => {});

        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    const storage = this.storage;

    return [
      new Plugin({
        key: pasteCleanupKey,

        props: {
          transformPastedHTML(html) {
            if (storage.forcePlain) return html;
            if (options.keepSource?.()) return html;

            return sanitizeHtml(html);
          },

          transformPasted(slice) {
            if (storage.forcePlain) {
              return new Slice(
                stripAllMarks(slice.content),
                slice.openStart,
                slice.openEnd
              );
            }

            // 智能模式不再剥 textStyle / highlight：
            // 颜色已经在 HTML 层按声明白名单过滤过了。
            return slice;
          },
        },
      }),
    ];
  },
});

export default PasteCleanup;
