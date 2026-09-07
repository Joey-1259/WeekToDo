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
              <p>定义想成为的人，让长期愿景落在当下</p>
            </div>
          </div>

          <button
            type="button"
            class="close-button"
            aria-label="关闭人生印记"
            title="关闭"
            @click="requestClose"
          >
            ×
          </button>
        </header>

        <div class="life-overview">
          <div class="motto-card">
            <span>我的人生格言</span>
            <strong>
              {{
                draft.motto ||
                "写下一句话，在重要选择面前提醒自己"
              }}
            </strong>
          </div>

          <div class="progress-card">
            <span>1 年目标</span>
            <strong>{{ horizonProgress("oneYear") }}%</strong>
            <i>
              <b
                :style="{
                  width: `${horizonProgress(
                    'oneYear'
                  )}%`,
                }"
              ></b>
            </i>
          </div>

          <div class="progress-card">
            <span>5 年目标</span>
            <strong>{{ horizonProgress("fiveYear") }}%</strong>
            <i>
              <b
                :style="{
                  width: `${horizonProgress(
                    'fiveYear'
                  )}%`,
                }"
              ></b>
            </i>
          </div>
        </div>

        <nav class="life-tabs" aria-label="人生印记导航">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            :class="{ active: activeTab === tab.id }"
            @click="activeTab = tab.id"
          >
            <i :class="tab.icon"></i>
            {{ tab.name }}
          </button>
        </nav>

        <main class="life-content">
          <section
            v-if="activeTab === 'north'"
            class="north-star-view"
          >
            <div class="form-card hero-form">
              <div class="card-heading">
                <div>
                  <strong>人生格言</strong>
                  <span>
                    它不是写给别人看的，而是你的决策准则
                  </span>
                </div>
              </div>

              <textarea
                v-model.trim="draft.motto"
                rows="3"
                maxlength="240"
                placeholder="例如：保持长期主义，但认真生活在今天。"
              ></textarea>
            </div>

            <div class="form-card">
              <div class="card-heading">
                <div>
                  <strong>我想成为怎样的人</strong>
                  <span>
                    使用身份描述，而不是只写职位或资产数字
                  </span>
                </div>
              </div>

              <textarea
                v-model.trim="draft.identity"
                rows="4"
                maxlength="600"
                placeholder="例如：我希望成为一个有节奏、有判断力，能照顾好自己和身边人的人。"
              ></textarea>
            </div>

            <div class="form-card">
              <div class="card-heading">
                <div>
                  <strong>我的行事原则</strong>
                  <span>
                    建议保留 3～7 条，数量太多会失去约束力
                  </span>
                </div>

                <button
                  type="button"
                  class="text-button"
                  @click="addPrinciple"
                >
                  ＋ 添加原则
                </button>
              </div>

              <div class="principle-list">
                <div
                  v-for="(item, index) in draft.principles"
                  :key="item.id"
                  class="principle-row"
                >
                  <span>{{ index + 1 }}</span>

                  <input
                    v-model.trim="item.text"
                    type="text"
                    maxlength="120"
                    placeholder="写下一条长期坚持的原则"
                  />

                  <button
                    type="button"
                    aria-label="删除原则"
                    @click="
                      draft.principles.splice(index, 1)
                    "
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section
            v-else-if="
              activeTab === 'one' ||
              activeTab === 'five'
            "
            class="horizon-view"
          >
            <div class="horizon-banner">
              <div>
                <span>
                  {{
                    activeTab === "one"
                      ? "ONE YEAR"
                      : "FIVE YEARS"
                  }}
                </span>
                <strong>
                  {{
                    activeTab === "one"
                      ? "1 年后的我"
                      : "5 年后的我"
                  }}
                </strong>
                <p>
                  {{
                    activeTab === "one"
                      ? "聚焦未来一年可以验证的改变"
                      : "描绘方向，不要求预测所有细节"
                  }}
                </p>
              </div>

              <label>
                <span>目标日期</span>
                <input
                  v-model="currentHorizon.targetDate"
                  type="date"
                />
              </label>
            </div>

            <div class="form-card">
              <div class="card-heading">
                <div>
                  <strong>未来图景</strong>
                  <span>
                    描述那时的工作、生活、关系与内在状态
                  </span>
                </div>
              </div>

              <textarea
                v-model.trim="currentHorizon.vision"
                rows="5"
                maxlength="1200"
                :placeholder="
                  activeTab === 'one'
                    ? '一年后，我希望自己的日常状态是……'
                    : '五年后，我希望自己已经建立起……'
                "
              ></textarea>
            </div>

            <div class="form-card">
              <div class="card-heading">
                <div>
                  <strong>关键目标</strong>
                  <span>
                    每个目标都需要验证标准和一个现实的下一步
                  </span>
                </div>

                <button
                  type="button"
                  class="text-button"
                  @click="addGoal"
                >
                  ＋ 添加目标
                </button>
              </div>

              <div
                v-if="currentHorizon.goals.length"
                class="goal-list"
              >
                <article
                  v-for="(goal, index) in currentHorizon.goals"
                  :key="goal.id"
                  class="goal-card"
                  :class="{ completed: goal.done }"
                >
                  <label class="goal-check">
                    <input
                      v-model="goal.done"
                      type="checkbox"
                    />
                    <span></span>
                  </label>

                  <div class="goal-fields">
                    <input
                      v-model.trim="goal.title"
                      class="goal-title"
                      type="text"
                      maxlength="100"
                      placeholder="目标名称"
                    />

                    <div class="goal-detail-grid">
                      <label>
                        <span>做到什么算完成</span>
                        <input
                          v-model.trim="goal.evidence"
                          type="text"
                          maxlength="180"
                          placeholder="可观察、可验证的完成标准"
                        />
                      </label>

                      <label>
                        <span>现在的第一步</span>
                        <input
                          v-model.trim="goal.firstStep"
                          type="text"
                          maxlength="180"
                          placeholder="一周内可以开始的动作"
                        />
                      </label>
                    </div>
                  </div>

                  <button
                    type="button"
                    class="goal-remove"
                    aria-label="删除目标"
                    @click="
                      currentHorizon.goals.splice(index, 1)
                    "
                  >
                    ×
                  </button>
                </article>
              </div>

              <div v-else class="goal-empty">
                不需要一次写满所有人生领域。先写下真正重要的
                1～3 个目标。
              </div>
            </div>
          </section>

          <section v-else class="review-view">
            <div class="review-compose">
              <div class="card-heading">
                <div>
                  <strong>写下阶段印记</strong>
                  <span>
                    记录变化、偏离与新的理解，不只记录成功
                  </span>
                </div>
              </div>

              <div class="review-compose-row">
                <input
                  v-model="reviewDraft.date"
                  type="date"
                />

                <input
                  v-model.trim="reviewDraft.title"
                  type="text"
                  maxlength="60"
                  placeholder="这次复盘的标题"
                />
              </div>

              <textarea
                v-model.trim="reviewDraft.content"
                rows="4"
                maxlength="1000"
                placeholder="最近发生了什么？哪些方向依然重要？下一阶段需要调整什么？"
              ></textarea>

              <button
                type="button"
                class="review-add"
                @click="addReview"
              >
                记录这次印记
              </button>
            </div>

            <div
              v-if="sortedReviews.length"
              class="review-timeline"
            >
              <article
                v-for="review in sortedReviews"
                :key="review.id"
              >
                <i></i>

                <div>
                  <time>{{ formatReviewDate(review.date) }}</time>
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
              </article>
            </div>

            <div v-else class="review-empty">
              <i class="bi-journal-check"></i>
              <strong>还没有阶段印记</strong>
              <span>
                建议每季度或人生发生明显变化时记录一次
              </span>
            </div>
          </section>
        </main>

        <footer class="life-footer">
          <div>
            <strong v-if="nextAction">
              当前下一步：{{ nextAction }}
            </strong>
            <span v-else>
              长期愿景允许调整，重要的是保持诚实和持续行动
            </span>
          </div>

          <button
            type="button"
            class="secondary-button"
            @click="requestClose"
          >
            取消
          </button>

          <button
            type="button"
            class="primary-button"
            @click="save"
          >
            保存人生规划
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
      activeTab: "north",
      draft: clone(initial),
      savedFingerprint: JSON.stringify(initial),
      reviewDraft: {
        date: moment().format("YYYY-MM-DD"),
        title: "",
        content: "",
      },
      tabs: [
        {
          id: "north",
          name: "人生北极星",
          icon: "bi-compass",
        },
        {
          id: "one",
          name: "1 年后的我",
          icon: "bi-calendar-check",
        },
        {
          id: "five",
          name: "5 年后的我",
          icon: "bi-stars",
        },
        {
          id: "reviews",
          name: "阶段印记",
          icon: "bi-journal-text",
        },
      ],
    };
  },

  computed: {
    currentHorizon() {
      return this.activeTab === "one"
        ? this.draft.oneYear
        : this.draft.fiveYear;
    },

    sortedReviews() {
      return [...this.draft.reviews].sort(
        (a, b) =>
          new Date(b.date).getTime() -
          new Date(a.date).getTime()
      );
    },

    isDirty() {
      return (
        JSON.stringify(this.draft) !==
        this.savedFingerprint
      );
    },

    nextAction() {
      const goals = [
        ...(this.draft.oneYear?.goals || []),
        ...(this.draft.fiveYear?.goals || []),
      ];

      const goal = goals.find(
        (item) =>
          !item.done && String(item.firstStep || "").trim()
      );

      return goal?.firstStep || "";
    },
  },

  watch: {
    visible(value) {
      if (!value) return;

      const data = lifeImprintRepository.load();
      this.draft = clone(data);
      this.savedFingerprint = JSON.stringify(this.draft);
      this.activeTab = "north";

      this.$nextTick(() => {
        this.$refs.backdrop?.focus();
      });
    },
  },

  methods: {
    horizonProgress(key) {
      const goals = this.draft[key]?.goals || [];

      if (!goals.length) return 0;

      const completed = goals.filter(
        (goal) => goal.done
      ).length;

      return Math.round(
        (completed / goals.length) * 100
      );
    },

    addPrinciple() {
      this.draft.principles.push({
        id: createId("principle"),
        text: "",
      });
    },

    addGoal() {
      this.currentHorizon.goals.push({
        id: createId("goal"),
        title: "",
        evidence: "",
        firstStep: "",
        done: false,
      });
    },

    addReview() {
      if (
        !this.reviewDraft.title.trim() &&
        !this.reviewDraft.content.trim()
      ) {
        window.alert("请至少写下标题或复盘内容。");
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

      this.reviewDraft = {
        date: moment().format("YYYY-MM-DD"),
        title: "",
        content: "",
      };
    },

    removeReview(id) {
      if (!window.confirm("确定删除这条阶段印记吗？")) {
        return;
      }

      this.draft.reviews = this.draft.reviews.filter(
        (item) => item.id !== id
      );
    },

    formatReviewDate(date) {
      return moment(date).format("YYYY年M月D日");
    },

    save() {
      const saved = lifeImprintRepository.update(
        this.draft
      );

      this.draft = clone(saved);
      this.savedFingerprint = JSON.stringify(this.draft);
    },

    requestClose() {
      if (
        this.isDirty &&
        !window.confirm("人生规划尚未保存，确定放弃修改吗？")
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
  background: rgba(24, 22, 32, 0.46);
  backdrop-filter: blur(7px);
}

.life-dialog {
  display: flex;
  width: min(960px, calc(100vw - 48px));
  height: min(780px, calc(100vh - 48px));
  min-height: 600px;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(31, 35, 41, 0.1);
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 30px 90px rgba(20, 20, 30, 0.28);

  .dark-theme & {
    border-color: #343d47;
    background: #181e25;
  }
}

.life-header,
.life-heading,
.life-footer,
.card-heading,
.horizon-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.life-header {
  min-height: 76px;
  padding: 15px 20px;
  border-bottom: 1px solid #eaedf1;
}

.life-heading {
  justify-content: flex-start;
  gap: 12px;
}

.life-icon {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 12px;
  background: linear-gradient(
    145deg,
    #f1edff,
    #fff0f5
  );
  color: #7950c7;
  font-size: 19px;
}

h2 {
  margin: 0;
  color: #292f37;
  font-size: 18px;
}

.life-heading p,
.horizon-banner p {
  margin: 4px 0 0;
  color: #969da7;
  font-size: 11px;
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

.life-overview {
  display: grid;
  grid-template-columns: minmax(0, 2fr) 1fr 1fr;
  gap: 9px;
  padding: 12px 20px;
}

.motto-card,
.progress-card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 5px;
  padding: 10px 12px;
  border: 1px solid #e8ebef;
  border-radius: 10px;
  background: #fafbfc;

  > span {
    color: #969da7;
    font-size: 9px;
  }

  > strong {
    overflow: hidden;
    color: #3f4650;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.motto-card {
  border-color: #ded5f5;
  background: linear-gradient(
    135deg,
    #f7f4ff,
    #fff8fb
  );
}

.progress-card i {
  height: 5px;
  overflow: hidden;
  border-radius: 999px;
  background: #e9ecf0;

  b {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(
      90deg,
      #7950c7,
      #b197fc
    );
  }
}

.life-tabs {
  display: flex;
  gap: 5px;
  padding: 0 20px 10px;
  border-bottom: 1px solid #eceff2;

  button {
    display: inline-flex;
    min-height: 33px;
    align-items: center;
    gap: 6px;
    padding: 0 12px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: #747c86;
    font-size: 11px;
    cursor: pointer;

    &:hover {
      background: #f1f3f6;
    }

    &.active {
      background: #f0edff;
      color: #7048bd;
      font-weight: 600;
    }
  }
}

.life-content {
  min-height: 0;
  flex: 1;
  padding: 17px 20px;
  overflow-y: auto;
  background: #fafbfc;
}

.north-star-view,
.horizon-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-card,
.review-compose {
  padding: 14px;
  border: 1px solid #e5e9ed;
  border-radius: 11px;
  background: #fff;
}

.hero-form {
  border-color: #ddd3f5;
  box-shadow: 0 7px 20px rgba(92, 63, 150, 0.05);
}

.card-heading {
  margin-bottom: 9px;

  > div {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  strong {
    color: #424953;
    font-size: 12px;
  }

  span {
    color: #9aa1aa;
    font-size: 9px;
  }
}

textarea,
input {
  box-sizing: border-box;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  outline: none;
  background: #fff;
  color: #343b44;
  font-family: inherit;
  font-size: 11px;

  &:focus {
    border-color: #a692dc;
    box-shadow: 0 0 0 3px rgba(121, 80, 199, 0.08);
  }
}

textarea {
  width: 100%;
  padding: 9px 10px;
  line-height: 1.7;
  resize: vertical;
}

input {
  height: 34px;
  padding: 0 9px;
}

.text-button {
  border: 0;
  background: transparent;
  color: #7048bd;
  font-size: 10px;
  cursor: pointer;
}

.principle-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.principle-row {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr) 24px;
  align-items: center;
  gap: 6px;

  > span {
    display: grid;
    width: 24px;
    height: 24px;
    place-items: center;
    border-radius: 7px;
    background: #f0edff;
    color: #7048bd;
    font-size: 9px;
  }

  button {
    border: 0;
    background: transparent;
    color: #9ba1aa;
    cursor: pointer;
  }
}

.horizon-banner {
  padding: 15px 17px;
  border-radius: 12px;
  background: linear-gradient(
    135deg,
    #6253b7,
    #9674d4
  );
  color: #fff;

  > div {
    display: flex;
    flex-direction: column;
  }

  > div > span {
    color: rgba(255, 255, 255, 0.65);
    font-size: 8px;
    letter-spacing: 0.16em;
  }

  > div > strong {
    margin-top: 3px;
    font-size: 17px;
  }

  p {
    color: rgba(255, 255, 255, 0.72);
  }

  label {
    display: flex;
    align-items: flex-end;
    flex-direction: column;
    gap: 4px;
    color: rgba(255, 255, 255, 0.72);
    font-size: 8px;
  }

  input {
    border-color: rgba(255, 255, 255, 0.28);
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
    color-scheme: dark;
  }
}

.goal-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.goal-card {
  display: grid;
  grid-template-columns: 25px minmax(0, 1fr) 24px;
  align-items: flex-start;
  gap: 7px;
  padding: 10px;
  border: 1px solid #e7e9ed;
  border-radius: 9px;
  background: #fcfcfd;

  &.completed {
    opacity: 0.65;

    .goal-title {
      text-decoration: line-through;
    }
  }
}

.goal-check {
  display: grid;
  padding-top: 7px;
  place-items: center;
}

.goal-fields {
  min-width: 0;
}

.goal-title {
  width: 100%;
  font-weight: 600;
}

.goal-detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px;
  margin-top: 7px;

  label {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 4px;
  }

  span {
    color: #999fa8;
    font-size: 8px;
  }

  input {
    width: 100%;
  }
}

.goal-remove,
.review-timeline article > button {
  border: 0;
  background: transparent;
  color: #9aa1aa;
  cursor: pointer;
}

.goal-empty,
.review-empty {
  display: flex;
  min-height: 90px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 5px;
  color: #9ca2ab;
  font-size: 10px;
  text-align: center;
}

.review-compose-row {
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr);
  gap: 8px;
  margin-bottom: 8px;
}

.review-add {
  display: block;
  height: 32px;
  margin: 9px 0 0 auto;
  padding: 0 13px;
  border: 1px solid #7048bd;
  border-radius: 7px;
  background: #7048bd;
  color: #fff;
  font-size: 10px;
  cursor: pointer;
}

.review-timeline {
  position: relative;
  margin-top: 15px;
  padding-left: 12px;

  &::before {
    position: absolute;
    top: 8px;
    bottom: 8px;
    left: 17px;
    width: 1px;
    background: #dcd5ed;
    content: "";
  }

  article {
    position: relative;
    display: grid;
    grid-template-columns: 12px minmax(0, 1fr) 24px;
    gap: 10px;
    padding: 8px 0 14px;
  }

  article > i {
    z-index: 1;
    width: 11px;
    height: 11px;
    margin-top: 3px;
    border: 3px solid #8c6bcc;
    border-radius: 50%;
    background: #fff;
  }

  article > div {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  time {
    color: #9b91b4;
    font-size: 8px;
  }

  strong {
    color: #454c55;
    font-size: 11px;
  }

  p {
    margin: 1px 0 0;
    color: #747c86;
    font-size: 10px;
    line-height: 1.65;
    white-space: pre-wrap;
  }
}

.life-footer {
  min-height: 61px;
  gap: 8px;
  padding: 10px 18px;
  border-top: 1px solid #e8ebef;

  > div {
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
    gap: 2px;
  }

  strong {
    overflow: hidden;
    color: #555d68;
    font-size: 10px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    color: #999fa8;
    font-size: 9px;
  }
}

.primary-button,
.secondary-button {
  min-width: 92px;
  height: 34px;
  border-radius: 7px;
  font-size: 11px;
  cursor: pointer;
}

.primary-button {
  border: 1px solid #7048bd;
  background: #7048bd;
  color: #fff;
}

.secondary-button {
  border: 1px solid #dfe3e8;
  background: #fff;
  color: #59616b;
}

.dark-theme {
  .life-header,
  .life-tabs,
  .life-footer {
    border-color: #303842;
  }

  h2,
  .motto-card strong,
  .progress-card strong,
  .card-heading strong,
  .review-timeline strong {
    color: #dce1e7;
  }

  .life-content {
    background: #151a20;
  }

  .motto-card,
  .progress-card,
  .form-card,
  .review-compose,
  .goal-card {
    border-color: #303842;
    background: #1d232b;
  }

  .motto-card {
    background: linear-gradient(
      135deg,
      #27213a,
      #2c222d
    );
  }

  .life-tabs button:hover {
    background: #252c35;
  }

  .life-tabs button.active {
    background: #302744;
    color: #b9a2ee;
  }

  textarea,
  input,
  .secondary-button {
    border-color: #36404a;
    background: #20262e;
    color: #d8dde3;
  }

  .principle-row > span {
    background: #302744;
    color: #b9a2ee;
  }

  .review-timeline article > i {
    background: #181e25;
  }

  .close-button:hover {
    background: #252c35;
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
