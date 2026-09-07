import {
  Node,
  mergeAttributes,
} from "@tiptap/core";
import focusAssetRepository from "../../repositories/focusAssetRepository";

/* FOCUS_RICH_CONTENT_SYSTEM_20260907_V1 */

export default Node.create({
  name: "focusImage",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      assetId: { default: null },
      alt: { default: "" },
      title: { default: "" },
      width: { default: "100%" },
      originalWidth: { default: null },
      originalHeight: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'figure[data-type="focus-image"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "figure",
      mergeAttributes(HTMLAttributes, {
        "data-type": "focus-image",
      }),
    ];
  },

  addNodeView() {
    return ({ node, editor }) => {
      const figure = document.createElement("figure");
      const image = document.createElement("img");
      const status = document.createElement("span");
      let objectUrl = null;
      let currentAssetId = null;

      figure.className = "focus-image-block";
      figure.contentEditable = "false";

      image.className = "focus-document-image";
      image.draggable = false;
      image.loading = "lazy";

      status.className = "focus-image-status";
      status.textContent = "正在加载图片…";

      figure.append(image, status);

      const releaseUrl = () => {
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
          objectUrl = null;
        }
      };

      const load = async (attrs) => {
        const assetId = attrs.assetId;
        currentAssetId = assetId;
        releaseUrl();

        image.removeAttribute("src");
        image.alt = attrs.alt || "";
        image.title =
          attrs.title || attrs.alt || "点击查看原图";
        image.style.width = attrs.width || "100%";
        status.textContent = "正在加载图片…";
        status.hidden = false;

        if (!assetId) {
          status.textContent = "图片数据无效";
          return;
        }

        try {
          const result =
            await focusAssetRepository.getObjectUrl(
              assetId
            );

          if (currentAssetId !== assetId) {
            URL.revokeObjectURL(result.url);
            return;
          }

          objectUrl = result.url;
          image.src = objectUrl;
          status.hidden = true;
        } catch {
          status.textContent =
            "图片文件不存在，可能已被清理";
          figure.classList.add("is-missing");
        }
      };

      image.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        window.dispatchEvent(
          new CustomEvent("focus-image-preview", {
            detail: {
              ...node.attrs,
              sourceEditor: editor,
            },
          })
        );
      });

      load(node.attrs);

      return {
        dom: figure,

        update(updatedNode) {
          if (updatedNode.type.name !== "focusImage") {
            return false;
          }

          node = updatedNode;
          load(node.attrs);
          return true;
        },

        stopEvent(event) {
          return event.target === image;
        },

        destroy() {
          currentAssetId = null;
          releaseUrl();
        },
      };
    };
  },
});
