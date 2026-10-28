/* FOCUS_EDITOR_ENHANCE_20261028_V1：命令模糊匹配（精确 > 前缀 > 包含 > 子序列，数字⇄中文数字互通） */
const CN = { 1: "一", 2: "二", 3: "三", 4: "四", 5: "五", 6: "六", 7: "七", 8: "八", 9: "九" };
const CN_REVERSE = Object.fromEntries(Object.entries(CN).map(([k, v]) => [v, k]));

export function normalize(value) {
  return String(value || "").toLowerCase().replace(/[\s\-_/、]/g, "");
}

function variants(keyword) {
  const set = new Set([keyword]);
  set.add(keyword.replace(/[1-9]/g, (d) => CN[d]));
  set.add(keyword.replace(/[一二三四五六七八九]/g, (c) => CN_REVERSE[c]));
  return [...set].filter(Boolean);
}

function scoreText(value, keyword) {
  if (!value || !keyword) return null;
  if (value === keyword) return 1000;
  if (value.startsWith(keyword)) return 800 - value.length;
  const index = value.indexOf(keyword);
  if (index >= 0) return 600 - index - value.length * 0.1;
  if (keyword.length < 2) return null;

  let from = 0;
  let last = -1;
  let gaps = 0;
  for (const ch of keyword) {
    const found = value.indexOf(ch, from);
    if (found < 0) return null;
    if (last >= 0) gaps += found - last - 1;
    last = found;
    from = found + 1;
  }
  return 300 - gaps * 10 - value.length;
}

export function fuzzyFilter(items, query, fields, limit = 12) {
  const keyword = normalize(query);
  if (!keyword) return items;
  const keys = variants(keyword);

  return items
    .map((item) => {
      let best = null;
      for (const value of fields(item).map(normalize)) {
        for (const key of keys) {
          const score = scoreText(value, key);
          if (score !== null && (best === null || score > best)) best = score;
        }
      }
      return { item, score: best };
    })
    .filter(({ score }) => score !== null)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item)
    .slice(0, limit);
}
