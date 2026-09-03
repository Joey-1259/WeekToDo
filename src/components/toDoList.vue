<template>
  <div :id="'list' + id" class="to-do-list-container d-flex flex-column" ref="listContainer" :class="{
    'old-date': !customTodoList && moments(id).isBefore(Date(), 'day'),
  }" :style="customTodoList ? 'flex: 1 1 auto; width: 100%; min-width: 0;' : `flex: 0 0 ${100 / columns}%;`">
    <div v-if="loading" class="loading-spinner">
      <div class="spinner-border" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
    </div>

    <list-header
      :id="id"
      :customTodoList="customTodoList"
      :cTodoListIndex="cTodoListIndex"
      :toDoList="toDoListState"
      :pickedDate="pickedDate"
      :totalCustomLists="totalCustomLists"
      @reorderCustomList="$emit('reorderCustomList')"
      @addCustomList="$emit('addCustomList')"
      @cycleCustomList="$emit('cycleCustomList', $event)"
    >
    </list-header>
    <ul class="to-do-list">
      <li v-for="(toDo, index) in toDoListState" :key="index">
        <div class="drop-zone" @drop="onDrop($event, id, index)" @dragover.prevent @dragenter.prevent>
          <to-do-item :to-do="toDo" :index="index" :to-do-list-id="id"></to-do-item>
        </div>
      </li>
    </ul>
    <div class="fake-drop-zone flex-grow-1 margin-bottom-2" @drop="onDropAtEnd($event, id)"
      @dragenter.self="onDragenter" @dragleave.self="onDragleave" @dragover.prevent
      :class="{ 'fake-drag-hover': fakeItemsDragHover }">
      <div class="todo-item-container">
        <textarea
          class="todo-input new-todo-input"
          ref="newToDoInput"
          rows="1"
          v-model="newToDo.text"
          @input="autoGrow($event)"
          @blur="addToDo()"
          @keydown.enter.exact.prevent="addToDo()"
          @keyup.esc="cancelAdd()"
        ></textarea>
      </div>

      <div class="fake-lines" :class="{ 'custom-list': customTodoList }" @click="$refs.newToDoInput.focus()"></div>
    </div>
  </div>
</template>

<script>
import toDoItem from "./toDoItem";
import moment from "moment";
import toDoListRepository from "../repositories/toDoListRepository";
import listHeader from "./listHeader";
import notifications from "../helpers/notifications";
import repeatingEventHelper from "../helpers/repeatingEvents.js";
import tasksHelper from "../helpers/tasksHelper";

export default {
  components: {
    listHeader,
    toDoItem,
  },
  props: {
    id: { required: false, type: String },
    customTodoList: { required: false, default: false, type: Boolean },
    cTodoListIndex: { required: false, type: Number },
    showCustomList: { required: false, type: Boolean },
    pickedDate: { required: false, type: String, default: null },
    columnsOverride: { required: false, type: Number, default: null },
    totalCustomLists: { required: false, type: Number, default: 1 },
  },
  emits: ["todoListMounted", "reorderCustomList", "addCustomList", "cycleCustomList"],
  data() {
    return {
      newToDo: { text: "", checked: false },
      fakeItemCounts: 6,
      fakeItemsDragHover: false,
      loading: false,
    };
  },
  mounted() {
    this.setTodoListHeight();
    window.addEventListener("resize", this.setTodoListHeight);
    let listId = this.id;
    this.loading = true;
    this.$store.dispatch("loadTodoLists", listId).then(() => {
      this.$store.dispatch("loadRepeatingEventGeneratedByDate", listId).then(() => {
        this.loading = false;
        repeatingEventHelper.generateRepeatingEventsIntances(listId, this);
      });
      this.clearRemovedRepeatingEvents();
      this.$emit("todoListMounted", listId);
    });
  },
  unmounted() {
    window.removeEventListener("resize", this.setTodoListHeight);
  },
  beforeCreate() {
    let listId = this.id;
    this.$store.commit("loadTodoLists", { todoListId: listId, todoList: [] });
  },
  methods: {
    addToDo: function () {
      if (this.newToDo.text.trim() != "") {
        var newTodo = {
          text: this.newToDo.text,
          checked: false,
          listId: this.id,
          desc: "",
          subTaskList: [],
          color: "none",
          priority: 0,
          tags: [],
          time: null,
          alarm: false,
          reminders: [],
          repeatingEvent: null,
        };
        this.$store.commit("addTodo", newTodo);
        this.updateTodoList(this.id, this.$store.getters.todoLists[this.id]);
      }
      this.newToDo.text = "";
      this.resetInputHeight();
    },
    cancelAdd: function () {
      this.newToDo.text = "";
      this.resetInputHeight();
    },
    autoGrow: function (e) {
      e.target.style.height = "auto";
      e.target.style.height = e.target.scrollHeight + "px";
    },
    resetInputHeight: function () {
      this.$nextTick(function () {
        if (this.$refs.newToDoInput) this.$refs.newToDoInput.style.height = "auto";
      });
    },
    moments: function (date) {
      return moment(date);
    },
    onDrop: function (event, list, new_index) {
      let toDo = JSON.parse(event.dataTransfer.getData("item"));
      let index = event.dataTransfer.getData("index");
      this.$store.commit("removeTodo", {
        toDoListId: toDo.listId,
        index: index,
      });
      this.updateTodoList(toDo.listId, this.$store.getters.todoLists[toDo.listId]);
      if (toDo.listId != list) toDo.repeatingEvent = null;
      toDo.listId = list;
      this.$store.commit("insertTodo", {
        toDoListId: list,
        index: new_index,
        toDo: toDo,
      });
      if(this.$store.getters.config.autoReorderTasks){
        this.updateTodoList(list, tasksHelper.reorderTasksList(this.$store.getters.todoLists[list]));
      } else {
        this.updateTodoList(list, this.$store.getters.todoLists[list]);
      }
    },
    onDropAtEnd: function (event, list) {
      let toDo = JSON.parse(event.dataTransfer.getData("item"));
      let index = event.dataTransfer.getData("index");
      this.$store.commit("removeTodo", { toDoListId: toDo.listId, index: index, });
      this.updateTodoList(toDo.listId, this.$store.getters.todoLists[toDo.listId]);
      if (toDo.listId != list) toDo.repeatingEvent = null;
      toDo.listId = list;
      this.$store.commit("addTodo", toDo);

      if(this.$store.getters.config.autoReorderTasks){
        this.updateTodoList(list, tasksHelper.reorderTasksList(this.$store.getters.todoLists[list]));
      } else {
        this.updateTodoList(list, this.$store.getters.todoLists[list]);
      }
      this.fakeItemsDragHover = false;
    },
    updateTodoList: function (todoListId, TodoList) {
      notifications.refreshDayNotifications(this, todoListId);
      toDoListRepository.update(todoListId, TodoList);
    },
    setTodoListHeight: function () {
      if (this.showCustomList) {
        this.fakeItemCounts = Math.floor(this.$refs.listContainer.clientHeight / 40);
      } else {
        this.fakeItemCounts = Math.floor(this.$refs.listContainer.clientHeight / 34);
      }
    },
    onDragenter: function () {
      this.fakeItemsDragHover = true;
    },
    onDragleave: function () {
      this.fakeItemsDragHover = false;
    },
    clearRemovedRepeatingEvents: function () {
      if (this.customTodoList) return;
      repeatingEventHelper.removeGeneratedRepeatingEvents(this.id, this);
    },
  },
  watch: {
    showCustomList: function () {
      this.$nextTick(function () {
        this.setTodoListHeight();
      });
    },
  },
  computed: {
    toDoListState: function () {
      return this.$store.getters.todoLists[this.id];
    },
    columns: function () {
      if (this.columnsOverride) return this.columnsOverride;
      if (this.customTodoList)
        return this.$store.getters.config.customColumns;
      return this.$store.getters.config.columns;
    },
  },
};
</script>

<style scoped>
.to-do-list {
  list-style: none;
  padding-inline-start: 0px;
  margin-bottom: 0px;
}

.to-do-list li {
  -webkit-transition: all 0.4s ease-out;
  transition: all 0.4s ease-out;
}

.todo-input {
  line-height: 1.3rem;
  font-size: 0.865rem;
  margin: 2px 0px 2px 0px;
  padding: 0 6px 0 6px;
}

.new-todo-input {
  min-height: 1.28rem;
  max-height: 120px;
  overflow-y: hidden;
  resize: none;
  border: none;
  width: 100%;
  font-family: inherit;
  white-space: pre-wrap;
  word-break: break-word;
}

.new-todo-input:focus {
  outline: none;
}

.to-do-list-container {
  padding-left: 13px;
  padding-right: 13px;
  scroll-snap-align: start;
  margin-bottom: 5px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.to-do-list-container::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.to-do-fake-item {
  height: 1.2rem;
  width: 100%;
}

.fake-item-container {
  border-bottom: 1px solid #eaecef;
  height: 1.6rem;
}

.dark-theme .fake-item-container {
  border-bottom: 1px solid #30363d;
}

.fake-drop-zone * {
  pointer-events: none;
}

.fake-drop-zone:hover * {
  pointer-events: unset;
}

.fake-drag-hover .todo-item-container {
  box-shadow: rgb(244, 243, 243) 0px 0px 4px 1px inset;
  background-color: rgb(250, 249, 249);
}

.dark-theme .fake-drag-hover .todo-item-container {
  box-shadow: #0b0d12 0px 0px 4px 1px inset;
  background-color: #0c0d14;
}

.fake-drag-hover input,
.dark-theme .fake-drag-hover input {
  background-color: unset;
}

.fake-lines {
  background-image: linear-gradient(0deg,
      #ffffff 48.08%,
      #eaecef 48.08%,
      #eaecef 50%,
      #ffffff 50%,
      #ffffff 98.08%,
      #eaecef 98.08%,
      #eaecef 100%);
  background-size: 52px 52px;
  height: calc(100% - 23px);
}

.dark-theme .fake-lines {
  background-image: linear-gradient(0deg,
      #13171d 48.08%,
      #30363d 48.08%,
      #30363d 50%,
      #13171d 50%,
      #13171d 98.08%,
      #30363d 98.08%,
      #30363d 100%);
  background-size: 52px 52px;
}

.fake-lines.custom-list {
  height: calc(100% - 24px);
}

.loading-spinner {
  position: relative;
  margin: auto;
  top: 200px;
  height: 0px;
}

.todo-item-container {
  border-bottom: 1px solid #eaecef;
  min-height: 26px;
  z-index: 1;
  margin-bottom: -1px;
}
</style>
