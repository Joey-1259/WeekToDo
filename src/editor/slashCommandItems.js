/* FOCUS_EXPERIENCE_20261005_V2 */
function base(editor, range) {
  return editor.chain().focus().deleteRange(range);
}

/**
 * 正文、标题、列表和待办已经常驻顶部工具栏，
 * Slash 菜单只承担低频、进阶内容插入。
 */
/* FOCUS_EDITOR_ENHANCE_20261028_V1：标题项，支持 /3、/h3、/bt3、/三级、/### */
const CN_LEVEL = ["", "一", "二", "三", "四", "五", "六"];

function headingItems() {
  const items = [1, 2, 3, 4, 5, 6].map((level) => ({
    id: `heading-${level}`,
    category: "标题",
    title: `标题${level}`,
    description: `${CN_LEVEL[level]}级标题 · ${"#".repeat(level)} 空格 · ⌘⌥${level}`,
    icon: `H${level}`,
    shortcut: `/bt${level}`,
    aliases: [
      `h${level}`, String(level), `标题${level}`, `${CN_LEVEL[level]}级标题`,
      `bt${level}`, "#".repeat(level), "heading", "标题",
    ],
    command: ({ editor, range }) =>
      base(editor, range).setNode("heading", { level }).run(),
  }));

  items.unshift({
    id: "paragraph",
    category: "标题",
    title: "正文",
    description: "转为普通段落 · ⌘⌥0",
    icon: "T",
    shortcut: "/zw",
    aliases: ["paragraph", "text", "正文", "zw", "p"],
    command: ({ editor, range }) => base(editor, range).setParagraph().run(),
  });

  return items;
}

export function createSlashCommandItems(
  onTask,
  onImage
) {
  /* FOCUS_RICH_CONTENT_SYSTEM_20260907_V1 */
  /* FOCUS_DOCUMENT_UPGRADE_20261005_V1 */
  return [
    {
      id: "callout",
      category: "进阶内容",
      title: "高亮块",
      description: "强调说明、结论、建议与风险",
      icon: "!",
      shortcut: "/glk",
      aliases: [
        "callout", "提示块", "高亮块", "高亮", "提示", "注意", "glk"
      ],
      command: ({ editor, range }) =>
        base(editor, range).insertFocusCallout().run(),
    },
    {
      id: "linked-task",
      category: "进阶内容",
      title: "关联事项",
      description: "创建或关联每周事项",
      icon: "↗",
      shortcut: "/sx",
      aliases: [
        "task",
        "week",
        "事项",
        "关联事项",
        "每周事项",
        "sx",
        "glsx",
      ],
      command: ({ editor, range }) => {
        base(editor, range).run();
        onTask?.();
      },
    },
    {
      id: "image",
      category: "进阶内容",
      title: "图片",
      description: "粘贴或插入本地图片",
      icon: "▧",
      shortcut: "/tp",
      aliases: [
        "image",
        "picture",
        "图片",
        "插图",
        "tp",
      ],
      command: ({ editor, range }) => {
        base(editor, range).run();
        onImage?.();
      },
    },

    /* FOCUS_MIND_MAP_SLASH_20260920_V1 */
    {
      id: "mind-map",
      category: "进阶内容",
      title: "思维导图",
      description: "插入可全屏编辑的思维导图",
      icon: "◇",
      shortcut: "/swdt",
      aliases: [
        "mindmap",
        "mind-map",
        "map",
        "思维导图",
        "脑图",
        "swdt",
      ],
      command: ({ editor, range }) =>
        base(editor, range)
          .insertFocusMindMap()
          .run(),
    },
    {
      id: "code-block",
      category: "进阶内容",
      title: "代码块",
      description: "插入多行代码内容",
      icon: "</>",
      shortcut: "/dmk",
      aliases: ["code", "代码", "代码块", "dmk"],
      command: ({ editor, range }) =>
        base(editor, range).toggleCodeBlock().run(),
    },
    {
      id: "details",
      category: "进阶内容",
      title: "折叠块",
      description: "收纳可展开或折叠的内容",
      icon: "▶",
      shortcut: "/zdk",
      aliases: [
        "details",
        "toggle",
        "collapse",
        "折叠",
        "折叠块",
        "zdk",
      ],
      command: ({ editor, range }) =>
        base(editor, range)
          .setDetails()
          .updateAttributes("details", { open: true })
          .run(),
    },
    {
      id: "blockquote",
      category: "进阶内容",
      title: "引用",
      description: "插入引用内容",
      icon: "❝",
      shortcut: "/yy",
      aliases: ["quote", "引用", "yy"],
      command: ({ editor, range }) =>
        base(editor, range).toggleBlockquote().run(),
    },
    {
      id: "divider",
      category: "进阶内容",
      title: "分割线",
      description: "分隔上下内容",
      icon: "—",
      shortcut: "/fgx",
      aliases: ["divider", "line", "hr", "分割线", "fgx"],
      command: ({ editor, range }) =>
        base(editor, range).setHorizontalRule().run(),
    },
    ...headingItems(),
  ];
}
