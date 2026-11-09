/* FOCUS_BACKUP_20261109_V1：备份回执与备份摘要——让用户看见"到底备份了什么" */
import "./backupReceipt.css";

export const COUNT_LABELS = [
  ["weeklyLists", "事项清单"],
  ["repeatingEvents", "重复事项"],
  ["anniversaries", "纪念日"],
  ["archivedTasks", "归档事项"],
  ["financialSnapshots", "资金快照"],
  ["lifeImprintCards", "人生印记卡片"],
  ["focusDocuments", "重点事项文档"],
  ["focusFolders", "文档目录"],
  ["focusRevisions", "历史版本"],
  ["focusAssets", "图片与导图快照"],
  ["localStorageKeys", "设置与本地配置项"],
];

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function formatBytes(n) {
  const size = Number(n);
  if (!Number.isFinite(size) || size <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let value = size;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${i === 0 || value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

function formatTime(iso) {
  const t = new Date(iso);
  return Number.isNaN(t.getTime()) ? "未知时间" : t.toLocaleString("zh-CN", { hour12: false });
}

function countParts(counts) {
  return COUNT_LABELS.filter(([key]) => Number(counts?.[key]) > 0).map(([key, label]) => [label, counts[key]]);
}

/** 导入确认框用的纯文本摘要 */
export function describeBackup(summary) {
  const lines = [`备份时间：${formatTime(summary?.exportedAt)}　版本：${summary?.appVersion || "未知"}`];
  lines.push(
    summary?.integrity === "ok"
      ? "完整性校验：通过（SHA-256）"
      : summary?.integrity === "absent"
        ? "完整性校验：旧版备份，没有校验信息"
        : "完整性校验：当前环境无法校验"
  );
  const parts = countParts(summary?.counts).map(([label, n]) => `${label} ${n}`);
  lines.push(parts.length ? `包含：${parts.join("、")}` : "包含：（空备份）");
  return lines.join("\n");
}

/** 导出完成后右下角回执，15 秒后自动消失 */
export function showBackupReceipt(receipt) {
  if (!receipt || typeof document === "undefined") return;
  document.querySelector(".wtd-receipt")?.remove();

  const rows = countParts(receipt.counts)
    .map(([label, n]) => `<li><span>${escapeHtml(label)}</span><b>${escapeHtml(n)}</b></li>`)
    .join("");
  const digest = receipt.integrity?.digest || "";
  const file = receipt.file || {};

  const el = document.createElement("div");
  el.className = "wtd-receipt";
  el.setAttribute("role", "status");
  el.innerHTML = `
    <header>
      <strong>完整备份已生成</strong>
      <button type="button" aria-label="关闭">×</button>
    </header>
    <p class="wtd-receipt-file">${escapeHtml(file.name || "")}${file.size ? " · " + escapeHtml(formatBytes(file.size)) : ""}</p>
    <ul>${rows || "<li><span>（当前没有数据）</span><b>0</b></li>"}</ul>
    ${digest ? `<p class="wtd-receipt-hash">SHA-256 ${escapeHtml(digest.slice(0, 10))}…${escapeHtml(digest.slice(-6))}</p>` : ""}
    <p class="wtd-receipt-note">附件只保存路径，不含原文件。备份为明文文件（含资金数据），请存放在安全位置。</p>
  `;
  const close = () => el.remove();
  el.querySelector("button").addEventListener("click", close);
  document.body.appendChild(el);
  setTimeout(close, 15000);
}
