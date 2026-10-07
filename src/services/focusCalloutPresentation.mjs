/* FOCUS_CALLOUT_COLOR_20261007_V3
 *
 * 高亮块的唯一可见属性是背景色（参考语雀高亮块）。
 * tone 仅为兼容历史文档与 :::info / :::warning 语法保留：
 *   color === "default" 时按 tone 映射默认色，界面上不再出现类型标签与图标。
 * 导出名与上一版完全一致（导出服务依赖 getCalloutPresentation / CALLOUT_PRESETS）。
 */
const PREFERENCE_KEY = "weektodo.focus.callout.presentation.v2";

export const DEFAULT_CALLOUT_COLOR = "blue";

export const CALLOUT_TYPES = Object.freeze({
  info: { label: "信息", icon: "ℹ", defaultColor: "blue" },
  tip: { label: "提示", icon: "✦", defaultColor: "purple" },
  success: { label: "成功", icon: "✓", defaultColor: "green" },
  warning: { label: "注意", icon: "!", defaultColor: "yellow" },
  danger: { label: "重要", icon: "!", defaultColor: "red" },
});

/* 色板顺序即工具条顺序：冷色 → 暖色 → 中性。 */
export const CALLOUT_COLORS = Object.freeze({
  blue: { label: "蓝色", accent: "#4263b8" },
  cyan: { label: "青色", accent: "#2b8aa8" },
  green: { label: "绿色", accent: "#3b845d" },
  yellow: { label: "黄色", accent: "#b58919" },
  orange: { label: "橙色", accent: "#bd763d" },
  red: { label: "红色", accent: "#ba5555" },
  purple: { label: "紫色", accent: "#8562b0" },
  gray: { label: "灰色", accent: "#737d8b" },
});

export function normalizeCalloutTone(value) {
  const key = String(value || "").toLowerCase();
  const normalized = key === "tips" ? "tip" : key;
  return Object.hasOwn(CALLOUT_TYPES, normalized) ? normalized : "info";
}

export function normalizeCalloutColor(value) {
  if (value === "default" || !value) return "default";
  if (Object.hasOwn(CALLOUT_COLORS, value)) return value;

  return /^#[0-9a-f]{6}$/i.test(String(value))
    ? String(value).toLowerCase()
    : "default";
}

/** 实际生效的颜色：预设色 key 或 #rrggbb，永不返回 "default"。 */
export function resolveCalloutColor(toneValue, colorValue) {
  const color = normalizeCalloutColor(colorValue);
  if (color !== "default") return color;
  return CALLOUT_TYPES[normalizeCalloutTone(toneValue)].defaultColor;
}

function mix(base, accent, amount) {
  const parse = (color) =>
    [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16));

  const a = parse(base);
  const b = parse(accent);

  return "#" + a.map((channel, index) =>
    Math.round(channel * (1 - amount) + b[index] * amount)
      .toString(16)
      .padStart(2, "0")
  ).join("");
}

export function getCalloutPresentation(toneValue, colorValue = "default") {
  const tone = normalizeCalloutTone(toneValue);
  const type = CALLOUT_TYPES[tone];
  const color = normalizeCalloutColor(colorValue);
  const resolved = resolveCalloutColor(tone, color);

  const accent = resolved.startsWith("#")
    ? resolved
    : CALLOUT_COLORS[resolved].accent;

  const background = mix("#ffffff", accent, 0.11);
  const border = mix("#ffffff", accent, 0.3);

  return {
    tone,
    color,
    resolved,
    label: type.label,
    icon: type.icon,
    accent,
    background,
    border,
    darkBackground: mix("#1d232b", accent, 0.22),
    darkBorder: mix("#1d232b", accent, 0.48),
    darkAccent: mix("#ffffff", accent, 0.38),
    wordFill: background.slice(1).toUpperCase(),
  };
}

export function getCalloutCssVariables(tone, color) {
  const palette = getCalloutPresentation(tone, color);

  return {
    "--fc-bg": palette.background,
    "--fc-border": palette.border,
    "--fc-accent": palette.accent,
    "--fc-dark-bg": palette.darkBackground,
    "--fc-dark-border": palette.darkBorder,
    "--fc-dark-accent": palette.darkAccent,
  };
}

/** 新建高亮块沿用上次颜色；旧版偏好（tone + default）自动换算成具体颜色。 */
export function readCalloutPreference(storage = globalThis.localStorage) {
  try {
    const value = JSON.parse(storage?.getItem(PREFERENCE_KEY) || "null");
    return { tone: "info", color: resolveCalloutColor(value?.tone, value?.color) };
  } catch {
    return { tone: "info", color: DEFAULT_CALLOUT_COLOR };
  }
}

export function rememberCalloutPreference(
  attributes,
  storage = globalThis.localStorage
) {
  const value = {
    tone: "info",
    color: resolveCalloutColor(attributes?.tone, attributes?.color),
  };

  try {
    storage?.setItem(PREFERENCE_KEY, JSON.stringify(value));
  } catch {
    // 偏好写入失败不影响编辑或文档保存。
  }

  return value;
}

export const CALLOUT_PRESETS = Object.freeze(
  Object.fromEntries(
    Object.keys(CALLOUT_TYPES).map((tone) => [
      tone,
      Object.freeze(getCalloutPresentation(tone)),
    ])
  )
);
