'PY'
#!/usr/bin/env python3

from pathlib import Path
from datetime import datetime
import re
import shutil
import subprocess
import sys

ROOT = Path(
    "/Users/joey/Desktop/Joey-Workspace/MyProject/weektodo-main"
).resolve()

STAMP = datetime.now().strftime("%Y%m%d-%H%M%S")
BACKUP_ROOT = Path("/tmp") / f"weektodo-fix-v2-backup-{STAMP}"

changed_files = []
backup_created = set()


# ============================================================
# 基础工具
# ============================================================

def fail(message):
    raise RuntimeError(message)


def project_path(relative_path):
    path = ROOT / relative_path

    if not path.exists():
        fail(f"找不到目标文件：{relative_path}")

    return path


def read(relative_path):
    return project_path(relative_path).read_text(
        encoding="utf-8"
    )


def backup(relative_path):
    if relative_path in backup_created:
        return

    source = project_path(relative_path)
    target = BACKUP_ROOT / relative_path

    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)

    backup_created.add(relative_path)


def write(relative_path, content):
    path = project_path(relative_path)
    old_content = path.read_text(encoding="utf-8")

    if old_content == content:
        print(f"SKIP  {relative_path}")
        return False

    backup(relative_path)
    path.write_text(content, encoding="utf-8")

    changed_files.append(relative_path)
    print(f"PATCH {relative_path}")
    return True


def replace_exact(
    text,
    old,
    new,
    label,
    expected=None,
    minimum=1,
):
    count = text.count(old)

    if expected is not None and count != expected:
        fail(
            f"{label}：预期匹配 {expected} 次，"
            f"实际匹配 {count} 次。"
        )

    if count < minimum:
        fail(
            f"{label}：至少应匹配 {minimum} 次，"
            f"实际匹配 {count} 次。"
        )

    return text.replace(old, new)


def add_import_once(text, anchor, import_line, label):
    if import_line in text:
        return text

    if anchor not in text:
        fail(f"{label}：找不到 import 插入位置")

    return text.replace(
        anchor,
        anchor + "\n" + import_line,
        1,
    )


def replace_object_method(
    text,
    method_start_pattern,
    replacement,
    label,
):
    """
    替换 Vue Options API methods 中的单个方法。

    方法结束位置通过下一个同缩进的方法识别，例如：
      removeTodo: function () {
      async updateTodoList(...) {
      showToDoDetails: function () {
    """

    pattern = re.compile(
        rf"(?ms)^    {method_start_pattern}.*?"
        rf"(?=^    (?:async\s+)?"
        rf"[A-Za-z_$][A-Za-z0-9_$]*\s*(?:\(|:))"
    )

    matches = list(pattern.finditer(text))

    if len(matches) != 1:
        fail(
            f"{label}：预期定位到 1 个方法，"
            f"实际定位到 {len(matches)} 个。"
        )

    match = matches[0]

    return (
        text[:match.start()]
        + replacement.rstrip()
        + "\n"
        + text[match.end():]
    )


def run(command, check=True):
    print()
    print("$ " + " ".join(command))

    result = subprocess.run(
        command,
        cwd=ROOT,
        text=True,
    )

    if check and result.returncode != 0:
        fail(
            f"命令执行失败，退出码：{result.returncode}\n"
            f"命令：{' '.join(command)}"
        )

    return result.returncode


# ============================================================
# 项目检查
# ============================================================

if not ROOT.exists():
    fail(f"项目目录不存在：{ROOT}")

if not (ROOT / "package.json").exists():
    fail(f"目标目录不是 WeekToDo 项目：{ROOT}")

if not (ROOT / ".git").exists():
    print("警告：目标目录中没有发现 .git，但仍继续执行补丁。")

BACKUP_ROOT.mkdir(parents=True, exist_ok=True)

print("=" * 72)
print("WeekToDo fix_v2")
print(f"项目目录：{ROOT}")
print(f"备份目录：{BACKUP_ROOT}")
print("=" * 72)


# ============================================================
# 1. toDoListRepository
#    将事项列表写入改为真正可 await 的 IndexedDB 事务
# ============================================================

repository_path = "src/repositories/toDoListRepository.js"

repository_content = '''import dbRepository from "./dbRepository";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function runWrite(operation) {
  return new Promise((resolve, reject) => {
    const openRequest = dbRepository.open();

    openRequest.onerror = () => {
      reject(
        openRequest.error ||
          new Error("无法打开 WeekToDo 数据库")
      );
    };

    openRequest.onsuccess = (event) => {
      const db = event.target.result;

      try {
        const transaction = db.transaction(
          ["todo_lists"],
          "readwrite"
        );
        const store =
          transaction.objectStore("todo_lists");

        operation(store);

        transaction.oncomplete = () => {
          db.close();
          resolve();
        };

        transaction.onerror = () => {
          const error =
            transaction.error ||
            new Error("事项列表保存失败");

          db.close();
          reject(error);
        };

        transaction.onabort = () => {
          const error =
            transaction.error ||
            new Error("事项列表保存事务已中止");

          db.close();
          reject(error);
        };
      } catch (error) {
        db.close();
        reject(error);
      }
    };
  });
}

export default {
  update(toDoListId, toDoList) {
    const safeList = clone(
      Array.isArray(toDoList) ? toDoList : []
    );

    return runWrite((store) => {
      store.put(safeList, toDoListId);
    });
  },

  remove(toDoListId) {
    return runWrite((store) => {
      store.delete(toDoListId);
    });
  },
};
'''

write(repository_path, repository_content)


# ============================================================
# 2. 灰色标签不再默认显示“未分类”
#    兼容上一次脚本已经修改完成的状态
# ============================================================

default_tags_path = "src/data/defaultTaskTags.js"
text = read(default_tags_path)

old_gray_line = (
    '{ id: "tag_gray",   color: "#9ca3af", '
    'defaultName: "未分类", primary: true,  order: 5 },'
)

new_gray_line = (
    '{ id: "tag_gray",   color: "#9ca3af", '
    'defaultName: "",       primary: true,  order: 5 },'
)

if old_gray_line in text:
    text = text.replace(old_gray_line, new_gray_line, 1)
elif new_gray_line not in text:
    fail("无法识别 defaultTaskTags.js 中的灰色标签定义")

write(default_tags_path, text)


# ============================================================
# 3. ColorPicker
#    修复日期抢焦点、空心颜色无反馈、灰色标签文字
# ============================================================

color_picker_path = "src/views/toDoModal/colorPicker.vue"
text = read(color_picker_path)

# 面板接管键盘焦点。
if 'aria-label="颜色标签"' not in text:
    text = replace_exact(
        text,
        '''          class="ctp-panel"
          :style="panelPos"
          @mousedown.stop
          @click.stop''',
        '''          class="ctp-panel"
          :style="panelPos"
          tabindex="-1"
          role="dialog"
          aria-label="颜色标签"
          @mousedown.stop
          @click.stop
          @keydown.stop''',
        "ColorPicker 面板焦点",
        expected=1,
    )

# 标签输入框阻断键盘事件。
if '@keydown.enter.stop.prevent="commitName"' not in text:
    text = replace_exact(
        text,
        '''              @keydown.enter.prevent="commitName"
              @blur="commitName"''',
        '''              @mousedown.stop
              @click.stop
              @keydown.stop
              @keydown.enter.stop.prevent="commitName"
              @blur="commitName"''',
        "ColorPicker 标签输入框",
        expected=1,
    )

# 空心颜色按钮。
if 'aria-label="清除颜色标签"' not in text:
    text = replace_exact(
        text,
        '''              title="无标签"
              @click="pickColor('none')"''',
        '''              title="无颜色"
              aria-label="清除颜色标签"
              @mousedown.prevent.stop
              @click.stop="pickColor('none')"''',
        "ColorPicker 空心颜色按钮",
        expected=1,
    )

# 主色和扩展色使用的是同一段模板，因此这里明确允许出现两次。
old_color_button = '''              :title="tag.name || tag.color"
              @click="pickColor(tag.color)"'''

new_color_button = '''              :title="tag.name || '选择此颜色'"
              :aria-label="tag.name || '选择此颜色'"
              @mousedown.prevent.stop
              @click.stop="pickColor(tag.color)"'''

if old_color_button in text:
    count = text.count(old_color_button)

    if count not in (1, 2):
        fail(
            "ColorPicker 色块按钮："
            f"预期匹配 1 或 2 次，实际匹配 {count} 次"
        )

    text = text.replace(
        old_color_button,
        new_color_button,
    )

# 标签名称由静态 span 改成可交互按钮。
if '@click.stop="beginRename(tag)"' not in text:
    text = replace_exact(
        text,
        '''            <span
              v-for="tag in primaryTags"
              :key="tag.id"
              class="ctp-label-slot"
              :style="{ color: tag.color }"
            >{{ tag.name }}</span>''',
        '''            <button
              v-for="tag in primaryTags"
              :key="tag.id"
              type="button"
              class="ctp-label-slot"
              :class="{
                'is-empty':
                  !tag.name || tag.id === 'tag_gray',
              }"
              :style="{ color: tag.color }"
              :aria-label="
                tag.name
                  ? `编辑标签：${tag.name}`
                  : '选择颜色后编辑标签'
              "
              @mousedown.prevent.stop
              @click.stop="beginRename(tag)"
            >{{
              tag.id === "tag_gray" ? "" : tag.name
            }}</button>''',
        "ColorPicker 标签名称按钮",
        expected=1,
    )

# 替换 togglePanel 到 commitName 前的相关方法。
if "focusNameInput(select = false)" not in text:
    old_methods = '''      this.open = true;
    },

    pickColor(color) {
      this.$emit("color-selected", color);
      /* 立即刷新，确保 editableTag computed 能找到匹配 */
      this.refreshTags();
    },

    commitName() {'''

    new_methods = '''      this.open = true;

      /*
       * ColorPicker 通过 Teleport 挂载到 body。
       * 如果不主动转移焦点，键盘输入可能继续进入顶部
       * 原生 date input，最终表现为日期年份被修改。
       */
      this.$nextTick(() => {
        this.$refs.panel?.focus({
          preventScroll: true,
        });

        if (
          this.hasColor &&
          this.$refs.nameInput
        ) {
          this.$refs.nameInput.focus({
            preventScroll: true,
          });
        }
      });
    },

    focusNameInput(select = false) {
      this.$nextTick(() => {
        const input = this.$refs.nameInput;
        if (!input) return;

        input.focus({
          preventScroll: true,
        });

        if (select) input.select();
      });
    },

    beginRename(tag) {
      if (!tag) return;

      this.$emit(
        "color-selected",
        tag.color
      );
      this.refreshTags();
      this.focusNameInput(true);
    },

    pickColor(color) {
      this.$emit(
        "color-selected",
        color
      );
      this.refreshTags();

      if (color && color !== "none") {
        this.focusNameInput(false);
      } else {
        this.$nextTick(() => {
          this.$refs.panel?.focus({
            preventScroll: true,
          });
        });
      }
    },

    commitName() {'''

    text = replace_exact(
        text,
        old_methods,
        new_methods,
        "ColorPicker 焦点管理方法",
        expected=1,
    )

# 修复无效 CSS：border-color: currentColor。
if "&.is-active { border-color: currentColor; }" in text:
    text = text.replace(
        "&.is-active { border-color: currentColor; }",
        '''&.is-active {
    border-color: #20242b;
    box-shadow:
      0 0 0 2px rgba(66, 99, 235, 0.12);

    .dark-theme & {
      border-color: #f0f3f6;
      box-shadow:
        0 0 0 2px rgba(108, 143, 255, 0.18);
    }
  }

  &:focus-visible {
    outline:
      2px solid rgba(66, 99, 235, 0.45);
    outline-offset: 1px;
  }

  &:active {
    transform: scale(0.96);
  }''',
        1,
    )

old_label_css = '''.ctp-label-slot {
  font-size: 9px; font-weight: 500; text-align: center;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}'''

new_label_css = '''.ctp-label-slot {
  min-width: 0;
  height: 18px;
  padding: 0 2px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  font-family: inherit;
  font-size: 9px;
  font-weight: 500;
  line-height: 18px;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: text;

  &:hover:not(.is-empty) {
    background: #f3f4f6;
  }

  &:focus-visible {
    outline:
      2px solid rgba(66, 99, 235, 0.35);
  }

  &.is-empty {
    color: transparent !important;
    cursor: default;
  }

  .dark-theme &:hover:not(.is-empty) {
    background: #252c35;
  }
}'''

if old_label_css in text:
    text = text.replace(
        old_label_css,
        new_label_css,
        1,
    )

write(color_picker_path, text)


# ============================================================
# 4. FocusTaskService
#    物理删除关联表和所有重点文档中的 linkedTask 节点
# ============================================================

focus_service_path = "src/services/focusTaskService.js"
text = read(focus_service_path)

if "function pruneLinkedTaskNodes(" not in text:
    anchor = '''function dispatchChange(detail) {
  window.dispatchEvent(
    new CustomEvent("weektodo:task-changed", { detail })
  );
}
'''

    helper = '''function dispatchChange(detail) {
  window.dispatchEvent(
    new CustomEvent("weektodo:task-changed", { detail })
  );
}

function pruneLinkedTaskNodes(node, taskId) {
  if (!node || typeof node !== "object") {
    return node;
  }

  if (
    node.type === "linkedTask" &&
    node.attrs?.taskId === taskId
  ) {
    return null;
  }

  const next = { ...node };

  if (Array.isArray(node.content)) {
    next.content = node.content
      .map((child) =>
        pruneLinkedTaskNodes(child, taskId)
      )
      .filter(Boolean);
  }

  if (
    next.type === "doc" &&
    (
      !Array.isArray(next.content) ||
      !next.content.length
    )
  ) {
    next.content = [
      { type: "paragraph" },
    ];
  }

  return next;
}
'''

    text = replace_exact(
        text,
        anchor,
        helper,
        "FocusTaskService 节点清理函数",
        expected=1,
    )

if "async purgeTaskReferences(taskId)" not in text:
    unlink_anchor = (
        "  async unlink({ documentId, taskId, blockId, "
        "deleteTask = false, listId = null }) {"
    )

    methods = '''  async purgeTaskReferences(taskId) {
    if (!taskId) return;

    const links =
      await focusDataRepository.getAllByIndex(
        FOCUS_STORES.taskLinks,
        "taskId",
        taskId
      );

    const documentIds = [
      ...new Set(
        links
          .map((link) => link.documentId)
          .filter(Boolean)
      ),
    ];

    await Promise.all(
      documentIds.map(async (documentId) => {
        const document =
          await focusDataRepository.get(
            FOCUS_STORES.documents,
            documentId
          );

        if (!document) return;

        const nextContent =
          pruneLinkedTaskNodes(
            document.content,
            taskId
          );

        if (
          JSON.stringify(nextContent) ===
          JSON.stringify(document.content)
        ) {
          return;
        }

        await focusDataRepository.put(
          FOCUS_STORES.documents,
          {
            ...document,
            content: nextContent,
            updatedAt:
              new Date().toISOString(),
          }
        );
      })
    );

    await Promise.all(
      links.map((link) =>
        focusDataRepository.remove(
          FOCUS_STORES.taskLinks,
          link.id
        )
      )
    );
  },

  async deleteLinkedTask({
    taskId,
    listId = null,
  }) {
    if (!taskId) return false;

    const deleted =
      await todoTaskRepository.deleteTask(
        taskId,
        listId
      );

    await this.purgeTaskReferences(taskId);

    dispatchChange({
      action: "deleted",
      taskId,
      listId,
    });

    return deleted;
  },

  async handleExternalDeletion({
    taskId,
    listId = null,
  }) {
    if (!taskId) return;

    await this.purgeTaskReferences(taskId);

    dispatchChange({
      action: "deleted",
      taskId,
      listId,
    });
  },

'''

    if unlink_anchor not in text:
        fail(
            "FocusTaskService："
            "找不到 unlink 方法插入位置"
        )

    text = text.replace(
        unlink_anchor,
        methods + unlink_anchor,
        1,
    )

write(focus_service_path, text)


# ============================================================
# 5. FocusDocumentEditor
#    从重点事项删除时，同时删除每周事项主任务
# ============================================================

focus_editor_path = (
    "src/views/focusDocuments/"
    "FocusDocumentEditor.vue"
)

text = read(focus_editor_path)

new_on_task_unlink = '''    async onTaskUnlink(event) {
      const attrs =
        this.normalizeTaskEvent(event);

      if (!attrs?.taskId) return;

      const confirmed = window.confirm(
        "确定删除该关联事项吗？\\n\\n"
        + "删除后，它会同时从每周事项和"
        + "所有重点文档中移除。"
      );

      if (!confirmed) return;

      try {
        await focusTaskService.deleteLinkedTask({
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

if '确定删除该关联事项吗？' not in text:
    text = replace_object_method(
        text,
        r"async\s+onTaskUnlink\(event\)\s*\{",
        new_on_task_unlink,
        "FocusDocumentEditor.onTaskUnlink",
    )

if "removeTaskNodes(taskId)" not in text:
    on_changed_match = re.search(
        r"(?m)^    onTaskChanged\(event\)\s*\{",
        text,
    )

    if not on_changed_match:
        fail(
            "FocusDocumentEditor："
            "找不到 onTaskChanged 方法"
        )

    remove_task_nodes = '''    removeTaskNodes(taskId) {
      if (!this.editor || !taskId) return;

      const prune = (node) => {
        if (
          !node ||
          typeof node !== "object"
        ) {
          return node;
        }

        if (
          node.type === "linkedTask" &&
          node.attrs?.taskId === taskId
        ) {
          return null;
        }

        const next = { ...node };

        if (Array.isArray(node.content)) {
          next.content = node.content
            .map(prune)
            .filter(Boolean);
        }

        if (
          next.type === "doc" &&
          (
            !Array.isArray(next.content) ||
            !next.content.length
          )
        ) {
          next.content = [
            { type: "paragraph" },
          ];
        }

        return next;
      };

      const current =
        this.editor.getJSON();
      const next = prune(current);

      if (
        JSON.stringify(current) !==
        JSON.stringify(next)
      ) {
        this.editor.commands.setContent(
          next,
          { emitUpdate: true }
        );
      }
    },

'''

    text = (
        text[:on_changed_match.start()]
        + remove_task_nodes
        + text[on_changed_match.start():]
    )

new_on_task_changed = '''    onTaskChanged(event) {
      const taskId =
        event.detail?.taskId;

      if (!taskId) return;

      if (
        event.detail?.action === "deleted"
      ) {
        this.removeTaskNodes(taskId);
        return;
      }

      this.refreshLinkedTasks();
    },
'''

if 'event.detail?.action === "deleted"' not in text:
    text = replace_object_method(
        text,
        r"onTaskChanged\(event\)\s*\{",
        new_on_task_changed,
        "FocusDocumentEditor.onTaskChanged",
    )

write(focus_editor_path, text)


# ============================================================
# 6. toDoModal
#    每周事项详情弹窗删除后，清理重点事项关联
# ============================================================

todo_modal_path = (
    "src/views/toDoModal/toDoModal.vue"
)

text = read(todo_modal_path)

text = add_import_once(
    text,
    'import defaultTaskTags from "../../data/defaultTaskTags.js";',
    'import focusTaskService from "../../services/focusTaskService.js";',
    "toDoModal 引入 focusTaskService",
)

new_update_todo_list = '''    updateTodoList: async function (
      todoListId,
      TodoList
    ) {
      notifications.refreshDayNotifications(
        this,
        todoListId
      );

      const taskSnapshot = this.todo
        ? JSON.parse(
            JSON.stringify(this.todo)
          )
        : null;

      try {
        /*
         * 先等待 IndexedDB 事务完成，
         * 再通知重点事项读取新数据。
         */
        await toDoListRepository.update(
          todoListId,
          TodoList
        );

        window.dispatchEvent(
          new CustomEvent(
            "weektodo:task-changed",
            {
              detail: {
                action: "updated",
                taskId:
                  taskSnapshot?.id || null,
                listId:
                  taskSnapshot?.listId ||
                  todoListId,
                task: taskSnapshot,
              },
            }
          )
        );
      } catch (error) {
        console.error(
          "保存事项失败：",
          error
        );
      }
    },
'''

if "updateTodoList: async function" not in text:
    text = replace_object_method(
        text,
        r"updateTodoList:\s*function\s*\(",
        new_update_todo_list,
        "toDoModal.updateTodoList",
    )

new_remove_todo = '''    removeTodo: async function () {
      const deletedTodo = JSON.parse(
        JSON.stringify(this.todo)
      );

      if (
        this.todo._spanId &&
        this.todo.endDate
      ) {
        const sourceId =
          this.todo._isSpanMirror
            ? this.todo._spanSourceId
            : this.todo.listId;

        clearMirrorsBySpanId(
          this.todo._spanId,
          sourceId,
          this.todo.endDate,
          this.$store
        );

        if (
          this.todo._isSpanMirror &&
          this.todo._spanSourceId
        ) {
          const sourceList =
            this.$store.getters.todoLists[
              this.todo._spanSourceId
            ];

          if (sourceList) {
            const sourceIndex =
              sourceList.findIndex(
                (task) =>
                  !task._isSpanMirror &&
                  task._spanId ===
                    this.todo._spanId
              );

            if (sourceIndex !== -1) {
              sourceList.splice(
                sourceIndex,
                1
              );

              await toDoListRepository.update(
                this.todo._spanSourceId,
                sourceList
              );
            }
          }
        }
      }

      const currentList =
        this.$store.getters.todoLists[
          deletedTodo.listId
        ] || [];

      const currentIndex =
        currentList.findIndex(
          (task) =>
            task === this.todo ||
            (
              deletedTodo.id &&
              task?.id === deletedTodo.id
            )
        );

      this.$store.commit(
        "setUndoElement",
        {
          type: "task",
          todo: deletedTodo,
          index:
            currentIndex >= 0
              ? currentIndex
              : this.index,
        }
      );

      if (currentIndex >= 0) {
        this.$store.commit(
          "removeTodo",
          {
            toDoListId:
              deletedTodo.listId,
            index: currentIndex,
          }
        );
      }

      notifications.refreshDayNotifications(
        this,
        deletedTodo.listId
      );

      try {
        await toDoListRepository.update(
          deletedTodo.listId,
          this.$store.getters.todoLists[
            deletedTodo.listId
          ] || []
        );

        await focusTaskService
          .handleExternalDeletion({
            taskId: deletedTodo.id,
            listId: deletedTodo.listId,
          });
      } catch (error) {
        console.error(
          "删除事项关联失败：",
          error
        );

        window.alert(
          error?.message ||
            "事项已从当前列表移除，"
            + "但关联清理失败，请重试。"
        );
      }

      const toast = new Toast(
        document.getElementById(
          "taskRemoved"
        )
      );

      toast.show();
    },
'''

if (
    "handleExternalDeletion({" not in text
    or "removeTodo: async function" not in text
):
    text = replace_object_method(
        text,
        r"removeTodo:\s*(?:async\s+)?function\s*\(\)\s*\{",
        new_remove_todo,
        "toDoModal.removeTodo",
    )

write(todo_modal_path, text)


# ============================================================
# 7. activeToDo
#    快捷删除同样清理重点事项关联
# ============================================================

active_todo_path = "src/components/activeToDo.vue"
text = read(active_todo_path)

text = add_import_once(
    text,
    'import defaultTaskTags from "../data/defaultTaskTags.js";',
    'import focusTaskService from "../services/focusTaskService.js";',
    "activeToDo 引入 focusTaskService",
)

new_active_remove = '''    removeTodo: async function () {
      const todo = JSON.parse(
        JSON.stringify(
          this.activeTodo.toDo
        )
      );

      if (
        isSpanningTask(todo) &&
        todo._spanId
      ) {
        const sourceId =
          todo._isSpanMirror
            ? todo._spanSourceId
            : todo.listId;

        clearMirrorsBySpanId(
          todo._spanId,
          sourceId,
          todo.endDate,
          this.$store
        );

        if (
          todo._isSpanMirror &&
          todo._spanSourceId
        ) {
          const sourceList =
            this.$store.getters.todoLists[
              todo._spanSourceId
            ];

          if (sourceList) {
            const sourceIndex =
              sourceList.findIndex(
                (task) =>
                  !task._isSpanMirror &&
                  task._spanId ===
                    todo._spanId
              );

            if (sourceIndex !== -1) {
              sourceList.splice(
                sourceIndex,
                1
              );

              await toDoListRepository.update(
                todo._spanSourceId,
                sourceList
              );
            }
          }
        }
      }

      const listId =
        this.activeTodo.toDoListId;

      const currentList =
        this.$store.getters.todoLists[
          listId
        ] || [];

      const currentIndex =
        currentList.findIndex(
          (task) =>
            task === this.activeTodo.toDo ||
            (
              todo.id &&
              task?.id === todo.id
            )
        );

      this.$store.commit(
        "setUndoElement",
        {
          type: "task",
          todo,
          index:
            currentIndex >= 0
              ? currentIndex
              : this.activeTodo.index,
        }
      );

      if (currentIndex >= 0) {
        this.$store.commit(
          "removeTodo",
          {
            toDoListId: listId,
            index: currentIndex,
          }
        );
      }

      notifications.refreshDayNotifications(
        this,
        listId
      );

      try {
        await toDoListRepository.update(
          listId,
          this.$store.getters.todoLists[
            listId
          ] || []
        );

        await focusTaskService
          .handleExternalDeletion({
            taskId: todo.id,
            listId,
          });
      } catch (error) {
        console.error(
          "删除事项关联失败：",
          error
        );

        window.alert(
          error?.message ||
            "事项已从当前列表移除，"
            + "但关联清理失败，请重试。"
        );
      }

      const toast = new Toast(
        document.getElementById(
          "taskRemoved"
        )
      );

      toast.show();
      this.hideToDoItem();
    },
'''

if (
    "handleExternalDeletion({" not in text
    or "removeTodo: async function" not in text
):
    text = replace_object_method(
        text,
        r"removeTodo:\s*(?:async\s+)?function\s*\(\)\s*\{",
        new_active_remove,
        "activeToDo.removeTodo",
    )

write(active_todo_path, text)


# ============================================================
# 8. toDoItem
#    行内修改也等待数据库落盘
# ============================================================

todo_item_path = "src/components/toDoItem.vue"
text = read(todo_item_path)

if "doneEdit: async function" not in text:
    text = text.replace(
        "    doneEdit: function () {",
        "    doneEdit: async function () {",
        1,
    )

update_pattern = re.compile(
    r'''(?ms)^      toDoListRepository\.update\(
        this\.toDoListId,
        this\.\$store\.getters\.todoLists\[this\.toDoListId\]
      \);'''
)

if update_pattern.search(text):
    text = update_pattern.sub(
        '''      await toDoListRepository.update(
        this.toDoListId,
        this.$store.getters.todoLists[
          this.toDoListId
        ]
      );''',
        text,
        count=1,
    )

write(todo_item_path, text)


# ============================================================
# 9. 静态检查
# ============================================================

print()
print("=" * 72)
print("补丁阶段完成")
print(f"备份目录：{BACKUP_ROOT}")

if changed_files:
    print("本次修改文件：")

    for relative_path in changed_files:
        print(f"  - {relative_path}")
else:
    print("没有产生新修改：当前代码可能已经应用 fix_v2。")

print("=" * 72)

run(["git", "diff", "--check"])

# 检查关键标记。
required_markers = {
    "src/views/toDoModal/colorPicker.vue": [
        'aria-label="清除颜色标签"',
        "focusNameInput(select = false)",
        '@click.stop="beginRename(tag)"',
    ],
    "src/services/focusTaskService.js": [
        "async purgeTaskReferences(taskId)",
        "async deleteLinkedTask({",
        "async handleExternalDeletion({",
    ],
    "src/views/focusDocuments/FocusDocumentEditor.vue": [
        "removeTaskNodes(taskId)",
        'event.detail?.action === "deleted"',
    ],
    "src/views/toDoModal/toDoModal.vue": [
        "updateTodoList: async function",
        "removeTodo: async function",
        "handleExternalDeletion({",
    ],
    "src/components/activeToDo.vue": [
        "removeTodo: async function",
        "handleExternalDeletion({",
    ],
}

for relative_path, markers in required_markers.items():
    content = read(relative_path)

    for marker in markers:
        if marker not in content:
            fail(
                f"补丁验证失败：{relative_path} "
                f"缺少标记：{marker}"
            )

print()
print("关键代码标记验证通过。")

# 编译，不直接启动 electron:preview，避免脚本持续阻塞。
run(["yarn", "electron:compile"])

print()
print("=" * 72)
print("fix_v2 执行完成，Electron 编译通过。")
print()
print("下一步：")
print("  yarn electron:preview")
print()
print("确认功能正常后再执行：")
print(
    '  git add . && '
    'git commit -m "fix: unify color labels and linked task synchronization" '
    '&& git push'
)
print("=" * 72)

PY
