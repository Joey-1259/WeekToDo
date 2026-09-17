<template>
  <div class="color-tag-picker" ref="anchor">
    <!-- 触发按钮：色圆点 + 标签名 -->
    <button
      type="button"
      class="ctp-trigger"
      :title="triggerTitle"
      @click.stop="togglePanel"
    >
      <i
        :class="hasColor ? 'bi-circle-fill' : 'bi-circle'"
        :style="hasColor ? `color: ${currentColor}` : ''"
      ></i>
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
          <!-- 头部：标题 + 工具按钮 -->
          <header class="ctp-header">
            <span class="ctp-title">颜色标签</span>
            <div class="ctp-header-tools">
              <!-- 单选/多选切换 -->
              <button
                type="button"
                class="ctp-tool-btn"
                :class="{ active: multiSelect }"
                :title="multiSelect ? '切换为单选' : '切换为多选'"
                @click="multiSelect = !multiSelect"
              >
                <svg viewBox="0 0 16 16" width="13" height="13">
                  <rect v-if="!multiSelect" x="2" y="6" width="12" height="4" rx="2"
                    fill="none" stroke="currentColor" stroke-width="1.2"/>
                  <rect v-else x="2" y="2" width="12" height="5" rx="1.5"
                    fill="none" stroke="currentColor" stroke-width="1.2"/>
                  <rect v-if="multiSelect" x="2" y="9" width="12" height="5" rx="1.5"
                    fill="none" stroke="currentColor" stroke-width="1.2"/>
                </svg>
              </button>
              <!-- 编辑模式切换 -->
              <button
                type="button"
                class="ctp-tool-btn"
                :class="{ active: editMode }"
                title="编辑标签名称"
                @click="toggleEditMode"
              >
                <svg viewBox="0 0 16 16" width="13" height="13">
                  <path d="M11.5 1.5l3 3L5 14H2v-3z" fill="none"
                    stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
          </header>

          <!-- 无标签选项 -->
          <button
            type="button"
            class="ctp-row"
            :class="{ selected: !hasColor }"
            @click="pickColor('none')"
          >
            <i class="bi-circle ctp-dot" style="color: #d1d5db"></i>
            <span class="ctp-label">无标签</span>
          </button>

          <!-- 主色板 -->
          <div class="ctp-grid">
            <div
              v-for="tag in primaryTags"
              :key="tag.id"
              class="ctp-cell"
            >
              <button
                type="button"
                class="ctp-swatch"
                :class="{
                  selected: isSelected(tag),
                  wiggle: editMode,
                }"
                :style="`--swatch-color: ${tag.color}`"
                @click="onSwatchClick(tag)"
              >
                <i class="bi-circle-fill" :style="`color: ${tag.color}`"></i>
                <svg v-if="isSelected(tag)" class="ctp-check" viewBox="0 0 16 16">
                  <path d="M4 8l3 3 5-5" fill="none" stroke="#fff" stroke-width="2"
                    stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <span
                v-if="tag.name"
                class="ctp-swatch-label"
                :style="`color: ${tag.color}`"
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
                :class="{
                  selected: isSelected(tag),
                  wiggle: editMode,
                }"
                :style="`--swatch-color: ${tag.color}`"
                @click="onSwatchClick(tag)"
              >
                <i class="bi-circle-fill" :style="`color: ${tag.color}`"></i>
                <svg v-if="isSelected(tag)" class="ctp-check" viewBox="0 0 16 16">
                  <path d="M4 8l3 3 5-5" fill="none" stroke="#fff" stroke-width="2"
                    stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <span
                v-if="tag.name"
                class="ctp-swatch-label"
                :style="`color: ${tag.color}`"
              >{{ tag.name }}</span>
            </div>
          </div>

          <!-- 编辑模式下的 inline 命名输入 -->
          <Transition name="ctp-slide">
            <div v-if="renamingTag" class="ctp-rename" :key="renamingTag.id">
              <i class="bi-circle-fill" :style="`color: ${renamingTag.color}`"></i>
              <input
                ref="renameInput"
                type="text"
                maxlength="8"
                :value="renamingTag.name"
                :placeholder="'输入名称…'"
                @keydown.enter="commitRename"
                @keydown.esc="cancelRename"
                @blur="commitRename"
              />
              <button type="button" class="ctp-rename-ok" @mousedown.prevent="commitRename">✓</button>
            </div>
          </Transition>
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
      editMode: false,
      multiSelect: false,
      showExtended: false,
      renamingTag: null,
      primaryTags: [],
      extendedTags: [],
    };
  },
  computed: {
    currentColor() { return this.color || "none"; },
    hasColor() { return this.currentColor !== "none"; },
    triggerTitle() {
      if (!this.hasColor) return "设置颜色标签";
      const tag = this.primaryTags.concat(this.extendedTags)
        .find(t => t.color === this.currentColor);
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
      this.editMode = false;
      this.renamingTag = null;
      this.showExtended = false;

      const anchor = this.$refs.anchor;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const pw = 220, ph = 340;
      let left = rect.left;
      let top = rect.bottom + 6;

      // 不超出右边
      if (left + pw > window.innerWidth - 12) left = window.innerWidth - pw - 12;
      if (left < 12) left = 12;
      // 不超出底部
      if (top + ph > window.innerHeight - 12) top = rect.top - ph - 6;

      this.pos = { position: "fixed", left: `${left}px`, top: `${top}px`, width: `${pw}px` };
      this.open = true;
    },
    close() {
      this.open = false;
      this.renamingTag = null;
      this.editMode = false;
    },
    isSelected(tag) {
      return this.currentColor === tag.color;
    },
    pickColor(color) {
      this.$emit("colorSelected", color);
      if (!this.multiSelect) this.close();
    },
    onSwatchClick(tag) {
      if (this.editMode) {
        this.renamingTag = { ...tag };
        this.$nextTick(() => {
          const input = this.$refs.renameInput;
          if (input) { input.focus(); input.select(); }
        });
        return;
      }
      this.pickColor(tag.color);
    },
    toggleEditMode() {
      this.editMode = !this.editMode;
      if (!this.editMode) this.renamingTag = null;
    },
    commitRename() {
      if (!this.renamingTag) return;
      const input = this.$refs.renameInput;
      const newName = input ? input.value.trim() : "";
      defaultTaskTags.renameTag(this.renamingTag.id, newName);
      this.refreshTags();
      this.renamingTag = null;
    },
    cancelRename() {
      this.renamingTag = null;
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
  i { font-size: 14px; }
  &:hover { background: #f0f1f3; }
  .dark-theme &:hover { background: #21262d; }
}

/* ── 面板 ── */
.ctp-panel {
  z-index: 22000;
  padding: 8px;
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

/* ── 头部 ── */
.ctp-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 2px 4px 6px;
}
.ctp-title {
  font-size: 11px; font-weight: 600; color: #6b7280; letter-spacing: 0.02em;
  .dark-theme & { color: #9aa0a8; }
}
.ctp-header-tools { display: flex; gap: 2px; }
.ctp-tool-btn {
  display: grid; width: 24px; height: 24px; place-items: center;
  border: 0; border-radius: 5px; background: transparent;
  color: #9aa0a8; cursor: pointer; transition: all 0.12s;
  &:hover { background: #f0f1f3; color: #4263eb; }
  &.active { background: #eef2ff; color: #4263eb; }
  .dark-theme &:hover { background: #252c35; color: #8da2fb; }
  .dark-theme &.active { background: #1e2740; color: #8da2fb; }
}

/* ── 无标签行 ── */
.ctp-row {
  display: flex; align-items: center; gap: 8px;
  width: 100%; padding: 5px 6px; margin-bottom: 4px;
  border: 0; border-radius: 6px; background: transparent;
  font-size: 12px; color: #4a515b; text-align: left;
  cursor: pointer; transition: background 0.1s;
  .dark-theme & { color: #c5cbd3; }
  &:hover { background: #f4f5f7; .dark-theme & { background: #252c35; } }
  &.selected { background: #eef2ff; color: #4263eb; font-weight: 500;
    .dark-theme & { background: #1e2740; color: #8da2fb; } }
}
.ctp-dot { font-size: 12px; }
.ctp-label { font-size: 12px; }

/* ── 色板网格 ── */
.ctp-grid {
  display: flex; flex-wrap: wrap; gap: 6px;
  padding: 4px 2px;
}
.ctp-cell {
  display: flex; flex-direction: column; align-items: center; gap: 3px;
}
.ctp-swatch {
  position: relative;
  display: grid; place-items: center;
  width: 28px; height: 28px;
  border: 2px solid transparent; border-radius: 8px;
  background: transparent; cursor: pointer;
  transition: border-color 0.12s, transform 0.12s;
  i { font-size: 18px; }
  &:hover { border-color: var(--swatch-color); transform: scale(1.1); }
  &.selected { border-color: var(--swatch-color); }
}
.ctp-check {
  position: absolute; width: 12px; height: 12px;
  top: 50%; left: 50%; transform: translate(-50%, -50%);
}
.ctp-swatch-label {
  font-size: 9px; font-weight: 500; max-width: 32px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  text-align: center;
}

/* ── 抖动动画 ── */
@keyframes wiggle {
  0%, 100% { transform: rotate(0deg); }
  20% { transform: rotate(-3deg); }
  40% { transform: rotate(3deg); }
  60% { transform: rotate(-2deg); }
  80% { transform: rotate(2deg); }
}
.ctp-swatch.wiggle {
  animation: wiggle 0.4s ease-in-out infinite;
  &:hover { animation-play-state: paused; transform: scale(1.15); }
}

/* ── 更多颜色 ── */
.ctp-more {
  display: block; width: 100%;
  padding: 5px 6px; margin-top: 2px;
  border: 0; border-radius: 6px; background: transparent;
  font-size: 11px; color: #9aa0a8; text-align: left;
  cursor: pointer; transition: background 0.1s;
  &:hover { background: #f4f5f7; color: #4263eb; }
  .dark-theme &:hover { background: #252c35; color: #8da2fb; }
}

.ctp-extended { border-top: 1px solid #f0f1f3; padding-top: 6px; margin-top: 2px;
  .dark-theme & { border-top-color: #2d333b; } }

/* ── 命名输入 ── */
.ctp-rename {
  display: flex; align-items: center; gap: 6px;
  margin-top: 6px; padding: 6px;
  border: 1px solid #e2e6ec; border-radius: 8px;
  background: #fafbfc;
  .dark-theme & { border-color: #333a44; background: #161b22; }
  i { font-size: 14px; flex: 0 0 auto; }
  input {
    flex: 1; min-width: 0; height: 24px;
    padding: 0 6px; border: 0; outline: none;
    background: transparent; font-family: inherit;
    font-size: 12px; color: #2f353d;
    .dark-theme & { color: #e0e5eb; }
  }
}
.ctp-rename-ok {
  width: 24px; height: 24px; border: 0; border-radius: 5px;
  background: #4263eb; color: #fff; font-size: 12px;
  cursor: pointer; transition: background 0.12s;
  &:hover { background: #3451c7; }
}

.ctp-slide-enter-active, .ctp-slide-leave-active {
  transition: all 0.15s ease;
}
.ctp-slide-enter-from, .ctp-slide-leave-to {
  opacity: 0; transform: translateY(-6px);
}
</style>
