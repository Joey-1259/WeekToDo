/* FOCUS_UI_SYSTEM_20260909_V4 */

/**
 * 统一图标源。
 * 约定：24×24 网格，描边风格，线宽由 AppIcon 统一设置为 1.6。
 * 需要实心的元素单独写 fill="currentColor" stroke="none"。
 */
export const ICONS = {
  /* ---------- 编辑器：工具类 ---------- */

  // 格式刷：刷头 + 刷柄，与主流办公软件一致
  formatPainter: `
    <rect x="4" y="3.2" width="16" height="5.6" rx="1.5"/>
    <path d="M10.6 8.8v3.4H9.4A1.9 1.9 0 0 0 7.5 14.1v4.9c0 1.05.85 1.9 1.9 1.9h5.2c1.05 0 1.9-.85 1.9-1.9v-4.9a1.9 1.9 0 0 0-1.9-1.9h-1.2V8.8"/>
    <path d="M12 15.4v2.2"/>
  `,

  eraser: `
    <path d="m9.4 20-5-5a1.8 1.8 0 0 1 0-2.5l7.6-7.6a1.8 1.8 0 0 1 2.5 0l4.6 4.6a1.8 1.8 0 0 1 0 2.5L12.4 20z"/>
    <path d="M9.4 20H20.2"/>
    <path d="m8 9.6 6.4 6.4"/>
  `,

  clipboard: `
    <rect x="5" y="5.4" width="14" height="15.2" rx="2.2"/>
    <rect x="9" y="3" width="6" height="4.2" rx="1.3"/>
    <path d="M8.8 12.4h6.4M8.8 16.2h4.4"/>
  `,

  /* ---------- 编辑器：行内样式 ---------- */

  bold: `
    <path d="M7.4 4.8h5.4a3.5 3.5 0 0 1 0 7H7.4z"/>
    <path d="M7.4 11.8h6.2a3.7 3.7 0 0 1 0 7.4H7.4z"/>
  `,

  italic: `<path d="M10.2 4.8h6M7.8 19.2h6M14 4.8l-4 14.4"/>`,

  underline: `
    <path d="M7 4.6v6.2a5 5 0 0 0 10 0V4.6"/>
    <path d="M5.8 20h12.4"/>
  `,

  strike: `
    <path d="M4.6 12h14.8"/>
    <path d="M8.6 8.4c0-2.1 1.5-3.5 3.7-3.5 1.9 0 3.2.8 3.7 2.1"/>
    <path d="M7.9 15.4c.3 2.2 2 3.6 4.4 3.6 2.4 0 4-1.2 4-3"/>
  `,

  textColor: `
    <path d="M5.6 16.6 10.9 4.4h2.2l5.3 12.2"/>
    <path d="M7.9 12.4h8.2"/>
  `,

  highlight: `
    <path d="m13.6 4.6 5.8 5.8-7.6 7.6H6.6l-.8-3.2z"/>
    <path d="m10.4 7.8 5.8 5.8"/>
  `,

  inlineCode: `<path d="m9.2 8.2-4 3.8 4 3.8M14.8 8.2l4 3.8-4 3.8"/>`,

  /* ---------- 编辑器：段落 ---------- */

  bulletList: `
    <path d="M9.2 6.2h10.6M9.2 12h10.6M9.2 17.8h10.6"/>
    <circle cx="4.9" cy="6.2" r="1.25" fill="currentColor" stroke="none"/>
    <circle cx="4.9" cy="12" r="1.25" fill="currentColor" stroke="none"/>
    <circle cx="4.9" cy="17.8" r="1.25" fill="currentColor" stroke="none"/>
  `,

  orderedList: `
    <path d="M10 6.2h9.8M10 12h9.8M10 17.8h9.8"/>
    <path d="M4.4 7.8V4.2l-1.1.8"/>
    <path d="M3.3 10.6h2.3L3.3 13.6h2.5"/>
    <path d="M3.4 16.2h2.2v3.4H3.4"/>
  `,

  taskList: `
    <rect x="3.2" y="4.4" width="6.2" height="6.2" rx="1.5"/>
    <path d="m4.9 7.6 1.4 1.4 2.3-2.7"/>
    <rect x="3.2" y="13.4" width="6.2" height="6.2" rx="1.5"/>
    <path d="M12.4 7.5h8.4M12.4 16.5h8.4"/>
  `,

  quote: `
    <path d="M4.6 18.4v-4.6c0-3.2 1.7-5.4 4.8-6.2l.5 1.7c-1.9.6-2.9 1.8-2.9 3.5h2.6v5.6z"
      fill="currentColor" stroke="none"/>
    <path d="M13.5 18.4v-4.6c0-3.2 1.7-5.4 4.8-6.2l.5 1.7c-1.9.6-2.9 1.8-2.9 3.5h2.6v5.6z"
      fill="currentColor" stroke="none"/>
  `,

  indentIncrease: `
    <path d="M4.4 5.2h15.2M9.6 10.2h10M9.6 13.8h10M4.4 18.8h15.2"/>
    <path d="m4.4 9.4 3 2.6-3 2.6"/>
  `,

  indentDecrease: `
    <path d="M4.4 5.2h15.2M9.6 10.2h10M9.6 13.8h10M4.4 18.8h15.2"/>
    <path d="m7.4 9.4-3 2.6 3 2.6"/>
  `,

  horizontalRule: `
    <path d="M4 12h16"/>
    <path d="M6.6 6.6h10.8M6.6 17.4h10.8" opacity=".38"/>
  `,

  /* ---------- 编辑器：插入 ---------- */

  link: `
    <path d="M10.4 13.6a4.1 4.1 0 0 0 5.9 0l2.2-2.2a4.1 4.1 0 1 0-5.8-5.8l-1.3 1.3"/>
    <path d="M13.6 10.4a4.1 4.1 0 0 0-5.9 0l-2.2 2.2a4.1 4.1 0 1 0 5.8 5.8l1.3-1.3"/>
  `,

  image: `
    <rect x="3.4" y="4.8" width="17.2" height="14.4" rx="2.2"/>
    <circle cx="8.8" cy="10" r="1.5"/>
    <path d="m4.4 17.4 4.6-4.6a1.7 1.7 0 0 1 2.4 0l3.4 3.4"/>
    <path d="m13.6 14.6 1.6-1.6a1.7 1.7 0 0 1 2.4 0l2 2"/>
  `,

  taskLink: `
    <path d="M4 6.6h9.6M4 12h7.2M4 17.4h5.2"/>
    <circle cx="17.4" cy="16.4" r="4"/>
    <path d="M17.4 14.6v3.6M15.6 16.4h3.6"/>
  `,

  codeBlock: `
    <rect x="3" y="4.8" width="18" height="14.4" rx="2.2"/>
    <path d="m9.4 10-2 2 2 2M14.6 10l2 2-2 2"/>
  `,

  markdown: `
    <rect x="2.6" y="5.6" width="18.8" height="12.8" rx="2.2"/>
    <path d="M6.2 15.4V8.6l2.7 3.2 2.7-3.2v6.8"/>
    <path d="M16.6 8.8v5.4"/>
    <path d="m14.4 12.4 2.2 2.4 2.2-2.4"/>
  `,

  textWrap: `
    <path d="M4 6.2h16"/>
    <path d="M4 12h12.4a3.1 3.1 0 1 1 0 6.2h-3.2"/>
    <path d="m14.8 15.6-2.6 2.6 2.6 2.6"/>
    <path d="M4 18.2h4.4"/>
  `,

  copy: `
    <rect x="9" y="9" width="11.4" height="11.4" rx="2.2"/>
    <path d="M15.2 5.2H6a2.2 2.2 0 0 0-2.2 2.2v9.2"/>
  `,

  /* ---------- 通用 ---------- */

  chevronDown: `<path d="m6.6 9.4 5.4 5.2 5.4-5.2"/>`,
  chevronLeft: `<path d="m14.4 5.4-6 6.6 6 6.6"/>`,
  chevronRight: `<path d="m9.6 5.4 6 6.6-6 6.6"/>`,
  plus: `<path d="M12 5v14M5 12h14"/>`,
  close: `<path d="m6.6 6.6 10.8 10.8M17.4 6.6 6.6 17.4"/>`,

  expand: `
    <path d="M8 4.4H5.6A1.6 1.6 0 0 0 4 6v2.4"/>
    <path d="M16 4.4h2.4A1.6 1.6 0 0 1 20 6v2.4"/>
    <path d="M8 19.6H5.6A1.6 1.6 0 0 1 4 18v-2.4"/>
    <path d="M16 19.6h2.4a1.6 1.6 0 0 0 1.6-1.6v-2.4"/>
  `,

  more: `
    <circle cx="5.2" cy="12" r="1.5" fill="currentColor" stroke="none"/>
    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>
    <circle cx="18.8" cy="12" r="1.5" fill="currentColor" stroke="none"/>
  `,

  folder: `
    <path d="M3.6 6.6A1.6 1.6 0 0 1 5.2 5h4L11.4 7.6h7.4A1.6 1.6 0 0 1 20.4 9.2v8.2a1.6 1.6 0 0 1-1.6 1.6H5.2a1.6 1.6 0 0 1-1.6-1.6z"/>
  `,

  search: `
    <circle cx="10.6" cy="10.6" r="6"/>
    <path d="m15 15 4.6 4.6"/>
  `,

  columns: `
    <rect x="2.8" y="4.4" width="5.6" height="15.2" rx="1.4"/>
    <rect x="9.2" y="4.4" width="5.6" height="15.2" rx="1.4"/>
    <rect x="15.6" y="4.4" width="5.6" height="15.2" rx="1.4"/>
  `,
};

export default ICONS;
