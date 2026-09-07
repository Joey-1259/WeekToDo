<template>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="backdrop"
      class="life-backdrop"
      tabindex="-1"
      @mousedown.self="requestClose"
      @keydown.esc.stop.prevent="requestClose"
    >
      <section
        class="life-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="life-title"
      >
        <header class="life-header">
          <div class="life-heading">
            <span class="life-icon">
              <i class="bi-compass"></i>
            </span>

            <div>
              <h2 id="life-title">人生印记</h2>
              <p>看清想成为谁，把长期方向落在今天</p>
            </div>
          </div>

          <div class="header-meta">
            <span v-if="draft.updatedAt">
              上次更新 {{ formatUpdatedAt(draft.updatedAt) }}
            </span>

            <button
              type="button"
              class="close-button"
              title="关闭"
              aria-label="关闭人生印记"
              @click="requestClose"
            >
              ×
            </button>
          </div>
        </header>

        <main class="life-content">
          <!-- 人生北极星 -->
          <article
            class="life-card north-star-card"
            :class="{ editing: editingCard === 'north' }"
          >
            <header class="card-header">
              <div>
                <span class="card-eyebrow">NORTH STAR</span>
                <h3>人生北极星</h3>
              </div>

              <button
                type="button"
                class="card-action"
                @click="toggleEditor('north')"
              >
                <i
                  :class="
                    editingCard === 'north'
                      ? 'bi-check-lg'
                      : 'bi-pencil'
                  "
                ></i>
                {{
                  editingCard === "north"
                    ? "完成"
                    : "编辑"
                }}
              </button>
            </header>

            <div
              v-if="editingCard !== 'north'"
              class="north-star-display"
            >
              <blockquote>
                {{
                  draft.motto ||
                  "写下一句话，在重要选择面前提醒自己。"
                }}
              </blockquote>

              <p
                class="identity-text"
                :class="{ empty: !draft.identity }"
              >
                {{
                  draft.identity ||
                  "描述你希望成为怎样的人，而不只是想取得什么。"
                }}
              </p>

              <ol
                v-if="visiblePrinciples.length"
                class="principle-display-list"
              >
                <li
                  v-for="(item, index) in visiblePrinciples"
                  :key="item.id"
                >
                  <span>
                    {{ String(index + 1).padStart(2, "0") }}
                  </span>
                  <p>{{ item.text }}</p>
                </li>
              </ol>

              <button
                v-else
                type="button"
                class="empty-action"
                @click="editingCard = 'north'"
              >
                ＋ 写下我的行事准则
              </button>
            </div>

            <div v-else class="north-star-editor">
              <label class="field-block">
                <span>人生格言</span>
                <textarea
                  v-model.trim="draft.motto"
                  rows="2"
                  maxlength="240"
                  placeholder="例如：保持长期主义，但认真生活在今天。"
                ></textarea>
              </label>

              <label class="field-block">
                <span>我想成为怎样的人</span>
                <textarea
                  v-model.trim="draft.identity"
                  rows="3"
                  maxlength="600"
                  placeholder="例如：我希望成为一个有节奏、有判断力，能照顾好自己和身边人的人。"
                ></textarea>
              </label>

              <div class="principle-editor">
                <div class="field-title-row">
                  <span>我的行事准则</span>

                  <button
                    type="button"
                    @click="addPrinciple"
                  >
                    ＋ 添加
                  </button>
                </div>

                <div
                  v-for="(item, index) in draft.principles"
                  :key="item.id"
                  class="principle-editor-row"
                >
                  <span>
                    {{ String(index + 1).padStart(2, "0") }}
                  </span>

                  <input
                    v-model.trim="item.text"
                    type="text"
                    maxlength="120"
                    placeholder="写下一条长期坚持的原则"
                  />

                  <button
                    type="button"
                    aria-label="删除准则"
                    @click="
                      draft.principles.splice(index, 1)
                    "
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          </article>

          <!-- 一年和五年愿景 -->
          <section class="horizon-grid">
            <article
              v-for="meta in horizonCards"
              :key="meta.key"
              class="life-card horizon-card"
              :class="[
                `horizon-${meta.tone}`,
                {
                  editing: editingCard === meta.key,
                },
              ]"
            >
              <header class="card-header">
                <div>
                  <span class="card-eyebrow">
                    {{ meta.eyebrow }}
                  </span>
                  <h3>{{ meta.title }}</h3>
                </div>

                <button
                  type="button"
                  class="card-action"
                  @click="toggleEditor(meta.key)"
                >
                  <i
                    :class="
                      editingCard === meta.key
                        ? 'bi-check-lg'
                        : 'bi-pencil'
                    "
                  ></i>
                  {{
                    editingCard === meta.key
                      ? "完成"
                      : "编辑"
                  }}
                </button>
              </header>

              <template v-if="editingCard !== meta.key">
                <p
                  class="vision-text"
                  :class="{
                    empty: !draft[meta.key].vision,
                  }"
                >
                  {{
                    draft[meta.key].vision ||
                    meta.placeholder
                  }}
                </p>

                <div class="horizon-status">
                  <span>
                    目标
                    {{ completedGoalCount(meta.key) }}
                    /
                    {{ draft[meta.key].goals.length }}
                  </span>

                  <time>
                    {{
                      formatTargetDate(
                        draft[meta.key].targetDate
                      )
                    }}
                  </time>
                </div>

                <div
                  class="goal-progress"
                  role="progressbar"
                  :aria-valuenow="
                    horizonProgress(meta.key)
                  "
                  aria-valuemin="0"
                  aria-valuemax="100"
                >
                  <i
                    :style="{
                      width: `${horizonProgress(
                        meta.key
                      )}%`,
                    }"
                  ></i>
                </div>

                <ul
                  v-if="draft[meta.key].goals.length"
                  class="goal-display-list"
                >
                  <li
                    v-for="goal in draft[
                      meta.key
                    ].goals.slice(0, 3)"
                    :key="goal.id"
                    :class="{ completed: goal.done }"
                  >
                    <label>
                      <input
                        v-model="goal.done"
                        type="checkbox"
                      />
                      <i></i>
                    </label>

                    <span>{{ goal.title || "未命名目标" }}</span>
                  </li>
                </ul>

                <button
                  v-else
                  type="button"
                  class="empty-action"
                  @click="editingCard = meta.key"
                >
                  ＋ 写下第一个目标
                </button>

                <p
                  v-if="
                    draft[meta.key].goals.length > 3
                  "
                  class="more-goals"
                >
                  还有
                  {{
                    draft[meta.key].goals.length - 3
                  }}
                  个目标
                </p>

                <div
                  v-if="horizonNextAction(meta.key)"
                  class="next-step"
                >
                  <span>现在的第一步</span>
                  <p>
                    {{ horizonNextAction(meta.key) }}
                  </p>
                </div>
              </template>

              <div v-else class="horizon-editor">
                <label class="target-date-field">
                  <span>目标日期</span>
                  <input
                    v-model="
                      draft[meta.key].targetDate
                    "
                    type="date"
                  />
                </label>

                <label class="field-block">
                  <span>未来图景</span>
                  <textarea
                    v-model.trim="
                      draft[meta.key].vision
                    "
                    rows="4"
                    maxlength="1200"
                    :placeholder="meta.placeholder"
                  ></textarea>
                </label>

                <div class="goal-editor-heading">
                  <span>关键目标</span>

                  <button
                    type="button"
                    @click="addGoal(meta.key)"
                  >
                    ＋ 添加目标
                  </button>
                </div>

                <div
                  v-if="draft[meta.key].goals.length"
                  class="goal-editor-list"
                >
                  <section
                    v-for="(
                      goal, index
                    ) in draft[meta.key].goals"
                    :key="goal.id"
                    class="goal-editor-card"
                  >
                    <div class="goal-editor-title">
                      <label>
                        <input
                          v-model="goal.done"
                          type="checkbox"
                        />
                        <i></i>
                      </label>

                      <input
                        v-model.trim="goal.title"
                        type="text"
                        maxlength="100"
                        placeholder="目标名称"
                      />

                      <button
                        type="button"
                        aria-label="删除目标"
                        @click="
                          draft[meta.key].goals.splice(
                            index,
                            1
                          )
                        "
                      >
                        ×
                      </button>
                    </div>

                    <label>
                      <span>做到什么算完成</span>
                      <input
                        v-model.trim="goal.evidence"
                        type="text"
                        maxlength="180"
                        placeholder="写下可以验证的完成标准"
                      />
                    </label>

                    <label>
                      <span>现在的第一步</span>
                      <input
                        v-model.trim="goal.firstStep"
                        type="text"
                        maxlength="180"
                        placeholder="写下一周内可以开始的动作"
                      />
                    </label>
                  </section>
                </div>

                <div v-else class="editor-empty">
                  暂时没有目标。建议先写下真正重要的
                  1～3 个。
                </div>
              </div>
            </article>
          </section>

          <!-- 阶段印记 -->
          <article class="life-card review-card">
            <header class="card-header">
              <div>
                <span class="card-eyebrow">MILESTONES</span>
                <h3>阶段印记</h3>
              </div>

              <button
                type="button"
                class="card-action"
                @click="
                  reviewComposerVisible =
                    !reviewComposerVisible
                "
              >
                <i
                  :class="
                    reviewComposerVisible
                      ? 'bi-chevron-up'
                      : 'bi-plus-lg'
                  "
                ></i>
                {{
                  reviewComposerVisible
                    ? "收起"
                    : "记录这一刻"
                }}
              </button>
            </header>

            <div
              v-if="reviewComposerVisible"
              class="review-composer"
            >
              <div class="review-compose-row">
                <input
                  v-model="reviewDraft.date"
                  type="date"
                />

                <input
                  v-model.trim="reviewDraft.title"
                  type="text"
                  maxlength="60"
                  placeholder="这一阶段发生了什么"
                />
              </div>

              <textarea
                v-model.trim="reviewDraft.content"
                rows="3"
                maxlength="1000"
                placeholder="记录变化、偏离、新的理解，以及下一阶段想继续坚持的事情。"
              ></textarea>

              <button
                type="button"
                class="review-submit"
                @click="addReview"
              >
                保存这条印记
              </button>
            </div>

            <div
              v-if="visibleReviews.length"
              class="review-list"
            >
              <section
                v-for="review in visibleReviews"
                :key="review.id"
              >
                <time>
                  {{ formatReviewDate(review.date) }}
                </time>

                <div>
                  <strong>
                    {{ review.title || "阶段复盘" }}
                  </strong>
                  <p>{{ review.content }}</p>
                </div>

                <button
                  type="button"
                  aria-label="删除阶段印记"
                  @click="removeReview(review.id)"
                >
                  ×
                </button>
              </section>

              <button
                v-if="sortedReviews.length > 3"
                type="button"
                class="reviews-toggle"
                @click="
                  showAllReviews = !showAllReviews
                "
              >
                {{
                  showAllReviews
                    ? "收起历史印记"
                    : `查看全部 ${sortedReviews.length} 条`
                }}
              </button>
            </div>

            <button
              v-else
              type="button"
              class="review-empty"
              @click="reviewComposerVisible = true"
            >
              <i class="bi-journal-check"></i>
              <span>还没有阶段印记</span>
              <small>
                在方向发生变化时，记录当时的理解
              </small>
            </button>
          </article>
        </main>

        <footer class="life-footer">
          <div class="footer-insight">
            <template v-if="nextAction">
              <span>当前下一步</span>
              <strong>{{ nextAction }}</strong>
            </template>

            <span v-else>
              长期愿景允许调整，重要的是持续行动
            </span>
          </div>

          <span
            v-if="isDirty"
            class="unsaved-indicator"
          >
            有未保存的修改
          </span>

          <button
            type="button"
            class="save-button"
            :disabled="!isDirty"
            @click="save"
          >
            {{
              isDirty
                ? "保存修改"
                : "已保存"
            }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<script>
import moment from "moment";
import lifeImprintRepository from "../../repositories/lifeImprintRepository";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createId(prefix) {
  return (
    prefix +
    "_" +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 7)
  );
}

export default {
  name: "LifeImprintModal",

  props: {
    visible: {
      type: Boolean,
      default: false,
    },
  },

  emits: ["close"],

  data() {
    const initial = lifeImprintRepository.load();

    return {
      draft: clone(initial),
      savedFingerprint: JSON.stringify(initial),
      editingCard: null,
      reviewComposerVisible: false,
      showAllReviews: false,

      horizonCards: [
        {
          key: "oneYear",
          eyebrow: "ONE YEAR",
          title: "1 年后的我",
          tone: "one",
          placeholder:
            "一年后，我希望自己的工作、生活和内在状态是……",
        },
        {
          key: "fiveYear",
          eyebrow: "FIVE YEARS",
          title: "5 年后的我",
          tone: "five",
          placeholder:
            "五年后，我希望自己已经建立起怎样的生活……",
        },
      ],

      reviewDraft: {
        date: moment().format("YYYY-MM-DD"),
        title: "",
        content: "",
      },
    };
  },

  computed: {
    isDirty() {
      return (
        JSON.stringify(this.draft) !==
        this.savedFingerprint
      );
    },

    visiblePrinciples() {
      return (this.draft.principles || []).filter(
        (item) => String(item.text || "").trim()
      );
    },

    sortedReviews() {
      return [...(this.draft.reviews || [])].sort(
        (a, b) =>
          new Date(b.date).getTime() -
          new Date(a.date).getTime()
      );
    },

    visibleReviews() {
      return this.showAllReviews
        ? this.sortedReviews
        : this.sortedReviews.slice(0, 3);
    },

    nextAction() {
      const goals = [
        ...(this.draft.oneYear?.goals || []),
        ...(this.draft.fiveYear?.goals || []),
      ];

      const activeGoal = goals.find(
        (goal) =>
          !goal.done &&
          String(goal.firstStep || "").trim()
      );

      return activeGoal?.firstStep || "";
    },
  },

  watch: {
    visible(value) {
      if (!value) return;

      const data = lifeImprintRepository.load();

      this.draft = clone(data);
      this.savedFingerprint = JSON.stringify(
        this.draft
      );
      this.editingCard = null;
      this.reviewComposerVisible = false;
      this.showAllReviews = false;
      this.resetReviewDraft();

      this.$nextTick(() => {
        this.$refs.backdrop?.focus();
      });
    },
  },

  methods: {
    toggleEditor(key) {
      this.editingCard =
        this.editingCard === key ? null : key;
    },

    completedGoalCount(key) {
      return (this.draft[key]?.goals || []).filter(
        (goal) => goal.done
      ).length;
    },

    horizonProgress(key) {
      const goals = this.draft[key]?.goals || [];

      if (!goals.length) return 0;

      return Math.round(
        (this.completedGoalCount(key) /
          goals.length) *
          100
      );
    },

    horizonNextAction(key) {
      const goal = (
        this.draft[key]?.goals || []
      ).find(
        (item) =>
          !item.done &&
          String(item.firstStep || "").trim()
      );

      return goal?.firstStep || "";
    },

    addPrinciple() {
      this.draft.principles.push({
        id: createId("principle"),
        text: "",
      });
    },

    addGoal(key) {
      this.draft[key].goals.push({
        id: createId("goal"),
        title: "",
        evidence: "",
        firstStep: "",
        done: false,
      });
    },

    resetReviewDraft() {
      this.reviewDraft = {
        date: moment().format("YYYY-MM-DD"),
        title: "",
        content: "",
      };
    },

    addReview() {
      if (
        !this.reviewDraft.title.trim() &&
        !this.reviewDraft.content.trim()
      ) {
        window.alert("请至少写下标题或印记内容。");
        return;
      }

      this.draft.reviews.push({
        id: createId("review"),
        date:
          this.reviewDraft.date ||
          moment().format("YYYY-MM-DD"),
        title: this.reviewDraft.title.trim(),
        content: this.reviewDraft.content.trim(),
      });

      this.resetReviewDraft();
      this.reviewComposerVisible = false;
    },

    removeReview(id) {
      if (
        !window.confirm("确定删除这条阶段印记吗？")
      ) {
        return;
      }

      this.draft.reviews =
        this.draft.reviews.filter(
          (item) => item.id !== id
        );
    },

    formatTargetDate(date) {
      if (!date) return "暂未设定日期";
      return moment(date).format("YYYY.MM.DD");
    },

    formatReviewDate(date) {
      return moment(date).format("YYYY.MM.DD");
    },

    formatUpdatedAt(value) {
      if (!value || !moment(value).isValid()) {
        return "";
      }

      const date = moment(value);
      const today = moment();

      if (date.isSame(today, "day")) {
        return "今天";
      }

      if (
        date.isSame(
          today.clone().subtract(1, "day"),
          "day"
        )
      ) {
        return "昨天";
      }

      return date.format("YYYY.MM.DD");
    },

    save() {
      const saved =
        lifeImprintRepository.update(this.draft);

      this.draft = clone(saved);
      this.savedFingerprint = JSON.stringify(
        this.draft
      );
      this.editingCard = null;
    },

    requestClose() {
      if (
        this.isDirty &&
        !window.confirm(
          "人生印记中还有未保存的修改，确定关闭吗？"
        )
      ) {
        return;
      }

      this.$emit("close");
    },
  },
};
</script>

<style scoped lang="scss">
.life-backdrop {
  position: fixed;
  z-index: 17000;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  outline: none;
  background: rgba(22, 22, 29, 0.44);
  backdrop-filter: blur(7px);
}

.life-dialog {
  display: flex;
  width: min(920px, calc(100vw - 48px));
  height: min(800px, calc(100vh - 48px));
  min-height: 600px;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(31, 35, 41, 0.1);
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 30px 90px rgba(20, 20, 30, 0.27);

  .dark-theme & {
    border-color: #343d47;
    background: #181e25;
  }
}

.life-header {
  display: flex;
  min-height: 72px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  padding: 13px 19px;
  border-bottom: 1px solid #eaedf1;
}

.life-heading,
.header-meta {
  display: flex;
  align-items: center;
}

.life-heading {
  gap: 11px;
}

.life-icon {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 12px;
  background: #f1edff;
  color: #7950c7;
  font-size: 18px;
}

.life-heading h2 {
  margin: 0;
  color: #292f37;
  font-size: 17px;
  font-weight: 650;
}

.life-heading p {
  margin: 3px 0 0;
  color: #969da7;
  font-size: 10px;
}

.header-meta {
  gap: 12px;

  > span {
    color: #a0a6ae;
    font-size: 9px;
  }
}

.close-button {
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #8a929d;
  font-size: 22px;
  cursor: pointer;

  &:hover {
    background: #eff2f5;
  }
}

.life-content {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  padding: 16px 18px 20px;
  overflow-y: auto;
  background: #f7f8fa;
}

.life-card {
  padding: 15px 16px;
  border: 1px solid #e5e8ec;
  border-radius: 13px;
  background: #fff;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease;

  &.editing {
    border-color: #c9b9ec;
    box-shadow: 0 8px 24px rgba(91, 64, 148, 0.07);
  }
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;

  h3 {
    margin: 2px 0 0;
    color: #3c434c;
    font-size: 13px;
    font-weight: 650;
  }
}

.card-eyebrow {
  color: #a39aaa;
  font-size: 7px;
  letter-spacing: 0.15em;
}

.card-action {
  display: inline-flex;
  height: 28px;
  align-items: center;
  gap: 5px;
  padding: 0 8px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #7f6aac;
  font-size: 9px;
  cursor: pointer;

  &:hover {
    background: #f3effc;
  }
}

.north-star-card {
  position: relative;
  overflow: hidden;

  &::after {
    position: absolute;
    top: -65px;
    right: -65px;
    width: 150px;
    height: 150px;
    border-radius: 50%;
    background: radial-gradient(
      circle,
      rgba(121, 80, 199, 0.08),
      transparent 68%
    );
    content: "";
    pointer-events: none;
  }
}

.north-star-display {
  padding: 9px 4px 2px;

  blockquote {
    margin: 0;
    color: #4f3c72;
    font-size: 17px;
    font-weight: 600;
    line-height: 1.6;

    &::before {
      color: #b8a5dd;
      content: "“";
    }

    &::after {
      color: #b8a5dd;
      content: "”";
    }
  }
}

.identity-text {
  max-width: 720px;
  margin: 8px 0 0;
  color: #6f7680;
  font-size: 11px;
  line-height: 1.75;
  white-space: pre-wrap;

  &.empty {
    color: #aaaeb5;
  }
}

.principle-display-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 14px;
  margin: 13px 0 0;
  padding: 0;
  list-style: none;

  li {
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr);
    align-items: baseline;
    gap: 6px;
  }

  span {
    color: #a995cf;
    font-size: 8px;
    font-variant-numeric: tabular-nums;
  }

  p {
    margin: 0;
    color: #585f68;
    font-size: 10px;
    line-height: 1.55;
  }
}

.north-star-editor {
  display: grid;
  grid-template-columns: 1fr 1.25fr;
  gap: 11px 13px;
  margin-top: 12px;

  .principle-editor {
    grid-column: 1 / -1;
  }
}

.field-block {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 5px;

  > span {
    color: #727984;
    font-size: 9px;
    font-weight: 600;
  }
}

textarea,
input {
  box-sizing: border-box;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  outline: none;
  background: #fff;
  color: #353c45;
  font-family: inherit;
  font-size: 10px;

  &:focus {
    border-color: #a894d5;
    box-shadow: 0 0 0 3px rgba(121, 80, 199, 0.07);
  }
}

textarea {
  width: 100%;
  padding: 8px 9px;
  line-height: 1.65;
  resize: vertical;
}

input {
  height: 32px;
  padding: 0 8px;
}

.field-title-row,
.goal-editor-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;

  > span {
    color: #727984;
    font-size: 9px;
    font-weight: 600;
  }

  button {
    border: 0;
    background: transparent;
    color: #7950c7;
    font-size: 9px;
    cursor: pointer;
  }
}

.principle-editor-row {
  display: grid;
  grid-template-columns: 25px minmax(0, 1fr) 22px;
  align-items: center;
  gap: 6px;
  margin-top: 5px;

  > span {
    color: #aa98cd;
    font-size: 8px;
  }

  > button {
    border: 0;
    background: transparent;
    color: #9da3ab;
    cursor: pointer;
  }
}

.horizon-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.horizon-card {
  position: relative;
  min-width: 0;

  &::before {
    position: absolute;
    top: 0;
    right: 16px;
    left: 16px;
    height: 2px;
    border-radius: 0 0 3px 3px;
    content: "";
  }
}

.horizon-one::before {
  background: #748ffc;
}

.horizon-five::before {
  background: #b197fc;
}

.vision-text {
  min-height: 52px;
  margin: 11px 0 0;
  display: -webkit-box;
  overflow: hidden;
  color: #555d67;
  font-size: 11px;
  line-height: 1.65;
  white-space: pre-wrap;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;

  &.empty {
    color: #a0a5ad;
  }
}

.horizon-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
  color: #8e959e;
  font-size: 8px;
}

.goal-progress {
  height: 4px;
  margin-top: 5px;
  overflow: hidden;
  border-radius: 999px;
  background: #edf0f3;

  i {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: #7950c7;
    transition: width 0.2s ease;
  }
}

.goal-display-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 11px 0 0;
  padding: 0;
  list-style: none;

  li {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 7px;
  }

  li > span {
    overflow: hidden;
    color: #565e68;
    font-size: 10px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  li.completed > span {
    color: #a0a5ac;
    text-decoration: line-through;
  }

  label {
    display: flex;
    flex: 0 0 auto;
    cursor: pointer;
  }

  input {
    display: none;
  }

  label i {
    display: grid;
    width: 13px;
    height: 13px;
    place-items: center;
    border: 1px solid #c8cdd4;
    border-radius: 50%;
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

.more-goals {
  margin: 7px 0 0 20px;
  color: #a0a5ad;
  font-size: 8px;
}

.empty-action {
  margin-top: 11px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #7950c7;
  font-size: 9px;
  cursor: pointer;
}

.next-step {
  margin-top: 11px;
  padding: 8px 9px;
  border-radius: 8px;
  background: #f7f5fb;

  span {
    color: #9a8cab;
    font-size: 7px;
  }

  p {
    margin: 2px 0 0;
    overflow: hidden;
    color: #61566f;
    font-size: 9px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.horizon-editor {
  margin-top: 11px;
}

.target-date-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 9px;

  span {
    color: #727984;
    font-size: 9px;
    font-weight: 600;
  }

  input {
    width: 145px;
  }
}

.goal-editor-heading {
  margin-top: 12px;
}

.goal-editor-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.goal-editor-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border: 1px solid #e7e9ed;
  border-radius: 8px;
  background: #fafbfc;

  > label {
    display: flex;
    flex-direction: column;
    gap: 3px;

    span {
      color: #979da6;
      font-size: 7px;
    }
  }
}

.goal-editor-title {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) 20px;
  align-items: center;
  gap: 5px;

  label {
    display: flex;
  }

  label input {
    width: 13px;
    height: 13px;
  }

  > button {
    border: 0;
    background: transparent;
    color: #9ba1aa;
    cursor: pointer;
  }
}

.editor-empty {
  padding: 13px;
  border: 1px dashed #dfe3e8;
  border-radius: 8px;
  color: #9ca2aa;
  font-size: 9px;
  line-height: 1.6;
  text-align: center;
}

.review-composer {
  margin-top: 11px;
  padding: 10px;
  border: 1px solid #e2dcef;
  border-radius: 9px;
  background: #faf8ff;
}

.review-compose-row {
  display: grid;
  grid-template-columns: 145px minmax(0, 1fr);
  gap: 7px;
  margin-bottom: 7px;
}

.review-submit {
  display: block;
  height: 30px;
  margin: 7px 0 0 auto;
  padding: 0 11px;
  border: 1px solid #7950c7;
  border-radius: 7px;
  background: #7950c7;
  color: #fff;
  font-size: 9px;
  cursor: pointer;
}

.review-list {
  margin-top: 9px;

  > section {
    display: grid;
    grid-template-columns: 76px minmax(0, 1fr) 22px;
    gap: 9px;
    padding: 9px 2px;
    border-top: 1px solid #edf0f2;
  }

  time {
    padding-top: 2px;
    color: #9c8eb1;
    font-size: 8px;
    font-variant-numeric: tabular-nums;
  }

  section > div {
    min-width: 0;
  }

  strong {
    display: block;
    color: #4e555f;
    font-size: 10px;
  }

  p {
    margin: 3px 0 0;
    color: #747c86;
    font-size: 9px;
    line-height: 1.6;
    white-space: pre-wrap;
  }

  section > button {
    border: 0;
    background: transparent;
    color: #a0a6ae;
    cursor: pointer;
  }
}

.reviews-toggle {
  display: block;
  margin: 7px auto 0;
  border: 0;
  background: transparent;
  color: #7950c7;
  font-size: 9px;
  cursor: pointer;
}

.review-empty {
  display: flex;
  width: 100%;
  min-height: 82px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 3px;
  margin-top: 8px;
  border: 1px dashed #e1e4e8;
  border-radius: 9px;
  background: transparent;
  color: #9299a2;
  cursor: pointer;

  i {
    margin-bottom: 2px;
    color: #a994d5;
    font-size: 18px;
  }

  span {
    font-size: 10px;
  }

  small {
    color: #afb3b9;
    font-size: 8px;
  }

  &:hover {
    border-color: #cbbde7;
    background: #faf8ff;
  }
}

.life-footer {
  display: flex;
  min-height: 58px;
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;
  padding: 9px 18px;
  border-top: 1px solid #e9ecef;
  background: #fff;
}

.footer-insight {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;

  span {
    color: #999fa8;
    font-size: 8px;
  }

  strong {
    overflow: hidden;
    color: #555d67;
    font-size: 10px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.unsaved-indicator {
  color: #a1833e;
  font-size: 8px;
}

.save-button {
  min-width: 84px;
  height: 33px;
  border: 1px solid #7950c7;
  border-radius: 7px;
  background: #7950c7;
  color: #fff;
  font-size: 10px;
  cursor: pointer;

  &:disabled {
    border-color: #e1e4e8;
    background: #f1f3f5;
    color: #9da3ab;
    cursor: default;
  }
}

.dark-theme {
  .life-header,
  .life-footer {
    border-color: #303842;
    background: #181e25;
  }

  .life-heading h2,
  .card-header h3,
  .north-star-display blockquote,
  .review-list strong,
  .footer-insight strong {
    color: #dce1e7;
  }

  .life-content {
    background: #151a20;
  }

  .life-card,
  .goal-editor-card {
    border-color: #303842;
    background: #1d232b;
  }

  .life-card.editing {
    border-color: #66518d;
  }

  .life-icon,
  .principle-display-list span {
    background: #302744;
    color: #baa3ed;
  }

  .identity-text,
  .principle-display-list p,
  .vision-text,
  .goal-display-list li > span,
  .review-list p {
    color: #adb4bd;
  }

  textarea,
  input {
    border-color: #36404a;
    background: #20262e;
    color: #d8dde3;
    color-scheme: dark;
  }

  .goal-progress {
    background: #2d353e;
  }

  .next-step {
    background: #282331;

    p {
      color: #c5b9d3;
    }
  }

  .goal-editor-card {
    background: #1a2027;
  }

  .review-composer {
    border-color: #473b5c;
    background: #211d29;
  }

  .review-list > section {
    border-color: #303842;
  }

  .review-empty {
    border-color: #353d47;

    &:hover {
      border-color: #5f4c82;
      background: #211d29;
    }
  }

  .close-button:hover,
  .card-action:hover {
    background: #272e37;
  }

  .save-button:disabled {
    border-color: #343c45;
    background: #252c34;
    color: #737b84;
  }
}

@media (max-width: 760px) {
  .life-dialog {
    min-width: 700px;
  }

  .life-backdrop {
    justify-content: start;
    overflow-x: auto;
  }
}
</style>
