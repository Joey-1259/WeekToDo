<template>
  <div class="task-composer-backdrop" @mousedown.self="$emit('close')">
    <section class="task-composer">
      <header>
        <div>
          <strong>关联到每周事项</strong>
          <small>创建后，文档与周视图使用同一条事项</small>
        </div>
        <button type="button" @click="$emit('close')">×</button>
      </header>

      <div class="task-composer-body">
        <textarea
          ref="title"
          v-model="form.text"
          rows="2"
          maxlength="500"
          placeholder="准备做什么？"
          @keydown.meta.enter.prevent="createTask"
          @keydown.ctrl.enter.prevent="createTask"
        ></textarea>

        <div class="quick-dates">
          <button
            v-for="target in quickTargets"
            :key="target.listId"
            type="button"
            :class="{ active: form.listId === target.listId }"
            @click="selectTarget(target)"
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

        <div class="task-composer-row">
          <label>
            <span>时间</span>
            <input v-model="form.time" type="time" />
          </label>

          <label>
            <span>优先级</span>
            <select v-model.number="form.priority">
              <option :value="0">普通</option>
              <option :value="1">重要</option>
              <option :value="2">紧急</option>
            </select>
          </label>

          <label class="alarm-option">
            <input
              v-model="form.alarm"
              type="checkbox"
              :disabled="!form.time"
            />
            <span>提醒</span>
          </label>
        </div>

        <textarea
          v-model="form.desc"
          rows="2"
          placeholder="补充说明（可选）"
        ></textarea>
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

export default {
  name: "FocusTaskComposer",
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
      form: {
        text: "",
        desc: "",
        listId: targets[0]?.listId || "",
        time: null,
        priority: 0,
        alarm: false,
      },
    };
  },
  computed: {
    quickTargets() {
      return this.targets
        .filter((item) => item.type === "date")
        .slice(0, 3);
    },
  },
  mounted() {
    this.$refs.title?.focus();
  },
  methods: {
    selectTarget(target) {
      this.form.listId = target.listId;
    },

    async createTask() {
      if (!this.form.text.trim() || this.saving) return;

      this.saving = true;

      try {
        const attrs =
          await focusTaskService.createLinkedTask(
            this.documentId,
            {
              ...this.form,
              text: this.form.text.trim(),
              alarm: this.form.alarm && Boolean(this.form.time),
            }
          );

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
  width: min(560px, 92vw);
  border-radius: 14px;
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

.task-composer header div {
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
  flex-direction: column;
  gap: 14px;
  padding: 18px;
}

.task-composer textarea,
.task-composer select,
.task-composer input[type="time"] {
  width: 100%;
  padding: 9px 10px;
  border: 1px solid #dfe2e7;
  border-radius: 8px;
  outline: none;
  background: #fff;
  color: #30343a;
  font: inherit;
}

.task-composer textarea:focus,
.task-composer select:focus,
.task-composer input:focus {
  border-color: #6d86e8;
  box-shadow: 0 0 0 3px rgba(66, 99, 235, 0.1);
}

.task-composer label {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 5px;
  color: #737a84;
  font-size: 11px;
}

.task-composer-row {
  display: flex;
  align-items: flex-end;
  gap: 10px;
}

.task-composer .alarm-option {
  flex: 0 0 auto;
  flex-direction: row;
  align-items: center;
  padding-bottom: 9px;
}

.quick-dates {
  display: flex;
  gap: 6px;
}

.quick-dates button {
  padding: 5px 11px;
  border: 1px solid #dfe2e7;
  border-radius: 14px;
  background: #fff;
  color: #626a75;
  cursor: pointer;
}

.quick-dates button.active {
  border-color: #4263eb;
  background: #eef1ff;
  color: #4263eb;
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

.dark-theme .task-composer {
  background: #1b2129;
  color: #e1e5ea;
}

.dark-theme .task-composer header,
.dark-theme .task-composer footer {
  border-color: #343b45;
}

.dark-theme .task-composer textarea,
.dark-theme .task-composer select,
.dark-theme .task-composer input[type="time"] {
  border-color: #3a424d;
  background: #14191f;
  color: #dce1e7;
}
</style>
