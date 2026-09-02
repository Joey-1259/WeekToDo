<template>
  <div class="side-bar">
    <img
      class="logo"
      src="/img/logo-color.svg"
      width="42"
      height="42"
      alt="WeekTodo Logo"
      data-bs-toggle="modal"
      data-bs-target="#aboutModal"
      :title="$t('about.about')"
    />
    <img
      class="logo logo-white"
      src="/img/logo-white.svg"
      width="42"
      height="42"
      alt="WeekTodo Logo"
      data-bs-toggle="modal"
      data-bs-target="#aboutModal"
      :title="$t('about.about')"
    />
    <i v-if="showCalendar" class="bi-house" @click="setTodayDate" :title="$t('ui.today')"></i>
    <datepicker
      v-if="datepickerEnabled"
      id="side-bar-date-picker-input"
      v-model="pickedDate"
      :locale="language"
      :weekStartsOn="weekStartOnMonday"
      @opened="onCalendarOpened"
      @monthPageChanged="onCalendarPageChanged"
      @yearPageChanged="onCalendarPageChanged"
    />
    <i v-if="showCalendar" class="bi-calendar-event" @click="changeDate" :title="$t('ui.calendar')"> </i>
    <i
      class="bi-calendar-heart nav-icon-with-badge"
      :class="{ 'active-icon': calendarHubActive }"
      @click="$emit('openCalendarHub')"
      :title="$t('calendarHub.title')"
    >
      <span v-if="upcomingBadgeCount > 0" class="badge-dot">{{ upcomingBadgeCount > 9 ? '9+' : upcomingBadgeCount }}</span>
    </i>
    <span style="flex-grow: 1"></span>
    <div class="dropend d-flex justify-content-center sidebar-extra-menu">
      <i class="bi-three-dots sidebar-icon align-self-center" type="button" data-bs-toggle="dropdown"></i>
      <ul class="dropdown-menu mx-3" aria-labelledby="btnTaskOptionMenu">
        <li>
          <button class="dropdown-item" type="button" @click="print">
            <i class="bi-printer"></i> <span>{{ $t("ui.print") }} </span>
          </button>
        </li>
        <li>
          <hr class="dropdown-divider" />
        </li>
        <li>
          <a href="https://weektodo.me/support-us" target="_blank" class="dropdown-item" type="button">
            <i class="bi-gift"></i> <span>{{ $t("donate.supportUs") }}</span>
          </a>
        </li>
        <li>
          <button class="dropdown-item" type="button" data-bs-toggle="modal" data-bs-target="#aboutModal">
            <i class="bi-info-circle"></i> <span>{{ $t("about.about") }}</span>
          </button>
        </li>
      </ul>
    </div>

    <i class="bi-info-square" data-bs-toggle="modal" data-bs-target="#tipsModal" :title="$t('tips.tips')"></i>
    <i
      class="bi-gear"
      data-bs-toggle="modal"
      data-bs-target="#configModal"
      :title="$t('settings.settings')"
      @click="openConfigModal"
    ></i>
  </div>
</template>

<script>
import moment from "moment";
import Datepicker from "vue3-datepicker";
import languageHelper from "../../helpers/languageHelper.js";
import holidayHelper from "../../helpers/holidayHelper.js";

export default {
  name: "sideBar",
  props: {
    calendarHubActive: { type: Boolean, default: false },
    upcomingBadgeCount: { type: Number, default: 0 },
  },
  emits: ["changeDate", "openCalendarHub"],
  components: {
    Datepicker,
  },
  data() {
    return {
      pickedDate: new Date(),
      datepickerEnabled: false,
      calendarPageDate: new Date(),
    };
  },
  mounted() {
    window.addEventListener("beforeprint", () => {
      document.getElementById("app-container").classList.add("ready-to-print");
      if (JSON.parse(localStorage.getItem("config")).darkTheme)
        document.getElementById("app-container").classList.remove("dark-theme");
    });

    window.addEventListener("afterprint", () => {
      document.getElementById("app-container").classList.remove("ready-to-print");
      if (JSON.parse(localStorage.getItem("config")).darkTheme)
        document.getElementById("app-container").classList.add("dark-theme");
    });
  },
  methods: {
    changeDate: function () {
      this.datepickerEnabled = true;
      this.$nextTick(function () {
        document.getElementById("side-bar-date-picker-input").click();
        document.getElementById("side-bar-date-picker-input").focus();
        document.getElementById("side-bar-date-picker-input").addEventListener("focusout", this.resetDatePicker);
        document.getElementById("side-bar-date-picker-input").onkeydown = function (evt) {
          evt.keyCode == 27 && document.getElementById("side-bar-date-picker-input").blur();
        };
      });
    },
    setTodayDate: function () {
      this.$emit("changeDate", { date: moment().format("YYYYMMDD"), picked: false });
    },
    resetDatePicker: function () {
      document.getElementById("side-bar-date-picker-input").removeEventListener("focusout", this.resetDatePicker);
      this.datepickerEnabled = false;
    },
    openConfigModal: function () {
      document.getElementById("config-general-tab").click();
    },
    print: function () {
      window.print();
    },
    onCalendarOpened: function () {
      this.calendarPageDate = this.pickedDate || new Date();
      this.markHolidaysInCalendar();
    },
    onCalendarPageChanged: function (pageDate) {
      this.calendarPageDate = pageDate;
      this.markHolidaysInCalendar();
    },
    markHolidaysInCalendar: function () {
      this.$nextTick(() => {
        let container = document.querySelector(".side-bar .v3dp__popout-day .v3dp__elements");
        if (!container) return;
        let buttons = container.querySelectorAll("button");
        if (!buttons.length) return;

        let weekStartsOnValue = this.weekStartOnMonday ? 1 : 0;
        let monthStart = moment(this.calendarPageDate).startOf("month");
        let startDay = monthStart.day();
        let diff = (startDay - weekStartsOnValue + 7) % 7;
        let cursor = monthStart.clone().subtract(diff, "days");

        buttons.forEach((btn) => {
          let dateStr = cursor.format("YYYYMMDD");
          let info = holidayHelper.getDayInfo(dateStr);
          let span = btn.querySelector("span");
          if (span) {
            let existingDot = span.querySelector(".holiday-dot");
            if (existingDot) existingDot.remove();
          }
          btn.classList.remove("holiday-day", "workday-day");
          if (info && span) {
            btn.classList.add(info.isOffDay ? "holiday-day" : "workday-day");
            let dot = document.createElement("i");
            dot.className = "holiday-dot";
            dot.title = info.name;
            span.appendChild(dot);
          }
          cursor.add(1, "day");
        });
      });
    },
  },
  watch: {
    pickedDate: function (val) {
      if (this.datepickerEnabled) {
        document.getElementById("side-bar-date-picker-input").removeEventListener("focusout", this.resetDatePicker);
        this.datepickerEnabled = false;
        this.$emit("changeDate", { date: moment(val).format("YYYYMMDD"), picked: true });
        this.pickedDate = new Date();
      }
    },
  },
  computed: {
    showCustomList: function () {
      return this.$store.getters.config.customList;
    },
    showCalendar: function () {
      return this.$store.getters.config.calendar;
    },
    weekStartOnMonday: function () {
      return this.$store.getters.config.weekStartOnMonday ? 1 : 0;
    },
    language: function () {
      let lang = this.$store.getters.config.language;
      return languageHelper.getLanguagePack(lang);
    },
  },
};
</script>

<style scoped lang="scss">
.side-bar {
  width: 3.6rem;
  height: 100%;
  display: flex;
  flex-direction: column;
  float: left;
  background-color: #fcfcfc;
}

.side-bar > i:first-child {
  margin-bottom: 14px;
  margin-top: 8px;
}

.side-bar > i:first-child:hover {
  border-radius: unset;
  background-color: unset;
}

.side-bar > i,
.sidebar-icon {
  font-size: 1.25rem;
  padding: 10px;
  margin-bottom: 9px;
  align-self: center;
  cursor: pointer;
  transition: 0.4s cubic-bezier(0.2, 1, 0.1, 1);
}

.side-bar i:hover,
sidebar-icon:hover {
  border-radius: 6px;
  background-color: #eaecef;
  color: black;
}

.side-bar i:active,
sidebar-icon:active {
  background-color: #dddfe2;
}

.side-bar .active-icon {
  color: #4263eb;
  background-color: #eef1ff;
  border-radius: 6px;
}

.side-bar .logo {
  margin-bottom: 6px;
  margin-top: 10px;
  align-self: center;
  cursor: pointer;
}

.side-bar .logo-white {
  display: none;
}

.nav-icon-with-badge {
  position: relative;
}

.badge-dot {
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  border-radius: 7px;
  background: #f5222d;
  color: #fff;
  font-size: 9px;
  line-height: 14px;
  text-align: center;
  pointer-events: none;
}

.dark-theme {
  .side-bar .logo {
    display: none;
  }
  .side-bar .logo-white {
    display: block;
    opacity: 0.95;
  }
  .side-bar .active-icon {
    color: #6c8fff;
    background-color: #1c2333;
  }
}

.dropdown-menu {
  font-size: 0.865rem;
  min-width: unset;
  border-radius: 8px;
  box-shadow: 0 2px 10px 0 rgba(0, 0, 0, 0.2);
  border: none;
  color: #3c3c3c;

  .dropdown-item {
    padding: 0.4rem 1.9rem 0.4rem 0.65rem;
  }

  .dropdown-divider {
    margin: 0.3rem;
  }

  i {
    font-size: 0.99rem;
    margin-right: 11px;
    display: inline-block;
  }
}

.dropdown-toggle-split {
  padding: 0px;
}

.dark-theme .side-bar {
  background-color: #161b22;
  color: #ababab;
}

.dark-theme .side-bar i:hover {
  border-radius: 6px;
  background-color: #21262d;
  color: #dedede;
}

.dark-theme .side-bar i:active {
  background-color: #2e353d;
}
</style>
