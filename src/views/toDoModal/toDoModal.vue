<template>
  <div class="modal fade" :class="{ 'fullscreen': fullscreenToDoModal }" @keydown.esc="pressEsc" id="toDoModal"
    tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header d-flex">
          <div class="todo-list-selector">
            <div class="d-flex align-items-center">
              <div v-show="showingCalendar" class="align-items-center date-range-row">
                <div class="date-range-picker d-flex align-items-center">
                  <i class="bi-calendar-event date-range-icon"></i>
                  <input type="date" class="date-range-input" v-model="startDateStr" @change="onStartDateChange" />
                  <span class="date-range-separator">—</span>
                  <input type="date" class="date-range-input" v-model="endDateStr" @change="onEndDateChange" />
                </div>
              </div>
              <div v-show="!showingCalendar" class="align-items-center date-picker-btn">
                <div class="align-items-center date-picker-btn py-2" id="customListDropDown" data-bs-toggle="dropdown">
                  <i class="bi-view-list mx-2"></i>
                  <div id="todo-list-select">{{ pickedCListName }}</div>
                </div>
                <ul class="dropdown-menu" aria-labelledby="customListDropDown">
                  <li v-for="option in cListOptions" :key="option.listId" :value="option.listId">
                    <button class="dropdown-item" type="button" @click="pickedCList = option.listId">
                      <i class="bi-check2" :style="{ visibility: option.listId == pickedCList ? 'visible' : 'hidden' }"></i>
                      <span>{{ option.listName }}</span>
                    </button>
                  </li>
                </ul>
              </div>
              <div v-if="showCL && showCal" class="d-flex align-items-center">
                <div class="selector-divider"></div>
                <i id="btnGroupDrop1" class="bi-chevron-down p-2" type="button" data-bs-toggle="dropdown"></i>
                <ul class="dropdown-menu" aria-labelledby="btnGroupDrop1">
                  <li>
                    <button class="dropdown-item" type="button" @click="showingCalendar = true">
                      <i class="bi-calendar-check"></i>
                      <span>{{ $t("settings.calendar") }}</span>
                    </button>
                  </li>
                  <li>
                    <button class="dropdown-item" type="button" @click="showingCalendar = false">
                      <i class="bi-view-list"></i>
                      <span>{{ $t("settings.customLists") }}</span>
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div class="d-flex ms-auto align-items-center">
            <i id="btnTaskOptionMenu" class="bi-three-dots-vertical header-menu-icons" type="button"
              data-bs-toggle="dropdown" :title="$t('todoDetails.actions')"></i>
            <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="btnTaskOptionMenu">
              <li>
                <button class="dropdown-item" type="button" @click="copyTodo">
                  <i class="bi-clipboard"></i> <span>{{ $t("donate.copy") }}</span>
                </button>
              </li>
              <li>
                <button class="dropdown-item" type="button" @click="duplicateTodo" data-bs-dismiss="modal">
                  <i class="bi-back"></i> <span>{{ $t("todoDetails.duplicate") }}</span>
                </button>
              </li>
              <li><hr class="dropdown-divider" /></li>
              <li>
                <button class="dropdown-item" type="button" @click="removeTodo" data-bs-dismiss="modal">
                  <i class="bi-trash"></i> <span>{{ $t("ui.remove") }}</span>
                </button>
              </li>
              <li v-if="todo.repeatingEvent">
                <button class="dropdown-item" type="button" @click="removeAll" data-bs-dismiss="modal">
                  <i class="bi-trash"></i> <span>{{ $t("ui.removeAll") }}</span>
                </button>
              </li>
            </ul>
            <div class="header-divider"></div>
            <i class="bi-x close-modal header-menu-icons" ref="closeModal" data-bs-dismiss="modal"
              :title="$t('todoDetails.close')"></i>
          </div>
        </div>
        <div class="modal-body">
          <div class="modal-content-inner">
            <div class="form-check">
              <input class="form-check-input" type="checkbox" value="" id="todo-header" v-model="todo.checked"
                @change="checkTodoClickhandler(false)" />
              <div class="title-container">
                <label v-show="!editingTitle" class="form-check-label todo-title" for="todo-header"
                  :class="{ 'completed-task': todo.checked }" @dblclick="editTitle">
                  <span v-html="todoText"></span>
                </label>
                <label v-show="!editingTitle && todo.text == ''" class="form-check-label todo-title todo-title-empty-title"
                  for="todo-header" @dblclick="editTitle">
                  {{ $t("todoDetails.taskTitle") }}
                </label>
                <input v-show="editingTitle" class="todo-title-input" type="text" v-model="todo.text" ref="titleInput"
                  :placeholder="$t('todoDetails.taskTitle')" @blur="doneEditTitle()" @keyup.enter="doneEditTitle()" />
                <description-text-area :todoDesc="todo.desc"
                  @updated-description="changeDescription"></description-text-area>
                <div class="attribute-toolbar mt-2">
                  <tag-picker :model-value="todo.tags || []" :all-tags="allTags"
                    @update:modelValue="changeTags"></tag-picker>
                  <div class="attribute-tools">
                    <time-picker :time="todo.time" @time-selected="changeTime"></time-picker>
                    <reminder-picker :model-value="todo.reminders || []" @update:modelValue="changeReminders"></reminder-picker>
                    <repeating-event v-if="showingCalendar" :repeatingEvent="todo.repeatingEvent" :todo="todo"
                      @repeatingEventSelected="changeRepeatingEvent"></repeating-event>
                    <color-picker :color="todo.color" @color-selected="changeColor"></color-picker>
                  </div>
                </div>
              </div>
            </div>
            <div class="section-divider"></div>
            <div class="section-label">
              <i class="bi-list-check"></i>
              <span>{{ $t("todoDetails.subtasks") }}</span>
            </div>
            <ul class="sub-tasks">
              <li v-for="(subTask, index) in todo.subTaskList" :key="index" class="sub-task">
                <div v-show="!subTask.editing" draggable="true" @dragstart="startDrag($event, index)" @dragover.prevent>
                  <div class="d-flex flex-row align-items-center" :class="{ checked: subTask.checked }">
                    <input class="form-check-input flex-grow-1 mx-3 mt-0" type="checkbox" v-model="subTask.checked"
                      :id="'sub-task-' + index" @change="changeSubTaskClickhandler(index)" />
                    <label class="form-check-label" :for="'sub-task-' + index" @dragenter.self="onDragenter($event)"
                      @dragleave.self="onDragleave($event)" @drop="onDrop($event, index)" @dragover.prevent>
                      <span v-html="linkifyText(subTask.text)"></span>
                    </label>
                    <i class="bi-trash mx-2" :title="$t('ui.remove')" @click="removeSubTask(index)"></i>
                  </div>
                </div>
                <input v-show="subTask.editing" v-model="subTask.text" @blur="doneEditSubTask(index)"
                  @keyup.enter="doneEditSubTask(index)" :ref="'subTaskEdit' + index" class="edit-sub-task" />
              </li>
              <div class="new-sub-task d-flex align-items-center">
                <label for="new-sub-task"><i class="bi-plus-square mx-3"></i></label>
                <input type="text" id="new-sub-task" :placeholder="$t('todoDetails.addSubTask')" autocomplete="off"
                  @blur="addSubTask()" @keyup.enter="addSubTask()" v-model="newSubTask.text" ref="newSubTask" />
              </div>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="position-fixed bottom-0 end-0 p-3" style="z-index: 1056">
    <toast-message id="copiedTaskToClipboard" :text="$t('todoDetails.copiedTaskToClipboard')"></toast-message>
    <toast-message id="taskRemoved" :text="$t('todoDetails.taskRemoved')" :sub-text="'(' + $t('ui.undo') + ')'"
      @subTextClick="undoRemoveTask"></toast-message>
    <toast-message id="recurrentTaskRemoved" :text="$t('todoDetails.recurrentTaskRemoved')"></toast-message>
    <toast-message id="taskDuplicated" :text="$t('todoDetails.taskDuplicated')"></toast-message>
  </div>

  <comfirm-modal :id="'removeReModalToDoDetails'" :title="$t('ui.removeRepeatingTask')"
    :text="$t('ui.repeatingTaskRemoveConfirm')" :ico="'bi-x-circle'" :okText="$t('ui.remove')" @on-ok="removeAllComfirmed"
    @on-cancel="removeAllCanceled"></comfirm-modal>
</template>

<script>
import toDoListRepository from "../../repositories/toDoListRepository";
import moment from "moment";
import dbRepository from "../../repositories/dbRepository";
import { Toast, Modal } from "bootstrap";
import toastMessage from "../../components/toastMessage";
import colorPicker from "./colorPicker";
import timePicker from "./timePicker";
import repeatingEvent from "./repeatingEvent";
import notifications from "../../helpers/notifications";
import repeatingEventHelper from "../../helpers/repeatingEvents.js";
import languageHelper from "../../helpers/languageHelper.js";
import repeatingEventRepository from "../../repositories/repeatingEventRepository";
import comfirmModal from "../../components/comfirmModal.vue";
import linkifyStr from "linkify-string";
import ClickHandler from "@manuelernestog/click-handler";
import tasksHelper from "../../helpers/tasksHelper";
import descriptionTextArea from "./descriptionTextArea.vue";
import tagPicker from "./tagPicker.vue";
import reminderPicker from "./reminderPicker.vue";
import defaultTaskTags from "../../data/defaultTaskTags.js";
import {
  isSpanningTask,
  syncSpanningState,
  syncSpanningChecked,
  clearMirrorsBySpanId,
  createMirrorsForTask,
  ensureSpanId,
  generateSpanId,
} from "../../helpers/spanSyncHelper";

export default {
  name: "toDoModal",
  data() {
    return {
      startDateStr: "",
      endDateStr: "",
      pickedCList: "",
      pickedCListName: "",
      cListOptions: [],
      todo: {
        text: "",
        checked: false,
        desc: "",
        subTaskList: [],
        alarm: false,
        reminders: [],
        tags: [],
      },
      todoList: null,
      index: 0,
      newSubTask: { text: "", checked: false, editing: false },
      tempTitle: "",
      tempSubTask: "",
      editingTitle: false,
      showingCalendar: true,
      loadingView: false,
      options: { target: "_blank", defaultProtocol: "https" },
      clickhandler: new ClickHandler(),
      // 记录上一次的 spanId 和 endDate，用于日期区间变更时清理旧镜像
      prevSpanId: null,
      prevEndDate: null,
      prevSourceListId: null,
    };
  },
  props: {
    selectedTodo: { required: true, type: Object },
  },
  components: {
    colorPicker, toastMessage, timePicker, repeatingEvent,
    comfirmModal, descriptionTextArea, tagPicker, reminderPicker,
  },
  methods: {
    // ============ 日期区间处理 ============
    onStartDateChange: function () {
      if (this.loadingView) return;
      let newStart = moment(this.startDateStr, "YYYY-MM-DD", true);
      if (!newStart.isValid()) return;

      let newListId = newStart.format("YYYYMMDD");

      if (this.endDateStr && moment(this.endDateStr).isBefore(newStart, "day")) {
        this.endDateStr = this.startDateStr;
      }

      this.syncEndDateToTodo();

      if (newListId !== this.todo.listId) {
        this.moveToTodoList(newListId);
      }
    },
    onEndDateChange: function () {
      if (this.loadingView) return;
      let end = moment(this.endDateStr, "YYYY-MM-DD", true);
      let start = moment(this.startDateStr, "YYYY-MM-DD", true);
      if (!end.isValid()) return;

      if (end.isBefore(start, "day")) {
        this.endDateStr = this.startDateStr;
      }

      this.syncEndDateToTodo();
    },
    syncEndDateToTodo: function () {
      let start = moment(this.startDateStr, "YYYY-MM-DD", true);
      let end = moment(this.endDateStr, "YYYY-MM-DD", true);
      if (!start.isValid() || !end.isValid()) return;

      // ★ 先清除基于旧 _spanId 和旧 endDate 的镜像
      if (this.prevSpanId && this.prevEndDate) {
        clearMirrorsBySpanId(this.prevSpanId, this.prevSourceListId || this.todo.listId, this.prevEndDate, this.$store);
      }

      if (end.isSame(start, "day")) {
        // 单日任务
        this.todo.endDate = null;
        this.todo._spanId = undefined;
      } else {
        this.todo.endDate = end.format("YYYYMMDD");
        // 确保有 _spanId
        if (!this.todo._spanId) {
          this.todo._spanId = generateSpanId();
        }
      }

      this.updateTodoNoSync();

      // 创建新镜像
      if (this.todo.endDate && this.todo._spanId) {
        createMirrorsForTask(this.todo, this.$store);
      }

      // 更新 prev 记录
      this.prevSpanId = this.todo._spanId || null;
      this.prevEndDate = this.todo.endDate || null;
      this.prevSourceListId = this.todo.listId;
    },

    // ============ 更新方法 ============
    updateTodoNoSync: function (resetRepeatinEvent = true) {
      // 只保存当前列表，不触发跨天同步（避免循环）
      if (resetRepeatinEvent) {
        this.todo.repeatingEvent = null;
      }
      this.updateTodoList(this.todo.listId, this.todoList);
    },
    updateTodo: function (resetRepeatinEvent = true) {
      if (resetRepeatinEvent) {
        this.todo.repeatingEvent = null;
      }
      this.updateTodoList(this.todo.listId, this.todoList);

      // ★ 跨天任务：同步所有字段到镜像
      if (isSpanningTask(this.todo)) {
        syncSpanningState(this.todo, this.$store);
      }
    },
    updateTodoWithReorder: function (resetRepeatinEvent = true) {
      if (resetRepeatinEvent) {
        this.todo.repeatingEvent = null;
      }
      if (this.$store.getters.config.autoReorderTasks) {
        this.updateTodoList(this.todo.listId, tasksHelper.reorderTasksList(this.todoList));
      } else {
        this.updateTodoList(this.todo.listId, this.todoList);
      }

      if (isSpanningTask(this.todo)) {
        syncSpanningState(this.todo, this.$store);
      }
    },
    updateTodoList: function (todoListId, TodoList) {
      notifications.refreshDayNotifications(this, todoListId);
      toDoListRepository.update(todoListId, TodoList);
    },

    // ============ 原有方法 ============
    removeSubTask: function (index) {
      this.todo.subTaskList.splice(index, 1);
      this.updateTodo();
    },
    addSubTask: function () {
      if (this.newSubTask.text != "") {
        this.todo.subTaskList.push({
          text: this.newSubTask.text,
          checked: false,
          editing: false,
        });
        this.newSubTask.text = "";
      }
      this.updateTodo();
    },
    cancelAddSubTask: function () {
      this.newSubTask.text = "";
      this.$refs["newSubTask"].blur();
    },
    editSubTask: function (index) {
      this.todo.subTaskList[index].editing = true;
      this.$nextTick(function () {
        this.$refs["subTaskEdit" + index][0].focus();
        this.$refs["subTaskEdit" + index][0].select();
        this.tempSubTask = this.todo.subTaskList[index].text;
      });
    },
    doneEditSubTask: function (index) {
      this.todo.subTaskList[index].editing = false;
      this.updateTodo();
    },
    cancelEditSubTask: function (index) {
      this.todo.subTaskList[index].text = this.tempSubTask;
      this.$refs["subTaskEdit" + index].blur();
    },
    editTitle: function () {
      this.editingTitle = true;
      this.$nextTick(function () {
        this.tempTitle = this.todo.text;
        this.$refs["titleInput"].focus();
        this.$refs["titleInput"].select();
      });
    },
    cancelEditTitle: function () {
      this.todo.text = this.tempTitle;
      this.$refs["titleInput"].blur();
    },
    doneEditTitle: function () {
      this.editingTitle = false;
      this.updateTodo();
    },
    startDrag: function (event, index) {
      event.dataTransfer.setData("index", index);
    },
    onDragenter: function (event) {
      event.target.parentElement.classList.add("drag-hover");
    },
    onDragleave: function (event) {
      event.target.parentElement.classList.remove("drag-hover");
    },
    onDrop: function (event, to_index) {
      let from_index = event.dataTransfer.getData("index");
      let sub_task = this.todo.subTaskList.splice(parseInt(from_index), 1)[0];
      this.todo.subTaskList.splice(to_index, 0, sub_task);
      event.target.parentElement.classList.remove("drag-hover");
      this.updateTodo();
    },
    checkTodoClickhandler: function (resetRepeatinEvent = true) {
      this.clickhandler.handle(
        function () { this.checkTodo(resetRepeatinEvent); }.bind(this),
        function () {}
      );
    },
    checkTodo: function (resetRepeatinEvent = true) {
      if (isSpanningTask(this.todo)) {
        syncSpanningChecked(this.todo, this.$store);
      }

      if (this.todo.checked) {
        if (this.$store.getters.config.moveCompletedTaskToBottom) {
          this.$store.commit("moveTodoToEnd", { toDoListId: this.todo.listId, index: this.index });
        }
        this.index = this.todoList.length - 1;
      }
      this.updateTodoWithReorder(resetRepeatinEvent);
    },
    getCListOptions: function () {
      this.cListOptions = this.$store.getters.cTodoListIds;
    },
    moveToTodoList: function (newListID) {
      if (newListID == "Invalid date" || newListID == "") return;

      if (moment(newListID, "YYYYMMDD", true).isValid()) {
        this.pickedCListName = "";
        this.pickedCList = "";
      } else {
        this.cListOptions.forEach((x) => {
          if (x.listId == this.pickedCList) {
            this.pickedCListName = x.listName;
          }
        });
      }

      // ★ 清除旧镜像（基于旧 _spanId）
      if (this.todo._spanId && this.todo.endDate) {
        let oldSourceId = this.todo._isSpanMirror ? this.todo._spanSourceId : this.todo.listId;
        clearMirrorsBySpanId(this.todo._spanId, oldSourceId, this.todo.endDate, this.$store);
      }

      let oldListId = this.todo.listId;
      this.todoList.splice(this.index, 1);
      this.updateTodoList(oldListId, this.todoList);
      this.todo.listId = newListID;
      this.todo.repeatingEvent = null;

      // 如果是镜像被移动了，清除镜像标记变成独立任务
      if (this.todo._isSpanMirror) {
        delete this.todo._isSpanMirror;
        delete this.todo._spanSourceId;
      }

      if (this.$store.getters.todoLists[newListID]) {
        this.$store.commit("addTodo", this.todo);
        this.todoList = this.$store.getters.todoLists[this.todo.listId];
        this.index = this.todoList.length - 1;
        this.todo = this.todoList[this.index];

        if (this.$store.getters.config.autoReorderTasks) {
          this.updateTodoList(newListID, tasksHelper.reorderTasksList(this.todoList));
        } else {
          this.updateTodoList(newListID, this.todoList);
        }
      } else {
        this.loadToDoFormDB(newListID);
      }

      // ★ 重新创建镜像
      this.$nextTick(() => {
        if (this.todo.endDate && this.todo._spanId) {
          // 更新 _spanSourceId for mirrors
          createMirrorsForTask(this.todo, this.$store);
        }
        this.prevSpanId = this.todo._spanId || null;
        this.prevEndDate = this.todo.endDate || null;
        this.prevSourceListId = this.todo.listId;
      });
    },
    loadToDoFormDB: function (newListID) {
      let db_req = dbRepository.open();
      var instancePointer = this;
      db_req.onsuccess = function (event) {
        let db = event.target.result;
        var get_req = dbRepository.get(db, "todo_lists", newListID);
        get_req.onsuccess = function (event) {
          let newTodoList = event.target.result ? event.target.result : [];
          newTodoList.push(instancePointer.todo);
          instancePointer.todoList = newTodoList;
          instancePointer.index = newTodoList.length - 1;
          this.updateTodoList(newListID, instancePointer.todoList);
        }.bind(this);
      }.bind(this);
    },
    removeTodo: function () {
      // ★ 清除所有关联镜像
      if (this.todo._spanId && this.todo.endDate) {
        let sourceId = this.todo._isSpanMirror ? this.todo._spanSourceId : this.todo.listId;
        clearMirrorsBySpanId(this.todo._spanId, sourceId, this.todo.endDate, this.$store);
        // 如果删除的是镜像，同时删除源
        if (this.todo._isSpanMirror && this.todo._spanSourceId) {
          let sourceList = this.$store.getters.todoLists[this.todo._spanSourceId];
          if (sourceList) {
            let idx = sourceList.findIndex((t) => !t._isSpanMirror && t._spanId === this.todo._spanId);
            if (idx !== -1) {
              sourceList.splice(idx, 1);
              toDoListRepository.update(this.todo._spanSourceId, sourceList);
            }
          }
        }
      }
      this.$store.commit("setUndoElement", { type: "task", todo: this.todo, index: this.index });
      this.$store.commit("removeTodo", { toDoListId: this.todo.listId, index: this.index });
      this.updateTodoList(this.todo.listId, this.$store.getters.todoLists[this.todo.listId]);
      let toast = new Toast(document.getElementById("taskRemoved"));
      toast.show();
    },
    undoRemoveTask: function () {
      let obj = this.$store.getters.undoElement;
      this.$store.commit("insertTodo", { toDoListId: obj.todo.listId, index: obj.index, toDo: obj.todo });
      this.updateTodoList(obj.todo.listId, this.$store.getters.todoLists[obj.todo.listId]);
      this.$nextTick(() => {
        if (obj.todo.endDate && obj.todo._spanId) {
          createMirrorsForTask(obj.todo, this.$store);
        }
      });
      let toast = new Toast(document.getElementById("taskRemoved"));
      toast.hide();
    },
    removeAll: function () {
      let modal = new Modal(document.getElementById("removeReModalToDoDetails"), { backdrop: "static" });
      modal.show();
    },
    removeAllComfirmed() {
      repeatingEventRepository.remove(this.todo.repeatingEvent);
      this.$store.commit("removeRepeatingEvent", this.todo.repeatingEvent);
      this.$store.getters.selectedDates.forEach((date) => {
        repeatingEventHelper.removeGeneratedRepeatingEvents(date, this);
      });
      this.$store.commit("resetRepeatingEventDateCache");
      this.$store.commit("loadRepeatingEventDateCache", this.$store.getters.repeatingEventList);
      let toast = new Toast(document.getElementById("recurrentTaskRemoved"));
      toast.show();
    },
    removeAllCanceled() {
      let modal = new Modal(document.getElementById("toDoModal"));
      modal.show();
    },
    duplicateTodo: function () {
      var newTodo = {
        text: this.todo.text,
        checked: this.todo.checked,
        listId: this.todo.listId,
        desc: this.todo.desc,
        subTaskList: JSON.parse(JSON.stringify(this.todo.subTaskList)),
        color: this.todo.color,
        priority: 0,
        tags: this.todo.tags ? [...this.todo.tags] : [],
        time: this.todo.time,
        alarm: this.todo.alarm,
        reminders: this.todo.reminders ? [...this.todo.reminders] : [],
        repeatingEvent: null,
        // ★ 复制时生成新的 _spanId，独立于源
        endDate: this.todo.endDate || null,
        _spanId: this.todo.endDate ? generateSpanId() : undefined,
      };
      this.$store.commit("addTodo", newTodo);

      if (this.$store.getters.config.autoReorderTasks) {
        this.updateTodoList(this.todo.listId, tasksHelper.reorderTasksList(this.$store.getters.todoLists[this.todo.listId]));
      } else {
        this.updateTodoList(this.todo.listId, this.$store.getters.todoLists[this.todo.listId]);
      }

      // ★ 复制的跨天任务也需要创建镜像
      if (newTodo.endDate && newTodo._spanId) {
        this.$nextTick(() => {
          createMirrorsForTask(newTodo, this.$store);
        });
      }

      let toast = new Toast(document.getElementById("taskDuplicated"));
      toast.show();
    },
    async copyTodo() {
      await navigator.clipboard.writeText(this.todoToString());
      let toast = new Toast(document.getElementById("copiedTaskToClipboard"));
      toast.show();
    },
    todoToString() {
      var text = "";
      text += this.todo.text;
      if (this.todo.desc != "") {
        text += "\n\n" + this.$t("todoDetails.notes") + ":\n\n" + this.todo.desc;
      }
      if (this.todo.subTaskList.length > 0) {
        text += "\n\n" + this.$t("todoDetails.subtasks") + ":\n\n";
        this.todo.subTaskList.forEach(function (task) {
          text += "- " + task.text + "\n";
        });
      }
      return text;
    },
    changeColor(color) { this.todo.color = color; this.updateTodo(); },
    changeTime(time) {
      this.todo.time = time;
      if (!time) { this.todo.alarm = false; this.todo.reminders = []; }
      this.updateTodoWithReorder();
    },
    changeReminders(reminders) {
      this.todo.reminders = reminders;
      this.todo.alarm = reminders.length > 0;
      this.updateTodo();
    },
    changeTags(tags) { this.todo.tags = tags; this.updateTodo(); },
    changeDescription(desc) { this.todo.desc = desc; this.updateTodo(); },
    changeRepeatingEvent(repeatingEvent) {
      this.todo.repeatingEvent = repeatingEvent;
      this.updateTodo(false);
    },
    changeSubTaskClickhandler: function (index) {
      this.clickhandler.handle(
        function () { this.changeSubTask(index); }.bind(this),
        function () { this.editSubTask(index); }.bind(this),
        index
      );
    },
    changeSubTask: function (index) {
      if (this.todo.subTaskList[index].checked && this.moveSubtaskToBotttom) {
        this.todo.subTaskList.push(this.todo.subTaskList.splice(index, 1)[0]);
      }
      this.updateTodo();
    },
    linkifyText: function (text) { return linkifyStr(text, this.options); },
    pressEsc: function () {
      if (document.activeElement.id == "toDoModal") {
        this.$refs.closeModal.click();
      }
    },
  },
  watch: {
    selectedTodo: function (newVal) {
      this.todoList = this.$store.getters.todoLists[newVal.toDo.listId];
      this.index = newVal.index;
      this.todo = this.todoList[this.index];

      // 初始化缺失字段
      if (this.todo["desc"] == undefined) {
        this.todo["desc"] = "";
        this.todo["subTaskList"] = [];
        this.todo["color"] = "none";
        this.todo["priority"] = 0;
        this.todo["tags"] = [];
        this.todo["time"] = null;
        this.todo["alarm"] = false;
        this.todo["reminders"] = [];
        this.todo["repeatingEvent"] = null;
        this.todo["endDate"] = null;
      } else {
        if (this.todo["tags"] == undefined) this.todo["tags"] = [];
        if (this.todo["reminders"] == undefined) {
          this.todo["reminders"] = this.todo.alarm ? [0] : [];
        }
        if (this.todo["endDate"] == undefined) this.todo["endDate"] = null;
      }

      // ★ 确保跨天任务有 _spanId（兼容旧数据）
      ensureSpanId(this.todo);

      // 记录当前状态，用于后续日期变更时清理
      this.prevSpanId = this.todo._spanId || null;
      this.prevEndDate = this.todo.endDate || null;
      this.prevSourceListId = this.todo._isSpanMirror ? this.todo._spanSourceId : this.todo.listId;

      this.showingCalendar = moment(this.todo.listId, "YYYYMMDD", true).isValid();
      this.getCListOptions();
      this.loadingView = true;

      if (this.showingCalendar) {
        if (this.todo._isSpanMirror && this.todo._spanSourceId) {
          this.startDateStr = moment(this.todo._spanSourceId, "YYYYMMDD").format("YYYY-MM-DD");
        } else {
          this.startDateStr = moment(this.todo.listId, "YYYYMMDD").format("YYYY-MM-DD");
        }
        this.endDateStr = this.todo.endDate
          ? moment(this.todo.endDate, "YYYYMMDD").format("YYYY-MM-DD")
          : this.startDateStr;
        this.pickedCList = "";
        this.pickedCListName = "";
      } else {
        this.cListOptions.forEach((x) => {
          if (x.listId == this.todo.listId) {
            this.pickedCListName = x.listName;
          }
        });
        this.pickedCList = this.todo.listId;
        this.startDateStr = "";
        this.endDateStr = "";
      }
      this.$nextTick(function () { this.loadingView = false; });
    },
    pickedCList: function (newVal) {
      if (this.loadingView) return;
      this.moveToTodoList(newVal);
    },
  },
  computed: {
    language: function () { return languageHelper.getLanguagePack(this.$store.getters.config.language); },
    showCL: function () { return this.$store.getters.config.customList; },
    showCal: function () { return this.$store.getters.config.calendar; },
    todoText: function () { return linkifyStr(this.todo.text, this.options); },
    fullscreenToDoModal: function () { return this.$store.getters.config.fullscreenToDoModal; },
    moveSubtaskToBotttom: function () { return this.$store.getters.config.moveCompletedSubTaskToBottom; },
    weekStartOnMonday: function () { return this.$store.getters.config.weekStartOnMonday ? 1 : 0; },
    allTags: function () { return defaultTaskTags.getDefaultTags(this); },
  },
};
</script>

<style scoped lang="scss">
@use "../../assets/style/globalVars" as *;

.modal-dialog {
  max-height: 82%;
  max-width: 680px;
  .modal-content {
    height: 100%;
    border-radius: 16px;
    border: none;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.16);
    .modal-body {
      overflow-x: hidden;
      overflow-y: auto;
      max-height: calc(100vh - 190px);
      margin: 0px 0px 16px 0px;
      padding: 0px 24px 4px 24px;
    }
  }
}

#toDoModal.fullscreen {
  .modal-dialog {
    margin: 0px; height: 85%; width: 90%; max-width: unset;
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    .sub-tasks { max-height: unset; }
    .modal-content-inner { max-width: 760px; margin: 0 auto; }
  }
}

.modal-header {
  padding: 14px 20px 12px 20px;
  border-bottom: 1px solid #eff1f4;
  .dark-theme & { border-bottom: 1px solid #262b33; }
}

.date-range-row { display: flex; align-items: center; }
.date-range-picker {
  background-color: #f4f5f7; border-radius: 8px; padding: 4px 10px; gap: 4px;
  .dark-theme & { background-color: #1a1e24; }
}
.date-range-icon {
  font-size: 0.9rem; color: #6b7280; margin-right: 4px;
  .dark-theme & { color: #9aa0a8; }
}
.date-range-input {
  border: none; background: transparent; font-size: 13px; color: #374151;
  outline: none; width: 120px; padding: 4px 2px; font-family: inherit;
  .dark-theme & { color: #c9d1d9; }
  &::-webkit-calendar-picker-indicator {
    opacity: 0.4; cursor: pointer;
    .dark-theme & { filter: invert(0.7); }
  }
}
.date-range-separator { color: #9ca3af; font-size: 13px; margin: 0 2px; user-select: none; }

.attribute-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
.attribute-tools {
  display: flex; align-items: center; gap: 0; margin-left: 4px;
  background-color: transparent; padding: 2px 4px; border-radius: 0;
  .dark-theme & { background-color: transparent; }
}

.header-divider {
  width: 1px; height: 20px; background-color: #e2e4e8; margin: 0 10px;
  .dark-theme & { background-color: #30363d; }
}
.todo-list-selector .bi-chevron-down { @include btn-icon; }
.todo-list-selector .date-picker-btn {
  display: flex; @include btn-icon; padding: 0px;
  #todo-list-select { font-size: 15px; }
}
.todo-list-selector .selector-divider {
  height: 21px; width: 1px; background-color: #b9b9b9; margin: 0px 4px;
}
.modal-content-inner { padding-top: 20px; }
.todo-title {
  font-size: 19px; font-weight: 600; line-height: 26px;
  border: 2px solid transparent; padding: 1px 2px;
}
.todo-title-input {
  font-size: 19px; line-height: 26px; width: 100%; font-weight: 600;
  outline: unset; border: 2px solid #4263eb; border-radius: 6px; padding: 0 4px;
  .dark-theme & { border: 2px solid #6c8fff; background-color: unset; }
}
.todo-title-empty-title { color: grey; margin-left: -8px; }
.dropdown-item { color: #3c3c3c; }
.section-divider {
  height: 1px; background-color: #eff1f4; margin: 22px 0 18px;
  .dark-theme & { background-color: #262b33; }
}
.section-label {
  display: flex; align-items: center; gap: 6px; font-size: 0.78rem;
  font-weight: 600; color: #8a8f98; margin: 0 10px 8px; letter-spacing: 0.02em;
  i { font-size: 0.9rem; }
  .dark-theme & { color: #6b7078; }
}
.sub-tasks {
  list-style: none; padding: 0px 10px 10px 10px; margin: 0px;
  li > div { -webkit-user-drag: element; }
  .sub-task {
    border-radius: 8px; border-bottom: 1px solid rgba(0,0,0,0.05);
    transition: background-color 0.15s ease-out;
    .dark-theme & { border-bottom: 1px solid rgba(255,255,255,0.06); }
    label { width: 100%; padding: 10px 5px 10px 0px; min-height: 38px; height: auto; }
    .form-check-input { width: 17px !important; height: 17px !important; min-width: 17px; min-height: 17px; accent-color: #4263eb; }
    i {
      color: #87888a; display: none; cursor: pointer;
      &:hover { color: black; }
      .checked & { opacity: 1 !important; }
      .dark-theme & { color: #babbbe; &:hover { color: white; } }
    }
    .drag-hover {
      color: rgba(157,157,157,0.43); background-color: rgb(250,249,249); border-radius: 8px;
      .dark-theme & { color: rgb(87,87,87); background-color: #1f1e20; }
    }
    &:hover {
      background-color: $btn-hover-bg-color; border-radius: 8px;
      .dark-theme & { background-color: $dt-btn-hover-bg-color; }
      i { display: block; }
    }
  }
  .new-sub-task {
    padding: 2px 5px 2px 0px; width: 100%; margin-top: 4px;
    i { color: #b7bac0; }
    input {
      border: none; width: 100%; height: 38px; outline: unset; border: 2px solid transparent;
      .dark-theme & { background-color: unset; }
      &:focus {
        border: 2px solid #4263eb; border-radius: 6px;
        .dark-theme & { border: 2px solid #6c8fff; background-color: #21262d; }
      }
    }
  }
  .edit-sub-task {
    outline: unset; border: none; width: calc(100% - 48px); height: 38px;
    margin-left: 48px; border: 2px solid #4263eb; border-radius: 6px;
    .dark-theme & { border: 2px solid #6c8fff; background-color: #21262d; }
  }
}
.sub-task .checked label {
  color: #16a34a; text-decoration: none;
  .dark-theme & { color: #4ade80; }
}
.title-container { margin-left: 14px; margin-top: 1px; }
.form-check-input { width: 1.35em !important; height: 1.35em !important; accent-color: #4263eb; }
.dark-theme .form-select { background-color: #15161e; border: 1px solid #30363d; color: #c9d1d9; }
.form-select:focus { box-shadow: none; }
.header-menu-icons { margin-left: 6px; @include btn-icon; }
.header-menu-icons.bi-x { font-size: 1.9rem; padding: 0px; }
.modal.modal-static .modal-dialog { transform: none; }
#todo-list-select {
  padding: 0px; border: none; background-color: unset; cursor: pointer;
  width: 90px; font-size: 15px; line-height: 15px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: inline-block;
}
.completed-task {
  color: #16a34a; text-decoration: none;
  .dark-theme & { color: #4ade80; }
}
</style>
