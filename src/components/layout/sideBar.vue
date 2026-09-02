<template>
  <div class="side-bar">
    <!-- Logo：纯展示，不触发弹窗 -->
    <img
      class="logo"
      src="/img/logo-color.svg"
      width="42"
      height="42"
      alt="WeekTodo Logo"
    />
    <img
      class="logo logo-white"
      src="/img/logo-white.svg"
      width="42"
      height="42"
      alt="WeekTodo Logo"
    />

    <i class="bi-house" @click="setTodayDate" :title="$t('ui.today')"></i>
    <i
      class="bi-calendar-heart nav-icon-with-badge"
      :class="{ 'active-icon': calendarHubActive }"
      @click="$emit('openCalendarHub')"
      :title="$t('calendarHub.title')"
    >
      <span v-if="upcomingBadgeCount > 0" class="badge-dot">{{ upcomingBadgeCount > 9 ? '9+' : upcomingBadgeCount }}</span>
    </i>

    <span style="flex-grow: 1"></span>

    <!-- 底部只保留设置齿轮 -->
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

export default {
  name: "sideBar",
  props: {
    calendarHubActive: { type: Boolean, default: false },
    upcomingBadgeCount: { type: Number, default: 0 },
  },
  emits: ["changeDate", "openCalendarHub"],
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
    setTodayDate: function () {
      this.$emit("changeDate", { date: moment().format("YYYYMMDD"), picked: false });
    },
    openConfigModal: function () {
      document.getElementById("config-general-tab").click();
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
  flex: 0 0 auto;
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
  /* 不再有 cursor: pointer，纯展示 */
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
