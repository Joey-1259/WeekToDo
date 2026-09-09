<template>
  <div class="fr-wrap">
    <button
      ref="trigger"
      type="button"
      class="fr-chip"
      :style="{ borderColor: current.color + '55', color: current.color }"
      :title="'归属账户：' + current.name + '（点击更改）'"
      @click.stop="toggle"
    >
      <i class="fr-dot" :style="{ background: current.color }"></i>
      <span class="fr-name">{{ current.name }}</span>
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        class="fr-pop"
        :style="popStyle"
        @mousedown.stop
        @click.stop
      >
        <strong class="fr-pop-title">归属账户</strong>

        <button
          v-for="account in accounts"
          :key="account.id"
          type="button"
          class="fr-pop-row"
          :class="{ selected: account.id === current.id }"
          @click="pick(account.id)"
        >
          <i class="fr-dot" :style="{ background: account.color }"></i>
          <span>{{ account.name }}</span>
        </button>
      </div>
    </Teleport>
  </div>
</template>

<script>
/* FOCUS_UI_SYSTEM_20260911_V6 */
import financialAccountService, {
  DEFAULT_ACCOUNT_ID,
} from "../../services/financialAccountService";

export default {
  name: "FundsRowAccount",

  props: {
    modelValue: { type: String, default: DEFAULT_ACCOUNT_ID },
    accounts: { type: Array, default: () => [] },
  },

  emits: ["update:modelValue"],

  data() {
    return { open: false, popStyle: {} };
  },

  computed: {
    current() {
      return financialAccountService.resolve(
        this.modelValue || DEFAULT_ACCOUNT_ID
      );
    },
  },

  mounted() {
    document.addEventListener("mousedown", this.onOutside);
  },

  beforeUnmount() {
    document.removeEventListener("mousedown", this.onOutside);
  },

  methods: {
    toggle() {
      if (this.open) {
        this.open = false;
        return;
      }

      const rect = this.$refs.trigger?.getBoundingClientRect();

      if (rect) {
        const width = 172;
        const height = 40 + this.accounts.length * 30;

        this.popStyle = {
          position: "fixed",
          width: width + "px",
          left:
            Math.max(
              8,
              Math.min(window.innerWidth - width - 8, rect.left)
            ) + "px",
          top:
            (rect.bottom + height > window.innerHeight - 8
              ? rect.top - height - 6
              : rect.bottom + 6) + "px",
        };
      }

      this.open = true;
    },

    pick(id) {
      this.$emit("update:modelValue", id);
      this.open = false;
    },

    onOutside(event) {
      if (event.target.closest(".fr-pop")) return;
      if (event.target.closest(".fr-wrap")) return;

      this.open = false;
    },
  },
};
</script>

<style scoped lang="scss">
.fr-wrap { display: inline-flex; flex: 0 0 auto; }

.fr-chip {
  display: inline-flex;
  max-width: 96px;
  align-items: center;
  gap: 4px;
  height: 24px;
  padding: 0 7px;
  border: 1px solid #e4e7eb;
  border-radius: 12px;
  background: transparent;
  font-family: inherit;
  font-size: 10.5px;
  cursor: pointer;

  &:hover { background: #f5f7f9; }
}

.fr-dot {
  width: 6px;
  height: 6px;
  flex: 0 0 6px;
  border-radius: 50%;
}

.fr-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dark-theme .fr-chip:hover { background: #242b34; }
</style>

<style lang="scss">
.fr-pop {
  z-index: 22500;
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 6px;
  border: 1px solid rgba(31, 35, 41, 0.12);
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 14px 36px rgba(24, 29, 38, 0.18);
}

.fr-pop-title {
  padding: 2px 6px 4px;
  color: #868d96;
  font-size: 10px;
  font-weight: 500;
}

.fr-pop-row {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #3f454e;
  font-family: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;

  &:hover { background: #f0f2f5; }
  &.selected { background: #eef2ff; color: #4263eb; }
}

.dark-theme .fr-pop {
  border-color: #39414c;
  background: #1d232b;
}

.dark-theme .fr-pop-row {
  color: #d3d8de;

  &:hover { background: #262e38; }
  &.selected { background: #1e2740; color: #8da2fb; }
}
</style>
