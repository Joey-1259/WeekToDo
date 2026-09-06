function base(editor, range) {
  return editor.chain().focus().deleteRange(range);
}

export function createSlashCommandItems(onTask) {
  return [
    {
      title: "正文",
      description: "普通文本",
      icon: "T",
      aliases: ["text", "paragraph", "正文", "文本", "zw"],
      command: ({ editor, range }) =>
        base(editor, range).setParagraph().run(),
    },
    {
      title: "一级标题",
      description: "页面主标题",
      icon: "H1",
      aliases: ["h1", "heading1", "标题1", "一级标题", "bt1"],
      command: ({ editor, range }) =>
        base(editor, range)
          .setHeading({ level: 1 })
          .run(),
    },
    {
      title: "二级标题",
      description: "章节标题",
      icon: "H2",
      aliases: ["h2", "heading2", "标题2", "二级标题", "bt2"],
      command: ({ editor, range }) =>
        base(editor, range)
          .setHeading({ level: 2 })
          .run(),
    },
    {
      title: "三级标题",
      description: "小节标题",
      icon: "H3",
      aliases: ["h3", "heading3", "标题3", "三级标题", "bt3"],
      command: ({ editor, range }) =>
        base(editor, range)
          .setHeading({ level: 3 })
          .run(),
    },
    {
      title: "无序列表",
      description: "项目符号列表",
      icon: "•",
      aliases: ["bullet", "list", "无序列表", "wxlb"],
      command: ({ editor, range }) =>
        base(editor, range).toggleBulletList().run(),
    },
    {
      title: "有序列表",
      description: "编号列表",
      icon: "1.",
      aliases: ["number", "ordered", "有序列表", "yxlb"],
      command: ({ editor, range }) =>
        base(editor, range).toggleOrderedList().run(),
    },
    {
      title: "待办清单",
      description: "编辑器内的勾选清单",
      icon: "☑",
      aliases: ["todo", "checklist", "待办", "清单", "db"],
      command: ({ editor, range }) =>
        base(editor, range).toggleTaskList().run(),
    },
    {
      title: "关联事项",
      description: "创建每周事项或指定日期事项",
      icon: "↗",
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
      title: "折叠块",
      description: "可展开和收起的内容",
      icon: "▸",
      aliases: [
        "details",
        "toggle",
        "collapse",
        "折叠",
        "折叠块",
        "zdk",
      ],
      command: ({ editor, range }) =>
        base(editor, range).setDetails().run(),
    },
    {
      title: "引用",
      description: "引用或强调内容",
      icon: "❝",
      aliases: ["quote", "引用", "yy"],
      command: ({ editor, range }) =>
        base(editor, range).toggleBlockquote().run(),
    },
    {
      title: "代码块",
      description: "预格式化代码",
      icon: "</>",
      aliases: ["code", "代码", "代码块", "dmk"],
      command: ({ editor, range }) =>
        base(editor, range).toggleCodeBlock().run(),
    },
    {
      title: "分割线",
      description: "分隔上下内容",
      icon: "—",
      aliases: ["divider", "line", "hr", "分割线", "fgx"],
      command: ({ editor, range }) =>
        base(editor, range).setHorizontalRule().run(),
    },
    {
      title: "高亮",
      description: "强调当前文字",
      icon: "A",
      aliases: ["highlight", "mark", "高亮", "gl"],
      command: ({ editor, range }) =>
        base(editor, range).toggleHighlight().run(),
    },
  ];
}
