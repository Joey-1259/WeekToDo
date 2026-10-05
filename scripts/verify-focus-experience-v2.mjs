import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  parse,
  compileScript,
  compileTemplate,
} from "@vue/compiler-sfc";

import {
  normalizeCalloutTone,
  normalizeCalloutColor,
  getCalloutPresentation,
  readCalloutPreference,
  rememberCalloutPreference,
} from "../src/services/focusCalloutPresentation.mjs";

import {
  createLatestImportQueue,
} from "../src/services/latestImportQueue.mjs";

assert.equal(normalizeCalloutTone("tips"), "tip");
assert.equal(normalizeCalloutTone("unknown"), "info");
assert.equal(normalizeCalloutColor("#AA1122"), "#aa1122");
assert.equal(normalizeCalloutColor("red;position:fixed"), "default");

for (const tone of ["info", "tip", "success", "warning", "danger"]) {
  for (const color of ["default", "blue", "gray", "#000000", "#ffffff"]) {
    const palette = getCalloutPresentation(tone, color);

    for (const key of [
      "background", "border", "accent",
      "darkBackground", "darkBorder", "darkAccent",
    ]) {
      assert.match(palette[key], /^#[0-9a-f]{6}$/i);
    }

    assert.match(palette.wordFill, /^[0-9A-F]{6}$/);
  }
}

const memory = new Map();
const storage = {
  getItem: (key) => memory.get(key) || null,
  setItem: (key, value) => memory.set(key, value),
};

rememberCalloutPreference({ tone: "warning", color: "purple" }, storage);
assert.deepEqual(readCalloutPreference(storage), {
  tone: "warning",
  color: "purple",
});

const events = [];
let releaseOld;
const oldWait = new Promise((resolve) => { releaseOld = resolve; });

const queue = createLatestImportQueue({
  onError: (error) => { throw error; },
});

queue.request(async ({ signal, isCurrent }) => {
  events.push("old-start");
  await oldWait;
  assert.equal(signal.aborted, true);
  if (isCurrent()) events.push("old-result");
}, 0);

await new Promise((resolve) => setTimeout(resolve, 10));

queue.request(async ({ isCurrent }) => {
  if (isCurrent()) events.push("new-result");
}, 0);

releaseOld();
await queue.idle();

assert.deepEqual(events, ["old-start", "new-result"]);
queue.dispose();

const root = process.cwd();
const vueFiles = [
  "src/views/focusDocuments/FocusCalloutNodeView.vue",
  "src/views/focusDocuments/FocusImportContentPreview.vue",
  "src/views/focusDocuments/FocusDocumentImportDialog.vue",
  "src/views/focusDocuments/FocusDirectoryBrowser.vue",
  "src/views/focusDocuments/FocusColumnInserter.vue",
  "src/views/focusDocuments/FocusMindMapNodeView.vue",
];

for (const relative of vueFiles) {
  const source = fs.readFileSync(path.join(root, relative), "utf8");
  const result = parse(source, { filename: relative });
  assert.equal(result.errors.length, 0, `${relative}: SFC 解析失败`);

  const id = relative.replace(/\W/g, "_");
  const script = compileScript(result.descriptor, { id });
  const template = compileTemplate({
    source: result.descriptor.template.content,
    filename: relative,
    id,
    compilerOptions: { bindingMetadata: script.bindings },
  });

  assert.equal(
    template.errors.length,
    0,
    `${relative}: 模板编译失败：${template.errors}`
  );

  console.log("✓", relative);
}

const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

assert.match(
  read("src/views/focusDocuments/FocusColumnInserter.vue"),
  /mode="document"/
);
assert.doesNotMatch(
  read("src/views/focusDocuments/FocusColumnInserter.vue"),
  /panelStyle/
);
assert.match(
  read("src/views/focusDocuments/FocusDocumentImportDialog.vue"),
  /focusImportAutomation/
);
assert.doesNotMatch(
  read("src/views/focusDocuments/FocusDocumentImportDialog.vue"),
  /解析并检查/
);
assert.match(
  read("src/views/focusDocuments/FocusMindMapNodeView.vue"),
  /focusMindMapViewportMixin/
);

console.log("✓ 高亮块类型、颜色、偏好记忆");
console.log("✓ 自动解析队列：旧任务不能覆盖新结果");
console.log("✓ 目录统一、自动导入、全屏取景接线");
console.log("尚需执行完整构建和 Electron 界面验收。");
