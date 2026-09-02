<template>
  <teleport to="body">
    <div class="ymp-mask" @click.self="$emit('close')">
      <div class="year-month-picker" :style="pickerStyle" @click.stop>
        <div class="ymp-header d-flex align-items-center justify-content-between">
          <i class="bi-chevron-left ymp-arrow" @click="year--"></i>
          <span class="ymp-year-label">{{ yearLabel }}</span>
          <i class="bi-chevron-right ymp-arrow" @click="year++"></i>
          <i class="bi-x ms-2 close-icon" @click="$emit('close')"></i>
        </div>

        <div class="ymp-month-grid">
          <span
            v-for="(m, idx) in monthNames"
            :key="idx"
            class="ymp-month-cell"
            :class="{ active: isActiveMonth(idx), 'is-current': isCurrentMonth(idx) }"
            @click="pickMonth(idx)"
          >{{ m }}</span>
        </div>

        <button type="button" class="ymp-today-btn" @click="pickToday">{{ $t("calendarHub.today") }}</button>
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
    anchorEl: { type: Object, default: null },
  },
  emits: ["select", "close"],
  data() {
    return {
      year: parseInt(this.value.split("-")[0]),
      pickerStyle: {},
    };
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
        this.pickerStyle = { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
        return;
      }
      let rect = this.anchorEl.getBoundingClientRect();
      let pickerWidth = 260;
      let pickerHeight = 250;
      let left = rect.left;
      let top = rect.bottom + 8;

      if (left + pickerWidth > window.innerWidth - 12) left = window.innerWidth - pickerWidth - 12;
      if (left < 12) left = 12;
      if (top + pickerHeight > window.innerHeight - 12) top = rect.top - pickerHeight - 8;
      if (top < 12) top = 12;

      this.pickerStyle = { left: `${left}px`, top: `${top}px`, transform: "none" };
    },
    onOutsideClick: function (e) {
      if (this.$el && !this.$el.contains(e.target)) this.$emit("close");
    },
    pickMonth: function (idx) {
      let mm = String(idx + 1).padStart(2, "0");
      this.$emit("select", `${this.year}-${mm}`);
      this.$emit("close");
    },
    pickToday: function () {
      this.year = moment().year();
      this.$emit("select", moment().format("YYYY-MM"));
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
  computed: {
    yearLabel: function () {
      return this.language === "zh_cn" || this.language === "zh_tw" ? `${this.year}年` : String(this.year);
    },
    monthNames: function () {
      if (this.language === "zh_cn" || this.language === "zh_tw") {
        return ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
      }
      let names = [];
      for (let i = 0; i < 12; i++) names.push(moment().locale(this.language).month(i).format("MMM"));
      return names;
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
  width: 260px;
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
  from { opacity: 0; transform: translateY(-6px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.ymp-header {
  margin-bottom: 10px;
}

.ymp-year-label {
  font-size: 0.95rem;
  font-weight: 600;
}

.ymp-arrow {
  cursor: pointer;
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 1rem;

  &:hover {
    background-color: #f4f5f7;

    .dark-theme & {
      background-color: #2e353d;
    }
  }
}

.close-icon {
  cursor: pointer;
  font-size: 1.1rem;
  opacity: 0.6;

  &:hover {
    opacity: 1;
  }
}

.ymp-month-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 10px;
}

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

.ymp-today-btn {
  width: 100%;
  border: 1px solid #dcdfe4;
  border-radius: 8px;
  background: transparent;
  padding: 6px 0;
  font-size: 0.82rem;
  cursor: pointer;

  &:hover {
    background-color: #f4f5f7;
  }

  .dark-theme & {
    border-color: #30363d;
    color: #c9d1d9;

    &:hover {
      background-color: #1a1e24;
    }
  }
}
</style>
