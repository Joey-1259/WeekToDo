/* FOCUS_POLISH_20261028_V3 · 自检：静态检查（补丁是否生效）+ 纯函数单测 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");
const load = (file) => import(pathToFileURL(path.join(root, file)).href);

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

const V = "src/views/focusDocuments/";

console.log("1) 静态检查");
const has = [
  ["src/views/focusDocuments/FocusDocumentEditor.vue", ':should-show="bubbleShouldShow"', "图片只保留一条工具栏"],
  ["src/editor/extensions/SlashCommands.js", "view.hasFocus()", "/ 菜单只在焦点编辑器弹出"],
  [V + "FocusDocumentDialog.vue", "FocusDialogSidebar", "宽屏目录栏"],
  [V + "FocusDocumentDialog.vue", "savingId", "切换标签的保存竞态修复"],
  [V + "FocusDocumentDialog.vue", "event.defaultPrevented", "Esc 不再误关全屏"],
  [V + "FocusDocumentDialog.vue", "<kbd>Esc</kbd> 退出", "右上角 Esc 提示"],
  [V + "FocusDocumentsView.vue", ':documents="documents"', "目录栏数据接入"],
  [V + "FocusMindMapNodeView.vue", "fmrStart('left'", "思维导图左右手柄"],
  [V + "FocusMindMapNodeView.vue", "fmrStart('bottom'", "思维导图高度手柄"],
  ["src/editor/extensions/FocusMindMap.js", "previewHeight", "思维导图高度属性"],
  [V + "FocusDirectoryBrowser.vue", "fxPointerDown(row, $event)", "目录 Pointer 拖拽"],
  [V + "FocusDirectoryBrowser.vue", "data-root-drop", "移出目录落区"],
  [V + "FocusDocumentDialog.vue", "切换前保存失败", "切换文档前兜底保存"],
  [V + "FocusDocumentEditor.vue", "onPreviewEsc", "Esc 关闭图片预览"],
  [V + "focusMindMapResize.js", "contentWidth(parent)", "思维导图宽度按内容区计算"],
];
for (const [file, needle, label] of has) {
  check(label, () => assert.ok(read(file).includes(needle), `${file} 缺少 ${needle}`));
}

const hasNot = [
  [V + "FocusDocumentsView.vue", ':key="dialogDocument.id"', "切换文档不再重建全屏层（去闪烁）"],
  [V + "FocusDirectoryBrowser.vue", "fxRowDrop(", "旧 HTML5 拖拽绑定已移除"],
  [V + "focusDialogFocusMode.css", "fdx-in", "切换动画已移除"],
];
for (const [file, needle, label] of hasNot) {
  check(label, () => assert.ok(!read(file).includes(needle), `${file} 仍包含 ${needle}`));
}

console.log("2) 模糊匹配");
const { fuzzyFilter } = await load("src/editor/fuzzyMatch.js");
const items = [
  { title: "高亮块", aliases: ["glk", "callout"] },
  { title: "标题1", aliases: ["h1", "1", "一级标题", "bt1", "#"] },
  { title: "标题3", aliases: ["h3", "3", "三级标题", "bt3", "###"] },
];
const fields = (item) => [item.title, ...item.aliases];
const first = (q) => fuzzyFilter(items, q, fields)[0]?.title;
check("“3” → 标题3", () => assert.equal(first("3"), "标题3"));
check("“三级” → 标题3", () => assert.equal(first("三级"), "标题3"));
check("“glk” → 高亮块", () => assert.equal(first("glk"), "高亮块"));

console.log("3) 目录拖拽规则");
const { resolveDropZone, buildMovePayload } = await load(V + "focusTreeDnd.js");
check("文档拖到目录行任意位置 = 移入", () => {
  for (const r of [0.05, 0.5, 0.95]) assert.equal(resolveDropZone("doc", "folder", r), "into");
});
check("文档拖到文档行：上半前 / 下半后", () => {
  assert.equal(resolveDropZone("doc", "doc", 0.3), "before");
  assert.equal(resolveDropZone("doc", "doc", 0.7), "after");
});
check("目录拖到目录行：25/50/25", () => {
  assert.equal(resolveDropZone("folder", "folder", 0.1), "before");
  assert.equal(resolveDropZone("folder", "folder", 0.5), "into");
  assert.equal(resolveDropZone("folder", "folder", 0.9), "after");
});
check("目录拖到文档行无效", () => assert.equal(resolveDropZone("folder", "doc", 0.5), null));

const doc = { key: "d:a", type: "doc", id: "a", parentId: "F1" };
const folderRow = { key: "f:F2", type: "folder", id: "F2", parentId: null };
check("文档移入目录 → move-document", () => {
  const m = buildMovePayload(doc, { key: "f:F2", zone: "into" }, folderRow);
  assert.equal(m.event, "move-document");
  assert.equal(m.payload.folderId, "F2");
});
check("移入自己所在目录 = 无操作", () => {
  assert.equal(buildMovePayload(doc, { key: "f:F1", zone: "into" }, { key: "f:F1", type: "folder", id: "F1" }), null);
});
check("根级文档拖到移出区 = 无操作", () => {
  assert.equal(buildMovePayload({ ...doc, parentId: null }, { key: "__root__", zone: "into" }, null), null);
});
check("排序携带 beforeId", () => {
  const m = buildMovePayload(doc, { key: "d:b", zone: "before" }, { key: "d:b", type: "doc", id: "b", parentId: "F1" });
  assert.equal(m.payload.beforeId, "b");
  assert.equal(m.payload.folderId, "F1");
});

console.log(failed ? `\n${failed} 项失败 ❌` : "\n全部通过 ✅");
process.exit(failed ? 1 : 0);
