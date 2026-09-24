/* FMM_ENHANCE_20260924_V4
 * 思维导图增强模块
 * 1. XMind 式中心对齐连线（单子节点 / 居中子节点吸附为直线）
 * 2. 骨架缩略图（与真实连线同形）
 * 3. 样式「删除语义」修复：取消 / 清除真正恢复默认
 *    根因：mind-elixir reshapeNode 使用 Object.assign 合并样式，
 *    shapeTpc 只写入存在的键，从不清除旧的内联样式。
 * 4. 快速样式开关
 * 5. 骨架 / 配色浮层：外部点击、Esc、窗口失焦自动收起
 */
import MindElixir from "mind-elixir";
import "./focusMindMapEnhancer.css";
import { focusMindMapAdvancedMixin } from "./focusMindMapAdvanced.js";

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
    Object.values(FMM_QUICK_STYLES).flatMap((preset) => Object.keys(preset))
  )
);

const EMPTY = (value) =>
  value === null || value === undefined || value === "";

const norm = (value) =>
  String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();

export function matchQuickStyle(style) {
  const current = style || {};
  const hit = Object.entries(FMM_QUICK_STYLES).find(([, preset]) =>
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

/* ================= 样式删除语义修复 ================= */

const PATCH_FLAG = "__fmmStyleFixV4";
let pending = null;

function armPending(keys, all) {
  pending = {
    keys: new Set(keys || []),
    all: Boolean(all),
    expires: Date.now() + 400,
  };
}

function takePending() {
  if (!pending || Date.now() > pending.expires) {
    return { keys: new Set(), all: false };
  }
  return { keys: new Set(pending.keys), all: pending.all };
}

function stripStyle(tpc, keys, withBranch) {
  const obj = tpc && tpc.nodeObj;
  if (!obj) return false;

  let changed = false;
  const style = { ...(obj.style || {}) };

  keys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(style, key)) {
      delete style[key];
      changed = true;
    }
    try {
      if (tpc.style && tpc.style[key]) {
        tpc.style[key] = "";
        changed = true;
      }
    } catch (error) {
      /* 非法 CSS 键忽略 */
    }
  });

  if (changed) {
    if (Object.keys(style).length) obj.style = style;
    else delete obj.style;
  }

  if (withBranch && obj.branchColor) {
    delete obj.branchColor;
    changed = true;
  }

  return changed;
}

function refreshSelection(mind) {
  try {
    const nodes = (mind && mind.currentNodes) || [];
    if (mind && mind.bus && nodes.length) {
      mind.bus.fire(
        "selectNodes",
        nodes.map((tpc) => tpc.nodeObj)
      );
    }
  } catch (error) {
    console.warn("[FocusMindMap] refreshSelection", error);
  }
}

function installStyleFix() {
  const proto = MindElixir && MindElixir.prototype;
  if (!proto || proto[PATCH_FLAG]) return;

  const baseLink = proto.linkDiv;
  if (typeof baseLink === "function") {
    proto.linkDiv = function (...args) {
      if (this && this.container) this.container.__fmmMind = this;
      return baseLink.apply(this, args);
    };
  }

  const baseReshape = proto.reshapeNode;
  if (typeof baseReshape === "function") {
    proto.reshapeNode = async function (tpc, patchData) {
      const touches =
        Boolean(patchData)
        && Object.prototype.hasOwnProperty.call(patchData, "style");
      const prev =
        touches && tpc && tpc.nodeObj
          ? { ...(tpc.nodeObj.style || {}) }
          : null;
      const intended =
        touches && patchData.style ? { ...patchData.style } : null;
      const armed = touches ? takePending() : null;

      const result = await baseReshape.call(this, tpc, patchData);
      if (!touches) return result;

      const keys = new Set(armed.keys);
      if (intended) {
        Object.keys(intended).forEach((key) => {
          if (EMPTY(intended[key])) keys.add(key);
        });
      }
      if (!intended || armed.all) {
        Object.keys(prev || {}).forEach((key) => {
          if (!intended || EMPTY(intended[key])) keys.add(key);
        });
      }

      if (stripStyle(tpc, keys, false)) {
        try {
          this.linkDiv();
        } catch (error) {
          console.warn("[FocusMindMap] relink after style", error);
        }
        refreshSelection(this);
      }
      return result;
    };
  }

  proto[PATCH_FLAG] = true;
}

installStyleFix();

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

function elbowV(x1, y1, x2, y2, radius, snap) {
  if (Math.abs(x2 - x1) <= snap) return `M ${x1} ${y1} V ${y2}`;

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

/* 吸附阈值：中心偏差小于较矮节点高度的 1/3 → 视为同一水平线 */
const snapOf = (a, b) => Math.max(2, Math.min(a, b) / 3);

function mainPoints({ pT, pL, pW, pH, cT, cL, cW, cH, direction }) {
  const left = direction === "lhs";
  return {
    x1: left ? pL : pL + pW,
    y1: pT + pH / 2,
    x2: left ? cL + cW : cL,
    y2: cT + cH / 2,
    snap: snapOf(pH, cH),
  };
}

/* 子分支：me-parent 左右各含 --node-gap-x 内边距 */
function subPoints(mind, { pT, pL, pW, pH, cT, cL, cW, cH, direction }) {
  const GAP = readGap(mind, "--node-gap-x", 30);
  const left = direction === "lhs";
  return {
    x1: left ? pL + GAP : pL + pW - GAP,
    y1: pT + pH / 2,
    x2: left ? cL + cW - GAP : cL + GAP,
    y2: cT + cH / 2,
    snap: snapOf(pH, cH),
  };
}

function horizontal(style, radius, p) {
  const { x1, y1, x2, y2, snap } = p;

  if (Math.abs(y2 - y1) <= snap) return `M ${x1} ${y1} H ${x2}`;
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
        return elbowV(
          pL + pW / 2,
          pT + pH,
          cL + cW / 2,
          cT,
          radius,
          Math.max(2, Math.min(pW, cW) / 4)
        );
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
      .map((y) =>
        y === 20
          ? `M${x0} 20 H${x2}`
          : `M${x0} 20 C${xs} 20 ${xs} ${y} ${x2} ${y}`
      )
      .join(" ");
  } else {
    d = ys
      .map((y) =>
        y === 20
          ? `M${x0} 20 H${x2}`
          : `M${x0} 20 H${x0 + 3} L${x2 - 3} ${y} H${x2}`
      )
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
  /* FMM_ADV_20260924_V5 */
  mixins: [focusMindMapAdvancedMixin],
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
    clearTimeout(this.fmmxSettleTimer);
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

    fmmxSelectedTopics() {
      const canvas = this.$refs && this.$refs.editorCanvas;
      return canvas
        ? Array.from(canvas.querySelectorAll("me-tpc.selected"))
        : [];
    },

    fmmxMind() {
      const canvas = this.$refs && this.$refs.editorCanvas;
      const container = canvas && canvas.querySelector(".map-container");
      return (container && container.__fmmMind) || null;
    },

    /* 所有样式写入统一入口：记录要删除的键，交给引擎层修复 */
    fmmxApplyStyle(patch) {
      const keys = Object.keys(patch || {}).filter((key) =>
        EMPTY(patch[key])
      );
      armPending(keys, false);
      this.applyNodeStyle(patch);
      this.fmmxSettle(keys, false);
    },

    fmmxResetStyle() {
      armPending([], true);
      this.resetNodeStyle();
      this.fmmxSettle([], true);
    },

    fmmxToggleQuickStyle(type) {
      if (!this.selectedCount) return;
      const patch = buildQuickStylePatch(type, this.selectedNodeStyle || {});
      if (patch) this.fmmxApplyStyle(patch);
    },

    /* 兜底：宿主若未走 reshapeNode，直接在 DOM 节点上完成清理 */
    fmmxSettle(keys, all) {
      clearTimeout(this.fmmxSettleTimer);
      this.fmmxSettleTimer = setTimeout(() => {
        const tpcs = this.fmmxSelectedTopics();
        let changed = false;

        tpcs.forEach((tpc) => {
          const set = all
            ? new Set(Object.keys((tpc.nodeObj && tpc.nodeObj.style) || {}))
            : new Set(keys);
          if (stripStyle(tpc, set, all)) changed = true;
        });

        const mind = this.fmmxMind();
        if (!changed || !mind) return;

        try {
          mind.linkDiv();
          tpcs.forEach((tpc) => {
            mind.bus.fire("operation", {
              name: "reshapeNode",
              obj: tpc.nodeObj,
              origin: tpc.nodeObj,
            });
          });
        } catch (error) {
          console.warn("[FocusMindMap] settle style", error);
        }
        refreshSelection(mind);
      }, 120);
    },
  },
};

export default { mixin: focusMindMapEnhancerMixin };
