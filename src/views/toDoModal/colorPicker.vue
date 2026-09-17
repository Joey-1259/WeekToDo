<template>
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
