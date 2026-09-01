<template>
  <div class="weekly-to-do-header d-flex">
    <i v-show="!editing" class="bi-info header-menu-icons align-self-center dropdown-toggle-split "
      style="visibility: hidden"></i>
    <div style="flex-grow: 1" class="noselect">
      <div v-if="!customTodoList">
        <h4 :class="{ 'today-date': is_today, 'picked-date': is_picked }">
          {{ moments(id).locale(language).format("dddd") }}
        </h4>
        <span class="weekly-to-do-subheader">
          {{ moments(id).locale(language).format("LL") }}
        </span>
        <span v-if="holidayInfo" class="holiday-badge" :class="{ 'workday-badge': !holidayInfo.isOffDay }" :title="holidayInfo.name">
          {{ holidayInfo.isOffDay ? holidayInfo.name : '班' }}
        </span>
      </div>
      <div
        v-else
        class="custom-list-title d-flex align-items-center justify-content-center"
        draggable="true"
        @dragstart="startListDrag($event)"
        @dragover.prevent
        @dragenter.prevent="onListDragEnter"
        @dragleave="onListDragLeave"
        @drop="onListDrop($event)"
        :class="{ 'list-drag-hover': listDragHover }"
      >
        <i class="bi-grip-vertical drag-handle-icon" :title="$t('ui.reorder')"></i>
        <h4 v-show="!editing" @dblclick="editToDoListName"> {{ todo_list_name }} </h4>
        <input class="custom-todo-input" v-show="editing" type="text" v-model="name" ref="cTodoInput" @blur="doneEdit()"
          @keyup.enter="doneEdit()" @keyup.esc="cancelEdit()" />
      </div>
    </div>
    <i v-show="!editing" class="bi-three-dots-vertical header-menu-icons dropdown-toggle-split align-self-center"
      type="button" data-bs-toggle="dropdown"></i>
    <ul class="dropdown-menu" aria-labelledby="btnTaskOptionMenu">
      <li>
        <button class="dropdown-item" type="button" @click="newTask">
          <i class="bi-plus-lg"></i> <span>{{ $t('ui.newTask') }}</span>
        </button>
      </li>
      <li v-show="!allTodoChecked()">
        <button class="dropdown-item" type="button" @click="check_all_items">
          <i class="bi-check2-all"></i> <span>{{ $t('ui.completeAll') }}</span>
        </button>
      </li>
      <li>
        <button class="dropdown-item" type="button" @click="sortItems">
          <i class="bi-sort-down"></i> <span>{{ $t('ui.reorder') }}</span>
        </button>
      </li>
      <li v-show="!customTodoList && !allTodoChecked()">
        <button class="dropdown-item" type="button" @click="moveUndoneItems">
          <i class="bi-reply-all"></i> <span>{{ $t('ui.postpone') }}</span>
        </button>
      </li>
      <li>
        <button class="dropdown-item" type="button" @click="copyListTasksToClipboard">
          <i class="bi-clipboard"></i> <span>{{ $t('ui.copyTasks') }}</span>
        </button>
      </li>
      <li>
        <hr class="dropdown-divider" />
      </li>
      <li>
        <button class="dropdown-item" type="button" @click="clearList" data-bs-toggle="modal"
          data-bs-target="#clearListModal">
          <i class="bi-trash"></i> <span>{{ $t('ui.clearList') }}</span>
        </button>
      </li>
      <li v-show="customTodoList">
        <button class="dropdown-item" type="button" data-bs-dismiss="modal" @click="removeList" data-bs-toggle="modal"
          data-bs-target="#customListRemoveModal">
          <i class="bi-x-circle"></i> <span>{{ $t('ui.removeList') }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>

<script>
import moment from "moment";
import toDoListRepository from "../repositories/toDoListRepository";
import customToDoListIdsRepository from "../repositories/customToDoListIdsRepository";
import notifications from "../helpers/notifications";
import tasksHelper from "../helpers/tasksHelper";
import holidayHelper from "../helpers/holidayHelper";
import { Toast } from 'bootstrap';

export default {
  components: {},
  props: {
    id: { required: false, type: String },
    customTodoList: { required: false, default: false, type: Boolean },
    cTodoListIndex: { required: false, type: Number },
    toDoList: { required: false, type: Array },
    pickedDate: { required: false, type: String, default: null },
  },
  emits: ["reorderCustomList"],
  data() {
    return {
      editing: false,
      name: "",
      listDragHover: false,
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
  },
  methods: {
    check_all_items: function () {
      this.$store.commit("checkAllItems", this.id);
      this.updateTodoList(this.id, this.$store.getters.todoLists[this.id]);
    },
    moveUndoneItems: function () {
      let towmorrow_id = this.moments(this.id).add(1, "d").format("YYYYMMDD");
      this.$store.commit("moveUndoneItems", {
        origenId: this.id,
        destinyId: towmorrow_id,
      });
      this.updateTodoList(this.id, this.$store.getters.todoLists[this.id]);

      if (this.$store.getters.config.autoReorderTasks) {
        this.updateTodoList(towmorrow_id, tasksHelper.reorderTasksList(this.$store.getters.todoLists[towmorrow_id]));
      } else {
        this.updateTodoList(towmorrow_id, this.$store.getters.todoLists[towmorrow_id]);
      }

    },
    moments: function (date) {
      return moment(date);
    },
    updateTodoList: function (todoListId, TodoList) {
      notifications.refreshDayNotifications(this, todoListId);
      toDoListRepository.update(todoListId, TodoList);
    },
    allTodoChecked: function () {
      let allChecked = true;
      this.toDoList.forEach(function (todo) {
        if (!todo.checked) {
          allChecked = false;
          return;
        }
      });
      return allChecked;
    },
    editToDoListName: function () {
      this.name = this.$store.getters.cTodoListIds[this.cTodoListIndex].listName;
      this.editing = true;
      this.$nextTick(function () {
        this.$refs.cTodoInput.focus();
        this.$refs.cTodoInput.select();
      });
    },
    doneEdit: function () {
      this.editing = false;
      this.$store.commit("updateCustomTodoList", {
        index: this.cTodoListIndex, name: this.name,
      });
      customToDoListIdsRepository.update(this.$store.getters.cTodoListIds);
    },
    cancelEdit: function () {
      this.name = this.$store.getters.cTodoListIds[this.cTodoListIndex].listName || "";
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
      toDoListRepository.update(this.id, tasksHelper.reorderTasksList(this.toDoList));
    },
    clearList: function () {
      this.$store.commit("setListToClear", this.id);
    },
    copyListTasksToClipboard: async function () {
      await navigator.clipboard.writeText(this.todoListToString());
      let toast = new Toast(document.getElementById("copiedTaskToClipboard"));
      toast.show();
    },
    todoListToString: function () {
      return this.toDoList.map((x) => {
        let task = `- ${x.text}`;
        if (x.time) task += ` [${x.time}]`;
        return task;
      }).join('\n')
    },
    newTask: function () {
      this.$nextTick(function () {
        document
          .getElementById("list" + this.id)
          .getElementsByClassName("new-todo-input")[0]
          .focus();
      });
    },
    startListDrag: function (event) {
      event.dataTransfer.setData("customListIndex", String(this.cTodoListIndex));
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
      let fromIndex = parseInt(event.dataTransfer.getData("customListIndex"));
      let toIndex = this.cTodoListIndex;
      if (isNaN(fromIndex) || fromIndex === toIndex) return;

      let customLists = this.$store.getters.cTodoListIds;
      let moved = customLists.splice(fromIndex, 1)[0];
      customLists.splice(toIndex, 0, moved);
      customToDoListIdsRepository.update(customLists);
      this.$emit("reorderCustomList");
    },
  },
  computed: {
    is_today: function () {
      return moment().format("YYYYMMDD") == this.id;
    },
    is_picked: function () {
      return !this.customTodoList && !!this.pickedDate && this.pickedDate == this.id;
    },
    holidayInfo: function () {
      if (this.customTodoList) return null;
      return holidayHelper.getDayInfo(this.id);
    },
    todo_list_name: function () {
      return this.$store.getters.cTodoListIds[this.cTodoListIndex].listName;
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
  margin-bottom: 23px;
  margin-top: 10px;
  display: flex;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.today-date,
.picked-date {
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-underline-offset: 4px;
}

.holiday-badge {
  display: inline-block;
  margin-left: 4px;
  font-size: 11px;
  line-height: 16px;
  padding: 0 5px;
  border-radius: 4px;
  color: #d9363e;
  background-color: rgba(217, 54, 62, 0.08);
  vertical-align: middle;
}

.workday-badge {
  color: #b8860b;
  background-color: rgba(184, 134, 11, 0.08);
}

.dark-theme .holiday-badge {
  color: #ff7875;
  background-color: rgba(255, 120, 117, 0.12);
}

.dark-theme .workday-badge {
  color: #e0a95c;
  background-color: rgba(224, 169, 92, 0.12);
}

.weekly-to-do-header h4 {
  margin-bottom: 4px;
  font-size: 21px;
  text-transform: capitalize;
  min-height: 25px;
}

.weekly-to-do-subheader {
  margin-top: 0px;
  font-size: 12px;
  color: grey;
}

.weekly-to-do-header .header-menu-icons {
  color: grey;
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

.weekly-to-do-header .header-menu-icons {
  font-size: 20px;
  flex-grow: 0;
  align-self: start;
  cursor: pointer;
  visibility: hidden;
  opacity: 0;
  transition: 0.4s cubic-bezier(0.2, 1, 0.1, 1);
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
  box-shadow: rgb(244, 243, 243) 0px 0px 4px 1px inset;
  background-color: rgb(250, 249, 249);
}

.dark-theme .list-drag-hover {
  box-shadow: #0b0d12 0px 0px 4px 1px inset;
  background-color: #0c0d14;
}

.drag-handle-icon {
  font-size: 14px;
  color: #b0b3b8;
  margin-right: 4px;
  cursor: grab;
}

.dark-theme .drag-handle-icon {
  color: #565b62;
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
  box-shadow: 0 2px 10px 0 rgba(0, 0, 0, .20);
  border: none;
  color: #3c3c3c;

  .dropdown-item {
    padding: .4rem 1.9rem .4rem .65rem;
  }

  .dropdown-divider {
    margin: .3rem;
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

.bi-reply-all,
.bi-files {
  transform: scaleX(-1);
}
</style>
