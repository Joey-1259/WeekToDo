<template>
  <div class="color-tag-picker" ref="anchor">
    <button
      type="button"
      class="ctp-trigger"
      :title="triggerTitle"
      aria-haspopup="dialog"
      :aria-expanded="String(open)"
      @mousedown.prevent.stop
      @click.stop="togglePanel"
    >
      <span
        v-if="hasColor"
        class="ctp-dot"
        :style="{ backgroundColor: currentColor }"
      ></span>
      <span v-else class="ctp-dot ctp-dot--empty"></span>
    </button>

    <Transition name="ctp-fade">
        <div
          v-if="open"
          ref="panel"
          class="ctp-panel"
          tabindex="-1"
          role="dialog"
          aria-label="颜色标签"
          @mousedown.stop
          @click.stop
          @keydown.stop
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
              @mousedown.stop
              @click.stop
              @keydown.stop
              @keydown.enter.stop.prevent="commitName"
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
              title="无颜色"
              aria-label="清除颜色标签"
              @mousedown.prevent.stop
              @click.stop="pickColor('none')"
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
              :title="tag.name || '选择此颜色'"
              :aria-label="tag.name || '选择此颜色'"
              @mousedown.prevent.stop
              @click.stop="pickColor(tag.color)"
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
            <button
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
            }}</button>
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
              :title="tag.name || '选择此颜色'"
              :aria-label="tag.name || '选择此颜色'"
              @mousedown.prevent.stop
              @click.stop="pickColor(tag.color)"
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
      this.open = true;

      /*
       * 颜色面板必须保留在 Bootstrap Modal 的 DOM 内。
       * 不可 Teleport 到 body，否则 Modal FocusTrap 会把
       * 焦点重定向到顶部第一个日期输入框。
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
/*
 * ColorPicker 必须建立自己的定位上下文。
 * 面板保留在 Bootstrap Modal 内，避免 FocusTrap 将焦点
 * 错误重定向到顶部的日期输入框。
 */
.color-tag-picker {
  position: relative;
  z-index: 40;
  display: inline-flex;
  align-items: center;
  isolation: isolate;
}

/*
 * 属性工具条及属性区域必须允许颜色浮层越界显示。
 */
:global(#toDoModal .task-properties-section),
:global(#toDoModal .attribute-toolbar),
:global(#toDoModal .attribute-tools) {
  overflow: visible;
}

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
  position: absolute;
  top: calc(100% + 7px);
  left: 0;
  z-index: 22000;
  width: 260px;
  padding: 10px 12px;
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
  &.is-active {
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
  }
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
