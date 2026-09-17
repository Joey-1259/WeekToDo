/**
 * UNIFIED_TAG_SYSTEM_20260917_V1
 *
 * 统一颜色标签体系：每个标签 = { id, color, name }
 * 合并了原 colorPicker 的 12 色与原 tagPicker 的 5 个语义标签。
 *
 * 设计参考：
 * - macOS Finder 颜色标签（7 色 + 名称可自定义）
 * - Notion tag 系统（颜色 + 文字一体）
 *
 * 颜色值与原 colorPicker.vue 完全一致，确保数据向前兼容。
 * name 字段支持用户自定义（存储在 localStorage），
 * 这里只提供工厂默认值。
 */

const STORAGE_KEY = "weektodo_tag_names";

const PRESET_TAGS = [
  { id: "tag_green",   color: "#77e785", defaultName: "工作" },
  { id: "tag_cyan",    color: "#06b6d4", defaultName: "学习" },
  { id: "tag_blue",    color: "#5e6ef2", defaultName: "项目" },
  { id: "tag_purple",  color: "#8b5cf6", defaultName: "灵感" },
  { id: "tag_pink",    color: "#ed56a1", defaultName: "生活" },
  { id: "tag_red",     color: "#ed544b", defaultName: "紧急" },
  { id: "tag_orange",  color: "#f97316", defaultName: "健康" },
  { id: "tag_yellow",  color: "#f9d54a", defaultName: "待定" },
  { id: "tag_brown",   color: "#ba7956", defaultName: "" },
  { id: "tag_gray",    color: "#6b7280", defaultName: "" },
  { id: "tag_dark",    color: "#030712", defaultName: "" },
];

function loadCustomNames() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCustomNames(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // localStorage 不可用时静默降级
  }
}

export default {
  /**
   * 获取所有预设标签（含用户自定义名称）
   * @returns {Array<{id: string, color: string, name: string}>}
   */
  getDefaultTags() {
    const custom = loadCustomNames();
    return PRESET_TAGS.map((tag) => ({
      id: tag.id,
      color: tag.color,
      name: custom[tag.id] !== undefined ? custom[tag.id] : tag.defaultName,
    }));
  },

  /**
   * 通过颜色值查找标签 ID（兼容老数据：todo.color → tag id）
   */
  findTagByColor(color) {
    if (!color || color === "none") return null;
    return PRESET_TAGS.find((t) => t.color === color) || null;
  },

  /**
   * 通过标签 ID 查找颜色
   */
  getColorById(tagId) {
    const tag = PRESET_TAGS.find((t) => t.id === tagId);
    return tag ? tag.color : null;
  },

  /**
   * 用户重命名标签
   */
  renameTag(tagId, newName) {
    const custom = loadCustomNames();
    custom[tagId] = String(newName || "").trim();
    saveCustomNames(custom);
  },

  /**
   * 获取标签的显示名称（空名称返回空字符串）
   */
  getTagName(tagId) {
    const custom = loadCustomNames();
    if (custom[tagId] !== undefined) return custom[tagId];
    const tag = PRESET_TAGS.find((t) => t.id === tagId);
    return tag ? tag.defaultName : "";
  },

  PRESET_TAGS,
};
