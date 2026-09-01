<template>
  <div class="item-drop-zone" @dragenter.self="onDragenter" @dragleave.self="onDragleave" @drop="onDragleave"
    :class="[{ 'drag-hover': todoDragHover }]">
    <div class="todo-item-container" :class="{ 'compact-view': compactView }" ref="itemContainer">
      <div v-if="!editing" class="inline-todo-item d-flex flex-column" @mouseenter="showToDoItem">
        <div class="d-flex">
          <span class="noselect item-text" :class="{ 'checked-todo': toDo.checked, 'compact-view': compactView }"
            style="flex-grow: 1">
            <span v-if="toDo.color != 'none'" class="cicle-icon" :style="'color: ' + toDo.color" :class="{
              'bi-check-circle-fill': toDo.checked,
              'bi-circle-fill': !toDo.checked,
            }"></span>
            <span v-else class="cicle-icon"
              :class="{ 'bi-check-circle': toDo.checked, 'bi-circle': !toDo.checked, }"></span>
            <span v-html="todoText"></span>
            <span v-if="!compactView" class="item-time mx-2" :class="{ 'checked-todo': toDo.checked }"> {{
                timeFormat(toDo.time)
            }} <div class="alarm-indicator" :class="{ 'show-alarm-indicator': notificationIndicator && toDo.alarm }">
              </div></span>
          </span>
          <span v-if="compactView" class="item-time" :class="{ 'checked-todo': toDo.checked }"> {{ timeFormat(toDo.time)
          }}
            <div class="alarm-indicator" :class="{ 'show-alarm-indicator': notificationIndicator && toDo.alarm }"></div>
          </span>
        </div>
      </div>
      <textarea
        v-show="editing"
        class="edit todo-input"
        v-model="text"
        ref="toDoEditInput"
        rows="1"
        @blur="doneEdit()"
        @input="autoGrow"
        @keydown.enter.exact.prevent="doneEdit()"
        @keydown.enter.shift.exact="onShiftEnter"
        @keyup.esc="cancelEdit()"
      ></textarea>
    </div>
  </div>
</template>

<script>
import toDoListRepository from "../repositories/toDoListRepository";
import moment from "moment";
import linkifyStr from 'linkify-string';

export default {
  components: {},
  props: {
    toDo: { required: true, type: Object },
    index: { required: true, type: Number },
    toDoListId: { required: true, type: String },
  },
  data() {
    return {
      editing: false,
      text: this.toDo.text,
      todoDragHover: false,
      options: { target: '_blank', defaultProtocol: 'https' }
    };
  },
  methods: {
    // e 是触发编辑的原生点击事件（从 activeToDo.vue 的 editTodoClickHandler 传进来）
    // 如果没有事件传入（比如非点击方式触发编辑），则按老逻辑把光标放在末尾
    editToDo: function (e) {
      this.text = this.toDo.text;
      this.editing = true;
      const clickX = e ? e.clientX : null;
      const clickY = e ? e.clientY : null;
      this.$nextTick(function () {
        this.$refs.toDoEditInput.focus();
        this.autoGrow({ target: this.$refs.toDoEditInput });

        if (clickX !== null && clickY !== null && document.caretRangeFromPoint) {
          // 用点击时的屏幕坐标反查对应的字符位置
          const range = document.caretRangeFromPoint(clickX, clickY);
          if (range) {
            const offset = range.startOffset;
            this.$refs.toDoEditInput.setSelectionRange(offset, offset);
          }
        } else {
          // 没有点击坐标信息时，保留在文本末尾，不做全选，避免打字时误删全部内容
          const len = this.text ? this.text.length : 0;
          this.$refs.toDoEditInput.setSelectionRange(len, len);
        }
      });
      document.getElementById("todo-item-active").style.display = 'none';
    },
    // textarea 内容变化时，让高度跟随内容自动伸展，避免出现内部滚动条
    autoGrow: function (e) {
      const el = e.target;
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    },
    // Shift+Enter 时什么都不做，只是配合 keydown.enter.exact.prevent 让
    // 单独 Enter 触发保存、Shift+Enter 触发 textarea 原生换行
    onShiftEnter: function () {},
    doneEdit: function () {
      this.editing = false;
      this.$store.commit("updateTodo", {
        toDoListId: this.toDoListId,
        index: this.index,
        text: this.text,
      });
      toDoListRepository.update(this.toDoListId, this.$store.getters.todoLists[this.toDoListId]);
    },
    cancelEdit: function () {
      this.text = this.toDo.text;
      this.editing = false;
    },
    onDragenter: function () {
      this.todoDragHover = true;
    },
    onDragleave: function () {
      this.todoDragHover = false;
    },
    timeFormat: function (date) {
      if (date) {
        return moment(date, "HH:mm").format("hh:mm a");
      }
    },
    showToDoItem: function () {
      var activeTodo = {
        toDo: this.toDo,
        index: this.index,
        toDoListId: this.toDoListId,
        edit: this.editToDo,
        container: this.$refs.itemContainer
      };
      this.$store.commit('setActiveTodo', activeTodo);

      const activeTodoItem = document.getElementById("todo-item-active");
      this.$nextTick(function () {
        const bounding = this.$refs.itemContainer.getBoundingClientRect();
        activeTodoItem.style.width = `${bounding.width}px`;
        activeTodoItem.style.top = `${bounding.y}px`;
        activeTodoItem.style.left = `${bounding.x}px`;
        activeTodoItem.style.display = `block`;
        const margin_bottom = 10;
        var offset = parseInt(window.innerHeight) - (parseInt(bounding.y) + parseInt(activeTodoItem.offsetHeight)) - margin_bottom;
        if (offset < 0) activeTodoItem.style.top = `${bounding.y + offset}px`;
      });
    },
  },
  computed: {
    todoText: function () {
      return linkifyStr(this.toDo.text, this.options);
    },
    compactView: function () {
      return this.$store.getters.config.compactView;
    },
    notificationIndicator: function () {
      return this.$store.getters.config.notificationIndicator;
    }
  }
};
</script>

<style scoped lang="scss">
.todo-item-container {
  border-bottom: 1px solid #eaecef;
  min-height: 26px;
  z-index: 1;

  .dark-theme & {
    border-bottom: 1px solid #30363d;
  }
}

.dragging-item .item-drop-zone * {
  pointer-events: none;
}

.todo-input {
  line-height: 1.3rem;
  width: 100%;
  border: none;
  font-size: 0.865rem;
  resize: none;
  overflow: hidden;
  font-family: inherit;
  padding: 0 3px 0 7px;

  &:focus {
    outline: none;
  }
}

.item-text {
  transition: width 2s, height 2s, transform 2s;
  width: 1rem;
  min-height: 1.2rem;
  line-height: 1.3rem;
  font-size: 0.865rem;
  margin: 2px 0px 2px 0px;
  padding: 0 3px 0 7px;
}

.item-text.compact-view {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  height: 1.2rem;
}

.item-time {
  transition: width 2s, height 2s, transform 2s;
  height: 1.2rem;
  line-height: 1.3rem;
  font-size: 0.865rem;
  margin: 2px 0px 2px 0px;
  padding: 0 2px 0 0px;
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

.checked-todo {
  color: #acacac;
  text-decoration: line-through;

  .dark-theme & {
    color: #636363;
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

.todo-item-container.compact-view {
  height: 26px;
}
</style>
