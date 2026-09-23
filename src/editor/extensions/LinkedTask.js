import {
  Node,
  mergeAttributes,
} from "@tiptap/core";

import focusTaskService from
  "../../services/focusTaskService";
/* PATCH_20260923_V2 */
import "./linkedTaskActions.css"; // PATCH_20260923_V2

/**
 * 关联事项节点交互：
 *
 * - checkbox：切换完成状态
 * - title：单击进入行内编辑
 * - more：打开完整事项弹窗
 * - remove：直接删除主任务及所有关联
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
    return [
      {
        tag:
          'div[data-type="linked-task"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(
        HTMLAttributes,
        {
          "data-type": "linked-task",
        }
      ),
    ];
  },

  addNodeView() {
    return ({
      node,
      editor,
      getPos,
    }) => {
      const dom =
        document.createElement("div");

      dom.className =
        "linked-task-block";
      dom.contentEditable = "false";

      let editing = false;
      let saving = false;
      let cancelNextBlur = false;

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

      const updateNodeAttributes = (
        patch
      ) => {
        if (
          typeof getPos !== "function"
        ) {
          return;
        }

        const position = getPos();

        if (
          !Number.isInteger(position) ||
          position < 0
        ) {
          return;
        }

        editor.commands.command(
          ({ tr, state }) => {
            const current =
              state.doc.nodeAt(position);

            if (
              !current ||
              current.type.name !==
                "linkedTask"
            ) {
              return false;
            }

            tr.setNodeMarkup(
              position,
              undefined,
              {
                ...current.attrs,
                ...patch,
              }
            );

            return true;
          }
        );
      };

      const stop = (event) => {
        event.preventDefault();
        event.stopPropagation();
      };

      const render = (currentNode) => {
        const attrs =
          currentNode.attrs;

        const color =
          attrs.color &&
          attrs.color !== "none"
            ? attrs.color
            : null;

        dom.classList.remove(
          "is-loading"
        );

        dom.classList.toggle(
          "is-checked",
          Boolean(attrs.checked)
        );

        dom.classList.toggle(
          "is-missing",
          Boolean(attrs.missing)
        );

        if (color) {
          dom.style.borderLeft =
            `3px solid ${color}`;

          dom.style.paddingLeft =
            "8px";
        } else {
          dom.style.borderLeft = "";
          dom.style.paddingLeft = "";
        }

        const checkStyle = color
          ? (
              `border-color:${color};`
              + (
                attrs.checked
                  ? `background:${color};`
                  : ""
              )
            )
          : "";

        dom.innerHTML = `
          <button
            class="linked-task-check"
            type="button"
            title="${
              attrs.checked
                ? "标记为未完成"
                : "标记为完成"
            }"
            ${
              checkStyle
                ? `style="${checkStyle}"`
                : ""
            }
          >
            ${
              attrs.checked
                ? "✓"
                : ""
            }
          </button>

          <div
            class="linked-task-main"
            role="button"
            tabindex="0"
            title="${
              attrs.missing
                ? "原事项已不存在"
                : "单击编辑事项名称"
            }"
          >
            <span
              class="linked-task-title"
            ></span>
          </div>

          <span class="linked-task-actions">
            <button
              class="linked-task-jump linked-task-more"
              type="button"
              title="打开事项详情"
              aria-label="打开事项详情"
            ><i class="bi-three-dots" aria-hidden="true"></i></button>
            ${
              attrs.missing
                ? ""
                : `<button
              class="linked-task-copy"
              type="button"
              title="复制事项"
              aria-label="复制事项"
            ><i class="bi-files" aria-hidden="true"></i></button>`
            }
            <button
              class="linked-task-unlink"
              type="button"
              title="删除事项"
              aria-label="删除事项"
            ><i class="bi-x" aria-hidden="true"></i></button>
          </span>
        `;

        const title =
          dom.querySelector(
            ".linked-task-title"
          );

        title.textContent =
          attrs.title ||
          "未命名事项";

        const main =
          dom.querySelector(
            ".linked-task-main"
          );

        const beginEdit = (event) => {
          stop(event);

          if (
            attrs.missing ||
            editing
          ) {
            return;
          }

          editing = true;
          dom.classList.add(
            "is-inline-editing"
          );

          main.removeAttribute("role");
          main.removeAttribute("tabindex");
          main.removeAttribute("title");

          main.innerHTML = "";

          const input =
            document.createElement("input");

          input.type = "text";
          input.className =
            "linked-task-title-input";
          input.maxLength = 500;
          input.value =
            attrs.title || "";

          input.setAttribute(
            "aria-label",
            "编辑事项名称"
          );

          main.appendChild(input);

          const finish = async ({
            cancel = false,
          } = {}) => {
            if (
              !editing ||
              saving
            ) {
              return;
            }

            const nextTitle =
              input.value.trim();

            if (
              cancel ||
              !nextTitle ||
              nextTitle === attrs.title
            ) {
              editing = false;
              dom.classList.remove(
                "is-inline-editing"
              );
              render(node);
              return;
            }

            saving = true;
            input.disabled = true;
            dom.classList.add(
              "is-saving"
            );

            try {
              const task =
                await focusTaskService
                  .updateTask(
                    attrs.taskId,
                    {
                      text: nextTitle,
                    },
                    attrs.listId
                  );

              updateNodeAttributes({
                title:
                  task.text ||
                  nextTitle,
                listId:
                  task.listId ||
                  attrs.listId,
              });
            } catch (error) {
              console.error(
                "修改关联事项失败：",
                error
              );

              window.alert(
                error?.message ||
                  "修改事项名称失败，请重试。"
              );
            } finally {
              editing = false;
              saving = false;

              dom.classList.remove(
                "is-inline-editing",
                "is-saving"
              );

              render(node);
            }
          };

          input.addEventListener(
            "mousedown",
            (inputEvent) => {
              inputEvent.stopPropagation();
            }
          );

          input.addEventListener(
            "click",
            (inputEvent) => {
              inputEvent.stopPropagation();
            }
          );

          input.addEventListener(
            "keydown",
            (inputEvent) => {
              inputEvent.stopPropagation();

              if (
                inputEvent.key === "Enter"
              ) {
                inputEvent.preventDefault();
                finish();
              }

              if (
                inputEvent.key === "Escape"
              ) {
                inputEvent.preventDefault();
                cancelNextBlur = true;
                finish({
                  cancel: true,
                });
              }
            }
          );

          input.addEventListener(
            "blur",
            () => {
              if (cancelNextBlur) {
                cancelNextBlur = false;
                return;
              }

              finish();
            }
          );

          requestAnimationFrame(() => {
            input.focus({
              preventScroll: true,
            });
            input.select();
          });
        };

        main.addEventListener(
          "click",
          beginEdit
        );

        main.addEventListener(
          "keydown",
          (event) => {
            if (
              event.key === "Enter" ||
              event.key === " "
            ) {
              beginEdit(event);
            }
          }
        );

        dom
          .querySelector(
            ".linked-task-check"
          )
          .addEventListener(
            "click",
            (event) => {
              stop(event);

              if (!attrs.missing) {
                emit(
                  "focus-task-toggle",
                  attrs
                );
              }
            }
          );

        dom
          .querySelector(
            ".linked-task-more"
          )
          .addEventListener(
            "click",
            (event) => {
              stop(event);

              if (!attrs.missing) {
                emit(
                  "focus-task-open",
                  attrs
                );
              }
            }
          );

        dom
          .querySelector(
            ".linked-task-unlink"
          )
          .addEventListener(
            "click",
            (event) => {
              stop(event);

              if (
                typeof getPos ===
                "function"
              ) {
                editor.commands
                  .setNodeSelection(
                    getPos()
                  );
              }

              emit(
                "focus-task-unlink",
                attrs
              );
            }
          );
      };

      dom.addEventListener("click", (event) => {
        if (!event.target.closest(".linked-task-copy")) return;

        stop(event);
        if (node.attrs.missing) return;

        emit("focus-task-duplicate", {
          ...node.attrs,
          pos: typeof getPos === "function" ? getPos() : null,
          nodeSize: node.nodeSize,
        });
      });

      render(node);

      return {
        dom,

        stopEvent(event) {
          return Boolean(
            event.target.closest(
              [
                ".linked-task-check",
                ".linked-task-main",
                ".linked-task-title-input",
                ".linked-task-more",
                ".linked-task-copy",
                ".linked-task-unlink",
              ].join(",")
            )
          );
        },

        update(updatedNode) {
          if (
            updatedNode.type.name !==
            "linkedTask"
          ) {
            return false;
          }

          node = updatedNode;

          /*
           * 输入过程中不重建 DOM，
           * 避免全局 updated 事件导致输入框丢失。
           */
          if (!editing) {
            render(node);
          }

          return true;
        },

        destroy() {
          editing = false;
          saving = false;
        },
      };
    };
  },
});
