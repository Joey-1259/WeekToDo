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
          <button class="linked-task-check" type="button">
            ${attrs.checked ? "✓" : ""}
          </button>
          <button class="linked-task-main" type="button">
            <span class="linked-task-title"></span>
            <small>${attrs.missing ? "原事项已不存在" : "关联事项"}</small>
          </button>
          <button class="linked-task-unlink" type="button" title="解除关联">×</button>
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
