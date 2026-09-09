<template>
  <div class="ft-root">
    <!-- 构成条：任何样本数下都显示。"钱由什么组成"比"钱怎么变"更常被看。 -->
    <div v-if="latest" class="ft-composition">
      <div class="ft-comp-head">
        <span class="ft-comp-title">当前构成</span>
        <span class="ft-comp-net">
          净资产 <strong>{{ money(latest.net) }}</strong>
        </span>
      </div>

      <div class="ft-bar" role="img" :aria-label="compositionLabel">
        <span
          v-for="seg in segments"
          :key="seg.key"
          class="ft-bar-seg"
          :class="'is-' + seg.key"
          :style="{ width: seg.width + '%' }"
          :title="seg.label + ' ' + money(seg.value)"
        ></span>
      </div>

      <div class="ft-legend">
        <span v-for="seg in segments" :key="seg.key" class="ft-legend-item">
          <i :class="'is-' + seg.key"></i>
          {{ seg.label }}
          <b>{{ money(seg.value) }}</b>
        </span>
      </div>
    </div>

    <!-- 0 个节点 -->
    <p v-if="!series.length" class="ft-empty">
      记录第一个资金节点后，这里会显示构成与变化
    </p>

    <!-- 1 个节点：不画趋势，只给基准说明 -->
    <p v-else-if="series.length === 1" class="ft-empty is-soft">
      已有 1 个节点作为基准。再记录一次，就能看到变化量
    </p>

    <!--
      2 个节点：哑铃对比图。

      为什么不用折线：两个点归一化后必然是一条对角线，斜率与实际
      变化幅度无关（差 3 块和差 30 万画出来一模一样）；若两值相等
      还会被除零保护压成一根横线——那正是重做前的样子。
      哑铃图把"两个值各自多少 + 差多少"直接说清楚。
    -->
    <div v-else-if="series.length === 2" class="ft-dumbbell">
      <div
        v-for="(point, index) in series"
        :key="point.id"
        class="ft-dumb-row"
        :class="{ 'is-latest': index === series.length - 1 }"
      >
        <span class="ft-dumb-label">
          {{ point.label }}
          <small>{{ point.dateText }}</small>
        </span>

        <span class="ft-dumb-track">
          <span
            class="ft-dumb-fill"
            :style="{ width: barWidth(point.net) + '%' }"
          ></span>
        </span>

        <strong class="ft-dumb-value">{{ money(point.net) }}</strong>
      </div>

      <div class="ft-delta-row">
        <span
          class="ft-delta"
          :class="{
            'is-up': delta > 0,
            'is-down': delta < 0,
            'is-flat': delta === 0,
          }"
        >
          <template v-if="delta === 0">两次记录净资产持平</template>
          <template v-else>
            {{ delta > 0 ? "增加" : "减少" }}
            {{ money(Math.abs(delta)) }}
            <small v-if="deltaPercent !== null">
              （{{ delta > 0 ? "+" : "-" }}{{ deltaPercent }}%）
            </small>
          </template>
        </span>
      </div>
    </div>

    <!-- 3+ 个节点：面积折线。保留纵横比，描边不随拉伸变形。 -->
    <div v-else class="ft-line-wrap">
      <svg
        class="ft-line"
        :viewBox="`0 0 ${W} ${H}`"
        role="img"
        aria-label="净资产变化趋势"
        @mouseleave="hover = null"
      >
        <defs>
          <linearGradient id="ftArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#4263eb" stop-opacity="0.22" />
            <stop offset="100%" stop-color="#4263eb" stop-opacity="0" />
          </linearGradient>
        </defs>

        <!-- 零基线：没有它，"上涨"是相对极小值而非相对 0，容易误读 -->
        <line
          v-if="showZero"
          class="ft-zero"
          :x1="PAD.l"
          :x2="W - PAD.r"
          :y1="zeroY"
          :y2="zeroY"
        />

        <line
          v-for="tick in ticks"
          :key="'g' + tick.value"
          class="ft-grid"
          :x1="PAD.l"
          :x2="W - PAD.r"
          :y1="tick.y"
          :y2="tick.y"
        />

        <text
          v-for="tick in ticks"
          :key="'t' + tick.value"
          class="ft-axis"
          :x="PAD.l - 6"
          :y="tick.y + 3"
          text-anchor="end"
        >
          {{ tick.text }}
        </text>

        <path :d="areaPath" fill="url(#ftArea)" />

        <path
          class="ft-stroke"
          :d="linePath"
          fill="none"
          vector-effect="non-scaling-stroke"
        />

        <g v-for="point in plotted" :key="point.id">
          <circle
            class="ft-dot"
            :class="{ 'is-hover': hover === point.id }"
            :cx="point.x"
            :cy="point.y"
            :r="hover === point.id ? 5 : 3.4"
          />
          <rect
            class="ft-hit"
            :x="point.x - 14"
            :y="PAD.t"
            width="28"
            :height="H - PAD.t - PAD.b"
            @mouseenter="hover = point.id"
          />
        </g>
      </svg>

      <div class="ft-line-foot">
        <span v-if="hovered" class="ft-tip">
          <strong>{{ hovered.label }}</strong>
          <span>{{ hovered.dateText }}</span>
          <b>{{ money(hovered.net) }}</b>
        </span>
        <span v-else class="ft-tip is-hint">
          {{ series.length }} 个节点 · 悬停查看某一次记录
        </span>
      </div>
    </div>
  </div>
</template>

<script>
/* FOCUS_UI_SYSTEM_20260911_V6 */

/**
 * 资金趋势可视化。
 *
 * 核心设计：图形类型随样本数自适应。
 * 折线图在 n < 3 时没有信息量（两点永远是直线），强行画只会
 * 产生"看起来很诡异"的图形——这是可视化通则，不是本项目特例。
 */

const W = 720;
const H = 190;
const PAD = { t: 14, r: 12, b: 22, l: 58 };

export default {
  name: "FundsTrendChart",

  props: {
    /** [{ id, label, dateText, net, assetTotal, liabilityTotal, liquidTotal }] */
    series: { type: Array, default: () => [] },
  },

  data() {
    return { hover: null, W, H, PAD };
  },

  computed: {
    latest() {
      return this.series.length ? this.series[this.series.length - 1] : null;
    },

    delta() {
      if (this.series.length < 2) return 0;

      const last = this.series[this.series.length - 1];
      const prev = this.series[this.series.length - 2];

      return last.net - prev.net;
    },

    deltaPercent() {
      if (this.series.length < 2) return null;

      const base = Math.abs(this.series[this.series.length - 2].net);
      if (!base) return null;

      return ((Math.abs(this.delta) / base) * 100).toFixed(1);
    },

    segments() {
      const point = this.latest;
      if (!point) return [];

      const liquid = Math.max(0, point.liquidTotal || 0);
      const fixed = Math.max(0, (point.assetTotal || 0) - liquid);
      const debt = Math.max(0, point.liabilityTotal || 0);
      const total = liquid + fixed + debt || 1;

      return [
        { key: "liquid", label: "可调度资产", value: liquid,
          width: (liquid / total) * 100 },
        { key: "fixed", label: "其他资产", value: fixed,
          width: (fixed / total) * 100 },
        { key: "debt", label: "负债", value: debt,
          width: (debt / total) * 100 },
      ].filter((seg) => seg.value > 0);
    },

    compositionLabel() {
      return this.segments
        .map((seg) => seg.label + " " + this.money(seg.value))
        .join("，");
    },

    /* ---------- 折线（n >= 3） ---------- */

    bounds() {
      const values = this.series.map((point) => point.net);
      let min = Math.min(...values, 0);
      let max = Math.max(...values, 0);

      if (min === max) {
        // 全部相等时给一个对称的窗口，避免除零把线压平到边缘。
        const pad = Math.abs(max) * 0.1 || 1;
        min -= pad;
        max += pad;
      } else {
        const pad = (max - min) * 0.12;
        min -= pad;
        max += pad;
      }

      return { min, max };
    },

    plotted() {
      const { min, max } = this.bounds;
      const span = max - min || 1;
      const innerW = W - PAD.l - PAD.r;
      const innerH = H - PAD.t - PAD.b;
      const step = this.series.length > 1
        ? innerW / (this.series.length - 1)
        : 0;

      return this.series.map((point, index) => ({
        ...point,
        x: PAD.l + step * index,
        y: PAD.t + innerH - ((point.net - min) / span) * innerH,
      }));
    },

    linePath() {
      return this.plotted
        .map((p, i) => (i ? "L" : "M") + p.x.toFixed(1) + " " + p.y.toFixed(1))
        .join(" ");
    },

    areaPath() {
      if (!this.plotted.length) return "";

      const first = this.plotted[0];
      const last = this.plotted[this.plotted.length - 1];
      const base = H - PAD.b;

      return (
        this.linePath +
        " L" + last.x.toFixed(1) + " " + base +
        " L" + first.x.toFixed(1) + " " + base + " Z"
      );
    },

    zeroY() {
      const { min, max } = this.bounds;
      const span = max - min || 1;
      const innerH = H - PAD.t - PAD.b;

      return PAD.t + innerH - ((0 - min) / span) * innerH;
    },

    showZero() {
      return this.bounds.min < 0 && this.bounds.max > 0;
    },

    ticks() {
      const { min, max } = this.bounds;
      const innerH = H - PAD.t - PAD.b;

      return [0, 0.5, 1].map((ratio) => {
        const value = min + (max - min) * (1 - ratio);

        return {
          value,
          y: PAD.t + innerH * ratio,
          text: this.compact(value),
        };
      });
    },

    hovered() {
      return this.plotted.find((point) => point.id === this.hover) || null;
    },
  },

  methods: {
    money(value) {
      const number = Number(value) || 0;

      return (
        "¥" +
        number.toLocaleString("zh-CN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      );
    },

    compact(value) {
      const number = Number(value) || 0;
      const abs = Math.abs(number);
      const sign = number < 0 ? "-" : "";

      if (abs >= 1e8) return sign + (abs / 1e8).toFixed(1) + "亿";
      if (abs >= 1e4) return sign + (abs / 1e4).toFixed(1) + "万";

      return sign + Math.round(abs);
    },

    /** 哑铃图的条宽按绝对值归一，负数也能看出量级。 */
    barWidth(value) {
      const max = Math.max(
        ...this.series.map((point) => Math.abs(point.net)),
        1
      );

      return Math.max(2, (Math.abs(Number(value) || 0) / max) * 100);
    },
  },
};
</script>

<style scoped lang="scss">
.ft-root {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ft-composition {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.ft-comp-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.ft-comp-title {
  color: #6d747e;
  font-size: 11.5px;
}

.ft-comp-net {
  color: #8d949d;
  font-size: 11.5px;

  strong {
    color: #24282e;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }
}

.ft-bar {
  display: flex;
  height: 10px;
  border-radius: 6px;
  background: #f0f2f5;
  overflow: hidden;
}

.ft-bar-seg {
  height: 100%;
  transition: width 0.24s ease;

  &.is-liquid { background: #4263eb; }
  &.is-fixed { background: #8da2fb; }
  &.is-debt { background: #e8735f; }
}

.ft-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.ft-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #79808a;
  font-size: 11px;

  i {
    width: 8px;
    height: 8px;
    border-radius: 2px;

    &.is-liquid { background: #4263eb; }
    &.is-fixed { background: #8da2fb; }
    &.is-debt { background: #e8735f; }
  }

  b {
    color: #4a515b;
    font-variant-numeric: tabular-nums;
  }
}

.ft-empty {
  margin: 0;
  padding: 22px 0;
  color: #9aa0a9;
  font-size: 12px;
  text-align: center;

  &.is-soft {
    padding: 14px 0;
  }
}

/* ---------- 哑铃对比 ---------- */

.ft-dumbbell {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.ft-dumb-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ft-dumb-label {
  display: flex;
  width: 132px;
  flex: 0 0 132px;
  flex-direction: column;
  color: #4a515b;
  font-size: 12px;

  small {
    color: #a8aeb7;
    font-size: 10.5px;
  }
}

.ft-dumb-track {
  position: relative;
  height: 8px;
  flex: 1 1 auto;
  border-radius: 5px;
  background: #f0f2f5;
  overflow: hidden;
}

.ft-dumb-fill {
  display: block;
  height: 100%;
  border-radius: 5px;
  background: #c3ceff;
  transition: width 0.24s ease;
}

.ft-dumb-row.is-latest .ft-dumb-fill {
  background: #4263eb;
}

.ft-dumb-value {
  width: 128px;
  flex: 0 0 128px;
  color: #24282e;
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.ft-delta-row {
  display: flex;
  justify-content: flex-end;
  padding-top: 2px;
}

.ft-delta {
  padding: 3px 9px;
  border-radius: 12px;
  background: #f2f4f7;
  color: #6d747e;
  font-size: 11.5px;

  &.is-up { background: #e7f6ec; color: #2f7d4a; }
  &.is-down { background: #fdeceb; color: #c0402f; }

  small { opacity: 0.8; }
}

/* ---------- 折线 ---------- */

.ft-line-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* 关键：不用 preserveAspectRatio="none"。之前正是它把
   3px 描边横向拉伸、纵向压扁，线看起来又扁又虚。 */
.ft-line {
  width: 100%;
  height: auto;
  display: block;
}

.ft-stroke {
  stroke: #4263eb;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.ft-grid {
  stroke: #eef0f3;
  stroke-width: 1;
}

.ft-zero {
  stroke: #d6dbe2;
  stroke-width: 1;
  stroke-dasharray: 3 3;
}

.ft-axis {
  fill: #a8aeb7;
  font-size: 9.5px;
}

.ft-dot {
  fill: #fff;
  stroke: #4263eb;
  stroke-width: 2;
  transition: r 0.12s ease;

  &.is-hover { fill: #4263eb; }
}

.ft-hit {
  fill: transparent;
}

.ft-line-foot {
  min-height: 18px;
}

.ft-tip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #6d747e;
  font-size: 11px;

  strong { color: #24282e; }
  b { color: #4263eb; font-variant-numeric: tabular-nums; }

  &.is-hint { color: #a8aeb7; }
}

.dark-theme {
  .ft-comp-net strong, .ft-dumb-value, .ft-tip strong { color: #e3e7ec; }
  .ft-bar, .ft-dumb-track { background: #242b34; }
  .ft-legend-item b, .ft-dumb-label { color: #b9c0c9; }
  .ft-grid { stroke: #262d36; }
  .ft-zero { stroke: #39414c; }
  .ft-dot { fill: #1a1f26; }
  .ft-delta { background: #242b34; color: #b9c0c9; }
  .ft-delta.is-up { background: #16301f; color: #6fcf97; }
  .ft-delta.is-down { background: #33191a; color: #f08c7d; }
}
</style>
