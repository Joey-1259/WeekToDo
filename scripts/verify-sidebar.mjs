/* FOCUS_SIDEBAR_20261109_V1 · 侧栏自检：静态检查 + 纯函数单测 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");
const V = "src/views/focusDocuments/";

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
[
  [V + "FocusDialogSidebar.vue", "FOCUS_SIDEBAR_20261109_V1", "侧栏组件已覆盖为 V1"],
  [V + "FocusDocumentDialog.vue", "onSidebarCommand", "弹窗接入侧栏指令"],
  [V + "FocusDocumentDialog.vue", "peekOpen", "侧栏浮出态"],
  [V + "FocusDocumentDialog.vue", "weektodo:focus-folders-changed", "目录变更实时刷新"],
  [V + "FocusDocumentsView.vue", "onDialogSidebar", "宿主执行侧栏操作"],
].forEach(([file, needle, name]) =>
  check(name, () => assert.ok(read(file).includes(needle), `${file} 缺少 ${needle}`))
);

console.log("2) 纯函数单测");
const T = await import(pathToFileURL(path.join(root, V + "focusSidebarTree.js")).href);
const folders = [
  { id: "A", name: "项目跟进", parentId: null, order: 0 },
  { id: "B", name: "华南二", parentId: "A", order: 0 },
  { id: "C", name: "测试", parentId: null, order: 1 },
];
const docs = [
  { id: "d1", title: "香港交易所", folderId: "B", manualOrder: 1 },
  { id: "d2", title: "中广核", folderId: "B", manualOrder: 0 },
  { id: "d3", title: "未归档笔记", folderId: null, manualOrder: 0 },
];

check("树顺序：目录在前、文档按 manualOrder", () => {
  const keys = T.buildRows({ folders, documents: docs }).map((r) => r.key);
  assert.deepEqual(keys, ["f:A", "f:B", "d:d2", "d:d1", "f:C", "d:d3"]);
});
check("折叠隐藏子项", () => {
  const keys = T.buildRows({ folders, documents: docs, collapsed: new Set(["A"]) }).map((r) => r.key);
  assert.deepEqual(keys, ["f:A", "f:C", "d:d3"]);
});
check("搜索：只留命中与祖先，且强制展开", () => {
  const keys = T.buildRows({ folders, documents: docs, collapsed: new Set(["A", "B"]), query: "香港" }).map((r) => r.key);
  assert.deepEqual(keys, ["f:A", "f:B", "d:d1"]);
});
check("目录不能移入自身后代", () => {
  assert.deepEqual([...T.descendantFolderIds(folders, "A")].sort(), ["A", "B"]);
});
check("祖先链", () => assert.deepEqual(T.ancestorFolderIds(folders, "B"), ["B", "A"]));
check("高亮区间", () => assert.deepEqual(T.matchRange("香港交易所", "交易"), [2, 4]));
check("目录选项深度", () => {
  assert.deepEqual(T.folderOptions(folders).map((o) => o.depth), [0, 1, 0]);
});

console.log(failed ? `\n${failed} 项失败 ❌` : "\n全部通过 ✅");
process.exit(failed ? 1 : 0);
