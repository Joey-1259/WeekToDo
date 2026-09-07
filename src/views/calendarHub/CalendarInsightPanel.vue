<template>
  <aside class="calendar-insight-panel">
    <section
      class="daily-inspiration"
      :class="`theme-${themeIndex}`"
    >
      <div class="inspiration-decoration">
        <span></span>
        <span></span>
        <span></span>
      </div>

      <header>
        <span>
          <i class="bi-sun"></i>
          今日灵感
        </span>

        <button
          type="button"
          title="换一句"
          aria-label="换一句每日灵感"
          @click="refreshQuote"
        >
          <i class="bi-arrow-clockwise"></i>
        </button>
      </header>

      <blockquote>
        “{{ currentQuote.text }}”
      </blockquote>

      <footer>
        <span>— {{ currentQuote.author }}</span>
        <small>{{ todayLabel }}</small>
      </footer>
    </section>

    <section class="time-progress-card">
      <header>
        <div>
          <strong>时间进度</strong>
          <span>看见长期节奏，不被短期噪音打断</span>
        </div>

        <span class="quarter-badge">
          Q{{ currentQuarter }}
        </span>
      </header>

      <div class="progress-item">
        <div class="progress-label">
          <span>
            第 {{ currentQuarter }} 季度
          </span>
          <strong>{{ quarterProgress }}%</strong>
        </div>

        <div
          class="progress-track"
          role="progressbar"
          :aria-valuenow="quarterProgress"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-label="本季度进度"
        >
          <i
            :style="{
              width: `${quarterProgress}%`,
            }"
          ></i>
        </div>
      </div>

      <div class="progress-item">
        <div class="progress-label">
          <span>{{ currentYear }} 年</span>
          <strong>{{ yearProgress }}%</strong>
        </div>

        <div
          class="progress-track is-year"
          role="progressbar"
          :aria-valuenow="yearProgress"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-label="年度进度"
        >
          <i
            :style="{
              width: `${yearProgress}%`,
            }"
          ></i>
        </div>
      </div>

      <div class="time-statistics">
        <div>
          <strong>{{ quarterDaysRemaining }}</strong>
          <span>本季度剩余天数</span>
        </div>

        <div>
          <strong>{{ yearDaysRemaining }}</strong>
          <span>本年度剩余天数</span>
        </div>
      </div>
    </section>
  </aside>
</template>

<script>
import moment from "moment";

/* CALENDAR_INSIGHT_SIMPLIFIED_20260907_V1 */

const QUOTES = [
  {
    text: "种一棵树最好的时间是十年前，其次是现在。",
    author: "东方谚语",
  },
  {
    text: "重要的不是预测未来，而是让未来变得可能。",
    author: "安托万·德·圣埃克苏佩里",
  },
  {
    text: "你不需要看见整段楼梯，只需要迈出第一步。",
    author: "马丁·路德·金",
  },
  {
    text: "专注不是对更多事情说是，而是对大多数事情说不。",
    author: "史蒂夫·乔布斯",
  },
  {
    text: "伟大的事情，是由一系列微小事情汇聚而成的。",
    author: "文森特·梵高",
  },
  {
    text: "行动是治愈焦虑最有效的方式。",
    author: "佚名",
  },
  {
    text: "不要等待机会，而要创造机会。",
    author: "乔治·萧伯纳",
  },
  {
    text: "日拱一卒，功不唐捐。",
    author: "胡适",
  },
  {
    text: "完成胜过完美。",
    author: "产品实践原则",
  },
  {
    text: "真正的效率，是为重要的事情留出时间。",
    author: "佚名",
  },
  {
    text: "每一个清晨，都是重新安排人生优先级的机会。",
    author: "佚名",
  },
  {
    text: "长期主义，是把今天放在更长的时间尺度中。",
    author: "产品实践原则",
  },
];

export default {
  name: "CalendarInsightPanel",

  data() {
    return {
      quoteOffset: 0,
    };
  },

  computed: {
    now() {
      /*
       * 这些计算不需要秒级刷新。
       * 页面重新进入时 Vue 会重新计算。
       */
      return moment();
    },

    dateSeed() {
      return Math.floor(
        moment().startOf("day").valueOf() /
          (24 * 60 * 60 * 1000)
      );
    },

    quoteIndex() {
      return (
        this.dateSeed + this.quoteOffset
      ) % QUOTES.length;
    },

    currentQuote() {
      return QUOTES[this.quoteIndex];
    },

    themeIndex() {
      return this.quoteIndex % 4;
    },

    todayLabel() {
      return moment().format("M月D日 · dddd");
    },

    currentYear() {
      return moment().year();
    },

    currentQuarter() {
      return Math.floor(moment().month() / 3) + 1;
    },

    quarterStart() {
      const startMonth =
        (this.currentQuarter - 1) * 3;

      return moment()
        .month(startMonth)
        .startOf("month");
    },

    quarterEnd() {
      const endMonth =
        this.currentQuarter * 3 - 1;

      return moment()
        .month(endMonth)
        .endOf("month");
    },

    quarterProgress() {
      const total =
        this.quarterEnd.valueOf() -
        this.quarterStart.valueOf();

      const elapsed =
        moment().valueOf() -
        this.quarterStart.valueOf();

      return Math.min(
        100,
        Math.max(
          0,
          Math.round((elapsed / total) * 100)
        )
      );
    },

    quarterDaysRemaining() {
      return Math.max(
        0,
        this.quarterEnd
          .clone()
          .startOf("day")
          .diff(moment().startOf("day"), "days")
      );
    },

    dayOfYear() {
      return moment().dayOfYear();
    },

    daysInYear() {
      return moment().isLeapYear() ? 366 : 365;
    },

    yearProgress() {
      return Math.min(
        100,
        Math.max(
          0,
          Math.round(
            (this.dayOfYear / this.daysInYear) *
              100
          )
        )
      );
    },

    yearDaysRemaining() {
      return Math.max(
        0,
        this.daysInYear - this.dayOfYear
      );
    },
  },

  mounted() {
    const today = moment().format("YYYY-MM-DD");

    try {
      const state = JSON.parse(
        localStorage.getItem(
          "calendarDailyInspiration"
        ) || "{}"
      );

      if (state.date === today) {
        this.quoteOffset = Number(
          state.offset || 0
        );
      }
    } catch {
      this.quoteOffset = 0;
    }
  },

  methods: {
    refreshQuote() {
      this.quoteOffset =
        (this.quoteOffset + 1) % QUOTES.length;

      localStorage.setItem(
        "calendarDailyInspiration",
        JSON.stringify({
          date: moment().format("YYYY-MM-DD"),
          offset: this.quoteOffset,
        })
      );
    },
  },
};
</script>

<style scoped lang="scss">
.calendar-insight-panel {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  gap: 11px;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 2px 3px 12px 0;
  scrollbar-width: thin;
}

.daily-inspiration {
  position: relative;
  min-height: 158px;
  flex: 0 0 auto;
  padding: 16px;
  overflow: hidden;
  border-radius: 15px;
  color: #fff;
  box-shadow:
    0 10px 28px rgba(46, 61, 100, 0.13);

  &.theme-0 {
    background:
      linear-gradient(
        145deg,
        #667eea,
        #764ba2
      );
  }

  &.theme-1 {
    background:
      linear-gradient(
        145deg,
        #2f80ed,
        #56ccf2
      );
  }

  &.theme-2 {
    background:
      linear-gradient(
        145deg,
        #11998e,
        #38b87c
      );
  }

  &.theme-3 {
    background:
      linear-gradient(
        145deg,
        #e65c88,
        #f2a65a
      );
  }

  header,
  footer {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  header > span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
  }

  header button {
    display: grid;
    width: 28px;
    height: 28px;
    place-items: center;
    border: 0;
    border-radius: 7px;
    background: rgba(255, 255, 255, 0.13);
    color: #fff;
    cursor: pointer;

    &:hover {
      background: rgba(255, 255, 255, 0.22);
    }
  }

  blockquote {
    position: relative;
    z-index: 2;
    min-height: 52px;
    margin: 17px 0 11px;
    font-size: 14px;
    font-weight: 560;
    line-height: 1.65;
    letter-spacing: 0.01em;
  }

  footer {
    color: rgba(255, 255, 255, 0.76);
    font-size: 9px;
  }
}

.inspiration-decoration {
  position: absolute;
  inset: 0;
  pointer-events: none;

  span {
    position: absolute;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.09);
  }

  span:nth-child(1) {
    width: 160px;
    height: 160px;
    top: -96px;
    right: -42px;
  }

  span:nth-child(2) {
    width: 82px;
    height: 82px;
    right: 34px;
    bottom: -48px;
  }

  span:nth-child(3) {
    width: 42px;
    height: 42px;
    top: 66px;
    right: 70px;
  }
}

.time-progress-card {
  flex: 0 0 auto;
  padding: 15px;
  border: 1px solid #e9ecf0;
  border-radius: 14px;
  background: #fff;

  .dark-theme & {
    border-color: #303842;
    background: #181e25;
  }

  > header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;

    > div {
      display: flex;
      min-width: 0;
      flex-direction: column;
      gap: 3px;
    }

    strong {
      color: #353a42;
      font-size: 12px;

      .dark-theme & {
        color: #e0e4e9;
      }
    }

    span {
      overflow: hidden;
      color: #9ba1aa;
      font-size: 9px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

.quarter-badge {
  flex: 0 0 auto;
  padding: 4px 8px;
  border-radius: 999px;
  background: #eef2ff;
  color: #4263eb !important;
  font-weight: 600;

  .dark-theme & {
    background: #202942;
    color: #8097ee !important;
  }
}

.progress-item + .progress-item {
  margin-top: 12px;
}

.progress-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  color: #777e88;
  font-size: 10px;

  strong {
    color: #535a64;
    font-size: 9px;

    .dark-theme & {
      color: #b6bdc6;
    }
  }
}

.progress-track {
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: #edf0f3;

  .dark-theme & {
    background: #2a313a;
  }

  i {
    display: block;
    height: 100%;
    border-radius: inherit;
    background:
      linear-gradient(
        90deg,
        #4263eb,
        #748ffc
      );
    transition: width 0.4s ease;
  }

  &.is-year i {
    background:
      linear-gradient(
        90deg,
        #37b28c,
        #75d5b7
      );
  }
}

.time-statistics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px;
  margin-top: 13px;

  div {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 9px;
    border-radius: 8px;
    background: #f7f8fa;

    .dark-theme & {
      background: #20262e;
    }
  }

  strong {
    color: #424850;
    font-size: 13px;

    .dark-theme & {
      color: #dce1e7;
    }
  }

  span {
    color: #9ca2ab;
    font-size: 8px;
  }
}
</style>
