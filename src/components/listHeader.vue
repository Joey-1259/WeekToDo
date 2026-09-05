<template>
  <div class="weekly-to-do-header d-flex" :class="{ 'custom-header': customTodoList }">
    <i
      v-show="!editing"
      class="bi-info header-menu-icons align-self-center dropdown-toggle-split"
      style="visibility: hidden"
    ></i>

    <div style="flex-grow: 1" class="noselect">
      <div v-if="!customTodoList">
        <h4 :class="{ 'today-date': is_today, 'picked-date': is_picked }">
          {{ moments(id).locale(language).format("dddd") }}
        </h4>

        <span class="weekly-to-do-subheader">
          {{ moments(id).locale(language).format("LL") }}
        </span>

        <div
          class="calendar-marker-row"
          :class="{ 'has-calendar-markers': calendarMarkers.length }"
          :title="calendarMarkerTitle"
        >
          <span
            v-for="marker in visibleCalendarMarkers"
            :key="marker.key"
            class="calendar-marker"
            :class="{
              'holiday-marker': marker.type === 'holiday',
              'workday-marker': marker.type === 'workday',
              'anniversary-marker': marker.type === 'anniversary',
            }"
          >
            <i
              v-if="marker.type === 'anniversary'"
              class="anniversary-marker-dot"
              :style="{ backgroundColor: marker.color || '#748ffc' }"
            ></i>

            {{ marker.label }}
          </span>

          <span v-if="hiddenCalendarMarkerCount > 0" class="calendar-marker calendar-marker-more">
            +{{ hiddenCalendarMarkerCount }}
          </span>

          <span v-if="calendarMarkers.length === 0" class="calendar-marker-placeholder">
            &nbsp;
          </span>
        </div>
      </div>

      <div
        v-else
        class="custom-list-title d-flex flex-column align-items-center justify-content-center"
        draggable="true"
        @dragstart="startListDrag($event)"
        @dragover.prevent
        @dragenter.prevent="onListDragEnter"
        @dragleave="onListDragLeave"
        @drop="onListDrop($event)"
        :class="{ 'list-drag-hover': listDragHover }"
      >
        <h4 v-show="!editing" @dblclick="editToDoListName">
          {{ todo_list_name }}
        </h4>

        <input
          class="custom-todo-input"
          v-show="editing"
          type="text"
          v-model="name"
          ref="cTodoInput"
          @blur="doneEdit()"
          @keyup.enter="doneEdit()"
          @keyup.esc="cancelEdit()"
        />

        <span v-if="totalCustomLists > 1" class="weekly-to-do-subheader custom-list-pager">
          <i
            class="bi-chevron-left pager-arrow"
            @click.stop="$emit('cycleCustomList', -1)"
          ></i>

          {{ cTodoListIndex + 1 }}/{{ totalCustomLists }}

          <i
            class="bi-chevron-right pager-arrow"
            @click.stop="$emit('cycleCustomList', 1)"
          ></i>
        </span>

        <span v-else class="weekly-to-do-subheader">&nbsp;</span>

        <!-- 与日期列表的日历标识行保持等高 -->
        <div class="calendar-marker-row">
          <span class="calendar-marker-placeholder">&nbsp;</span>
        </div>
      </div>
    </div>

    <i
      v-show="!editing"
      class="bi-three-dots-vertical header-menu-icons dropdown-toggle-split align-self-center"
      type="button"
      data-bs-toggle="dropdown"
    ></i>

    <ul class="dropdown-menu" aria-labelledby="btnTaskOptionMenu">
      <li v-show="!customTodoList">
        <button class="dropdown-item" type="button" @click="newTask">
          <i class="bi-plus-lg"></i>
          <span>{{ $t("ui.newTask") }}</span>
        </button>
      </li>

      <li v-show="!allTodoChecked()">
        <button class="dropdown-item" type="button" @click="check_all_items">
          <i class="bi-check2-all"></i>
          <span>{{ $t("ui.completeAll") }}</span>
        </button>
      </li>

      <li v-show="!customTodoList">
        <button class="dropdown-item" type="button" @click="sortItems()">
          <i class="bi-sort-down"></i>
          <span>{{ $t("ui.reorder") }}</span>
        </button>
      </li>

      <li v-show="!customTodoList && !allTodoChecked()">
        <button class="dropdown-item" type="button" @click="moveUndoneItems">
          <i class="bi-reply-all"></i>
          <span>{{ $t("ui.postpone") }}</span>
        </button>
      </li>

      <li v-show="!customTodoList">
        <button class="dropdown-item" type="button" @click="copyListTasksToClipboard">
          <i class="bi-clipboard"></i>
          <span>{{ $t("ui.copyTasks") }}</span>
        </button>
      </li>

      <li v-show="customTodoList">
        <button class="dropdown-item" type="button" @click="addNewCustomList">
          <i class="bi-plus-circle"></i>
          <span>{{ $t("ui.newList") }}</span>
        </button>
      </li>

      <li>
        <hr class="dropdown-divider" />
      </li>

      <li>
        <button
          class="dropdown-item"
          type="button"
          @click="clearList"
          data-bs-toggle="modal"
          data-bs-target="#clearListModal"
        >
          <i class="bi-trash"></i>
          <span>{{ $t("ui.clearList") }}</span>
        </button>
      </li>

      <li v-show="customTodoList">
        <button
          class="dropdown-item"
          type="button"
          data-bs-dismiss="modal"
          @click="removeList"
          data-bs-toggle="modal"
          data-bs-target="#customListRemoveModal"
        >
          <i class="bi-x-circle"></i>
          <span>{{ $t("ui.removeList") }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>

<script>
import moment from "moment";
import toDoListRepository from "../repositories/toDoListRepository";
import customToDoListIdsRepository from "../repositories/customToDoListIdsRepository";
import anniversaryRepository from "../repositories/anniversaryRepository";
import notifications from "../helpers/notifications";
import tasksHelper from "../helpers/tasksHelper";
import holidayHelper from "../helpers/holidayHelper";
import anniversaryHelper from "../helpers/anniversaryHelper";
import { Toast, Modal } from "bootstrap";

const ANNIVERSARY_CHANGED_EVENT = "weektodo:anniversary-changed";

// 同一周的 7 个日期组件可能同时请求同一年份。
// 用模块级 Promise 做合并，避免同一时间重复请求相同数据。
const holidayYearLoadPromises = {};

function ensureHolidayYearLoaded(year, countryCodes) {
  let codes = countryCodes && countryCodes.length ? countryCodes.slice() : ["CN"];
  codes.sort();

  let key = `${year}:${codes.join(",")}`;

  if (!holidayYearLoadPromises[key]) {
    holidayYearLoadPromises[key] = holidayHelper
      .ensureYearLoaded(year, codes)
      .finally(() => {
        delete holidayYearLoadPromises[key];
      });
  }

  return holidayYearLoadPromises[key];
}

export default {
  components: {},

  props: {
    id: { required: false, type: String },
    customTodoList: { required: false, default: false, type: Boolean },
    cTodoListIndex: { required: false, type: Number },
    toDoList: { required: false, type: Array },
    pickedDate: { required: false, type: String, default: null },
    totalCustomLists: { required: false, type: Number, default: 1 },
  },

  emits: ["reorderCustomList", "addCustomList", "cycleCustomList"],

  data() {
    return {
      editing: false,
      name: "",
      listDragHover: false,

      // localStorage 不是响应式数据。
      // 每次节假日异步加载完成或纪念日发生变化时递增，
      // 让 calendarMarkers 重新计算。
      calendarDataRevision: 0,
    };
  },

  mounted() {
    if (this.customTodoList) {
      if (this.$store.getters.actions.cListCreated) {
        this.$store.commit("actionsCListCreatedUpdate", false);
        this.editing = true;

        this.$nextTick(function () {
          this.$refs.cTodoInput.focus();
          this.$refs.cTodoInput.select();
        });
      }
    }

    window.addEventListener(
      ANNIVERSARY_CHANGED_EVENT,
      this.onAnniversaryDataChanged
    );

    if (!this.customTodoList) {
      this.refreshHolidayData();
    }
  },

  beforeUnmount() {
    window.removeEventListener(
      ANNIVERSARY_CHANGED_EVENT,
      this.onAnniversaryDataChanged
    );
  },

  methods: {
    check_all_items: function () {
      this.$store.commit("checkAllItems", this.id);
      this.updateTodoList(
        this.id,
        this.$store.getters.todoLists[this.id]
      );
    },

    moveUndoneItems: function () {
      let towmorrow_id = this.moments(this.id)
        .add(1, "d")
        .format("YYYYMMDD");

      this.$store.commit("moveUndoneItems", {
        origenId: this.id,
        destinyId: towmorrow_id,
      });

      this.updateTodoList(
        this.id,
        this.$store.getters.todoLists[this.id]
      );

      if (this.$store.getters.config.autoReorderTasks) {
        this.updateTodoList(
          towmorrow_id,
          tasksHelper.reorderTasksList(
            this.$store.getters.todoLists[towmorrow_id]
          )
        );
      } else {
        this.updateTodoList(
          towmorrow_id,
          this.$store.getters.todoLists[towmorrow_id]
        );
      }
    },

    moments: function (date) {
      return moment(date, "YYYYMMDD");
    },

    updateTodoList: function (todoListId, TodoList) {
      notifications.refreshDayNotifications(this, todoListId);
      toDoListRepository.update(todoListId, TodoList);
    },

    allTodoChecked: function () {
      let allChecked = true;

      (this.toDoList || []).forEach(function (todo) {
        if (!todo.checked) {
          allChecked = false;
        }
      });

      return allChecked;
    },

    editToDoListName: function () {
      this.name =
        this.$store.getters.cTodoListIds[this.cTodoListIndex].listName;

      this.editing = true;

      this.$nextTick(function () {
        this.$refs.cTodoInput.focus();
        this.$refs.cTodoInput.select();
      });
    },

    doneEdit: function () {
      this.editing = false;

      this.$store.commit("updateCustomTodoList", {
        index: this.cTodoListIndex,
        name: this.name,
      });

      customToDoListIdsRepository.update(
        this.$store.getters.cTodoListIds
      );
    },

    cancelEdit: function () {
      this.name =
        this.$store.getters.cTodoListIds[this.cTodoListIndex].listName || "";

      this.editing = false;
    },

    removeList: function () {
      this.$store.commit("actionsCListToRmvUpdate", {
        id: this.id,
        index: this.cTodoListIndex,
        name: this.$store.getters.cTodoListIds[this.cTodoListIndex].listName,
      });
    },

    sortItems: function () {
      toDoListRepository.update(
        this.id,
        tasksHelper.reorderTasksList(this.toDoList)
      );
    },

    openReorderListsModal: function () {
      let modal = Modal.getOrCreateInstance(
        document.getElementById("ReorderCustomListsModal")
      );

      modal.show();
    },

    clearList: function () {
      this.$store.commit("setListToClear", this.id);
    },

    copyListTasksToClipboard: async function () {
      await navigator.clipboard.writeText(this.todoListToString());

      let toast = new Toast(
        document.getElementById("copiedTaskToClipboard")
      );

      toast.show();
    },

    todoListToString: function () {
      return (this.toDoList || [])
        .map((x) => {
          let task = `- ${x.text}`;
          if (x.time) task += ` [${x.time}]`;
          return task;
        })
        .join("\n");
    },

    newTask: function () {
      this.$nextTick(function () {
        document
          .getElementById("list" + this.id)
          .getElementsByClassName("new-todo-input")[0]
          .focus();
      });
    },

    addNewCustomList: function () {
      const newId = moment().format("YYYYMMDDTHHmmssS");

      const newListObj = {
        listId: newId,
        listName: this.$t("ui.defaultCustomListName"),
      };

      this.$store.commit("newCustomTodoList", newListObj);

      customToDoListIdsRepository.update(
        this.$store.getters.cTodoListIds
      );

      toDoListRepository.update(newId, []);
      this.$store.commit("actionsCListCreatedUpdate", true);
      this.$emit("addCustomList");
    },

    startListDrag: function (event) {
      event.dataTransfer.setData(
        "customListIndex",
        String(this.cTodoListIndex)
      );

      event.dataTransfer.effectAllowed = "move";
    },

    onListDragEnter: function () {
      this.listDragHover = true;
    },

    onListDragLeave: function () {
      this.listDragHover = false;
    },

    onListDrop: function (event) {
      this.listDragHover = false;

      let fromIndex = parseInt(
        event.dataTransfer.getData("customListIndex")
      );

      let toIndex = this.cTodoListIndex;

      if (isNaN(fromIndex) || fromIndex === toIndex) return;

      let customLists = this.$store.getters.cTodoListIds;
      let moved = customLists.splice(fromIndex, 1)[0];

      customLists.splice(toIndex, 0, moved);
      customToDoListIdsRepository.update(customLists);

      this.$emit("reorderCustomList");
    },

    refreshHolidayData: function () {
      if (this.customTodoList || !this.id) {
        return Promise.resolve();
      }

      let year = Number(
        moment(this.id, "YYYYMMDD").format("YYYY")
      );

      return ensureHolidayYearLoaded(
        year,
        this.selectedCountryCodes
      )
        .then(() => {
          this.calendarDataRevision += 1;
        })
        .catch((error) => {
          // 请求失败时保留当前缓存结果，不影响首页正常使用。
          console.warn(
            "[listHeader] 节假日数据加载失败：",
            error
          );
        });
    },

    onAnniversaryDataChanged: function () {
      this.calendarDataRevision += 1;
    },
  },

  watch: {
    id: function () {
      if (!this.customTodoList) {
        this.refreshHolidayData();
      }
    },

    selectedCountryCodes: {
      deep: true,
      handler: function () {
        if (!this.customTodoList) {
          this.refreshHolidayData();
        }
      },
    },
  },

  computed: {
    is_today: function () {
      return moment().format("YYYYMMDD") === this.id;
    },

    is_picked: function () {
      return (
        !this.customTodoList &&
        !!this.pickedDate &&
        this.pickedDate === this.id
      );
    },

    selectedCountryCodes: function () {
      let countries =
        this.$store.getters.config.holidayCountries;

      return countries && countries.length
        ? countries
        : ["CN"];
    },

    calendarMarkers: function () {
      // 显式访问修订号，让本计算属性在数据更新时重新计算。
      this.calendarDataRevision;

      if (this.customTodoList || !this.id) {
        return [];
      }

      let markers = [];

      let holidayInfos = holidayHelper.getDayInfoMulti(
        this.id,
        this.selectedCountryCodes
      );

      holidayInfos.forEach((info, index) => {
        if (info.isOffDay) {
          let label =
            this.selectedCountryCodes.length > 1
              ? `${info.countryCode} · ${info.name}`
              : info.name;

          markers.push({
            key: `holiday-${info.countryCode}-${index}-${info.name}`,
            type: "holiday",
            label,
            title: `${info.countryCode} · ${info.name}`,
          });
        } else {
          markers.push({
            key: `workday-${info.countryCode}-${index}-${info.name}`,
            type: "workday",
            label: "班",
            title: `${info.countryCode} · ${info.name}`,
          });
        }
      });

      let anniversaryList = anniversaryRepository.load();

      anniversaryList
        .filter((item) =>
          anniversaryHelper.occursOn(item, this.id)
        )
        .forEach((item, index) => {
          markers.push({
            key: `anniversary-${item.id || index}`,
            type: "anniversary",
            label: item.name,
            title: item.name,
            color: item.color || "#748ffc",
          });
        });

      return markers;
    },

    visibleCalendarMarkers: function () {
      // 首页空间有限，只展示前两个完整标识。
      return this.calendarMarkers.slice(0, 2);
    },

    hiddenCalendarMarkerCount: function () {
      return Math.max(
        this.calendarMarkers.length -
          this.visibleCalendarMarkers.length,
        0
      );
    },

    calendarMarkerTitle: function () {
      return this.calendarMarkers
        .map((marker) => marker.title || marker.label)
        .join(" / ");
    },

    todo_list_name: function () {
      let list =
        this.$store.getters.cTodoListIds[this.cTodoListIndex];

      return list ? list.listName : "";
    },

    language: function () {
      return this.$store.getters.config.language;
    },
  },
};
</script>

<style scoped lang="scss">
.weekly-to-do-header {
  text-align: center;
  margin-bottom: 14px;
  margin-top: 10px;
  display: flex;
  font-size: 0.8rem;
  align-items: center;
  justify-content: center;
}

.today-date,
.picked-date {
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-underline-offset: 4px;
}

.weekly-to-do-header h4 {
  margin-bottom: 4px;
  font-size: 21px;
  text-transform: capitalize;
  min-height: 25px;
}

.weekly-to-do-subheader {
  margin-top: 0;
  font-size: 12px;
  color: grey;
  display: inline-block;
  line-height: 16px;
  min-height: 16px;
}

/* 首页日期下方的节假日和纪念日标识 */
.calendar-marker-row {
  min-height: 19px;
  height: 19px;
  margin-top: 3px;
  padding: 0 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  overflow: hidden;
  white-space: nowrap;
}

.calendar-marker {
  display: inline-flex;
  align-items: center;
  max-width: 46%;
  height: 17px;
  padding: 0 5px;
  border-radius: 4px;
  font-size: 10px;
  line-height: 17px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.holiday-marker {
  color: #d9363e;
  background-color: rgba(217, 54, 62, 0.08);
}

.workday-marker {
  flex: 0 0 auto;
  color: #b8860b;
  background-color: rgba(184, 134, 11, 0.08);
}

.anniversary-marker {
  color: #5f6f8c;
  background-color: rgba(116, 143, 252, 0.1);
}

.anniversary-marker-dot {
  width: 5px;
  height: 5px;
  flex: 0 0 5px;
  border-radius: 50%;
  display: inline-block;
  margin-right: 4px;
}

.calendar-marker-more {
  flex: 0 0 auto;
  max-width: none;
  padding: 0 4px;
  color: #7d838c;
  background-color: #f1f3f5;
}

.calendar-marker-placeholder {
  display: inline-block;
  height: 17px;
  line-height: 17px;
}

.dark-theme .holiday-marker {
  color: #ff7875;
  background-color: rgba(255, 120, 117, 0.12);
}

.dark-theme .workday-marker {
  color: #e0a95c;
  background-color: rgba(224, 169, 92, 0.12);
}

.dark-theme .anniversary-marker {
  color: #aebcff;
  background-color: rgba(116, 143, 252, 0.14);
}

.dark-theme .calendar-marker-more {
  color: #9aa0a8;
  background-color: #21262d;
}

.weekly-to-do-header .header-menu-icons {
  color: grey;
  font-size: 20px;
  flex-grow: 0;
  align-self: start;
  cursor: pointer;
  visibility: hidden;
  opacity: 0;
  transition: 0.4s cubic-bezier(0.2, 1, 0.1, 1);
}

.dark-theme .weekly-to-do-header .header-menu-icons {
  color: #c9d1d9;
}

.weekly-to-do-header .header-menu-icons:hover {
  color: black;
}

.dark-theme .weekly-to-do-header .header-menu-icons:hover {
  color: white;
}

.custom-list-title {
  position: relative;
  cursor: grab;
  border-radius: 6px;
  padding: 2px 4px;
  transition: background-color 0.2s ease-out;
}

.custom-list-title:hover {
  background-color: #f7f8fa;
}

.dark-theme .custom-list-title:hover {
  background-color: #1a1e24;
}

.list-drag-hover {
  box-shadow: rgb(244, 243, 243) 0 0 4px 1px inset;
  background-color: rgb(250, 249, 249);
}

.dark-theme .list-drag-hover {
  box-shadow: #0b0d12 0 0 4px 1px inset;
  background-color: #0c0d14;
}

.custom-list-pager {
  user-select: none;
}

.pager-arrow {
  cursor: pointer;
  padding: 0 4px;
  border-radius: 4px;
  font-size: 10px;
  transition: background-color 0.2s;
  vertical-align: middle;
}

.pager-arrow:hover {
  background-color: #eaecef;
  color: #333;
}

.dark-theme .pager-arrow:hover {
  background-color: #21262d;
  color: #dedede;
}

.custom-todo-input {
  font-size: 1.25rem;
  width: 100%;
}

.custom-todo-input:focus {
  outline: black auto 1px;
}

.dark-theme .custom-todo-input:focus {
  color: white;
  outline: #13171d auto 1px;
}

.weekly-to-do-header:hover .header-menu-icons,
.header-menu-icons.show {
  visibility: visible;
  opacity: 1;
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
  padding: 0;
}

.bi-reply-all,
.bi-files {
  transform: scaleX(-1);
}
</style>
