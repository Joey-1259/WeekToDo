/**
 * UNIFIED_TAG_SYSTEM_V2 — 统一颜色标签体系
 *
 * 第一项是灰色"未分类"，与 macOS Finder 的无标签灰圆对齐。
 * 颜色值与原 colorPicker.vue 完全一致，确保数据向前兼容。
 */

const STORAGE_KEY = "weektodo_tag_names";

const PRESET_TAGS = [
  { id: "tag_gray",    color: "#6b7280", defaultName: "未分类" },
  { id: "tag_green",   color: "#77e785", defaultName: "工作" },
  { id: "tag_cyan",    color: "#06b6d4", defaultName: "学习" },
  { id: "tag_blue",    color: "#5e6ef2", defaultName: "项目" },
  { id: "tag_purple",  color: "#8b5cf6", defaultName: "灵感" },
  { id: "tag_pink",    color: "#ed56a1", defaultName: "生活" },
  { id: "tag_red",     color: "#ed544b", defaultName: "紧急" },
  { id: "tag_orange",  color: "#f97316", defaultName: "健康" },
  { id: "tag_yellow",  color: "#f9d54a", defaultName: "待定" },
  { id: "tag_brown",   color: "#ba7956", defaultName: "" },
  { id: "tag_dark",    color: "#030712", defaultName: "" },
];

function loadCustomNames() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveCustomNames(map) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(map)); }
  catch { /* noop */ }
}

export default {
  getDefaultTags() {
    const custom = loadCustomNames();
    return PRESET_TAGS.map((t) => ({
      id: t.id,
      color: t.color,
      name: custom[t.id] !== undefined ? custom[t.id] : t.defaultName,
    }));
  },

  findTagByColor(color) {
    if (!color || color === "none") return null;
    return PRESET_TAGS.find((t) => t.color === color) || null;
  },

  getColorById(tagId) {
    const t = PRESET_TAGS.find((t) => t.id === tagId);
    return t ? t.color : null;
  },

  renameTag(tagId, newName) {
    const c = loadCustomNames();
    c[tagId] = String(newName || "").trim();
    saveCustomNames(c);
  },

  getTagName(tagId) {
    const c = loadCustomNames();
    if (c[tagId] !== undefined) return c[tagId];
    const t = PRESET_TAGS.find((t) => t.id === tagId);
    return t ? t.defaultName : "";
  },

  PRESET_TAGS,
};
