import os, re

BASE = "/Users/joey/Desktop/Joey-Workspace/MyProject/weektodo-main"

def read(rel):
    with open(os.path.join(BASE, rel), "r", encoding="utf-8") as f:
        return f.read()

def write(rel, content):
    full = os.path.join(BASE, rel)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  OK  {rel}")

print("=" * 64)
print("  v2 fix: linked-task display + color event + tag UX")
print("=" * 64)

# ================================================================
# 1. defaultTaskTags.js — 第一项改为灰色"未分类"
# ================================================================
print("\n[1/7] defaultTaskTags.js — 灰色未分类放首位")
write("src/data/defaultTaskTags.js", r'''/**
 * UNIFIED_TAG_SYSTEM_V2 — 统一颜色标签体系
 *
 * 第一项是灰色"未分类"，与 macOS Finder 的无标签灰圆对齐。
 * 颜色值与原 colorPicker.vue 完全一致，确保数据向前兼容。
 */

const STORAGE_KEY = "weektodo_tag_names";

const PRESET_TAGS = [
  { id: "tag_gray",    color: "#6b7280", defaultName: "未分类" },
  { id: "tag_green",   color: "#77e785", defaultName: "工作" },
  { id: "tag_cyan",    color: "#06b6d4", defaultName: "学习" },
  { id: "tag_blue",    color: "#5e6ef2", defaultName: "项目" },
  { id: "tag_purple",  color: "#8b5cf6", defaultName: "灵感" },
  { id: "tag_pink",    color: "#ed56a1", defaultName: "生活" },
  { id: "tag_red",     color: "#ed544b", defaultName: "紧急" },
  { id: "tag_orange",  color: "#f97316", defaultName: "健康" },
  { id: "tag_yellow",  color: "#f9d54a", defaultName: "待定" },
  { id: "tag_brown",   color: "#ba7956", defaultName: "" },
  { id: "tag_dark",    color: "#030712", defaultName: "" },
];

function loadCustomNames() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveCustomNames(map) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(map)); }
  catch { /* noop */ }
}

export default {
  getDefaultTags() {
    const custom = loadCustomNames();
    return PRESET_TAGS.map((t) => ({
      id: t.id,
      color: t.color,
      name: custom[t.id] !== undefined ? custom[t.id] : t.defaultName,
    }));
  },

  findTagByColor(color) {
    if (!color || color === "none") return null;
    return PRESET_TAGS.find((t) => t.color === color) || null;
  },

  getColorById(tagId) {
    const t = PRESET_TAGS.find((t) => t.id === tagId);
    return t ? t.color : null;
  },

  renameTag(tagId, newName) {
    const c = loadCustomNames();
    c[tagId] = String(newName || "").trim();
    saveCustomNames(c);
  },

  getTagName(tagId) {
    const c = loadCustomNames();
    if (c[tagId] !== undefined) return c[tagId];
    const t = PRESET_TAGS.find((t) => t.id === tagId);
    return t ? t.defaultName : "";
  },

  PRESET_TAGS,
};
''')

# ================================================================
# 2. colorPicker.vue — 修复事件名 + 编辑 UX 优化
# ================================================================
print("[2/7] colorPicker.vue — 修复 emit 事件名 + 编辑按钮")
write("src/views/toDoModal/colorPicker.vue", r'''<template>
  <div class="unified-tag-picker">
    <button
      type="button"
      class="unified-tag-trigger"
      :title="triggerTitle"
      @click.stop="togglePanel"
    >
      <i
        :class="currentColor !== 'none' ? 'bi-circle-fill' : 'bi-circle'"
        :style="currentColor !== 'none' ? `color: ${currentColor}` : ''"
      ></i>
      <span v-if="activeTagName" class="trigger-label">{{ activeTagName }}</span>
    </button>

    <Teleport to="body">
      <div
        v-if="panelVisible"
        class="unified-tag-panel"
        :class="{ 'dark-theme': isDark }"
        :style="panelStyle"
        @mousedown.stop
        @click.stop
      >
        <header class="unified-tag-header">
          <div class="unified-tag-header-row">
            <strong>颜色标签</strong>
            <button
              type="button"
              class="unified-tag-edit-toggle"
              :class="{ active: editMode }"
              :title="editMode ? '退出编辑' : '编辑标签名称'"
              @click="editMode = !editMode"
            >
              <svg viewBox="0 0 16 16" width="12" height="12">
                <path d="M11.5 1.5l3 3L5 14H2v-3z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
          <small v-if="editMode">点击名称进行编辑，回车确认</small>
          <small v-else>选择标签分类</small>
        </header>

        <div class="unified-tag-grid">
          <button
            type="button"
            class="unified-tag-item"
            :class="{ active: currentColor === 'none' }"
            @click="selectTag('none', '')"
          >
            <i class="bi-circle unified-tag-dot" style="color: #c9d1d9"></i>
            <span class="unified-tag-name">无标签</span>
          </button>

          <div
            v-for="tag in allTags"
            :key="tag.id"
            class="unified-tag-row"
          >
            <button
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
                :class="{ 'is-placeholder': !tag.name }"
                @click.stop="editMode && startEdit(tag)"
              >
                {{ tag.name || '点击命名…' }}
              </span>
              <input
                v-else
                :ref="el => { if (el) editRefs[tag.id] = el }"
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
      </div>
    </Teleport>
  </div>
</template>

<script>
import defaultTaskTags from "../../data/defaultTaskTags.js";

export default {
  name: "colorPicker",
  /* FIX: Vue 3 emit 名用 camelCase，模板中自动匹配 kebab-case */
  emits: ["colorSelected", "tagSelected"],
  props: {
    color: { required: true, type: [String, null] },
    tags: { type: Array, default: () => [] },
  },
  data() {
    return {
      panelVisible: false,
      panelStyle: {},
      editMode: false,
      editingId: null,
      editRefs: {},
      allTags: defaultTaskTags.getDefaultTags(),
    };
  },
  computed: {
    currentColor() { return this.color || "none"; },
    isDark() { return document.body.classList.contains("dark-theme") ||
                      document.querySelector(".dark-theme") !== null; },
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
      if (this.panelVisible) { this.panelVisible = false; return; }
      this.allTags = defaultTaskTags.getDefaultTags();
      this.editMode = false;
      this.editingId = null;
      const rect = event.currentTarget.getBoundingClientRect();
      const w = 250, h = 420;
      const left = Math.max(10, Math.min(window.innerWidth - w - 10, rect.left));
      const openAbove = rect.bottom + h > window.innerHeight - 10;
      this.panelStyle = {
        position: "fixed", width: `${w}px`, left: `${left}px`,
        top: openAbove ? "auto" : `${rect.bottom + 6}px`,
        bottom: openAbove ? `${window.innerHeight - rect.top + 6}px` : "auto",
      };
      this.panelVisible = true;
    },
    selectTag(color, tagId) {
      this.$emit("colorSelected", color);
      if (tagId) this.$emit("tagSelected", tagId);
      if (!this.editMode) this.panelVisible = false;
    },
    startEdit(tag) {
      this.editingId = tag.id;
      this.$nextTick(() => {
        const input = this.editRefs[tag.id];
        if (input) { input.focus(); input.select(); }
      });
    },
    commitEdit(tagId, event) {
      const newName = (event.target.value || "").trim();
      defaultTaskTags.renameTag(tagId, newName);
      this.allTags = defaultTaskTags.getDefaultTags();
      this.editingId = null;
    },
    cancelEdit() { this.editingId = null; },
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
  .dark-theme & { color: #9aa0a8; }
  &:hover { background: #f0f1f3; .dark-theme & { background: #21262d; } }
  i { font-size: 14px; }
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
  box-shadow: 0 16px 42px rgba(24, 29, 38, 0.16), 0 2px 8px rgba(24, 29, 38, 0.07);
  &.dark-theme { border-color: #39414c; background: #1d232b; }
}

.unified-tag-header {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 2px 4px 8px;
  strong { color: #3f454e; font-size: 12px; .dark-theme & { color: #d3d8de; } }
  small { color: #9aa0a8; font-size: 10px; }
}

.unified-tag-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.unified-tag-edit-toggle {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #9aa0a8;
  cursor: pointer;
  transition: all 0.12s ease;
  &:hover { background: #f0f1f3; color: #4263eb; }
  &.active { background: #eef2ff; color: #4263eb; }
  .dark-theme &:hover { background: #252c35; }
  .dark-theme &.active { background: #1e2740; color: #8da2fb; }
}

.unified-tag-grid { display: flex; flex-direction: column; gap: 1px; }
.unified-tag-row { display: flex; align-items: center; }

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
  .dark-theme & { color: #c5cbd3; }
  &:hover { background: #f4f5f7; .dark-theme & { background: #252c35; } }
  &.active {
    background: #eef2ff; color: #4263eb; font-weight: 500;
    .dark-theme & { background: #1e2740; color: #8da2fb; }
  }
}

.unified-tag-dot { font-size: 12px; flex: 0 0 16px; }

.unified-tag-name {
  flex: 1; min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  &.is-placeholder { color: #c0c5cc; font-style: italic; .dark-theme & { color: #4a515b; } }
}

.unified-tag-edit {
  flex: 1; min-width: 0; height: 22px;
  padding: 0 6px; border: 1px solid #4263eb; border-radius: 4px;
  outline: none; background: #fff; color: #2f353d;
  font-family: inherit; font-size: 12px;
  .dark-theme & { border-color: #6c8fff; background: #161b22; color: #e0e5eb; }
}
</style>
''')

# ================================================================
# 3. toDoModal.vue — 修复事件监听名 + changeColor 逻辑
# ================================================================
print("[3/7] toDoModal.vue — 修复 @color-selected 事件绑定")
c = read("src/views/toDoModal/toDoModal.vue")

# 3a: colorPicker 的 emit 现在是 camelCase "colorSelected"
# Vue 3 模板里 @color-selected 可以匹配 camelCase colorSelected，这是对的
# 但要确认 @color-selected 确实存在且指向 changeColor
# 当前代码中是 @color-selected="changeColor" — 这和 emit "colorSelected" 是匹配的 ✓
# 不需要改模板，但 changeColor 方法内部需要修复

# 3b: changeColor 方法 — 移除 require()（已在顶部 import）
old_cc = '''changeColor(color) {
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

new_cc = '''changeColor(color) {
      this.todo.color = color;
      // 统一标签体系：颜色选择时自动关联对应的标签 ID
      const matched = defaultTaskTags.findTagByColor(color);
      if (matched && !this.todo.tags.includes(matched.id)) {
        const presetIds = defaultTaskTags.PRESET_TAGS.map(t => t.id);
        this.todo.tags = this.todo.tags.filter(t => !presetIds.includes(t));
        this.todo.tags.push(matched.id);
      } else if (!matched || color === "none") {
        const presetIds = defaultTaskTags.PRESET_TAGS.map(t => t.id);
        this.todo.tags = (this.todo.tags || []).filter(t => !presetIds.includes(t));
      }
      this.updateTodo();
    },'''

c = c.replace(old_cc, new_cc)

# 3c: allTags computed 目前传了 this，但新版 getDefaultTags 不需要参数
old_allTags = "allTags: function () { return defaultTaskTags.getDefaultTags(this); },"
new_allTags = "allTags: function () { return defaultTaskTags.getDefaultTags(); },"
c = c.replace(old_allTags, new_allTags)

write("src/views/toDoModal/toDoModal.vue", c)

# ================================================================
# 4. FocusColumnCard.vue — requestTask 后立即 flush
# ================================================================
print("[4/7] FocusColumnCard.vue — insert 回调后强制 flush")
c = read("src/views/focusDocuments/FocusColumnCard.vue")

old_rt = '''    requestTask() {
      this.flush();

      this.$emit("create-task", {
        documentId: this.document.id,
        insert: (attrs) => {
          this.$refs.editor?.insertLinkedTask(attrs);
          this.scheduleSave();
        },
      });
    },'''

new_rt = '''    requestTask() {
      this.flush();

      this.$emit("create-task", {
        documentId: this.document.id,
        insert: (attrs) => {
          this.$refs.editor?.insertLinkedTask(attrs);
          /* FIX: 立即触发持久化，不依赖 debounce。
             确保关联事项节点在关闭/切换前已写入 DB。 */
          this.dirty = true;
          this.$nextTick(() => this.persist());
        },
      });
    },'''

c = c.replace(old_rt, new_rt)
write("src/views/focusDocuments/FocusColumnCard.vue", c)

# ================================================================
# 5. FocusDocumentDialog.vue — 同样修复 requestTask
# ================================================================
print("[5/7] FocusDocumentDialog.vue — insert 回调后强制 flush")
c = read("src/views/focusDocuments/FocusDocumentDialog.vue")

old_drt = '''    async requestTask() {
      await this.flush();

      this.$emit("create-task", {
        documentId: this.draft.id,
        insert: (attrs) => {
          this.$refs.editor?.insertLinkedTask(attrs);
          this.scheduleSave();
        },
      });
    },'''

new_drt = '''    async requestTask() {
      await this.flush();

      this.$emit("create-task", {
        documentId: this.draft.id,
        insert: (attrs) => {
          this.$refs.editor?.insertLinkedTask(attrs);
          /* FIX: 立即持久化，不依赖 debounce */
          this.dirty = true;
          this.$nextTick(() => this.persist());
        },
      });
    },'''

c = c.replace(old_drt, new_drt)
write("src/views/focusDocuments/FocusDocumentDialog.vue", c)

# ================================================================
# 6. LinkedTask.js — 优化标签加载方式，避免 require 在运行时失败
# ================================================================
print("[6/7] LinkedTask.js — 优化标签渲染 + 颜色圆点始终可见")
write("src/editor/extensions/LinkedTask.js", r'''import { Node, mergeAttributes } from "@tiptap/core";
import defaultTaskTags from "../../data/defaultTaskTags.js";

/* UNIFIED_TAG_SYSTEM_V2
 * 关联事项节点：渲染颜色圆点 + 标签 chip + 颜色左边框
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
      mergeAttributes(HTMLAttributes, { "data-type": "linked-task" }),
    ];
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement("div");
      dom.className = "linked-task-block";
      dom.contentEditable = "false";

      const emit = (name, attrs) => {
        window.dispatchEvent(
          new CustomEvent(name, { detail: { ...attrs, sourceEditor: editor } })
        );
      };

      const render = (currentNode) => {
        const attrs = currentNode.attrs;
        const color = attrs.color && attrs.color !== "none" ? attrs.color : null;

        dom.classList.remove("is-loading");
        dom.classList.toggle("is-checked", Boolean(attrs.checked));
        dom.classList.toggle("is-missing", Boolean(attrs.missing));

        if (color) {
          dom.style.borderLeft = `3px solid ${color}`;
          dom.style.paddingLeft = "8px";
        } else {
          dom.style.borderLeft = "";
          dom.style.paddingLeft = "";
        }

        /* 勾选框：有颜色时用颜色渲染 */
        const checkStyle = color
          ? `border-color: ${color}; ${attrs.checked ? `background: ${color};` : ""}`
          : "";

        dom.innerHTML = `
          <button class="linked-task-check" type="button"
            title="${attrs.checked ? "标记为未完成" : "标记为完成"}"
            ${checkStyle ? `style="${checkStyle}"` : ""}>
            ${attrs.checked ? "✓" : ""}
          </button>
          <button class="linked-task-main" type="button"
            title="${attrs.missing ? "原事项已不存在" : "打开每周事项详情"}">
            <span class="linked-task-title"></span>
            <span class="linked-task-tags"></span>
          </button>
          <button class="linked-task-jump" type="button" title="前往每周事项看板">
            <svg viewBox="0 0 18 18"><path d="M7 4h7v7"/><path d="m14 4-8 8"/><path d="M12 10v4H4V6h4"/></svg>
          </button>
          <button class="linked-task-unlink" type="button" title="解除关联">×</button>
        `;

        dom.querySelector(".linked-task-title").textContent =
          attrs.title || "未命名事项";

        /* 标签 chips */
        const tagsEl = dom.querySelector(".linked-task-tags");
        tagsEl.innerHTML = "";
        const tagIds = Array.isArray(attrs.tags) ? attrs.tags : [];
        if (tagIds.length > 0) {
          const allTags = defaultTaskTags.getDefaultTags();
          tagIds.forEach((tagId) => {
            const def = allTags.find((t) => t.id === tagId);
            if (def && def.name) {
              const chip = document.createElement("span");
              chip.className = "linked-task-tag-chip";
              chip.style.backgroundColor = def.color + "1a";
              chip.style.color = def.color;
              chip.style.borderColor = def.color + "33";
              chip.textContent = def.name;
              tagsEl.appendChild(chip);
            }
          });
        }

        /* 事件绑定 */
        dom.querySelector(".linked-task-check").onclick = (e) => {
          e.preventDefault(); e.stopPropagation();
          if (!attrs.missing) emit("focus-task-toggle", attrs);
        };
        dom.querySelector(".linked-task-main").onclick = (e) => {
          e.preventDefault(); e.stopPropagation();
          if (!attrs.missing) emit("focus-task-open", attrs);
        };
        dom.querySelector(".linked-task-jump").onclick = (e) => {
          e.preventDefault(); e.stopPropagation();
          if (!attrs.missing) emit("focus-task-jump", attrs);
        };
        dom.querySelector(".linked-task-unlink").onclick = (e) => {
          e.preventDefault(); e.stopPropagation();
          if (typeof getPos === "function") editor.commands.setNodeSelection(getPos());
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

# ================================================================
# 7. toDoItem.vue & activeToDo.vue — 确保 color 圆点显示正确
#    这部分上一轮已经 OK，这里只修 require → import 问题
# ================================================================
print("[7/7] toDoItem.vue + activeToDo.vue — 修 require 为顶部 import")

# 7a: toDoItem.vue
c = read("src/components/toDoItem.vue")

# 在 script 的 import 区域添加 import
if "import defaultTaskTags" not in c:
    c = c.replace(
        'import {\n  isSpanningTask,',
        'import defaultTaskTags from "../data/defaultTaskTags.js";\nimport {\n  isSpanningTask,'
    )

# 替换 require 为直接调用
old_tag_computed_item = '''    tagChips: function () {
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

new_tag_computed_item = '''    tagChips: function () {
      const tags = this.toDo.tags;
      if (!tags || !tags.length) return [];
      const allTags = defaultTaskTags.getDefaultTags();
      return tags
        .map((id) => allTags.find((t) => t.id === id))
        .filter((t) => t && t.name);
    },'''

c = c.replace(old_tag_computed_item, new_tag_computed_item)
write("src/components/toDoItem.vue", c)

# 7b: activeToDo.vue
c = read("src/components/activeToDo.vue")

if "import defaultTaskTags" not in c:
    c = c.replace(
        'import {\n  clearMirrorsBySpanId,',
        'import defaultTaskTags from "../data/defaultTaskTags.js";\nimport {\n  clearMirrorsBySpanId,'
    )

old_tag_computed_active = '''    tagChips: function () {
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

new_tag_computed_active = '''    tagChips: function () {
      const tags = this.activeTodo?.toDo?.tags;
      if (!tags || !tags.length) return [];
      const allTags = defaultTaskTags.getDefaultTags();
      return tags
        .map((id) => allTags.find((t) => t.id === id))
        .filter((t) => t && t.name);
    },'''

c = c.replace(old_tag_computed_active, new_tag_computed_active)
write("src/components/activeToDo.vue", c)


print("\n" + "=" * 64)
print("  ALL DONE")
print("=" * 64)
print("""
修复摘要
────────────────────────────────────────────────────
Bug #1  已有文档中新建关联事项不显示
  → FocusColumnCard + FocusDocumentDialog:
    insert 回调后 $nextTick → persist()，不再依赖 debounce

Bug #2  标签编辑入口不清晰 / 第一个颜色应为灰色
  → defaultTaskTags: 灰色"未分类"放首位
  → colorPicker: 新增铅笔编辑按钮，点击后进入编辑模式
    编辑模式下点名称直接改名，无需双击

Bug #3  选了颜色标签但圆圈不显示
  → colorPicker emit 从 PascalCase "ColorSelected"
    改为 camelCase "colorSelected"，
    与 Vue 3 的 @color-selected 自动匹配
  → toDoItem / activeToDo: require() 改为顶部 import
  → LinkedTask.js: require() 改为顶部 import
────────────────────────────────────────────────────

  cd /Users/joey/Desktop/Joey-Workspace/MyProject/weektodo-main
  git add .
  git commit -m "fix: linked-task persistence in existing docs, color event binding, tag edit UX"
  git push
  yarn electron:preview
""")

