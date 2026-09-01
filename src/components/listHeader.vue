<template>
  <div class="weekly-to-do-header d-flex" :class="{ 'drag-hover-header': dragHover }"
    :draggable="customTodoList" @dragstart="startCListDrag" @dragover.prevent
    @dragenter.self="onCListDragEnter" @dragleave.self="onCListDragLeave" @drop="onCListDrop">
    <i v-show="!editing" class="header-menu-icons align-self-center dropdown-toggle-split"
      :class="customTodoList ? 'bi-grip-vertical drag-grip-icon' : 'bi-info'"
      :style="customTodoList ? {} : { visibility: 'hidden' }"
      :title="customTodoList ? $t('ui.reorderCustomLists') : ''"
    ></i>
    <div style="flex-grow: 1" class="noselect">
      <div v-if="!customTodoList" :class="{ 'today-date': is_today, 'picked-date': is_picked && !is_today }">
        <h4>
          {{ moments(id).locale(language).format("dddd") }}
        </h4>
        <span class="weekly-to-do-subheader">
          {{ moments(id).locale(language).format("LL") }}
        </span>
      </div>
      <div v-else>
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
import { Toast } from 'bootstrap';

export default {
  components: {},
  props: {
    id: { required: false, type: String },
    customTodoList: { required: false, default: false, type: Boolean },
    cTodoListIndex: { required: false, type: Number },
    toDoList: { required: false, type: Array },
    pickedDate: { required: false, default: null, type: String },
  },
  emits: ["reorderCustomList"],
  data() {
    return {
      editing: false,
      name: "",
      dragHover: false,
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
    // 以下四个方法只在自定义列表表头生效，用来支持“直接拖动表头调整列表顺序”
    startCListDrag: function (event) {
      if (!this.customTodoList) return;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("customListIndex", String(this.cTodoListIndex));
    },
    onCListDragEnter: function () {
      if (!this.customTodoList) return;
      this.dragHover = true;
    },
    onCListDragLeave: function () {
      if (!this.customTodoList) return;
      this.dragHover = false;
    },
    onCListDrop: function (event) {
      if (!this.customTodoList) return;
      this.dragHover = false;
      const fromIndex = parseInt(event.dataTransfer.getData("customListIndex"));
      const toIndex = this.cTodoListIndex;
      if (isNaN(fromIndex) || fromIndex === toIndex) return;

      const customLists = this.$store.getters.cTodoListIds;
      const moved = customLists.splice(fromIndex, 1)[0];
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
      return !!this.pickedDate && this.pickedDate == this.id;
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

.weekly-to-do-header.drag-hover-header {
  border-radius: 8px;
  box-shadow: rgb(244, 243, 243) 0px 0px 0px 2px inset;
  background-color: rgb(250, 249, 249);
}

.dark-theme .weekly-to-do-header.drag-hover-header {
  box-shadow: #0b0d12 0px 0px 0px 2px inset;
  background-color: #0c0d14;
}

.drag-grip-icon {
  visibility: visible !important;
  opacity: 0.35;
  cursor: grab;
}

.drag-grip-icon:hover {
  opacity: 1;
}

.drag-grip-icon:active {
  cursor: grabbing;
}

.today-date h4,
.today-date .weekly-to-do-subheader {
  color: #2563eb;
}
.today-date h4 {
  font-weight: 700;
}
.dark-theme .today-date h4,
.dark-theme .today-date .weekly-to-do-subheader {
  color: #60a5fa;
}

.picked-date h4,
.picked-date .weekly-to-do-subheader {
  color: #f59e0b;
}
.picked-date h4 {
  font-weight: 700;
}
.dark-theme .picked-date h4,
.dark-theme .picked-date .weekly-to-do-subheader {
  color: #fbbf24;
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
