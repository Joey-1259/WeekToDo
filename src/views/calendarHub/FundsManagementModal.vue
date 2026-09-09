<template>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="backdrop"
      class="funds-backdrop"
      tabindex="-1"
      @mousedown.self="requestClose"
      @keydown.esc.stop.prevent="requestClose"
    >
      <section
        class="funds-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="funds-title"
      >
        <header class="funds-header">
          <div class="funds-heading">
            <span class="module-icon">
              <i class="bi-wallet2"></i>
            </span>

            <div>
              <h2 id="funds-title">资金管理</h2>
              <p>记录资金快照，看见长期变化与未来用途</p>
            </div>
          </div>

          <div class="header-actions">
            <span class="privacy-label">
              <i class="bi-shield-check"></i>
              本地记录
            </span>

            <button
              type="button"
              class="icon-button"
              title="关闭"
              aria-label="关闭资金管理"
              @click="requestClose"
            >
              ×
            </button>
          </div>
        </header>

        <!-- FOCUS_UI_SYSTEM_20260911_V6
          账户是互斥的归属维度：一条明细只能挂一个 accountId。
          它与"应急金 / 教育储备"这类多值用途标签是两条正交轴，
          混成一个标签，合并统计时必然出现"算一次还是两次"的歧义。
          正因为互斥，各账户净额相加才恒等于「全部」口径的净资产。 -->
        <div class="funds-scope-host">
          <FundsAccountScopeBar
            :accounts="faAccounts"
            :scope="faScope"
            :snapshot="faActiveSnapshot"
            @update:scope="faSetScope"
            @manage="faManagerOpen = true"
          />
        </div>

        <FundsAccountManagerDialog
          v-if="faManagerOpen"
          @close="faManagerOpen = false"
          @changed="faReloadAccounts"
        />

        <div class="funds-summary">
          <div class="summary-card">
            <span>总资产</span>
            <strong>{{ formatMoney(faScopedSummary.assetTotal) }}</strong>
          </div>

          <div class="summary-card">
            <span>总负债</span>
            <strong>{{ formatMoney(faScopedSummary.liabilityTotal) }}</strong>
          </div>

          <div class="summary-card is-primary">
            <span>净资产</span>
            <strong>{{ formatMoney(faScopedSummary.netWorth) }}</strong>
          </div>

          <div class="summary-card">
            <span>未来用途</span>
            <strong>{{ formatMoney(plannedTotal) }}</strong>
          </div>
        </div>

        <div class="funds-chart">
          <div class="section-heading">
            <div>
              <strong>净资产轨迹</strong>
              <span>每一个节点代表一次资金快照</span>
            </div>

            <span
              v-if="selectedDelta !== null"
              class="delta-badge"
              :class="{
                positive: selectedDelta > 0,
                negative: selectedDelta < 0,
              }"
            >
              较上次
              {{ selectedDelta > 0 ? "+" : "" }}
              {{ formatMoney(selectedDelta) }}
            </span>
          </div>

          <!-- FOCUS_UI_SYSTEM_20260911_V6
            图形类型随样本数自适应，这是可视化通则而非本项目特例：
            1 点 → 资产构成条；2 点 → 哑铃对比（说清"各是多少 + 差多少"）；
            3 点以上 → 带零基线的面积折线。 -->
          <FundsTrendChart :series="faTrendSeries" />
        </div>

        <div class="funds-body">
          <aside class="funds-timeline">
            <div class="timeline-header">
              <div>
                <strong>资金时间轴</strong>
                <span>{{ snapshots.length }} 个节点</span>
              </div>

              <button
                type="button"
                class="primary-small"
                @click="startNew"
              >
                <i class="bi-plus-lg"></i>
                新建快照
              </button>
            </div>

            <div
              v-if="!timelineSnapshots.length"
              class="timeline-empty"
            >
              <i class="bi-clock-history"></i>
              <strong>还没有资金快照</strong>
              <span>从今天的资金现状开始记录</span>
            </div>

            <div v-else class="timeline-list">
              <button
                v-for="(item, index) in timelineSnapshots"
                :key="item.id"
                type="button"
                class="timeline-item"
                :class="{ active: item.id === selectedId }"
                @click="selectSnapshot(item)"
              >
                <i class="timeline-dot"></i>

                <span class="timeline-content">
                  <strong>
                    {{ item.title || formatDate(item.recordedAt) }}
                  </strong>
                  <small>{{ formatDateTime(item.recordedAt) }}</small>
                </span>

                <span class="timeline-value">
                  {{ formatMoney(snapshotNetWorth(item)) }}
                  <small
                    v-if="timelineDelta(item, index) !== null"
                    :class="{
                      positive:
                        timelineDelta(item, index) > 0,
                      negative:
                        timelineDelta(item, index) < 0,
                    }"
                  >
                    {{
                      timelineDelta(item, index) > 0
                        ? "+"
                        : ""
                    }}{{
                      formatCompactMoney(
                        timelineDelta(item, index)
                      )
                    }}
                  </small>
                </span>
              </button>
            </div>
          </aside>

          <main class="funds-editor">
            <div class="editor-top-row">
              <label>
                <span>记录时间</span>
                <input
                  v-model="draft.recordedAt"
                  type="datetime-local"
                />
              </label>

              <label>
                <span>节点名称</span>
                <input
                  v-model.trim="draft.title"
                  type="text"
                  maxlength="40"
                  placeholder="例如：2026 年第三季度"
                />
              </label>
            </div>

            <section class="money-section">
              <div class="section-heading">
                <div>
                  <strong>资金现状</strong>
                  <span>建议只记录金额，不填写账户号码</span>
                </div>
              </div>

              <div class="money-columns">
                <div class="money-panel">
                  <header>
                    <strong>资产</strong>
                    <button
                      type="button"
                      @click="addAsset"
                    >
                      ＋ 添加
                    </button>
                  </header>

                  <div
                    v-for="(item, index) in draft.assets"
                    :key="item.id"
                    class="money-row"
                  >
                    <input
                      v-model.trim="item.name"
                      type="text"
                      placeholder="资产名称"
                    />

                    <!-- FOCUS_UI_SYSTEM_20260911_V6：归属账户就地可改，
                         不必为了分账跳去另一个界面。 -->
                    <FundsRowAccount
                      :model-value="faRowAccount(item)"
                      :accounts="faAccounts"
                      @update:model-value="faAssignRow(item, $event)"
                    />

                    <div class="amount-input">
                      <span>¥</span>
                      <input
                        v-model.number="item.amount"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0"
                      />
                    </div>

                    <label
                      class="liquid-check"
                      title="是否属于可以较快用于未来计划的资金"
                    >
                      <input
                        v-model="item.liquid"
                        type="checkbox"
                      />
                      可调度
                    </label>

                    <button
                      type="button"
                      class="remove-row"
                      aria-label="删除资产"
                      @click="draft.assets.splice(index, 1)"
                    >
                      ×
                    </button>
                  </div>
                </div>

                <div class="money-panel">
                  <header>
                    <strong>负债</strong>
                    <button
                      type="button"
                      @click="addLiability"
                    >
                      ＋ 添加
                    </button>
                  </header>

                  <div
                    v-for="(item, index) in draft.liabilities"
                    :key="item.id"
                    class="money-row debt-row"
                  >
                    <input
                      v-model.trim="item.name"
                      type="text"
                      placeholder="负债名称"
                    />

                    <FundsRowAccount
                      :model-value="faRowAccount(item)"
                      :accounts="faAccounts"
                      @update:model-value="faAssignRow(item, $event)"
                    />

                    <div class="amount-input">
                      <span>¥</span>
                      <input
                        v-model.number="item.amount"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0"
                      />
                    </div>

                    <button
                      type="button"
                      class="remove-row"
                      aria-label="删除负债"
                      @click="
                        draft.liabilities.splice(index, 1)
                      "
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section class="money-section">
              <div class="section-heading">
                <div>
                  <strong>未来资金用途</strong>
                  <span>
                    计划金额 {{ formatMoney(plannedTotal) }}，
                    可调度资产 {{ formatMoney(liquidAssetTotal) }}
                  </span>
                </div>

                <button
                  type="button"
                  class="secondary-small"
                  @click="addPlan"
                >
                  ＋ 添加用途
                </button>
              </div>

              <div v-if="draft.plans.length" class="plan-list">
                <div
                  v-for="(plan, index) in draft.plans"
                  :key="plan.id"
                  class="plan-row"
                >
                  <input
                    v-model.trim="plan.name"
                    class="plan-name"
                    type="text"
                    maxlength="50"
                    placeholder="例如：应急备用金、旅行、进修"
                  />

                  <select v-model="plan.priority">
                    <option value="essential">必要</option>
                    <option value="important">重要</option>
                    <option value="wish">愿望</option>
                  </select>

                  <div class="amount-input">
                    <span>¥</span>
                    <input
                      v-model.number="plan.amount"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="计划金额"
                    />
                  </div>

                  <input
                    v-model="plan.targetDate"
                    type="date"
                    title="目标日期"
                  />

                  <button
                    type="button"
                    class="remove-row"
                    aria-label="删除资金用途"
                    @click="draft.plans.splice(index, 1)"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div v-else class="inline-empty">
                还没有未来用途。资金规划的重点不是限制消费，
                而是提前决定什么更重要。
              </div>

              <div
                v-if="plannedTotal > 0"
                class="coverage-row"
              >
                <span>可调度资产覆盖度</span>

                <div class="coverage-track">
                  <i
                    :style="{
                      width: `${Math.min(
                        100,
                        planCoverage
                      )}%`,
                    }"
                  ></i>
                </div>

                <strong>{{ planCoverage }}%</strong>
              </div>
            </section>

            <label class="snapshot-note">
              <span>本次记录</span>
              <textarea
                v-model.trim="draft.note"
                rows="2"
                maxlength="500"
                placeholder="记录资金变化原因、当前判断或下一阶段安排"
              ></textarea>
            </label>
          </main>
        </div>

        <footer class="funds-footer">
          <p>
            数据保存在本机浏览器存储中，但本地存储不等于加密存储。
            请勿填写银行卡号、密码或身份信息。
          </p>

          <button
            v-if="selectedId"
            type="button"
            class="danger-button"
            @click="removeCurrent"
          >
            删除节点
          </button>

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
            @click="saveCurrent"
          >
            保存快照
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<script>
import moment from "moment";
import financialSnapshotRepository from "../../repositories/financialSnapshotRepository";
import { DEFAULT_ACCOUNT_ID } from "../../services/financialAccountService";


/* FOCUS_UI_SYSTEM_20260911_V6 */
import fundsAccountMixin from "./fundsAccountMixin";
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function numberValue(value) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function createRow(prefix, values = {}) {
  return {
    id:
      prefix +
      "_" +
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 7),
    name: values.name || "",
    amount: numberValue(values.amount),
    liquid: Boolean(values.liquid),
    /* FOCUS_UI_SYSTEM_20260911_V6：新行必须带归属，空 accountId 会让
       分账小计出现一个匿名分组。 */
    accountId: values.accountId || DEFAULT_ACCOUNT_ID,
    purposeTags: [],
  };
}

export default {
  /* FOCUS_UI_SYSTEM_20260911_V6：mixin 内部已注册 components，
     所以这里不需要动 import 与 components 两个列表——
     那正是成员顺序敏感、正则最容易失配的位置。 */
  mixins: [fundsAccountMixin],

  name: "FundsManagementModal",

  props: {
    visible: {
      type: Boolean,
      default: false,
    },
  },

  emits: ["close"],

  data() {
    return {
      snapshots: [],
      selectedId: null,
      draft: financialSnapshotRepository.createDraft(),
      savedFingerprint: "",
    };
  },

  computed: {
    sortedSnapshots() {
      return [...this.snapshots].sort(
        (a, b) =>
          new Date(a.recordedAt).getTime() -
          new Date(b.recordedAt).getTime()
      );
    },

    timelineSnapshots() {
      return [...this.sortedSnapshots].reverse();
    },

    assetTotal() {
      return this.sumRows(this.draft.assets);
    },

    liquidAssetTotal() {
      return (this.draft.assets || [])
        .filter((item) => item.liquid)
        .reduce(
          (total, item) =>
            total + numberValue(item.amount),
          0
        );
    },

    liabilityTotal() {
      return this.sumRows(this.draft.liabilities);
    },

    netWorth() {
      return this.assetTotal - this.liabilityTotal;
    },

    plannedTotal() {
      return this.sumRows(this.draft.plans);
    },

    planCoverage() {
      if (!this.plannedTotal) return 0;

      return Math.max(
        0,
        Math.round(
          (this.liquidAssetTotal / this.plannedTotal) *
            100
        )
      );
    },

    isDirty() {
      return (
        JSON.stringify(this.draft) !==
        this.savedFingerprint
      );
    },

    selectedDelta() {
      if (!this.selectedId) return null;

      const index = this.sortedSnapshots.findIndex(
        (item) => item.id === this.selectedId
      );

      if (index <= 0) return null;

      return (
        this.snapshotNetWorth(
          this.sortedSnapshots[index]
        ) -
        this.snapshotNetWorth(
          this.sortedSnapshots[index - 1]
        )
      );
    },

    chartPoints() {
      const list = this.sortedSnapshots;

      if (!list.length) return [];

      const values = list.map((item) =>
        this.snapshotNetWorth(item)
      );
      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = max - min || 1;

      return list.map((item, index) => ({
        id: item.id,
        x:
          list.length === 1
            ? 360
            : 20 + (index / (list.length - 1)) * 680,
        y:
          112 -
          ((this.snapshotNetWorth(item) - min) /
            range) *
            92,
      }));
    },

    chartPolyline() {
      return this.chartPoints
        .map((point) => `${point.x},${point.y}`)
        .join(" ");
    },

    chartAreaPath() {
      if (!this.chartPoints.length) return "";

      const first = this.chartPoints[0];
      const last =
        this.chartPoints[this.chartPoints.length - 1];

      return [
        `M ${first.x} 120`,
        ...this.chartPoints.map(
          (point) => `L ${point.x} ${point.y}`
        ),
        `L ${last.x} 120`,
        "Z",
      ].join(" ");
    },
  },

  watch: {
    visible(value) {
      if (!value) return;

      this.reload();

      this.$nextTick(() => {
        this.$refs.backdrop?.focus();
      });
    },
  },

  methods: {
    reload() {
      this.snapshots =
        financialSnapshotRepository.load();

      if (this.snapshots.length) {
        this.selectSnapshot(
          this.snapshots[this.snapshots.length - 1],
          true
        );
      } else {
        this.startNew(true);
      }
    },

    sumRows(rows) {
      return (rows || []).reduce(
        (total, item) =>
          total + numberValue(item.amount),
        0
      );
    },

    snapshotNetWorth(item) {
      return (
        this.sumRows(item?.assets) -
        this.sumRows(item?.liabilities)
      );
    },

    formatMoney(value) {
      const amount = numberValue(value);
      const sign = amount < 0 ? "-" : "";

      return (
        sign +
        "¥" +
        new Intl.NumberFormat("zh-CN", {
          maximumFractionDigits: 2,
        }).format(Math.abs(amount))
      );
    },

    formatCompactMoney(value) {
      const amount = numberValue(value);
      const absolute = Math.abs(amount);
      const sign = amount < 0 ? "-" : "";

      if (absolute >= 10000) {
        return (
          sign +
          "¥" +
          (absolute / 10000).toFixed(1) +
          "万"
        );
      }

      return sign + "¥" + Math.round(absolute);
    },

    formatDate(value) {
      return moment(value).format("YYYY年M月D日");
    },

    formatDateTime(value) {
      return moment(value).format("YYYY-MM-DD HH:mm");
    },

    timelineDelta(item) {
      const index = this.sortedSnapshots.findIndex(
        (snapshot) => snapshot.id === item.id
      );

      if (index <= 0) return null;

      return (
        this.snapshotNetWorth(
          this.sortedSnapshots[index]
        ) -
        this.snapshotNetWorth(
          this.sortedSnapshots[index - 1]
        )
      );
    },

    confirmDiscard() {
      return (
        !this.isDirty ||
        window.confirm("当前修改尚未保存，确定放弃吗？")
      );
    },

    selectSnapshot(item, force = false) {
      if (!force && !this.confirmDiscard()) return;

      this.selectedId = item.id;
      this.draft = clone(item);
      this.savedFingerprint = JSON.stringify(this.draft);
    },

    selectSnapshotById(id) {
      const item = this.snapshots.find(
        (snapshot) => snapshot.id === id
      );

      if (item) this.selectSnapshot(item);
    },

    startNew(force = false) {
      if (!force && !this.confirmDiscard()) return;

      const latest = this.sortedSnapshots[
        this.sortedSnapshots.length - 1
      ];

      this.selectedId = null;
      this.draft =
        financialSnapshotRepository.createDraft(latest);
      this.savedFingerprint = JSON.stringify(this.draft);
    },

    addAsset() {
      this.draft.assets.push(
        createRow("asset", {
          liquid: true,
        })
      );
    },

    addLiability() {
      this.draft.liabilities.push(createRow("debt"));
    },

    addPlan() {
      this.draft.plans.push({
        id: createRow("plan").id,
        name: "",
        amount: 0,
        targetDate: "",
        priority: "important",
        note: "",
      });
    },

    saveCurrent() {
      if (!this.draft.recordedAt) {
        window.alert("请选择记录时间。");
        return;
      }

      const saved =
        financialSnapshotRepository.save(this.draft);

      this.snapshots =
        financialSnapshotRepository.load();
      this.selectSnapshot(saved, true);
    },

    removeCurrent() {
      if (
        !this.selectedId ||
        !window.confirm("确定删除这个资金时间节点吗？")
      ) {
        return;
      }

      financialSnapshotRepository.remove(
        this.selectedId
      );
      this.snapshots =
        financialSnapshotRepository.load();

      if (this.snapshots.length) {
        this.selectSnapshot(
          this.snapshots[this.snapshots.length - 1],
          true
        );
      } else {
        this.startNew(true);
      }
    },

    requestClose() {
      if (!this.confirmDiscard()) return;
      this.$emit("close");
    },
  },
};
</script>

<style scoped lang="scss">
.funds-backdrop {
  position: fixed;
  z-index: 17000;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  outline: none;
  background: rgba(21, 26, 34, 0.46);
  backdrop-filter: blur(7px);
}

.funds-dialog {
  display: flex;
  width: min(1120px, calc(100vw - 48px));
  height: min(820px, calc(100vh - 48px));
  min-height: 620px;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(31, 35, 41, 0.1);
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 30px 90px rgba(20, 25, 34, 0.28);

  .dark-theme & {
    border-color: #343d47;
    background: #181e25;
  }
}

.funds-header,
.funds-footer,
.section-heading,
.timeline-header,
.money-panel header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.funds-header {
  min-height: 76px;
  padding: 15px 20px;
  border-bottom: 1px solid #eaedf1;
}

.funds-heading,
.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.module-icon {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 12px;
  background: #eaf8f1;
  color: #16966a;
  font-size: 19px;
}

h2 {
  margin: 0;
  color: #292f37;
  font-size: 18px;
}

p {
  margin: 4px 0 0;
  color: #969da7;
  font-size: 11px;
}

.privacy-label {
  color: #87909b;
  font-size: 10px;
}

.icon-button,
.remove-row {
  border: 0;
  background: transparent;
  color: #8a929d;
  cursor: pointer;
}

.icon-button {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  font-size: 22px;

  &:hover {
    background: #eff2f5;
  }
}

.funds-summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 9px;
  padding: 12px 20px 0;
}

.summary-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid #e8ebef;
  border-radius: 10px;
  background: #fafbfc;

  span {
    color: #969da7;
    font-size: 10px;
  }

  strong {
    color: #343b44;
    font-size: 16px;
  }

  &.is-primary {
    border-color: #cdd7fa;
    background: #f2f5ff;

    strong {
      color: #4263eb;
    }
  }
}

.funds-chart {
  margin: 10px 20px 0;
  padding: 11px 14px 7px;
  border: 1px solid #e8ebef;
  border-radius: 11px;
}

.section-heading > div,
.timeline-header > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.section-heading strong,
.timeline-header strong,
.money-panel header strong {
  color: #3d444d;
  font-size: 12px;
}

.section-heading span,
.timeline-header span {
  color: #999fa8;
  font-size: 9px;
}

.delta-badge {
  padding: 4px 8px;
  border-radius: 999px;
  background: #f0f2f4;
  color: #717983 !important;

  &.positive {
    background: #eaf8f1;
    color: #16835e !important;
  }

  &.negative {
    background: #fff0f1;
    color: #d84a56 !important;
  }
}

.trend-chart {
  width: 100%;
  height: 82px;
  margin-top: 5px;
  overflow: visible;

  circle {
    fill: #fff;
    stroke: #4263eb;
    stroke-width: 3;
    cursor: pointer;

    &.selected {
      fill: #4263eb;
    }
  }
}

.chart-empty {
  display: grid;
  height: 64px;
  place-items: center;
  color: #a0a6ae;
  font-size: 10px;
}

.funds-body {
  display: grid;
  min-height: 0;
  flex: 1;
  grid-template-columns: 245px minmax(0, 1fr);
  margin-top: 10px;
  border-top: 1px solid #eceff2;
}

.funds-timeline {
  display: flex;
  min-height: 0;
  flex-direction: column;
  padding: 14px;
  border-right: 1px solid #eceff2;
  background: #fafbfc;
}

.primary-small,
.secondary-small {
  min-height: 30px;
  padding: 0 10px;
  border-radius: 7px;
  font-size: 10px;
  cursor: pointer;
}

.primary-small {
  border: 1px solid #4263eb;
  background: #4263eb;
  color: #fff;
}

.secondary-small {
  border: 1px solid #dce1e6;
  background: #fff;
  color: #59616c;
}

.timeline-list {
  min-height: 0;
  margin-top: 10px;
  overflow-y: auto;
}

.timeline-item {
  display: grid;
  width: 100%;
  grid-template-columns: 12px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 9px 7px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  text-align: left;
  cursor: pointer;

  &:hover,
  &.active {
    background: #edf2ff;
  }
}

.timeline-dot {
  width: 8px;
  height: 8px;
  border: 2px solid #91a5e9;
  border-radius: 50%;
  background: #fff;
}

.timeline-content,
.timeline-value {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.timeline-content strong {
  overflow: hidden;
  color: #454c55;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.timeline-content small,
.timeline-value small {
  color: #9ca2aa;
  font-size: 8px;
}

.timeline-value {
  align-items: flex-end;
  color: #505863;
  font-size: 9px;
}

.positive {
  color: #16835e !important;
}

.negative {
  color: #d84a56 !important;
}

.timeline-empty,
.inline-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  color: #a0a6ae;
  text-align: center;
}

.timeline-empty {
  flex: 1;
  gap: 5px;
  font-size: 10px;

  i {
    font-size: 25px;
  }
}

.inline-empty {
  min-height: 54px;
  padding: 8px;
  border: 1px dashed #dfe3e8;
  border-radius: 8px;
  font-size: 10px;
  line-height: 1.6;
}

.funds-editor {
  min-width: 0;
  padding: 15px 18px;
  overflow-y: auto;
}

.editor-top-row,
.money-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.editor-top-row label,
.snapshot-note {
  display: flex;
  flex-direction: column;
  gap: 5px;
  color: #727a84;
  font-size: 10px;
}

input,
select,
textarea {
  box-sizing: border-box;
  border: 1px solid #dfe3e8;
  border-radius: 7px;
  outline: none;
  background: #fff;
  color: #333a43;
  font-family: inherit;
  font-size: 11px;

  &:focus {
    border-color: #91a5e9;
    box-shadow: 0 0 0 3px rgba(66, 99, 235, 0.08);
  }
}

.editor-top-row input {
  height: 34px;
  padding: 0 9px;
}

.money-section {
  margin-top: 17px;
}

.money-panel {
  min-width: 0;
  padding: 10px;
  border: 1px solid #e7eaee;
  border-radius: 9px;

  header {
    margin-bottom: 7px;
  }

  header button {
    border: 0;
    background: transparent;
    color: #4263eb;
    font-size: 9px;
    cursor: pointer;
  }
}

.money-row {
  display: grid;
  grid-template-columns: minmax(90px, 1fr) 110px auto 20px;
  align-items: center;
  gap: 5px;
  margin-top: 5px;

  > input {
    min-width: 0;
    height: 31px;
    padding: 0 7px;
  }

  &.debt-row {
    grid-template-columns: minmax(90px, 1fr) 110px 20px;
  }
}

.amount-input {
  display: flex;
  height: 31px;
  align-items: center;
  gap: 3px;
  padding-left: 7px;
  border: 1px solid #dfe3e8;
  border-radius: 7px;

  span {
    color: #9aa1aa;
    font-size: 10px;
  }

  input {
    width: 100%;
    min-width: 0;
    height: 100%;
    padding: 0 5px 0 0;
    border: 0;
    box-shadow: none;
  }
}

.liquid-check {
  display: flex;
  align-items: center;
  gap: 3px;
  color: #8a929c;
  font-size: 8px;
  white-space: nowrap;
}

.plan-list {
  margin-top: 8px;
}

.plan-row {
  display: grid;
  grid-template-columns:
    minmax(130px, 1fr) 72px 120px 125px 22px;
  align-items: center;
  gap: 6px;
  margin-top: 6px;

  input,
  select {
    min-width: 0;
    height: 32px;
    padding: 0 7px;
  }
}

.coverage-row {
  display: grid;
  grid-template-columns: auto minmax(100px, 1fr) 38px;
  align-items: center;
  gap: 9px;
  margin-top: 10px;
  color: #767e88;
  font-size: 9px;
}

.coverage-track {
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: #edf0f3;

  i {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #37b28c, #75d5b7);
  }
}

.snapshot-note {
  margin-top: 15px;

  textarea {
    padding: 8px;
    resize: vertical;
  }
}

.funds-footer {
  min-height: 60px;
  gap: 8px;
  padding: 10px 18px;
  border-top: 1px solid #e9ecef;
  background: #fafbfc;

  p {
    max-width: 560px;
    margin: 0 auto 0 0;
    line-height: 1.5;
  }
}

.primary-button,
.secondary-button,
.danger-button {
  min-width: 80px;
  height: 34px;
  border-radius: 7px;
  font-size: 11px;
  cursor: pointer;
}

.primary-button {
  border: 1px solid #4263eb;
  background: #4263eb;
  color: #fff;
}

.secondary-button {
  border: 1px solid #dfe3e8;
  background: #fff;
  color: #59616b;
}

.danger-button {
  border: 1px solid #f1c8cc;
  background: #fff;
  color: #d44c58;
}

.dark-theme {
  .funds-header,
  .funds-footer,
  .funds-body,
  .funds-timeline {
    border-color: #303842;
  }

  .funds-header h2,
  .summary-card strong,
  .section-heading strong,
  .timeline-header strong,
  .money-panel header strong,
  .timeline-content strong,
  .timeline-value {
    color: #dce1e7;
  }

  .funds-timeline,
  .funds-footer,
  .summary-card {
    background: #151a20;
  }

  .summary-card,
  .funds-chart,
  .money-panel,
  .inline-empty {
    border-color: #303842;
  }

  .summary-card.is-primary,
  .timeline-item.active,
  .timeline-item:hover {
    background: #202942;
  }

  input,
  select,
  textarea,
  .amount-input,
  .secondary-button,
  .secondary-small {
    border-color: #36404a;
    background: #20262e;
    color: #d8dde3;
  }

  .amount-input input {
    background: transparent;
  }

  .icon-button:hover {
    background: #252c35;
  }

  .coverage-track {
    background: #2a313a;
  }
}

@media (max-width: 900px) {
  .funds-dialog {
    min-width: 760px;
  }

  .funds-backdrop {
    justify-content: start;
    overflow-x: auto;
  }
}

/* FOCUS_UI_SYSTEM_20260911_V6
   范围条要和四张合计卡共用 20px 的左右基线，所以套一层
   host 提供内边距，而不是让子组件自己猜宿主的排版。 */
.funds-scope-host {
  padding: 0 20px;
}

/* 明细行多了一个账户 chip：四列变五列。
   chip 限宽 78px，保证 1120px 弹窗下两栏并排仍不换行。 */
.money-row {
  grid-template-columns:
    minmax(72px, 1fr) auto 104px auto 20px;
}

.money-row.debt-row {
  grid-template-columns: minmax(72px, 1fr) auto 104px 20px;
}

.money-row :deep(.fr-chip) {
  max-width: 78px;
}

/* 自适应图表的三种形态高度不同，给一个下限
   避免切换样本数时整个弹窗跳动。 */
.funds-chart {
  min-height: 172px;
  padding: 11px 14px 10px;
}
</style>
