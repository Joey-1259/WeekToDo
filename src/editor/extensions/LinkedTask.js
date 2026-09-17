import { Node, mergeAttributes } from "@tiptap/core";

/**
 * UNIFIED_TAG_SYSTEM_V5
 * 关联事项节点：颜色左边框 + 勾选框颜色。不显示文字 tag chips。
 */
export default Node.create({
  name: "linkedTask",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      blockId:  { default: null },
      taskId:   { default: null },
      listId:   { default: null },
      title:    { default: "" },
      checked:  { default: false },
      missing:  { default: false },
      color:    { default: "none" },
      tags:     { default: [] },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="linked-task"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "linked-task" })];
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement("div");
      dom.className = "linked-task-block";
      dom.contentEditable = "false";

      const emit = (name, attrs) => {
        window.dispatchEvent(new CustomEvent(name, { detail: { ...attrs, sourceEditor: editor } }));
      };

      const render = (cur) => {
        const a = cur.attrs;
        const color = a.color && a.color !== "none" ? a.color : null;

        dom.classList.remove("is-loading");
        dom.classList.toggle("is-checked", Boolean(a.checked));
        dom.classList.toggle("is-missing", Boolean(a.missing));

        /* 颜色左边框 */
        if (color) {
          dom.style.borderLeft = "3px solid " + color;
          dom.style.paddingLeft = "8px";
        } else {
          dom.style.borderLeft = "";
          dom.style.paddingLeft = "";
        }

        const checkStyle = color
          ? "border-color:" + color + ";" + (a.checked ? "background:" + color + ";" : "")
          : "";

        dom.innerHTML =
          '<button class="linked-task-check" type="button" title="' +
            (a.checked ? "标记为未完成" : "标记为完成") +
            '" ' + (checkStyle ? 'style="' + checkStyle + '"' : "") + ">" +
            (a.checked ? "\u2713" : "") +
          "</button>" +
          '<button class="linked-task-main" type="button" title="' +
            (a.missing ? "原事项已不存在" : "打开每周事项详情") + '">' +
            '<span class="linked-task-title"></span>' +
          "</button>" +
          '<button class="linked-task-jump" type="button" title="前往每周事项看板">' +
            '<svg viewBox="0 0 18 18"><path d="M7 4h7v7"/><path d="m14 4-8 8"/><path d="M12 10v4H4V6h4"/></svg>' +
          "</button>" +
          '<button class="linked-task-unlink" type="button" title="解除关联">\u00D7</button>';

        dom.querySelector(".linked-task-title").textContent = a.title || "未命名事项";

        dom.querySelector(".linked-task-check").onclick = (e) => {
          e.preventDefault(); e.stopPropagation();
          if (!a.missing) emit("focus-task-toggle", a);
        };
        dom.querySelector(".linked-task-main").onclick = (e) => {
          e.preventDefault(); e.stopPropagation();
          if (!a.missing) emit("focus-task-open", a);
        };
        dom.querySelector(".linked-task-jump").onclick = (e) => {
          e.preventDefault(); e.stopPropagation();
          if (!a.missing) emit("focus-task-jump", a);
        };
        dom.querySelector(".linked-task-unlink").onclick = (e) => {
          e.preventDefault(); e.stopPropagation();
          if (typeof getPos === "function") editor.commands.setNodeSelection(getPos());
          emit("focus-task-unlink", a);
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
