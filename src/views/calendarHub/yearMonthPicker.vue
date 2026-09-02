<template>
  <teleport to="body">
    <div class="ymp-mask" @click.self="$emit('close')">
      <div class="year-month-picker" :style="pickerStyle" @click.stop>
        <div class="ymp-breadcrumb d-flex align-items-center">
          <span
            class="crumb-item"
            :class="{ clickable: step === 'month' }"
            @click="step === 'month' && goToYearStep()"
          >{{ yearGridStart }} - {{ yearGridStart + 11 }}</span>
          <i class="bi-chevron-right crumb-sep" v-if="step === 'month'"></i>
          <span class="crumb-item current" v-if="step === 'month'">{{ year }}</span>
          <i class="bi-x ms-auto close-icon" @click="$emit('close')"></i>
        </div>

        <div v-if="step === 'year'" class="ymp-year-step">
          <div class="ymp-nav-row d-flex align-items-center justify-content-between">
            <i class="bi-chevron-left ymp-arrow" @click="yearGridStart -= 12"></i>
            <span class="ymp-range-label">{{ yearGridStart }} - {{ yearGridStart + 11 }}</span>
            <i class="bi-chevron-right ymp-arrow" @click="yearGridStart += 12"></i>
          </div>
          <div class="ymp-year-grid">
            <span
              v-for="y in yearCells"
              :key="y"
              class="ymp-year-cell"
              :class="{ active: y === year, 'is-current': y === currentRealYear }"
              @click="pickYear(y)"
            >{{ y }}</span>
          </div>
        </div>

        <div v-else class="ymp-month-step">
          <div class="ymp-month-grid">
            <span
              v-for="(m, idx) in monthNames"
              :key="idx"
              class="ymp-month-cell"
              :class="{ active: isActiveMonth(idx), 'is-current': isCurrentMonth(idx) }"
              @click="pickMonth(idx)"
            >{{ m }}</span>
          </div>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script>
import moment from "moment";

export default {
  name: "yearMonthPicker",
  props: {
    value: { type: String, required: true }, // "YYYY-MM"
    language: { type: String, default: "zh_cn" },
    anchorEl: { type: Object, default: null }, // 触发按钮的 DOM 元素，用于计算弹层定位坐标
  },
  emits: ["select", "close"],
  data() {
    let y = parseInt(this.value.split("-")[0]);
    return {
      step: "month", // 默认直接展示当前所在年份的月份层，点面包屑上的年份区间才回到年份选择层
      year: y,
      yearGridStart: Math.floor((y - 1) / 12) * 12 + 1,
      pickerStyle: {},
    };
  },
  computed: {
    currentRealYear: function () {
      return moment().year();
    },
    yearCells: function () {
      let cells = [];
      for (let i = 0; i < 12; i++) cells.push(this.yearGridStart + i);
      return cells;
    },
    monthNames: function () {
      if (this.language === "zh_cn" || this.language === "zh_tw") {
        return ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
      }
      let names = [];
      for (let i = 0; i < 12; i++) {
        names.push(moment().locale(this.language).month(i).format("MMM"));
      }
      return names;
    },
  },
  mounted() {
    this.computePosition();
    document.addEventListener("click", this.onOutsideClick, true);
    window.addEventListener("resize", this.computePosition);
  },
  beforeUnmount() {
    document.removeEventListener("click", this.onOutsideClick, true);
    window.removeEventListener("resize", this.computePosition);
  },
  methods: {
    computePosition: function () {
      if (!this.anchorEl) {
        // 没有传入锚点时退化为屏幕居中显示，保证组件在任何调用场景下都不会渲染错位
        this.pickerStyle = {
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
        };
        return;
      }
      let rect = this.anchorEl.getBoundingClientRect();
      let pickerWidth = 280;
      let pickerHeight = 320;
      let left = rect.left;
      let top = rect.bottom + 8;

      if (left + pickerWidth > window.innerWidth - 12) {
        left = window.innerWidth - pickerWidth - 12;
      }
      if (left < 12) left = 12;

      if (top + pickerHeight > window.innerHeight - 12) {
        top = rect.top - pickerHeight - 8;
      }
      if (top < 12) top = 12;

      this.pickerStyle = { left: `${left}px`, top: `${top}px`, transform: "none" };
    },
    onOutsideClick: function (e) {
      if (this.$el && !this.$el.contains(e.target)) {
        this.$emit("close");
      }
    },
    goToYearStep: function () {
      this.step = "year";
    },
    pickYear: function (y) {
      this.year = y;
      this.step = "month";
    },
    pickMonth: function (idx) {
      let mm = String(idx + 1).padStart(2, "0");
      this.$emit("select", `${this.year}-${mm}`);
      this.$emit("close");
    },
    isActiveMonth: function (idx) {
      let parts = this.value.split("-");
      return parseInt(parts[0]) === this.year && parseInt(parts[1]) === idx + 1;
    },
    isCurrentMonth: function (idx) {
      return this.year === moment().year() && idx === moment().month();
    },
  },
};
</script>

<style scoped lang="scss">
.ymp-mask {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: transparent;
}

.year-month-picker {
  position: fixed;
  width: 280px;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18);
  padding: 14px 16px;
  animation: ymp-pop-in 0.16s ease;

  .dark-theme & {
    background: #21262d;
    color: #c9d1d9;
  }
}

@keyframes ymp-pop-in {
  from {
    opacity: 0;
    transform: translateY(-6px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.ymp-breadcrumb {
  margin-bottom: 10px;
  font-size: 0.86rem;

  .crumb-item {
    color: #9aa0a8;

    &.current {
      color: #212529;
      font-weight: 600;

      .dark-theme & {
        color: #fff;
      }
    }

    &.clickable {
      cursor: pointer;
      color: #4263eb;
    }
  }

  .crumb-sep {
    font-size: 0.7rem;
    margin: 0 4px;
    color: #c9ccd1;
  }

  .close-icon {
    cursor: pointer;
    font-size: 1.1rem;
    opacity: 0.6;

    &:hover {
      opacity: 1;
    }
  }
}

.ymp-nav-row {
  margin-bottom: 8px;

  .ymp-range-label {
    font-size: 0.88rem;
    font-weight: 600;
  }

  .ymp-arrow {
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;

    &:hover {
      background-color: #f4f5f7;

      .dark-theme & {
        background-color: #2e353d;
      }
    }
  }
}

.ymp-year-grid,
.ymp-month-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.ymp-year-cell,
.ymp-month-cell {
  text-align: center;
  padding: 9px 0;
  border-radius: 8px;
  font-size: 0.84rem;
  cursor: pointer;

  &:hover {
    background-color: #f4f5f7;

    .dark-theme & {
      background-color: #1a1e24;
    }
  }

  &.is-current {
    color: #4263eb;
    font-weight: 600;

    .dark-theme & {
      color: #6c8fff;
    }
  }

  &.active {
    background-color: #4263eb;
    color: #fff;
  }
}
</style>
