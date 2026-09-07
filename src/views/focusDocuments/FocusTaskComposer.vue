<template>
  <div
    class="task-composer-backdrop"
    @mousedown.self="$emit('close')"
  >
    <section class="task-composer">
      <header>
        <div>
          <strong>关联到每周事项</strong>
          <small>与每周事项共用同一条任务数据</small>
        </div>
        <button type="button" @click="$emit('close')">×</button>
      </header>

      <div class="task-composer-body">
        <div class="task-main-row">
          <span class="task-checkbox"></span>

          <input
            ref="title"
            v-model="form.text"
            class="task-title-input"
            maxlength="500"
            placeholder="任务内容"
            @keydown.meta.enter.prevent="createTask"
            @keydown.ctrl.enter.prevent="createTask"
          />
        </div>

        <textarea
          v-model="form.desc"
          class="task-detail-input"
          rows="3"
          placeholder="任务细节（可选）"
        ></textarea>

        <div class="task-targets">
          <div class="quick-dates">
            <button
              v-for="target in quickTargets"
              :key="target.listId"
              type="button"
              :class="{ active: form.listId === target.listId }"
              @click="form.listId = target.listId"
            >
              {{ target.label }}
            </button>
          </div>

          <label>
            <span>日期或列表</span>
            <select v-model="form.listId">
              <option
                v-for="target in targets"
                :key="target.listId"
                :value="target.listId"
              >
                {{ target.label }}
              </option>
            </select>
          </label>
        </div>

        <div class="task-attributes">
          <tag-picker
            :model-value="form.tags"
            :all-tags="allTags"
            @update:modelValue="form.tags = $event"
          />

          <div class="task-attribute-tools">
            <time-picker
              :time="form.time"
              @time-selected="changeTime"
            />
            <reminder-picker
              :model-value="form.reminders"
              @update:modelValue="changeReminders"
            />
            <color-picker
              :color="form.color"
              @color-selected="form.color = $event"
            />
          </div>
        </div>

        <section class="task-subtasks">
          <div class="task-section-title">
            <span>☑</span>
            <span>子任务</span>
          </div>

          <div
            v-for="(subtask, index) in form.subTaskList"
            :key="index"
            class="task-subtask"
          >
            <input
              v-model="subtask.checked"
              type="checkbox"
            />
            <input
              v-model="subtask.text"
              type="text"
              placeholder="子任务内容"
            />
            <button
              type="button"
              title="删除子任务"
              @click="form.subTaskList.splice(index, 1)"
            >
              ×
            </button>
          </div>

          <div class="task-new-subtask">
            <span>＋</span>
            <input
              v-model="newSubtask"
              type="text"
              placeholder="添加子任务"
              @keydown.enter.prevent="addSubtask"
              @blur="addSubtask"
            />
          </div>
        </section>
      </div>

      <footer>
        <span>⌘/Ctrl + Enter 创建</span>

        <div>
          <button type="button" @click="$emit('close')">
            取消
          </button>
          <button
            type="button"
            class="primary"
            :disabled="saving || !form.text.trim()"
            @click="createTask"
          >
            {{ saving ? "创建中…" : "创建并关联" }}
          </button>
        </div>
      </footer>
    </section>
  </div>
</template>

<script>
import focusTaskService from "../../services/focusTaskService";
import tagPicker from "../toDoModal/tagPicker.vue";
import timePicker from "../toDoModal/timePicker.vue";
import reminderPicker from "../toDoModal/reminderPicker.vue";
import colorPicker from "../toDoModal/colorPicker.vue";
import defaultTaskTags from "../../data/defaultTaskTags";

export default {
  name: "FocusTaskComposer",
  components: {
    tagPicker,
    timePicker,
    reminderPicker,
    colorPicker,
  },
  props: {
    documentId: {
      type: String,
      required: true,
    },
  },
  emits: ["close", "created"],
  data() {
    const targets = focusTaskService.listTargets();

    return {
      targets,
      saving: false,
      newSubtask: "",
      form: {
        text: "",
        desc: "",
        listId: targets[0]?.listId || "",
        time: null,
        priority: 0,
        alarm: false,
        reminders: [],
        tags: [],
        color: "none",
        subTaskList: [],
      },
    };
  },
  computed: {
    quickTargets() {
      return this.targets
        .filter((item) => item.type === "date")
        .slice(0, 3);
    },

    allTags() {
      return defaultTaskTags.getDefaultTags(this);
    },
  },
  mounted() {
    this.$refs.title?.focus();
  },
  methods: {
    addSubtask() {
      const text = this.newSubtask.trim();
      if (!text) return;

      this.form.subTaskList.push({
        text,
        checked: false,
        editing: false,
      });

      this.newSubtask = "";
    },

    changeTime(time) {
      this.form.time = time;

      if (!time) {
        this.form.alarm = false;
        this.form.reminders = [];
      }
    },

    changeReminders(reminders) {
      this.form.reminders = reminders || [];
      this.form.alarm = this.form.reminders.length > 0;
    },

    async syncLoadedWeekList(attrs) {
      const task = await focusTaskService.resolveTask(
        attrs.taskId,
        attrs.listId
      );

      if (!task) return;

      const loaded =
        this.$store?.getters?.todoLists?.[attrs.listId];

      if (
        Array.isArray(loaded) &&
        !loaded.some((item) => item?.id === task.id)
      ) {
        loaded.push(task);
      }
    },

    async createTask() {
      if (!this.form.text.trim() || this.saving) return;

      this.addSubtask();
      this.saving = true;

      try {
        const attrs =
          await focusTaskService.createLinkedTask(
            this.documentId,
            {
              ...this.form,
              text: this.form.text.trim(),
              desc: this.form.desc.trim(),
              alarm:
                this.form.reminders.length > 0 ||
                (this.form.alarm &&
                  Boolean(this.form.time)),
            }
          );

        await this.syncLoadedWeekList(attrs);
        this.$emit("created", attrs);
      } catch (error) {
        console.error(error);
        window.alert("创建关联事项失败，请重试。");
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>

<style scoped lang="scss">
.task-composer-backdrop {
  position: fixed;
  z-index: 12000;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(17, 21, 27, 0.46);
  backdrop-filter: blur(4px);
}

.task-composer {
  display: flex;
  width: min(620px, 94vw);
  max-height: min(760px, 92vh);
  flex-direction: column;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.25);
  overflow: hidden;
}

.task-composer header,
.task-composer footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 15px 18px;
}

.task-composer header {
  border-bottom: 1px solid #eceef1;
}

.task-composer header > div {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.task-composer header small,
.task-composer footer > span {
  color: #9298a2;
  font-size: 11px;
}

.task-composer header > button {
  border: 0;
  background: transparent;
  font-size: 23px;
  cursor: pointer;
}

.task-composer-body {
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
  overflow-y: auto;
}

.task-main-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.task-checkbox {
  width: 21px;
  height: 21px;
  flex: 0 0 21px;
  border: 1.5px solid #9ba6b5;
  border-radius: 50%;
}

.task-title-input {
  width: 100%;
  padding: 5px 2px;
  border: 0;
  border-bottom: 2px solid transparent;
  outline: none;
  background: transparent;
  color: #292d33;
  font-size: 19px;
  font-weight: 600;
}

.task-title-input:focus {
  border-bottom-color: #4263eb;
}

.task-detail-input,
.task-targets select {
  width: 100%;
  padding: 9px 10px;
  border: 1px solid #dfe2e7;
  border-radius: 8px;
  outline: none;
  background: #fff;
  color: #30343a;
  font: inherit;
}

.task-detail-input {
  min-height: 76px;
  max-height: 116px;
  resize: vertical;
  line-height: 1.55;
}

.task-detail-input:focus,
.task-targets select:focus {
  border-color: #6d86e8;
  box-shadow: 0 0 0 3px rgba(66, 99, 235, 0.1);
}

.task-targets {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 180px;
  align-items: end;
  gap: 12px;
}

.task-targets label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  color: #737a84;
  font-size: 11px;
}

.quick-dates {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.quick-dates button {
  padding: 6px 12px;
  border: 1px solid #dfe2e7;
  border-radius: 15px;
  background: #fff;
  color: #626a75;
  cursor: pointer;
}

.quick-dates button.active {
  border-color: #4263eb;
  background: #eef1ff;
  color: #4263eb;
}

.task-attributes {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.task-attribute-tools {
  display: flex;
  align-items: center;
}

.task-subtasks {
  padding-top: 14px;
  border-top: 1px solid #eef0f2;
}

.task-section-title {
  display: flex;
  gap: 6px;
  margin-bottom: 7px;
  color: #8a9099;
  font-size: 12px;
  font-weight: 600;
}

.task-subtask,
.task-new-subtask {
  display: flex;
  min-height: 38px;
  align-items: center;
  gap: 9px;
  padding: 2px 5px;
  border-bottom: 1px solid #f0f1f3;
}

.task-subtask > input[type="text"],
.task-new-subtask input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  background: transparent;
}

.task-subtask button {
  border: 0;
  background: transparent;
  color: #a1a6ad;
  cursor: pointer;
}

.task-composer footer {
  border-top: 1px solid #eceef1;
}

.task-composer footer > div {
  display: flex;
  gap: 8px;
}

.task-composer footer button {
  padding: 8px 14px;
  border: 1px solid #dfe2e7;
  border-radius: 7px;
  background: #fff;
  cursor: pointer;
}

.task-composer footer button.primary {
  border-color: #4263eb;
  background: #4263eb;
  color: #fff;
}

.task-composer footer button:disabled {
  cursor: default;
  opacity: 0.5;
}

.dark-theme .task-composer {
  background: #1b2129;
  color: #e1e5ea;
}

.dark-theme .task-composer header,
.dark-theme .task-composer footer,
.dark-theme .task-subtasks,
.dark-theme .task-subtask,
.dark-theme .task-new-subtask {
  border-color: #343b45;
}

.dark-theme .task-title-input,
.dark-theme .task-detail-input,
.dark-theme .task-targets select,
.dark-theme .task-subtask input,
.dark-theme .task-new-subtask input {
  background: transparent;
  color: #dce1e7;
}

.dark-theme .task-detail-input,
.dark-theme .task-targets select {
  border-color: #3a424d;
  background: #14191f;
}

@media (max-width: 620px) {
  .task-targets {
    grid-template-columns: 1fr;
  }
}
</style>
