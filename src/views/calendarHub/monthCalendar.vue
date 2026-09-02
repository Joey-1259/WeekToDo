<template>
  <div class="month-calendar">
    <div class="month-calendar-toolbar d-flex align-items-center mb-3">
      <i class="bi-chevron-left nav-icon" @click="prevMonth"></i>
      <span class="month-label" @click="toggleYearMonthPicker">{{ monthLabel }}</span>
      <i class="bi-chevron-right nav-icon" @click="nextMonth"></i>
      <button class="btn btn-sm today-btn" type="button" @click="backToToday">{{ $t("calendarHub.today") }}</button>

      <year-month-picker
        v-if="showYearMonthPicker"
        :value="month"
        :language="language"
        @select="onSelectYearMonth"
        @close="showYearMonthPicker = false"
      ></year-month-picker>
    </div>

    <div class="weekday-row">
      <span v-for="(w, idx) in weekdayLabels" :key="idx" class="weekday-cell">{{ w }}</span>
    </div>

    <div class="days-grid">
      <div
        v-for="cell in cells"
        :key="cell.dateStr"
        class="day-cell"
        :class="{
          'out-month': !cell.inMonth,
          'is-today': cell.isToday,
          'is-picked': cell.isPicked,
          'has-off-holiday': cell.hasOffHoliday,
          'has-workday': cell.hasWorkday && !cell.hasOffHoliday,
        }"
        @click="$emit('day-click', cell.dateStr)"
      >
        <span v-if="cell.hasWorkday && !cell.hasOffHoliday" class="workday-badge" :title="cell.holidayNamesFull">{{ $t("calendarHub.workdayBadge") }}</span>
        <span class="day-num">{{ cell.dayNum }}</span>
        <span v-if="cell.lunarText" class="lunar-text" :class="{ 'is-term': cell.isTerm }">{{ cell.lunarText }}</span>
        <span v-if="cell.hasOffHoliday && cell.holidayName" class="holiday-name" :title="cell.holidayNamesFull">{{ cell.holidayName }}</span>
        <span class="anniversary-dots" :title="cell.anniversaryNamesFull">
          <i v-for="a in cell.anniversaries.slice(0, 4)" :key="a.id" class="dot" :style="{ backgroundColor: a.color || '#748ffc' }"></i>
          <span v-if="cell.anniversaries.length > 4" class="dot-more">+{{ cell.anniversaries.length - 4 }}</span>
        </span>
      </div>
    </div>
  </div>
</template>

<script>
import moment from "moment";
import { solar2lunar } from "../../helpers/solarLunarCore";
import holidayHelper from "../../helpers/holidayHelper";
import anniversaryHelper from "../../helpers/anniversaryHelper";
import yearMonthPicker from "./yearMonthPicker.vue";

export default {
  name: "monthCalendar",
  components: { yearMonthPicker },
  props: {
    month: { type: String, required: true }, // "YYYY-MM"
    countryCodes: { type: Array, default: () => ["CN"] },
    anniversaryList: { type: Array, default: () => [] },
    weekStartOnMonday: { type: Boolean, default: true },
    pickedDate: { type: String, default: null }, // "YYYYMMDD"
    language: { type: String, default: "zh_cn" },
    showLunar: { type: Boolean, default: true },
  },
  emits: ["update:month", "day-click"],
  data() {
    return {
      showYearMonthPicker: false,
    };
  },
  methods: {
    prevMonth: function () {
      this.$emit("update:month", moment(this.month + "-01", "YYYY-MM-DD").subtract(1, "month").format("YYYY-MM"));
    },
    nextMonth: function () {
      this.$emit("update:month", moment(this.month + "-01", "YYYY-MM-DD").add(1, "month").format("YYYY-MM"));
    },
    backToToday: function () {
      this.$emit("update:month", moment().format("YYYY-MM"));
      this.$emit("day-click", moment().format("YYYYMMDD"));
    },
    toggleYearMonthPicker: function () {
      this.showYearMonthPicker = !this.showYearMonthPicker;
    },
    onSelectYearMonth: function (newMonth) {
      this.$emit("update:month", newMonth);
    },
  },
  computed: {
    monthLabel: function () {
      return moment(this.month + "-01", "YYYY-MM-DD").locale(this.language).format("YYYY年M月");
    },
    weekdayLabels: function () {
      let names = moment.weekdaysMin();
      let start = this.weekStartOnMonday ? 1 : 0;
      let rotated = [];
      for (let i = 0; i < 7; i++) rotated.push(names[(start + i) % 7]);
      return rotated;
    },
    cells: function () {
      let monthStart = moment(this.month + "-01", "YYYY-MM-DD");
      let startDow = monthStart.day();
      let weekStartsOnValue = this.weekStartOnMonday ? 1 : 0;
      let diff = (startDow - weekStartsOnValue + 7) % 7;
      let cursor = monthStart.clone().subtract(diff, "days");
      let todayStr = moment().format("YYYYMMDD");
      let result = [];

      for (let i = 0; i < 42; i++) {
        let dateStr = cursor.format("YYYYMMDD");
        let holidayInfos = holidayHelper.getDayInfoMulti(dateStr, this.countryCodes);
        let hasOffHoliday = holidayInfos.some((h) => h.isOffDay);
        let hasWorkday = holidayInfos.some((h) => !h.isOffDay);
        let offHolidayInfos = holidayInfos.filter((h) => h.isOffDay);
        let firstHolidayName = offHolidayInfos.length ? offHolidayInfos[0].name : "";
        let allNames = holidayInfos.map((h) => h.name).join(" / ");

        let matchedAnniversaries = this.anniversaryList.filter((item) => anniversaryHelper.occursOn(item, dateStr));

        let lunarText = "";
        let isTerm = false;
        if (this.showLunar) {
          let lunar = solar2lunar(cursor.year(), cursor.month() + 1, cursor.date());
          if (lunar && lunar !== -1) {
            if (lunar.isTerm) {
              lunarText = lunar.term;
              isTerm = true;
            } else if (lunar.dayCn === "初一") {
              lunarText = lunar.monthCn;
            } else {
              lunarText = lunar.dayCn;
            }
          }
        }

        result.push({
          dateStr,
          dayNum: cursor.date(),
          inMonth: cursor.month() === monthStart.month(),
          isToday: dateStr === todayStr,
          isPicked: !!this.pickedDate && dateStr === this.pickedDate,
          hasOffHoliday,
          hasWorkday,
          holidayName: firstHolidayName,
          holidayNamesFull: allNames,
          anniversaries: matchedAnniversaries,
          anniversaryNamesFull: matchedAnniversaries.map((a) => a.name).join(" / "),
          lunarText,
          isTerm,
        });

        cursor.add(1, "day");
      }
      return result;
    },
  },
};
</script>

<style scoped lang="scss">
.month-calendar {
  position: relative;
}

.month-calendar-toolbar {
  position: relative;

  .nav-icon {
    font-size: 1.1rem;
    padding: 6px 10px;
    border-radius: 6px;
    cursor: pointer;

    &:hover {
      background-color: #eaecef;

      .dark-theme & {
        background-color: #21262d;
      }
    }
  }

  .month-label {
    font-size: 1.05rem;
    font-weight: 600;
    margin: 0 8px;
    cursor: pointer;
    min-width: 120px;
    text-align: center;
    padding: 4px 8px;
    border-radius: 6px;

    &:hover {
      background-color: #f4f5f7;

      .dark-theme & {
        background-color: #1a1e24;
      }
    }
  }

  .today-btn {
    margin-left: auto;
    border: 1px solid #dcdfe4;
    border-radius: 6px;
    font-size: 0.8rem;

    .dark-theme & {
      border-color: #30363d;
      color: #c9d1d9;
    }
  }
}

.weekday-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  font-size: 0.78rem;
  color: #8a8f98;
  margin-bottom: 4px;

  .dark-theme & {
    color: #6b7078;
  }
}

.days-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  grid-auto-rows: 68px;
  gap: 2px;
}

.day-cell {
  position: relative;
  border-radius: 6px;
  padding: 6px 4px 4px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: background-color 0.15s ease-out;

  &:hover {
    background-color: #f4f5f7;

    .dark-theme & {
      background-color: #1a1e24;
    }
  }

  &.out-month {
    opacity: 0.32;
  }

  &.is-today .day-num {
    background-color: #4263eb;
    color: white;
    border-radius: 50%;
  }

  &.is-picked {
    box-shadow: inset 0 0 0 1.5px #4263eb;
    border-radius: 6px;
  }

  &.has-off-holiday .day-num {
    color: #d9363e;

    .dark-theme & {
      color: #ff7875;
    }
  }
}

.workday-badge {
  position: absolute;
  top: 3px;
  right: 4px;
  font-size: 0.55rem;
  color: #b8860b;
  background-color: #fbf3de;
  border-radius: 3px;
  padding: 0px 3px;

  .dark-theme & {
    color: #e0a95c;
    background-color: #2c2a20;
  }
}

.day-num {
  font-size: 0.9rem;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lunar-text {
  font-size: 0.62rem;
  color: #9a9fa6;
  margin-top: 1px;

  &.is-term {
    color: #d9363e;

    .dark-theme & {
      color: #ff7875;
    }
  }
}

.holiday-name {
  font-size: 0.6rem;
  color: #d9363e;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  .dark-theme & {
    color: #ff7875;
  }
}

.anniversary-dots {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-top: 2px;

  .dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    display: inline-block;
  }

  .dot-more {
    font-size: 0.55rem;
    color: #9aa0a8;
    margin-left: 1px;
  }
}
</style>
