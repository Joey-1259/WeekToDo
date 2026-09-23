<template>
  <div id="todo-item-active" class="todo-item" ref="currentTodo" draggable="true"
    @dragstart="startDrag($event, activeTodo.toDo, activeTodo.index)" @dragend="endDrag()" @wheel="movingWheel"
    :class="{ 'dragging': todoDragging }" @mouseleave="hideToDoItem">
    <div class="d-flex">
      <span class="noselect item-text" :class="{ 'checked-todo': activeTodo.toDo.checked }" style="flex-grow: 1"
        @click.middle="showToDoDetails">
        <span v-if="activeTodo.toDo.color != 'none'" class="cicle-icon" :style="'color: ' + activeTodo.toDo.color" :class="{
          'bi-check-circle-fill': activeTodo.toDo.checked,
          'bi-circle-fill': !activeTodo.toDo.checked,
        }" @click.stop="checkTodoClickhandler"></span>
        <span v-else class="cicle-icon"
          :class="{ 'bi-check-circle': activeTodo.toDo.checked, 'bi-circle': !activeTodo.toDo.checked, }"
          @click.stop="checkTodoClickhandler"></span>
        <span v-html="todoText" @click="editTodoClickHandler"></span>
        <span class="time-details"> {{ timeFormat(activeTodo.toDo.time) }}
          <div class="alarm-indicator"
            :class="{ 'show-alarm-indicator': notificationIndicator && activeTodo.toDo.alarm }"></div>
        </span>
      </span>
      <i class="bi-three-dots todo-item-menu" type="button" @click="showToDoDetails"></i>
      <!-- PATCH_20260923_V1 -->
      <i class="bi-files todo-item-copy" title="复制事项" @click.stop="duplicateTodo"></i>
      <i class="bi-x todo-item-remove" @click="removeTodo"></i>
    </div>

    <div v-if="activeTodo.toDo.subTaskList && activeTodo.toDo.subTaskList.length > 0" class="todo-item-sub-tasks">
      <ul class="sub-tasks">
        <li v-for="(subTask, index) in activeTodo.toDo.subTaskList" :key="index" class="sub-task">
          <div class="d-flex flex-row mt-1" :class="{ 'checked-sub-task': subTask.checked }">
            <input class="form-check-input" type="checkbox" v-model="subTask.checked"
              @change="checkSubTask(subTask, index, $event)" />
            <label class="form-check-label" @click="checkSubTask(subTask, index, $event)">
              <span v-html="linkifyText(subTask.text)"></span>
            </label>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
import toDoListRepository from "../repositories/toDoListRepository";
import { Modal, Toast } from "bootstrap";
import moment from "moment";
import notifications from "../helpers/notifications";
import linkifyStr from 'linkify-string';
import tasksHelper from "../helpers/tasksHelper";
import defaultTaskTags from "../data/defaultTaskTags.js";
import focusTaskService from "../services/focusTaskService.js";
import { createId } from "../helpers/idHelper";
import {
  clearMirrorsBySpanId,
  isSpanningTask,
  syncSpanningChecked,
  syncSpanningState,
} from "../helpers/spanSyncHelper";

export default {
  components: {},
  props: {
    activeTodo: { required: true, type: Object }
  },
  data() {
    return {
      editing: false,
      todoDragHover: false,
      todoDragging: false,
      options: { target: '_blank', defaultProtocol: 'https' },
      scrollingTimeOut: null
    };
  },
  methods: {
    removeTodo: async function () {
      const todo = JSON.parse(
        JSON.stringify(
          this.activeTodo.toDo
        )
      );

      if (
        isSpanningTask(todo) &&
        todo._spanId
      ) {
        const sourceId =
          todo._isSpanMirror
            ? todo._spanSourceId
            : todo.listId;

        clearMirrorsBySpanId(
          todo._spanId,
          sourceId,
          todo.endDate,
          this.$store
        );

        if (
          todo._isSpanMirror &&
          todo._spanSourceId
        ) {
          const sourceList =
            this.$store.getters.todoLists[
              todo._spanSourceId
            ];

          if (sourceList) {
            const sourceIndex =
              sourceList.findIndex(
                (task) =>
                  !task._isSpanMirror &&
                  task._spanId ===
                    todo._spanId
              );

            if (sourceIndex !== -1) {
              sourceList.splice(
                sourceIndex,
                1
              );

              await toDoListRepository.update(
                todo._spanSourceId,
                sourceList
              );
            }
          }
        }
      }

      const listId =
        this.activeTodo.toDoListId;

      const currentList =
        this.$store.getters.todoLists[
          listId
        ] || [];

      const currentIndex =
        currentList.findIndex(
          (task) =>
            task === this.activeTodo.toDo ||
            (
              todo.id &&
              task?.id === todo.id
            )
        );

      this.$store.commit(
        "setUndoElement",
        {
          type: "task",
          todo,
          index:
            currentIndex >= 0
              ? currentIndex
              : this.activeTodo.index,
        }
      );

      if (currentIndex >= 0) {
        this.$store.commit(
          "removeTodo",
          {
            toDoListId: listId,
            index: currentIndex,
          }
        );
      }

      notifications.refreshDayNotifications(
        this,
        listId
      );

      try {
        await toDoListRepository.update(
          listId,
          this.$store.getters.todoLists[
            listId
          ] || []
        );

        await focusTaskService
          .handleExternalDeletion({
            taskId: todo.id,
            listId,
          });
      } catch (error) {
        console.error(
          "删除事项关联失败：",
          error
        );

        window.alert(
          error?.message ||
            "事项已从当前列表移除，"
            + "但关联清理失败，请重试。"
        );
      }

      const toast = new Toast(
        document.getElementById(
          "taskRemoved"
        )
      );

      toast.show();
      this.hideToDoItem();
    },
    duplicateTodo: async function () {
      const listId = this.activeTodo.toDoListId;
      const list = this.$store.getters.todoLists[listId] || [];
      const source = this.activeTodo.toDo;

      let index = list.findIndex(
        (task) => task === source || (source.id && task?.id === source.id)
      );
      if (index < 0) index = this.activeTodo.index;

      const copy = JSON.parse(JSON.stringify(source));
      ["_spanId", "_isSpanMirror", "_spanSourceId", "endDate"].forEach(
        (key) => delete copy[key]
      );
      copy.id = createId("task");
      copy.listId = listId;
      copy.checked = false;
      copy.repeatingEvent = null;

      this.$store.commit("insertTodo", {
        toDoListId: listId,
        index: index + 1,
        toDo: copy,
      });

      this.hideToDoItem();

      try {
        await toDoListRepository.update(
          listId,
          this.$store.getters.todoLists[listId]
        );
        notifications.refreshDayNotifications(this, listId);
        window.dispatchEvent(new CustomEvent("weektodo:task-changed", {
          detail: { action: "created", taskId: copy.id, listId },
        }));
      } catch (error) {
        console.error(error);
        window.alert(error?.message || "复制事项失败，请重试。");
      }
    },
    showToDoDetails: function () {
      this.$store.commit("actionsSelectedTodoIdUpdate", {
        toDo: this.activeTodo.toDo,
        index: this.activeTodo.index,
      });

      let modal = new Modal(document.getElementById("toDoModal"), { keyboard: false });
      modal.show();
    },
    checkTodoClickhandler: function (e) {
      if (e.target.href) return;
      this.$store.commit("checkTodo", { toDoListId: this.activeTodo.toDoListId, index: this.activeTodo.index, });
      this.checkToDo(this.activeTodo.toDoListId, this.activeTodo.index);
    },
    editTodoClickHandler: function (e) {
      if (e.target.href) return;
      this.activeTodo.edit();
    },
    checkToDo: function (toDoListId, index) {
      let todo = this.$store.getters.todoLists[toDoListId][index];

      // ★ 跨天任务同步 checked 状态
      if (isSpanningTask(todo)) {
        syncSpanningChecked(todo, this.$store);
      }

      if (todo.checked && this.$store.getters.config.moveCompletedTaskToBottom) {
        this.$refs.currentTodo.style.display = `none`;
        this.$store.commit("moveTodoToEnd", { toDoListId: toDoListId, index: index, });
      }
      if (this.$store.getters.config.autoReorderTasks) {
        this.$refs.currentTodo.style.display = `none`;
        toDoListRepository.update(toDoListId, tasksHelper.reorderTasksList(this.$store.getters.todoLists[toDoListId]));
      } else {
        toDoListRepository.update(toDoListId, this.$store.getters.todoLists[toDoListId]);
      }
      notifications.refreshDayNotifications(this, this.activeTodo.toDoListId);
    },
    startDrag: function (event, item, index) {
      event.dataTransfer.dropEffect = "move";
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("item", JSON.stringify(item));
      event.dataTransfer.setData("index", index);
      event.dataTransfer.setDragImage(this.activeTodo.container, 0, 0);
      setTimeout(() => {
        this.$refs.currentTodo.style.display = `none`;
        this.todoDragging = true;
      }, 40);
      document.getElementById("app-container").classList.add("dragging-item");
    },
    endDrag: function () {
      this.todoDragging = false;
      document.getElementById("app-container").classList.remove("dragging-item");
    },
    onDragenter: function () {
      this.todoDragHover = true;
    },
    onDragleave: function () {
      this.todoDragHover = false;
    },
    checkSubTask: function (subTask, index, e) {
      if (e.target.href) return;

      if (!e.target.value) subTask.checked = !subTask.checked;
      var todoList = this.activeTodo.toDo.subTaskList;
      if (subTask.checked && this.moveSubtaskToBotttom) { todoList.push(todoList.splice(index, 1)[0]); }
      toDoListRepository.update(this.activeTodo.toDoListId, this.$store.getters.todoLists[this.activeTodo.toDoListId]);

      // ★ 跨天任务：子任务变更也同步
      let todo = this.activeTodo.toDo;
      if (isSpanningTask(todo)) {
        syncSpanningState(todo, this.$store);
      }
    },
    timeFormat: function (date) {
      if (date) {
        return moment(date, "HH:mm").format("hh:mm a");
      }
    },
    linkifyText: function (text) {
      return linkifyStr(text, this.options);
    },
    hideToDoItem: function () {
      this.$refs.currentTodo.style.display = `none`;
    },
    movingWheel() {
      this.$refs.currentTodo.style.display = `none`;
      this.$refs.currentTodo.classList.add("scrolling");
      document.getElementById("app-container").classList.add("scrolling");
      if (this.scrollingTimeOut != null) return;

      this.scrollingTimeOut = setTimeout(() => {
        this.scrollingTimeOut = null;
        document.onmousemove = function () {
          document.onmousemove = null;
          document.getElementById("todo-item-active").classList.remove("scrolling");
          document.getElementById("app-container").classList.remove("scrolling");
        }
      }, 400);
    }
  },
  computed: {
    todoText: function () {
      return linkifyStr(this.activeTodo.toDo.text, this.options).replace(/\n/g, "<br>");
    },
    notificationIndicator: function () {
      return this.$store.getters.config.notificationIndicator;
    },
    moveSubtaskToBotttom: function () {
      return this.$store.getters.config.moveCompletedSubTaskToBottom;
    },


  }
};
</script>

<style scoped lang="scss">
.todo-item {
  background-color: #ffffff;
  color: #1e1e1e;
  border-radius: 7px;
  position: relative;
  box-shadow: 0px 2px 13px 0px rgba(0, 0, 0, 0.15);
  z-index: 6;
  position: absolute;
  display: none;

  &:hover {
    display: block;
  }

  * {
    transition: all 0.4s cubic-bezier(0.2, 1, 0.1, 1) 0s;
    pointer-events: all;
  }

  .dark-theme & {
    box-shadow: 0 0px 0 1px #4c4c4c;
    background-color: #21262d;
    color: #f7f7f7;
    box-shadow: 0px 2px 5px 0px rgba(0, 0, 0, 0.1);
  }

  .item-text {
    white-space: unset;
    word-break: normal;
    height: unset;
    overflow-wrap: break-word;
    word-wrap: break-word;
    z-index: 1;
  }
}

.todo-item.scrolling {
  display: none !important;
}

.item-text {
  transition: width 2s, height 2s, transform 2s;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  width: 1rem;
  height: 1.2rem;
  line-height: 1.3rem;
  font-size: 0.865rem;
  margin: 2px 0px 2px 0px;
  padding: 0 3px 0 7px;

  .cicle-icon {
  display: inline-block;
  vertical-align: middle;
  position: relative;
  top: -1px;
    cursor: pointer;
  }
}

.item-time {
  transition: width 2s, height 2s, transform 2s;
  height: 1.2rem;
  line-height: 1.3rem;
  font-size: 0.865rem;
  margin: 2px 0px 2px 0px;
  padding: 0 7px 0 0px;
  opacity: 0.6;
}

.item-time.checked-todo {
  opacity: unset;
}

.time-details {
  opacity: 0.6;
  display: inline;
  margin-left: 5px;
}

.todo-item.checked-todo .time-details {
  opacity: unset;
}

/* FOCUS_INTERACTION_STABILITY_20260907_V1: completed task */
.checked-todo {
  color: #9aa0a8;

  .dark-theme & {
    color: #6b7280;
  }
}

.checked-sub-task {
  color: #c4c4c4;
  text-decoration: line-through;

  .dark-theme & {
    color: #3a3a40;
  }

  input {
    opacity: 0.5;
  }
}

.todo-item-remove {
  font-size: 1.3rem;
  cursor: pointer;
  margin-top: 1px;
  margin-left: 5px;
  margin-right: 5px;
  color: grey;
  height: 1.3rem;
  flex-grow: 0;
}

.todo-item-menu {
  font-size: 1rem;
  cursor: pointer;
  margin-top: 3px;
  margin-left: 5px;
  margin-right: 0px;
  color: grey;
  height: 1.1rem;
  flex-grow: 0;
}

.todo-item-copy {
  font-size: 0.82rem;
  cursor: pointer;
  margin-top: 4px;
  margin-left: 7px;
  color: grey;
  height: 1rem;
  flex-grow: 0;
}

.dark-theme .todo-item-copy {
  color: #c9d1d9;
}

.dark-theme .todo-item-copy:hover {
  color: white;
}

.todo-item-copy:hover,
.todo-item-remove:hover,
.todo-item-menu:hover {
  color: black;
}

.dark-theme .todo-item-remove,
.dark-theme .todo-item-menu {
  color: #c9d1d9;
}

.dark-theme .todo-item-remove:hover,
.dark-theme .todo-item-menu:hover {
  color: white;
}

.drag-hover {
  color: rgba(157, 157, 157, 0.43);
  box-shadow: rgb(244, 243, 243) 0px 0px 4px 1px inset;
  background-color: rgb(250, 249, 249);
}

.dark-theme .drag-hover {
  color: rgb(69, 69, 69);
  box-shadow: #0b0d12 0px 0px 4px 1px inset;
  background-color: #0c0d14;
}

.dragging.todo-item {
  display: none;
}

.sub-tasks {
  list-style: none;
  padding: 0px;
  font-size: 0.865rem;

  li {
    margin: 0px 10px 0px 10px;
  }

  li:last-child {
    margin: 0px 10px 10px 10px;
  }

  input {
    min-width: 14px;
    width: 14px;
    min-height: 14px;
    height: 14px;
    margin-right: 8px;
  }

  label {
    margin-top: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
}

.cicle-icon {
  font-size: 10px;
  margin-right: 5px;
}

.bi-check-circle-fill,
.bi-check-circle {
  opacity: 0.7;
}
</style>
