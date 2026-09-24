/* FMM_ADV_20260924_V5
 * 思维导图进阶能力：概要 / 外框 / 文字大纲 / 导出（PNG · PDF · Markdown · TXT）
 * - 外框数据：mind.meta.fmmBoundaries = [{ id, parent, start, end, side, label }]
 * - 渲染时机：包装 MindElixir.prototype.linkDiv，每次重绘后同步绘制
 */
import MindElixir from "mind-elixir";
import "./focusMindMapAdvanced.css";

const NS = "http://www.w3.org/2000/svg";
const LAYER = "fmma-bd-layer";
const LABELS = "fmma-bd-labels";
const FLAG = "__fmmaPatchV5";

const uid = () =>
  "bd" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clean = (t) => String(t ?? "").replace(/\s+/g, " ").trim();
const accentOf = (mind) => {
  const v = mind && mind.theme && mind.theme.cssVar;
  return (v && (v["--accent-color"] || v["--selected"])) || "#6579c8";
};

function setAttrs(el, attrs) {
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
  return el;
}

/* 元素相对 me-nodes 的未缩放坐标 */
function localRect(mind, el) {
  const base = mind.nodes.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const s = mind.scaleVal || 1;
  return {
    x: (r.left - base.left) / s,
    y: (r.top - base.top) / s,
    w: r.width / s,
    h: r.height / s,
  };
}

/* ================= 选区分组（XMind 规则：同分支合并，不同分支各自一组） ================= */
function groupSelection(mind) {
  const groups = new Map();
  (mind.currentNodes || []).forEach((tpc) => {
    const obj = tpc && tpc.nodeObj;
    const parent = obj && obj.parent;
    if (!parent || !Array.isArray(parent.children)) return;
    const index = parent.children.indexOf(obj);
    if (index < 0) return;
    let side = "";
    if (!parent.parent) {
      const main = tpc.closest("me-main");
      side = main ? main.className : "";
    }
    const key = parent.id + "|" + side;
    const g = groups.get(key) || { parent: parent.id, start: index, end: index, side };
    g.start = Math.min(g.start, index);
    g.end = Math.max(g.end, index);
    groups.set(key, g);
  });
  return Array.from(groups.values());
}

/* ================= 外框 ================= */
function getBoundaries(mind) {
  if (!mind.meta || typeof mind.meta !== "object") mind.meta = {};
  if (!Array.isArray(mind.meta.fmmBoundaries)) mind.meta.fmmBoundaries = [];
  return mind.meta.fmmBoundaries;
}

function fireChange(mind, id) {
  try {
    mind.bus.fire("operation", { name: "fmmBoundary", obj: { id } });
  } catch (error) {
    console.warn("[FocusMindMap] boundary operation", error);
  }
}

function boundaryRect(mind, b) {
  const parent = mind.getObjById(b.parent, mind.nodeData);
  if (!parent || !Array.isArray(parent.children) || !parent.children[b.end]) {
    return { stale: true };
  }
  let l = Infinity, t = Infinity, r = -Infinity, bt = -Infinity;
  for (let i = b.start; i <= b.end; i++) {
    let tpc = null;
    try { tpc = mind.findEle(parent.children[i].id); } catch (e) { tpc = null; }
    if (!tpc) continue;
    if (b.side) {
      const main = tpc.closest("me-main");
      if (main && main.className !== b.side) continue;
    }
    const wrapper = tpc.parentElement && tpc.parentElement.parentElement;
    const list = wrapper ? wrapper.querySelectorAll("me-tpc") : [tpc];
    list.forEach((el) => {
      const q = localRect(mind, el);
      l = Math.min(l, q.x);
      t = Math.min(t, q.y);
      r = Math.max(r, q.x + q.w);
      bt = Math.max(bt, q.y + q.h);
    });
  }
  if (!Number.isFinite(l)) return null;
  const P = 10;
  return { x: l - P, y: t - P - 4, w: r - l + P * 2, h: bt - t + P * 2 + 4 };
}

function ensureLayers(mind) {
  const nodes = mind.nodes;
  let svg = nodes.querySelector(":scope > svg." + LAYER);
  if (!svg) {
    svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", LAYER);
    nodes.insertBefore(svg, nodes.firstChild);
  }
  let labels = nodes.querySelector(":scope > div." + LABELS);
  if (!labels) {
    labels = document.createElement("div");
    labels.className = LABELS;
    nodes.appendChild(labels);
  }
  return { svg, labels };
}

function markSelection(mind) {
  if (!mind.nodes) return;
  mind.nodes
    .querySelectorAll(".fmma-bd-rect, .fmma-bd-label")
    .forEach((el) => {
      const on = el.getAttribute("data-id") === mind.__fmmaSel;
      el.classList.toggle("is-selected", on);
    });
}

function selectBoundary(mind, id) {
  if (id && mind.__fmmaSel !== id) {
    try { mind.clearSelection(); } catch (e) { /* ignore */ }
  }
  mind.__fmmaSel = id || null;
  markSelection(mind);
}

function startRename(mind, label, b) {
  label.contentEditable = "true";
  label.classList.add("is-editing");
  label.focus();
  const range = document.createRange();
  range.selectNodeContents(label);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  const finish = (commit) => {
    label.removeEventListener("keydown", onKey);
    label.removeEventListener("blur", onBlur);
    label.contentEditable = "false";
    label.classList.remove("is-editing");
    const text = clean(label.textContent);
    if (commit && text && text !== b.label) {
      b.label = text;
      fireChange(mind, b.id);
    }
    label.textContent = b.label || "外框";
  };
  const onKey = (e) => {
    e.stopPropagation();
    if (e.key === "Enter") { e.preventDefault(); finish(true); }
    else if (e.key === "Escape") { e.preventDefault(); finish(false); }
  };
  const onBlur = () => finish(true);
  label.addEventListener("keydown", onKey);
  label.addEventListener("blur", onBlur);
}

function bindLabel(mind, label, b) {
  const stop = (e) => e.stopPropagation();
  label.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    selectBoundary(mind, b.id);
    try { mind.container.focus({ preventScroll: true }); } catch (err) { /* ignore */ }
  });
  label.addEventListener("mousedown", stop);
  label.addEventListener("click", stop);
  label.addEventListener("dblclick", (e) => {
    e.stopPropagation();
    if (mind.editable === false) return;
    startRename(mind, label, b);
  });
}

export function renderBoundaries(mind) {
  if (!mind || !mind.nodes || !mind.nodeData) return;
  const list = getBoundaries(mind);
  const { svg, labels } = ensureLayers(mind);
  svg.setAttribute("width", mind.nodes.offsetWidth);
  svg.setAttribute("height", mind.nodes.offsetHeight);
  svg.innerHTML = "";
  labels.innerHTML = "";
  if (!list.length) return;

  const color = accentOf(mind);
  const stale = [];
  list.forEach((b) => {
    const rc = boundaryRect(mind, b);
    if (rc && rc.stale) { stale.push(b.id); return; }
    if (!rc) return;
    const rect = setAttrs(document.createElementNS(NS, "rect"), {
      class: "fmma-bd-rect",
      "data-id": b.id,
      x: rc.x, y: rc.y, width: rc.w, height: rc.h,
      rx: 12, ry: 12, fill: color, stroke: color,
    });
    svg.appendChild(rect);

    const label = document.createElement("span");
    label.className = "fmma-bd-label";
    label.setAttribute("data-id", b.id);
    label.textContent = b.label || "外框";
    label.title = "单击选中 · 双击重命名 · Delete 删除";
    label.style.left = rc.x + 14 + "px";
    label.style.top = rc.y + "px";
    label.style.setProperty("--fmma-accent", color);
    bindLabel(mind, label, b);
    labels.appendChild(label);
  });
  if (stale.length) {
    mind.meta.fmmBoundaries = list.filter((b) => !stale.includes(b.id));
  }
  markSelection(mind);
}

export function addBoundary(mind) {
  const groups = groupSelection(mind);
  if (!groups.length) return 0;
  const list = getBoundaries(mind);
  let last = "";
  groups.forEach((g) => {
    last = uid();
    list.push({ id: last, ...g, label: "外框" });
  });
  renderBoundaries(mind);
  fireChange(mind, last);
  return groups.length;
}

export function removeBoundary(mind, id) {
  const list = getBoundaries(mind);
  const next = list.filter((b) => b.id !== id);
  if (next.length === list.length) return;
  mind.meta.fmmBoundaries = next;
  mind.__fmmaSel = null;
  renderBoundaries(mind);
  fireChange(mind, id);
}

/* ================= 概要 ================= */
export function addSummary(mind) {
  const groups = groupSelection(mind);
  if (!groups.length) return 0;
  const color = accentOf(mind);
  groups.forEach((g) => {
    mind.createSummaryFrom({
      parent: g.parent,
      start: g.start,
      end: g.end,
      label: "概要",
      style: { stroke: color, labelColor: color },
    });
  });
  const last = mind.summaries[mind.summaries.length - 1];
  setTimeout(() => {
    const g = Array.from(mind.summarySvg.children).find(
      (n) => n.summaryObj && last && n.summaryObj.id === last.id
    );
    if (g) mind.editSummary(g);
  }, 0);
  return groups.length;
}

/* ================= 实例级安装：快捷键 / 选中联动 ================= */
function installInstance(mind) {
  if (mind.__fmmaInst || !mind.el) return;
  mind.__fmmaInst = true;

  mind.el.addEventListener(
    "keydown",
    (e) => {
      if (mind.editable === false) return;
      const t = e.target;
      if (t && (t.isContentEditable || t.id === "input-box")) return;
      if (mind.__fmmaSel && (e.key === "Delete" || e.key === "Backspace")) {
        e.preventDefault();
        e.stopImmediatePropagation();
        removeBoundary(mind, mind.__fmmaSel);
        return;
      }
      if (mind.__fmmaSel && e.key === "Escape") {
        e.stopImmediatePropagation();
        selectBoundary(mind, null);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey &&
          String(e.key).toLowerCase() === "b") {
        e.preventDefault();
        e.stopImmediatePropagation();
        addBoundary(mind);
      }
    },
    true
  );

  mind.el.addEventListener(
    "pointerdown",
    (e) => {
      const t = e.target;
      if (!mind.__fmmaSel) return;
      if (t && t.closest && t.closest(".fmma-bd-label")) return;
      selectBoundary(mind, null);
    },
    true
  );

  const notify = () => {
    const vm = mind.__fmmaVm;
    if (vm && typeof vm.fmmaOnChange === "function") vm.fmmaOnChange();
  };
  mind.bus.addListener("selectNodes", () => {
    if (mind.__fmmaSel) selectBoundary(mind, null);
  });
  mind.bus.addListener("operation", notify);
  mind.bus.addListener("linkDiv", notify);
}

function install() {
  const proto = MindElixir && MindElixir.prototype;
  if (!proto || proto[FLAG] || typeof proto.linkDiv !== "function") return;
  const base = proto.linkDiv;
  proto.linkDiv = function (...args) {
    const out = base.apply(this, args);
    try {
      installInstance(this);
      renderBoundaries(this);
    } catch (error) {
      console.warn("[FocusMindMap] boundaries", error);
    }
    return out;
  };
  proto[FLAG] = true;
}
install();

/* ================= 文字大纲 ================= */
export function buildOutline(mind) {
  const data = mind.getData();
  const summaries = data.summaries || [];
  const boundaries = (data.meta && data.meta.fmmBoundaries) || [];
  const rows = [];
  const walk = (node, depth) => {
    rows.push({
      key: node.id, id: node.id, depth,
      kind: depth === 0 ? "root" : "topic",
      text: clean(node.topic) || "（空主题）",
      boundary: "",
    });
    (node.children || []).forEach((child, i) => {
      const at = rows.length;
      walk(child, depth + 1);
      boundaries
        .filter((b) => b.parent === node.id && b.start === i)
        .forEach((b) => {
          const tag = "外框：" + (b.label || "外框");
          rows[at].boundary = rows[at].boundary ? rows[at].boundary + " · " + tag : tag;
        });
      summaries
        .filter((s) => s.parent === node.id && s.end === i)
        .forEach((s) => rows.push({
          key: "s-" + s.id, id: "", depth: depth + 1,
          kind: "summary", text: clean(s.label) || "概要", boundary: "",
        }));
    });
  };
  if (data.nodeData) walk(data.nodeData, 0);
  return rows;
}

export function toMarkdown(rows) {
  return rows.map((r) => {
    if (r.kind === "root") return "# " + r.text + "\n";
    const pad = "  ".repeat(Math.max(0, r.depth - 1));
    const body = r.kind === "summary" ? "**概要：**" + r.text : r.text;
    return pad + "- " + body + (r.boundary ? `  〔${r.boundary}〕` : "");
  }).join("\n") + "\n";
}

export function toPlain(rows) {
  return rows.map((r) =>
    "\t".repeat(r.depth) +
    (r.kind === "summary" ? "【概要】" : "") +
    r.text +
    (r.boundary ? `  [${r.boundary}]` : "")
  ).join("\n") + "\n";
}

/* ================= 导出 ================= */
async function mapSvgString(mind) {
  const blob = mind.exportSvg(true);
  const text = await blob.text();
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const root = doc.documentElement;
  const g = root.querySelector(":scope > svg");
  if (!g) return text;

  const layer = mind.nodes.querySelector(":scope > svg." + LAYER);
  if (layer) {
    const copy = doc.importNode(layer, true);
    copy.removeAttribute("class");
    copy.setAttribute("overflow", "visible");
    copy.querySelectorAll("rect").forEach((r) => {
      r.removeAttribute("class");
      setAttrs(r, {
        "fill-opacity": 0.05, "stroke-opacity": 0.6,
        "stroke-width": 1.2, "stroke-dasharray": "5 4",
      });
    });
    g.insertBefore(copy, g.firstChild);
  }

  const els = [
    ...(mind.labelContainer ? mind.labelContainer.querySelectorAll(".svg-label") : []),
    ...mind.nodes.querySelectorAll(".fmma-bd-label"),
  ];
  els.forEach((el) => {
    const txt = clean(el.textContent);
    if (!txt) return;
    const q = localRect(mind, el);
    const cs = getComputedStyle(el);
    if (el.classList.contains("fmma-bd-label")) {
      g.appendChild(setAttrs(doc.createElementNS(NS, "rect"), {
        x: q.x, y: q.y, width: q.w, height: q.h,
        rx: q.h / 2, ry: q.h / 2,
        fill: cs.backgroundColor, stroke: cs.borderTopColor, "stroke-width": 1,
      }));
    }
    const t = setAttrs(doc.createElementNS(NS, "text"), {
      x: q.x + (parseFloat(cs.paddingLeft) || 0),
      y: q.y + q.h / 2,
      "dominant-baseline": "central",
      "font-size": cs.fontSize,
      "font-family": cs.fontFamily,
      "font-weight": cs.fontWeight,
      fill: cs.color,
    });
    t.textContent = txt;
    g.appendChild(t);
  });
  return new XMLSerializer().serializeToString(root);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片渲染失败"));
    img.src = src;
  });
}

async function svgToPng(svgStr, scale = 2) {
  const img = await loadImage(
    "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgStr)
  );
  const k = Math.min(scale, 16000 / Math.max(img.width, img.height, 1));
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(img.width * k);
  canvas.height = Math.ceil(img.height * k);
  const ctx = canvas.getContext("2d");
  ctx.scale(k, k);
  ctx.drawImage(img, 0, 0);
  const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("画布过大，无法导出");
  return { blob, width: img.width, height: img.height };
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function printAsPdf(blob, w, h, title) {
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0";
  document.body.appendChild(iframe);
  const d = iframe.contentDocument;
  const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
  d.open();
  d.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>` +
    `<style>@page{size:${w}px ${h}px;margin:0}html,body{margin:0;padding:0}` +
    `img{display:block;width:${w}px;height:${h}px}</style></head>` +
    `<body><img src="${url}"></body></html>`
  );
  d.close();
  const img = d.querySelector("img");
  const go = () => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => { iframe.remove(); URL.revokeObjectURL(url); }, 2000);
  };
  if (img.complete) go(); else img.onload = go;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

const safeName = (s) =>
  clean(s).replace(/[\\/:*?"<>|]/g, "_").slice(0, 80) || "思维导图";

/* ================= Vue mixin ================= */
export const focusMindMapAdvancedMixin = {
  data() {
    return {
      fmmaOutlineOpen: false,
      fmmaOutlineRows: [],
      fmmaFormat: "md",
      fmmaExportOpen: false,
      fmmaExportStyle: {},
      fmmaBusy: "",
      fmmaToast: "",
      fmmaCopied: false,
    };
  },
  computed: {
    fmmaOutlineCount() {
      return this.fmmaOutlineRows.filter((r) => r.kind !== "summary").length;
    },
  },
  mounted() {
    const onDown = (e) => {
      if (!this.fmmaExportOpen) return;
      const t = e.target;
      if (t && t.closest && t.closest(".fmma-export, .fmma-export-menu")) return;
      this.fmmaExportOpen = false;
    };
    const onKey = (e) => {
      if (e.key !== "Escape" || !this.fmmaExportOpen) return;
      e.preventDefault();
      e.stopPropagation();
      this.fmmaExportOpen = false;
    };
    document.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    this.fmmaDispose = () => {
      document.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
  },
  beforeUnmount() {
    if (this.fmmaDispose) this.fmmaDispose();
    clearTimeout(this.fmmaToastTimer);
    clearTimeout(this.fmmaOutlineTimer);
    const m = this.fmmaMindRef;
    if (m && m.__fmmaVm === this) m.__fmmaVm = null;
  },
  methods: {
    fmmaMind() {
      const m = typeof this.fmmxMind === "function" ? this.fmmxMind() : null;
      if (m) { m.__fmmaVm = this; this.fmmaMindRef = m; }
      return m;
    },
/* FMM_EXPORT_MENU_20260924_V6：定位与文档菜单一致（右对齐、下移 7px、宽 190） */
    fmmaToggleExport(event) {
      this.skeletonMenuOpen = false;
      this.themeMenuOpen = false;
      if (this.fmmaExportOpen) {
        this.fmmaExportOpen = false;
        return;
      }
      const el = event && event.currentTarget;
      const rect = el && el.getBoundingClientRect
        ? el.getBoundingClientRect()
        : null;
      const W = 190;
      const EDGE = 12;
      const left = rect
        ? Math.max(EDGE, Math.min(window.innerWidth - W - EDGE, rect.right - W))
        : EDGE;
      const top = rect ? rect.bottom + 7 : EDGE;
      this.fmmaExportStyle = {
        position: "fixed",
        zIndex: 30000,
        width: W + "px",
        left: left + "px",
        top: top + "px",
      };
      this.fmmaExportOpen = true;
      window.addEventListener("resize", this.fmmaCloseExport, { once: true });
      window.addEventListener("blur", this.fmmaCloseExport, { once: true });
    },
    fmmaCloseExport() {
      this.fmmaExportOpen = false;
    },
    fmmaNotify(message) {
      this.fmmaToast = message;
      clearTimeout(this.fmmaToastTimer);
      this.fmmaToastTimer = setTimeout(() => { this.fmmaToast = ""; }, 2200);
    },
    fmmaAddSummary() {
      const m = this.fmmaMind();
      if (!m) return;
      if (!addSummary(m)) this.fmmaNotify("请先选择中心主题以外的节点");
    },
    fmmaAddBoundary() {
      const m = this.fmmaMind();
      if (!m) return;
      if (addBoundary(m)) this.fmmaNotify("已添加外框 · 双击标题可重命名");
      else this.fmmaNotify("请先选择中心主题以外的节点");
    },
    fmmaToggleOutline() {
      this.fmmaOutlineOpen = !this.fmmaOutlineOpen;
      if (this.fmmaOutlineOpen) this.fmmaRefreshOutline();
    },
    fmmaOnChange() {
      if (!this.fmmaOutlineOpen) return;
      clearTimeout(this.fmmaOutlineTimer);
      this.fmmaOutlineTimer = setTimeout(() => this.fmmaRefreshOutline(), 120);
    },
    fmmaRefreshOutline() {
      const m = this.fmmaMind();
      this.fmmaOutlineRows = m ? buildOutline(m) : [];
    },
    fmmaOutlineText(format) {
      this.fmmaRefreshOutline();
      return (format || this.fmmaFormat) === "md"
        ? toMarkdown(this.fmmaOutlineRows)
        : toPlain(this.fmmaOutlineRows);
    },
    async fmmaCopyOutline(format) {
      this.fmmaExportOpen = false;
      const ok = await copyText(this.fmmaOutlineText(format));
      this.fmmaCopied = ok;
      this.fmmaNotify(ok ? "大纲已复制到剪贴板" : "复制失败，请重试");
      setTimeout(() => { this.fmmaCopied = false; }, 1600);
    },
    fmmaSelectRow(id) {
      const m = this.fmmaMind();
      if (!m || !id) return;
      try {
        const tpc = m.findEle(id);
        if (tpc) m.selectNode(tpc);
        else this.fmmaNotify("该节点位于已折叠的分支中");
      } catch (error) {
        this.fmmaNotify("该节点位于已折叠的分支中");
      }
    },
    async fmmaExport(kind) {
      this.fmmaExportOpen = false;
      const m = this.fmmaMind();
      if (!m || this.fmmaBusy) return;
      const title = safeName(this.mapTitle || "思维导图");
      this.fmmaBusy = kind;
      try {
        if (kind === "md" || kind === "txt") {
          const text = this.fmmaOutlineText(kind);
          download(
            new Blob([text], { type: kind === "md" ? "text/markdown;charset=utf-8" : "text/plain;charset=utf-8" }),
            `${title}.${kind}`
          );
          this.fmmaNotify(kind === "md" ? "已导出 Markdown 大纲" : "已导出纯文本大纲");
        } else {
          const svg = await mapSvgString(m);
          const png = await svgToPng(svg, 2);
          if (kind === "png") {
            download(png.blob, `${title}.png`);
            this.fmmaNotify("已导出 PNG 图片（2x）");
          } else {
            printAsPdf(png.blob, png.width, png.height, title);
            this.fmmaNotify("在打印对话框中选择「存储为 PDF」");
          }
        }
      } catch (error) {
        console.error("[FocusMindMap] export", error);
        this.fmmaNotify("导出失败：" + ((error && error.message) || error));
      } finally {
        this.fmmaBusy = "";
      }
    },
  },
};

export default focusMindMapAdvancedMixin;
