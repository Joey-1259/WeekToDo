/* FOCUS_V4_20261109 · 自检：静态检查 + 纯函数单测 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");
const load = (file) => import(pathToFileURL(path.join(root, file)).href);

let failed = 0;
const check = async (name, fn) => {
  try {
    await fn();
    console.log("  ✓", name);
  } catch (error) {
    failed += 1;
    console.error("  ✗", name, "\n     ", error.message);
  }
};

const DLG = "src/views/focusDocuments/FocusDocumentDialog.vue";

console.log("1) 静态检查");
await check("全屏右上角已无宽度切换", () => assert.ok(!read(DLG).includes('@click="toggleWide"')));
await check("提示只保留 Esc 退出", () => assert.ok(read(DLG).includes("<kbd>Esc</kbd> 退出")));
await check("固定宽屏", () => assert.ok(read(DLG).includes("'is-wide': true")));
await check("主进程附件 IPC", () => assert.ok(read("electron/main/index.js").includes('"attachment:pick"')));
await check("preload 暴露 getPathForFile", () => assert.ok(read("electron/preload/index.js").includes("webUtils.getPathForFile")));
await check("编辑器注册附件节点", () => assert.ok(read("src/views/focusDocuments/FocusDocumentEditor.vue").includes("FocusAttachment,")));
await check("/ 菜单含附件", () => assert.ok(read("src/editor/slashCommandItems.js").includes("pickAndInsertAttachments")));
await check("备份写入校验码", () => assert.ok(read("src/services/dataBackupService.js").includes("digestOf(localData, indexedData)")));
await check("导入前展示备份摘要", () => assert.ok(read("src/views/configModal.vue").includes("summarizeBackup(file)")));

console.log("2) 附件纯函数");
const B = await load("src/editor/attachmentBridge.js");
await check("shortPath", () => assert.equal(B.shortPath("/Users/joey/Desktop/a.pdf", "/Users/joey"), "~/Desktop/a.pdf"));
await check("baseName / dirName", () => {
  assert.equal(B.baseName("/a/b/报价.xlsx"), "报价.xlsx");
  assert.equal(B.dirName("/a/b/报价.xlsx"), "/a/b");
});
await check("extOf 取最后一段", () => assert.equal(B.extOf("x.tar.gz"), "gz"));
await check("kindOf", () => {
  assert.equal(B.kindOf("pdf").tone, "pdf");
  assert.equal(B.kindOf("docx").label, "DOCX");
  assert.equal(B.kindOf("", true).tone, "folder");
});
await check("formatBytes", () => assert.equal(B.formatBytes(1536), "1.5 KB"));
await check("非桌面环境不支持附件", () => assert.equal(B.attachmentsSupported(), false));

console.log("3) 备份校验");
const I = await load("src/services/backupIntegrity.js");
const local = { config: "{}", "10": "a", b: "c", "2": "d" };
const indexed = { focus_documents: [["doc-1", { title: "香港交易所", n: 1.5 }]] };
const digest = await I.digestOf(local, indexed);
const file = JSON.parse(JSON.stringify({ integrity: { digest }, localStorage: local, indexedDB: indexed }, null, 2));
await check("JSON 往返后校验通过", async () => assert.equal(await I.verifyIntegrity(file), "ok"));
await check("篡改可被识别", async () => {
  file.indexedDB.focus_documents[0][1].title = "x";
  assert.equal(await I.verifyIntegrity(file), "mismatch");
});
await check("旧备份标记为无校验", async () => assert.equal(await I.verifyIntegrity({ localStorage: {} }), "absent"));

console.log(failed ? `\n${failed} 项失败 ❌` : "\n全部通过 ✅");
process.exit(failed ? 1 : 0);
