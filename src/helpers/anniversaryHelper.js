// 纪念日（倒数日 / 正计时 / 生日）计算逻辑
// 依赖本地内置的 solarLunarCore 做农历<->公历转换，1900-2100 年范围内可用
//
// 说明：此前这里依赖 npm 包 solarlunar，但该包 3.x 版本用 package.json 的 exports 字段
// 做条件导出，Webpack 4（本项目的打包器）无法正确识别，导致模块求值阶段直接报错，
// 引发应用整体白屏且无法被任何错误兜底逻辑捕获。现改为从本地 solarLunarCore.js 引入，
// 该文件是纯 ES 模块、无任何第三方依赖，从根源上消除这类风险。
//
// 本文件同时导出 computeNextOccurrence/calc、isOccurrenceOnDate/occursOn 等
// 「新旧两套命名」，是为了兼容 monthCalendar.vue / anniversaryList.vue 里已经存在的调用名。
import moment from "moment";
import { solar2lunar, lunar2solar } from "./solarLunarCore";

function safeSolar2Lunar(year, month, day) {
  try {
    let result = solar2lunar(year, month, day);
    return result === -1 ? null : result;
  } catch (e) {
    console.error("[anniversaryHelper] solar2lunar 调用失败：", e);
    return null;
  }
}

function safeLunar2Solar(year, month, day, isLeap) {
  try {
    let result = lunar2solar(year, month, day, isLeap);
    return result === -1 ? null : result;
  } catch (e) {
    console.error("[anniversaryHelper] lunar2solar 调用失败：", e);
    return null;
  }
}

function getLunarYearOfDate(dateStr) {
  let m = moment(dateStr, "YYYY-MM-DD");
  let lunar = safeSolar2Lunar(m.year(), m.month() + 1, m.date());
  return lunar ? lunar.lYear : m.year();
}

// 给定一个"目标农历年份"，把纪念日换算成该年对应的公历日期
function toSolarMoment(targetYear, item) {
  if (item.dateType === "lunar") {
    let result = safeLunar2Solar(targetYear, item.lunarMonth, item.lunarDay, !!item.lunarLeap);
    if (!result && item.lunarLeap) {
      result = safeLunar2Solar(targetYear, item.lunarMonth, item.lunarDay, false);
    }
    if (!result) return null;
    return moment(
      `${result.cYear}-${String(result.cMonth).padStart(2, "0")}-${String(result.cDay).padStart(2, "0")}`,
      "YYYY-MM-DD"
    );
  } else {
    let base = moment(item.date, "YYYY-MM-DD");
    return moment(`${targetYear}-${base.format("MM-DD")}`, "YYYY-MM-DD");
  }
}

// 核心计算：返回统一结构的结果对象，同时提供 daysLeft（可能为负）和 daysElapsed（非负、仅在已过去时有意义）
// 这样无论调用方读取的是哪一个字段名，都不会因为字段缺失而拿到 undefined 引发后续报错。
function computeOccurrence(item, today) {
  if (item.type === "birthday" || item.repeatYearly) {
    for (let offset = 0; offset <= 3; offset++) {
      let targetYear = today.year() + offset;
      let m = toSolarMoment(targetYear, item);
      if (!m) continue;
      if (m.isSameOrAfter(today, "day")) {
        let age =
          item.dateType === "lunar"
            ? targetYear - getLunarYearOfDate(item.date)
            : targetYear - moment(item.date, "YYYY-MM-DD").year();
        let daysLeft = m.diff(today, "days");
        return {
          nextDateStr: m.format("YYYYMMDD"),
          daysLeft,
          daysElapsed: daysLeft < 0 ? -daysLeft : 0,
          age,
          isPast: false,
        };
      }
    }
    return null;
  } else {
    // 一次性倒数日/正计时
    let base = moment(item.date, "YYYY-MM-DD");
    let daysLeft = base.diff(today, "days");
    return {
      nextDateStr: base.format("YYYYMMDD"),
      daysLeft,
      daysElapsed: daysLeft < 0 ? -daysLeft : 0,
      age: null,
      isPast: daysLeft < 0,
    };
  }
}

const helper = {
  /**
   * 把一个公历日期转换成农历信息，用于新建纪念日时给用户看"农历八月十五"这样的提示
   */
  solarToLunarInfo(dateStr) {
    let m = moment(dateStr, "YYYY-MM-DD");
    let lunar = safeSolar2Lunar(m.year(), m.month() + 1, m.date());
    if (!lunar) {
      return { lunarYear: m.year(), lunarMonth: m.month() + 1, lunarDay: m.date(), isLeap: false, text: "" };
    }
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
  isOccurrenceOnDate(item, dateStr) {
    if (!item || !dateStr) return false;
    let target = moment(dateStr, "YYYYMMDD");
    if (item.dateType === "lunar") {
      let lunar = safeSolar2Lunar(target.year(), target.month() + 1, target.date());
      if (!lunar) return false;
      return lunar.lMonth === item.lunarMonth && lunar.lDay === item.lunarDay && !!lunar.isLeap === !!item.lunarLeap;
    }
    let base = moment(item.date, "YYYY-MM-DD");
    return base.month() === target.month() && base.date() === target.date();
  },
  // 别名：兼容 monthCalendar.vue 里使用的调用名
  occursOn(item, dateStr) {
    return helper.isOccurrenceOnDate(item, dateStr);
  },

  /**
   * 计算一个纪念日"下一次发生"的信息：日期、剩余/已过天数、年龄等
   */
  computeNextOccurrence(item) {
    let today = moment().startOf("day");
    return computeOccurrence(item, today);
  },
  // 别名：兼容 anniversaryList.vue 里使用的调用名
  calc(item) {
    return helper.computeNextOccurrence(item);
  },

  /**
   * 计算某个纪念日区间内（未来 N 天）会不会发生，返回列表用于"未来30天"卡片
   */
  getUpcomingAnniversaries(anniversaryList, days) {
    let today = moment().startOf("day");
    let endDate = moment().add(days, "days").endOf("day");
    let results = [];

    (anniversaryList || []).forEach((item) => {
      let calcResult = computeOccurrence(item, today);
      if (!calcResult) return;
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

export default helper;
