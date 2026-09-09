<template>
  <div v-if="pageCount > 1" class="focus-pager" aria-hidden="false">
    <button
      type="button"
      class="focus-pager-arrow is-prev"
      :disabled="page <= 0"
      :aria-label="`上一版面（共 ${pageCount} 个）`"
      title="上一版面"
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
      :aria-label="`下一版面（共 ${pageCount} 个）`"
      title="下一版面"
      @click="$emit('step', 1)"
      @dragover.prevent="onArrowDragOver(1)"
      @dragleave="cancelHover"
      @drop="cancelHover"
    >
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M8 4l5.5 6L8 16" />
      </svg>
    </button>

    <div
      class="focus-pager-rail"
      :class="{ 'is-flash': flashing }"
      role="tablist"
      aria-label="版面切换"
    >
      <button
        v-for="index in pageCount"
        :key="index"
        type="button"
        class="focus-pager-dot"
        :class="{ active: index - 1 === page }"
        role="tab"
        :aria-selected="String(index - 1 === page)"
        :aria-label="`第 ${index} 版面`"
        :title="`第 ${index} 版面`"
        @click="$emit('go', index - 1)"
      >
        <i aria-hidden="true"></i>
      </button>

      <em>{{ page + 1 }} / {{ pageCount }}</em>
    </div>
  </div>
</template>

<script>
/* FOCUS_COLUMN_PAGES_20260909_V3 */

const DRAG_FLIP_DELAY = 620;

export default {
  name: "FocusBoardPager",

  props: {
    page: { type: Number, default: 0 },
    pageCount: { type: Number, default: 1 },
  },

  emits: ["step", "go"],

  data() {
    return {
      hoverTimer: null,
      flashing: false,
      flashTimer: null,
    };
  },

  watch: {
    page() {
      this.flash();
    },

    pageCount() {
      this.flash();
    },
  },

  beforeUnmount() {
    clearTimeout(this.hoverTimer);
    clearTimeout(this.flashTimer);
  },

  methods: {
    flash() {
      clearTimeout(this.flashTimer);
      this.flashing = true;

      this.flashTimer = setTimeout(() => {
        this.flashing = false;
      }, 520);
    },

    /** 拖拽卡片悬停在箭头上时自动翻页，用于跨版面重排。 */
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

.focus-pager-arrow {
  position: absolute;
  top: calc(50% - 17px);
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
  opacity: 0.55;
  pointer-events: auto;
  backdrop-filter: blur(6px);
  transition:
    opacity 0.16s ease,
    color 0.16s ease,
    border-color 0.16s ease,
    transform 0.16s ease;
}

.focus-pager-arrow.is-prev {
  left: -15px;
}

.focus-pager-arrow.is-next {
  right: -15px;
}

.focus-pager:hover .focus-pager-arrow {
  opacity: 0.9;
}

.focus-pager-arrow:hover:not(:disabled) {
  border-color: #b7c5f2;
  color: #4263eb;
  opacity: 1;
  transform: scale(1.08);
}

.focus-pager-arrow:disabled {
  cursor: default;
  opacity: 0.2;
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

.focus-pager-rail {
  position: absolute;
  bottom: 2px;
  left: 50%;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 11px 4px 8px;
  border: 1px solid #e4e7ec;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 2px 8px rgba(24, 29, 38, 0.07);
  pointer-events: auto;
  transform: translateX(-50%);
  backdrop-filter: blur(6px);
  transition: border-color 0.24s ease, box-shadow 0.24s ease;
}

.focus-pager-rail.is-flash {
  border-color: #a8b8f0;
  box-shadow: 0 0 0 3px rgba(66, 99, 235, 0.11);
}

.focus-pager-dot {
  display: grid;
  width: 16px;
  height: 16px;
  place-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.focus-pager-dot i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ccd1d8;
  transition:
    width 0.18s ease,
    background-color 0.18s ease,
    border-radius 0.18s ease;
}

.focus-pager-dot:hover i {
  background: #9aa2ad;
}

.focus-pager-dot.active i {
  width: 15px;
  border-radius: 3px;
  background: #4263eb;
}

.focus-pager-rail em {
  margin-left: 3px;
  color: #969ca5;
  font-size: 10px;
  font-style: normal;
  font-variant-numeric: tabular-nums;
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

.dark-theme .focus-pager-rail {
  border-color: #39414c;
  background: rgba(29, 35, 43, 0.92);
}

.dark-theme .focus-pager-dot i {
  background: #454e59;
}

.dark-theme .focus-pager-dot.active i {
  background: #7d95f0;
}
</style>
