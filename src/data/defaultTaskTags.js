/**
 * UNIFIED_TAG_SYSTEM_V4
 *
 * 色板布局：无标签(空心) → 蓝 → 橙 → 红 → 紫 → 灰(未分类)
 * 去掉绿色，灰色放末尾。
 * 扩展色板另有 5 色。
 *
 * 配色参考 Linear + Todoist + Tailwind 500 色阶。
 */

const STORAGE_KEY = "weektodo_tag_names";

const PRESET_TAGS = [
  /* ── 主色板（默认展示，按用户指定顺序） ── */
  { id: "tag_blue",    color: "#3b82f6", defaultName: "",       primary: true,  order: 1 },
  { id: "tag_amber",   color: "#f59e0b", defaultName: "",       primary: true,  order: 2 },
  { id: "tag_red",     color: "#ef4444", defaultName: "",       primary: true,  order: 3 },
  { id: "tag_purple",  color: "#a855f7", defaultName: "",       primary: true,  order: 4 },
  { id: "tag_gray",    color: "#9ca3af", defaultName: "未分类", primary: true,  order: 5 },

  /* ── 扩展色板（点击更多展开） ── */
  { id: "tag_cyan",    color: "#06b6d4", defaultName: "",       primary: false, order: 6 },
  { id: "tag_pink",    color: "#ec4899", defaultName: "",       primary: false, order: 7 },
  { id: "tag_orange",  color: "#f97316", defaultName: "",       primary: false, order: 8 },
  { id: "tag_indigo",  color: "#6366f1", defaultName: "",       primary: false, order: 9 },
  { id: "tag_green",   color: "#10b981", defaultName: "",       primary: false, order: 10 },
];

function loadCustomNames() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}

function saveCustomNames(map) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(map)); }
  catch { /* ignore */ }
}

export default {
  getDefaultTags() {
    const custom = loadCustomNames();
    return PRESET_TAGS.map((t) => ({
      id: t.id,
      color: t.color,
      name: custom[t.id] !== undefined ? custom[t.id] : t.defaultName,
      primary: t.primary,
      order: t.order,
    }));
  },

  getPrimaryTags() {
    return this.getDefaultTags().filter((t) => t.primary).sort((a, b) => a.order - b.order);
  },

  getExtendedTags() {
    return this.getDefaultTags().filter((t) => !t.primary).sort((a, b) => a.order - b.order);
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
