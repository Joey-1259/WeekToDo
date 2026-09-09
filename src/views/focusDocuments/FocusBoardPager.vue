<template>
  <div v-if="pageCount > 1" class="focus-pager">
    <button
      type="button"
      class="focus-pager-arrow is-prev"
      :disabled="page <= 0"
      :aria-label="'上一版面（第 ' + page + ' / ' + pageCount + ' 个）'"
      :title="'上一版面 · ' + (page + 1) + '/' + pageCount"
      @click="$emit('step', -1)"
      @dragover.prevent="onArrowDragOver(-1)"
      @dragleave="cancelHover"
      @drop="cancelHover"
    >
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M12 4 6.5 10 12 16" />
      </svg>
    </button>

    <button
      type="button"
      class="focus-pager-arrow is-next"
      :disabled="page >= pageCount - 1"
      :aria-label="'下一版面（第 ' + (page + 2) + ' / ' + pageCount + ' 个）'"
      :title="'下一版面 · ' + (page + 1) + '/' + pageCount"
      @click="$emit('step', 1)"
      @dragover.prevent="onArrowDragOver(1)"
      @dragleave="cancelHover"
      @drop="cancelHover"
    >
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M8 4l5.5 6L8 16" />
      </svg>
    </button>
  </div>
</template>

<script>
/* FOCUS_UI_SYSTEM_20260909_V4 */

/**
 * 版面翻页。
 *
 * 这一版移除了底部的圆点指示条：页码信息在只有 2~4 个版面时属于冗余表达，
 * 而它压在卡片正文下沿会持续占用垂直空间。当前位置改为通过箭头的
 * aria-label / title 暴露，屏幕阅读器与悬停都能拿到，视觉上则完全让位给内容。
 */

const DRAG_FLIP_DELAY = 620;

export default {
  name: "FocusBoardPager",

  props: {
    page: { type: Number, default: 0 },
    pageCount: { type: Number, default: 1 },
  },

  emits: ["step", "go"],

  data() {
    return { hoverTimer: null };
  },

  beforeUnmount() {
    clearTimeout(this.hoverTimer);
  },

  methods: {
    /** 拖着卡片悬停在箭头上会自动翻页，用于跨版面重排。 */
    onArrowDragOver(direction) {
      if (this.hoverTimer) return;

      this.hoverTimer = setTimeout(() => {
        this.hoverTimer = null;

        const target = this.page + direction;
        if (target < 0 || target > this.pageCount - 1) return;

        this.$emit("step", direction);
      }, DRAG_FLIP_DELAY);
    },

    cancelHover() {
      clearTimeout(this.hoverTimer);
      this.hoverTimer = null;
    },
  },
};
</script>

<style scoped lang="scss">
.focus-pager {
  position: absolute;
  z-index: 6;
  inset: 0;
  pointer-events: none;
}

/* FOCUS_UI_SYSTEM_20260912_V7
   翻页箭头与 rail 上的 + 号原本都钉在垂直中线，必然重叠。
   两者的语义层级不同：+ 号属于"这一栏"（局部、频次高），
   箭头属于"整个版面"（全局、频次低）。所以把全局的箭头
   下移到 62%，局部的 + 号留在中线 —— 既错开，也让层级
   在空间上可读，而不是随便挪开了事。 */
.focus-pager-arrow {
  position: absolute;
  top: calc(62% - 17px);
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  padding: 0;
  border: 1px solid #e0e4e9;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.94);
  box-shadow:
    0 3px 12px rgba(24, 29, 38, 0.1),
    0 1px 2px rgba(24, 29, 38, 0.06);
  color: #6d747e;
  cursor: pointer;
  opacity: 0.5;
  pointer-events: auto;
  backdrop-filter: blur(6px);
  transition:
    opacity 0.16s ease,
    color 0.16s ease,
    border-color 0.16s ease,
    transform 0.16s ease;
}

.focus-pager-arrow.is-prev { left: -15px; }
.focus-pager-arrow.is-next { right: -15px; }

.focus-pager:hover .focus-pager-arrow { opacity: 0.9; }

.focus-pager-arrow:hover:not(:disabled) {
  border-color: #b7c5f2;
  color: #4263eb;
  opacity: 1;
  transform: scale(1.08);
}

.focus-pager-arrow:disabled {
  cursor: default;
  opacity: 0.18;
}

.focus-pager-arrow svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.dark-theme .focus-pager-arrow {
  border-color: #39414c;
  background: rgba(29, 35, 43, 0.94);
  color: #a3abb6;
}

.dark-theme .focus-pager-arrow:hover:not(:disabled) {
  border-color: #6f8bea;
  color: #93a8f5;
}
</style>
