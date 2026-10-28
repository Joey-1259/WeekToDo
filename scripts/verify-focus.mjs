/* FOCUS_POLISH_20261028_V2 · 轻量自检：静态检查（确认补丁已生效）+ 模糊匹配单测 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");

let failed = 0;
const check = (name, fn) => {
  try {
    fn();
    console.log("  ✓", name);
  } catch (error) {
    failed += 1;
    console.error("  ✗", name, "\n     ", error.message);
  }
};

console.log("1) 静态检查");
const STATIC = [
  ["src/views/focusDocuments/FocusDocumentEditor.vue", ":should-show=\"bubbleShouldShow\"", "气泡菜单不再覆盖图片工具栏"],
  ["src/editor/extensions/SlashCommands.js", "view.hasFocus()", "/ 菜单只在焦点编辑器弹出"],
  ["src/editor/extensions/DateMention.js", "view.hasFocus()", "@ 菜单只在焦点编辑器弹出"],
  ["src/views/focusDocuments/FocusDocumentDialog.vue", "fdx-tabs", "全屏专注模式标签栏"],
  ["src/views/focusDocuments/FocusDocumentsView.vue", ":tabs=\"dialogTabs\"", "标签栏数据接入"],
  ["src/views/focusDocuments/FocusMindMapNodeView.vue", "fmm-card-actions", "思维导图极简卡片"],
  ["src/views/focusDocuments/FocusDirectoryBrowser.vue", "focusDirectoryEnhance", "目录增强 mixin 已注册"],
  ["src/views/focusDocuments/FocusDirectoryBrowser.vue", "fxRowDrop(row, $event)", "拖拽落点即时计算"],
];
for (const [file, needle, label] of STATIC) {
  check(label, () => assert.ok(read(file).includes(needle), `${file} 缺少 ${needle}`));
}

console.log("2) 模糊匹配");
const { fuzzyFilter } = await import(pathToFileURL(path.join(root, "src/editor/fuzzyMatch.js")).href);
const items = [
  { title: "高亮块", aliases: ["glk", "callout"] },
  { title: "标题1", aliases: ["h1", "1", "一级标题", "bt1", "#"] },
  { title: "标题3", aliases: ["h3", "3", "三级标题", "bt3", "###"] },
];
const fields = (item) => [item.title, ...item.aliases];
const first = (q) => fuzzyFilter(items, q, fields)[0]?.title;

check("“3” → 标题3", () => assert.equal(first("3"), "标题3"));
check("“三级” → 标题3", () => assert.equal(first("三级"), "标题3"));
check("“h1” → 标题1", () => assert.equal(first("h1"), "标题1"));
check("“glk” → 高亮块", () => assert.equal(first("glk"), "高亮块"));
check("空查询返回全部", () => assert.equal(fuzzyFilter(items, "", fields).length, 3));

console.log(failed ? `\n${failed} 项失败 ❌` : "\n全部通过 ✅");
process.exit(failed ? 1 : 0);
