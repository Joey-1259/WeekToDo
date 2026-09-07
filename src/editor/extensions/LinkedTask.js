import { Node, mergeAttributes } from "@tiptap/core";

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

      const render = (currentNode) => {
        const attrs = currentNode.attrs;
        dom.classList.toggle("is-checked", attrs.checked);
        dom.classList.toggle("is-missing", attrs.missing);

        dom.innerHTML = `
          <button
            class="linked-task-check"
            type="button"
            title="${attrs.checked ? "标记为未完成" : "标记为完成"}"
          >
            ${attrs.checked ? "✓" : ""}
          </button>
          <button
            class="linked-task-main"
            type="button"
            title="${
              attrs.missing
                ? "原事项已不存在"
                : "打开事项详情"
            }"
          >
            <span class="linked-task-title"></span>
          </button>
          <button
            class="linked-task-jump"
            type="button"
            title="前往每周事项表"
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
          >
            ×
          </button>
        `;

        dom.querySelector(".linked-task-title").textContent =
          attrs.title || "未命名事项";

        dom.querySelector(".linked-task-check").onclick =
          async () => {
            dom.classList.add("is-loading");

            window.dispatchEvent(
              new CustomEvent("focus-task-toggle", {
                detail: { ...attrs },
              })
            );
          };

        dom.querySelector(".linked-task-main").onclick = () => {
          window.dispatchEvent(
            new CustomEvent("focus-task-open", {
              detail: { ...attrs },
            })
          );
        };

        dom.querySelector(".linked-task-jump").onclick =
          () => {
            window.dispatchEvent(
              new CustomEvent("focus-task-jump", {
                detail: { ...attrs },
              })
            );
          };

        dom.querySelector(".linked-task-unlink").onclick = () => {
          if (typeof getPos === "function") {
            editor.commands.setNodeSelection(getPos());
          }

          window.dispatchEvent(
            new CustomEvent("focus-task-unlink", {
              detail: { ...attrs },
            })
          );
        };
      };

      render(node);

      return {
        dom,
        update(updatedNode) {
          if (updatedNode.type.name !== "linkedTask") {
            return false;
          }

          node = updatedNode;
          render(node);
          return true;
        },
      };
    };
  },
});
