import {
  Node,
  mergeAttributes,
} from "@tiptap/core";
import {
  VueNodeViewRenderer,
} from "@tiptap/vue-3";

import FocusMindMapNodeView from "../../views/focusDocuments/FocusMindMapNodeView.vue";

export function createFocusMindMapData(
  title = "中心主题"
) {
  const id =
    globalThis.crypto?.randomUUID?.()
    || `node-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`;

  return {
    nodeData: {
      id,
      topic: String(title || "中心主题"),
      root: true,
      children: [],
    },
    arrows: [],
    summaries: [],
    direction: 2,
  };
}

function createMapId() {
  return (
    globalThis.crypto?.randomUUID?.()
    || `focus-mind-map-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`
  );
}

export default Node.create({
  name: "focusMindMap",

  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  isolating: true,

  addAttributes() {
    return {
      mapId: {
        default: null,
      },

      title: {
        default: "中心主题",
      },

      data: {
        default: null,
        parseHTML(element) {
          const value =
            element.getAttribute("data-map");

          if (!value) return null;

          try {
            return JSON.parse(
              decodeURIComponent(value)
            );
          } catch (_) {
            return null;
          }
        },
        renderHTML(attributes) {
          if (!attributes.data) {
            return {};
          }

          return {
            "data-map": encodeURIComponent(
              JSON.stringify(attributes.data)
            ),
          };
        },
      },

      /*
       * 与 focusImage 共用资产字段。
       * 导出服务会把该 PNG 当作思维导图的本地快照。
       */
      assetId: {
        default: null,
      },

      alt: {
        default: "思维导图",
      },

      width: {
        default: "100%",
      },

      originalWidth: {
        default: null,
      },

      originalHeight: {
        default: null,
      },

      nodeCount: {
        default: 1,
      },

      updatedAt: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag:
          'figure[data-type="focus-mind-map"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const {
      data,
      ...safeAttributes
    } = HTMLAttributes;

    return [
      "figure",
      mergeAttributes(
        safeAttributes,
        data || {},
        {
          "data-type": "focus-mind-map",
        }
      ),
    ];
  },

  addCommands() {
    return {
      insertFocusMindMap:
        (attributes = {}) =>
        ({ commands }) => {
          const title =
            String(
              attributes.title
              || "中心主题"
            ).trim()
            || "中心主题";

          return commands.insertContent({
            type: this.name,
            attrs: {
              mapId:
                attributes.mapId
                || createMapId(),
              title,
              alt: `思维导图：${title}`,
              data:
                attributes.data
                || createFocusMindMapData(
                  title
                ),
              assetId:
                attributes.assetId
                || null,
              nodeCount: 1,
              updatedAt:
                new Date().toISOString(),
            },
          });
        },
    };
  },

  addNodeView() {
    return VueNodeViewRenderer(
      FocusMindMapNodeView
    );
  },
});
