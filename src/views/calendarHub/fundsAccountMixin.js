/* FOCUS_UI_SYSTEM_20260911_V6 */

/**
 * 资金账户 mixin。
 *
 * 三条安全设计，目的是让默认视图零变化、出错也不会显示错数字：
 *
 * 1) 范围为空 = 全部账户 = 直接复用宿主组件原有的 assetTotal /
 *    liabilityTotal / netWorth。只有用户主动勾选账户才走分账计算。
 *    这样即使我对宿主那几个 computed 的来源判断有偏差，默认态也正确。
 *
 * 2) 快照列表自己从 repository 读，不依赖宿主里叫什么名字的 data
 *    （snapshots / list / timeline 都可能），并监听变更事件保持同步。
 *
 * 3) components 在 mixin 里注册，Vue 会合并进宿主。补丁脚本因此
 *    不需要去改 import 和 components——那两处是正则最容易失配的地方。
 */

import financialAccountService, {
  DEFAULT_ACCOUNT_ID,
} from "../../services/financialAccountService";
import financialSnapshotRepository from "../../repositories/financialSnapshotRepository";

import FundsAccountScopeBar from "./FundsAccountScopeBar.vue";
import FundsAccountManagerDialog from "./FundsAccountManagerDialog.vue";
import FundsRowAccount from "./FundsRowAccount.vue";
import FundsTrendChart from "./FundsTrendChart.vue";

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export default {
  components: {
    FundsAccountScopeBar,
    FundsAccountManagerDialog,
    FundsRowAccount,
    FundsTrendChart,
  },

  data() {
    return {
      faAccounts: financialAccountService.listActive(),
      faScope: [],
      faManagerOpen: false,
      faSnapshots: financialSnapshotRepository.load(),
    };
  },

  computed: {
    /**
     * 当前正在看的那张快照。宿主可能叫 draft / selected / current，
     * 逐个探测，全都没有就退回列表最后一张。
     */
    faActiveSnapshot() {
      const candidates = [
        this.draft,
        this.selectedSnapshot,
        this.selected,
        this.currentSnapshot,
      ];

      const hit = candidates.find(
        (item) => item && (Array.isArray(item.assets) || Array.isArray(item.liabilities))
      );

      if (hit) return hit;

      return this.faSnapshots.length
        ? this.faSnapshots[this.faSnapshots.length - 1]
        : null;
    },

    /**
     * 范围内的合计。scope 为空时逐字复用宿主原值，
     * 保证默认视图与改造前完全一致。
     */
    faScopedSummary() {
      const snapshot = this.faActiveSnapshot;

      if (!this.faScope.length) {
        const fallback = financialAccountService.summarize(snapshot, null);

        return {
          assetTotal: Number.isFinite(this.assetTotal)
            ? this.assetTotal
            : fallback.assetTotal,
          liabilityTotal: Number.isFinite(this.liabilityTotal)
            ? this.liabilityTotal
            : fallback.liabilityTotal,
          netWorth: Number.isFinite(this.netWorth)
            ? this.netWorth
            : fallback.netWorth,
          liquidTotal: fallback.liquidTotal,
        };
      }

      return financialAccountService.summarize(snapshot, this.faScope);
    },

    /** 自适应图表的数据源：按范围过滤后的时间序列。 */
    faTrendSeries() {
      return this.faSnapshots.map((snapshot, index) => {
        const summary = financialAccountService.summarize(
          snapshot,
          this.faScope.length ? this.faScope : null
        );

        const recorded = String(snapshot.recordedAt || "");

        return {
          id: snapshot.id || "snap-" + index,
          label: snapshot.title || "第 " + (index + 1) + " 次记录",
          dateText: recorded.replace("T", " ").slice(0, 16),
          net: summary.netWorth,
          assetTotal: summary.assetTotal,
          liabilityTotal: summary.liabilityTotal,
          liquidTotal: summary.liquidTotal,
        };
      });
    },
  },

  mounted() {
    window.addEventListener(
      "weektodo:financial-snapshots-changed",
      this.faOnSnapshotsChanged
    );
    window.addEventListener(
      financialAccountService.CHANGED_EVENT,
      this.faReloadAccounts
    );
  },

  beforeUnmount() {
    window.removeEventListener(
      "weektodo:financial-snapshots-changed",
      this.faOnSnapshotsChanged
    );
    window.removeEventListener(
      financialAccountService.CHANGED_EVENT,
      this.faReloadAccounts
    );
  },

  methods: {
    faOnSnapshotsChanged(event) {
      this.faSnapshots = event?.detail?.list
        ? event.detail.list
        : financialSnapshotRepository.load();
    },

    faReloadAccounts() {
      this.faAccounts = financialAccountService.listActive();

      // 被删掉的账户要从范围里摘掉，否则范围会指向不存在的账户。
      const ids = this.faAccounts.map((item) => item.id);
      this.faScope = this.faScope.filter((id) => ids.includes(id));
    },

    faSetScope(next) {
      this.faScope = Array.isArray(next) ? next : [];
    },

    /** 每行明细改归属账户。 */
    faAssignRow(row, accountId) {
      if (!row) return;

      row.accountId = accountId || DEFAULT_ACCOUNT_ID;
    },

    faRowAccount(row) {
      return (row && row.accountId) || DEFAULT_ACCOUNT_ID;
    },

    faMoney(value) {
      return (
        "¥" +
        toNumber(value).toLocaleString("zh-CN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      );
    },
  },
};
