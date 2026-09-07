<template>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="backdrop"
      class="vision-edit-backdrop"
      tabindex="-1"
      @mousedown.self="requestClose"
      @keydown.esc.stop.prevent="requestClose"
    >
      <section
        class="vision-edit-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vision-edit-title"
      >
        <header class="edit-header">
          <div class="edit-heading">
            <span class="edit-icon">
              <i class="bi-stars"></i>
            </span>

            <div>
              <h2 id="vision-edit-title">
                {{ isNew ? "新建未来卡片" : "编辑未来卡片" }}
              </h2>
              <p>描绘未来的状态，而不只是列出任务</p>
            </div>
          </div>

          <button
            type="button"
            class="close-button"
            title="关闭"
            aria-label="关闭编辑窗口"
            @click="requestClose"
          >
            ×
          </button>
        </header>

        <main class="edit-content">
          <div class="basic-grid">
            <label class="field">
              <span>卡片标题</span>
              <input
                v-model.trim="form.title"
                type="text"
                maxlength="60"
                placeholder="例如：5 年后的我"
              />
            </label>

            <label class="field">
              <span>年份标签</span>
              <select v-model.number="form.targetYear">
                <option
                  v-for="year in yearOptions"
                  :key="year"
                  :value="year"
                >
                  {{ year }} 年 · {{ relativeYearLabel(year) }}
                </option>
              </select>
            </label>
          </div>

          <label class="pin-switch">
            <span>
              <i class="bi-pin-angle"></i>
              置顶这张卡片
            </span>

            <input v-model="form.pinned" type="checkbox" />
          </label>

          <label class="field vision-field">
            <span>未来图景</span>
            <small>
              描述那时的工作、生活、关系、能力和内在状态
            </small>

            <textarea
              v-model.trim="form.vision"
              rows="6"
              maxlength="1600"
              placeholder="到了那个年份，我希望自己已经……"
            ></textarea>
          </label>

          <section class="goals-section">
            <header>
              <div>
                <strong>关键目标</strong>
                <span>
                  每张卡片建议保留 1～5 个真正重要的目标
                </span>
              </div>

              <button type="button" @click="addGoal">
                <i class="bi-plus-lg"></i>
                添加目标
              </button>
            </header>

            <div v-if="form.goals.length" class="goal-list">
              <article
                v-for="(goal, index) in form.goals"
                :key="goal.id"
                class="goal-editor"
                :class="{ completed: goal.done }"
              >
                <div class="goal-title-row">
                  <label class="goal-check">
                    <input
                      v-model="goal.done"
                      type="checkbox"
                    />
                    <i></i>
                  </label>

                  <input
                    v-model.trim="goal.title"
                    class="goal-title"
                    type="text"
                    maxlength="100"
                    placeholder="目标名称"
                  />

                  <button
                    type="button"
                    class="remove-goal"
                    title="删除目标"
                    aria-label="删除目标"
                    @click="form.goals.splice(index, 1)"
                  >
                    ×
                  </button>
                </div>

                <div class="goal-detail-grid">
                  <label class="field">
                    <span>做到什么算完成</span>
                    <input
                      v-model.trim="goal.evidence"
                      type="text"
                      maxlength="200"
                      placeholder="写下可以验证的结果"
                    />
                  </label>

                  <label class="field">
                    <span>现在的第一步</span>
                    <input
                      v-model.trim="goal.firstStep"
                      type="text"
                      maxlength="200"
                      placeholder="写下一周内可以开始的行动"
                    />
                  </label>
                </div>
              </article>
            </div>

            <button
              v-else
              type="button"
              class="goal-empty"
              @click="addGoal"
            >
              <i class="bi-plus-circle"></i>
              <strong>添加第一个目标</strong>
              <span>
                不需要写满所有领域，先记录真正重要的事情
              </span>
            </button>
          </section>
        </main>

        <footer class="edit-footer">
          <button
            v-if="!isNew"
            type="button"
            class="delete-button"
            @click="remove"
          >
            删除卡片
          </button>

          <span v-if="isDirty" class="dirty-hint">
            有未保存的修改
          </span>

          <button
            type="button"
            class="cancel-button"
            @click="requestClose"
          >
            取消
          </button>

          <button
            type="button"
            class="save-button"
            @click="save"
          >
            保存卡片
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<script>
import moment from "moment";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createId(prefix) {
  return (
    prefix +
    "_" +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  );
}

function createForm() {
  return {
    id: createId("vision"),
    title: "",
    targetYear: moment().year() + 1,
    vision: "",
    goals: [],
    pinned: false,
    pinnedAt: null,
    sortOrder: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export default {
  name: "LifeVisionCardEditModal",

  props: {
    visible: {
      type: Boolean,
      default: false,
    },

    card: {
      type: Object,
      default: null,
    },
  },

  emits: ["close", "save", "remove"],

  data() {
    const initial = createForm();

    return {
      form: initial,
      initialFingerprint: JSON.stringify(initial),
    };
  },

  computed: {
    isNew() {
      return !this.card;
    },

    isDirty() {
      return (
        JSON.stringify(this.form) !==
        this.initialFingerprint
      );
    },

    yearOptions() {
      const currentYear = moment().year();
      const start = Math.min(
        currentYear - 10,
        Number(this.form.targetYear) || currentYear
      );
      const end = Math.max(
        currentYear + 30,
        Number(this.form.targetYear) || currentYear
      );

      const years = [];

      for (let year = start; year <= end; year += 1) {
        years.push(year);
      }

      return years;
    },
  },

  watch: {
    visible(value) {
      if (!value) return;

      this.form = this.card
        ? clone(this.card)
        : createForm();

      this.initialFingerprint = JSON.stringify(this.form);

      this.$nextTick(() => {
        this.$refs.backdrop?.focus();
      });
    },
  },

  methods: {
    relativeYearLabel(year) {
      const distance = Number(year) - moment().year();

      if (distance === 0) return "今年";
      if (distance === 1) return "1 年后";
      if (distance > 1) return `${distance} 年后`;
      if (distance === -1) return "1 年前";

      return `${Math.abs(distance)} 年前`;
    },

    addGoal() {
      this.form.goals.push({
        id: createId("goal"),
        title: "",
        evidence: "",
        firstStep: "",
        done: false,
      });
    },

    save() {
      if (!this.form.title.trim()) {
        const distance =
          Number(this.form.targetYear) - moment().year();

        this.form.title =
          distance > 0
            ? `${distance} 年后的我`
            : `${this.form.targetYear} 年的我`;
      }

      if (this.form.pinned && !this.form.pinnedAt) {
        this.form.pinnedAt = new Date().toISOString();
      }

      if (!this.form.pinned) {
        this.form.pinnedAt = null;
      }

      this.$emit("save", clone(this.form));
    },

    remove() {
      if (
        !window.confirm(
          `确定删除“${this.form.title || "这张卡片"}”吗？`
        )
      ) {
        return;
      }

      this.$emit("remove", this.form.id);
    },

    requestClose() {
      if (
        this.isDirty &&
        !window.confirm("当前修改尚未保存，确定关闭吗？")
      ) {
        return;
      }

      this.$emit("close");
    },
  },
};
</script>

<style scoped lang="scss">
.vision-edit-backdrop {
  position: fixed;
  z-index: 17100;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  outline: none;
  background: rgba(19, 20, 27, 0.52);
  backdrop-filter: blur(8px);
}

.vision-edit-dialog {
  display: flex;
  width: min(720px, calc(100vw - 48px));
  max-height: min(760px, calc(100vh - 48px));
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(35, 39, 46, 0.1);
  border-radius: 17px;
  background: #fff;
  box-shadow: 0 30px 90px rgba(20, 21, 29, 0.3);

  .dark-theme & {
    border-color: #343d47;
    background: #181e25;
  }
}

.edit-header,
.edit-heading,
.edit-footer,
.goals-section > header,
.pin-switch,
.goal-title-row {
  display: flex;
  align-items: center;
}

.edit-header {
  min-height: 74px;
  justify-content: space-between;
  padding: 14px 19px;
  border-bottom: 1px solid #e9ecef;
}

.edit-heading {
  gap: 11px;

  h2 {
    margin: 0;
    color: #2f353d;
    font-size: 17px;
  }

  p {
    margin: 3px 0 0;
    color: #979da6;
    font-size: 10px;
  }
}

.edit-icon {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 11px;
  background: #f1edff;
  color: #7950c7;
  font-size: 17px;
}

.close-button,
.remove-goal {
  border: 0;
  background: transparent;
  color: #9299a2;
  cursor: pointer;
}

.close-button {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  font-size: 22px;

  &:hover {
    background: #eff2f5;
  }
}

.edit-content {
  min-height: 0;
  padding: 17px 19px 20px;
  overflow-y: auto;
  background: #fafbfc;
}

.basic-grid,
.goal-detail-grid {
  display: grid;
  grid-template-columns: 1.35fr 0.65fr;
  gap: 10px;
}

.field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 5px;

  > span {
    color: #6f7781;
    font-size: 9px;
    font-weight: 600;
  }

  > small {
    margin-top: -2px;
    color: #a0a6ae;
    font-size: 8px;
  }
}

input,
select,
textarea {
  box-sizing: border-box;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  outline: none;
  background: #fff;
  color: #343b44;
  font-family: inherit;
  font-size: 10px;

  &:focus {
    border-color: #a692dc;
    box-shadow: 0 0 0 3px rgba(121, 80, 199, 0.08);
  }
}

input,
select {
  height: 34px;
  padding: 0 9px;
}

textarea {
  width: 100%;
  padding: 9px 10px;
  line-height: 1.7;
  resize: vertical;
}

.pin-switch {
  justify-content: space-between;
  margin-top: 10px;
  padding: 9px 11px;
  border: 1px solid #e7e9ed;
  border-radius: 8px;
  background: #fff;
  color: #69717b;
  font-size: 9px;

  span {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  input {
    width: 15px;
    height: 15px;
  }
}

.vision-field {
  margin-top: 15px;
}

.goals-section {
  margin-top: 17px;

  > header {
    justify-content: space-between;
    margin-bottom: 8px;

    > div {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    strong {
      color: #414852;
      font-size: 11px;
    }

    span {
      color: #9ba1aa;
      font-size: 8px;
    }

    button {
      border: 0;
      background: transparent;
      color: #7950c7;
      font-size: 9px;
      cursor: pointer;
    }
  }
}

.goal-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.goal-editor {
  padding: 9px;
  border: 1px solid #e6e9ed;
  border-radius: 9px;
  background: #fff;

  &.completed {
    opacity: 0.68;
  }
}

.goal-title-row {
  gap: 6px;
}

.goal-check {
  display: flex;

  input {
    display: none;
  }

  i {
    display: grid;
    width: 14px;
    height: 14px;
    place-items: center;
    border: 1px solid #c7ccd3;
    border-radius: 50%;
    cursor: pointer;
  }

  input:checked + i {
    border-color: #7950c7;
    background: #7950c7;

    &::after {
      width: 5px;
      height: 3px;
      border-bottom: 1.5px solid #fff;
      border-left: 1.5px solid #fff;
      content: "";
      transform: translateY(-1px) rotate(-45deg);
    }
  }
}

.goal-title {
  min-width: 0;
  flex: 1;
  font-weight: 600;
}

.remove-goal {
  width: 24px;
  height: 28px;
  font-size: 16px;
}

.goal-detail-grid {
  grid-template-columns: 1fr 1fr;
  margin: 7px 0 0 20px;
}

.goal-empty {
  display: flex;
  width: 100%;
  min-height: 90px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 4px;
  border: 1px dashed #dce0e5;
  border-radius: 9px;
  background: transparent;
  color: #969da6;
  cursor: pointer;

  i {
    color: #9c84d0;
    font-size: 19px;
  }

  strong {
    font-size: 10px;
  }

  span {
    color: #a9aeb5;
    font-size: 8px;
  }
}

.edit-footer {
  min-height: 59px;
  gap: 8px;
  padding: 9px 18px;
  border-top: 1px solid #e9ecef;
}

.dirty-hint {
  margin-left: auto;
  color: #a28442;
  font-size: 8px;
}

.delete-button,
.cancel-button,
.save-button {
  min-width: 78px;
  height: 33px;
  border-radius: 7px;
  font-size: 10px;
  cursor: pointer;
}

.delete-button {
  border: 1px solid #f1c8cc;
  background: #fff;
  color: #d34d59;
}

.cancel-button {
  margin-left: auto;
  border: 1px solid #dfe3e8;
  background: #fff;
  color: #5f6771;
}

.dirty-hint + .cancel-button {
  margin-left: 0;
}

.save-button {
  border: 1px solid #7950c7;
  background: #7950c7;
  color: #fff;
}

.dark-theme {
  .edit-header,
  .edit-footer {
    border-color: #303842;
  }

  .edit-heading h2,
  .goals-section strong {
    color: #dce1e7;
  }

  .edit-content {
    background: #151a20;
  }

  .pin-switch,
  .goal-editor {
    border-color: #303842;
    background: #1d232b;
    color: #b4bbc4;
  }

  input,
  select,
  textarea,
  .cancel-button,
  .delete-button {
    border-color: #36404a;
    background: #20262e;
    color: #d8dde3;
    color-scheme: dark;
  }

  .close-button:hover {
    background: #252c35;
  }
}

@media (max-width: 740px) {
  .vision-edit-dialog {
    min-width: 660px;
  }

  .vision-edit-backdrop {
    justify-content: start;
    overflow-x: auto;
  }
}
</style>
