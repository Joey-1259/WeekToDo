<script>
import { h } from "vue";
import {
  getCalloutPresentation,
} from "../../services/focusCalloutPresentation.mjs";

const MAX_RENDER_NODES = 1800;

export default {
  name: "FocusImportContentPreview",

  props: {
    content: { type: Object, required: true },
    images: { type: Array, default: () => [] },
  },

  render() {
    let count = 0;
    let truncated = false;

    const imageMap = new Map(
      this.images.map((image) => [image.id, image])
    );

    const renderNode = (node) => {
      if (!node) return null;

      count++;

      if (count > MAX_RENDER_NODES) {
        truncated = true;
        return null;
      }

      if (node.type === "text") {
        let output = node.text || "";

        for (const mark of node.marks || []) {
          const tags = {
            bold: "strong",
            italic: "em",
            underline: "u",
            strike: "s",
            code: "code",
          };

          if (tags[mark.type]) {
            output = h(tags[mark.type], null, [output]);
          } else if (mark.type === "link") {
            output = h("span", {
              class: "fip-link",
              title: mark.attrs?.href || "",
            }, [output]);
          }
        }

        return output;
      }

      if (node.type === "hardBreak") return h("br");

      const children = () =>
        (node.content || []).map(renderNode).filter((item) => item !== null);

      switch (node.type) {
        case "doc":
          return h("div", null, children());

        case "paragraph":
          return h("p", null, children());

        case "heading":
          return h(
            `h${Math.max(1, Math.min(3, Number(node.attrs?.level) || 1))}`,
            null,
            children()
          );

        case "bulletList":
          return h("ul", null, children());

        case "orderedList":
          return h("ol", { start: node.attrs?.start || 1 }, children());

        case "listItem":
          return h("li", null, children());

        case "taskList":
          return h("ul", { class: "fip-tasks" }, children());

        case "taskItem":
          return h("li", { class: "fip-task" }, [
            h("span", { "aria-hidden": "true" },
              node.attrs?.checked ? "☑" : "☐"),
            h("div", null, children()),
          ]);

        case "blockquote":
          return h("blockquote", null, children());

        case "horizontalRule":
          return h("hr");

        case "codeBlock":
          return h("pre", null, [h("code", null, children())]);

        case "focusImage": {
          const image = imageMap.get(node.attrs?.assetId);

          return image
            ? h("figure", null, [
                h("img", {
                  src: image.url,
                  alt: node.attrs?.alt || image.name || "导入图片",
                  loading: "lazy",
                }),
              ])
            : h("p", { class: "fip-missing" }, "图片未能预览");
        }

        case "focusCallout": {
          const palette = getCalloutPresentation(
            node.attrs?.tone,
            node.attrs?.color
          );

          return h("aside", {
            class: "fip-callout",
            style: {
              "--fip-bg": palette.background,
              "--fip-border": palette.border,
              "--fip-dark-bg": palette.darkBackground,
              "--fip-dark-border": palette.darkBorder,
            },
          }, [
            h("span", { "aria-label": palette.label }, palette.icon),
            h("div", null, children()),
          ]);
        }

        default:
          return h("div", null, children());
      }
    };

    const body = renderNode(this.content);

    return h("div", { class: "fip-content" }, [
      body,
      truncated
        ? h("p", { class: "fip-limit" },
            "大文档预览只展示前部分内容；导入仍保存完整解析结果。")
        : null,
    ]);
  },
};
</script>

<style lang="scss">
.fip-content {
  padding: 16px;
  border: 1px solid #e6eaf0;
  border-radius: 9px;
  color: #29313d;
  font-size: 13px;
  line-height: 1.75;
  overflow-wrap: anywhere;

  p { margin: 0 0 10px; }
  h1 { font-size: 23px; }
  h2 { font-size: 19px; }
  h3 { font-size: 16px; }
  h1, h2, h3 { margin: 18px 0 10px; line-height: 1.4; }
  ul, ol { padding-left: 24px; }
  blockquote {
    margin: 12px 0;
    padding-left: 12px;
    border-left: 3px solid #b8c7e8;
  }
  pre {
    max-height: 360px;
    padding: 12px;
    overflow: auto;
    border-radius: 7px;
    background: #f5f7fa;
    white-space: pre-wrap;
  }
  code {
    font-family: Menlo, Consolas, monospace;
    font-size: 0.9em;
  }
  figure { margin: 14px 0; }
  img {
    display: block;
    max-width: 100%;
    height: auto;
    max-height: none;
  }
}

.fip-link { color: #4263b8; text-decoration: underline; }
.fip-tasks { padding-left: 0 !important; list-style: none; }
.fip-task { display: flex; align-items: flex-start; gap: 8px; }
.fip-callout {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  gap: 10px;
  margin: 14px 0;
  padding: 14px;
  border: 1px solid var(--fip-border);
  border-radius: 8px;
  background: var(--fip-bg);

  > div > :last-child { margin-bottom: 0; }
}
.fip-missing { color: #a34d4d; }
.fip-limit { margin-top: 16px !important; color: #8a95a3; font-size: 11px; }

.dark-theme .fip-content {
  border-color: #35404d;
  color: #dce4ee;

  pre { background: #171e28; }
  .fip-callout {
    border-color: var(--fip-dark-border);
    background: var(--fip-dark-bg);
  }
}
</style>
