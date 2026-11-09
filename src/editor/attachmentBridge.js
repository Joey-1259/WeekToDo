/* FOCUS_ATTACHMENT_20261109_V1：附件桥接（纯函数 + 桌面 API 包装；可在 node 中单测） */
const desktop = () => (typeof window !== "undefined" ? window.weekToDoDesktop : null);

export function attachmentsSupported() {
  const api = desktop();
  return Boolean(api && api.isElectron && typeof api.pickAttachments === "function");
}

export function baseName(p) {
  return String(p || "").split(/[\\/]/).filter(Boolean).pop() || String(p || "");
}

export function dirName(p) {
  const text = String(p || "");
  const i = Math.max(text.lastIndexOf("/"), text.lastIndexOf("\\"));
  if (i > 0) return text.slice(0, i);
  return i === 0 ? "/" : "";
}

export function extOf(name) {
  const m = /\.([A-Za-z0-9]{1,8})$/.exec(String(name || ""));
  return m ? m[1].toLowerCase() : "";
}

export function shortPath(p, home) {
  const text = String(p || "");
  if (!home) return text;
  if (text === home) return "~";
  return text.startsWith(home + "/") ? "~" + text.slice(home.length) : text;
}

const KINDS = [
  ["pdf", "PDF", ["pdf"]],
  ["word", null, ["doc", "docx", "pages", "rtf"]],
  ["sheet", null, ["xls", "xlsx", "csv", "tsv", "numbers"]],
  ["slide", null, ["ppt", "pptx", "key"]],
  ["image", null, ["png", "jpg", "jpeg", "gif", "webp", "heic", "svg", "bmp", "tiff", "psd", "sketch", "fig"]],
  ["video", null, ["mp4", "mov", "avi", "mkv", "m4v", "webm"]],
  ["audio", null, ["mp3", "wav", "m4a", "aac", "flac", "ogg"]],
  ["archive", null, ["zip", "rar", "7z", "tar", "gz", "tgz", "dmg", "iso"]],
  ["code", null, ["js", "ts", "py", "java", "go", "rs", "c", "cpp", "h", "json", "yaml", "yml", "xml", "html", "css", "sql", "sh", "md", "txt", "log"]],
];

export function kindOf(ext, isDirectory) {
  if (isDirectory) return { tone: "folder", label: "" };
  const e = String(ext || "").toLowerCase();
  for (const [tone, label, list] of KINDS) {
    if (list.includes(e)) return { tone, label: label || e.toUpperCase().slice(0, 4) };
  }
  return { tone: "other", label: e ? e.toUpperCase().slice(0, 4) : "FILE" };
}

export function formatBytes(n) {
  const size = Number(n);
  if (!Number.isFinite(size) || size < 0) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let value = size;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  const text = i === 0 || value >= 10 ? String(Math.round(value)) : value.toFixed(1).replace(/\.0$/, "");
  return `${text} ${units[i]}`;
}

/* ---------- 桌面 API ---------- */
let homePromise = null;
export function homeDir() {
  if (!attachmentsSupported()) return Promise.resolve(null);
  if (!homePromise) homePromise = desktop().getHomeDir().catch(() => null);
  return homePromise;
}

const pending = new Map();
let statTimer = 0;

async function flushStat() {
  const batch = new Map(pending);
  pending.clear();
  statTimer = 0;
  const paths = [...batch.keys()];
  let results = {};
  try {
    results = (await desktop().statAttachments(paths)) || {};
  } catch (error) {
    console.warn("[attachment] 状态检查失败", error);
  }
  paths.forEach((p) => batch.get(p).forEach((resolve) => resolve(results[p] || null)));
}

/** 30ms 内的请求合并成一次 IPC（打开含很多附件的文档时只问一次主进程） */
export function statPath(path) {
  if (!attachmentsSupported() || !path) return Promise.resolve(null);
  return new Promise((resolve) => {
    if (!pending.has(path)) pending.set(path, []);
    pending.get(path).push(resolve);
    if (!statTimer) statTimer = setTimeout(flushStat, 30);
  });
}

export const revealPath = (p) => desktop().revealAttachment(p);
export const openPath = (p) => desktop().openAttachment(p);
export const pickFiles = (options) => desktop().pickAttachments(options || {});

export function pathForFile(file) {
  try {
    return desktop()?.getPathForFile?.(file) || "";
  } catch {
    return "";
  }
}
