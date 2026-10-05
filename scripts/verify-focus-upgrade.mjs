import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import { planMindMapViewport } from "../src/services/focusMindMapViewport.mjs";

const root = process.cwd();

const files = [
  "src/views/focusDocuments/FocusCalloutNodeView.vue",
  "src/views/focusDocuments/FocusDocumentImportDialog.vue",
  "src/views/focusDocuments/FocusDocumentEditor.vue",
  "src/views/focusDocuments/FocusDocumentsView.vue",
  "src/views/focusDocuments/FocusDirectoryBrowser.vue",
  "src/views/focusDocuments/FocusMindMapNodeView.vue",
];

for (const relative of files) {
  const source = fs.readFileSync(path.join(root, relative), "utf8");
  const id = relative.replace(/\W/g, "_");
  const parsed = parse(source, { filename: relative });

  assert.equal(
    parsed.errors.length,
    0,
    `${relative}: SFC 解析失败：${parsed.errors}`
  );

  const script = compileScript(parsed.descriptor, { id });

  const template = compileTemplate({
    source: parsed.descriptor.template.content,
    filename: relative,
    id,
    compilerOptions: { bindingMetadata: script.bindings },
  });

  assert.equal(
    template.errors.length,
    0,
    `${relative}: 模板编译失败：${template.errors}`
  );

  console.log(`✓ Vue 编译检查：${relative}`);
}

function checkPlan(direction, bounds, single = false) {
  const width = 760;
  const height = 360;
  const padding = 24;

  const plan = planMindMapViewport({
    width,
    height,
    padding,
    bounds,
    direction,
    single,
  });

  assert.ok(plan);
  assert.ok(plan.scale > 0 && plan.scale <= 1);

  const epsilon = 0.001;

  assert.ok(plan.rootX + bounds.left * plan.scale >= padding - epsilon);
  assert.ok(plan.rootX + bounds.right * plan.scale <= width - padding + epsilon);
  assert.ok(plan.rootY + bounds.top * plan.scale >= padding - epsilon);
  assert.ok(plan.rootY + bounds.bottom * plan.scale <= height - padding + epsilon);

  if (direction === 2 || single) {
    assert.equal(plan.rootX, width / 2);
    assert.equal(plan.rootY, height / 2);
  }

  return plan;
}

checkPlan(1, { left: -60, right: 1400, top: -110, bottom: 190 });
checkPlan(0, { left: -1400, right: 60, top: -190, bottom: 110 });
checkPlan(2, { left: -220, right: 1400, top: -80, bottom: 260 });
checkPlan(3, { left: -400, right: 700, top: -30, bottom: 1000 });
checkPlan(1, { left: -80, right: 80, top: -20, bottom: 20 }, true);

assert.equal(
  planMindMapViewport({
    width: 0,
    height: 0,
    bounds: { left: -1, right: 1, top: -1, bottom: 1 },
  }),
  null
);

const slash = fs.readFileSync(
  path.join(root, "src/editor/slashCommandItems.js"),
  "utf8"
);
assert.match(slash, /insertFocusCallout/);

const editor = fs.readFileSync(
  path.join(root, "src/views/focusDocuments/FocusDocumentEditor.vue"),
  "utf8"
);
assert.match(editor, /FocusCallout,/);

const view = fs.readFileSync(
  path.join(root, "src/views/focusDocuments/FocusDocumentsView.vue"),
  "utf8"
);
assert.match(view, /FocusDocumentImportDialog/);

console.log("✓ 脑图四方向、单节点、不对称分支取景检查");
console.log("✓ 编辑器、Slash、导入入口接线检查");
console.log("下一步运行 yarn build && yarn electron:compile。");
