// 节假日数据管理（多国版）
// 中国：数据来源 https://github.com/NateScarlet/holiday-cn，缓存 key 沿用旧版本，兼容老用户已有缓存
// 其它国家：数据来源 https://date.nager.at （Nager.Date 公共 API，无需 key）
// 缓存策略：localStorage 按国家分别缓存，每个国家每天最多真正发起一次网络请求

import moment from "moment";
import axios from "axios";
import storageRepository from "../repositories/storageRepository";
import holidaysSeed from "../data/holidaysSeed";

const CN_CACHE_KEY = "cnHolidaysCache"; // 保持不变，兼容已有用户缓存
const CN_REMOTE_BASE = "https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/";
const CN_REMOTE_BASE_FALLBACK = "https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/";

const OTHER_CACHE_PREFIX = "holidayCacheOther_";
const NAGER_BASE = "https://date.nager.at/api/v3/PublicHolidays/";

function loadCnCache() {
  let cache = storageRepository.get(CN_CACHE_KEY);
  if (!cache) {
    cache = { years: {}, lastChecked: null };
    Object.keys(holidaysSeed).forEach((year) => {
      cache.years[year] = holidaysSeed[year];
    });
    storageRepository.set(CN_CACHE_KEY, cache);
  }
  return cache;
}

function saveCnCache(cache) {
  storageRepository.set(CN_CACHE_KEY, cache);
}

function buildCnDayMap(yearData) {
  let map = {};
  if (!yearData || !yearData.days) return map;
  yearData.days.forEach((d) => {
    map[d.date.replace(/-/g, "")] = { name: d.name, isOffDay: d.isOffDay };
  });
  return map;
}

function loadOtherCache(countryCode) {
  let key = OTHER_CACHE_PREFIX + countryCode;
  let cache = storageRepository.get(key);
  if (!cache) {
    cache = { years: {}, lastChecked: null };
    storageRepository.set(key, cache);
  }
  return cache;
}

function saveOtherCache(countryCode, cache) {
  storageRepository.set(OTHER_CACHE_PREFIX + countryCode, cache);
}

function buildOtherDayMap(list) {
  let map = {};
  if (!list) return map;
  list.forEach((d) => {
    let key = d.date.replace(/-/g, "");
    if (!map[key]) map[key] = [];
    // Nager.Date 的节假日基本都是不上班的公共假日，isOffDay 统一记为 true
    map[key].push({ name: d.localName || d.name, isOffDay: true });
  });
  return map;
}

export default {
  /**
   * 获取某一天(YYYYMMDD)在中国的节假日信息，保持原有签名和行为不变
   */
  getDayInfo(dateStr) {
    if (!dateStr || dateStr.length < 4) return null;
    let year = dateStr.substring(0, 4);
    let cache = loadCnCache();
    let yearData = cache.years[year];
    if (!yearData) return null;
    let map = buildCnDayMap(yearData);
    return map[dateStr] || null;
  },

  /**
   * 获取某一天在指定单个国家的节假日信息，返回数组（同一天可能有多个节日重叠）
   */
  getDayInfoForCountry(dateStr, countryCode) {
    if (!dateStr || dateStr.length < 8) return [];
    if (countryCode === "CN") {
      let info = this.getDayInfo(dateStr);
      return info ? [{ countryCode: "CN", name: info.name, isOffDay: info.isOffDay }] : [];
    }
    let year = dateStr.substring(0, 4);
    let cache = loadOtherCache(countryCode);
    let yearList = cache.years[year];
    if (!yearList) return [];
    let map = buildOtherDayMap(yearList);
    let entries = map[dateStr];
    if (!entries) return [];
    return entries.map((e) => ({ countryCode, name: e.name, isOffDay: e.isOffDay }));
  },

  /**
   * 获取某一天在多个国家里的节假日信息，合并成一个数组
   */
  getDayInfoMulti(dateStr, countryCodes) {
    let codes = countryCodes && countryCodes.length ? countryCodes : ["CN"];
    let results = [];
    codes.forEach((code) => {
      results = results.concat(this.getDayInfoForCountry(dateStr, code));
    });
    return results;
  },

  /**
   * 获取一个日期区间内（含首尾）所有选中国家的节假日，返回按日期展开的扁平数组
   */
  getHolidaysBetween(startDateStr, endDateStr, countryCodes) {
    let codes = countryCodes && countryCodes.length ? countryCodes : ["CN"];
    let list = [];
    let cursor = moment(startDateStr, "YYYYMMDD");
    let end = moment(endDateStr, "YYYYMMDD");
    while (cursor.isSameOrBefore(end, "day")) {
      let dateStr = cursor.format("YYYYMMDD");
      let dayInfos = this.getDayInfoMulti(dateStr, codes);
      dayInfos.forEach((info) => {
        list.push({ date: dateStr, name: info.name, countryCode: info.countryCode, isOffDay: info.isOffDay });
      });
      cursor.add(1, "day");
    }
    return list;
  },

  /**
   * 检查并更新节假日数据，countryCodes 缺省时只更新中国（保持旧版本 App.vue 调用方式不变）
   */
  checkForUpdate(countryCodes = ["CN"], force = false) {
    let codes = countryCodes && countryCodes.length ? countryCodes : ["CN"];
    let promises = codes.map((code) => {
      if (code === "CN") return this.checkForUpdateCn(force);
      return this.checkForUpdateOther(code, force);
    });
    return Promise.all(promises);
  },

  checkForUpdateCn(force = false) {
    let cache = loadCnCache();
    let today = moment().format("YYYY-MM-DD");
    if (!force && cache.lastChecked === today) {
      return Promise.resolve();
    }

    let currentYear = moment().year();
    let yearsToFetch = [currentYear - 1, currentYear, currentYear + 1];

    let fetches = yearsToFetch.map((year) =>
      axios
        .get(`${CN_REMOTE_BASE}${year}.json`, { timeout: 4000 })
        .catch(() => axios.get(`${CN_REMOTE_BASE_FALLBACK}${year}.json`, { timeout: 4000 }))
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
      saveCnCache(cache);
    });
  },

  checkForUpdateOther(countryCode, force = false) {
    let cache = loadOtherCache(countryCode);
    let today = moment().format("YYYY-MM-DD");
    if (!force && cache.lastChecked === today) {
      return Promise.resolve();
    }

    let currentYear = moment().year();
    let yearsToFetch = [currentYear - 1, currentYear, currentYear + 1];

    let fetches = yearsToFetch.map((year) =>
      axios
        .get(`${NAGER_BASE}${year}/${countryCode}`, { timeout: 4000 })
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
      saveOtherCache(countryCode, cache);
    });
  },
    /**
   * 确保某个具体年份、某些国家的假日数据已经加载到缓存里。
   * 用于日历中心月历翻页翻到超出"去年/今年/明年"这个默认预取范围时按需补拉。
   */
  ensureYearLoaded(year, countryCodes) {
    let codes = countryCodes && countryCodes.length ? countryCodes : ["CN"];
    let promises = codes.map((code) => {
      if (code === "CN") {
        let cache = loadCnCache();
        if (cache.years[year]) return Promise.resolve();
        return axios
          .get(`${CN_REMOTE_BASE}${year}.json`, { timeout: 4000 })
          .catch(() => axios.get(`${CN_REMOTE_BASE_FALLBACK}${year}.json`, { timeout: 4000 }))
          .then((res) => {
            cache.years[year] = res.data;
            saveCnCache(cache);
          })
          .catch(() => null);
      } else {
        let cache = loadOtherCache(code);
        if (cache.years[year]) return Promise.resolve();
        return axios
          .get(`${NAGER_BASE}${year}/${code}`, { timeout: 4000 })
          .then((res) => {
            cache.years[year] = res.data;
            saveOtherCache(code, cache);
          })
          .catch(() => null);
      }
    });
    return Promise.all(promises);
  },
};
