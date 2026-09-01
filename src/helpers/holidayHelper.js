// 中国法定节假日数据管理
// 数据来源：https://github.com/NateScarlet/holiday-cn
// 缓存策略：localStorage 保存按年份索引的节假日数据 + 最近一次检查更新的日期
// 更新时机：App.vue mounted 时调用一次 checkForUpdate()，同一天内只会真正发起一次网络请求

import moment from "moment";
import storageRepository from "../repositories/storageRepository";
import holidaysSeed from "../data/holidaysSeed";

const CACHE_KEY = "cnHolidaysCache";
const REMOTE_BASE = "https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/";
const REMOTE_BASE_FALLBACK = "https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/";

function loadCache() {
  let cache = storageRepository.get(CACHE_KEY);
  if (!cache) {
    cache = { years: {}, lastChecked: null };
    Object.keys(holidaysSeed).forEach((year) => {
      cache.years[year] = holidaysSeed[year];
    });
    storageRepository.set(CACHE_KEY, cache);
  }
  return cache;
}

function saveCache(cache) {
  storageRepository.set(CACHE_KEY, cache);
}

function buildDayMap(yearData) {
  let map = {};
  if (!yearData || !yearData.days) return map;
  yearData.days.forEach((d) => {
    // d.date 格式为 2026-09-25，转换成项目内统一使用的 YYYYMMDD
    map[d.date.replace(/-/g, "")] = { name: d.name, isOffDay: d.isOffDay };
  });
  return map;
}

export default {
  /**
   * 获取某一天(YYYYMMDD)的节假日信息
   * 返回 null 表示这天没有特殊标记(普通工作日或普通周末)
   * 返回 { name, isOffDay: true } 表示法定节假日
   * 返回 { name, isOffDay: false } 表示调休后需要上班的一天(通常落在周末)
   */
  getDayInfo(dateStr) {
    if (!dateStr || dateStr.length < 4) return null;
    let year = dateStr.substring(0, 4);
    let cache = loadCache();
    let yearData = cache.years[year];
    if (!yearData) return null;
    let map = buildDayMap(yearData);
    return map[dateStr] || null;
  },

  /**
   * 检查并更新节假日数据。
   * force = true 时强制刷新，否则只有当天第一次调用才会真正发请求。
   */
  checkForUpdate(force = false) {
    let cache = loadCache();
    let today = moment().format("YYYY-MM-DD");
    if (!force && cache.lastChecked === today) {
      return Promise.resolve();
    }

    const axios = require("axios").default;
    let currentYear = moment().year();
    let yearsToFetch = [currentYear - 1, currentYear, currentYear + 1];

    let fetches = yearsToFetch.map((year) =>
      axios
        .get(`${REMOTE_BASE}${year}.json`, { timeout: 4000 })
        .catch(() => axios.get(`${REMOTE_BASE_FALLBACK}${year}.json`, { timeout: 4000 }))
        .then((res) => ({ year, data: res.data }))
        .catch(() => null)
    );

    return Promise.all(fetches).then((results) => {
      results.forEach((r) => {
        if (r && r.data) {
          cache.years[r.year] = r.data;
        }
      });
      cache.lastChecked = today;
      saveCache(cache);
    });
  },
};
