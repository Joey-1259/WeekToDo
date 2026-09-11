<template>
  <div
    class="notes-field"
    :class="{ 'is-focused': focused, 'is-overflowing': overflowing }"
  >
    <div class="notes-field-head">
      <span class="notes-field-label">
        <i class="bi-text-left" aria-hidden="true"></i>
        <span>{{ label }}</span>
      </span>

      <div class="notes-field-tools">
        <button
          type="button"
          class="notes-tool"
          :title="$t('todoDetails.markdown')"
          aria-label="Markdown 语法说明"
          @mousedown.prevent
          @click="goToMarkDown"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <rect x="1.5" y="5" width="17" height="10" rx="1.6" />
            <path d="M4.5 13V7l2.4 3 2.4-3v6M13 7v6M13 13l1.9-2.2M13 13l-1.9-2.2" />
          </svg>
        </button>

        <!-- 图标与「重点事项」卡片右上角的沉浸式编辑完全一致：
             同一个图形在两个模块表达同一件事，用户只需学一次。 -->
        <button
          ref="expandButton"
          type="button"
          class="notes-tool is-expand"
          title="沉浸式编辑"
          aria-label="打开沉浸式编辑"
          @mousedown.prevent
          @click="openComposer"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M7 3H4a1 1 0 0 0-1 1v3" />
            <path d="M13 3h3a1 1 0 0 1 1 1v3" />
            <path d="M7 17H4a1 1 0 0 1-1-1v-3" />
            <path d="M13 17h3a1 1 0 0 0 1-1v-3" />
          </svg>
        </button>
      </div>
    </div>

    <textarea
      ref="descriptionInput"
      v-model="desc"
      class="notes-input"
      :placeholder="$t('todoDetails.notes')"
      @input="resizeTextArea"
      @focus="focused = true"
      @blur="onBlur"
      @pointerdown="onPointerDown"
      @keydown.meta.enter.prevent="commitFromKeyboard"
      @keydown.ctrl.enter.prevent="commitFromKeyboard"
    ></textarea>

    <!-- 只有真正被截断时才出现的出口。没超高就不说话，
         提示位一次只教一件事。 -->
    <button
      v-if="overflowing"
      type="button"
      class="notes-overflow-cue"
      @click="openComposer"
    >
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M7 3H4a1 1 0 0 0-1 1v3" />
        <path d="M13 3h3a1 1 0 0 1 1 1v3" />
        <path d="M7 17H4a1 1 0 0 1-1-1v-3" />
        <path d="M13 17h3a1 1 0 0 0 1-1v-3" />
      </svg>
      <span>内容较长 · 展开沉浸式编辑</span>
    </button>

    <TaskNotesComposer
      v-if="composerOpen"
      :model-value="desc"
      :label="label"
      :task-title="taskTitle"
      :context-label="contextLabel"
      @update:model-value="onComposerInput"
      @close="closeComposer"
    />
  </div>
</template>

<script>
/* UI_SYSTEM_20260911_V9 · 任务细节输入域
 *
 * 原实现把 textarea 钉在 72~132px，而它的祖先 .modal-body 自身也是
 * overflow-y:auto。往下拖选到框底时，滚动链会传导到外层容器，选区
 * 锚点跟着一起跳 —— 这是"多了不好往下选"的机械原因，不是手感问题。
 *
 * 三处修法，各修一层：
 *   1) overscroll-behavior: contain     切断滚动链传导
 *   2) 拖选时 rAF 自行滚动 textarea      让向下选变得线性可控
 *   3) 沉浸式编辑                        内容真的长了就该换容器，
 *                                       而不是在小盒子里优化滚动
 *
 * 高度上限只写在 CSS（--notes-max-height），JS 用 getComputedStyle
 * 读回来。于是"普通弹窗 240 / 全屏弹窗 420"这条规则只存在一处。
 */
import TaskNotesComposer from "./TaskNotesComposer.vue";

const MIN_HEIGHT = 96;
const FALLBACK_MAX = 240;
const EDGE = 26;      // 触发自动滚动的边缘带宽
const MAX_SPEED = 18; // 单帧最大滚动像素

export default {
  name: "descriptionTextArea",

  components: { TaskNotesComposer },

  emits: ["updatedDescription"],

  props: {
    todoDesc: { required: true },
    label: { type: String, default: "任务细节" },
    taskTitle: { type: String, default: "" },
    contextLabel: { type: String, default: "" },
  },

  data() {
    return {
      desc: "",
      focused: false,
      overflowing: false,
      composerOpen: false,
      selecting: false,
      pointerY: 0,
      raf: null,
    };
  },

  mounted() {
    this.desc = this.todoDesc || "";
    this.$nextTick(this.resizeTextArea);
  },

  beforeUnmount() {
    this.stopAutoScroll();
  },

  methods: {
    maxHeight() {
      const el = this.$refs.descriptionInput;
      if (!el) return FALLBACK_MAX;

      const value = parseInt(
        window.getComputedStyle(el).maxHeight,
        10
      );

      return Number.isFinite(value) && value > 0
        ? value
        : FALLBACK_MAX;
    },

    resizeTextArea() {
      const el = this.$refs.descriptionInput;
      if (!el) return;

      const max = this.maxHeight();

      el.style.height = "auto";
      const natural = el.scrollHeight;

      el.style.height =
        Math.max(MIN_HEIGHT, Math.min(natural, max)) + "px";

      this.overflowing = natural > max + 2;
      el.style.overflowY = this.overflowing ? "auto" : "hidden";
    },

    /* ---------- 拖选自动滚动 ---------- */

    onPointerDown(event) {
      if (event.button !== 0) return;

      this.selecting = true;
      this.pointerY = event.clientY;

      window.addEventListener("pointermove", this.onPointerMove);
      window.addEventListener("pointerup", this.stopAutoScroll);
      window.addEventListener("pointercancel", this.stopAutoScroll);

      this.tick();
    },

    onPointerMove(event) {
      this.pointerY = event.clientY;
    },

    tick() {
      if (!this.selecting) return;

      const el = this.$refs.descriptionInput;

      if (el) {
        const rect = el.getBoundingClientRect();
        const top = rect.top + EDGE;
        const bottom = rect.bottom - EDGE;

        let velocity = 0;

        if (this.pointerY > bottom) {
          velocity = Math.min(
            MAX_SPEED,
            (this.pointerY - bottom) / 2.2
          );
        } else if (this.pointerY < top) {
          velocity = -Math.min(
            MAX_SPEED,
            (top - this.pointerY) / 2.2
          );
        }

        if (velocity) el.scrollTop += velocity;
      }

      this.raf = window.requestAnimationFrame(this.tick);
    },

    stopAutoScroll() {
      this.selecting = false;

      if (this.raf) {
        window.cancelAnimationFrame(this.raf);
        this.raf = null;
      }

      window.removeEventListener("pointermove", this.onPointerMove);
      window.removeEventListener("pointerup", this.stopAutoScroll);
      window.removeEventListener("pointercancel", this.stopAutoScroll);
    },

    /* ---------- 提交 ---------- */

    onBlur() {
      this.focused = false;
      this.commit();
    },

    commit() {
      this.$emit("updatedDescription", this.desc);
    },

    commitFromKeyboard() {
      this.$refs.descriptionInput?.blur();
    },

    /* ---------- 沉浸式 ---------- */

    openComposer() {
      this.commit();
      this.composerOpen = true;
    },

    onComposerInput(value) {
      this.desc = value;
      this.commit();
    },

    closeComposer() {
      this.composerOpen = false;

      this.$nextTick(() => {
        this.resizeTextArea();
        this.$refs.expandButton?.focus();
      });
    },

    goToMarkDown() {
      window.open("https://commonmark.org/help/", "_blank");
    },
  },

  watch: {
    /* 同值守卫：父级每次 updateTodo() 都会把 todo.desc 回流下来，
       无条件赋值会在输入过程中把光标弹回原处。 */
    todoDesc(value) {
      const next = value || "";
      if (next === this.desc) return;

      this.desc = next;
      this.$nextTick(this.resizeTextArea);
    },

    desc() {
      this.$nextTick(this.resizeTextArea);
    },
  },
};
</script>

<style scoped lang="scss">
.notes-field {
  --notes-max-height: 240px;

  position: relative;
}

/* ---------------- 字段头 ---------------- */

.notes-field-head {
  display: flex;
  min-height: 26px;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: 0 2px 7px 10px;
}

.notes-field-label {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #8a8f98;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.notes-field-label i {
  font-size: 0.9rem;
}

.notes-field-tools {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 1px;
  /* 平时半隐：工具不与标签抢注意力，指针进入字段区即现形。 */
  opacity: 0.42;
  transition: opacity 0.14s ease;
}

.notes-field:hover .notes-field-tools,
.notes-field.is-focused .notes-field-tools,
.notes-field-tools:focus-within {
  opacity: 1;
}

.notes-tool {
  display: grid;
  width: 26px;
  height: 26px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 6px;
  outline: none;
  background: transparent;
  color: #8b929b;
  cursor: pointer;
  transition:
    background-color 0.14s ease,
    color 0.14s ease;
}

.notes-tool:hover {
  background: #eef1f5;
  color: #4263eb;
}

.notes-tool:focus-visible {
  box-shadow: 0 0 0 2px rgba(66, 99, 235, 0.28);
}

.notes-tool svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.55;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* ---------------- 输入域 ---------------- */

.notes-input {
  display: block;
  width: 100%;
  min-height: 96px;
  max-height: var(--notes-max-height);
  padding: 11px 13px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 9px;
  outline: none;
  background: transparent;
  color: inherit;
  font-family: inherit;
  font-size: 14px;
  line-height: 21px;
  resize: none;
  /* 关键：切断到 .modal-body 的滚动链传导。 */
  overscroll-behavior: contain;
  white-space: pre-wrap;
  word-break: break-word;
  cursor: text;
  transition:
    border-color 0.15s ease-out,
    box-shadow 0.15s ease-out;
}

.notes-input:hover {
  border-color: rgba(66, 99, 235, 0.28);
}

.notes-input:focus {
  border-color: #4263eb;
  box-shadow: 0 0 0 3px rgba(66, 99, 235, 0.08);
}

.notes-input::placeholder {
  color: #b7bdc5;
}

/* ---------------- 溢出出口 ---------------- */

.notes-overflow-cue {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 6px;
  padding: 5px 8px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #9aa0a9;
  font-family: inherit;
  font-size: 10.5px;
  cursor: pointer;
  transition:
    background-color 0.14s ease,
    color 0.14s ease;
}

.notes-overflow-cue:hover {
  background: #f1f3f6;
  color: #4263eb;
}

.notes-overflow-cue svg {
  width: 13px;
  height: 13px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* ---------------- 暗色 ---------------- */

.dark-theme .notes-field-label {
  color: #6b7078;
}

.dark-theme .notes-input {
  border-color: rgba(255, 255, 255, 0.2);
  color: #c9d1d9;
}

.dark-theme .notes-input:hover {
  border-color: rgba(108, 143, 255, 0.42);
}

.dark-theme .notes-input:focus {
  border-color: #6c8fff;
  box-shadow: 0 0 0 3px rgba(108, 143, 255, 0.12);
}

.dark-theme .notes-input::placeholder {
  color: #5d6670;
}

.dark-theme .notes-tool:hover,
.dark-theme .notes-overflow-cue:hover {
  background: #252c35;
  color: #93a8f5;
}
</style>
