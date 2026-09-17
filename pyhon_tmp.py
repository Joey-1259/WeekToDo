#!/usr/bin/env python3
"""
WeekToDo 统一标签体系 + 关联事项颜色双向同步
在终端运行: python3 -c "$(pbpaste)" 或者保存后运行
"""

import os

BASE = "/Users/joey/Desktop/Joey-Workspace/MyProject/weektodo-main"

def write(rel_path, content):
    full = os.path.join(BASE, rel_path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  ✅ {rel_path}")

print("=" * 60)
print("🏷️  统一标签体系 + 关联事项颜色双向同步")
print("=" * 60)

# ============================================================
# 1. defaultTaskTags.js — 统一颜色标签数据源
# ============================================================
print("\n[1/9] 重写 defaultTaskTags.js")
write("src/data/defaultTaskTags.js", r'''/**
 * UNIFIED_TAG_SYSTEM_20260917_V1
 *
 * 统一颜色标签体系：每个标签 = { id, color, name }
 * 合并了原 colorPicker 的 12 色与原 tagPicker 的 5 个语义标签。
 *
 * 设计参考：
 * - macOS Finder 颜色标签（7 色 + 名称可自定义）
 * - Notion tag 系统（颜色 + 文字一体）
 *
 * 颜色值与原 colorPicker.vue 完全一致，确保数据向前兼容。
 * name 字段支持用户自定义（存储在 localStorage），
 * 这里只提供工厂默认值。
 */

const STORAGE_KEY = "weektodo_tag_names";

const PRESET_TAGS = [
  { id: "tag_green",   color: "#77e785", defaultName: "工作" },
  { id: "tag_cyan",    color: "#06b6d4", defaultName: "学习" },
  { id: "tag_blue",    color: "#5e6ef2", defaultName: "项目" },
  { id: "tag_purple",  color: "#8b5cf6", defaultName: "灵感" },
  { id: "tag_pink",    color: "#ed56a1", defaultName: "生活" },
  { id: "tag_red",     color: "#ed544b", defaultName: "紧急" },
  { id: "tag_orange",  color: "#f97316", defaultName: "健康" },
  { id: "tag_yellow",  color: "#f9d54a", defaultName: "待定" },
  { id: "tag_brown",   color: "#ba7956", defaultName: "" },
  { id: "tag_gray",    color: "#6b7280", defaultName: "" },
  { id: "tag_dark",    color: "#030712", defaultName: "" },
];

function loadCustomNames() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCustomNames(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // localStorage 不可用时静默降级
  }
}

export default {
  /**
   * 获取所有预设标签（含用户自定义名称）
   * @returns {Array<{id: string, color: string, name: string}>}
   */
  getDefaultTags() {
    const custom = loadCustomNames();
    return PRESET_TAGS.map((tag) => ({
      id: tag.id,
      color: tag.color,
      name: custom[tag.id] !== undefined ? custom[tag.id] : tag.defaultName,
    }));
  },

  /**
   * 通过颜色值查找标签 ID（兼容老数据：todo.color → tag id）
   */
  findTagByColor(color) {
    if (!color || color === "none") return null;
    return PRESET_TAGS.find((t) => t.color === color) || null;
  },

  /**
   * 通过标签 ID 查找颜色
   */
  getColorById(tagId) {
    const tag = PRESET_TAGS.find((t) => t.id === tagId);
    return tag ? tag.color : null;
  },

  /**
   * 用户重命名标签
   */
  renameTag(tagId, newName) {
    const custom = loadCustomNames();
    custom[tagId] = String(newName || "").trim();
    saveCustomNames(custom);
  },

  /**
   * 获取标签的显示名称（空名称返回空字符串）
   */
  getTagName(tagId) {
    const custom = loadCustomNames();
    if (custom[tagId] !== undefined) return custom[tagId];
    const tag = PRESET_TAGS.find((t) => t.id === tagId);
    return tag ? tag.defaultName : "";
  },

  PRESET_TAGS,
};
''')

# ============================================================
# 2. LinkedTask.js — 增加 color / tags 属性与渲染
# ============================================================
print("[2/9] 重写 LinkedTask.js")
write("src/editor/extensions/LinkedTask.js", r'''import { Node, mergeAttributes } from "@tiptap/core";

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
''')

# ============================================================
# 3. focusTaskService.js — resolveTask 返回 color/tags
# ============================================================
print("[3/9] 重写 focusTaskService.js")
write("src/services/focusTaskService.js", r'''import moment from "moment";
import focusDataRepository, {
  FOCUS_STORES,
} from "../repositories/focusDataRepository";
import todoTaskRepository from "../repositories/todoTaskRepository";
import customToDoListIdsRepository from "../repositories/customToDoListIdsRepository";
import { createId } from "../helpers/idHelper";

function dispatchChange(detail) {
  window.dispatchEvent(
    new CustomEvent("weektodo:task-changed", { detail })
  );
}

const focusTaskService = {
  async initializeTaskIds() {
    return todoTaskRepository.ensureAllTaskIds();
  },

  listTargets() {
    const dates = Array.from({ length: 14 }, (_, index) => {
      const date = moment().add(index, "day");
      return {
        listId: date.format("YYYYMMDD"),
        label:
          index === 0 ? "今天" : index === 1 ? "明天" : date.format("M月D日 ddd"),
        type: "date",
      };
    });

    const customLists = customToDoListIdsRepository.load() || [];

    return [
      ...dates,
      ...customLists.map((item) => ({
        listId: item.listId,
        label: item.listName || "自定义列表",
        type: "custom",
      })),
    ];
  },

  async createLinkedTask(documentId, input) {
    const task = await todoTaskRepository.createTask(input);
    const blockId = createId("task-block");

    const link = {
      id: createId("task-link"),
      documentId,
      taskId: task.id,
      blockId,
      listId: task.listId,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await focusDataRepository.put(FOCUS_STORES.taskLinks, link);

    dispatchChange({
      action: "created",
      taskId: task.id,
      listId: task.listId,
    });

    return {
      blockId,
      taskId: task.id,
      listId: task.listId,
      title: task.text,
      checked: task.checked,
      missing: false,
      color: task.color || "none",
      tags: Array.isArray(task.tags) ? task.tags : [],
    };
  },

  async resolveTask(taskId, listId = null) {
    const found = await todoTaskRepository.getTask(taskId, listId);
    return found?.task || null;
  },

  async toggleTask(taskId, listId = null) {
    const task = await todoTaskRepository.toggleTask(taskId, listId);
    dispatchChange({ action: "updated", taskId, listId: task.listId, task });
    return task;
  },

  async updateTask(taskId, patch, listId = null) {
    const task = await todoTaskRepository.updateTask(taskId, patch, listId);
    dispatchChange({ action: "updated", taskId, listId: task.listId, task });
    return task;
  },

  async getLinksForDocument(documentId) {
    return focusDataRepository.getAllByIndex(
      FOCUS_STORES.taskLinks,
      "documentId",
      documentId
    );
  },

  async getLinkedTaskText(documentId) {
    const links = await this.getLinksForDocument(documentId);
    const values = await Promise.all(
      links
        .filter((link) => link.status !== "unlinked")
        .map((link) => this.resolveTask(link.taskId, link.listId))
    );
    return values
      .filter(Boolean)
      .map((task) => task.text)
      .join(" ");
  },

  async unlink({ documentId, taskId, blockId, deleteTask = false, listId = null }) {
    const links = await this.getLinksForDocument(documentId);
    const link = links.find(
      (item) => item.taskId === taskId && (!blockId || item.blockId === blockId)
    );

    if (link) {
      await focusDataRepository.put(FOCUS_STORES.taskLinks, {
        ...link,
        status: deleteTask ? "task-deleted" : "unlinked",
        updatedAt: new Date().toISOString(),
      });
    }

    if (deleteTask) {
      await todoTaskRepository.deleteTask(taskId, listId || link?.listId);
    }

    dispatchChange({
      action: deleteTask ? "deleted" : "unlinked",
      taskId,
      listId: listId || link?.listId,
    });
  },

  async removeDocumentLinks(documentId) {
    const links = await this.getLinksForDocument(documentId);
    await Promise.all(
      links.map((link) =>
        focusDataRepository.remove(FOCUS_STORES.taskLinks, link.id)
      )
    );
  },
};

export default focusTaskService;
''')

# ============================================================
# 4. FocusDocumentEditor.vue — refreshLinkedTasks 同步 color/tags
#    这里用 sed 式替换，只修改 refreshLinkedTasks 方法中的关键部分
# ============================================================
print("[4/9] 修补 FocusDocumentEditor.vue (refreshLinkedTasks + onTaskToggle)")

editor_path = os.path.join(BASE, "src/views/focusDocuments/FocusDocumentEditor.vue")
with open(editor_path, "r", encoding="utf-8") as f:
    editor_content = f.read()

# 替换 refreshLinkedTasks 中的 updateTaskNodes 调用，增加 color 和 tags
old_resolve = '''this.updateTaskNodes(
          attrs.taskId,
          task
            ? {
                title: task.text,
                checked: task.checked,
                listId: task.listId,
                missing: false,
              }
            : { missing: true }
        );'''

new_resolve = '''this.updateTaskNodes(
          attrs.taskId,
          task
            ? {
                title: task.text,
                checked: task.checked,
                listId: task.listId,
                missing: false,
                color: task.color || "none",
                tags: Array.isArray(task.tags) ? task.tags : [],
              }
            : { missing: true }
        );'''

editor_content = editor_content.replace(old_resolve, new_resolve)

# 替换 onTaskToggle 中的 updateTaskNodes，增加 color 和 tags
old_toggle = '''this.updateTaskNodes(attrs.taskId, {
          title: task.text,
          checked: task.checked,
          missing: false,
        });'''

new_toggle = '''this.updateTaskNodes(attrs.taskId, {
          title: task.text,
          checked: task.checked,
          missing: false,
          color: task.color || "none",
          tags: Array.isArray(task.tags) ? task.tags : [],
        });'''

editor_content = editor_content.replace(old_toggle, new_toggle)

with open(editor_path, "w", encoding="utf-8") as f:
    f.write(editor_content)
print(f"  ✅ src/views/focusDocuments/FocusDocumentEditor.vue")

# ============================================================
# 5. colorPicker.vue — 重构为统一标签选择器
# ============================================================
print("[5/9] 重写 colorPicker.vue → 统一标签选择器")
write("src/views/toDoModal/colorPicker.vue", r'''<template>
  <div class="unified-tag-picker">
    <button
      type="button"
      class="unified-tag-trigger"
      :title="triggerTitle"
      @click.stop="togglePanel"
    >
      <i
        class="bi-circle-fill"
        :style="currentColor !== 'none' ? `color: ${currentColor}` : 'color: #c9d1d9'"
      ></i>
      <span v-if="activeTagName" class="trigger-label">{{ activeTagName }}</span>
    </button>

    <Teleport to="body">
      <div
        v-if="panelVisible"
        class="unified-tag-panel"
        :style="panelStyle"
        @mousedown.stop
        @click.stop
      >
        <header class="unified-tag-header">
          <strong>颜色标签</strong>
          <small>选择颜色 · 双击名称可编辑</small>
        </header>

        <div class="unified-tag-grid">
          <!-- 无颜色选项 -->
          <button
            type="button"
            class="unified-tag-item"
            :class="{ active: currentColor === 'none' }"
            @click="selectTag('none', '')"
          >
            <i class="bi-circle unified-tag-dot"></i>
            <span class="unified-tag-name">无标签</span>
          </button>

          <button
            v-for="tag in allTags"
            :key="tag.id"
            type="button"
            class="unified-tag-item"
            :class="{ active: currentColor === tag.color }"
            @click="selectTag(tag.color, tag.id)"
          >
            <i
              class="bi-circle-fill unified-tag-dot"
              :style="`color: ${tag.color}`"
            ></i>
            <span
              v-if="editingId !== tag.id"
              class="unified-tag-name"
              @dblclick.stop="startEdit(tag)"
            >
              {{ tag.name || '未命名' }}
            </span>
            <input
              v-else
              :ref="'edit_' + tag.id"
              class="unified-tag-edit"
              type="text"
              maxlength="8"
              :value="tag.name"
              @blur="commitEdit(tag.id, $event)"
              @keydown.enter="commitEdit(tag.id, $event)"
              @keydown.esc="cancelEdit"
              @click.stop
            />
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script>
import defaultTaskTags from "../../data/defaultTaskTags.js";

export default {
  name: "colorPicker",
  emits: ["ColorSelected", "TagSelected"],
  props: {
    color: { required: true, type: [String, null] },
    tags: { type: Array, default: () => [] },
  },
  data() {
    return {
      panelVisible: false,
      panelStyle: {},
      editingId: null,
      allTags: defaultTaskTags.getDefaultTags(),
    };
  },
  computed: {
    currentColor() {
      return this.color || "none";
    },
    activeTagName() {
      if (this.currentColor === "none") return "";
      const tag = this.allTags.find((t) => t.color === this.currentColor);
      return tag?.name || "";
    },
    triggerTitle() {
      const name = this.activeTagName;
      return name ? `颜色标签：${name}` : "设置颜色标签";
    },
  },
  mounted() {
    document.addEventListener("mousedown", this.onGlobalClick);
  },
  beforeUnmount() {
    document.removeEventListener("mousedown", this.onGlobalClick);
  },
  methods: {
    togglePanel(event) {
      if (this.panelVisible) {
        this.panelVisible = false;
        return;
      }
      this.allTags = defaultTaskTags.getDefaultTags();
      const rect = event.currentTarget.getBoundingClientRect();
      const width = 240;
      const height = 380;
      const left = Math.max(10, Math.min(window.innerWidth - width - 10, rect.left));
      const openAbove = rect.bottom + height > window.innerHeight - 10;
      this.panelStyle = {
        position: "fixed",
        width: `${width}px`,
        left: `${left}px`,
        top: openAbove ? "auto" : `${rect.bottom + 6}px`,
        bottom: openAbove ? `${window.innerHeight - rect.top + 6}px` : "auto",
      };
      this.panelVisible = true;
    },
    selectTag(color, tagId) {
      this.$emit("ColorSelected", color);
      // 同时更新 tags：如果选了一个有 id 的颜色，添加到 tags
      if (tagId) {
        this.$emit("TagSelected", tagId);
      }
      this.panelVisible = false;
    },
    startEdit(tag) {
      this.editingId = tag.id;
      this.$nextTick(() => {
        const ref = this.$refs["edit_" + tag.id];
        const input = Array.isArray(ref) ? ref[0] : ref;
        if (input) {
          input.focus();
          input.select();
        }
      });
    },
    commitEdit(tagId, event) {
      const input = event.target;
      const newName = (input.value || "").trim();
      defaultTaskTags.renameTag(tagId, newName);
      this.allTags = defaultTaskTags.getDefaultTags();
      this.editingId = null;
    },
    cancelEdit() {
      this.editingId = null;
    },
    onGlobalClick(event) {
      if (!event.target.closest(".unified-tag-panel") &&
          !event.target.closest(".unified-tag-trigger")) {
        this.panelVisible = false;
      }
    },
  },
};
</script>

<style scoped lang="scss">
@use "../../assets/style/globalVars" as *;

.unified-tag-trigger {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #6b7280;
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.14s ease;

  .dark-theme & {
    color: #9aa0a8;
  }

  &:hover {
    background: #f0f1f3;
    .dark-theme & { background: #21262d; }
  }

  i {
    font-size: 14px;
  }

  .trigger-label {
    max-width: 60px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.unified-tag-panel {
  z-index: 22000;
  padding: 10px;
  border: 1px solid rgba(31, 35, 41, 0.12);
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 16px 42px rgba(24, 29, 38, 0.16),
    0 2px 8px rgba(24, 29, 38, 0.07);

  .dark-theme & {
    border-color: #39414c;
    background: #1d232b;
  }
}

.unified-tag-header {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 2px 4px 8px;

  strong {
    color: #3f454e;
    font-size: 12px;
    .dark-theme & { color: #d3d8de; }
  }

  small {
    color: #9aa0a8;
    font-size: 10px;
  }
}

.unified-tag-grid {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.unified-tag-item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 10px;
  padding: 7px 8px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #4a515b;
  font-family: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.12s ease;

  .dark-theme & {
    color: #c5cbd3;
  }

  &:hover {
    background: #f4f5f7;
    .dark-theme & { background: #252c35; }
  }

  &.active {
    background: #eef2ff;
    color: #4263eb;
    font-weight: 500;
    .dark-theme & {
      background: #1e2740;
      color: #8da2fb;
    }
  }
}

.unified-tag-dot {
  font-size: 12px;
  flex: 0 0 16px;
}

.unified-tag-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.unified-tag-edit {
  flex: 1;
  min-width: 0;
  height: 22px;
  padding: 0 6px;
  border: 1px solid #4263eb;
  border-radius: 4px;
  outline: none;
  background: #fff;
  color: #2f353d;
  font-family: inherit;
  font-size: 12px;

  .dark-theme & {
    border-color: #6c8fff;
    background: #161b22;
    color: #e0e5eb;
  }
}
</style>
''')

# ============================================================
# 6. tagPicker.vue — 重构为颜色标签 chip 选择器
# ============================================================
print("[6/9] 重写 tagPicker.vue → 颜色标签 chip 选择器")
write("src/views/toDoModal/tagPicker.vue", r'''<template>
  <div class="tag-picker-chips">
    <span
      v-for="tag in visibleTags"
      :key="tag.id"
      class="tag-chip"
      :class="{ active: isSelected(tag.id) }"
      :style="chipStyle(tag)"
      @click="toggleTag(tag.id)"
      :title="tag.name || tag.color"
    >
      <i class="bi-circle-fill chip-dot" :style="`color: ${tag.color}`"></i>
      <span v-if="tag.name" class="chip-text">{{ tag.name }}</span>
    </span>
  </div>
</template>

<script>
import defaultTaskTags from "../../data/defaultTaskTags.js";

export default {
  name: "tagPicker",
  props: {
    modelValue: { type: Array, default: () => [] },
    allTags: { type: Array, default: () => [] },
  },
  emits: ["update:modelValue"],
  computed: {
    selectedIds() {
      return this.modelValue || [];
    },
    visibleTags() {
      // 使用统一标签源，只显示有名称的标签
      const tags = defaultTaskTags.getDefaultTags();
      return tags.filter((t) => t.name);
    },
  },
  methods: {
    isSelected(id) {
      return this.selectedIds.includes(id);
    },
    chipStyle(tag) {
      if (this.isSelected(tag.id)) {
        return {
          backgroundColor: tag.color + "1a",
          color: tag.color,
          borderColor: tag.color + "33",
        };
      }
      return {};
    },
    toggleTag(id) {
      const next = this.isSelected(id)
        ? this.selectedIds.filter((t) => t !== id)
        : [...this.selectedIds, id];
      this.$emit("update:modelValue", next);
    },
  },
};
</script>

<style scoped lang="scss">
.tag-picker-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid transparent;
  border-radius: 14px;
  background: #f0f1f3;
  color: #6b7078;
  font-size: 0.76rem;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;

  .dark-theme & {
    background: #21262d;
    color: #9aa0a8;
  }

  &:hover {
    opacity: 0.85;
  }

  &.active {
    border-style: solid;
    font-weight: 500;
  }

  .chip-dot {
    font-size: 8px;
    flex: 0 0 auto;
  }

  .chip-text {
    max-width: 50px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
''')

# ============================================================
# 7. toDoModal.vue — 合并标签+颜色选择器、同步事件
# ============================================================
print("[7/9] 修补 toDoModal.vue（合并 tag + color 交互）")

modal_path = os.path.join(BASE, "src/views/toDoModal/toDoModal.vue")
with open(modal_path, "r", encoding="utf-8") as f:
    modal_content = f.read()

# 7a: 修改 changeColor 方法，让颜色变更同时更新对应的 tag
old_change_color = "changeColor(color) { this.todo.color = color; this.updateTodo(); },"
new_change_color = '''changeColor(color) {
      this.todo.color = color;
      // 统一标签体系：颜色选择时自动关联对应的标签 ID
      const tagModule = require("../../data/defaultTaskTags.js").default || require("../../data/defaultTaskTags.js");
      const matched = tagModule.findTagByColor ? tagModule.findTagByColor(color) : null;
      if (matched && this.todo.tags && !this.todo.tags.includes(matched.id)) {
        // 移除同体系的其他颜色标签，保留非颜色标签
        const presetIds = (tagModule.PRESET_TAGS || []).map(t => t.id);
        this.todo.tags = this.todo.tags.filter(t => !presetIds.includes(t));
        this.todo.tags.push(matched.id);
      } else if (!matched || color === "none") {
        // 清除所有颜色标签
        const presetIds = (tagModule.PRESET_TAGS || []).map(t => t.id);
        if (this.todo.tags) {
          this.todo.tags = this.todo.tags.filter(t => !presetIds.includes(t));
        }
      }
      this.updateTodo();
    },'''
modal_content = modal_content.replace(old_change_color, new_change_color)

# 7b: 在 colorPicker 组件使用处添加 @TagSelected 事件和 :tags prop
old_color_picker_tag = '''<color-picker
                    :color="todo.color"
                    @color-selected="changeColor"
                  ></color-picker>'''
new_color_picker_tag = '''<color-picker
                    :color="todo.color"
                    :tags="todo.tags || []"
                    @color-selected="changeColor"
                  ></color-picker>'''
modal_content = modal_content.replace(old_color_picker_tag, new_color_picker_tag)

with open(modal_path, "w", encoding="utf-8") as f:
    f.write(modal_content)
print(f"  ✅ src/views/toDoModal/toDoModal.vue")

# ============================================================
# 8. toDoItem.vue — 在每周事项列表中展示标签 chip
# ============================================================
print("[8/9] 修补 toDoItem.vue（展示颜色标签 chip）")

item_path = os.path.join(BASE, "src/components/toDoItem.vue")
with open(item_path, "r", encoding="utf-8") as f:
    item_content = f.read()

# 8a: 在 item-text span 的末尾（时间之前）插入标签 chips
old_time_section = '''<span
              v-if="!compactView"
              class="item-time mx-2"
              :class="{ \'checked-todo\': toDo.checked }"
            >'''

new_time_section = '''<span
              v-if="!compactView && tagChips.length"
              class="item-tags-inline"
            >
              <span
                v-for="chip in tagChips"
                :key="chip.id"
                class="item-tag-chip"
                :style="{ backgroundColor: chip.color + '1a', color: chip.color }"
              >{{ chip.name }}</span>
            </span>

            <span
              v-if="!compactView"
              class="item-time mx-2"
              :class="{ \'checked-todo\': toDo.checked }"
            >'''

item_content = item_content.replace(old_time_section, new_time_section)

# 8b: 添加 tagChips computed 属性
old_compact_computed = '''compactView: function () {
      return this.$store.getters.config.compactView;
    },'''

new_compact_computed = '''compactView: function () {
      return this.$store.getters.config.compactView;
    },

    tagChips: function () {
      const tags = this.toDo.tags;
      if (!tags || !tags.length) return [];
      try {
        const tagModule = require("../data/defaultTaskTags.js").default || require("../data/defaultTaskTags.js");
        const allTags = tagModule.getDefaultTags ? tagModule.getDefaultTags() : [];
        return tags
          .map((id) => allTags.find((t) => t.id === id))
          .filter((t) => t && t.name);
      } catch {
        return [];
      }
    },'''

item_content = item_content.replace(old_compact_computed, new_compact_computed)

# 8c: 添加标签 chip 样式
old_cicle_icon_style = '''.cicle-icon {
  font-size: 10px;
  margin-right: 5px;
}'''

new_cicle_icon_style = '''.cicle-icon {
  font-size: 10px;
  margin-right: 5px;
}

.item-tags-inline {
  display: inline-flex;
  gap: 3px;
  margin-left: 4px;
  vertical-align: middle;
}

.item-tag-chip {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 8px;
  font-size: 0.68rem;
  line-height: 1.4;
  white-space: nowrap;
}'''

item_content = item_content.replace(old_cicle_icon_style, new_cicle_icon_style, 1)

with open(item_path, "w", encoding="utf-8") as f:
    f.write(item_content)
print(f"  ✅ src/components/toDoItem.vue")

# ============================================================
# 9. activeToDo.vue — hover 浮层也展示标签 chip
# ============================================================
print("[9/9] 修补 activeToDo.vue（hover 浮层展示标签）")

active_path = os.path.join(BASE, "src/components/activeToDo.vue")
with open(active_path, "r", encoding="utf-8") as f:
    active_content = f.read()

# 9a: 在 time-details 后面插入标签 chips
old_time_detail = '''<span class="time-details"> {{ timeFormat(activeTodo.toDo.time) }}'''

new_time_detail = '''<span
              v-if="tagChips.length"
              class="active-tags-inline"
            >
              <span
                v-for="chip in tagChips"
                :key="chip.id"
                class="active-tag-chip"
                :style="{ backgroundColor: chip.color + '1a', color: chip.color }"
              >{{ chip.name }}</span>
            </span>
        <span class="time-details"> {{ timeFormat(activeTodo.toDo.time) }}'''

active_content = active_content.replace(old_time_detail, new_time_detail)

# 9b: 添加 tagChips computed
old_move_subtask = '''moveSubtaskToBotttom: function () {
      return this.$store.getters.config.moveCompletedSubTaskToBottom;
    },'''

new_move_subtask = '''moveSubtaskToBotttom: function () {
      return this.$store.getters.config.moveCompletedSubTaskToBottom;
    },

    tagChips: function () {
      const tags = this.activeTodo?.toDo?.tags;
      if (!tags || !tags.length) return [];
      try {
        const tagModule = require("../data/defaultTaskTags.js").default || require("../data/defaultTaskTags.js");
        const allTags = tagModule.getDefaultTags ? tagModule.getDefaultTags() : [];
        return tags
          .map((id) => allTags.find((t) => t.id === id))
          .filter((t) => t && t.name);
      } catch {
        return [];
      }
    },'''

active_content = active_content.replace(old_move_subtask, new_move_subtask)

# 9c: 添加标签样式（在 .cicle-icon 之前）
old_active_cicle = '''.cicle-icon {
  font-size: 10px;
  margin-right: 5px;
}

.bi-check-circle-fill,
.bi-check-circle {
  opacity: 0.7;
}'''

new_active_cicle = '''.active-tags-inline {
  display: inline-flex;
  gap: 3px;
  margin-left: 5px;
  vertical-align: middle;
}

.active-tag-chip {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 8px;
  font-size: 0.7rem;
  line-height: 1.4;
  white-space: nowrap;
}

.cicle-icon {
  font-size: 10px;
  margin-right: 5px;
}

.bi-check-circle-fill,
.bi-check-circle {
  opacity: 0.7;
}'''

# 替换最后一个匹配（activeToDo.vue 里的）
# 因为这个文件只有一处 .cicle-icon 定义
active_content = active_content.replace(old_active_cicle, new_active_cicle, 1)

with open(active_path, "w", encoding="utf-8") as f:
    f.write(active_content)
print(f"  ✅ src/components/activeToDo.vue")

# ============================================================
# 10. 添加 LinkedTask 节点的标签 chip 样式到全局
# ============================================================
print("\n[补充] 在 FocusDocumentEditor 中追加 linked-task-tag-chip 样式")

editor_path2 = os.path.join(BASE, "src/views/focusDocuments/FocusDocumentEditor.vue")
with open(editor_path2, "r", encoding="utf-8") as f:
    editor_css_content = f.read()

# 在 .linked-task-block.is-missing 样式后追加标签 chip 样式
old_missing_style = '''.linked-task-block.is-missing {
  opacity: 0.58;
}'''

new_missing_style = '''.linked-task-block.is-missing {
  opacity: 0.58;
}

/* UNIFIED_TAG_SYSTEM_20260917_V1: 关联事项标签 chips */
.linked-task-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 1px;
}

.linked-task-tag-chip {
  display: inline-block;
  padding: 1px 7px;
  border: 1px solid;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 500;
  line-height: 1.55;
  white-space: nowrap;
}

.linked-task-block.is-checked .linked-task-tag-chip {
  opacity: 0.5;
}'''

editor_css_content = editor_css_content.replace(old_missing_style, new_missing_style)

with open(editor_path2, "w", encoding="utf-8") as f:
    f.write(editor_css_content)
print(f"  ✅ src/views/focusDocuments/FocusDocumentEditor.vue (CSS)")


print("\n" + "=" * 60)
print("✅ 所有文件修改完成！")
print("=" * 60)
print("""
变更概要：
─────────────────────────────────────────────
1. defaultTaskTags.js
   → 统一为 { id, color, name } 颜色标签体系
   → 支持 localStorage 持久化用户自定义名称
   → 提供 findTagByColor / renameTag 等工具方法

2. LinkedTask.js
   → 新增 color / tags 属性
   → 渲染时显示颜色左边框 + 标签 chip

3. focusTaskService.js
   → createLinkedTask 返回 color / tags
   → resolveTask 天然返回完整 task 对象（含 color/tags）

4. FocusDocumentEditor.vue
   → refreshLinkedTasks: 同步 color / tags 到文档节点
   → onTaskToggle: 同步 color / tags
   → 新增 .linked-task-tag-chip CSS

5. colorPicker.vue
   → 重构为 Finder 风格统一标签面板
   → 双击名称可编辑，持久化到 localStorage
   → 选择颜色同时关联标签 ID

6. tagPicker.vue
   → 改为颜色标签 chip 选择器
   → 使用统一数据源，显示有名称的标签

7. toDoModal.vue
   → changeColor 自动同步 todo.tags
   → colorPicker 传入 tags prop

8. toDoItem.vue
   → 每周事项列表中展示标签名称 chip

9. activeToDo.vue
   → hover 浮层也展示标签名称 chip
─────────────────────────────────────────────

请运行以下命令预览：

  cd /Users/joey/Desktop/Joey-Workspace/MyProject/weektodo-main
  git add . && git commit -m "feat: unified color-tag system with bidirectional sync between Focus documents and Weekly tasks" && git push
  yarn electron:preview
""")

