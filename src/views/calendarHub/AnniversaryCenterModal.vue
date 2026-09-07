<template>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="backdrop"
      class="anniversary-center-backdrop"
      role="presentation"
      tabindex="-1"
      @mousedown.self="$emit('close')"
      @keydown.esc.stop.prevent="$emit('close')"
    >
      <section
        class="anniversary-center-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="anniversary-center-title"
      >
        <header class="anniversary-center-header">
          <div class="anniversary-center-heading">
            <span class="anniversary-center-icon">
              <i class="bi-calendar-heart"></i>
            </span>

            <div>
              <h2 id="anniversary-center-title">
                纪念日
              </h2>
              <p>
                管理生日、纪念日和重要倒数日
              </p>
            </div>
          </div>

          <button
            type="button"
            class="anniversary-center-close"
            aria-label="关闭纪念日窗口"
            title="关闭"
            @click="$emit('close')"
          >
            ×
          </button>
        </header>

        <div class="anniversary-center-summary">
          <div>
            <strong>{{ list.length }}</strong>
            <span>全部纪念日</span>
          </div>

          <div>
            <strong>{{ upcomingCount }}</strong>
            <span>未来 30 天</span>
          </div>

          <button
            type="button"
            class="anniversary-center-create"
            @click="$emit('add')"
          >
            <i class="bi-plus-lg"></i>
            新建纪念日
          </button>
        </div>

        <main class="anniversary-center-content">
          <anniversary-list
            :list="list"
            @add="$emit('add')"
            @edit="$emit('edit', $event)"
          />
        </main>
      </section>
    </div>
  </Teleport>
</template>

<script>
import anniversaryList from "./anniversaryList.vue";
import anniversaryHelper from "../../helpers/anniversaryHelper";

/* CALENDAR_HUB_REDESIGN_20260907_V1 */

export default {
  name: "AnniversaryCenterModal",

  components: {
    anniversaryList,
  },

  props: {
    visible: {
      type: Boolean,
      default: false,
    },

    list: {
      type: Array,
      default: () => [],
    },
  },

  emits: ["close", "add", "edit"],

  computed: {
    upcomingCount() {
      return anniversaryHelper.getUpcomingAnniversaries(
        this.list,
        30
      ).length;
    },
  },

  watch: {
    visible(value) {
      if (!value) return;

      this.$nextTick(() => {
        this.$refs.backdrop?.focus();
      });
    },
  },
};
</script>

<style scoped lang="scss">
.anniversary-center-backdrop {
  position: fixed;
  z-index: 16000;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 28px;
  outline: none;
  background: rgba(26, 31, 39, 0.38);
  backdrop-filter: blur(7px);
}

.anniversary-center-dialog {
  display: flex;
  width: min(820px, calc(100vw - 56px));
  height: min(680px, calc(100vh - 56px));
  min-height: 480px;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(31, 35, 41, 0.08);
  border-radius: 18px;
  background: #ffffff;
  box-shadow:
    0 28px 90px rgba(31, 35, 41, 0.22),
    0 6px 24px rgba(31, 35, 41, 0.08);

  .dark-theme & {
    border-color: #303842;
    background: #181e25;
    box-shadow:
      0 28px 90px rgba(0, 0, 0, 0.48),
      0 6px 24px rgba(0, 0, 0, 0.24);
  }
}

.anniversary-center-header {
  display: flex;
  min-height: 78px;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 18px 22px;
  border-bottom: 1px solid #eceff3;

  .dark-theme & {
    border-bottom-color: #303842;
  }
}

.anniversary-center-heading {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 13px;

  h2 {
    margin: 0;
    color: #282d35;
    font-size: 18px;
    font-weight: 650;

    .dark-theme & {
      color: #e2e6eb;
    }
  }

  p {
    margin: 4px 0 0;
    color: #969ca5;
    font-size: 12px;
  }
}

.anniversary-center-icon {
  display: grid;
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  place-items: center;
  border-radius: 12px;
  background:
    linear-gradient(
      145deg,
      rgba(255, 107, 149, 0.18),
      rgba(116, 143, 252, 0.16)
    );
  color: #e14c7b;
  font-size: 18px;
}

.anniversary-center-close {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: #8e949d;
  font-size: 23px;
  line-height: 1;
  cursor: pointer;

  &:hover {
    background: #f0f2f5;
    color: #343941;
  }

  .dark-theme &:hover {
    background: #252c35;
    color: #e1e5ea;
  }
}

.anniversary-center-summary {
  display: flex;
  align-items: center;
  gap: 28px;
  padding: 15px 22px;
  background: #fafbfc;

  .dark-theme & {
    background: #151a20;
  }

  > div {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  strong {
    color: #333943;
    font-size: 16px;

    .dark-theme & {
      color: #e0e4e9;
    }
  }

  span {
    color: #989ea7;
    font-size: 11px;
  }
}

.anniversary-center-create {
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  gap: 7px;
  margin-left: auto;
  padding: 0 14px;
  border: 1px solid #4263eb;
  border-radius: 8px;
  background: #4263eb;
  color: #fff;
  font-size: 12px;
  font-weight: 550;
  cursor: pointer;

  &:hover {
    background: #3656d4;
  }
}

.anniversary-center-content {
  min-height: 0;
  flex: 1;
  padding: 20px 22px 22px;
  overflow: hidden;

  :deep(.anniversary-panel) {
    min-height: 0;
  }

  :deep(.panel-header .add-btn) {
    display: none;
  }

  :deep(.anniversary-row) {
    min-height: 52px;
    padding: 10px 8px;
  }
}

@media (max-width: 720px) {
  .anniversary-center-backdrop {
    padding: 12px;
  }

  .anniversary-center-dialog {
    width: calc(100vw - 24px);
    height: calc(100vh - 24px);
  }

  .anniversary-center-summary {
    gap: 16px;
  }
}
</style>
