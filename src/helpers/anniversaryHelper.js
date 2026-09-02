// 纪念日（倒数日 / 正计时 / 生日）计算逻辑
// 依赖 solarlunar 做农历<->公历转换，1900-2100 年范围内可用

import moment from "moment";
import solarLunar from "solarlunar";

function getLunarYearOfDate(dateStr) {
  let m = moment(dateStr, "YYYY-MM-DD");
  let lunar = solarLunar.solar2lunar(m.year(), m.month() + 1, m.date());
  return lunar.lYear;
}

// 给定一个"目标农历年份"，把纪念日换算成该年对应的公历日期
function toSolarMoment(targetYear, item) {
  if (item.dateType === "lunar") {
    let result = solarLunar.lunar2solar(targetYear, item.lunarMonth, item.lunarDay, !!item.lunarLeap);
    if (!result && item.lunarLeap) {
      // 有些年份没有对应的闰月，退回到当年的非闰月同月同日
      result = solarLunar.lunar2solar(targetYear, item.lunarMonth, item.lunarDay, false);
    }
    if (!result) return null;
    return moment(`${result.cYear}-${String(result.cMonth).padStart(2, "0")}-${String(result.cDay).padStart(2, "0")}`, "YYYY-MM-DD");
  } else {
    let base = moment(item.date, "YYYY-MM-DD");
    return moment(`${targetYear}-${base.format("MM-DD")}`, "YYYY-MM-DD");
  }
}

export default {
  /**
   * 把一个公历日期转换成农历信息，用于新建纪念日时给用户看"农历八月十五"这样的提示
   */
  solarToLunarInfo(dateStr) {
    let m = moment(dateStr, "YYYY-MM-DD");
    let lunar = solarLunar.solar2lunar(m.year(), m.month() + 1, m.date());
    return {
      lunarYear: lunar.lYear,
      lunarMonth: lunar.lMonth,
      lunarDay: lunar.lDay,
      isLeap: lunar.isLeap,
      text: `${lunar.monthCn}${lunar.dayCn}`,
    };
  },

  /**
   * 判断某一具体日期(YYYYMMDD) 是否正好是这个纪念日"今年这一轮"的发生日
   * 用于月历格子打点，不关心过去/未来，只关心月/日是否匹配
   */
  occursOn(item, dateStr) {
    let m = moment(dateStr, "YYYYMMDD");
    if (item.type === "countup" || (item.type === "countdown" && !item.repeatYearly)) {
      return item.date === m.format("YYYY-MM-DD");
    }
    if (item.dateType === "lunar") {
      let lunar = solarLunar.solar2lunar(m.year(), m.month() + 1, m.date());
      return lunar.lMonth === item.lunarMonth && lunar.lDay === item.lunarDay && !!lunar.isLeap === !!item.lunarLeap;
    } else {
      let base = moment(item.date, "YYYY-MM-DD");
      return m.month() === base.month() && m.date() === base.date();
    }
  },

  /**
   * 计算一个纪念日相对"今天"的展示数据：
   * - countup: daysElapsed（已经过去多少天）
   * - countdown / birthday: nextDateStr（下一次发生的公历日期）、daysLeft（还有多少天，可能为负表示已过期且不再重复）
   * - birthday 额外返回 age（即将迎来第几岁）
   */
  calc(item, today) {
    today = today ? moment(today, "YYYYMMDD") : moment().startOf("day");

    if (item.type === "countup") {
      let start = moment(item.date, "YYYY-MM-DD");
      return {
        id: item.id,
        daysElapsed: today.diff(start, "days"),
        nextDateStr: null,
        isPast: true,
      };
    }

    if (item.type === "countdown" && !item.repeatYearly) {
      let target = moment(item.date, "YYYY-MM-DD");
      let daysLeft = target.diff(today, "days");
      return {
        id: item.id,
        nextDateStr: target.format("YYYYMMDD"),
        daysLeft,
        isPast: daysLeft < 0,
      };
    }

    // 每年重复的倒数日 / 生日：滚动寻找未来最近的一次发生日
    let baseYear = item.dateType === "lunar" ? getLunarYearOfDate(today.format("YYYY-MM-DD")) : today.year();
    let candidate = toSolarMoment(baseYear, item);
    let guard = 0;
    while (candidate && candidate.isBefore(today, "day") && guard < 3) {
      baseYear += 1;
      candidate = toSolarMoment(baseYear, item);
      guard++;
    }
    if (!candidate) return null;

    let daysLeft = candidate.diff(today, "days");
    let result = {
      id: item.id,
      nextDateStr: candidate.format("YYYYMMDD"),
      daysLeft,
      isPast: false,
    };

    if (item.type === "birthday") {
      let birthYear = item.dateType === "lunar" ? getLunarYearOfDate(item.date) : moment(item.date, "YYYY-MM-DD").year();
      result.age = candidate.year() - birthYear;
    }

    return result;
  },

  /**
   * 获取未来 N 天内会发生的纪念日列表（countup 没有"下一次发生日"的概念，不参与）
   */
  getUpcomingAnniversaries(list, days, today) {
    days = days || 30;
    today = today ? moment(today, "YYYYMMDD") : moment().startOf("day");
    let endDate = today.clone().add(days, "days");
    let results = [];

    list.forEach((item) => {
      if (item.type === "countup") return;
      let calcResult = this.calc(item, today.format("YYYYMMDD"));
      if (!calcResult || !calcResult.nextDateStr) return;
      let occurDate = moment(calcResult.nextDateStr, "YYYYMMDD");
      if (occurDate.isSameOrAfter(today, "day") && occurDate.isSameOrBefore(endDate, "day")) {
        results.push({
          id: item.id,
          name: item.name,
          date: calcResult.nextDateStr,
          daysLeft: calcResult.daysLeft,
          color: item.color,
          type: item.type,
          age: calcResult.age,
          source: "anniversary",
        });
      }
    });

    return results;
  },
};
