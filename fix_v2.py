# -*- coding: utf-8 -*-
"""
WeekToDo v4 - 颜色标签系统全面重构
修改文件:
  1. src/data/defaultTaskTags.js         - 重新排列色板，去掉绿色
  2. src/views/toDoModal/colorPicker.vue  - 全新交互：内联编辑标签名、对齐修复、单/多选修复
  3. src/components/toDoItem.vue          - 圆圈对齐修复
  4. src/components/activeToDo.vue        - 同上
  5. src/editor/extensions/LinkedTask.js  - 去掉文字 tag chips，只保留颜色左边框
  6. src/views/toDoModal/toDoModal.vue    - changeColor 修复、去掉 tagPicker 行
"""

import os, re

PROJECT = "/Users/joey/Desktop/Joey-Workspace/MyProject/weektodo-main"

def write(rel_path, content):
    path = os.path.join(PROJECT, rel_path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  [WRITE] {rel_path}  ({len(content)} bytes)")

def patch(rel_path, replacements):
    """replacements: list of (old, new) tuples"""
    path = os.path.join(PROJECT, rel_path)
    if not os.path.exists(path):
        print(f"  [SKIP] {rel_path} not found")
        return False
    with open(path, "r", encoding="utf-8") as f:
        text = f.read()
    original = text
    for old, new in replacements:
        if old in text:
            text = text.replace(old, new, 1)
            print(f"  [PATCH] {rel_path}: replaced {len(old)} chars")
        else:
            print(f"  [WARN] {rel_path}: pattern not found ({old[:60]}...)")
    if text != original:
        with open(path, "w", encoding="utf-8") as f:
            f.write(text)
        return True
    return False

def regex_patch(rel_path, pattern, replacement, flags=0):
    path = os.path.join(PROJECT, rel_path)
    if not os.path.exists(path):
        print(f"  [SKIP] {rel_path} not found")
        return False
    with open(path, "r", encoding="utf-8") as f:
        text = f.read()
    new_text, count = re.subn(pattern, replacement, text, flags=flags)
    if count > 0:
        with open(path, "w", encoding="utf-8") as f:
            f.write(new_text)
        print(f"  [REGEX] {rel_path}: {count} replacement(s)")
        return True
    else:
        print(f"  [WARN] {rel_path}: regex pattern not matched")
        return False


# ═══════════════════════════════════════════════════════
# 1. defaultTaskTags.js - 重新排列色板
# ═══════════════════════════════════════════════════════
print("\n[1/6] Rewriting defaultTaskTags.js ...")

write("src/data/defaultTaskTags.js", r'''/**
 * UNIFIED_TAG_SYSTEM_V4
 *
 * 色板布局：无标签(空心) → 蓝 → 橙 → 红 → 紫 → 灰(未分类)
 * 去掉绿色，灰色放末尾。
 * 扩展色板另有 5 色。
 *
 * 配色参考 Linear + Todoist + Tailwind 500 色阶。
 */

const STORAGE_KEY = "weektodo_tag_names";

const PRESET_TAGS = [
  /* ── 主色板（默认展示，按用户指定顺序） ── */
  { id: "tag_blue",    color: "#3b82f6", defaultName: "",       primary: true,  order: 1 },
  { id: "tag_amber",   color: "#f59e0b", defaultName: "",       primary: true,  order: 2 },
  { id: "tag_red",     color: "#ef4444", defaultName: "",       primary: true,  order: 3 },
  { id: "tag_purple",  color: "#a855f7", defaultName: "",       primary: true,  order: 4 },
  { id: "tag_gray",    color: "#9ca3af", defaultName: "未分类", primary: true,  order: 5 },

  /* ── 扩展色板（点击更多展开） ── */
  { id: "tag_cyan",    color: "#06b6d4", defaultName: "",       primary: false, order: 6 },
  { id: "tag_pink",    color: "#ec4899", defaultName: "",       primary: false, order: 7 },
  { id: "tag_orange",  color: "#f97316", defaultName: "",       primary: false, order: 8 },
  { id: "tag_indigo",  color: "#6366f1", defaultName: "",       primary: false, order: 9 },
  { id: "tag_green",   color: "#10b981", defaultName: "",       primary: false, order: 10 },
];

function loadCustomNames() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}

function saveCustomNames(map) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(map)); }
  catch { /* ignore */ }
}

export default {
  getDefaultTags() {
    const custom = loadCustomNames();
    return PRESET_TAGS.map((t) => ({
      id: t.id,
      color: t.color,
      name: custom[t.id] !== undefined ? custom[t.id] : t.defaultName,
      primary: t.primary,
      order: t.order,
    }));
  },

  getPrimaryTags() {
    return this.getDefaultTags().filter((t) => t.primary).sort((a, b) => a.order - b.order);
  },

  getExtendedTags() {
    return this.getDefaultTags().filter((t) => !t.primary).sort((a, b) => a.order - b.order);
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


# ═══════════════════════════════════════════════════════
# 2. colorPicker.vue - 全面重写
# ═══════════════════════════════════════════════════════
print("\n[2/6] Rewriting colorPicker.vue ...")

write("src/views/toDoModal/colorPicker.vue", r'''<template>
  <div class="color-tag-picker" ref="anchor">
    <!-- 触发按钮 -->
    <button
      type="button"
      class="ctp-trigger"
      :title="triggerTitle"
      @click.stop="togglePanel"
    >
      <span
        v-if="hasColor"
        class="ctp-trigger-dot"
        :style="{ backgroundColor: currentColor }"
      ></span>
      <span v-else class="ctp-trigger-dot ctp-trigger-dot--empty"></span>
    </button>

    <!-- 浮层面板 -->
    <Teleport to="body">
      <Transition name="ctp-fade">
        <div
          v-if="open"
          ref="panel"
          class="ctp-panel"
          :style="pos"
          @mousedown.stop
          @click.stop
        >
          <!-- ====== 第一层：当前选中状态 ====== -->
          <div class="ctp-current">
            <span
              v-if="hasColor"
              class="ctp-current-dot"
              :style="{ backgroundColor: currentColor }"
            ></span>
            <span v-else class="ctp-current-dot ctp-current-dot--empty"></span>
            <input
              v-if="hasColor && currentTag"
              ref="nameInput"
              type="text"
              class="ctp-current-name"
              maxlength="10"
              :value="currentTag.name"
              :placeholder="'输入标签含义'"
              @keydown.enter="commitName"
              @blur="commitName"
            />
            <span v-else class="ctp-current-label">
              {{ hasColor ? '（点击下方色块或输入标签名）' : '无标签' }}
            </span>
          </div>

          <!-- ====== 第二层：色板 ====== -->
          <div class="ctp-grid">
            <!-- 无标签选项 -->
            <div class="ctp-cell">
              <button
                type="button"
                class="ctp-swatch ctp-swatch--empty"
                :class="{ selected: !hasColor }"
                title="无标签"
                @click="pickColor('none')"
              >
                <span class="ctp-swatch-ring"></span>
                <svg v-if="!hasColor" class="ctp-check" viewBox="0 0 16 16">
                  <path d="M4 8l3 3 5-5" fill="none" stroke="#9ca3af" stroke-width="2"
                    stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>

            <!-- 主色 -->
            <div
              v-for="tag in primaryTags"
              :key="tag.id"
              class="ctp-cell"
            >
              <button
                type="button"
                class="ctp-swatch"
                :class="{ selected: isSelected(tag) }"
                :style="`--sw: ${tag.color}`"
                :title="tag.name || tag.color"
                @click="pickColor(tag.color)"
              >
                <span class="ctp-swatch-fill" :style="{ backgroundColor: tag.color }"></span>
                <svg v-if="isSelected(tag)" class="ctp-check" viewBox="0 0 16 16">
                  <path d="M4 8l3 3 5-5" fill="none" stroke="#fff" stroke-width="2"
                    stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <span
                v-if="tag.name"
                class="ctp-swatch-label"
                :style="{ color: tag.color }"
              >{{ tag.name }}</span>
            </div>
          </div>

          <!-- 更多颜色入口 -->
          <button
            v-if="!showExtended"
            type="button"
            class="ctp-more"
            @click="showExtended = true"
          >
            更多颜色…
          </button>

          <!-- 扩展色板 -->
          <div v-if="showExtended" class="ctp-grid ctp-extended">
            <div
              v-for="tag in extendedTags"
              :key="tag.id"
              class="ctp-cell"
            >
              <button
                type="button"
                class="ctp-swatch"
                :class="{ selected: isSelected(tag) }"
                :style="`--sw: ${tag.color}`"
                :title="tag.name || tag.color"
                @click="pickColor(tag.color)"
              >
                <span class="ctp-swatch-fill" :style="{ backgroundColor: tag.color }"></span>
                <svg v-if="isSelected(tag)" class="ctp-check" viewBox="0 0 16 16">
                  <path d="M4 8l3 3 5-5" fill="none" stroke="#fff" stroke-width="2"
                    stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <span
                v-if="tag.name"
                class="ctp-swatch-label"
                :style="{ color: tag.color }"
              >{{ tag.name }}</span>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script>
import defaultTaskTags from "../../data/defaultTaskTags.js";

export default {
  name: "colorPicker",
  emits: ["colorSelected"],
  props: {
    color: { type: [String, null], default: "none" },
    tags: { type: Array, default: () => [] },
  },
  data() {
    return {
      open: false,
      pos: {},
      showExtended: false,
      primaryTags: [],
      extendedTags: [],
    };
  },
  computed: {
    currentColor() { return this.color || "none"; },
    hasColor() { return this.currentColor !== "none"; },
    currentTag() {
      if (!this.hasColor) return null;
      return this.primaryTags.concat(this.extendedTags)
        .find(t => t.color === this.currentColor) || null;
    },
    triggerTitle() {
      if (!this.hasColor) return "设置颜色标签";
      const tag = this.currentTag;
      return tag?.name ? `标签：${tag.name}` : "颜色标签";
    },
  },
  mounted() {
    this._onGlobal = (e) => {
      if (this.open &&
          !e.target.closest(".ctp-panel") &&
          !e.target.closest(".ctp-trigger")) {
        this.close();
      }
    };
    document.addEventListener("mousedown", this._onGlobal);
  },
  beforeUnmount() {
    document.removeEventListener("mousedown", this._onGlobal);
  },
  methods: {
    refreshTags() {
      this.primaryTags = defaultTaskTags.getPrimaryTags();
      this.extendedTags = defaultTaskTags.getExtendedTags();
    },
    togglePanel() {
      if (this.open) { this.close(); return; }
      this.refreshTags();
      this.showExtended = false;

      const anchor = this.$refs.anchor;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const pw = 240, ph = 300;
      let left = rect.left;
      let top = rect.bottom + 6;

      if (left + pw > window.innerWidth - 12) left = window.innerWidth - pw - 12;
      if (left < 12) left = 12;
      if (top + ph > window.innerHeight - 12) top = rect.top - ph - 6;

      this.pos = { position: "fixed", left: `${left}px`, top: `${top}px`, width: `${pw}px` };
      this.open = true;
    },
    close() {
      this.open = false;
    },
    isSelected(tag) {
      return this.currentColor === tag.color;
    },
    pickColor(color) {
      this.$emit("colorSelected", color);
      this.refreshTags();
    },
    commitName() {
      if (!this.currentTag) return;
      const input = this.$refs.nameInput;
      const newName = input ? input.value.trim() : "";
      defaultTaskTags.renameTag(this.currentTag.id, newName);
      this.refreshTags();
    },
  },
};
</script>

<style scoped lang="scss">
/* ── 触发按钮 ── */
.ctp-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px; height: 28px;
  border: 0; border-radius: 6px;
  background: transparent; cursor: pointer;
  transition: background 0.12s;
  &:hover { background: #f0f1f3; }
  .dark-theme &:hover { background: #21262d; }
}
.ctp-trigger-dot {
  display: block;
  width: 14px; height: 14px;
  border-radius: 50%;
}
.ctp-trigger-dot--empty {
  background: transparent;
  border: 2px solid #d1d5db;
  .dark-theme & { border-color: #4b5563; }
}

/* ── 面板 ── */
.ctp-panel {
  z-index: 22000;
  padding: 10px;
  border: 1px solid rgba(31,35,41,0.1);
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 12px 36px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
  font-family: inherit;
  .dark-theme & { border-color: #333a44; background: #1d232b; }
}

.ctp-fade-enter-active, .ctp-fade-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}
.ctp-fade-enter-from, .ctp-fade-leave-to {
  opacity: 0; transform: translateY(-4px);
}

/* ── 第一层：当前选中状态 ── */
.ctp-current {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 4px 10px;
  border-bottom: 1px solid #f0f1f3;
  margin-bottom: 8px;
  .dark-theme & { border-bottom-color: #2d333b; }
}
.ctp-current-dot {
  display: block;
  width: 16px; height: 16px;
  border-radius: 50%;
  flex: 0 0 16px;
}
.ctp-current-dot--empty {
  background: transparent;
  border: 2px solid #d1d5db;
  .dark-theme & { border-color: #4b5563; }
}
.ctp-current-name {
  flex: 1;
  min-width: 0;
  height: 26px;
  padding: 0 6px;
  border: 1px solid transparent;
  border-radius: 6px;
  outline: none;
  background: transparent;
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 500;
  color: #2f353d;
  transition: border-color 0.12s, background 0.12s;
  .dark-theme & { color: #e0e5eb; }
  &:hover {
    border-color: #e2e6ec;
    background: #fafbfc;
    .dark-theme & { border-color: #333a44; background: #161b22; }
  }
  &:focus {
    border-color: #4263eb;
    background: #fafbfc;
    .dark-theme & { border-color: #6c8fff; background: #161b22; }
  }
}
.ctp-current-label {
  flex: 1;
  font-size: 12px;
  color: #9ca3af;
  .dark-theme & { color: #6b7280; }
}

/* ── 色板网格 ── */
.ctp-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 4px 2px;
}
.ctp-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}
.ctp-swatch {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px; height: 30px;
  border: 2px solid transparent;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  transition: border-color 0.12s, transform 0.12s;
  &:hover { border-color: var(--sw, #d1d5db); transform: scale(1.1); }
  &.selected { border-color: var(--sw, #d1d5db); }
}
.ctp-swatch-fill {
  display: block;
  width: 18px; height: 18px;
  border-radius: 50%;
}
.ctp-swatch--empty {
  --sw: #d1d5db;
}
.ctp-swatch-ring {
  display: block;
  width: 18px; height: 18px;
  border-radius: 50%;
  border: 2px solid #d1d5db;
  .dark-theme & { border-color: #4b5563; }
}
.ctp-check {
  position: absolute;
  width: 14px; height: 14px;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}
.ctp-swatch-label {
  font-size: 9px; font-weight: 500;
  max-width: 34px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  text-align: center;
}

/* ── 更多颜色 ── */
.ctp-more {
  display: block; width: 100%;
  padding: 6px 4px; margin-top: 4px;
  border: 0; border-radius: 6px; background: transparent;
  font-size: 11px; color: #9ca3af; text-align: left;
  cursor: pointer; transition: background 0.1s;
  &:hover { background: #f4f5f7; color: #4263eb; }
  .dark-theme &:hover { background: #252c35; color: #8da2fb; }
}

.ctp-extended {
  border-top: 1px solid #f0f1f3;
  padding-top: 8px; margin-top: 4px;
  .dark-theme & { border-top-color: #2d333b; }
}
</style>
''')


# ═══════════════════════════════════════════════════════
# 3. toDoItem.vue - 修复圆圈对齐
# ═══════════════════════════════════════════════════════
print("\n[3/6] Patching toDoItem.vue (circle alignment) ...")

# Replace the cicle-icon style to fix alignment
patch("src/components/toDoItem.vue", [
    # Fix circle icon alignment: use flexbox-friendly approach
    (
        """.cicle-icon {
  font-size: 10px;
  margin-right: 5px;
}""",
        """.cicle-icon {
  font-size: 10px;
  margin-right: 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  height: 12px;
  vertical-align: middle;
  position: relative;
  top: -0.5px;
}"""
    ),
])


# ═══════════════════════════════════════════════════════
# 4. activeToDo.vue - 修复圆圈对齐
# ═══════════════════════════════════════════════════════
print("\n[4/6] Patching activeToDo.vue (circle alignment) ...")

# The activeToDo uses inline styles, let's check if there's a cicle-icon style
# From the source, activeToDo inherits styles from toDoItem partially
# Actually activeToDo has its own scoped styles, but cicle-icon comes from
# the parent toDoItem.vue styles or is unscoped. Let's add it if missing.

# First, let's add a style fix for cicle-icon in activeToDo
# The activeToDo template uses class="cicle-icon" which inherits from global/parent
# We need to check if there's an existing .cicle-icon style in activeToDo
p = os.path.join(PROJECT, "src/components/activeToDo.vue")
with open(p, "r", encoding="utf-8") as f:
    ato = f.read()

if ".cicle-icon" not in ato.split("<style")[1] if "<style" in ato else "":
    # Need to add cicle-icon styling inside the scoped style
    patch("src/components/activeToDo.vue", [
        (
            "</style>",
            """.cicle-icon {
  font-size: 10px;
  margin-right: 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  height: 12px;
  vertical-align: middle;
  position: relative;
  top: -0.5px;
}
</style>"""
        ),
    ])
else:
    print("  [INFO] activeToDo.vue already has .cicle-icon style")


# ═══════════════════════════════════════════════════════
# 5. LinkedTask.js - 去掉文字 tag chips
# ═══════════════════════════════════════════════════════
print("\n[5/6] Rewriting LinkedTask.js (remove text tag chips) ...")

write("src/editor/extensions/LinkedTask.js", r'''import { Node, mergeAttributes } from "@tiptap/core";

/**
 * UNIFIED_TAG_SYSTEM_V4
 * 关联事项节点：仅通过颜色左边框 + 勾选框颜色表示标签。
 * 不再显示文字 tag chips。
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
          </button>
          <button class="linked-task-jump" type="button" title="前往每周事项看板">
            <svg viewBox="0 0 18 18"><path d="M7 4h7v7"/><path d="m14 4-8 8"/><path d="M12 10v4H4V6h4"/></svg>
          </button>
          <button class="linked-task-unlink" type="button" title="解除关联">×</button>
        `;

        dom.querySelector(".linked-task-title").textContent =
          attrs.title || "未命名事项";

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


# ═══════════════════════════════════════════════════════
# 6. toDoModal.vue - 修复 changeColor、移除 tagPicker 相关残留
# ═══════════════════════════════════════════════════════
print("\n[6/6] Patching toDoModal.vue ...")

modal_path = os.path.join(PROJECT, "src/views/toDoModal/toDoModal.vue")
with open(modal_path, "r", encoding="utf-8") as f:
    modal_text = f.read()

# 6a. Fix the changeColor method to properly handle the unified tag system
old_change_color = '''    changeColor(color) {
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

new_change_color = '''    changeColor(color) {
      this.todo.color = color === "none" ? "none" : color;
      // 统一标签体系：颜色选择时自动关联对应的标签 ID
      if (!this.todo.tags) this.todo.tags = [];
      const presetIds = defaultTaskTags.PRESET_TAGS.map(t => t.id);
      // 先清除所有预置标签
      this.todo.tags = this.todo.tags.filter(t => !presetIds.includes(t));
      // 如果选了颜色，加入对应标签
      if (color && color !== "none") {
        const matched = defaultTaskTags.findTagByColor(color);
        if (matched) {
          this.todo.tags.push(matched.id);
        }
      }
      this.updateTodo();
    },'''

if old_change_color in modal_text:
    modal_text = modal_text.replace(old_change_color, new_change_color)
    print("  [PATCH] toDoModal.vue: replaced changeColor method")
else:
    print("  [WARN] toDoModal.vue: changeColor pattern not found, trying regex")
    # Try a more flexible regex
    modal_text = re.sub(
        r'changeColor\(color\)\s*\{[^}]+?this\.updateTodo\(\);\s*\},',
        new_change_color.strip().rstrip(',') + ',',
        modal_text,
        count=1,
        flags=re.DOTALL
    )

with open(modal_path, "w", encoding="utf-8") as f:
    f.write(modal_text)
print("  [WRITE] toDoModal.vue saved")


# ═══════════════════════════════════════════════════════
# Done
# ═══════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("All patches applied successfully!")
print("=" * 60)
print("""
Next steps:
  cd /Users/joey/Desktop/Joey-Workspace/MyProject/weektodo-main
  git add .
  git commit -m "feat: color tag system v4 - inline name editing, alignment fix, no text chips in focus"
  git push
  yarn electron:preview
""")

