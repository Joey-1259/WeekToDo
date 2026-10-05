const PREFERENCE_KEY = "weektodo.focus.callout.presentation.v2";

export const CALLOUT_TYPES = Object.freeze({
  info: { label: "信息", icon: "ℹ", defaultColor: "blue" },
  tip: { label: "提示", icon: "✦", defaultColor: "purple" },
  success: { label: "成功", icon: "✓", defaultColor: "green" },
  warning: { label: "注意", icon: "!", defaultColor: "yellow" },
  danger: { label: "重要", icon: "!", defaultColor: "red" },
});

export const CALLOUT_COLORS = Object.freeze({
  blue: { label: "蓝色", accent: "#4263b8" },
  purple: { label: "紫色", accent: "#8562b0" },
  green: { label: "绿色", accent: "#3b845d" },
  yellow: { label: "黄色", accent: "#b58919" },
  red: { label: "红色", accent: "#ba5555" },
  orange: { label: "橙色", accent: "#bd763d" },
  gray: { label: "灰色", accent: "#737d8b" },
});

export function normalizeCalloutTone(value) {
  const normalized = value === "tips" ? "tip" : value;
  return Object.hasOwn(CALLOUT_TYPES, normalized) ? normalized : "info";
}

export function normalizeCalloutColor(value) {
  if (value === "default" || !value) return "default";
  if (Object.hasOwn(CALLOUT_COLORS, value)) return value;

  return /^#[0-9a-f]{6}$/i.test(String(value))
    ? String(value).toLowerCase()
    : "default";
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
  const resolved = color === "default" ? type.defaultColor : color;

  const accent = resolved.startsWith("#")
    ? resolved
    : CALLOUT_COLORS[resolved].accent;

  const background = mix("#ffffff", accent, 0.11);
  const border = mix("#ffffff", accent, 0.30);

  return {
    tone,
    color,
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

export function readCalloutPreference(storage = globalThis.localStorage) {
  try {
    const value = JSON.parse(storage?.getItem(PREFERENCE_KEY) || "null");

    return {
      tone: normalizeCalloutTone(value?.tone),
      color: normalizeCalloutColor(value?.color),
    };
  } catch {
    return { tone: "info", color: "default" };
  }
}

export function rememberCalloutPreference(
  attributes,
  storage = globalThis.localStorage
) {
  const value = {
    tone: normalizeCalloutTone(attributes?.tone),
    color: normalizeCalloutColor(attributes?.color),
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
