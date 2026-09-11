#!/usr/bin/env node
/* DEAD_CODE_AUDIT_20260911_V1 */

/**
 * 只读审计。不修改任何文件。
 *
 * 干四件事：
 *   1. 组件引用图 —— 从 src/main.js 出发做可达性分析，列出永远不会被
 *      加载的 .vue / .js。注意是"可达性"而不是"有没有人 import"：
 *      一个只被另一个孤儿 import 的文件同样是孤儿。
 *   2. 注册但未使用 —— components 里注册了、模板里却没有对应标签。
 *      这类最隐蔽：它不报错，只是安静地把一个组件打进 bundle。
 *   3. 重复选择器 —— 同一个 .vue 的 style 块里被声明多次的选择器。
 *      这是"改了没生效"类问题的温床。
 *   4. 缺少焦点守卫的浮层 —— Teleport 到 body 却没引入 focusOwnership。
 *
 * 用法：
 *   node scripts/audit-dead-code.cjs
 *   node scripts/audit-dead-code.cjs --json
 */

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");
const JSON_OUT = process.argv.includes("--json");

if (!fs.existsSync(SRC)) {
  console.error("✗ 找不到 src/，请在仓库根目录执行");
  process.exit(1);
}

/* ---------- 收集所有源文件 ---------- */

const EXT = new Set([".vue", ".js", ".cjs", ".mjs", ".ts"]);
const SKIP_DIR = new Set([
  "node_modules",
  ".git",
  "dist",
  "out",
  "dist_electron",
]);

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIR.has(name) || name.startsWith(".")) continue;

    const full = path.join(dir, name);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) walk(full, out);
    else if (EXT.has(path.extname(name))) out.push(full);
  }

  return out;
}

const files = walk(SRC);
const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");
const source = new Map(
  files.map((f) => [f, fs.readFileSync(f, "utf8")])
);

/* ---------- 解析 import / 动态 import ---------- */

const IMPORT_RE =
  /(?:import\s+[^'"]*?from\s*|import\s*\(\s*|require\s*\(\s*)["']([^"']+)["']/g;

function resolveSpec(fromFile, spec) {
  if (!spec.startsWith(".") && !spec.startsWith("@/")) return null;

  const base = spec.startsWith("@/")
    ? path.join(SRC, spec.slice(2))
    : path.resolve(path.dirname(fromFile), spec);

  const candidates = [
    base,
    base + ".vue",
    base + ".js",
    base + ".ts",
    base + ".mjs",
    base + ".cjs",
    path.join(base, "index.vue"),
    path.join(base, "index.js"),
    path.join(base, "index.ts"),
  ];

  for (const candidate of candidates) {
    if (
      fs.existsSync(candidate) &&
      fs.statSync(candidate).isFile()
    ) {
      return candidate;
    }
  }

  return null;
}

const edges = new Map();

for (const [file, text] of source) {
  const targets = new Set();
  let match;

  IMPORT_RE.lastIndex = 0;

  while ((match = IMPORT_RE.exec(text))) {
    const resolved = resolveSpec(file, match[1]);
    if (resolved) targets.add(resolved);
  }

  edges.set(file, targets);
}

/* ---------- 1. 可达性 ---------- */

const roots = [
  path.join(SRC, "main.js"),
  path.join(SRC, "App.vue"),
].filter((p) => fs.existsSync(p));

const electronMain = path.join(ROOT, "src", "main", "index.js");
if (fs.existsSync(electronMain)) roots.push(electronMain);

const reachable = new Set();
const queue = [...roots];

while (queue.length) {
  const current = queue.pop();
  if (reachable.has(current)) continue;

  reachable.add(current);

  for (const next of edges.get(current) || []) {
    if (!reachable.has(next)) queue.push(next);
  }
}

const orphans = files
  .filter((f) => !reachable.has(f))
  .map(rel)
  .sort();

/* ---------- 2. 注册但模板未使用 ---------- */

function kebab(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

const unusedRegistrations = [];

for (const [file, text] of source) {
  if (path.extname(file) !== ".vue") continue;

  const block = text.match(
    /components\s*:\s*\{([\s\S]*?)\n\s{2}\}/
  );
  if (!block) continue;

  const template = (text.match(/<template>([\s\S]*)<\/template>/) ||
    [])[1];
  if (!template) continue;

  const names = block[1]
    .split(",")
    .map((piece) => piece.split(":")[0].trim())
    .filter((name) => /^[A-Za-z][\w$]*$/.test(name));

  for (const name of names) {
    const pascal = new RegExp("<" + name + "[\\s/>]");
    const dashed = new RegExp("<" + kebab(name) + "[\\s/>]");

    if (!pascal.test(template) && !dashed.test(template)) {
      unusedRegistrations.push(rel(file) + "  →  " + name);
    }
  }
}

/* ---------- 3. 重复选择器 ---------- */

const duplicateSelectors = [];

for (const [file, text] of source) {
  if (path.extname(file) !== ".vue") continue;

  const styles = [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
    .map((m) => m[1])
    .join("\n");

  if (!styles.trim()) continue;

  const counts = new Map();
  const stripped = styles
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/@media[^{]*\{/g, "");

  for (const m of stripped.matchAll(/(^|\})\s*([^{}@]+?)\s*\{/g)) {
    const selector = m[2].replace(/\s+/g, " ").trim();

    if (!selector || selector.includes(";")) continue;
    if (selector.startsWith("from") || selector.startsWith("to")) continue;
    if (/^\d/.test(selector)) continue;

    counts.set(selector, (counts.get(selector) || 0) + 1);
  }

  for (const [selector, count] of counts) {
    if (count >= 3) {
      duplicateSelectors.push(
        rel(file) + "  →  " + selector + "  ×" + count
      );
    }
  }
}

/* ---------- 4. 缺少焦点守卫的浮层 ---------- */

const unguarded = [];

for (const [file, text] of source) {
  if (path.extname(file) !== ".vue") continue;
  if (!/Teleport\s+to=["']body["']/.test(text)) continue;
  if (/focusOwnership/.test(text)) continue;
  if (!reachable.has(file)) continue;

  unguarded.push(rel(file));
}

/* ---------- 输出 ---------- */

const report = {
  orphans,
  unusedRegistrations,
  duplicateSelectors,
  unguarded,
};

if (JSON_OUT) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

const line = "─".repeat(64);

function section(title, rows, hint) {
  console.log("\n" + line);
  console.log(title + "（" + rows.length + "）");
  console.log(line);

  if (!rows.length) {
    console.log("  无");
    return;
  }

  rows.forEach((row) => console.log("  · " + row));
  if (hint) console.log("\n  " + hint);
}

console.log("\nWeekToDo 死代码 / 冗余审计");
console.log("入口：" + roots.map(rel).join("、"));
console.log("扫描：" + files.length + " 个源文件");

section(
  "① 从入口不可达的文件",
  orphans,
  "确认无误后可执行：\n  git rm " +
    (orphans.length ? orphans.join(" \\\n         ") : "")
);

section(
  "② 注册了但模板中未使用的组件",
  unusedRegistrations,
  "删掉 import 与 components 里的这一项即可；它们正被白白打进 bundle。"
);

section(
  "③ 同文件内被声明 3 次以上的选择器",
  duplicateSelectors,
  "多轮覆盖是「改了没生效」的温床，建议合并为单一声明。"
);

section(
  "④ Teleport 到 body 但未引入 focusOwnership 的浮层",
  unguarded,
  "只要可能在 Bootstrap modal 打开期间唤起，里面的输入框就会拿不到焦点。"
);

console.log("\n" + line);
console.log("审计完成。本脚本只读，未修改任何文件。");
console.log(line + "\n");
