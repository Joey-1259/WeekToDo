<template>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="backdrop"
      class="life-backdrop"
      tabindex="-1"
      @mousedown.self="$emit('close')"
      @keydown.esc.stop.prevent="$emit('close')"
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
              <p>写给未来，也提醒现在</p>
            </div>
          </div>

          <div class="header-actions">
            <span>{{ cards.length }} 张未来卡片</span>

            <button
              type="button"
              class="create-button"
              @click="createCard"
            >
              <i class="bi-plus-lg"></i>
              新建卡片
            </button>

            <button
              type="button"
              class="close-button"
              title="关闭"
              aria-label="关闭人生印记"
              @click="$emit('close')"
            >
              ×
            </button>
          </div>
        </header>

        <main class="life-content">
          <section
            class="vision-carousel"
            role="region"
            aria-roledescription="carousel"
            aria-label="未来自我卡片"
          >
            <header class="carousel-header">
              <div>
                <span>MY FUTURE SELVES</span>
                <strong>我想成为的自己</strong>
              </div>

              <div
                v-if="totalPages > 1"
                class="carousel-controls"
              >
                <button
                  type="button"
                  :disabled="pageIndex === 0"
                  aria-label="查看上一组未来卡片"
                  @click="previousPage"
                >
                  <i class="bi-chevron-left"></i>
                </button>

                <span>
                  {{ pageIndex + 1 }} / {{ totalPages }}
                </span>

                <button
                  type="button"
                  :disabled="
                    pageIndex >= totalPages - 1
                  "
                  aria-label="查看下一组未来卡片"
                  @click="nextPage"
                >
                  <i class="bi-chevron-right"></i>
                </button>
              </div>
            </header>

            <div
              class="card-viewport"
              aria-live="polite"
              aria-atomic="false"
            >
              <article
                v-for="(card, index) in visibleCards"
                :key="card.id"
                class="vision-card"
                role="group"
                aria-roledescription="slide"
                :aria-label="
                  `${pageIndex * pageSize + index + 1} / ${
                    cards.length
                  }：${card.title}`
                "
                tabindex="0"
                @click="editCard(card)"
                @keydown.enter.prevent="editCard(card)"
                @keydown.space.prevent="editCard(card)"
              >
                <header>
                  <div>
                    <span class="year-label">
                      {{ card.targetYear }}
                    </span>
                    <small>
                      {{ relativeYearLabel(card.targetYear) }}
                    </small>
                  </div>

                </header>

                <h3>{{ card.title }}</h3>

                <p
                  class="vision-summary"
                  :class="{ empty: !card.vision }"
                >
                  {{
                    card.vision ||
                    "点击卡片，写下这个年份想成为的自己。"
                  }}
                </p>

                <div class="card-footnote">
                  编辑未来图景
                </div>
              </article>

              <button
                v-if="visibleCards.length < pageSize"
                type="button"
                class="add-card-tile"
                @click="createCard"
              >
                <i class="bi-plus-lg"></i>
                <strong>新的未来卡片</strong>
                <span>为另一个年份写下期待</span>
              </button>
            </div>

            <div
              v-if="totalPages > 1"
              class="page-dots"
              role="group"
              aria-label="选择卡片页"
            >
              <button
                v-for="page in totalPages"
                :key="page"
                type="button"
                :class="{ active: pageIndex === page - 1 }"
                :aria-label="`查看第 ${page} 页`"
                :aria-disabled="
                  pageIndex === page - 1
                    ? 'true'
                    : 'false'
                "
                @click="pageIndex = page - 1"
              ></button>
            </div>
          </section>
        </main>

        <footer class="life-footer">
          <span>
            <i class="bi-pin-angle-fill"></i>
            卡片内容保存在本机；可在编辑卡片时设置置顶
          </span>

          <strong v-if="nearestCard">
            最近目标：{{ nearestCard.targetYear }} ·
            {{ nearestCard.title }}
          </strong>
        </footer>
      </section>

      <life-vision-card-edit-modal
        :visible="editorVisible"
        :card="editingCard"
        @close="closeEditor"
        @save="saveCard"
        @remove="removeCard"
      />
    </div>
  </Teleport>
</template>

<script>
import moment from "moment";
import LifeVisionCardEditModal from "./LifeVisionCardEditModal.vue";
import lifeImprintRepository from "../../repositories/lifeImprintRepository";

export default {
  name: "LifeImprintModal",

  components: {
    LifeVisionCardEditModal,
  },

  props: {
    visible: {
      type: Boolean,
      default: false,
    },
  },

  emits: ["close"],

  data() {
    return {
      model: lifeImprintRepository.load(),
      pageIndex: 0,
      pageSize: 3,
      editorVisible: false,
      editingCard: null,
    };
  },

  computed: {
    cards() {
      return [...(this.model.cards || [])].sort(
        (a, b) => {
          if (a.pinned !== b.pinned) {
            return a.pinned ? -1 : 1;
          }

          if (a.pinned && b.pinned) {
            return (
              new Date(b.pinnedAt || 0).getTime() -
              new Date(a.pinnedAt || 0).getTime()
            );
          }

          return (
            Number(a.sortOrder || 0) -
            Number(b.sortOrder || 0)
          );
        }
      );
    },

    totalPages() {
      return Math.max(
        1,
        Math.ceil(this.cards.length / this.pageSize)
      );
    },

    visibleCards() {
      const start = this.pageIndex * this.pageSize;
      return this.cards.slice(
        start,
        start + this.pageSize
      );
    },

    nearestCard() {
      const currentYear = moment().year();

      return (
        [...this.cards]
          .filter(
            (card) =>
              Number(card.targetYear) >= currentYear
          )
          .sort(
            (a, b) =>
              Number(a.targetYear) -
              Number(b.targetYear)
          )[0] || null
      );
    },
  },

  watch: {
    visible(value) {
      if (!value) return;

      this.reload();
      this.pageIndex = 0;

      this.$nextTick(() => {
        this.$refs.backdrop?.focus();
      });
    },

    totalPages(value) {
      if (this.pageIndex >= value) {
        this.pageIndex = Math.max(0, value - 1);
      }
    },
  },

  methods: {
    reload() {
      this.model = lifeImprintRepository.load();
    },

    previousPage() {
      this.pageIndex = Math.max(
        0,
        this.pageIndex - 1
      );
    },

    nextPage() {
      this.pageIndex = Math.min(
        this.totalPages - 1,
        this.pageIndex + 1
      );
    },

    relativeYearLabel(year) {
      const distance = Number(year) - moment().year();

      if (distance === 0) return "今年";
      if (distance === 1) return "1 年后";
      if (distance > 1) return `${distance} 年后`;
      if (distance === -1) return "1 年前";

      return `${Math.abs(distance)} 年前`;
    },

    completedGoalCount(card) {
      return (card.goals || []).filter(
        (goal) => goal.done
      ).length;
    },

    progressOf(card) {
      const goals = card.goals || [];

      if (!goals.length) return 0;

      return Math.round(
        (this.completedGoalCount(card) /
          goals.length) *
          100
      );
    },

    nextActionOf(card) {
      const goal = (card.goals || []).find(
        (item) =>
          !item.done &&
          String(item.firstStep || "").trim()
      );

      return goal?.firstStep || "";
    },

    createCard() {
      this.editingCard = null;
      this.editorVisible = true;
    },

    editCard(card) {
      this.editingCard = card;
      this.editorVisible = true;
    },

    closeEditor() {
      this.editorVisible = false;
      this.editingCard = null;
    },

    saveCard(card) {
      this.model =
        lifeImprintRepository.saveCard(card);
      this.editorVisible = false;
      this.editingCard = null;

      const index = this.cards.findIndex(
        (item) => item.id === card.id
      );

      if (index >= 0) {
        this.pageIndex = Math.floor(
          index / this.pageSize
        );
      }
    },

    removeCard(id) {
      this.model =
        lifeImprintRepository.removeCard(id);
      this.editorVisible = false;
      this.editingCard = null;
    },

    togglePin(id) {
      this.model =
        lifeImprintRepository.togglePin(id);
      this.pageIndex = 0;
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
  padding: 28px;
  outline: none;
  background: rgba(22, 23, 30, 0.44);
  backdrop-filter: blur(7px);
}

.life-dialog {
  display: flex;
  width: min(1000px, calc(100vw - 56px));
  min-height: 520px;
  max-height: calc(100vh - 56px);
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(31, 35, 41, 0.09);
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
  min-height: 76px;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid #eaedf1;
}

.life-heading,
.header-actions {
  display: flex;
  align-items: center;
}

.life-heading {
  gap: 11px;
}

.life-icon {
  display: grid;
  width: 41px;
  height: 41px;
  place-items: center;
  border-radius: 12px;
  background: #f1edff;
  color: #7950c7;
  font-size: 18px;
}

.life-heading h2 {
  margin: 0;
  color: #2c323a;
  font-size: 17px;
}

.life-heading p {
  margin: 3px 0 0;
  color: #989ea7;
  font-size: 10px;
}

.header-actions {
  gap: 9px;

  > span {
    color: #9ca2aa;
    font-size: 9px;
  }
}

.create-button {
  display: inline-flex;
  height: 33px;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  border: 1px solid #7950c7;
  border-radius: 8px;
  background: #7950c7;
  color: #fff;
  font-size: 10px;
  cursor: pointer;
}

.close-button {
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #8e959e;
  font-size: 22px;
  cursor: pointer;

  &:hover {
    background: #eff2f5;
  }
}

.life-content {
  min-height: 0;
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  background: #f7f8fa;
}

.vision-carousel {
  max-width: 100%;
}

.carousel-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 12px;

  > div:first-child {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  > div:first-child span {
    color: #a297ac;
    font-size: 7px;
    letter-spacing: 0.16em;
  }

  > div:first-child strong {
    color: #414852;
    font-size: 13px;
  }
}

.carousel-controls {
  display: flex;
  align-items: center;
  gap: 7px;

  button {
    display: grid;
    width: 29px;
    height: 29px;
    place-items: center;
    border: 1px solid #dfe3e8;
    border-radius: 8px;
    background: #fff;
    color: #69717b;
    cursor: pointer;

    &:hover:not(:disabled) {
      border-color: #b7a6dc;
      color: #7950c7;
    }

    &:disabled {
      opacity: 0.35;
      cursor: default;
    }
  }

  span {
    min-width: 33px;
    color: #8e959e;
    font-size: 9px;
    text-align: center;
  }
}

.card-viewport {
  display: grid;
  min-height: 320px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.vision-card,
.add-card-tile {
  min-width: 0;
  min-height: 320px;
  border-radius: 14px;
}

.vision-card {
  position: relative;
  display: flex;
  padding: 16px;
  overflow: hidden;
  border: 1px solid #e2e6ea;
  outline: none;
  background: #fff;
  flex-direction: column;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease;

  &::before {
    position: absolute;
    top: 0;
    right: 16px;
    left: 16px;
    height: 3px;
    border-radius: 0 0 3px 3px;
    background: linear-gradient(
      90deg,
      #748ffc,
      #b197fc
    );
    content: "";
  }

  &:hover,
  &:focus-visible {
    border-color: #c7bae2;
    box-shadow: 0 12px 28px rgba(66, 50, 99, 0.09);
    transform: translateY(-2px);
  }

  > header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
  }

  > header > div {
    display: flex;
    flex-direction: column;
  }

  h3 {
    margin: 14px 0 0;
    overflow: hidden;
    color: #3d444d;
    font-size: 15px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.year-label {
  color: #7950c7;
  font-size: 19px;
  font-weight: 700;
  letter-spacing: -0.04em;
}

.vision-card header small {
  color: #9a91a8;
  font-size: 8px;
}

.pin-button {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #a0a6ae;
  cursor: pointer;

  &:hover {
    background: #f2eff8;
    color: #7950c7;
  }

  &.active {
    background: #f0ebfb;
    color: #7950c7;
  }
}

.vision-summary {
  min-height: 188px;
  margin: 9px 0 0;
  display: -webkit-box;
  overflow: hidden;
  color: #646c76;
  font-size: 10px;
  line-height: 1.75;
  white-space: pre-wrap;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 9;

  &.empty {
    color: #a5aab1;
  }
}

.goal-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 13px;
  color: #8c939c;
  font-size: 8px;

  strong {
    color: #7950c7;
    font-size: 9px;
  }
}

.progress-track {
  height: 5px;
  margin-top: 5px;
  overflow: hidden;
  border-radius: 999px;
  background: #edf0f3;

  i {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(
      90deg,
      #748ffc,
      #b197fc
    );
  }
}

.next-action {
  margin-top: auto;
  padding: 9px;
  border-radius: 8px;
  background: #f7f5fb;

  span {
    color: #9a8eaa;
    font-size: 7px;
  }

  p {
    margin: 2px 0 0;
    overflow: hidden;
    color: #5d5569;
    font-size: 9px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.card-footnote {
  margin-top: auto;
  color: #aaaeb5;
  font-size: 8px;
}

.add-card-tile {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 5px;
  border: 1px dashed #d7dbe1;
  background: rgba(255, 255, 255, 0.45);
  color: #969da6;
  cursor: pointer;

  i {
    display: grid;
    width: 36px;
    height: 36px;
    margin-bottom: 3px;
    place-items: center;
    border-radius: 11px;
    background: #f0ecfa;
    color: #7950c7;
    font-size: 16px;
  }

  strong {
    font-size: 10px;
  }

  span {
    color: #adb2b9;
    font-size: 8px;
  }

  &:hover {
    border-color: #baa9df;
    background: #fbf9ff;
  }
}

.page-dots {
  display: flex;
  justify-content: center;
  gap: 5px;
  margin-top: 13px;

  button {
    width: 6px;
    height: 6px;
    padding: 0;
    border: 0;
    border-radius: 999px;
    background: #d3d7dc;
    cursor: pointer;
    transition: width 0.18s ease;

    &.active {
      width: 18px;
      background: #7950c7;
    }
  }
}

.life-footer {
  display: flex;
  min-height: 54px;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 9px 19px;
  border-top: 1px solid #e9ecef;
  background: #fff;

  span {
    display: flex;
    align-items: center;
    gap: 5px;
    color: #989fa8;
    font-size: 8px;
  }

  strong {
    overflow: hidden;
    color: #626a74;
    font-size: 9px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.dark-theme {
  .life-header,
  .life-footer {
    border-color: #303842;
    background: #181e25;
  }

  .life-heading h2,
  .carousel-header strong,
  .vision-card h3,
  .life-footer strong {
    color: #dce1e7;
  }

  .life-content {
    background: #151a20;
  }

  .vision-card {
    border-color: #303842;
    background: #1d232b;

    &:hover,
    &:focus-visible {
      border-color: #65518d;
    }
  }

  .vision-summary {
    color: #adb4bd;

    &.empty {
      color: #737b84;
    }
  }

  .carousel-controls button {
    border-color: #36404a;
    background: #20262e;
    color: #b4bbc4;
  }

  .pin-button:hover,
  .pin-button.active {
    background: #302744;
    color: #bca6ee;
  }

  .progress-track {
    background: #2c343d;
  }

  .next-action {
    background: #282331;

    p {
      color: #c4b9d0;
    }
  }

  .add-card-tile {
    border-color: #343d47;
    background: rgba(29, 35, 43, 0.55);

    &:hover {
      border-color: #65518d;
      background: #211d29;
    }
  }

  .close-button:hover {
    background: #252c35;
  }
}

@media (max-width: 780px) {
  .life-dialog {
    min-width: 720px;
  }

  .life-backdrop {
    justify-content: start;
    overflow-x: auto;
  }
}
</style>
