/* FUNDS_TXT_EXPORT_20261007_V1
 *
 * 资金快照 → 纯文本（TXT）。
 *
 * 口径：
 *  - scope 为空 = 全部账户；非空时资产 / 负债只统计所选账户，
 *    与弹窗顶部合计卡同一口径。未来资金用途不按账户过滤。
 *  - 模块为空则整段不输出；无名称且金额为 0 的空白行永远不输出；
 *    金额为 0 的明细由 includeZero 控制。
 */
import financialAccountService, {
  DEFAULT_ACCOUNT_ID,
} from "./financialAccountService";

const PRIORITY_LABELS = Object.freeze({
  essential: "必要",
  important: "重要",
  wish: "愿望",
});

const RULE = "─".repeat(36);
const HEAVY_RULE = "═".repeat(36);
const NAME_MAX_WIDTH = 24;
const FOOTER = "由 WeekToDo 资金管理导出 · 数据仅保存在本地";

/* ---------- 基础格式化 ---------- */

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function formatMoney(value) {
  const amount = toNumber(value);
  const sign = amount < 0 ? "-" : "";

  return (
    sign +
    "¥" +
    Math.abs(amount).toLocaleString("zh-CN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function signedMoney(value) {
  const amount = toNumber(value);
  if (Math.abs(amount) < 0.005) return "持平";
  return (amount > 0 ? "+" : "") + formatMoney(amount);
}

function isWide(code) {
  return (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe30 && code <= 0xfe4f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6) ||
    (code >= 0x1f300 && code <= 0x1faff) ||
    (code >= 0x20000 && code <= 0x3fffd)
  );
}

/** 等宽字体下的显示宽度：中日韩文字占两格。 */
export function displayWidth(text) {
  let width = 0;
  for (const char of String(text ?? "")) {
    width += isWide(char.codePointAt(0)) ? 2 : 1;
  }
  return width;
}

function padEnd(text, width) {
  const value = String(text ?? "");
  return value + " ".repeat(Math.max(0, width - displayWidth(value)));
}

function padStart(text, width) {
  const value = String(text ?? "");
  return " ".repeat(Math.max(0, width - displayWidth(value))) + value;
}

function truncate(text, maxWidth) {
  const value = String(text ?? "");
  if (displayWidth(value) <= maxWidth) return value;

  let output = "";
  let width = 0;

  for (const char of value) {
    const charWidth = isWide(char.codePointAt(0)) ? 2 : 1;
    if (width + charWidth > maxWidth - 1) break;
    output += char;
    width += charWidth;
  }

  return output + "…";
}

function formatDateTime(value) {
  const text = String(value || "");
  const matched = text.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
  if (matched) return `${matched[1]} ${matched[2]}`;
  return text.slice(0, 16) || "未记录时间";
}

function localStamp(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16).replace("T", " ");
}

function timeValue(value) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function sortByTime(list) {
  return (Array.isArray(list) ? [...list] : []).sort(
    (a, b) => timeValue(a?.recordedAt) - timeValue(b?.recordedAt)
  );
}

/* ---------- 账户与口径 ---------- */

function normalizeScope(scope) {
  return Array.isArray(scope) ? scope.filter(Boolean) : [];
}

function accountName(id, accounts) {
  const key = id || DEFAULT_ACCOUNT_ID;
  const hit = (accounts || []).find((item) => item.id === key);
  return hit ? hit.name : financialAccountService.resolve(key).name;
}

function scopeLabel(scope, accounts) {
  if (!scope.length) return "全部账户";
  return scope.map((id) => accountName(id, accounts)).join("、");
}

function inScope(row, scope) {
  if (!scope.length) return true;
  return scope.includes(row?.accountId || DEFAULT_ACCOUNT_ID);
}

function summarizeScoped(snapshot, scope) {
  return financialAccountService.summarize(
    snapshot,
    scope.length ? scope : null
  );
}

function pickMoneyRows(rows, scope, includeZero) {
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => inScope(row, scope))
    .filter((row) => {
      const named = String(row?.name || "").trim();
      const amount = toNumber(row?.amount);

      if (!named && amount === 0) return false;
      if (!includeZero && amount === 0) return false;
      return true;
    });
}

function pickPlans(plans) {
  return (Array.isArray(plans) ? plans : []).filter(
    (plan) =>
      String(plan?.name || "").trim() || toNumber(plan?.amount) !== 0
  );
}

function findPrevious(snapshot, snapshots) {
  const list = sortByTime(snapshots);
  const index = list.findIndex((item) => item.id === snapshot?.id);

  if (index > 0) return list[index - 1];
  if (index === 0) return null;

  /* 尚未保存的新快照：取时间上在它之前的最后一个节点。 */
  const time = timeValue(snapshot?.recordedAt);
  const earlier = list.filter((item) => timeValue(item.recordedAt) <= time);
  return earlier.length ? earlier[earlier.length - 1] : null;
}

/* ---------- 版式 ---------- */

function table(rows, nameOf, tagsOf) {
  const names = rows.map((row, index) =>
    truncate(nameOf(row, index), NAME_MAX_WIDTH)
  );
  const amounts = rows.map((row) => formatMoney(row.amount));
  const nameWidth = Math.max(4, ...names.map(displayWidth));
  const amountWidth = Math.max(...amounts.map(displayWidth));

  return rows.map((row, index) => {
    const tags = tagsOf(row).filter(Boolean);

    return (
      "  " +
      padEnd(names[index], nameWidth) +
      "  " +
      padStart(amounts[index], amountWidth) +
      (tags.length ? "   " + tags.join(" · ") : "")
    ).trimEnd();
  });
}

function buildBody(snapshot, { scope, accounts, includeZero, previous }) {
  const sections = [];
  const assets = pickMoneyRows(snapshot?.assets, scope, includeZero);
  const liabilities = pickMoneyRows(snapshot?.liabilities, scope, includeZero);
  const plans = pickPlans(snapshot?.plans);
  const note = String(snapshot?.note || "").replace(/\r\n?/g, "\n").trim();
  const summary = summarizeScoped(snapshot, scope);

  const showAccount =
    new Set(
      [...assets, ...liabilities].map(
        (row) => row.accountId || DEFAULT_ACCOUNT_ID
      )
    ).size > 1;

  if (assets.length || liabilities.length) {
    const overview = [
      ["总资产", formatMoney(summary.assetTotal), ""],
      ["总负债", formatMoney(summary.liabilityTotal), ""],
      ["净资产", formatMoney(summary.netWorth), ""],
    ];

    if (previous) {
      const before = summarizeScoped(previous, scope);
      overview.push([
        "较上次",
        signedMoney(summary.netWorth - before.netWorth),
        `（上次 ${formatDateTime(previous.recordedAt)}）`,
      ]);
    }

    const width = Math.max(...overview.map((row) => displayWidth(row[1])));

    sections.push([
      "【概览】",
      ...overview.map(
        ([label, value, suffix]) =>
          `  ${label}  ${padStart(value, width)}${suffix ? "  " + suffix : ""}`
      ),
    ]);
  }

  if (assets.length) {
    const lines = [
      `【资产】合计 ${formatMoney(summary.assetTotal)} · ${assets.length} 项`,
      ...table(
        assets,
        (row) => String(row.name || "").trim() || "未命名",
        (row) => [
          row.liquid ? "可调度" : "",
          showAccount ? accountName(row.accountId, accounts) : "",
        ]
      ),
    ];

    if (assets.some((row) => row.liquid)) {
      lines.push(`  其中可调度：${formatMoney(summary.liquidTotal)}`);
    }

    sections.push(lines);
  }

  if (liabilities.length) {
    sections.push([
      `【负债】合计 ${formatMoney(summary.liabilityTotal)} · ${liabilities.length} 项`,
      ...table(
        liabilities,
        (row) => String(row.name || "").trim() || "未命名",
        (row) => [showAccount ? accountName(row.accountId, accounts) : ""]
      ),
    ]);
  }

  if (plans.length) {
    const total = plans.reduce((sum, plan) => sum + toNumber(plan.amount), 0);
    const rows = table(
      plans,
      (plan, index) =>
        `${index + 1}. ${String(plan.name || "").trim() || "未命名"}`,
      (plan) => [
        plan.targetDate ? String(plan.targetDate) : "",
        PRIORITY_LABELS[plan.priority] || "",
      ]
    );

    const lines = [
      `【未来资金用途】合计 ${formatMoney(total)} · ${plans.length} 项`,
    ];

    plans.forEach((plan, index) => {
      lines.push(rows[index]);
      const planNote = String(plan.note || "").trim();
      if (planNote) lines.push(`     备注：${planNote.replace(/\s*\n\s*/g, " ")}`);
    });

    if (total > 0) {
      const liquid = summary.liquidTotal;
      const percent = Math.max(0, Math.min(100, Math.round((liquid / total) * 100)));
      const gap = total - liquid;

      lines.push(
        `  可调度资产 ${formatMoney(liquid)}，覆盖 ${percent}%` +
          (gap > 0.005 ? `，缺口 ${formatMoney(gap)}` : "，已全部覆盖")
      );
    }

    sections.push(lines);
  }

  if (note) {
    sections.push([
      "【本次记录】",
      ...note.split("\n").map((line) => (line.trim() ? "  " + line.trimEnd() : "")),
    ]);
  }

  return sections.reduce(
    (all, section, index) => (index ? [...all, "", ...section] : [...section]),
    []
  );
}

function finish(lines) {
  return [...lines, "", RULE, FOOTER].join("\n") + "\n";
}

/* ---------- 对外 API ---------- */

export function buildSnapshotText({
  snapshot,
  snapshots = [],
  scope = [],
  accounts = [],
  includeZero = false,
  dirty = false,
  now = new Date(),
} = {}) {
  const normalizedScope = normalizeScope(scope);
  const title = String(snapshot?.title || "").trim();

  const lines = [
    title ? `资金快照 · ${title}` : "资金快照",
    RULE,
    `记录时间：${formatDateTime(snapshot?.recordedAt)}`,
    `统计范围：${scopeLabel(normalizedScope, accounts)}`,
    `导出时间：${localStamp(now)}`,
  ];

  if (dirty) lines.push("说明：包含尚未保存的修改");

  const body = buildBody(snapshot, {
    scope: normalizedScope,
    accounts,
    includeZero,
    previous: findPrevious(snapshot, snapshots),
  });

  lines.push("", ...(body.length ? body : ["（这张快照还没有可导出的内容）"]));
  return finish(lines);
}

export function buildTimelineText({
  snapshots = [],
  scope = [],
  accounts = [],
  includeZero = false,
  now = new Date(),
} = {}) {
  const normalizedScope = normalizeScope(scope);
  const list = sortByTime(snapshots);

  const lines = [
    "资金时间轴",
    RULE,
    `统计范围：${scopeLabel(normalizedScope, accounts)}`,
    `导出时间：${localStamp(now)}`,
  ];

  if (!list.length) {
    lines.push("", "（还没有已保存的资金快照）");
    return finish(lines);
  }

  lines.push(
    `节点数量：${list.length}（${formatDateTime(list[0].recordedAt)} 至 ${formatDateTime(
      list[list.length - 1].recordedAt
    )}）`
  );

  const header = ["时间", "净资产", "较上次", "总资产", "总负债"];
  const rows = list.map((snapshot, index) => {
    const summary = summarizeScoped(snapshot, normalizedScope);
    const before = index ? summarizeScoped(list[index - 1], normalizedScope) : null;

    return [
      formatDateTime(snapshot.recordedAt),
      formatMoney(summary.netWorth),
      before ? signedMoney(summary.netWorth - before.netWorth) : "—",
      formatMoney(summary.assetTotal),
      formatMoney(summary.liabilityTotal),
    ];
  });

  const widths = header.map((cell, column) =>
    Math.max(displayWidth(cell), ...rows.map((row) => displayWidth(row[column])))
  );
  const line = (cells) =>
    "  " +
    cells
      .map((cell, column) =>
        column === 0 ? padEnd(cell, widths[column]) : padStart(cell, widths[column])
      )
      .join("   ");
  const totalWidth = widths.reduce((sum, width) => sum + width, 0) + 3 * (widths.length - 1);

  lines.push("", "【净资产轨迹】", line(header), "  " + "-".repeat(totalWidth));
  rows.forEach((row) => lines.push(line(row)));

  lines.push("", "【各节点明细】（最新在前）");

  for (let index = list.length - 1; index >= 0; index -= 1) {
    const snapshot = list[index];
    const title = String(snapshot.title || "").trim();
    const body = buildBody(snapshot, {
      scope: normalizedScope,
      accounts,
      includeZero,
      previous: index > 0 ? list[index - 1] : null,
    });

    lines.push(
      "",
      HEAVY_RULE,
      `${formatDateTime(snapshot.recordedAt)}${title ? " · " + title : ""}`,
      "",
      ...(body.length ? body : ["（无可导出内容）"])
    );
  }

  return finish(lines);
}

function safeName(value) {
  return String(value || "")
    .replace(/[\\/:*?"<>|\r\n\t]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
}

export function buildSnapshotFilename(snapshot) {
  const stamp = formatDateTime(snapshot?.recordedAt)
    .replace(/[-:]/g, "")
    .replace(" ", "_");
  const title = safeName(snapshot?.title);
  return `资金快照_${stamp}${title ? "_" + title : ""}.txt`;
}

export function buildTimelineFilename(now = new Date()) {
  return `资金时间轴_${localStamp(now).slice(0, 10).replace(/-/g, "")}.txt`;
}

function fingerprint(snapshot) {
  const rows = (list, extra) =>
    (Array.isArray(list) ? list : []).map((row) => ({
      n: String(row?.name || ""),
      a: toNumber(row?.amount),
      ...extra(row),
    }));

  return JSON.stringify({
    t: String(snapshot?.title || ""),
    r: String(snapshot?.recordedAt || ""),
    as: rows(snapshot?.assets, (row) => ({
      l: Boolean(row?.liquid),
      c: row?.accountId || DEFAULT_ACCOUNT_ID,
    })),
    li: rows(snapshot?.liabilities, (row) => ({
      c: row?.accountId || DEFAULT_ACCOUNT_ID,
    })),
    p: rows(snapshot?.plans, (row) => ({
      d: String(row?.targetDate || ""),
      p: row?.priority || "important",
      o: String(row?.note || ""),
    })),
    no: String(snapshot?.note || ""),
  });
}

/** false = 与已保存版本一致；"new" = 尚未保存；"changed" = 有未保存修改。 */
export function isSnapshotDirty(snapshot, snapshots) {
  if (!snapshot) return false;
  const saved = (snapshots || []).find((item) => item.id === snapshot.id);
  if (!saved) return "new";
  return fingerprint(saved) === fingerprint(snapshot) ? false : "changed";
}

export function downloadTextFile(filename, text) {
  const blob = new Blob(["\ufeff" + text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 回退到 execCommand
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }

  textarea.remove();
  return ok;
}
