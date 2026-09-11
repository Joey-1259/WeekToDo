#!/usr/bin/env node
/* DEAD_CODE_AUDIT_20260911_V1
 *
 * 从入口出发做可达性分析，列出 src/ 下没人 import 的文件。
 *
 * 为什么要有这个脚本：上一轮我凭"看起来像旧版"就点名了
 * FocusDocumentPane.vue 等几个文件。那是猜测，不是证据。
 * 删文件是不可逆动作（虽然 git 能找回，但引用链断掉的代价是
 * 下一个人花半天排查），所以判据必须来自图遍历，而不是命名直觉。
 *
 * 用法：
 *   node scripts/audit-dead-code.cjs            # 只报告
 *   node scripts/audit-dead-code.cjs --rm       # 额外打印 git rm 命令
 *
 * 已知局限（都会在报告里标注）：
 *   · 只解析静态 import / import() / require 的字面量路径；
 *     动态拼接路径（`./views/${name}.vue`）无法追踪。
 *   · defineAsyncComponent 里的字面量路径能识别。
 *   · 若项目里有按约定自动注册的目录，需要手工加进 ROOTS。
 */

const fs = require("fs");
const path = require("path");

const REPO = process.cwd();
const SRC = path.join(REPO, "src");

/* 入口。除 main.js 外，Electron 主进程 / preload 也是入口，
   否则它们会被误判为孤岛。 */
const ROOTS = [
  "src/main.js",
  "src/App.vue",
  "electron/main/index.js",
  "electron/preload/index.js",
  "src/main/index.js",
  "src/preload/index.js",
].filter((rel) => fs.existsSync(path.join(REPO, rel)));

const EXTS = [".js", ".mjs", ".cjs", ".ts", ".vue", ".json", ".scss", ".css"];

function listFiles(dir) {
  const out = [];

  (function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules") continue;
        walk(full);
        continue;
      }
      if (EXTS.includes(path.extname(entry.name))) out.push(full);
    }
  })(dir);

  return out;
}

function resolveSpec(fromFile, spec) {
  if (!spec.startsWith(".") && !spec.startsWith("@/") && !spec.startsWith("~/")) {
    return null; // 裸模块名 = 依赖，不在审计范围
  }

  let base;
  if (spec.startsWith("@/") || spec.startsWith("~/")) {
    base = path.join(SRC, spec.slice(2));
  } else {
    base = path.resolve(path.dirname(fromFile), spec);
  }

  const candidates = [base];
  for (const ext of EXTS) candidates.push(base + ext);
  for (const ext of EXTS) candidates.push(path.join(base, "index" + ext));

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return { missing: base };
}

const IMPORT_PATTERNS = [
  /\bimport\s+[^;'"]*?from\s*["']([^"']+)["']/g,
  /\bimport\s*["']([^"']+)["']/g,
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  /@(?:import|use)\s+["']([^"']+)["']/g, // scss
];

function edgesOf(file) {
  const text = fs.readFileSync(file, "utf8");
  const specs = new Set();

  for (const pattern of IMPORT_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) specs.add(match[1]);
  }

  return [...specs];
}

const all = listFiles(SRC);
const reached = new Set();
const broken = [];
const queue = ROOTS.map((rel) => path.join(REPO, rel));

queue.forEach((file) => reached.add(file));

while (queue.length) {
  const file = queue.shift();

  for (const spec of edgesOf(file)) {
    const resolved = resolveSpec(file, spec);
    if (!resolved) continue;

    if (resolved.missing) {
      broken.push({ from: path.relative(REPO, file), spec });
      continue;
    }

    if (!reached.has(resolved)) {
      reached.add(resolved);
      queue.push(resolved);
    }
  }
}

const orphans = all
  .filter((file) => !reached.has(file))
  .map((file) => ({
    rel: path.relative(REPO, file),
    kb: (fs.statSync(file).size / 1024).toFixed(1),
  }))
  .sort((a, b) => Number(b.kb) - Number(a.kb));

const line = "-".repeat(64);

console.log(line);
console.log("入口：" + ROOTS.join("  "));
console.log("src/ 下文件：" + all.length + "   可达：" + reached.size);
console.log(line);

if (broken.length) {
  console.log("\n[!] 解析不到的 import（先修这些，否则可达性分析不可信）：");
  for (const item of broken) {
    console.log("    " + item.from + "  ->  " + item.spec);
  }
}

if (!orphans.length) {
  console.log("\n没有发现孤岛文件。");
} else {
  let total = 0;
  console.log("\n以下文件从入口不可达（候选删除，请逐个过目）：");
  for (const item of orphans) {
    total += Number(item.kb);
    console.log("    " + item.kb.padStart(7) + " KB  " + item.rel);
  }
  console.log("    " + "-".repeat(40));
  console.log("    " + total.toFixed(1) + " KB 合计");

  if (process.argv.includes("--rm")) {
    console.log("\n# 确认后执行（逐条，不要整段粘贴）：");
    for (const item of orphans) console.log("git rm " + JSON.stringify(item.rel));
  } else {
    console.log("\n加 --rm 可打印对应的 git rm 命令。");
  }

  console.log(
    "\n注意：动态 import 与约定式自动注册无法被静态追踪。" +
      "\n删除前建议 grep 一次文件名确认。"
  );
}

console.log("");
