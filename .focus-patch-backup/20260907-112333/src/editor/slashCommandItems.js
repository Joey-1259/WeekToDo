function base(editor, range) {
  return editor.chain().focus().deleteRange(range);
}

export function createSlashCommandItems(onTask) {
  return [
    {
      id: "paragraph",
      category: "文字",
      title: "正文",
      description: "普通文本段落",
      icon: "T",
      shortcut: "/zw",
      aliases: ["text", "paragraph", "正文", "文本", "zw"],
      command: ({ editor, range }) =>
        base(editor, range).setParagraph().run(),
    },
    {
      id: "heading-1",
      category: "文字",
      title: "一级标题",
      description: "页面主标题",
      icon: "H1",
      shortcut: "/h1",
      aliases: ["h1", "heading1", "一级标题", "标题1", "bt1"],
      command: ({ editor, range }) =>
        base(editor, range)
          .setHeading({ level: 1 })
          .run(),
    },
    {
      id: "heading-2",
      category: "文字",
      title: "二级标题",
      description: "章节标题",
      icon: "H2",
      shortcut: "/h2",
      aliases: ["h2", "heading2", "二级标题", "标题2", "bt2"],
      command: ({ editor, range }) =>
        base(editor, range)
          .setHeading({ level: 2 })
          .run(),
    },
    {
      id: "heading-3",
      category: "文字",
      title: "三级标题",
      description: "小节标题",
      icon: "H3",
      shortcut: "/h3",
      aliases: ["h3", "heading3", "三级标题", "标题3", "bt3"],
      command: ({ editor, range }) =>
        base(editor, range)
          .setHeading({ level: 3 })
          .run(),
    },
    {
      id: "bullet-list",
      category: "文字",
      title: "无序列表",
      description: "项目符号列表",
      icon: "☷",
      shortcut: "/wxlb",
      aliases: ["bullet", "list", "无序列表", "wxlb"],
      command: ({ editor, range }) =>
        base(editor, range).toggleBulletList().run(),
    },
    {
      id: "ordered-list",
      category: "文字",
      title: "有序列表",
      description: "编号列表",
      icon: "1.",
      shortcut: "/yxlb",
      aliases: ["number", "ordered", "有序列表", "yxlb"],
      command: ({ editor, range }) =>
        base(editor, range).toggleOrderedList().run(),
    },
    {
      id: "check-list",
      category: "文字",
      title: "待办清单",
      description: "编辑器内的勾选清单",
      icon: "☑",
      shortcut: "/db",
      aliases: ["todo", "checklist", "待办", "清单", "db"],
      command: ({ editor, range }) =>
        base(editor, range).toggleTaskList().run(),
    },
    {
      id: "linked-task",
      category: "基础",
      title: "关联事项",
      description: "创建每周事项或指定日期事项",
      icon: "↗",
      shortcut: "/sx",
      aliases: [
        "task",
        "week",
        "calendar",
        "事项",
        "关联事项",
        "每周事项",
        "日历",
        "sx",
        "glsx",
      ],
      command: ({ editor, range }) => {
        base(editor, range).run();
        onTask?.();
      },
    },
    {
      id: "code-block",
      category: "基础",
      title: "代码块",
      description: "支持多行代码内容",
      icon: "</>",
      shortcut: "/dmk",
      aliases: ["code", "代码", "代码块", "dmk"],
      command: ({ editor, range }) =>
        base(editor, range).toggleCodeBlock().run(),
    },
    {
      id: "details",
      category: "布局与样式",
      title: "折叠块",
      description: "使用标题收纳可折叠内容",
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
      category: "布局与样式",
      title: "引用",
      description: "插入引用格式",
      icon: "❝",
      shortcut: "/yy",
      aliases: ["quote", "引用", "yy"],
      command: ({ editor, range }) =>
        base(editor, range).toggleBlockquote().run(),
    },
    {
      id: "highlight",
      category: "布局与样式",
      title: "高亮",
      description: "使用背景色强调内容",
      icon: "A",
      shortcut: "/gl",
      aliases: ["highlight", "mark", "高亮", "gl"],
      command: ({ editor, range }) =>
        base(editor, range).toggleHighlight().run(),
    },
    {
      id: "divider",
      category: "布局与样式",
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
