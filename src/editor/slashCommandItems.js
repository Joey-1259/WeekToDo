function base(editor, range) {
  return editor.chain().focus().deleteRange(range);
}

/**
 * 正文、标题、列表和待办已经常驻顶部工具栏，
 * Slash 菜单只承担低频、进阶内容插入。
 */
export function createSlashCommandItems(
  onTask,
  onImage
) {
  /* FOCUS_RICH_CONTENT_SYSTEM_20260907_V1 */
  return [
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
  ];
}
