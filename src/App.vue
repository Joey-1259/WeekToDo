<template>
  <input class="hidden-input-for-focus" type="text" />
  <div v-show="compatible" id="app-container" class="app-container" :class="{ 'dark-theme': darkTheme }">
    <div class="hidden-mobile app-shell d-flex">
      <side-bar
        :calendarHubActive="showCalendarHub"
        :upcomingBadgeCount="upcomingAnniversaryCount"
        @change-date="setSelectedDate"
        @open-calendar-hub="openCalendarHub"
      ></side-bar>

      <div v-show="!showCalendarHub" class="app-body flex-grow-1" :style="{ zoom: `${zoom}%` }">
        <splash-screen ref="splash"></splash-screen>

        <div class="home-week-view d-flex flex-column h-100">
          <div class="home-header d-flex align-items-center">
            <i class="bi-calendar-week home-header-icon"></i>
            <h5 class="home-header-title mb-0 ms-2">{{ $t("ui.weeklyEventsTitle") }}</h5>
          </div>

          <i
            class="bi-chevron-left week-side-arrow week-side-arrow-left"
            @click="weekMoveLeft"
            :title="$t('ui.previousWeek')"
          ></i>
          <i
            class="bi-chevron-right week-side-arrow week-side-arrow-right"
            @click="weekMoveRight"
            :title="$t('ui.nextWeek')"
          ></i>

          <!-- 第一排：周一 ~ 周四 -->
          <div class="week-grid-row">
            <to-do-list
              v-for="date in topRowDates"
              :key="date"
              :id="date"
              :pickedDate="pickedDate"
              :columnsOverride="4"
              @todo-list-mounted="todoListMounted"
            ></to-do-list>
          </div>

          <!-- 第二排：周五 ~ 周日 + 自定义列表 -->
          <div class="week-grid-row">
            <to-do-list
              v-for="date in bottomRowDates"
              :key="date"
              :id="date"
              :pickedDate="pickedDate"
              :columnsOverride="4"
              @todo-list-mounted="todoListMounted"
            ></to-do-list>
            <div v-if="homeCustomList" class="home-custom-list-slot flex-grow-1 position-relative">
              <!-- ★ 删除了原来的 home-custom-list-switcher div，切换器移到了 listHeader 内部 -->
              <to-do-list
                :key="homeCustomList.listId"
                :id="homeCustomList.listId"
                :customTodoList="true"
                :cTodoListIndex="homeCustomListIndex"
                :totalCustomLists="customListCount"
                :columnsOverride="4"
                @todo-list-mounted="todoListMounted"
                @reorderCustomList="resetCustomList"
                @addCustomList="onCustomListAdded"
                @cycleCustomList="cycleHomeCustomList"
              ></to-do-list>
              <!-- 归档操作栏 -->
              <div class="archive-action-bar">
                <span class="archive-link" @click="archiveCompletedTasks">
                  <i class="bi-archive"></i> {{ $t("ui.archive") }}
                </span>
                <span class="archive-separator">·</span>
                <span class="archive-link" @click="archiveHistoryVisible = true">
                  <i class="bi-clock-history"></i> {{ $t("ui.viewHistory") }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <calendar-hub-view
        v-if="showCalendarHub"
        class="flex-grow-1"
        @close="closeCalendarHub"
        @jump-to-date="jumpToDateFromHub"
      ></calendar-hub-view>
    </div>

    <remove-custom-list></remove-custom-list>
    <reorder-custom-lists-modal @resetCustomList="resetCustomList"></reorder-custom-lists-modal>
    <config-modal :configProp="$store.getters.config"></config-modal>
    <clear-data-modal></clear-data-modal>
    <clear-list-modal></clear-list-modal>
    <welcome-modal></welcome-modal>
    <to-do-modal :selectedTodo="selectedTodo"></to-do-modal>
    <active-to-do :activeTodo="activeTodo"> </active-to-do>
    <importing-modal :id="'importingModal'" :text="$t('settings.importing')"></importing-modal>
    <importing-modal :id="'exportingModal'" :text="$t('settings.exporting')"></importing-modal>
    <archive-history-modal
      :visible="archiveHistoryVisible"
      @close="archiveHistoryVisible = false"
    ></archive-history-modal>

    <div class="mobile d-flex flex-column justify-content-center align-items-center">
      <i class="bi-exclamation-diamond mb-4" style="font-size: 100px"></i>
      <h3 style="text-align: center">{{ $t("ui.mobileWarning") }}</h3>
    </div>

    <div class="position-fixed bottom-0 end-0 p-3" style="z-index: 1056">
      <toast-message
        id="versionChanges"
        :text="$t('ui.softwareUpdated')"
        :sub-text="$t('ui.seeChanges')"
        @subTextClick="seeChangeLog"
      ></toast-message>

      <toast-message
        id="newVersionAvailable"
        :text="$t('ui.newVersionAvailable')"
        :sub-text="$t('ui.download')"
        @subTextClick="downloadNewVersion"
      ></toast-message>

      <toast-message id="copiedAddress" :text="$t('donate.copiedAddres')"></toast-message>

      <toast-message id="archivedToast" :text="$t('ui.archiveSuccess')"></toast-message>
      <toast-message id="archiveNothingToast" :text="$t('ui.archiveNothingToArchive')"></toast-message>
    </div>
  </div>
  <div v-if="!compatible" class="compatible d-flex flex-column justify-content-center align-items-center p-5">
    <i class="bi-exclamation-diamond mb-4" style="font-size: 100px"></i>
    <h3 style="text-align: center">{{ $t("ui.compatible") }}</h3>
  </div>
</template>

<script>
import toDoList from "./components/toDoList";
import moment from "moment";
import sideBar from "./components/layout/sideBar";
import customToDoListIdsRepository from "./repositories/customToDoListIdsRepository";
import removeCustomList from "./components/comfirmModals/removeCustomList";
import configModal from "./views/configModal";
import splashScreen from "./components/splashScreen";
import configRepository from "./repositories/configRepository";
import welcomeModal from "./views/welcomeModal";
import toDoModal from "./views/toDoModal/toDoModal";
import { Modal, Toast } from "bootstrap";
import migrations from "./migrations/migrations";
import version_json from "./data/version.json";
import isElectron from "is-electron";
import taskHelper from "./helpers/tasksHelper";
import notifications from "./helpers/notifications";
import clearDataModal from "./components/comfirmModals/clearDataModal.vue";
import clearListModal from "./components/comfirmModals/clearListModal.vue";
import importingModal from "./views/importingModal.vue";
import repeatingEventRepository from "./repositories/repeatingEventRepository";
import toDoListRepository from "./repositories/toDoListRepository";
import toastMessage from "./components/toastMessage";
import activeToDo from "./components/activeToDo.vue";
import reorderCustomListsModal from "./views/ReorderCustomListsModal.vue";
import tasksHelper from "./helpers/tasksHelper";
import holidayHelper from "./helpers/holidayHelper";
import calendarHubView from "./views/calendarHub/CalendarHubView.vue";
import anniversaryRepository from "./repositories/anniversaryRepository";
import anniversaryHelper from "./helpers/anniversaryHelper";
import archiveRepository from "./repositories/archiveRepository";
import archiveHistoryModal from "./views/ArchiveHistoryModal.vue";

export default {
  name: "App",
  components: {
    configModal,
    toDoList,
    sideBar,
    removeCustomList,
    splashScreen,
    welcomeModal,
    toDoModal,
    clearDataModal,
    importingModal,
    clearListModal,
    toastMessage,
    activeToDo,
    reorderCustomListsModal,
    calendarHubView,
    archiveHistoryModal,
  },
  data() {
    return {
      selected_date: null,
      pickedDate: null,
      ipcRenderer: null,
      initialLoadCompleted: false,
      initialListToLoad: 0,
      initialListLoaded: 0,
      showCalendarHub: false,
      homeAnniversaryList: anniversaryRepository.load(),
      homeCustomListIndex: 0,
      archiveHistoryVisible: false,
    };
  },
  beforeCreate() {
    let config = configRepository.load();
    if (version_json.version != config.version) {
      migrations.migrate();
    }

    if (Notification.permission !== "denied") {
      Notification.requestPermission();
    }
    this.$store.commit("loadCustomTodoListsIds", customToDoListIdsRepository.load());
    this.$store.commit("loadConfig", configRepository.load());
    this.$i18n.locale = this.$store.getters.config.language;

    this.$store.dispatch("loadAllRepeatingEvent").then(
      function () {
        let totalDaysCount = 7;
        let totalCustomListCount = this.$store.getters.cTodoListIds.length;
        this.initialListToLoad = totalDaysCount + totalCustomListCount;
        this.deleteOldRepeatingEvents();
        this.selected_date = moment().startOf("isoWeek").format("YYYYMMDD");
        this.$store.commit("loadRepeatingEventDateCache", this.$store.getters.repeatingEventList);
      }.bind(this)
    );
  },
  created() {
    this.ensureDefaultCustomList();
  },
  mounted() {
    document.onreadystatechange = () => {
      if (document.readyState == "complete") {
        setTimeout(this.hideSplash, 4500);
      }
    };

    if (isElectron()) {
      const { ipcRenderer } = require("electron");
      this.ipcRenderer = ipcRenderer;
      if (this.$store.getters.config.firstTimeOpen) this.ipcRenderer.send("show-current-window");
      this.ipcRenderer.send("match-open-on-startup", this.$store.getters.config.openOnStartup);
    }

    if (this.$store.getters.config.importing) {
      this.$store.commit("updateConfig", { val: false, key: "importing" });
      configRepository.update(this.$store.getters.config);
      if (isElectron()) {
        this.syncElectronConfig();
      }
    }

    holidayHelper.checkForUpdate(this.$store.getters.config.holidayCountries || ["CN"]);

    this.resetAppOnDayChange();
  },
  methods: {
    cycleHomeCustomList: function (step) {
      let total = this.customListCount;
      if (total <= 1) return;
      this.homeCustomListIndex = (this.homeCustomListIndex + step + total) % total;
    },
    ensureDefaultCustomList: function () {
      if (!this.$store.getters.cTodoListIds || this.$store.getters.cTodoListIds.length === 0) {
        const customTodoListId = {
          listId: moment().format("YYYYMMDDTHHmmssS"),
          listName: this.$t("ui.defaultCustomListName"),
        };
        this.$store.commit("newCustomTodoList", customTodoListId);
        customToDoListIdsRepository.update(this.$store.getters.cTodoListIds);
        toDoListRepository.update(customTodoListId.listId, this.$store.getters.todoLists[customTodoListId.listId] || []);
      }
    },
    weekMoveLeft: function () {
      this.selected_date = moment(this.selected_date).subtract(7, "d").format("YYYYMMDD");
    },
    weekMoveRight: function () {
      this.selected_date = moment(this.selected_date).add(7, "d").format("YYYYMMDD");
    },
    deleteOldRepeatingEvents: function () {
      for (const event of Object.entries(this.$store.getters.repeatingEventList)) {
        if (moment(event[1].end_date).isBefore(moment())) {
          repeatingEventRepository.remove(event[0]);
          this.$store.commit("removeRepeatingEvent", event[0]);
        }
      }
    },
    setSelectedDate: function (payload) {
      this.showCalendarHub = false;

      let date, picked;
      if (typeof payload === "string") {
        date = payload;
        picked = false;
      } else {
        date = payload.date;
        picked = payload.picked;
      }

      this.selected_date = moment(date).startOf("isoWeek").format("YYYYMMDD");
      this.pickedDate = picked ? date : null;

      this.$nextTick(function () {
        let listEl = document.getElementById("list" + date);
        if (listEl) {
          let input = listEl.getElementsByClassName("new-todo-input")[0];
          if (input) input.focus();
        }
      });
    },
    resetCustomList: function () {
      // 占位
    },
    onCustomListAdded: function () {
      this.$nextTick(function () {
        this.homeCustomListIndex = this.$store.getters.cTodoListIds.length - 1;
      });
    },
    isElectron: function () {
      let isElectron = require("is-electron");
      return isElectron();
    },
    hideSplash: function () {
      if (this.isElectron()) {
        if (this.ipcRenderer.sendSync("is-windows-visible")) {
          this.$refs.splash.hideSplash();
        }
      } else {
        this.$refs.splash.hideSplash();
      }
      this.checksOnLoadApp();
      if (this.$store.getters.config.firstTimeOpen) {
        this.showWelcomeModal();
      }
    },
    showWelcomeModal: function () {
      let modal = new Modal(document.getElementById("welcomeModal"), {
        backdrop: "static",
      });
      modal.show();
      this.$store.commit("updateConfig", { val: false, key: "firstTimeOpen" });
      configRepository.update(this.$store.getters.config);
    },
    compatible: function () {
      return window.IndexedDB;
    },
    refreshTodayNotifications: function () {
      notifications.refreshDayNotifications(this, moment().format("YYYYMMDD"));
    },
    todoListMounted: function () {
      this.methodsAfterInitialLoad();
    },
    methodsAfterInitialLoad: function () {
      if (!this.initialLoadCompleted) {
        this.initialListLoaded++;
        if (this.initialListLoaded == this.initialListToLoad) {
          this.initialLoadCompleted = true;
          if (this.$store.getters.config.moveOldTasks) {
            this.moveOldTasksToToday().then(() => {
              this.refreshTodayNotifications();
              this.$store.commit("updateConfig", { val: moment().format("YYYYMMDD"), key: "lastDayOpened" });
              configRepository.update(this.$store.getters.config);
              if (isElectron()) this.showInitialNotification();
            });
          } else {
            this.refreshTodayNotifications();
            if (isElectron()) this.showInitialNotification();
            this.$store.commit("updateConfig", { val: moment().format("YYYYMMDD"), key: "lastDayOpened" });
            configRepository.update(this.$store.getters.config);
          }
        }
      }
    },
    showInitialNotification: function () {
      if (!(this.$store.getters.config.notificationOnStartup && !this.$store.getters.config.firstTimeOpen)) return;
      setTimeout(
        function () {
          new Notification("WeekToDo", {
            body: this.initialNotificationText(),
            icon: "/favicon.ico",
            silent: true,
          }).onclick = () => {
            this.ipcRenderer.send("show-current-window");
            setTimeout(() => {
              if (document.getElementById("splashScreen")) {
                document.getElementById("splashScreen").classList.add("hiddenSplashScreen");
              }
            }, 3000);
          };
          notifications.playNotificationSound(this.$store.getters.config.notificationSound);
        }.bind(this),
        2000
      );
    },
    initialNotificationText: function () {
      let yesterdayTasks = this.$store.getters.todoLists[moment().subtract(1, "d").format("YYYYMMDD")];
      let todayTasks = this.$store.getters.todoLists[moment().format("YYYYMMDD")];

      let yesterayPendingTasksCount = taskHelper.pendingTasksCount(yesterdayTasks);
      let todayPendingTasksCount = taskHelper.pendingTasksCount(todayTasks);

      if (yesterayPendingTasksCount == 0 && todayPendingTasksCount == 0) {
        return this.$t("notifications.noPendingTasksToday");
      } else if (yesterayPendingTasksCount == 0) {
        return this.$t("notifications.pendingTasksToday", [todayPendingTasksCount]);
      } else if (todayPendingTasksCount == 0) {
        return this.$t("notifications.pendingTasksYesterday", [yesterayPendingTasksCount]);
      } else {
        return this.$t("notifications.pendingTasksYesterdayAndToday", [yesterayPendingTasksCount, todayPendingTasksCount]);
      }
    },
    resetAppOnDayChange: function () {
      var x = new moment();
      var y = new moment().add(1, "d").startOf("date");
      var duration = moment.duration(y.diff(x)).asMilliseconds();

      setTimeout(
        function () {
          if (isElectron() && !this.ipcRenderer.sendSync("is-windows-visible")) {
            window.location.reload();
          }
          this.refreshTodayNotifications();
          this.resetAppOnDayChange();
        }.bind(this),
        duration
      );
    },
    moveOldTasksToToday: async function () {
      var promise = new Promise((resolve) => {
        var todayListId = moment().format("YYYYMMDD");
        let daysBefore = moment().diff(moment(this.$store.getters.config.lastDayOpened), "days");
        if (daysBefore == 0) daysBefore = 7;
        for (let i = 1; i <= daysBefore; i++) {
          let listId = moment().subtract(i, "d").format("YYYYMMDD");
          this.$store.dispatch("loadTodoLists", listId).then(() => {
            this.$store.commit("moveUndoneItems", { origenId: listId, destinyId: todayListId });
            toDoListRepository.update(listId, this.$store.getters.todoLists[listId]);
            if (this.$store.getters.config.autoReorderTasks) {
              toDoListRepository.update(
                todayListId,
                tasksHelper.reorderTasksList(this.$store.getters.todoLists[todayListId])
              );
            } else {
              toDoListRepository.update(todayListId, this.$store.getters.todoLists[todayListId]);
            }
            if (i == daysBefore) {
              resolve("done!");
            }
          });
        }
      });
      return promise;
    },
    checkVersion: function () {
      if (version_json.version != this.$store.getters.config.version) {
        this.$store.commit("updateConfig", { val: version_json.version, key: "version" });
        configRepository.update(this.$store.getters.config);
        var toast = new Toast(document.getElementById("versionChanges"));
        toast.show();
      }
    },
    checkForUpdates: function () {
      if (this.isElectron() && this.$store.getters.config.checkUpdates) {
        const axios = require("axios").default;
        axios
          .get("https://app.weektodo.me/version.json")
          .then((response) => this.showNewVersionToast(response))
          .catch((error) => console.log(error.message));
      }
    },
    checksOnLoadApp: function () {
      if (this.isElectron()) {
        require("electron").ipcRenderer.on("initial-checks", () => {
          this.checkVersion();
          this.checkForUpdates();
        });
      } else {
        this.checkVersion();
      }
    },
    showNewVersionToast: function (response) {
      if (response.data.version != version_json.version) {
        var toast = new Toast(document.getElementById("newVersionAvailable"));
        toast.show();
      }
    },
    downloadNewVersion: function () {
      let isElectron = require("is-electron");
      if (isElectron()) {
        require("electron").shell.openExternal("https://weektodo.me", "_blank");
      } else {
        window.open("https://weektodo.me", "_blank");
      }
    },
    seeChangeLog: function () {
      window.open("https://weektodo.me/changelog", "_blank");
    },
    syncElectronConfig: function () {
      const { ipcRenderer } = require("electron");
      ipcRenderer.send("set-tray-context-menu-label", { open: this.$t("ui.open"), quit: this.$t("ui.quit") });
      ipcRenderer.send("set-open-on-startup", this.$store.getters.config.openOnStartup);
      ipcRenderer.send("set-run-in-background", this.$store.getters.config.runInBackground);
      ipcRenderer.send("set-dark-tray-icon", this.$store.getters.config.darkTrayIcon);
    },
    openCalendarHub: function () {
      this.showCalendarHub = true;
    },
    closeCalendarHub: function () {
      this.showCalendarHub = false;
    },
    jumpToDateFromHub: function (dateStr) {
      this.showCalendarHub = false;
      this.$nextTick(function () {
        this.setSelectedDate({ date: dateStr, picked: true });
      });
    },
    archiveCompletedTasks: function () {
      if (!this.homeCustomList) return;
      let listId = this.homeCustomList.listId;
      let listName = this.homeCustomList.listName;
      let todoList = this.$store.getters.todoLists[listId];
      if (!todoList) return;

      let completedTasks = todoList.filter((t) => t.checked);
      if (!completedTasks.length) {
        let toast = new Toast(document.getElementById("archiveNothingToast"));
        toast.show();
        return;
      }

      archiveRepository.archive(listId, listName, completedTasks);

      let remaining = todoList.filter((t) => !t.checked);
      this.$store.commit("loadTodoLists", { todoListId: listId, todoList: remaining });
      toDoListRepository.update(listId, remaining);

      let toast = new Toast(document.getElementById("archivedToast"));
      toast.show();
    },
  },
  watch: {
    allVisibleDates: {
      immediate: true,
      handler: function (val) {
        this.$store.commit("updateSelectedDates", val);
      },
    },
    customListCount: function (val) {
      if (val === 0) {
        this.ensureDefaultCustomList();
        this.homeCustomListIndex = 0;
      } else if (this.homeCustomListIndex >= val) {
        this.homeCustomListIndex = 0;
      }
    },
  },
  computed: {
    weekStartDate: function () {
      let base = this.selected_date ? moment(this.selected_date) : moment();
      return base.startOf("isoWeek");
    },
    topRowDates: function () {
      let start = this.weekStartDate;
      return [0, 1, 2, 3].map((i) => start.clone().add(i, "d").format("YYYYMMDD"));
    },
    bottomRowDates: function () {
      let start = this.weekStartDate;
      return [4, 5, 6].map((i) => start.clone().add(i, "d").format("YYYYMMDD"));
    },
    allVisibleDates: function () {
      return this.topRowDates.concat(this.bottomRowDates);
    },
    homeCustomList: function () {
      let ids = this.$store.getters.cTodoListIds;
      if (!ids || !ids.length) return null;
      let safeIndex = this.homeCustomListIndex < ids.length ? this.homeCustomListIndex : 0;
      return ids[safeIndex];
    },
    customListCount: function () {
      let ids = this.$store.getters.cTodoListIds;
      return ids ? ids.length : 0;
    },
    zoom: function () {
      return this.$store.getters.config.zoom;
    },
    darkTheme: function () {
      return this.$store.getters.config.darkTheme;
    },
    selectedTodo: function () {
      if (this.$store.getters.actions.selectedTodo) {
        return this.$store.getters.actions.selectedTodo;
      }
      return null;
    },
    activeTodo: function () {
      if (this.$store.getters.activeTodo) {
        return this.$store.getters.activeTodo;
      }
      return null;
    },
    upcomingAnniversaryCount: function () {
      let list = anniversaryHelper.getUpcomingAnniversaries(this.homeAnniversaryList || [], 7);
      return list.length;
    },
  },
};
</script>

<style lang="scss">
@import "/src/assets/style/globalVars.scss";

body {
  line-height: unset !important;
}

.app-shell {
  height: 100%;

  > .side-bar {
    flex: 0 0 auto;
  }
}

.app-body {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.home-week-view {
  position: relative;
  padding: 0 46px 14px;
  overflow: hidden;
}

.home-header {
  flex: 0 0 auto;
  padding: 16px 0;
  margin-bottom: 14px;
}

.home-header-icon {
  font-size: 1.15rem;
  color: #4263eb;
}

.dark-theme .home-header-icon {
  color: #6c8fff;
}

.home-header-title {
  font-weight: 600;
}

.week-side-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  font-size: 1.3rem;
  padding: 10px 8px;
  border-radius: 8px;
  cursor: pointer;
  z-index: 3;
  color: #9aa0a8;
  transition: 0.4s cubic-bezier(0.2, 1, 0.1, 1);
}

.week-side-arrow:hover {
  background-color: #eaecef;
  color: #333;
}

.dark-theme .week-side-arrow:hover {
  background-color: #21262d;
  color: #dedede;
}

.week-side-arrow-left {
  left: 6px;
}

.week-side-arrow-right {
  right: 6px;
}

/* 两排等高固定 */
.week-grid-row {
  display: flex;
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;

  &:first-of-type {
    margin-bottom: 8px;
  }
}

.week-grid-row .to-do-list-container {
  overflow-y: auto;
  height: 100%;
}

.v3dp__popout {
  border-radius: 7px !important;
}

.dark-theme *::-webkit-scrollbar-thumb {
  background: #333940;
  border-radius: 5px;
}

.dark-theme *::-webkit-scrollbar-thumb:hover {
  background: #39484f;
}

.dark-theme *::-webkit-scrollbar-thumb:active {
  background: #51656f;
}

/*----------------Dark Theme------------------*/
.dark-theme {
  background-color: #13171d;
  color: #c9d1d9;
}

.dark-theme input {
  background-color: #13171d;
  color: #c9d1d9;
}

.dark-theme input.form-range {
  background-color: unset;
}

.mobile {
  width: 100%;
  height: 100%;
  z-index: 999;
  position: absolute;
  padding: 20%;
}

.dark-theme .mobile {
  background-color: #13171d;
}

.compatible {
  width: 100%;
  height: 100%;
  z-index: 999;
}

.hidden-input-for-focus {
  position: absolute;
  top: -100px;
}

.home-custom-list-slot {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* ★ 已删除 .home-custom-list-switcher 样式块，切换器移到了 listHeader 组件内部 */

/* 归档操作栏 */
.archive-action-bar {
  flex: 0 0 auto;
  text-align: center;
  padding: 5px 0 2px;
  font-size: 12px;
  color: #9aa0a8;
  user-select: none;
}

.archive-action-bar .archive-link {
  cursor: pointer;
  transition: color 0.2s;

  i {
    font-size: 11px;
    margin-right: 2px;
  }

  &:hover {
    color: #4263eb;
  }
}

.dark-theme .archive-action-bar .archive-link:hover {
  color: #6c8fff;
}

.archive-separator {
  margin: 0 8px;
  color: #ccc;
}

.dark-theme .archive-separator {
  color: #444;
}
</style>
