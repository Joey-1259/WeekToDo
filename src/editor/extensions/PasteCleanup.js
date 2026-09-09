import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Fragment, Slice } from "@tiptap/pm/model";

/* FOCUS_PASTE_CLEANUP_20260909_V1 */

export const pasteCleanupKey = new PluginKey("focusPasteCleanup");

/** 语义标签保留，其余一律拆壳。 */
const KEEP_TAGS = new Set([
  "A","B","BLOCKQUOTE","BR","CODE","DEL","EM","H1","H2","H3","H4","H5","H6",
  "HR","I","IMG","LI","OL","P","PRE","S","STRIKE","STRONG","SUB","SUP","TABLE",
  "TBODY","TD","TH","THEAD","TR","U","UL",
]);

/** 白名单属性，其余全部丢弃（style / class / color / face 等）。 */
const KEEP_ATTRS = new Set([
  "href","src","alt","title","colspan","rowspan","start","type",
]);

/** 从外部富文本带进来的行内样式 mark。 */
const STRIP_MARKS = ["textStyle", "highlight"];

function sanitizeHtml(html) {
  if (!html || typeof window === "undefined") return html;

  let doc;

  try {
    doc = new DOMParser().parseFromString(html, "text/html");
  } catch (error) {
    return html;
  }

  doc
    .querySelectorAll("style, script, meta, link, o\\:p")
    .forEach((node) => node.remove());

  const walker = doc.createTreeWalker(
    doc.body,
    NodeFilter.SHOW_COMMENT
  );

  const comments = [];
  while (walker.nextNode()) comments.push(walker.currentNode);
  comments.forEach((node) => node.remove());

  Array.from(doc.body.querySelectorAll("*")).forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      if (KEEP_ATTRS.has(attribute.name.toLowerCase())) return;
      if (attribute.name.toLowerCase().startsWith("data-")) return;

      element.removeAttribute(attribute.name);
    });

    if (KEEP_TAGS.has(element.tagName)) return;

    // 拆壳：把 span / font / div 等容器的子节点提到父级。
    const parent = element.parentNode;
    if (!parent) return;

    while (element.firstChild) {
      parent.insertBefore(element.firstChild, element);
    }

    parent.removeChild(element);
  });

  return doc.body.innerHTML;
}

function stripMarks(fragment) {
  const nodes = [];

  fragment.forEach((node) => {
    if (node.isText) {
      nodes.push(
        node.mark(
          node.marks.filter(
            (mark) => !STRIP_MARKS.includes(mark.type.name)
          )
        )
      );
      return;
    }

    nodes.push(
      node.content.size
        ? node.copy(stripMarks(node.content))
        : node
    );
  });

  return Fragment.fromArray(nodes);
}

export const PasteCleanup = Extension.create({
  name: "pasteCleanup",

  addOptions() {
    return {
      /** () => boolean，true 表示保留来源样式。 */
      keepSource: () => false,
    };
  },

  addKeyboardShortcuts() {
    return {
      // 强制纯文本粘贴。
      "Mod-Shift-v": () => {
        const editor = this.editor;

        navigator.clipboard
          ?.readText()
          .then((text) => {
            if (!text || editor.isDestroyed) return;

            editor
              .chain()
              .focus()
              .insertContent(
                text
                  .split(/\r?\n/)
                  .map((line) => ({
                    type: "paragraph",
                    content: line
                      ? [{ type: "text", text: line }]
                      : [],
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

    return [
      new Plugin({
        key: pasteCleanupKey,

        props: {
          transformPastedHTML(html) {
            if (options.keepSource?.()) return html;
            return sanitizeHtml(html);
          },

          transformPasted(slice) {
            if (options.keepSource?.()) return slice;

            return new Slice(
              stripMarks(slice.content),
              slice.openStart,
              slice.openEnd
            );
          },
        },
      }),
    ];
  },
});

export default PasteCleanup;
