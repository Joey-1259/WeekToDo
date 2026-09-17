/**
 * UNIFIED_TAG_SYSTEM_V3
 *
 * Linear/Finder 风格：固定色板 + 可选命名
 * 配色参考 Tailwind CSS 500 色阶，保证高对比度和辨识度。
 *
 * 前 6 个为"主色板"（灰 + 5 色），默认直接展示。
 * 后 5 个为"扩展色板"，点击"更多"展开。
 */

const STORAGE_KEY = "weektodo_tag_names";

const PRESET_TAGS = [
  /* ── 主色板（默认展示） ── */
  { id: "tag_gray",    color: "#6b7280", defaultName: "未分类", primary: true },
  { id: "tag_blue",    color: "#3b82f6", defaultName: "",       primary: true },
  { id: "tag_green",   color: "#22c55e", defaultName: "",       primary: true },
  { id: "tag_amber",   color: "#f59e0b", defaultName: "",       primary: true },
  { id: "tag_red",     color: "#ef4444", defaultName: "",       primary: true },
  { id: "tag_purple",  color: "#a855f7", defaultName: "",       primary: true },

  /* ── 扩展色板（点击更多展开） ── */
  { id: "tag_cyan",    color: "#06b6d4", defaultName: "",       primary: false },
  { id: "tag_pink",    color: "#ec4899", defaultName: "",       primary: false },
  { id: "tag_orange",  color: "#f97316", defaultName: "",       primary: false },
  { id: "tag_lime",    color: "#84cc16", defaultName: "",       primary: false },
  { id: "tag_indigo",  color: "#6366f1", defaultName: "",       primary: false },
];

function loadCustomNames() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}

function saveCustomNames(map) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(map)); }
  catch {}
}

export default {
  getDefaultTags() {
    const custom = loadCustomNames();
    return PRESET_TAGS.map((t) => ({
      id: t.id,
      color: t.color,
      name: custom[t.id] !== undefined ? custom[t.id] : t.defaultName,
      primary: t.primary,
    }));
  },

  getPrimaryTags() {
    return this.getDefaultTags().filter((t) => t.primary);
  },

  getExtendedTags() {
    return this.getDefaultTags().filter((t) => !t.primary);
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
