<template>
  <div class="fs-bar">
    <div class="fs-row">
      <span class="fs-label">账户范围</span>

      <button
        type="button"
        class="fs-chip"
        :class="{ 'is-on': !scope.length }"
        @click="$emit('update:scope', [])"
      >
        全部
        <small>{{ money(allSummary.netWorth) }}</small>
      </button>

      <button
        v-for="account in accounts"
        :key="account.id"
        type="button"
        class="fs-chip"
        :class="{ 'is-on': scope.includes(account.id) }"
        :style="scope.includes(account.id)
          ? { borderColor: account.color, color: account.color }
          : null"
        @click="toggle(account.id)"
      >
        <i class="fs-dot" :style="{ background: account.color }"></i>
        {{ account.name }}
        <small>{{ money(netOf(account.id)) }}</small>
      </button>

      <span class="fs-spacer"></span>

      <button
        type="button"
        class="fs-text-btn"
        :class="{ 'is-on': expanded }"
        @click="expanded = !expanded"
      >
        分账明细
        <i class="bi-chevron-down" :class="{ 'is-open': expanded }"></i>
      </button>

      <button type="button" class="fs-text-btn" @click="$emit('manage')">
        管理账户
      </button>
    </div>

    <!-- 分账小计做成展开面板而不是独立区块：少占一块版面，
         也少一处与"资金现状"竞争注意力的标题。 -->
    <div v-if="expanded" class="fs-groups">
      <div
        v-for="group in groups"
        :key="group.account.id"
        class="fs-group"
        :class="{ 'is-dim': scope.length && !scope.includes(group.account.id) }"
      >
        <span class="fs-group-name">
          <i class="fs-dot" :style="{ background: group.account.color }"></i>
          {{ group.account.name }}
          <small>{{ kindLabel(group.account.kind) }}</small>
        </span>

        <span class="fs-group-cell">
          <small>资产</small>
          {{ money(group.assetTotal) }}
        </span>

        <span class="fs-group-cell">
          <small>负债</small>
          {{ money(group.liabilityTotal) }}
        </span>

        <span class="fs-group-cell is-net">
          <small>净额</small>
          {{ money(group.netWorth) }}
        </span>
      </div>

      <p v-if="!groups.length" class="fs-groups-empty">
        这张快照里还没有明细
      </p>

      <p class="fs-groups-note">
        合并统计已自动去重：每条明细只归属一个账户，所以各账户净额相加
        等于「全部」口径的净资产。
      </p>
    </div>
  </div>
</template>

<script>
/* FOCUS_UI_SYSTEM_20260911_V6 */
import financialAccountService, {
  ACCOUNT_KINDS,
} from "../../services/financialAccountService";

export default {
  name: "FundsAccountScopeBar",

  props: {
    accounts: { type: Array, default: () => [] },
    scope: { type: Array, default: () => [] },
    snapshot: { type: Object, default: null },
  },

  emits: ["update:scope", "manage"],

  data() {
    return { expanded: false };
  },

  computed: {
    allSummary() {
      return financialAccountService.summarize(this.snapshot, null);
    },

    groups() {
      if (!this.snapshot) return [];

      return financialAccountService
        .groupByAccount(this.snapshot)
        .filter(
          (group) => group.assets.length || group.liabilities.length
        );
    },
  },

  methods: {
    toggle(id) {
      const next = this.scope.includes(id)
        ? this.scope.filter((item) => item !== id)
        : [...this.scope, id];

      this.$emit("update:scope", next);
    },

    netOf(id) {
      return financialAccountService.summarize(this.snapshot, [id]).netWorth;
    },

    kindLabel(kind) {
      const found = ACCOUNT_KINDS.find((item) => item.value === kind);
      return found ? found.label : "";
    },

    money(value) {
      const number = Number(value) || 0;
      const abs = Math.abs(number);
      const sign = number < 0 ? "-" : "";

      if (abs >= 1e4) return sign + "¥" + (abs / 1e4).toFixed(1) + "万";

      return sign + "¥" + Math.round(abs).toLocaleString("zh-CN");
    },
  },
};
</script>

<style scoped lang="scss">
.fs-bar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 0 0;
}

.fs-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.fs-label {
  margin-right: 2px;
  color: #8d949d;
  font-size: 11.5px;
}

.fs-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border: 1px solid #e4e7eb;
  border-radius: 14px;
  background: #fff;
  color: #5c636d;
  font-family: inherit;
  font-size: 11.5px;
  cursor: pointer;
  transition: border-color 0.14s ease, background-color 0.14s ease;

  &:hover { background: #f7f8fa; }

  &.is-on {
    border-color: #4263eb;
    background: #eef2ff;
    color: #3853cc;
    font-weight: 560;
  }

  small {
    color: #a8aeb7;
    font-size: 10.5px;
    font-variant-numeric: tabular-nums;
  }

  &.is-on small { color: inherit; opacity: 0.75; }
}

.fs-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.fs-spacer { flex: 1 1 auto; min-width: 8px; }

.fs-text-btn {
  padding: 4px 8px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #6d747e;
  font-family: inherit;
  font-size: 11.5px;
  cursor: pointer;

  &:hover { background: #f0f2f5; color: #24282e; }
  &.is-on { color: #4263eb; }

  i {
    display: inline-block;
    margin-left: 2px;
    font-size: 9px;
    transition: transform 0.14s ease;

    &.is-open { transform: rotate(180deg); }
  }
}

.fs-groups {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 8px;
  border: 1px solid #eef0f3;
  border-radius: 9px;
  background: #fafbfc;
}

.fs-group {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 6px;
  border-radius: 6px;
  transition: opacity 0.14s ease;

  &:hover { background: #f2f4f7; }
  &.is-dim { opacity: 0.42; }
}

.fs-group-name {
  display: inline-flex;
  min-width: 0;
  flex: 1 1 auto;
  align-items: center;
  gap: 6px;
  color: #3f454e;
  font-size: 12px;

  small { color: #a8aeb7; font-size: 10px; }
}

.fs-group-cell {
  flex: 0 0 auto;
  min-width: 96px;
  color: #4a515b;
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
  text-align: right;

  small {
    display: block;
    color: #a8aeb7;
    font-size: 10px;
  }

  &.is-net { color: #24282e; font-weight: 600; }
}

.fs-groups-empty,
.fs-groups-note {
  margin: 4px 0 0;
  padding: 0 6px;
  color: #a8aeb7;
  font-size: 10.5px;
}

.dark-theme {
  .fs-chip { border-color: #333a44; background: #1a1f26; color: #b9c0c9; }
  .fs-chip:hover { background: #242b34; }
  .fs-chip.is-on { background: #1e2740; color: #8da2fb; border-color: #4263eb; }
  .fs-groups { border-color: #2a323c; background: #171c22; }
  .fs-group:hover { background: #222932; }
  .fs-group-name { color: #c3c9d1; }
  .fs-group-cell { color: #b9c0c9; }
  .fs-group-cell.is-net { color: #e3e7ec; }
}
</style>
