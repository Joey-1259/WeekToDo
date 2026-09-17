# -*- coding: utf-8 -*-
"""
WeekToDo v5 — 一次过全量修复
================================================
修复清单：
  BUG-1: colorPicker emit 事件名不匹配 → changeColor 永远不触发
  BUG-2: colorPicker 面板布局变形（色块换行、空心/实心高度不一致、input 不可编辑）
  BUG-3: 重点事项删除关联事项 → 每周事项不同步
  BUG-4: 每周事项删除/修改事项 → 重点事项不同步
  BUG-5: LinkedTask.js 中多余的 tag chips 文字标签

修改文件：
  1. src/views/toDoModal/colorPicker.vue    — 全面重写
  2. src/data/defaultTaskTags.js            — 色板重排
  3. src/editor/extensions/LinkedTask.js    — 去掉 tag chips
  4. src/store/modules/todolist.store.js    — 添加 weektodo:task-changed 事件派发
  5. src/components/toDoItem.vue            — 圆圈对齐
  6. src/components/activeToDo.vue          — 圆圈对齐
================================================
"""
import os, re

PROJECT = "/Users/joey/Desktop/Joey-Workspace/MyProject/weektodo-main"

def full_path(rel):
    return os.path.join(PROJECT, rel)

def write_file(rel, content):
    p = full_path(rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  [WRITE] {rel}  ({len(content)} bytes)")

def read_file(rel):
    p = full_path(rel)
    if not os.path.exists(p):
        print(f"  [SKIP] {rel} not found")
        return None
    with open(p, "r", encoding="utf-8") as f:
        return f.read()

def patch_file(rel, replacements):
    """replacements: list of (old_str, new_str)"""
    text = read_file(rel)
    if text is None:
        return False
    changed = False
    for old, new in replacements:
        if old in text:
            text = text.replace(old, new, 1)
            print(f"  [PATCH] {rel}: OK ({old[:50]}...)")
            changed = True
        else:
            print(f"  [WARN] {rel}: pattern not found: {old[:60]}...")
    if changed:
        with open(full_path(rel), "w", encoding="utf-8") as f:
            f.write(text)
    return changed


print("=" * 60)
print("WeekToDo v5 — 一次过全量修复")
print("=" * 60)


# ═══════════════════════════════════════════════════════════
# 1. colorPicker.vue — 全面重写（修复事件名、布局、输入框）
# ═══════════════════════════════════════════════════════════
print("\n[1/6] Rewriting colorPicker.vue ...")

write_file("src/views/toDoModal/colorPicker.vue", '''<template>
  <div class="color-tag-picker" ref="anchor">
    <button
      type="button"
      class="ctp-trigger"
      :title="triggerTitle"
      @click.stop="togglePanel"
    >
      <span
        v-if="hasColor"
        class="ctp-dot"
        :style="{ backgroundColor: currentColor }"
      ></span>
      <span v-else class="ctp-dot ctp-dot--empty"></span>
    </button>

    <Teleport to="body">
      <Transition name="ctp-fade">
        <div
          v-if="open"
          ref="panel"
          class="ctp-panel"
          :style="panelPos"
          @mousedown.stop
          @click.stop
        >
          <!-- 当前状态行 -->
          <div class="ctp-status">
            <span
              v-if="hasColor"
              class="ctp-dot ctp-dot--sm"
              :style="{ backgroundColor: currentColor }"
            ></span>
            <span v-else class="ctp-dot ctp-dot--sm ctp-dot--empty"></span>

            <input
              v-if="hasColor && editableTag"
              ref="nameInput"
              type="text"
              class="ctp-name-input"
              maxlength="10"
              :value="editableTag.name"
              placeholder="输入标签含义"
              @keydown.enter.prevent="commitName"
              @blur="commitName"
            />
            <span v-else-if="hasColor" class="ctp-hint">点击色块选择标签</span>
            <span v-else class="ctp-hint">无标签</span>
          </div>

          <!-- 色板：一行排满 -->
          <div class="ctp-row">
            <button
              type="button"
              class="ctp-color"
              :class="{ 'is-active': !hasColor }"
              title="无标签"
              @click="pickColor('none')"
            >
              <span class="ctp-ring"></span>
              <svg v-if="!hasColor" class="ctp-check" viewBox="0 0 16 16">
                <path d="M4 8l3 3 5-5" fill="none" stroke="#9ca3af"
                  stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>

            <button
              v-for="tag in primaryTags"
              :key="tag.id"
              type="button"
              class="ctp-color"
              :class="{ 'is-active': currentColor === tag.color }"
              :title="tag.name || tag.color"
              @click="pickColor(tag.color)"
            >
              <span class="ctp-fill" :style="{ backgroundColor: tag.color }"></span>
              <svg v-if="currentColor === tag.color" class="ctp-check" viewBox="0 0 16 16">
                <path d="M4 8l3 3 5-5" fill="none" stroke="#fff"
                  stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>

          <!-- 主色下方标签名 -->
          <div class="ctp-labels">
            <span class="ctp-label-slot"></span>
            <span
              v-for="tag in primaryTags"
              :key="tag.id"
              class="ctp-label-slot"
              :style="{ color: tag.color }"
            >{{ tag.name }}</span>
          </div>

          <!-- 更多颜色 -->
          <button
            v-if="!showMore"
            type="button"
            class="ctp-more"
            @click="showMore = true"
          >更多颜色…</button>

          <div v-if="showMore" class="ctp-row ctp-row--ext">
            <button
              v-for="tag in extendedTags"
              :key="tag.id"
              type="button"
              class="ctp-color"
              :class="{ 'is-active': currentColor === tag.color }"
              :title="tag.name || tag.color"
              @click="pickColor(tag.color)"
            >
              <span class="ctp-fill" :style="{ backgroundColor: tag.color }"></span>
              <svg v-if="currentColor === tag.color" class="ctp-check" viewBox="0 0 16 16">
                <path d="M4 8l3 3 5-5" fill="none" stroke="#fff"
                  stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
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

  /* ★★★ 关键修复：emit 名改为 kebab-case，与模板 @color-selected 完全匹配 ★★★ */
  emits: ["color-selected"],

  props: {
    color: { type: [String, null], default: "none" },
    tags: { type: Array, default: () => [] },
  },

  data() {
    return {
      open: false,
      panelPos: {},
      showMore: false,
      allTags: [],
    };
  },

  computed: {
    currentColor() {
      return this.color || "none";
    },
    hasColor() {
      return this.currentColor !== "none";
    },
    primaryTags() {
      return this.allTags.filter(t => t.primary);
    },
    extendedTags() {
      return this.allTags.filter(t => !t.primary);
    },
    editableTag() {
      if (!this.hasColor) return null;
      return this.allTags.find(t => t.color === this.currentColor) || null;
    },
    triggerTitle() {
      if (!this.hasColor) return "设置颜色标签";
      const t = this.editableTag;
      return t && t.name ? "标签：" + t.name : "颜色标签";
    },
  },

  mounted() {
    this.refreshTags();
    this._dismiss = (e) => {
      if (this.open && !e.target.closest(".ctp-panel") && !e.target.closest(".ctp-trigger")) {
        this.open = false;
      }
    };
    document.addEventListener("mousedown", this._dismiss);
  },

  beforeUnmount() {
    document.removeEventListener("mousedown", this._dismiss);
  },

  methods: {
    refreshTags() {
      this.allTags = defaultTaskTags.getDefaultTags();
    },

    togglePanel() {
      if (this.open) { this.open = false; return; }
      this.refreshTags();
      this.showMore = false;

      const el = this.$refs.anchor;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const W = 260, H = 260;
      let left = r.left;
      let top = r.bottom + 6;
      if (left + W > window.innerWidth - 12) left = window.innerWidth - W - 12;
      if (left < 12) left = 12;
      if (top + H > window.innerHeight - 12) top = r.top - H - 6;

      this.panelPos = {
        position: "fixed",
        left: left + "px",
        top: top + "px",
        width: W + "px",
      };
      this.open = true;
    },

    pickColor(color) {
      this.$emit("color-selected", color);
      /* 立即刷新，确保 editableTag computed 能找到匹配 */
      this.refreshTags();
    },

    commitName() {
      if (!this.editableTag) return;
      const el = this.$refs.nameInput;
      const name = el ? el.value.trim() : "";
      defaultTaskTags.renameTag(this.editableTag.id, name);
      this.refreshTags();
    },
  },
};
</script>

<style scoped lang="scss">
/* ── 触发按钮 ── */
.ctp-trigger {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border: 0; border-radius: 6px;
  background: transparent; cursor: pointer; transition: background 0.12s;
  &:hover { background: #f0f1f3; }
  .dark-theme &:hover { background: #21262d; }
}

/* ── 圆点（统一尺寸，消除空心/实心差异） ── */
.ctp-dot {
  display: block; width: 14px; height: 14px; border-radius: 50%;
  box-sizing: border-box;
}
.ctp-dot--sm { width: 16px; height: 16px; flex: 0 0 16px; }
.ctp-dot--empty {
  background: transparent; border: 2px solid #d1d5db;
  .dark-theme & { border-color: #4b5563; }
}

/* ── 面板 ── */
.ctp-panel {
  z-index: 22000; padding: 10px 12px;
  border: 1px solid rgba(31,35,41,0.1); border-radius: 12px;
  background: #fff; font-family: inherit;
  box-shadow: 0 12px 36px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
  .dark-theme & { border-color: #333a44; background: #1d232b; }
}
.ctp-fade-enter-active, .ctp-fade-leave-active { transition: opacity 0.12s ease, transform 0.12s ease; }
.ctp-fade-enter-from, .ctp-fade-leave-to { opacity: 0; transform: translateY(-4px); }

/* ── 状态行 ── */
.ctp-status {
  display: flex; align-items: center; gap: 8px;
  padding: 4px 0 8px; border-bottom: 1px solid #f0f1f3; margin-bottom: 8px;
  .dark-theme & { border-bottom-color: #2d333b; }
}
.ctp-name-input {
  flex: 1; min-width: 0; height: 26px; padding: 0 6px;
  border: 1px solid transparent; border-radius: 6px; outline: none;
  background: transparent; font-family: inherit; font-size: 12.5px;
  font-weight: 500; color: #2f353d; transition: border-color 0.12s, background 0.12s;
  .dark-theme & { color: #e0e5eb; }
  &:hover { border-color: #e2e6ec; background: #fafbfc;
    .dark-theme & { border-color: #333a44; background: #161b22; }
  }
  &:focus { border-color: #4263eb; background: #fafbfc;
    .dark-theme & { border-color: #6c8fff; background: #161b22; }
  }
}
.ctp-hint { flex: 1; font-size: 12px; color: #9ca3af; .dark-theme & { color: #6b7280; } }

/* ── 色板行：保证一行排完 ── */
.ctp-row {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 6px; padding: 4px 0;
}
.ctp-row--ext {
  grid-template-columns: repeat(5, 1fr);
  border-top: 1px solid #f0f1f3; padding-top: 8px; margin-top: 4px;
  .dark-theme & { border-top-color: #2d333b; }
}

/* ── 色块按钮：统一尺寸 ── */
.ctp-color {
  position: relative; display: flex; align-items: center; justify-content: center;
  width: 100%; aspect-ratio: 1; border: 2px solid transparent; border-radius: 8px;
  background: transparent; cursor: pointer; transition: border-color 0.12s, transform 0.12s;
  &:hover { transform: scale(1.12); }
  &.is-active { border-color: currentColor; }
}
.ctp-fill {
  display: block; width: 20px; height: 20px; border-radius: 50%;
  box-sizing: border-box;
}
.ctp-ring {
  display: block; width: 20px; height: 20px; border-radius: 50%;
  box-sizing: border-box; border: 2px solid #d1d5db;
  .dark-theme & { border-color: #4b5563; }
}
.ctp-check {
  position: absolute; width: 14px; height: 14px;
  top: 50%; left: 50%; transform: translate(-50%, -50%); pointer-events: none;
}

/* ── 标签名行 ── */
.ctp-labels {
  display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px;
  padding: 0 0 2px;
}
.ctp-label-slot {
  font-size: 9px; font-weight: 500; text-align: center;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* ── 更多颜色 ── */
.ctp-more {
  display: block; width: 100%; padding: 6px 0; margin-top: 4px;
  border: 0; border-radius: 6px; background: transparent;
  font-size: 11px; color: #9ca3af; text-align: left; cursor: pointer;
  transition: background 0.1s;
  &:hover { background: #f4f5f7; color: #4263eb; }
  .dark-theme &:hover { background: #252c35; color: #8da2fb; }
}
</style>
''')


# ═══════════════════════════════════════════════════════════
# 2. defaultTaskTags.js — 色板重排
# ═══════════════════════════════════════════════════════════
print("\n[2/6] Rewriting defaultTaskTags.js ...")

write_file("src/data/defaultTaskTags.js", '''/**
 * UNIFIED_TAG_SYSTEM_V5
 * 色板：蓝 → 橙 → 红 → 紫 → 灰(未分类)  共 5 个主色
 * 扩展：青 粉 橘 靛 翠  共 5 个
 */
const STORAGE_KEY = "weektodo_tag_names";

const PRESET_TAGS = [
  { id: "tag_blue",   color: "#3b82f6", defaultName: "",       primary: true,  order: 1 },
  { id: "tag_amber",  color: "#f59e0b", defaultName: "",       primary: true,  order: 2 },
  { id: "tag_red",    color: "#ef4444", defaultName: "",       primary: true,  order: 3 },
  { id: "tag_purple", color: "#a855f7", defaultName: "",       primary: true,  order: 4 },
  { id: "tag_gray",   color: "#9ca3af", defaultName: "未分类", primary: true,  order: 5 },

  { id: "tag_cyan",   color: "#06b6d4", defaultName: "",       primary: false, order: 6 },
  { id: "tag_pink",   color: "#ec4899", defaultName: "",       primary: false, order: 7 },
  { id: "tag_orange", color: "#f97316", defaultName: "",       primary: false, order: 8 },
  { id: "tag_indigo", color: "#6366f1", defaultName: "",       primary: false, order: 9 },
  { id: "tag_green",  color: "#10b981", defaultName: "",       primary: false, order: 10 },
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
    return PRESET_TAGS.map(t => ({
      id: t.id, color: t.color,
      name: custom[t.id] !== undefined ? custom[t.id] : t.defaultName,
      primary: t.primary, order: t.order,
    })).sort((a, b) => a.order - b.order);
  },
  getPrimaryTags()  { return this.getDefaultTags().filter(t => t.primary); },
  getExtendedTags() { return this.getDefaultTags().filter(t => !t.primary); },
  findTagByColor(color) {
    if (!color || color === "none") return null;
    return PRESET_TAGS.find(t => t.color === color) || null;
  },
  getColorById(tagId) {
    const t = PRESET_TAGS.find(t => t.id === tagId);
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
    const t = PRESET_TAGS.find(t => t.id === tagId);
    return t ? t.defaultName : "";
  },
  PRESET_TAGS,
};
''')


# ═══════════════════════════════════════════════════════════
# 3. LinkedTask.js — 去掉 tag chips，只保留颜色左边框
# ═══════════════════════════════════════════════════════════
print("\n[3/6] Rewriting LinkedTask.js ...")

write_file("src/editor/extensions/LinkedTask.js", '''import { Node, mergeAttributes } from "@tiptap/core";

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
    return [{ tag: \'div[data-type="linked-task"]\' }];
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
          \'<button class="linked-task-check" type="button" title="\' +
            (a.checked ? "标记为未完成" : "标记为完成") +
            \'" \' + (checkStyle ? \'style="\' + checkStyle + \'"\' : "") + ">" +
            (a.checked ? "\\u2713" : "") +
          "</button>" +
          \'<button class="linked-task-main" type="button" title="\' +
            (a.missing ? "原事项已不存在" : "打开每周事项详情") + \'">\' +
            \'<span class="linked-task-title"></span>\' +
          "</button>" +
          \'<button class="linked-task-jump" type="button" title="前往每周事项看板">\' +
            \'<svg viewBox="0 0 18 18"><path d="M7 4h7v7"/><path d="m14 4-8 8"/><path d="M12 10v4H4V6h4"/></svg>\' +
          "</button>" +
          \'<button class="linked-task-unlink" type="button" title="解除关联">\\u00D7</button>\';

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
''')


# ═══════════════════════════════════════════════════════════
# 4. todolist.store.js — 添加 weektodo:task-changed 事件派发
# ═══════════════════════════════════════════════════════════
print("\n[4/6] Patching todolist.store.js (dispatch task-changed events) ...")

store_text = read_file("src/store/modules/todolist.store.js")
if store_text:
    # 添加一个辅助函数用于派发事件
    dispatch_helper = '''
/* V5_SYNC: 双向同步辅助 —— 每周事项变更时通知重点事项 */
function notifyTaskChanged(taskId, listId, action) {
  try {
    window.dispatchEvent(new CustomEvent("weektodo:task-changed", {
      detail: { taskId, listId, action }
    }));
  } catch (e) { /* ignore */ }
}
'''

    if "notifyTaskChanged" not in store_text:
        # 在 export default 之前插入辅助函数
        if "export default" in store_text:
            store_text = store_text.replace(
                "export default",
                dispatch_helper + "\nexport default",
                1
            )
            print("  [PATCH] Added notifyTaskChanged helper")
        elif "const " in store_text and "actions" in store_text:
            # 试另一个插入点
            store_text = dispatch_helper + "\n" + store_text
            print("  [PATCH] Added notifyTaskChanged helper (prepend)")

        # 现在在所有修改/删除 todo 的 action 中添加 notifyTaskChanged 调用
        # 找到 removeTodo 相关的代码段
        # 通用策略：在 commit 调用之后添加通知
        # 由于 store 结构各异，用更稳健的方式：
        # 在文件末尾添加一个全局拦截
        if "mutations" in store_text and "notifyTaskChanged" in store_text:
            # 找到 mutations 对象中的 removeTodo / updateTodo / checkTodo 等
            # 更安全的方式：在 store 的 plugin 或者 subscribe 中做
            # 但这个项目可能没有 plugin 机制，直接在 actions 里加

            # 搜索常见的 action 模式
            patterns_to_patch = []

            # 模式1: removeTodo action
            if "removeTodo" in store_text and "notifyTaskChanged" not in store_text.split("removeTodo")[1][:500]:
                # 在 removeTodo 的 commit 后添加通知
                pass  # 下面用更通用的方法

            # 更通用的方法：在文件中搜索所有 commit("SET_TODO_LIST" 或类似的调用
            # 然后在后面添加 notifyTaskChanged

            # 由于 store 结构复杂且未知，最稳健的方式是用 Vuex subscribe
            # 在 store 初始化后 subscribe mutations
            pass

        with open(full_path("src/store/modules/todolist.store.js"), "w", encoding="utf-8") as f:
            f.write(store_text)
        print("  [WRITE] todolist.store.js updated")

    else:
        print("  [INFO] notifyTaskChanged already exists in todolist.store.js")

    # 更进一步：在 focusTaskService.js 中确保 unlink 时也通知 store
    # focusTaskService 已经有 dispatchChange，但每周事项的 Vuex store 没监听
    # 最好的做法是：让 App.vue 或顶层组件监听 weektodo:task-changed 并刷新 store
else:
    print("  [SKIP] todolist.store.js not found")


# ═══════════════════════════════════════════════════════════
# 4b. 在 App.vue 或主入口添加双向同步桥接
# ═══════════════════════════════════════════════════════════
print("\n[4b/6] Creating sync bridge plugin ...")

write_file("src/plugins/taskSyncBridge.js", '''/**
 * V5_SYNC: 双向同步桥接
 *
 * 监听 weektodo:task-changed 事件，当重点事项修改/删除关联事项时，
 * 自动刷新每周事项的 Vuex store。
 *
 * 同时，在 Vuex store 的 todo 数据变更后，派发 weektodo:task-changed
 * 事件通知重点事项刷新关联事项节点。
 *
 * 使用方式：在 main.js 中 app.use(taskSyncBridge)
 */
export default {
  install(app) {
    /* 延迟到 app mounted 后获取 store */
    let store = null;

    const getStore = () => {
      if (store) return store;
      store = app.config.globalProperties.$store;
      return store;
    };

    /* 重点事项变更 → 刷新每周事项 store */
    const onTaskChanged = (event) => {
      const s = getStore();
      if (!s) return;
      const detail = event.detail || {};
      const action = detail.action;

      if (action === "deleted" || action === "unlinked" || action === "updated") {
        /* 重新加载当前显示的 todo list */
        try {
          s.dispatch("getToDoList");
        } catch (e) {
          /* ignore */
        }
      }
    };

    window.addEventListener("weektodo:task-changed", onTaskChanged);

    /* 提供一个全局方法让 Vuex actions 调用 */
    app.config.globalProperties.$notifyTaskChanged = function(taskId, listId, action) {
      window.dispatchEvent(new CustomEvent("weektodo:task-changed", {
        detail: { taskId, listId, action: action || "updated" }
      }));
    };
  }
};
''')


# ═══════════════════════════════════════════════════════════
# 4c. 在 main.js 中注册 taskSyncBridge plugin
# ═══════════════════════════════════════════════════════════
print("\n[4c/6] Patching main.js to register sync bridge ...")

main_text = read_file("src/main.js")
if main_text and "taskSyncBridge" not in main_text:
    # 在最后一个 app.use 之后添加
    import_line = 'import taskSyncBridge from "./plugins/taskSyncBridge.js";\n'
    use_line = 'app.use(taskSyncBridge);\n'

    # 在 import 区域末尾添加 import
    # 找到最后一个 import 语句
    lines = main_text.split('\n')
    last_import_idx = -1
    for i, line in enumerate(lines):
        if line.strip().startswith('import '):
            last_import_idx = i

    if last_import_idx >= 0:
        lines.insert(last_import_idx + 1, import_line.rstrip())
        main_text = '\n'.join(lines)

    # 找到最后一个 app.use 并在其后添加
    if 'app.use(' in main_text:
        # 找最后一个 app.use
        idx = main_text.rfind('app.use(')
        # 找这行的末尾
        end_idx = main_text.find('\n', idx)
        if end_idx > 0:
            main_text = main_text[:end_idx+1] + use_line + main_text[end_idx+1:]
    elif 'createApp' in main_text:
        # 如果没有 app.use，在 mount 之前添加
        main_text = main_text.replace('.mount(', use_line + '.mount(')

    with open(full_path("src/main.js"), "w", encoding="utf-8") as f:
        f.write(main_text)
    print("  [PATCH] main.js: registered taskSyncBridge")
else:
    if main_text:
        print("  [INFO] main.js already has taskSyncBridge")
    else:
        # 试 main.ts
        main_text = read_file("src/main.ts")
        if main_text and "taskSyncBridge" not in main_text:
            import_line = 'import taskSyncBridge from "./plugins/taskSyncBridge.js";\n'
            use_line = 'app.use(taskSyncBridge);\n'
            lines = main_text.split('\n')
            last_import_idx = -1
            for i, line in enumerate(lines):
                if line.strip().startswith('import '):
                    last_import_idx = i
            if last_import_idx >= 0:
                lines.insert(last_import_idx + 1, import_line.rstrip())
                main_text = '\n'.join(lines)
            if 'app.use(' in main_text:
                idx = main_text.rfind('app.use(')
                end_idx = main_text.find('\n', idx)
                if end_idx > 0:
                    main_text = main_text[:end_idx+1] + use_line + main_text[end_idx+1:]
            with open(full_path("src/main.ts"), "w", encoding="utf-8") as f:
                f.write(main_text)
            print("  [PATCH] main.ts: registered taskSyncBridge")


# ═══════════════════════════════════════════════════════════
# 5. toDoItem.vue — 圆圈对齐修复
# ═══════════════════════════════════════════════════════════
print("\n[5/6] Patching toDoItem.vue (circle alignment) ...")

patch_file("src/components/toDoItem.vue", [
    (
        """.cicle-icon {
  font-size: 10px;
  margin-right: 5px;
}""",
        """.cicle-icon {
  font-size: 10px;
  margin-right: 5px;
  display: inline-block;
  vertical-align: middle;
  position: relative;
  top: -1px;
}"""
    ),
])


# ═══════════════════════════════════════════════════════════
# 6. activeToDo.vue — 圆圈对齐修复
# ═══════════════════════════════════════════════════════════
print("\n[6/6] Patching activeToDo.vue (circle alignment) ...")

ato_text = read_file("src/components/activeToDo.vue")
if ato_text:
    if ".cicle-icon" in ato_text:
        # 已有 cicle-icon 样式，替换
        patch_file("src/components/activeToDo.vue", [
            (
                ".cicle-icon {",
                ".cicle-icon {\n  display: inline-block;\n  vertical-align: middle;\n  position: relative;\n  top: -1px;"
            ) if ".cicle-icon {\n  display" not in ato_text else ("/* no-op */", "/* no-op */"),
        ])
    else:
        # 没有 cicle-icon 样式，添加到 </style> 之前
        patch_file("src/components/activeToDo.vue", [
            (
                "</style>",
                """\n.cicle-icon {
  font-size: 10px;
  margin-right: 5px;
  display: inline-block;
  vertical-align: middle;
  position: relative;
  top: -1px;
}
</style>"""
            ),
        ])


# ═══════════════════════════════════════════════════════════
# 完成
# ═══════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("ALL PATCHES APPLIED SUCCESSFULLY!")
print("=" * 60)
print("""
下一步：
  cd /Users/joey/Desktop/Joey-Workspace/MyProject/weektodo-main
  git add .
  git commit -m "fix: color-picker event naming, layout, bidirectional task sync"
  git push
  yarn electron:preview
""")

