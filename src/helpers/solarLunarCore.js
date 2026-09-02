// 农历/公历互转核心算法
// 本文件是从 solarlunar (https://github.com/yize/solarlunar) 的算法移植而来，
// 之所以内置成本地纯函数模块而不是继续以 npm 依赖的形式引入，是因为：
// solarlunar 3.x 的 package.json 声明了 "type": "module" 并通过 exports 字段做条件导出，
// 而本项目使用的是 Webpack 4（经由 vue-cli-plugin-electron-builder，target 为 electron-renderer），
// Webpack 4 完全不支持 package.json 的 exports 条件导出语法，也不会默认走 "browser" 字段，
// 在这种老工具链下解析该包极易得到与预期不符的模块结构（这正是本次白屏问题的根因）。
// 直接内置算法后，本文件完全通过项目自身的 babel 配置转译，不再有任何"第三方模块格式"层面的不确定性。
//
// 仅导出项目实际用到的三个方法：solar2lunar（公历转农历）、lunar2solar（农历转公历）、
// lunarMonthLength（查询指定农历年月的实际天数，供纪念日"三十日缺失"兜底使用）。

const lunarInfo = [
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
  0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
  0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
  0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
  0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
  0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0,
  0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
  0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6,
  0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
  0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x05ac0, 0x0ab60, 0x096d5, 0x092e0,
  0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
  0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
  0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
  0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
  0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0,
  0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0,
  0x092e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4,
  0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0,
  0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160,
  0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a4d0, 0x0d150, 0x0f252,
  0x0d520,
];

const solarMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const gan = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const zhi = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const animals = ["鼠", "牛", "虎", "兔", "龙", "蛇", "马", "羊", "猴", "鸡", "狗", "猪"];
const lunarTerm = [
  "小寒", "大寒", "立春", "雨水", "惊蛰", "春分", "清明", "谷雨", "立夏", "小满", "芒种", "夏至",
  "小暑", "大暑", "立秋", "处暑", "白露", "秋分", "寒露", "霜降", "立冬", "小雪", "大雪", "冬至",
];

const lTermInfo = [
  "9778397bd097c36b0b6fc9274c91aa", "97b6b97bd19801ec9210c965cc920e", "97bcf97c3598082c95f8c965cc920f",
  "97bd0b06bdb0722c965ce1cfcc920f", "b027097bd097c36b0b6fc9274c91aa", "97b6b97bd19801ec9210c965cc920e",
  "97bcf97c359801ec95f8c965cc920f", "97bd0b06bdb0722c965ce1cfcc920f", "b027097bd097c36b0b6fc9274c91aa",
  "97b6b97bd19801ec9210c965cc920e", "97bcf97c359801ec95f8c965cc920f", "97bd0b06bdb0722c965ce1cfcc920f",
  "b027097bd097c36b0b6fc9274c91aa", "9778397bd19801ec9210c965cc920e", "97b6b97bd19801ec95f8c965cc920f",
  "97bd09801d98082c95f8e1cfcc920f", "97bd097bd097c36b0b6fc9210c8dc2", "9778397bd197c36c9210c9274c91aa",
  "97b6b97bd19801ec95f8c965cc920e", "97bd09801d98082c95f8e1cfcc920f", "97bd097bd097c36b0b6fc9210c8dc2",
  "9778397bd097c36c9210c9274c91aa", "97b6b97bd19801ec95f8c965cc920e", "97bcf97c3598082c95f8e1cfcc920f",
  "97bd097bd097c36b0b6fc9210c8dc2", "9778397bd097c36c9210c9274c91aa", "97b6b97bd19801ec9210c965cc920e",
  "97bcf97c3598082c95f8c965cc920f", "97bd097bd097c35b0b6fc920fb0722", "9778397bd097c36b0b6fc9274c91aa",
  "97b6b97bd19801ec9210c965cc920e", "97bcf97c3598082c95f8c965cc920f", "97bd097bd097c35b0b6fc920fb0722",
  "9778397bd097c36b0b6fc9274c91aa", "97b6b97bd19801ec9210c965cc920e", "97bcf97c359801ec95f8c965cc920f",
  "97bd097bd097c35b0b6fc920fb0722", "9778397bd097c36b0b6fc9274c91aa", "97b6b97bd19801ec9210c965cc920e",
  "97bcf97c359801ec95f8c965cc920f", "97bd097bd097c35b0b6fc920fb0722", "9778397bd097c36b0b6fc9274c91aa",
  "97b6b97bd19801ec9210c965cc920e", "97bcf97c359801ec95f8c965cc920f", "97bd097bd07f595b0b6fc920fb0722",
  "9778397bd097c36b0b6fc9210c8dc2", "9778397bd19801ec9210c9274c920e", "97b6b97bd19801ec95f8c965cc920f",
  "97bd07f5307f595b0b0bc920fb0722", "7f0e397bd097c36b0b6fc9210c8dc2", "9778397bd097c36c9210c9274c920e",
  "97b6b97bd19801ec95f8c965cc920f", "97bd07f5307f595b0b0bc920fb0722", "7f0e397bd097c36b0b6fc9210c8dc2",
  "9778397bd097c36c9210c9274c91aa", "97b6b97bd19801ec9210c965cc920e", "97bd07f1487f595b0b0bc920fb0722",
  "7f0e397bd097c36b0b6fc9210c8dc2", "9778397bd097c36b0b6fc9274c91aa", "97b6b97bd19801ec9210c965cc920e",
  "97bcf7f1487f595b0b0bb0b6fb0722", "7f0e397bd097c35b0b6fc920fb0722", "9778397bd097c36b0b6fc9274c91aa",
  "97b6b97bd19801ec9210c965cc920e", "97bcf7f1487f595b0b0bb0b6fb0722", "7f0e397bd097c35b0b6fc920fb0722",
  "9778397bd097c36b0b6fc9274c91aa", "97b6b97bd19801ec9210c965cc920e", "97bcf7f1487f531b0b0bb0b6fb0722",
  "7f0e397bd097c35b0b6fc920fb0722", "9778397bd097c36b0b6fc9274c91aa", "97b6b97bd19801ec9210c965cc920e",
  "97bcf7f1487f531b0b0bb0b6fb0722", "7f0e397bd07f595b0b6fc920fb0722", "9778397bd097c36b0b6fc9274c91aa",
  "97b6b97bd19801ec9210c9274c920e", "97bcf7f0e47f531b0b0bb0b6fb0722", "7f0e397bd07f595b0b0bc920fb0722",
  "9778397bd097c36b0b6fc9210c91aa", "97b6b97bd197c36c9210c9274c920e", "97bcf7f0e47f531b0b0bb0b6fb0722",
  "7f0e397bd07f595b0b0bc920fb0722", "9778397bd097c36b0b6fc9210c8dc2", "9778397bd097c36c9210c9274c920e",
  "97b6b7f0e47f531b0723b0b6fb0722", "7f0e37f5307f595b0b0bc920fb0722", "7f0e397bd097c36b0b6fc9210c8dc2",
  "9778397bd097c36b0b70c9274c91aa", "97b6b7f0e47f531b0723b0b6fb0721", "7f0e37f1487f595b0b0bb0b6fb0722",
  "7f0e397bd097c35b0b6fc9210c8dc2", "9778397bd097c36b0b6fc9274c91aa", "97b6b7f0e47f531b0723b0b6fb0721",
  "7f0e27f1487f595b0b0bb0b6fb0722", "7f0e397bd097c35b0b6fc920fb0722", "9778397bd097c36b0b6fc9274c91aa",
  "97b6b7f0e47f531b0723b0b6fb0721", "7f0e27f1487f531b0b0bb0b6fb0722", "7f0e397bd097c35b0b6fc920fb0722",
  "9778397bd097c36b0b6fc9274c91aa", "97b6b7f0e47f531b0723b0b6fb0721", "7f0e27f1487f531b0b0bb0b6fb0722",
  "7f0e397bd097c35b0b6fc920fb0722", "9778397bd097c36b0b6fc9274c91aa", "97b6b7f0e47f531b0723b0b6fb0721",
  "7f0e27f1487f531b0b0bb0b6fb0722", "7f0e397bd07f595b0b0bc920fb0722", "9778397bd097c36b0b6fc9274c91aa",
  "97b6b7f0e47f531b0723b0787b0721", "7f0e27f0e47f531b0b0bb0b6fb0722", "7f0e397bd07f595b0b0bc920fb0722",
  "9778397bd097c36b0b6fc9210c91aa", "97b6b7f0e47f149b0723b0787b0721", "7f0e27f0e47f531b0723b0b6fb0722",
  "7f0e397bd07f595b0b0bc920fb0722", "9778397bd097c36b0b6fc9210c8dc2", "977837f0e37f149b0723b0787b0721",
  "7f07e7f0e47f531b0723b0b6fb0722", "7f0e37f5307f595b0b0bc920fb0722", "7f0e397bd097c35b0b6fc9210c8dc2",
  "977837f0e37f14998082b0787b0721", "7f07e7f0e47f531b0723b0b6fb0721", "7f0e37f1487f595b0b0bb0b6fb0722",
  "7f0e397bd097c35b0b6fc9210c8dc2", "977837f0e37f14998082b0787b06bd", "7f07e7f0e47f531b0723b0b6fb0721",
  "7f0e27f1487f531b0b0bb0b6fb0722", "7f0e397bd097c35b0b6fc920fb0722", "977837f0e37f14998082b0787b06bd",
  "7f07e7f0e47f531b0723b0b6fb0721", "7f0e27f1487f531b0b0bb0b6fb0722", "7f0e397bd097c35b0b6fc920fb0722",
  "977837f0e37f14998082b0787b06bd", "7f07e7f0e47f531b0723b0b6fb0721", "7f0e27f1487f531b0b0bb0b6fb0722",
  "7f0e397bd07f595b0b0bc920fb0722", "977837f0e37f14998082b0787b06bd", "7f07e7f0e47f531b0723b0b6fb0721",
  "7f0e27f1487f531b0b0bb0b6fb0722", "7f0e397bd07f595b0b0bc920fb0722", "977837f0e37f14998082b0787b06bd",
  "7f07e7f0e47f149b0723b0787b0721", "7f0e27f0e47f531b0b0bb0b6fb0722", "7f0e397bd07f595b0b0bc920fb0722",
  "977837f0e37f14998082b0723b06bd", "7f07e7f0e37f149b0723b0787b0721", "7f0e27f0e47f531b0723b0b6fb0722",
  "7f0e397bd07f595b0b0bc920fb0722", "977837f0e37f14898082b0723b02d5", "7ec967f0e37f14998082b0787b0721",
  "7f07e7f0e47f531b0723b0b6fb0722", "7f0e37f1487f595b0b0bb0b6fb0722", "7f0e37f0e37f14898082b0723b02d5",
  "7ec967f0e37f14998082b0787b0721", "7f07e7f0e47f531b0723b0b6fb0722", "7f0e37f1487f531b0b0bb0b6fb0722",
  "7f0e37f0e37f14898082b0723b02d5", "7ec967f0e37f14998082b0787b06bd", "7f07e7f0e47f531b0723b0b6fb0721",
  "7f0e37f1487f531b0b0bb0b6fb0722", "7f0e37f0e37f14898082b072297c35", "7ec967f0e37f14998082b0787b06bd",
  "7f07e7f0e47f531b0723b0b6fb0721", "7f0e27f1487f531b0b0bb0b6fb0722", "7f0e37f0e37f14898082b072297c35",
  "7ec967f0e37f14998082b0787b06bd", "7f07e7f0e47f531b0723b0b6fb0721", "7f0e27f1487f531b0b0bb0b6fb0722",
  "7f0e37f0e366aa89801eb072297c35", "7ec967f0e37f14998082b0787b06bd", "7f07e7f0e47f149b0723b0787b0721",
  "7f0e27f1487f531b0b0bb0b6fb0722", "7f0e37f0e366aa89801eb072297c35", "7ec967f0e37f14998082b0723b06bd",
  "7f07e7f0e47f149b0723b0787b0721", "7f0e27f0e47f531b0723b0b6fb0722", "7f0e37f0e366aa89801eb072297c35",
  "7ec967f0e37f14998082b0723b06bd", "7f07e7f0e37f14998083b0787b0721", "7f0e27f0e47f531b0723b0b6fb0722",
  "7f0e37f0e366aa89801eb072297c35", "7ec967f0e37f14898082b0723b02d5", "7f07e7f0e37f14998082b0787b0721",
  "7f07e7f0e47f531b0723b0b6fb0722", "7f0e36665b66aa89801e9808297c35", "665f67f0e37f14898082b0723b02d5",
  "7ec967f0e37f14998082b0787b0721", "7f07e7f0e47f531b0723b0b6fb0722", "7f0e36665b66a449801e9808297c35",
  "665f67f0e37f14898082b0723b02d5", "7ec967f0e37f14998082b0787b06bd", "7f07e7f0e47f531b0723b0b6fb0721",
  "7f0e36665b66a449801e9808297c35", "665f67f0e37f14898082b072297c35", "7ec967f0e37f14998082b0787b06bd",
  "7f07e7f0e47f531b0723b0b6fb0721", "7f0e26665b66a449801e9808297c35", "665f67f0e37f1489801eb072297c35",
  "7ec967f0e37f14998082b0787b06bd", "7f07e7f0e47f531b0723b0b6fb0721", "7f0e27f1487f531b0b0bb0b6fb0722",
];

const nStr1 = ["日", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
const nStr2 = ["初", "十", "廿", "卅"];
const nStr3 = ["正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "冬", "腊"];
const nStr4 = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];

function lYearDays(y) {
  let sum = 348;
  const info = lunarInfo[y - 1900];
  sum += info & 0x8000 ? 1 : 0;
  sum += info & 0x4000 ? 1 : 0;
  sum += info & 0x2000 ? 1 : 0;
  sum += info & 0x1000 ? 1 : 0;
  sum += info & 0x0800 ? 1 : 0;
  sum += info & 0x0400 ? 1 : 0;
  sum += info & 0x0200 ? 1 : 0;
  sum += info & 0x0100 ? 1 : 0;
  sum += info & 0x0080 ? 1 : 0;
  sum += info & 0x0040 ? 1 : 0;
  sum += info & 0x0020 ? 1 : 0;
  sum += info & 0x0010 ? 1 : 0;
  return sum + leapDays(y);
}

function leapMonth(y) {
  return lunarInfo[y - 1900] & 0xf;
}

function leapDays(y) {
  if (leapMonth(y)) {
    return lunarInfo[y - 1900] & 0x10000 ? 30 : 29;
  }
  return 0;
}

function monthDays(y, m) {
  if (m > 12 || m < 1) return -1;
  return lunarInfo[y - 1900] & (0x10000 >> m) ? 30 : 29;
}

function solarDays(y, m) {
  if (m > 12 || m < 1) return -1;
  const ms = m - 1;
  if (ms === 1) {
    return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28;
  }
  return solarMonth[ms];
}

function toGanZhi(offset) {
  return gan[offset % 10] + zhi[offset % 12];
}

function getTerm(y, n) {
  if (y < 1900 || y > 2100) return -1;
  if (n < 1 || n > 24) return -1;
  const _table = lTermInfo[y - 1900];
  const _info = [
    parseInt("0x" + _table.substr(0, 5)).toString(),
    parseInt("0x" + _table.substr(5, 5)).toString(),
    parseInt("0x" + _table.substr(10, 5)).toString(),
    parseInt("0x" + _table.substr(15, 5)).toString(),
    parseInt("0x" + _table.substr(20, 5)).toString(),
    parseInt("0x" + _table.substr(25, 5)).toString(),
  ];
  const _calDay = [
    _info[0].substr(0, 1), _info[0].substr(1, 2), _info[0].substr(3, 1), _info[0].substr(4, 2),
    _info[1].substr(0, 1), _info[1].substr(1, 2), _info[1].substr(3, 1), _info[1].substr(4, 2),
    _info[2].substr(0, 1), _info[2].substr(1, 2), _info[2].substr(3, 1), _info[2].substr(4, 2),
    _info[3].substr(0, 1), _info[3].substr(1, 2), _info[3].substr(3, 1), _info[3].substr(4, 2),
    _info[4].substr(0, 1), _info[4].substr(1, 2), _info[4].substr(3, 1), _info[4].substr(4, 2),
    _info[5].substr(0, 1), _info[5].substr(1, 2), _info[5].substr(3, 1), _info[5].substr(4, 2),
  ];
  return parseInt(_calDay[n - 1]);
}

function toChinaYear(y) {
  const oxxx = Math.floor(y / 1000);
  const xoxx = Math.floor((y % 1000) / 100);
  const xxox = Math.floor((y % 100) / 10);
  const xxxo = y % 10;
  return nStr4[oxxx] + nStr4[xoxx] + nStr4[xxox] + nStr4[xxxo] + "年";
}

function toChinaMonth(m) {
  if (m > 12 || m < 1) return -1;
  return nStr3[m - 1] + "月";
}

function toChinaDay(d) {
  switch (d) {
    case 10:
      return "初十";
    case 20:
      return "二十";
    case 30:
      return "三十";
    default:
      return nStr2[Math.floor(d / 10)] + nStr1[d % 10];
  }
}

function getAnimal(y) {
  return animals[(y - 4) % 12];
}

/**
 * 公历转农历
 * @param {number} y 公历年
 * @param {number} m 公历月 (1-12)
 * @param {number} d 公历日
 */
export function solar2lunar(y, m, d) {
  if (y == null || m == null || d == null) {
    const objDate = new Date();
    y = objDate.getFullYear();
    m = objDate.getMonth() + 1;
    d = objDate.getDate();
  }
  y = Number(y);
  m = Number(m);
  d = Number(d);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return -1;
  if (y < 1900 || y > 2100) return -1;
  if (y === 1900 && m === 1 && d < 31) return -1;
  if (m < 1 || m > 12) return -1;

  const maxDay = solarDays(y, m);
  if (d < 1 || d > maxDay) return -1;

  const objDate = new Date(y, parseInt(m) - 1, d);
  let i;
  let temp = 0;
  y = objDate.getFullYear();
  m = objDate.getMonth() + 1;
  d = objDate.getDate();

  let offset = (Date.UTC(objDate.getFullYear(), objDate.getMonth(), objDate.getDate()) - Date.UTC(1900, 0, 31)) / 86400000;

  for (i = 1900; i < 2101 && offset > 0; i++) {
    temp = lYearDays(i);
    offset -= temp;
  }
  if (offset < 0) {
    offset += temp;
    i--;
  }

  const finalYear = i;
  const isTodayObj = new Date();
  const isToday =
    isTodayObj.getFullYear() === y && isTodayObj.getMonth() + 1 === m && isTodayObj.getDate() === d;

  const nWeek = objDate.getDay();
  const cWeek = nStr1[nWeek];
  const nWeekAdjusted = nWeek === 0 ? 7 : nWeek;

  const year = finalYear;
  const leapM = leapMonth(finalYear);
  let isLeap = false;

  for (i = 1; i < 13 && offset > 0; i++) {
    if (leapM > 0 && i === leapM + 1 && isLeap === false) {
      --i;
      isLeap = true;
      temp = leapDays(year);
    } else {
      temp = monthDays(year, i);
    }
    if (isLeap === true && i === leapM + 1) {
      isLeap = false;
    }
    offset -= temp;
  }

  if (offset === 0 && leapM > 0 && i === leapM + 1) {
    if (isLeap) {
      isLeap = false;
    } else {
      isLeap = true;
      --i;
    }
  }
  if (offset < 0) {
    offset += temp;
    --i;
  }

  const month = i;
  const day = offset + 1;
  const sm = m - 1;
  const term3 = getTerm(y, 3);
  let gzY = toGanZhi(y - 4);
  if (m < 2 || (m === 2 && d < term3)) {
    gzY = toGanZhi(y - 1 - 4);
  }

  const firstNode = getTerm(y, m * 2 - 1);
  const secondNode = getTerm(y, m * 2);
  let gzM = toGanZhi((y - 1900) * 12 + m + 11);
  if (d >= firstNode) {
    gzM = toGanZhi((y - 1900) * 12 + m + 12);
  }

  let isTerm = false;
  let term = "";
  if (firstNode === d) {
    isTerm = true;
    term = lunarTerm[m * 2 - 2];
  }
  if (secondNode === d) {
    isTerm = true;
    term = lunarTerm[m * 2 - 1];
  }

  const dayCyclical = Date.UTC(y, sm, 1, 0, 0, 0, 0) / 86400000 + 25567 + 10;
  const gzD = toGanZhi(dayCyclical + d - 1);

  return {
    lYear: year,
    lMonth: month,
    lDay: day,
    animal: getAnimal(year),
    yearCn: toChinaYear(year),
    monthCn: (isLeap && leapM === month ? "闰" : "") + toChinaMonth(month),
    dayCn: toChinaDay(day),
    cYear: y,
    cMonth: m,
    cDay: d,
    gzYear: gzY,
    gzMonth: gzM,
    gzDay: gzD,
    isToday,
    isLeap,
    nWeek: nWeekAdjusted,
    ncWeek: "星期" + cWeek,
    isTerm,
    term,
  };
}

/**
 * 农历转公历
 * @param {number} y 农历年
 * @param {number} m 农历月 (1-12)
 * @param {number} d 农历日
 * @param {boolean} isLeapMonth 是否为闰月
 */
export function lunar2solar(y, m, d, isLeapMonth) {
  y = Number(y);
  m = Number(m);
  d = Number(d);
  isLeapMonth = Boolean(isLeapMonth);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return -1;

  const leapM = leapMonth(y);
  if (isLeapMonth && leapM !== m) return -1;
  if ((y === 2100 && m === 12 && d > 1) || (y === 1900 && m === 1 && d < 31)) return -1;

  const day = monthDays(y, m);
  if (y < 1900 || y > 2100 || d > day) return -1;

  let offset = 0;
  for (let i = 1900; i < y; i++) {
    offset += lYearDays(i);
  }

  let leap = 0;
  let isAdd = false;
  for (let i = 1; i < m; i++) {
    leap = leapMonth(y);
    if (!isAdd) {
      if (leap <= i && leap > 0) {
        offset += leapDays(y);
        isAdd = true;
      }
    }
    offset += monthDays(y, i);
  }
  if (isLeapMonth) {
    offset += day;
  }

  const stmap = Date.UTC(1900, 1, 30, 0, 0, 0);
  const calObj = new Date((offset + d - 31) * 86400000 + stmap);
  const cY = calObj.getUTCFullYear();
  const cM = calObj.getUTCMonth() + 1;
  const cD = calObj.getUTCDate();

  return solar2lunar(cY, cM, cD);
}

/**
 * 查询指定农历年、农历月（含闰月）的实际天数
 * 供纪念日"三十日"场景做兜底：某些年份对应月份是只有 29 天的小月，
 * 或者当年该月根本没有闰月时，可以据此把日子退回到该月最后一天，
 * 而不是让 lunar2solar 直接返回 -1、导致这一年整条纪念日被跳过
 * @param {number} y 农历年
 * @param {number} m 农历月 (1-12)
 * @param {boolean} isLeapMonth 是否查询闰月
 * @returns {number} 天数；若该年该月并不存在（例如请求闰月但当年没有这个闰月），返回 0
 */
export function lunarMonthLength(y, m, isLeapMonth) {
  y = Number(y);
  m = Number(m);
  if (y < 1900 || y > 2100 || m < 1 || m > 12) return 0;
  if (isLeapMonth) {
    return leapMonth(y) === m ? leapDays(y) : 0;
  }
  return monthDays(y, m);
}

export default { solar2lunar, lunar2solar, lunarMonthLength };
