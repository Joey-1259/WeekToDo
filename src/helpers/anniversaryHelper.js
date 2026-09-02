// 纪念日（倒数日 / 正计时 / 生日）计算逻辑
// 依赖 solarlunar 做农历<->公历转换，1900-2100 年范围内可用
//
// 说明：solarlunar 从 3.x 开始改用 ESM + package.json "exports" 字段做条件导出，
// 而本项目基于 vue-cli 4 / webpack 4，webpack 4 不认识 "exports" 字段，
// 不同环境（本地 dev server vs 打包后的生产环境）解析到的具体构建产物可能不一致，
// 轻则拿到的默认导出不是预期的方法集合，重则运行时直接抛错导致整个 Vue 应用无法挂载（白屏）。
// 下面这段做了防御性归一化，兼容它可能出现的几种导出形态。
import moment from "moment";
import * as solarLunarModule from "solarlunar";

function resolveSolarLunar(mod) {
  // ESM 具名导出直接挂在 mod 上，例如 mod.solar2lunar
  if (mod && typeof mod.solar2lunar === "function") return mod;
  // 常见的 default 导出对象，例如 mod.default.solar2lunar
  if (mod && mod.default && typeof mod.default.solar2lunar === "function") return mod.default;
  // UMD 打包情况下可能整个模块本身就是那个对象的引用集合
  if (mod && mod.default && mod.default.default && typeof mod.default.default.solar2lunar === "function") {
    return mod.default.default;
  }
  return null;
}

const solarLunar = resolveSolarLunar(solarLunarModule);

if (!solarLunar) {
  // 不让这里直接抛错炸掉整个应用；退化为一个不会抛异常的空实现，
  // 农历相关功能会暂时不可用，但不会导致白屏。
  console.error(
    "[anniversaryHelper] 无法解析 solarlunar 模块的导出，农历转换功能将不可用。请检查依赖版本与打包配置。"
  );
}

function safeSolar2Lunar(year, month, day) {
  if (!solarLunar) return null;
  try {
    return solarLunar.solar2lunar(year, month, day);
  } catch (e) {
    console.error("[anniversaryHelper] solar2lunar 调用失败：", e);
    return null;
  }
}

function safeLunar2Solar(year, month, day, isLeap) {
  if (!solarLunar) return null;
  try {
    return solarLunar.lunar2solar(year, month, day, isLeap);
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
      // 有些年份没有对应的闰月，退回到当年的非闰月同月同日
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

function computeOccurrence(item, today) {
  // 从"今年"往后最多找 3 年，找到下一次（或本次）发生的日期
  for (let offset = 0; offset <= 3; offset++) {
    let targetYear = today.year() + offset;
    let m = toSolarMoment(targetYear, item);
    if (!m) continue;

    if (item.type === "birthday" || item.repeatYearly) {
      if (m.isSameOrAfter(today, "day")) {
        let age = item.dateType === "lunar" ? targetYear - getLunarYearOfDate(item.date) : targetYear - moment(item.date, "YYYY-MM-DD").year();
        return { nextDateStr: m.format("YYYYMMDD"), daysLeft: m.diff(today, "days"), age, isPast: false };
      }
    } else {
      // 一次性倒数日/正计时
      let base = moment(item.date, "YYYY-MM-DD");
      let daysLeft = base.diff(today, "days");
      return { nextDateStr: base.format("YYYYMMDD"), daysLeft, age: null, isPast: daysLeft < 0 };
    }
  }
  return null;
}

export default {
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

  /**
   * 计算一个纪念日"下一次发生"的信息：日期、剩余/已过天数、年龄等
   */
  computeNextOccurrence(item) {
    let today = moment().startOf("day");
    return computeOccurrence(item, today);
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
