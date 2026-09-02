<template>
  <div class="year-month-picker" @click.stop>
    <div class="ymp-year-row d-flex align-items-center justify-content-center">
      <i class="bi-chevron-left ymp-arrow" @click="year--"></i>
      <span class="ymp-year">{{ year }}</span>
      <i class="bi-chevron-right ymp-arrow" @click="year++"></i>
    </div>
    <div class="ymp-month-grid">
      <span
        v-for="(m, idx) in monthNames"
        :key="idx"
        class="ymp-month-cell"
        :class="{ active: isActiveMonth(idx) }"
        @click="pick(idx)"
      >{{ m }}</span>
    </div>
  </div>
</template>

<script>
import moment from "moment";

export default {
  name: "yearMonthPicker",
  props: {
    value: { type: String, required: true }, // "YYYY-MM"
    language: { type: String, default: "zh_cn" },
  },
  emits: ["select", "close"],
  data() {
    return {
      year: parseInt(this.value.split("-")[0]),
    };
  },
  mounted() {
    document.addEventListener("click", this.onOutsideClick, true);
  },
  beforeUnmount() {
    document.removeEventListener("click", this.onOutsideClick, true);
  },
  methods: {
    onOutsideClick: function (e) {
      if (this.$el && !this.$el.contains(e.target)) {
        this.$emit("close");
      }
    },
    isActiveMonth: function (idx) {
      let parts = this.value.split("-");
      return parseInt(parts[0]) === this.year && parseInt(parts[1]) === idx + 1;
    },
    pick: function (idx) {
      this.$emit("select", `${this.year}-${String(idx + 1).padStart(2, "0")}`);
      this.$emit("close");
    },
  },
  computed: {
    monthNames: function () {
      if (this.language === "zh_cn" || this.language === "zh_tw") {
        return ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
      }
      return moment.monthsShort();
    },
  },
};
</script>

<style scoped lang="scss">
.year-month-picker {
  position: absolute;
  top: 40px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  background-color: white;
  border-radius: 10px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.16);
  padding: 12px;
  width: 240px;

  .dark-theme & {
    background-color: #21262d;
    border: 1px solid #30363d;
  }
}

.ymp-year-row {
  margin-bottom: 8px;

  .ymp-year {
    font-size: 0.95rem;
    font-weight: 600;
    margin: 0 16px;
    min-width: 50px;
    text-align: center;
  }

  .ymp-arrow {
    padding: 4px 8px;
    border-radius: 6px;
    cursor: pointer;

    &:hover {
      background-color: #eaecef;

      .dark-theme & {
        background-color: #2e353d;
      }
    }
  }
}

.ymp-month-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.ymp-month-cell {
  text-align: center;
  padding: 7px 0;
  border-radius: 6px;
  font-size: 0.82rem;
  cursor: pointer;

  &:hover {
    background-color: #f4f5f7;

    .dark-theme & {
      background-color: #1a1e24;
    }
  }

  &.active {
    background-color: #4263eb;
    color: white;
  }
}
</style>
