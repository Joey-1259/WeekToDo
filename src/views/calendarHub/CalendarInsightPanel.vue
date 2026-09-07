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
          <span>把注意力放回今天</span>
        </div>

        <span class="week-badge">
          第 {{ weekNumber }} 周
        </span>
      </header>

      <div class="progress-item">
        <div class="progress-label">
          <span>本周</span>
          <strong>{{ weekProgress }}%</strong>
        </div>

        <div
          class="progress-track"
          role="progressbar"
          :aria-valuenow="weekProgress"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-label="本周进度"
        >
          <i :style="{ width: `${weekProgress}%` }"></i>
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
          <i :style="{ width: `${yearProgress}%` }"></i>
        </div>
      </div>

      <div class="time-statistics">
        <div>
          <strong>{{ dayOfYear }}</strong>
          <span>今年第几天</span>
        </div>

        <div>
          <strong>{{ daysRemaining }}</strong>
          <span>今年剩余天数</span>
        </div>
      </div>
    </section>

    <section class="next-moments-card">
      <header>
        <div>
          <strong>下一重要日</strong>
          <span>提前看见值得期待的时刻</span>
        </div>

        <button
          type="button"
          @click="$emit('open-anniversaries')"
        >
          查看全部
        </button>
      </header>

      <div
        v-if="!upcomingAnniversaries.length"
        class="moments-empty"
      >
        <i class="bi-calendar2-heart"></i>
        <span>还没有即将到来的纪念日</span>
        <button
          type="button"
          @click="$emit('open-anniversaries')"
        >
          添加一个
        </button>
      </div>

      <button
        v-for="item in upcomingAnniversaries"
        v-else
        :key="`${item.id}-${item.date}`"
        type="button"
        class="moment-row"
        @click="$emit('day-click', item.date)"
      >
        <i
          class="moment-color"
          :style="{
            backgroundColor: item.color || '#748ffc',
          }"
        ></i>

        <span class="moment-main">
          <strong>{{ item.name }}</strong>
          <small>{{ formatDate(item.date) }}</small>
        </span>

        <span class="moment-countdown">
          {{ countdownText(item.daysLeft) }}
        </span>
      </button>
    </section>
  </aside>
</template>

<script>
import moment from "moment";
import anniversaryHelper from "../../helpers/anniversaryHelper";

/* CALENDAR_HUB_REDESIGN_20260907_V1 */

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
    text: "生活不是等待风暴过去，而是学会在雨中起舞。",
    author: "维维安·格林",
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
];

export default {
  name: "CalendarInsightPanel",

  props: {
    anniversaryList: {
      type: Array,
      default: () => [],
    },
  },

  emits: [
    "day-click",
    "open-anniversaries",
  ],

  data() {
    return {
      quoteOffset: 0,
    };
  },

  computed: {
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

    weekNumber() {
      return moment().isoWeek();
    },

    dayOfYear() {
      return moment().dayOfYear();
    },

    daysInYear() {
      return moment().isLeapYear() ? 366 : 365;
    },

    daysRemaining() {
      return this.daysInYear - this.dayOfYear;
    },

    yearProgress() {
      return Math.min(
        100,
        Math.max(
          0,
          Math.round(
            (this.dayOfYear / this.daysInYear) * 100
          )
        )
      );
    },

    weekProgress() {
      const day = moment().isoWeekday();

      return Math.round((day / 7) * 100);
    },

    upcomingAnniversaries() {
      return anniversaryHelper
        .getUpcomingAnniversaries(
          this.anniversaryList,
          365
        )
        .slice(0, 3);
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

    formatDate(date) {
      return moment(date, "YYYYMMDD").format(
        "M月D日 ddd"
      );
    },

    countdownText(days) {
      if (days === 0) return "就是今天";
      if (days === 1) return "明天";
      return `还有 ${days} 天`;
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
  gap: 12px;
  overflow-y: auto;
  padding: 2px 2px 12px 0;
}

.daily-inspiration {
  position: relative;
  min-height: 196px;
  flex: 0 0 auto;
  padding: 18px;
  overflow: hidden;
  border-radius: 16px;
  color: #fff;
  box-shadow: 0 12px 30px rgba(46, 61, 100, 0.14);

  &.theme-0 {
    background:
      linear-gradient(
        145deg,
        #667eea 0%,
        #764ba2 100%
      );
  }

  &.theme-1 {
    background:
      linear-gradient(
        145deg,
        #2f80ed 0%,
        #56ccf2 100%
      );
  }

  &.theme-2 {
    background:
      linear-gradient(
        145deg,
        #11998e 0%,
        #38b87c 100%
      );
  }

  &.theme-3 {
    background:
      linear-gradient(
        145deg,
        #e65c88 0%,
        #f2a65a 100%
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
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
  }

  header button {
    display: grid;
    width: 30px;
    height: 30px;
    place-items: center;
    border: 0;
    border-radius: 8px;
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
    min-height: 78px;
    margin: 25px 0 17px;
    font-size: 17px;
    font-weight: 560;
    line-height: 1.75;
    letter-spacing: 0.015em;
  }

  footer {
    color: rgba(255, 255, 255, 0.78);
    font-size: 10px;
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
    width: 180px;
    height: 180px;
    top: -96px;
    right: -42px;
  }

  span:nth-child(2) {
    width: 92px;
    height: 92px;
    right: 34px;
    bottom: -48px;
  }

  span:nth-child(3) {
    width: 48px;
    height: 48px;
    top: 72px;
    right: 74px;
  }
}

.time-progress-card,
.next-moments-card {
  flex: 0 0 auto;
  padding: 16px;
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
    margin-bottom: 15px;

    > div {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    strong {
      color: #353a42;
      font-size: 13px;

      .dark-theme & {
        color: #e0e4e9;
      }
    }

    span {
      color: #9ba1aa;
      font-size: 10px;
    }
  }
}

.week-badge {
  padding: 4px 8px;
  border-radius: 999px;
  background: #eef2ff;
  color: #4263eb !important;
  white-space: nowrap;

  .dark-theme & {
    background: #202942;
    color: #8097ee !important;
  }
}

.progress-item + .progress-item {
  margin-top: 13px;
}

.progress-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  color: #777e88;
  font-size: 11px;

  strong {
    color: #535a64;
    font-size: 10px;

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
      linear-gradient(90deg, #4263eb, #748ffc);
    transition: width 0.4s ease;
  }

  &.is-year i {
    background:
      linear-gradient(90deg, #37b28c, #75d5b7);
  }
}

.time-statistics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 14px;

  div {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 9px 10px;
    border-radius: 9px;
    background: #f7f8fa;

    .dark-theme & {
      background: #20262e;
    }
  }

  strong {
    color: #424850;
    font-size: 14px;

    .dark-theme & {
      color: #dce1e7;
    }
  }

  span {
    color: #9ca2ab;
    font-size: 9px;
  }
}

.next-moments-card {
  min-height: 0;
  flex: 1;

  > header button {
    border: 0;
    background: transparent;
    color: #4263eb;
    font-size: 10px;
    cursor: pointer;

    .dark-theme & {
      color: #8198ef;
    }
  }
}

.moment-row {
  display: flex;
  width: 100%;
  min-height: 44px;
  align-items: center;
  gap: 9px;
  padding: 7px 5px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: #f5f7fa;
  }

  .dark-theme &:hover {
    background: #20262e;
  }
}

.moment-color {
  width: 4px;
  height: 27px;
  flex: 0 0 4px;
  border-radius: 999px;
}

.moment-main {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;

  strong {
    overflow: hidden;
    color: #454b54;
    font-size: 11px;
    font-weight: 550;
    text-overflow: ellipsis;
    white-space: nowrap;

    .dark-theme & {
      color: #d9dee4;
    }
  }

  small {
    color: #9ea4ad;
    font-size: 9px;
  }
}

.moment-countdown {
  flex: 0 0 auto;
  color: #4263eb;
  font-size: 9px;

  .dark-theme & {
    color: #8198ef;
  }
}

.moments-empty {
  display: flex;
  min-height: 100px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 7px;
  color: #a0a6af;
  font-size: 10px;

  i {
    font-size: 21px;
  }

  button {
    border: 0;
    background: transparent;
    color: #4263eb;
    font-size: 10px;
    cursor: pointer;
  }
}
</style>
