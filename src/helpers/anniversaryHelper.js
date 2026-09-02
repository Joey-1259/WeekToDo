// 纪念日（不重复 / 每年重复 / 每月重复）计算逻辑
// 依赖本地内置的 solarLunarCore 做农历<->公历转换，1900-2100 年范围内可用
//
// 数据模型说明：新版本用 repeat 字段（"none" | "yearly" | "monthly"）取代旧版本的
// type 字段（"countdown" | "countup" | "birthday"），因为重复方式和类型名词本质上
// 是同一个维度被拆成了两套命名，容易让用户在新建时纠结"该选哪个类型"。
// normalize() 会把旧数据的 type/repeatYearly 字段自动映射成新的 repeat 字段，
// 保证已有用户存量数据不会因为这次改版报错或丢失。
import moment from "moment";
import { solar2lunar, lunar2solar, lunarMonthLength } from "./solarLunarCore";

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

function normalize(item) {
  if (item.repeat) return item;
  let repeat = "none";
  if (item.type === "birthday" || item.repeatYearly) repeat = "yearly";
  return Object.assign({}, item, { repeat });
}

function toSolarMoment(targetYear, item) {
  if (item.dateType === "lunar") {
    let isLeap = !!item.lunarLeap;
    let day = item.lunarDay;

    // 兜底一：目标农历年该月实际天数不足纪念日设置的"日"
    // （常见于三十日的纪念日遇到只有二十九天的小月），退回到当月最后一天，
    // 避免因为"那一天不存在"而把整个年份的纪念日直接跳过
    let monthLength = lunarMonthLength(targetYear, item.lunarMonth, isLeap);
    if (monthLength > 0 && day > monthLength) {
      day = monthLength;
    }

    let result = safeLunar2Solar(targetYear, item.lunarMonth, day, isLeap);
    if (!result && isLeap) {
      // 兜底二：闰月在该年不存在（含 monthLength 为 0 的情况），退回按平月计算
      let fallbackLength = lunarMonthLength(targetYear, item.lunarMonth, false);
      let fallbackDay = fallbackLength > 0 ? Math.min(item.lunarDay, fallbackLength) : item.lunarDay;
      result = safeLunar2Solar(targetYear, item.lunarMonth, fallbackDay, false);
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

function nextMonthlyOccurrence(item, today) {
  let base = moment(item.date, "YYYY-MM-DD");
  let targetDay = base.date();
  for (let offset = 0; offset <= 2; offset++) {
    let cursor = today.clone().add(offset, "months").startOf("month");
    let daysInMonth = cursor.daysInMonth();
    let day = Math.min(targetDay, daysInMonth);
    let candidate = cursor.date(day);
    if (candidate.isSameOrAfter(today, "day")) {
      return candidate;
    }
  }
  return null;
}

function computeOccurrence(rawItem, today) {
  let item = normalize(rawItem);

  if (item.repeat === "yearly") {
    // 循环起点从 today.year() - 1 开始（offset = -1），而不是 today.year()：
    // 农历腊月（十二月）往往跨到公历新年之后（1 月甚至 2 月上旬春节之前），
    // 如果"今天"正处在这个窗口期内，此时实际所在的农历年是"公历年 - 1"，
    // 只从 offset = 0 开始会完全跳过这个仍在进行中的农历年，
    // 把明明只剩几天的纪念日误算成"还有约一年"。多试一次上一农历年，
    // 交给下面 isSameOrAfter 过滤即可安全兼容所有正常场景（多余的候选会被自然跳过）。
    for (let offset = -1; offset <= 3; offset++) {
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
  } else if (item.repeat === "monthly") {
    let m = nextMonthlyOccurrence(item, today);
    if (!m) return null;
    let daysLeft = m.diff(today, "days");
    return {
      nextDateStr: m.format("YYYYMMDD"),
      daysLeft,
      daysElapsed: daysLeft < 0 ? -daysLeft : 0,
      age: null,
      isPast: false,
    };
  } else {
    // repeat === "none"：一次性事件，日期在过去则为"正计时"（已经过去多少天），
    // 日期在未来则为一次性倒数
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
  normalize(item) {
    return normalize(item);
  },

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

  isOccurrenceOnDate(rawItem, dateStr) {
    if (!rawItem || !dateStr) return false;
    let item = normalize(rawItem);
    let target = moment(dateStr, "YYYYMMDD");

    if (item.repeat === "monthly") {
      let base = moment(item.date, "YYYY-MM-DD");
      let daysInMonth = target.daysInMonth();
      return target.date() === Math.min(base.date(), daysInMonth);
    }

    if (item.repeat === "yearly") {
      if (item.dateType === "lunar") {
        let lunar = safeSolar2Lunar(target.year(), target.month() + 1, target.date());
        if (!lunar) return false;
        return lunar.lMonth === item.lunarMonth && lunar.lDay === item.lunarDay && !!lunar.isLeap === !!item.lunarLeap;
      }
      let base = moment(item.date, "YYYY-MM-DD");
      return base.month() === target.month() && base.date() === target.date();
    }

    // repeat === "none"：只在这一天精确命中一次
    return moment(item.date, "YYYY-MM-DD").format("YYYYMMDD") === dateStr;
  },
  occursOn(item, dateStr) {
    return helper.isOccurrenceOnDate(item, dateStr);
  },

  computeNextOccurrence(item) {
    let today = moment().startOf("day");
    return computeOccurrence(item, today);
  },
  calc(item) {
    return helper.computeNextOccurrence(item);
  },

  getUpcomingAnniversaries(anniversaryList, days, fromDateStr) {
    let today = fromDateStr ? moment(fromDateStr, "YYYYMMDD") : moment().startOf("day");
    let endDate = today.clone().add(days, "days").endOf("day");
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
          repeat: normalize(item).repeat,
          age: calcResult.age,
          source: "anniversary",
        });
      }
    });

    return results;
  },
};

export default helper;
