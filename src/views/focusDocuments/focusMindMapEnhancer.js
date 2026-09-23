/* FMM_ENHANCE_20260923_V3
 * 思维导图增强模块
 * 1. XMind 式「中心对齐」连线：12 类骨架统一坐标模型
 * 2. 骨架缩略图（与真实连线同形）
 * 3. 快速样式：开关语义（再点取消）
 * 4. 骨架 / 配色浮层：外部点击、Esc、窗口失焦自动收起
 */
import "./focusMindMapEnhancer.css";

/* ================= 快速样式 ================= */

export const FMM_QUICK_STYLES = Object.freeze({
  important: Object.freeze({
    color: "#c55252",
    background: "#fbecec",
    border: "1px solid #e9b8b8",
    fontWeight: "700",
  }),
  idea: Object.freeze({
    color: "#9b6345",
    background: "#fbf2e7",
    border: "1px solid #ead2b3",
  }),
  done: Object.freeze({
    color: "#4f7d68",
    background: "#edf6f0",
    border: "1px solid #c3dccd",
    textDecoration: "line-through",
  }),
});

export const FMM_QUICK_STYLE_LIST = Object.freeze([
  { id: "important", label: "重要", glyph: "!" },
  { id: "idea", label: "灵感", glyph: "✦" },
  { id: "done", label: "已完成", glyph: "✓" },
]);

const QUICK_KEYS = Array.from(
  new Set(
    Object.values(FMM_QUICK_STYLES).flatMap((preset) =>
      Object.keys(preset)
    )
  )
);

const norm = (value) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

export function matchQuickStyle(style) {
  const current = style || {};

  const hit = Object.entries(FMM_QUICK_STYLES).find(
    ([, preset]) =>
      Object.entries(preset).every(
        ([key, value]) => norm(current[key]) === norm(value)
      )
  );

  return hit ? hit[0] : "";
}

/** 已是该样式 → 全部清除；否则先清掉其它快速样式再应用。 */
export function buildQuickStylePatch(type, currentStyle) {
  const preset = FMM_QUICK_STYLES[type];
  if (!preset) return null;

  const patch = {};
  QUICK_KEYS.forEach((key) => {
    patch[key] = null;
  });

  if (matchQuickStyle(currentStyle) === type) return patch;

  return Object.assign(patch, preset);
}

/* ================= 连线几何 ================= */

function readGap(mind, name, fallback) {
  const value = parseInt(
    mind?.container?.style?.getPropertyValue(name),
    10
  );
  return Number.isFinite(value) ? value : fallback;
}

/* 括号式：分叉处保持 T 形，只在外侧拐角做圆角（XMind 逻辑图） */
function elbowH(x1, y1, xs, x2, y2, radius) {
  if (Math.abs(y2 - y1) < 0.75) return `M ${x1} ${y1} H ${x2}`;

  const sy = y2 > y1 ? 1 : -1;
  const sx = x2 >= xs ? 1 : -1;
  const r = Math.max(
    0,
    Math.min(radius, Math.abs(y2 - y1), Math.abs(x2 - xs))
  );

  if (r < 0.5) return `M ${x1} ${y1} H ${xs} V ${y2} H ${x2}`;

  return (
    `M ${x1} ${y1} H ${xs} V ${y2 - sy * r} ` +
    `Q ${xs} ${y2} ${xs + sx * r} ${y2} H ${x2}`
  );
}

function curveH(x1, y1, x2, y2) {
  const mx = x1 + (x2 - x1) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`;
}

function straightH(x1, y1, x2, y2) {
  const s = x2 >= x1 ? 1 : -1;
  const stub = Math.min(6, Math.abs(x2 - x1) / 4);
  return (
    `M ${x1} ${y1} H ${x1 + s * stub} ` +
    `L ${x2 - s * stub} ${y2} H ${x2}`
  );
}

function elbowV(x1, y1, x2, y2, radius) {
  if (Math.abs(x2 - x1) < 0.75) return `M ${x1} ${y1} V ${y2}`;

  const mid = y1 + (y2 - y1) / 2;
  const sx = x2 > x1 ? 1 : -1;
  const r = Math.max(
    0,
    Math.min(radius, Math.abs(x2 - x1), Math.abs(y2 - mid))
  );

  if (r < 0.5) return `M ${x1} ${y1} V ${mid} H ${x2} V ${y2}`;

  return (
    `M ${x1} ${y1} V ${mid} H ${x2 - sx * r} ` +
    `Q ${x2} ${mid} ${x2} ${mid + r} V ${y2}`
  );
}

/* 主分支：根节点边缘中心 → 一级节点边缘中心 */
function mainPoints({ pT, pL, pW, pH, cT, cL, cW, cH, direction }) {
  const left = direction === "lhs";
  return {
    x1: left ? pL : pL + pW,
    y1: pT + pH / 2,
    x2: left ? cL + cW : cL,
    y2: cT + cH / 2,
  };
}

/* 子分支：me-parent 左右各含 --node-gap-x 内边距，
   文字边缘 = 外框 ± GAP；统一连到垂直中心，不再画下划线。 */
function subPoints(mind, { pT, pL, pW, pH, cT, cL, cW, cH, direction }) {
  const GAP = readGap(mind, "--node-gap-x", 30);
  const left = direction === "lhs";
  return {
    x1: left ? pL + GAP : pL + pW - GAP,
    y1: pT + pH / 2,
    x2: left ? cL + cW - GAP : cL + GAP,
    y2: cT + cH / 2,
  };
}

function horizontal(style, radius, p) {
  const { x1, y1, x2, y2 } = p;
  if (style === "rounded") return curveH(x1, y1, x2, y2);
  if (style === "straight") return straightH(x1, y1, x2, y2);
  return elbowH(x1, y1, x1 + (x2 - x1) / 2, x2, y2, radius);
}

export function createBranchGenerators(skeleton, ME) {
  try {
    if (!skeleton) return null;

    const style = skeleton.lineStyle || "bracket";

    if (ME && skeleton.direction === ME.DOWN) {
      const radius = style === "rounded" ? 10 : 0;
      const vertical = function ({ pT, pL, pW, pH, cT, cL, cW }) {
        return elbowV(pL + pW / 2, pT + pH, cL + cW / 2, cT, radius);
      };
      return {
        generateMainBranch: vertical,
        generateSubBranch: vertical,
      };
    }

    const radius = skeleton.compact ? 5 : 6;

    return {
      generateMainBranch(params) {
        return horizontal(style, radius, mainPoints(params));
      },
      generateSubBranch(params) {
        return horizontal(style, radius, subPoints(this, params));
      },
    };
  } catch (error) {
    console.error("[FocusMindMap] createBranchGenerators", error);
    return null;
  }
}

/* ================= 骨架缩略图（64×40） ================= */

const tRoot = (x, y, w = 14, h = 8) =>
  `<rect class="sk-root" x="${x}" y="${y}" width="${w}" height="${h}" rx="2"/>`;
const tLeaf = (x, y, w, h = 5) =>
  `<rect class="sk-leaf" x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5"/>`;
const tPath = (d) => `<path class="sk-line" d="${d}"/>`;
const tWrap = (body) =>
  `<svg viewBox="0 0 64 40" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

function hThumb(style, compact) {
  const ys = compact ? [12, 20, 28] : [8, 20, 32];
  const x0 = 18;
  const xs = 27;
  const x2 = 36;
  let d;

  if (style === "bracket") {
    d =
      `M${x0} 20 H${x2} ` +
      `M${xs} 20 V${ys[0] + 3} Q${xs} ${ys[0]} ${xs + 3} ${ys[0]} H${x2} ` +
      `M${xs} 20 V${ys[2] - 3} Q${xs} ${ys[2]} ${xs + 3} ${ys[2]} H${x2}`;
  } else if (style === "curve") {
    d = ys
      .map((y) => `M${x0} 20 C${xs} 20 ${xs} ${y} ${x2} ${y}`)
      .join(" ");
  } else {
    d = ys
      .map((y) => `M${x0} 20 H${x0 + 3} L${x2 - 3} ${y} H${x2}`)
      .join(" ");
  }

  return (
    tPath(d) +
    tRoot(4, 16) +
    ys.map((y) => tLeaf(x2 + 1, y - 2.5, 20)).join("")
  );
}

function sideThumb(style, compact) {
  const ys = compact ? [14, 26] : [10, 30];

  const seg = (x0, xs, x2, dir) =>
    ys
      .map((y) => {
        if (style === "bracket") {
          const sy = y < 20 ? -1 : 1;
          return (
            `M${x0} 20 H${xs} V${y - sy * 3} ` +
            `Q${xs} ${y} ${xs + dir * 3} ${y} H${x2}`
          );
        }
        return `M${x0} 20 C${xs} 20 ${xs} ${y} ${x2} ${y}`;
      })
      .join(" ");

  const d = `${seg(39, 44, 49, 1)} ${seg(25, 20, 15, -1)}`;

  return (
    tPath(d) +
    tRoot(25, 16) +
    ys.map((y) => tLeaf(50, y - 2.5, 11) + tLeaf(3, y - 2.5, 11)).join("")
  );
}

function downThumb(style, compact) {
  const xs = compact ? [18, 32, 46] : [11, 32, 53];
  const r = style === "rounded" ? 3 : 0;

  const d = xs
    .map((x) => {
      if (x === 32) return "M32 12 V27";
      const sx = x > 32 ? 1 : -1;
      return r
        ? `M32 12 V19 H${x - sx * r} Q${x} 19 ${x} ${19 + r} V27`
        : `M32 12 V19 H${x} V27`;
    })
    .join(" ");

  return (
    tPath(d) +
    tRoot(25, 4) +
    xs.map((x) => tLeaf(x - 6, 27, 12, 6)).join("")
  );
}

/** kind: right-bracket | right-curve | right-straight | left-* |
 *        side-curve | side-bracket | down-bracket | down-rounded */
export function skeletonThumb(kind, compact = false) {
  const [side, style] = String(kind || "right-bracket").split("-");

  if (side === "left") {
    return tWrap(
      `<g transform="matrix(-1 0 0 1 64 0)">${hThumb(style, compact)}</g>`
    );
  }
  if (side === "side") return tWrap(sideThumb(style, compact));
  if (side === "down") return tWrap(downThumb(style, compact));
  return tWrap(hThumb(style, compact));
}

/* ================= 组件 mixin ================= */

const MENU_SCOPE =
  ".focus-mind-map-global-control, .focus-mind-map-theme-control";

export const focusMindMapEnhancerMixin = {
  mounted() {
    const onPointerDown = (event) => {
      if (!this.skeletonMenuOpen && !this.themeMenuOpen) return;
      const target = event.target;
      if (target && target.closest && target.closest(MENU_SCOPE)) return;
      this.fmmxCloseMenus();
    };

    const onKeydown = (event) => {
      if (event.key !== "Escape") return;
      if (!this.skeletonMenuOpen && !this.themeMenuOpen) return;
      event.preventDefault();
      event.stopPropagation();
      this.fmmxCloseMenus();
    };

    const onBlur = () => this.fmmxCloseMenus();

    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeydown, true);
    window.addEventListener("blur", onBlur);

    this.fmmxDispose = () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeydown, true);
      window.removeEventListener("blur", onBlur);
    };
  },

  beforeUnmount() {
    if (typeof this.fmmxDispose === "function") this.fmmxDispose();
  },

  methods: {
    fmmxCloseMenus() {
      if (this.skeletonMenuOpen) this.skeletonMenuOpen = false;
      if (this.themeMenuOpen) this.themeMenuOpen = false;
    },

    fmmxPickSkeleton(id) {
      if (id !== this.activeSkeletonId) this.applyStableSkeleton(id);
      this.fmmxCloseMenus();
    },

    fmmxToggleQuickStyle(type) {
      if (!this.selectedCount) return;
      const patch = buildQuickStylePatch(type, this.selectedNodeStyle || {});
      if (patch) this.applyNodeStyle(patch);
    },
  },
};

export default { mixin: focusMindMapEnhancerMixin };
