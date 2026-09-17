#!/usr/bin/env python3

from pathlib import Path
from datetime import datetime
import re
import shutil
import subprocess

ROOT = Path(
    "/Users/joey/Desktop/Joey-Workspace/MyProject/weektodo-main"
).resolve()

STAMP = datetime.now().strftime("%Y%m%d-%H%M%S")
BACKUP_ROOT = Path("/tmp") / f"weektodo-fix-v4-{STAMP}"

changed_files = []


def fail(message):
    raise RuntimeError(message)


def path_for(relative_path):
    path = ROOT / relative_path

    if not path.exists():
        fail(f"找不到文件：{relative_path}")

    return path


def read(relative_path):
    return path_for(relative_path).read_text(
        encoding="utf-8"
    )


def write(relative_path, content):
    path = path_for(relative_path)
    old = path.read_text(encoding="utf-8")
    content = content.rstrip() + "\n"

    if old == content:
        print(f"SKIP  {relative_path}")
        return

    backup = BACKUP_ROOT / relative_path
    backup.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, backup)

    path.write_text(content, encoding="utf-8")
    changed_files.append(relative_path)

    print(f"PATCH {relative_path}")


def replace_once(text, old, new, label):
    count = text.count(old)

    if count != 1:
        fail(
            f"{label}：预期匹配 1 次，"
            f"实际匹配 {count} 次"
        )

    return text.replace(old, new, 1)


def replace_object_method(
    text,
    method_pattern,
    replacement,
    label,
):
    pattern = re.compile(
        rf"(?ms)^    {method_pattern}.*?"
        rf"(?=^    (?:async\s+)?"
        rf"[A-Za-z_$][A-Za-z0-9_$]*\s*(?:\(|:))"
    )

    matches = list(pattern.finditer(text))

    if len(matches) != 1:
        fail(
            f"{label}：预期定位 1 个方法，"
            f"实际定位 {len(matches)} 个"
        )

    match = matches[0]

    return (
        text[:match.start()]
        + replacement.rstrip()
        + "\n"
        + text[match.end():]
    )


def run(command):
    print()
    print("$ " + " ".join(command))

    result = subprocess.run(
        command,
        cwd=ROOT,
        text=True,
    )

    if result.returncode != 0:
        fail(
            f"命令执行失败，退出码："
            f"{result.returncode}\n"
            f"命令：{' '.join(command)}"
        )


if not ROOT.exists():
    fail(f"项目目录不存在：{ROOT}")

if not (ROOT / "package.json").exists():
    fail("目标目录不是 WeekToDo 项目")

BACKUP_ROOT.mkdir(parents=True, exist_ok=True)

print("=" * 72)
print("WeekToDo Interaction Refinement V4")
print(f"项目目录：{ROOT}")
print(f"备份目录：{BACKUP_ROOT}")
print("=" * 72)


# ============================================================
# 1. ColorPicker
# ============================================================

color_path = "src/views/toDoModal/colorPicker.vue"
text = read(color_path)


# ------------------------------------------------------------
# 1.1 顶部标签区：
#     默认只读，点击文字后才切换为输入框
# ------------------------------------------------------------

old_status = '''            <input
              v-if="hasColor && editableTag"
              ref="nameInput"
              type="text"
              class="ctp-name-input"
              maxlength="10"
              :value="editableTag.name"
              placeholder="输入标签含义"
              @mousedown.stop
              @click.stop
              @keydown.stop
              @keydown.enter.stop.prevent="commitName"
              @blur="commitName"
            />
            <span v-else-if="hasColor" class="ctp-hint">点击色块选择标签</span>
            <span v-else class="ctp-hint">无标签</span>'''

new_status = '''            <input
              v-if="
                hasColor &&
                editableTag &&
                editingName
              "
              ref="nameInput"
              type="text"
              class="ctp-name-input"
              maxlength="10"
              :value="editableTag.name"
              placeholder="输入标签含义"
              @mousedown.stop
              @click.stop
              @keydown.stop
              @keydown.enter.stop.prevent="
                commitName
              "
              @keydown.esc.stop.prevent="
                cancelNameEdit
              "
              @blur="commitName"
            />

            <button
              v-else-if="
                hasColor &&
                editableTag
              "
              type="button"
              class="ctp-name-display"
              title="点击修改颜色标签名称"
              @mousedown.prevent.stop
              @click.stop="startNameEdit"
            >
              <span
                v-if="editableTag.name"
                class="ctp-name-display-text"
              >
                {{ editableTag.name }}
              </span>

              <span
                v-else
                class="ctp-name-placeholder"
              >
                添加标签名称
              </span>

              <i class="bi-pencil"></i>
            </button>

            <span
              v-else-if="hasColor"
              class="ctp-hint"
            >
              当前颜色
            </span>

            <span
              v-else
              class="ctp-hint"
            >
              无颜色
            </span>'''

if old_status in text:
    text = replace_once(
        text,
        old_status,
        new_status,
        "修改颜色标签默认显示态",
    )
elif 'class="ctp-name-display"' not in text:
    fail("无法识别 ColorPicker 顶部标签区域")


# ------------------------------------------------------------
# 1.2 删除色块下面整行标签名称
# ------------------------------------------------------------

labels_pattern = re.compile(
    r'''(?ms)
          <!-- 主色下方标签名 -->
          <div class="ctp-labels">
.*?
          </div>

'''
)

text, labels_count = labels_pattern.subn(
    "",
    text,
    count=1,
)

if (
    labels_count == 0
    and 'class="ctp-labels"' in text
):
    fail("删除色块下方标签名称区域失败")


# ------------------------------------------------------------
# 1.3 增加编辑状态
# ------------------------------------------------------------

if "editingName:" not in text:
    data_pattern = re.compile(
        r'''(?m)^    return \{\n'''
    )

    text, count = data_pattern.subn(
        '''    return {
      editingName: false,
''',
        text,
        count=1,
    )

    if count != 1:
        fail("无法在 ColorPicker data 中增加 editingName")


# ------------------------------------------------------------
# 1.4 修改选择颜色行为：
#     选择颜色后保持只读态，不再自动聚焦输入框
# ------------------------------------------------------------

new_pick_color = '''    pickColor(color) {
      this.$emit(
        "color-selected",
        color
      );

      this.refreshTags();
      this.editingName = false;

      this.$nextTick(() => {
        this.$refs.panel?.focus({
          preventScroll: true,
        });
      });
    },
'''

text = replace_object_method(
    text,
    r"pickColor\(color\)\s*\{",
    new_pick_color,
    "ColorPicker.pickColor",
)


# ------------------------------------------------------------
# 1.5 增加点击文字进入编辑、Esc 取消
# ------------------------------------------------------------

if "startNameEdit()" not in text:
    focus_method_marker = (
        "    focusNameInput(select = false) {"
    )

    if focus_method_marker not in text:
        fail("无法定位 focusNameInput 方法")

    edit_methods = '''    startNameEdit() {
      if (
        !this.hasColor ||
        !this.editableTag
      ) {
        return;
      }

      this.editingName = true;
      this.focusNameInput(true);
    },

    cancelNameEdit() {
      this.editingName = false;

      this.$nextTick(() => {
        this.$refs.panel?.focus({
          preventScroll: true,
        });
      });
    },

'''

    text = text.replace(
        focus_method_marker,
        edit_methods + focus_method_marker,
        1,
    )


# ------------------------------------------------------------
# 1.6 标签文字点击不再切换颜色
# ------------------------------------------------------------

if "beginRename(tag)" in text:
    new_begin_rename = '''    beginRename(tag) {
      if (!tag) return;

      if (this.currentColor !== tag.color) {
        this.$emit(
          "color-selected",
          tag.color
        );
        this.refreshTags();
      }

      this.editingName = true;
      this.focusNameInput(true);
    },
'''

    text = replace_object_method(
        text,
        r"beginRename\(tag\)\s*\{",
        new_begin_rename,
        "ColorPicker.beginRename",
    )


# ------------------------------------------------------------
# 1.7 commit 后退出编辑态
# ------------------------------------------------------------

if "commitName() {" in text:
    text = text.replace(
        "    commitName() {\n",
        '''    commitName() {
      if (!this.editingName) return;

      this.editingName = false;
''',
        1,
    )
else:
    fail("无法定位 ColorPicker.commitName")


# ------------------------------------------------------------
# 1.8 关闭面板时重置编辑态
# ------------------------------------------------------------

if "this.editingName = false;" not in text.split(
    "togglePanel()",
    1,
)[-1].split("focusNameInput", 1)[0]:
    toggle_open_marker = '''      if (this.open) {
        this.closePanel();
        return;
      }
'''

    if toggle_open_marker in text:
        text = text.replace(
            toggle_open_marker,
            '''      if (this.open) {
        this.editingName = false;
        this.closePanel();
        return;
      }

      this.editingName = false;
''',
            1,
        )


# ------------------------------------------------------------
# 1.9 删除旧标签行 CSS
# ------------------------------------------------------------

labels_css_pattern = re.compile(
    r'''(?ms)
/\* ── 标签名行 ── \*/
\.ctp-labels \{
.*?
\}
\.ctp-label-slot \{
.*?
\n\}

'''
)

text = labels_css_pattern.sub(
    "",
    text,
    count=1,
)


# ------------------------------------------------------------
# 1.10 增加只读标签按钮样式
# ------------------------------------------------------------

name_display_css = '''
.ctp-name-display {
  display: flex;
  min-width: 0;
  flex: 1 1 auto;
  align-items: center;
  gap: 7px;
  height: 32px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: #333840;
  font-family: inherit;
  font-size: 13px;
  text-align: left;
  cursor: text;
  transition:
    border-color 0.12s ease,
    background-color 0.12s ease;

  &:hover {
    border-color: #e2e5e9;
    background: #f6f7f8;
  }

  &:focus-visible {
    outline:
      2px solid rgba(66, 99, 235, 0.3);
    outline-offset: 1px;
  }

  i {
    flex: 0 0 auto;
    color: #a0a6ae;
    font-size: 11px;
    opacity: 0;
    transition: opacity 0.12s ease;
  }

  &:hover i,
  &:focus-visible i {
    opacity: 1;
  }

  .dark-theme & {
    color: #e1e5ea;

    &:hover {
      border-color: #343b45;
      background: #252c35;
    }
  }
}

.ctp-name-display-text {
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 550;
}

.ctp-name-placeholder {
  min-width: 0;
  flex: 1 1 auto;
  color: #a0a6ae;
  font-weight: 400;
}
'''

if ".ctp-name-display {" not in text:
    style_close = text.rfind("</style>")

    if style_close < 0:
        fail("找不到 ColorPicker </style>")

    text = (
        text[:style_close]
        + name_display_css
        + "\n"
        + text[style_close:]
    )

write(color_path, text)


# ============================================================
# 2. LinkedTask NodeView
#
#    点击区域：
#    - 勾选框：切换完成
#    - 文字：进入行内编辑
#    - 更多：打开事项详情弹窗
#    - X：直接删除，不弹确认框
# ============================================================

linked_task_path = (
    "src/editor/extensions/LinkedTask.js"
)

linked_task_content = '''import {
  Node,
  mergeAttributes,
} from "@tiptap/core";

import focusTaskService from
  "../../services/focusTaskService";

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

          <button
            class="
              linked-task-jump
              linked-task-more
            "
            type="button"
            title="打开事项详情"
            aria-label="打开事项详情"
          >
            <svg
              viewBox="0 0 18 18"
              aria-hidden="true"
            >
              <circle
                cx="4"
                cy="9"
                r="1.3"
              />
              <circle
                cx="9"
                cy="9"
                r="1.3"
              />
              <circle
                cx="14"
                cy="9"
                r="1.3"
              />
            </svg>
          </button>

          <button
            class="linked-task-unlink"
            type="button"
            title="删除事项"
            aria-label="删除事项"
          >
            ×
          </button>
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
'''

write(
    linked_task_path,
    linked_task_content,
)


# ============================================================
# 3. FocusDocumentEditor
#    删除关联任务时不再弹二次确认
# ============================================================

focus_editor_path = (
    "src/views/focusDocuments/"
    "FocusDocumentEditor.vue"
)

text = read(focus_editor_path)

new_unlink_method = '''    async onTaskUnlink(event) {
      const attrs =
        this.normalizeTaskEvent(event);

      if (!attrs?.taskId) return;

      try {
        /*
         * 关联事项的 X 是明确删除动作，
         * 不再弹出浏览器确认框。
         */
        await focusTaskService
          .deleteLinkedTask({
            taskId: attrs.taskId,
            listId: attrs.listId,
          });
      } catch (error) {
        console.error(error);

        window.alert(
          error?.message ||
            "删除关联事项失败，请重试。"
        );
      }
    },
'''

text = replace_object_method(
    text,
    r"async\s+onTaskUnlink\(event\)\s*\{",
    new_unlink_method,
    "FocusDocumentEditor.onTaskUnlink",
)


# ============================================================
# 4. 关联事项行内编辑样式
# ============================================================

inline_edit_css = '''
/*
 * LINKED_TASK_INLINE_EDIT_V4
 *
 * 文字区域单击进入行内编辑；
 * 更多按钮才进入完整事项详情。
 */
:deep(.linked-task-main) {
  min-width: 0;
  flex: 1 1 auto;
  cursor: text;
}

:deep(.linked-task-title) {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.linked-task-title-input) {
  display: block;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  height: 30px;
  padding: 3px 8px;
  border:
    1px solid rgba(66, 99, 235, 0.58);
  border-radius: 6px;
  outline: none;
  background: #ffffff;
  color: #252a31;
  font: inherit;
  line-height: 22px;
  box-shadow:
    0 0 0 3px rgba(66, 99, 235, 0.1);
}

:deep(.linked-task-block.is-saving) {
  opacity: 0.72;
}

:deep(.linked-task-more svg) {
  width: 17px;
  height: 17px;
  fill: currentColor;
  stroke: none;
}

.dark-theme {
  :deep(.linked-task-title-input) {
    border-color:
      rgba(108, 143, 255, 0.72);
    background: #171b21;
    color: #e6e9ed;
    box-shadow:
      0 0 0 3px
      rgba(108, 143, 255, 0.12);
  }
}
'''

if "LINKED_TASK_INLINE_EDIT_V4" not in text:
    style_close = text.rfind("</style>")

    if style_close < 0:
        fail(
            "FocusDocumentEditor 中"
            "找不到 </style>"
        )

    text = (
        text[:style_close]
        + inline_edit_css
        + "\n"
        + text[style_close:]
    )

write(focus_editor_path, text)


# ============================================================
# 5. 静态验证
# ============================================================

checks = {
    color_path: [
        'class="ctp-name-display"',
        "editingName: false",
        "startNameEdit()",
        "cancelNameEdit()",
    ],
    linked_task_path: [
        "linked-task-title-input",
        "linked-task-more",
        "focusTaskService.updateTask",
        "focus-task-open",
        "focus-task-unlink",
    ],
    focus_editor_path: [
        "LINKED_TASK_INLINE_EDIT_V4",
        "deleteLinkedTask({",
    ],
}

for relative_path, markers in checks.items():
    content = read(relative_path)

    for marker in markers:
        if marker not in content:
            fail(
                f"验证失败：{relative_path} "
                f"缺少 {marker}"
            )

color_content = read(color_path)

if 'class="ctp-labels"' in color_content:
    fail("验证失败：颜色底部标签行仍然存在")

if "window.confirm(" in new_unlink_method:
    fail("验证失败：删除方法仍含确认弹窗")

print()
print("=" * 72)
print("补丁写入完成")
print(f"备份目录：{BACKUP_ROOT}")

for item in changed_files:
    print(f"  - {item}")

print("=" * 72)

run([
    "git",
    "diff",
    "--check",
    "--",
    color_path,
    linked_task_path,
    focus_editor_path,
])

run([
    "yarn",
    "electron:compile",
])

print()
print("=" * 72)
print("V4 补丁完成，Electron 编译通过。")
print()
print("启动预览：")
print("  yarn electron:preview")
print()
print("确认后提交：")
print(
    '  git add '
    'src/views/toDoModal/colorPicker.vue '
    'src/editor/extensions/LinkedTask.js '
    'src/views/focusDocuments/FocusDocumentEditor.vue '
    '&& git commit -m '
    '"feat: refine color labels and linked task interactions" '
    '&& git push'
)
print("=" * 72)
