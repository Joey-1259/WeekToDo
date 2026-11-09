#!/usr/bin/env python3
"""FOCUS_V4_20261109
1 全屏右上角：去掉宽度切换，提示只留 Esc 退出，固定宽屏
2 附件：主进程 IPC + preload + 编辑器节点 + / 菜单
3 完整备份：单事务快照、SHA-256 校验、扩充清单、导出回执、导入前摘要
"""
import pathlib, re, subprocess, sys

ROOT = pathlib.Path("/Users/joey/Desktop/Joey-Workspace/MyProject/weektodo-main")
BACKUP = ROOT / ".patch-backup" / "20261109_v4"

DLG = "src/views/focusDocuments/FocusDocumentDialog.vue"
MAIN = "electron/main/index.js"
PRELOAD = "electron/preload/index.js"
EDITOR = "src/views/focusDocuments/FocusDocumentEditor.vue"
SLASH = "src/editor/slashCommandItems.js"
DBS = "src/services/dataBackupService.js"
CFG = "src/views/configModal.vue"

NEW_FILES = [
    ("src/editor/attachmentBridge.js", "FOCUS_ATTACHMENT_20261109_V1"),
    ("src/editor/extensions/FocusAttachment.js", "FOCUS_ATTACHMENT_20261109_V1"),
    ("src/editor/extensions/focusAttachment.css", "FOCUS_ATTACHMENT_20261109_V1"),
    ("src/services/backupIntegrity.js", "FOCUS_BACKUP_20261109_V1"),
    ("src/helpers/backupReceipt.js", "FOCUS_BACKUP_20261109_V1"),
    ("src/helpers/backupReceipt.css", "FOCUS_BACKUP_20261109_V1"),
    ("scripts/verify-v4.mjs", "FOCUS_V4_20261109"),
]

def load(rel):
    return (ROOT / rel).read_text("utf-8")

def save(rel, text):
    dst = BACKUP / rel
    if not dst.exists():
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_text(load(rel), "utf-8")
    (ROOT / rel).write_text(text, "utf-8")

def patch(rel, old, new, marker=None):
    s = load(rel)
    if (marker or new) in s:
        print(f"  · 已应用  {rel}")
        return
    if old not in s:
        sys.exit(f"[FAIL] {rel} 未找到锚点：\n{old[:200]}")
    save(rel, s.replace(old, new, 1))
    print(f"  ✓ {rel}")

print("0) 前置检查")
for rel, needle in NEW_FILES:
    f = ROOT / rel
    if not f.exists() or needle not in f.read_text("utf-8"):
        sys.exit(f"[FAIL] 请先保存新文件：{rel}")
print("  ✓ 7 个新文件就位")

# ───────── 1. 全屏右上角
print("1) 全屏右上角")
s = load(DLG)
if "FOCUS_V4_20261109" in s:
    print("  · 已应用")
else:
    m = re.search(r'(<span class="fdx-tabs-spacer"></span>)(.*?)(\n[ \t]*</nav>)', s, re.S)
    if not m or "toggleWide" not in m.group(2):
        sys.exit("[FAIL] 没找到「标签栏占位 → 宽度按钮」区域，请把 FocusDocumentDialog.vue 顶部 <nav> 一段发给我")
    print("  移除以下内容：")
    for line in m.group(2).strip().splitlines():
        print("    - " + line.strip()[:110])
    s = (s[:m.start(2)]
         + '\n        <!-- FOCUS_V4_20261109：固定宽屏，去掉宽度切换；提示只保留 Esc -->'
         + '\n        <span class="fdx-hint"><kbd>Esc</kbd> 退出</span>'
         + s[m.end(2):])
    s, n = re.subn(r"'is-wide':\s*wide\b", "'is-wide': true", s)
    if not n:
        sys.exit("[FAIL] 未找到 'is-wide': wide")
    if "  mounted() {\n" not in s:
        sys.exit("[FAIL] 未找到 mounted()")
    s = s.replace("  mounted() {\n",
                  "  mounted() {\n    /* FOCUS_V4_20261109 · 固定宽屏 */\n    this.wide = true;\n", 1)
    save(DLG, s)
    print("  ✓ " + DLG)

# ───────── 2. 主进程
print("2) 主进程附件 IPC")
patch(MAIN, 'import { writeFile } from "node:fs/promises";',
      'import { writeFile, stat } from "node:fs/promises";')
patch(MAIN, "function registerIpcHandlers() {", r'''/* FOCUS_ATTACHMENT_20261109_V1
 * 附件只记录本地路径，渲染进程不接触 fs：选择 / 状态 / 在 Finder 中显示 / 打开 全部走受信 IPC。
 * 打开时拦截可执行类文件（只在 Finder 中显示），避免文档里的一个链接直接运行程序。
 */
const ATTACHMENT_BLOCKED_OPEN = new Set([
  ".app", ".command", ".sh", ".bash", ".zsh", ".csh", ".tool", ".terminal",
  ".workflow", ".action", ".scpt", ".applescript", ".osax", ".pkg", ".mpkg",
  ".kext", ".prefpane", ".jar", ".exe", ".msi", ".bat", ".cmd", ".com",
  ".scr", ".ps1", ".vbs",
]);
const MAX_ATTACHMENT_PICK = 50;
const MAX_ATTACHMENT_STAT = 500;

function assertTrustedSender(event) {
  if (!isTrustedSender(event)) {
    throw new Error("Untrusted renderer");
  }
}

function normalizeAttachmentPath(value) {
  const text = String(value || "");
  if (!text || text.length > 4096 || text.includes("\u0000") || !path.isAbsolute(text)) {
    throw new Error("无效的附件路径");
  }
  return path.normalize(text);
}

async function describeAttachmentPath(filePath) {
  try {
    const info = await stat(filePath);
    const isDirectory = info.isDirectory();
    return {
      exists: true,
      isDirectory,
      size: isDirectory ? null : info.size,
      mtime: info.mtime.toISOString(),
    };
  } catch (_) {
    return { exists: false };
  }
}

async function pickAttachments(event, options) {
  assertTrustedSender(event);
  const multiple = !(options && options.multiple === false);
  let defaultPath = app.getPath("documents");
  try {
    if (options && options.defaultPath) {
      defaultPath = normalizeAttachmentPath(options.defaultPath);
    }
  } catch (_) {
    // 非法默认路径回落到「文稿」
  }
  const owner = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  const properties = process.platform === "darwin" ? ["openFile", "openDirectory"] : ["openFile"];
  if (multiple) properties.push("multiSelections");

  const result = await dialog.showOpenDialog(owner, {
    title: "添加附件",
    buttonLabel: "添加",
    message: "附件只记录文件位置，不会复制到 WeekToDo",
    defaultPath,
    properties,
  });
  if (result.canceled || !result.filePaths || !result.filePaths.length) return [];

  const list = [];
  for (const filePath of result.filePaths.slice(0, MAX_ATTACHMENT_PICK)) {
    const info = await describeAttachmentPath(filePath);
    list.push({
      path: filePath,
      name: path.basename(filePath),
      size: info.size ?? null,
      isDirectory: Boolean(info.isDirectory),
    });
  }
  return list;
}

async function revealAttachment(event, value) {
  assertTrustedSender(event);
  const filePath = normalizeAttachmentPath(value);
  const info = await describeAttachmentPath(filePath);
  if (!info.exists) return { ok: false, missing: true };
  shell.showItemInFolder(filePath);
  return { ok: true };
}

async function openAttachment(event, value) {
  assertTrustedSender(event);
  const filePath = normalizeAttachmentPath(value);
  const info = await describeAttachmentPath(filePath);
  if (!info.exists) return { ok: false, missing: true };
  if (ATTACHMENT_BLOCKED_OPEN.has(path.extname(filePath).toLowerCase())) {
    shell.showItemInFolder(filePath);
    return { ok: false, blocked: true };
  }
  const error = await shell.openPath(filePath);
  return error ? { ok: false, error } : { ok: true };
}

async function statAttachments(event, values) {
  assertTrustedSender(event);
  const list = Array.isArray(values) ? values.slice(0, MAX_ATTACHMENT_STAT) : [];
  const out = {};
  await Promise.all(list.map(async (value) => {
    const key = String(value || "");
    try {
      out[key] = await describeAttachmentPath(normalizeAttachmentPath(key));
    } catch (_) {
      out[key] = { exists: false, invalid: true };
    }
  }));
  return out;
}

function registerIpcHandlers() {''')
patch(MAIN, '''  ipcMain.handle(
    "save-document-export",
    saveDocumentExport
  );
''', '''  ipcMain.handle(
    "save-document-export",
    saveDocumentExport
  );

  /* FOCUS_ATTACHMENT_20261109_V1 */
  ipcMain.handle("attachment:pick", pickAttachments);
  ipcMain.handle("attachment:reveal", revealAttachment);
  ipcMain.handle("attachment:open", openAttachment);
  ipcMain.handle("attachment:stat", statAttachments);
  ipcMain.handle("attachment:home", (event) => {
    assertTrustedSender(event);
    return app.getPath("home");
  });
''')

# ───────── 3. preload
print("3) preload")
patch(PRELOAD, '''import {
  contextBridge,
  ipcRenderer,
} from "electron";''', '''import {
  contextBridge,
  ipcRenderer,
  webUtils,
} from "electron";''')
patch(PRELOAD, '''  saveDocumentExport(payload) {
    return ipcRenderer.invoke(
      "save-document-export",
      payload
    );
  },
});''', '''  saveDocumentExport(payload) {
    return ipcRenderer.invoke(
      "save-document-export",
      payload
    );
  },

  /* FOCUS_ATTACHMENT_20261109_V1：附件只传路径字符串，不传文件内容 */
  pickAttachments(options) {
    return ipcRenderer.invoke("attachment:pick", {
      multiple: !(options && options.multiple === false),
      defaultPath: String((options && options.defaultPath) || ""),
    });
  },

  revealAttachment(filePath) {
    return ipcRenderer.invoke("attachment:reveal", String(filePath || ""));
  },

  openAttachment(filePath) {
    return ipcRenderer.invoke("attachment:open", String(filePath || ""));
  },

  statAttachments(paths) {
    return ipcRenderer.invoke(
      "attachment:stat",
      Array.isArray(paths) ? paths.map((item) => String(item || "")) : []
    );
  },

  getHomeDir() {
    return ipcRenderer.invoke("attachment:home");
  },

  /* Electron 32+ 移除了 File.path，拖入的文件用 webUtils 取路径 */
  getPathForFile(file) {
    try {
      return webUtils.getPathForFile(file) || "";
    } catch (_) {
      return "";
    }
  },
});''')

# ───────── 4. 编辑器
print("4) 编辑器")
patch(EDITOR, 'import FocusMindMap from "../../editor/extensions/FocusMindMap";',
      'import FocusMindMap from "../../editor/extensions/FocusMindMap";\n'
      '/* FOCUS_ATTACHMENT_20261109_V1 */\n'
      'import FocusAttachment from "../../editor/extensions/FocusAttachment";')
patch(EDITOR, "        FocusImage,\n        FocusMindMap,\n",
      "        FocusImage,\n        FocusMindMap,\n        FocusAttachment,\n")

print("5) / 菜单")
patch(SLASH, "/* FOCUS_EXPERIENCE_20261005_V2 */\nfunction base(editor, range) {",
      '/* FOCUS_ATTACHMENT_20261109_V1 */\n'
      'import { pickAndInsertAttachments } from "./extensions/FocusAttachment";\n\n'
      "/* FOCUS_EXPERIENCE_20261005_V2 */\nfunction base(editor, range) {")
patch(SLASH, "    /* FOCUS_MIND_MAP_SLASH_20260920_V1 */", '''    /* FOCUS_ATTACHMENT_20261109_V1 */
    {
      id: "attachment",
      category: "进阶内容",
      title: "附件",
      description: "关联本地文件或文件夹 · 只记录位置，单击在 Finder 中显示",
      icon: "⎘",
      shortcut: "/fj",
      aliases: [
        "attachment", "file", "finder", "附件", "添加附件",
        "文件", "本地文件", "文件夹", "fj", "tjfj",
      ],
      command: ({ editor, range }) => {
        base(editor, range).run();
        pickAndInsertAttachments(editor);
      },
    },

    /* FOCUS_MIND_MAP_SLASH_20260920_V1 */''')

# ───────── 6. 备份服务
print("6) 完整备份服务")
patch(DBS, 'import packageInfo from "../../package.json";',
      'import packageInfo from "../../package.json";\n'
      '/* FOCUS_BACKUP_20261109_V1 */\n'
      'import { digestOf, verifyIntegrity } from "./backupIntegrity";')
patch(DBS, '''async function readIndexedDB() {
  const db = await openDatabase();
  const result = {};

  try {
    for (const storeName of STORE_NAMES) {
      result[storeName] = await readStore(
        db,
        storeName
      );
    }
  } finally {
    db.close();
  }

  return result;
}''', '''/* FOCUS_BACKUP_20261109_V1：所有 Store 在同一个只读事务里读取，
 * 保证文档 / 图片 / 历史版本来自同一时刻（原来 8 次独立事务，中途自动保存会造成不一致）。 */
async function readIndexedDB() {
  const db = await openDatabase();
  const result = {};

  try {
    const names = STORE_NAMES.filter((name) => db.objectStoreNames.contains(name));
    const raw = {};

    if (names.length) {
      const transaction = db.transaction(names, "readonly");
      const done = transactionDone(transaction);

      await Promise.all(names.map((name) => {
        const store = transaction.objectStore(name);
        return Promise.all([
          requestResult(store.getAllKeys()),
          requestResult(store.getAll()),
        ]).then(([keys, records]) => {
          raw[name] = { keys, records };
        });
      }));

      await done;
    }

    for (const storeName of STORE_NAMES) {
      const entry = raw[storeName];
      const list = [];
      if (entry) {
        for (let index = 0; index < entry.keys.length; index += 1) {
          list.push([entry.keys[index], await encodeValue(entry.records[index])]);
        }
      }
      result[storeName] = list;
    }
  } finally {
    db.close();
  }

  return result;
}''')
patch(DBS, '''    focusDocuments: storeLength("focus_documents"),
    focusAssets: storeLength("focus_assets"),
  };''', '''    focusDocuments: storeLength("focus_documents"),
    focusAssets: storeLength("focus_assets"),
    /* FOCUS_BACKUP_20261109_V1 */
    focusRevisions: storeLength("focus_document_revisions"),
    focusFolders: parsedLength("weektodo.focus-folders.v1"),
    archivedTasks: parsedLength("archivedTasks"),
    repeatingEvents: storeLength("repeating_events"),
    localStorageKeys: Object.keys(localData || {}).length,
  };''')
patch(DBS, '''async function capture() {
  const localData = readLocalStorage();
  const indexedData = await readIndexedDB();

  return {
    format: FORMAT,''', '''async function capture() {
  const localData = readLocalStorage();
  const indexedData = await readIndexedDB();
  const digest = await digestOf(localData, indexedData);

  return {
    integrity: digest ? { algorithm: "SHA-256", digest } : null,
    format: FORMAT,''')
patch(DBS, '''  setTimeout(() => URL.revokeObjectURL(url), 1500);
}''', '''  setTimeout(() => URL.revokeObjectURL(url), 1500);

  return { name: anchor.download, size: blob.size };
}''')
patch(DBS, '''  async exportBackup() {
    const backup = await capture();
    downloadJson(backup);
    return backup.manifest;
  },''', '''  async exportBackup() {
    const backup = await capture();
    const file = downloadJson(backup);

    try {
      localStorage.setItem("weektodo.lastBackupAt", backup.exportedAt);
    } catch {
      /* 存储不可用时不影响导出 */
    }

    return {
      ...backup.manifest,
      exportedAt: backup.exportedAt,
      integrity: backup.integrity,
      file,
    };
  },''')
patch(DBS, '''    const target = normalizeBackup(parsed);

    // 导入前保存当前完整状态。''', '''    /* FOCUS_BACKUP_20261109_V1：校验不通过直接拒绝，不触碰现有数据 */
    if ((await verifyIntegrity(parsed)) === "mismatch") {
      throw new Error(
        "备份文件校验失败：文件可能已损坏、被截断或被修改，已停止导入。"
      );
    }

    const target = normalizeBackup(parsed);

    // 导入前保存当前完整状态。''')
patch(DBS, '''  cloneJson,
};

export default dataBackupService;''', '''  /* FOCUS_BACKUP_20261109_V1：导入前读取摘要（时间 / 版本 / 校验 / 各模块条数） */
  async summarizeBackup(file) {
    const text = await readFile(file);
    let parsed;

    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("文件不是有效的 WeekToDo JSON 备份");
    }

    const integrity = await verifyIntegrity(parsed);
    const target = normalizeBackup(parsed);

    return {
      exportedAt: target.exportedAt || null,
      appVersion: target.appVersion || "unknown",
      counts: moduleCounts(target.localStorage || {}, target.indexedDB || {}),
      integrity,
      size: file?.size || 0,
    };
  },

  cloneJson,
};

export default dataBackupService;''')

# ───────── 7. 设置页
print("7) 设置 · 数据")
patch(CFG, 'import exportTool from "../helpers/exportTool";',
      'import exportTool from "../helpers/exportTool";\n'
      '/* FOCUS_BACKUP_20261109_V1 */\n'
      'import dataBackupService from "../services/dataBackupService";\n'
      'import { showBackupReceipt, describeBackup } from "../helpers/backupReceipt";')
patch(CFG, '''      activeTab: "config-general-tab",
      FEATURE_FLAGS,
    };''', '''      activeTab: "config-general-tab",
      FEATURE_FLAGS,
      lastBackupAt: localStorage.getItem("weektodo.lastBackupAt") || "",
    };''')
patch(CFG, '''  computed: {
    configLinks: function () {''', '''  computed: {
    /* FOCUS_BACKUP_20261109_V1 */
    lastBackupLabel() {
      if (!this.lastBackupAt) return "本设备还没有导出过完整备份";
      const time = new Date(this.lastBackupAt);
      if (Number.isNaN(time.getTime())) return "";
      const days = Math.floor((Date.now() - time.getTime()) / 86400000);
      const when = days <= 0 ? "今天" : days === 1 ? "昨天" : `${days} 天前`;
      return `上次导出：${when}（${time.toLocaleString("zh-CN", { hour12: false })}）`;
    },
    configLinks: function () {''')
patch(CFG, '''      try {
        await exportTool.export();
      } catch {''', '''      try {
        const receipt = await exportTool.export();
        this.lastBackupAt = receipt?.exportedAt || this.lastBackupAt;
        showBackupReceipt(receipt);
      } catch {''')
patch(CFG, r'''      const confirmed = window.confirm(
        "导入完整备份将替换当前设备上的所有 WeekToDo 数据。\n\n" +
        "系统会在导入失败时尝试自动回滚，但仍建议先导出一次当前数据。\n\n" +
        "确定继续吗？"
      );''', r'''      /* FOCUS_BACKUP_20261109_V1：导入前先读取并展示备份内容，校验不通过直接拒绝 */
      let summary = null;
      try {
        summary = await dataBackupService.summarizeBackup(file);
      } catch (error) {
        window.alert(error?.message || "无法读取该备份文件。");
        input.value = "";
        return;
      }

      if (summary.integrity === "mismatch") {
        window.alert(
          "备份文件校验失败：文件可能已损坏、被截断或被修改。\n\n为保护当前数据，已停止导入。"
        );
        input.value = "";
        return;
      }

      const confirmed = window.confirm(
        describeBackup(summary) +
        "\n\n导入将替换当前设备上的所有 WeekToDo 数据。" +
        "\n导入失败会自动回滚；仍建议先导出一次当前数据。" +
        "\n\n确定继续吗？"
      );''')
s = load(CFG)
if "data-last-backup" in s:
    print("  · 已应用  说明文案")
else:
    s, n = re.subn(r"<span>\s*包含每周事项、日历中心、重点事项、图片和设置\s*</span>",
        '<span>\n                        包含全部应用数据：每周事项、重复事项、纪念日、归档、资金快照、人生印记、'
        '重点事项（文档、目录、标签、历史版本、图片、思维导图）与全部设置。'
        '附件只保存文件路径，不含原文件。\n                      </span>\n'
        '                      <span class="data-last-backup">{{ lastBackupLabel }}</span>', s, count=1)
    if not n:
        sys.exit("[FAIL] configModal.vue 未找到完整备份说明文案")
    s = s.replace(".form-check-label {\n  margin-left: 10px;",
                  ".data-section-heading .data-last-backup {\n  color: #5f6670;\n}\n\n"
                  ".form-check-label {\n  margin-left: 10px;", 1)
    save(CFG, s)
    print("  ✓ " + CFG)

# ───────── 8. 自检 + 编译 + 提交
print("8) 自检")
for script in ["scripts/verify-v4.mjs", "scripts/verify-sidebar.mjs", "scripts/verify-focus.mjs"]:
    if (ROOT / script).exists() and subprocess.run(["node", script], cwd=ROOT).returncode != 0:
        sys.exit(f"[FAIL] {script} 未通过，已停止提交")
print("9) 编译")
if subprocess.run(["yarn", "electron:compile"], cwd=ROOT).returncode != 0:
    sys.exit("[FAIL] 编译失败，已停止提交（把报错发给我）")

print("10) 提交并推送")
files = [DLG, MAIN, PRELOAD, EDITOR, SLASH, DBS, CFG,
         *[rel for rel, _ in NEW_FILES], "patch_focus_20261109_v4.py"]
subprocess.run(["git", "add", *files], cwd=ROOT, check=True)
if subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=ROOT).returncode == 0:
    print("  · 没有需要提交的变更")
else:
    subprocess.run(["git", "commit", "-m",
        "feat(focus): V4 全屏固定宽屏 + 仅 Esc 提示；本地附件（只存路径，Finder 显示/打开/重新定位）；"
        "完整备份单事务快照、SHA-256 校验、导出回执与导入前摘要"], cwd=ROOT, check=True)
    subprocess.run(["git", "push"], cwd=ROOT, check=True)
print(f"\n完成 ✅  原文件备份在 {BACKUP}（不入 git）")
