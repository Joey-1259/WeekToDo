import { Node, mergeAttributes } from "@tiptap/core";

/* UNIFIED_TAG_SYSTEM_20260917_V1
 * 关联事项节点：新增 color / tags 属性，
 * 在重点事项文档中渲染颜色圆点和标签 chip。
 */

export default Node.create({
  name: "linkedTask",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      blockId: { default: null },
      taskId: { default: null },
      listId: { default: null },
      title: { default: "" },
      checked: { default: false },
      missing: { default: false },
      color: { default: "none" },
      tags: { default: [] },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="linked-task"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "linked-task",
      }),
    ];
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement("div");
      dom.className = "linked-task-block";
      dom.contentEditable = "false";

      const emit = (name, attrs) => {
        window.dispatchEvent(
          new CustomEvent(name, {
            detail: {
              ...attrs,
              sourceEditor: editor,
            },
          })
        );
      };

      const render = (currentNode) => {
        const attrs = currentNode.attrs;
        const color = attrs.color && attrs.color !== "none" ? attrs.color : null;

        dom.classList.remove("is-loading");
        dom.classList.toggle("is-checked", Boolean(attrs.checked));
        dom.classList.toggle("is-missing", Boolean(attrs.missing));

        // 如果有颜色，给整行加左边框
        if (color) {
          dom.style.borderLeft = `3px solid ${color}`;
          dom.style.paddingLeft = "8px";
        } else {
          dom.style.borderLeft = "";
          dom.style.paddingLeft = "";
        }

        dom.innerHTML = `
          <button
            class="linked-task-check"
            type="button"
            aria-label="${attrs.checked ? "标记为未完成" : "标记为完成"}"
            title="${attrs.checked ? "标记为未完成" : "标记为完成"}"
            ${color ? `style="border-color: ${color}; ${attrs.checked ? `background: ${color};` : ""}"` : ""}
          >
            ${attrs.checked ? "✓" : ""}
          </button>

          <button
            class="linked-task-main"
            type="button"
            aria-label="打开每周事项详情"
            title="${attrs.missing ? "原事项已不存在" : "打开每周事项详情"}"
          >
            <span class="linked-task-title"></span>
            <span class="linked-task-tags"></span>
          </button>

          <button
            class="linked-task-jump"
            type="button"
            title="前往每周事项看板"
            aria-label="前往每周事项看板"
          >
            <svg viewBox="0 0 18 18" aria-hidden="true">
              <path d="M7 4h7v7" />
              <path d="m14 4-8 8" />
              <path d="M12 10v4H4V6h4" />
            </svg>
          </button>

          <button
            class="linked-task-unlink"
            type="button"
            title="解除关联"
            aria-label="解除关联"
          >
            ×
          </button>
        `;

        // 标题
        dom.querySelector(".linked-task-title").textContent =
          attrs.title || "未命名事项";

        // 标签 chips
        const tagsContainer = dom.querySelector(".linked-task-tags");
        tagsContainer.innerHTML = "";

        // 渲染颜色标签 chips
        const tagIds = Array.isArray(attrs.tags) ? attrs.tags : [];
        if (tagIds.length > 0) {
          try {
            // 动态加载标签数据
            const tagModule = require("../../data/defaultTaskTags.js").default || require("../../data/defaultTaskTags.js");
            const allTags = tagModule.getDefaultTags ? tagModule.getDefaultTags() : [];

            tagIds.forEach((tagId) => {
              const tagDef = allTags.find((t) => t.id === tagId);
              if (tagDef && tagDef.name) {
                const chip = document.createElement("span");
                chip.className = "linked-task-tag-chip";
                chip.style.backgroundColor = tagDef.color + "1a";
                chip.style.color = tagDef.color;
                chip.style.borderColor = tagDef.color + "33";
                chip.textContent = tagDef.name;
                tagsContainer.appendChild(chip);
              }
            });
          } catch {
            // 标签模块加载失败时不影响主渲染
          }
        }

        // 事件绑定
        const checkbox = dom.querySelector(".linked-task-check");
        const main = dom.querySelector(".linked-task-main");
        const jump = dom.querySelector(".linked-task-jump");
        const unlink = dom.querySelector(".linked-task-unlink");

        checkbox.onclick = (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!attrs.missing) emit("focus-task-toggle", attrs);
        };

        main.onclick = (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!attrs.missing) emit("focus-task-open", attrs);
        };

        jump.onclick = (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!attrs.missing) emit("focus-task-jump", attrs);
        };

        unlink.onclick = (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (typeof getPos === "function") {
            editor.commands.setNodeSelection(getPos());
          }
          emit("focus-task-unlink", attrs);
        };
      };

      render(node);

      return {
        dom,
        update(updatedNode) {
          if (updatedNode.type.name !== "linkedTask") return false;
          node = updatedNode;
          render(node);
          return true;
        },
      };
    };
  },
});
