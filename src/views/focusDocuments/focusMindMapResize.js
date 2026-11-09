/* FOCUS_POLISH_20261028_V3：思维导图块尺寸调整（与图片同一套交互）
 * 左右手柄：宽度（居中对称缩放，吸附 25/33/50/67/75/100%，⌥ 关闭吸附）
 * 底部手柄：画布高度 160–960px
 * 拖拽只改本地状态，松手一次 updateAttributes → 一次 ⌘Z 还原；Esc 取消；双击手柄还原
 * 宽度写入既有 attrs.width（导出链路已按它计算图片尺寸），高度写入新属性 previewHeight
 */
import "./focusMindMapResize.css";

const SNAP = [25, 100 / 3, 50, 200 / 3, 75, 100];
const SNAP_PX = 6;
const MIN_W = 240;
const MIN_H = 160;
const MAX_H = 960;

function parsePct(value) {
  const text = String(value ?? "100%").trim();
  if (!text.endsWith("%")) return 100;
  const n = parseFloat(text);
  return Number.isFinite(n) ? Math.min(100, Math.max(10, n)) : 100;
}

export const focusMindMapResizeMixin = {
  data() {
    return { fmrDrag: null, fmrLive: { w: null, h: null } };
  },

  computed: {
    fmrWidth() {
      return this.fmrLive.w ?? parsePct(this.node?.attrs?.width);
    },

    fmrHeight() {
      const h = this.fmrLive.h ?? Number(this.node?.attrs?.previewHeight);
      return Number.isFinite(h) && h > 0 ? h : null;
    },

    fmrCustom() {
      return parsePct(this.node?.attrs?.width) < 100 || Number(this.node?.attrs?.previewHeight) > 0;
    },

    fmrStyle() {
      const style = {};
      if (this.fmrWidth < 100) {
        style.width = `${this.fmrWidth}%`;
        style.marginLeft = "auto";
        style.marginRight = "auto";
      }
      if (this.fmrHeight) style["--fmr-h"] = `${this.fmrHeight}px`;
      return style;
    },

    fmrLabel() {
      if (!this.fmrDrag) return "";
      return this.fmrDrag.axis === "x"
        ? `宽 ${Math.round(this.fmrWidth)}%`
        : `高 ${Math.round(this.fmrHeight || 0)}px`;
    },
  },

  beforeUnmount() {
    this.fmrTeardown();
  },

  methods: {
    fmrStart(edge, event) {
      if (event.button !== 0 || this.editor?.isEditable === false) return;
      event.preventDefault();
      event.stopPropagation();

      const block = this.$el;
      const parent = block?.parentElement;
      if (!block || !parent) return;

      const shell = block.querySelector(".focus-mind-map-preview-shell");
      this.fmrDrag = {
        edge,
        axis: edge === "bottom" ? "y" : "x",
        x: event.clientX,
        y: event.clientY,
        w: block.getBoundingClientRect().width,
        h: shell ? shell.getBoundingClientRect().height : 360,
        avail: parent.getBoundingClientRect().width || 1,
      };
      this.fmrLive = { w: null, h: null };

      document.body.classList.add(edge === "bottom" ? "fmr-resizing-y" : "fmr-resizing-x");
      window.addEventListener("pointermove", this.fmrMove, true);
      window.addEventListener("pointerup", this.fmrEnd, true);
      window.addEventListener("pointercancel", this.fmrCancel, true);
      window.addEventListener("keydown", this.fmrKey, true);
    },

    fmrMove(event) {
      const d = this.fmrDrag;
      if (!d) return;
      event.preventDefault();

      if (d.axis === "x") {
        const dir = d.edge === "right" ? 1 : -1;
        let px = d.w + dir * (event.clientX - d.x) * 2;
        px = Math.max(Math.min(MIN_W, d.avail), Math.min(d.avail, px));
        let pct = (px / d.avail) * 100;
        if (!event.altKey) {
          const hit = SNAP.find((s) => Math.abs(px - (s / 100) * d.avail) <= SNAP_PX);
          if (hit) pct = hit;
        }
        this.fmrLive = { ...this.fmrLive, w: pct };
      } else {
        const h = Math.round(Math.max(MIN_H, Math.min(MAX_H, d.h + (event.clientY - d.y))));
        this.fmrLive = { ...this.fmrLive, h };
      }
    },

    fmrEnd() {
      const d = this.fmrDrag;
      const live = this.fmrLive;
      this.fmrTeardown();
      if (!d) return;

      const attrs = {};
      if (live.w != null) attrs.width = live.w >= 99.5 ? "100%" : `${live.w.toFixed(2)}%`;
      if (live.h != null) attrs.previewHeight = live.h;
      if (Object.keys(attrs).length) this.updateAttributes(attrs);
      this.fmrLive = { w: null, h: null };
    },

    fmrCancel() {
      this.fmrTeardown();
      this.fmrLive = { w: null, h: null };
    },

    fmrKey(event) {
      if (event.key !== "Escape" || !this.fmrDrag) return;
      event.preventDefault();
      event.stopPropagation();
      this.fmrCancel();
    },

    fmrTeardown() {
      window.removeEventListener("pointermove", this.fmrMove, true);
      window.removeEventListener("pointerup", this.fmrEnd, true);
      window.removeEventListener("pointercancel", this.fmrCancel, true);
      window.removeEventListener("keydown", this.fmrKey, true);
      document.body.classList.remove("fmr-resizing-x", "fmr-resizing-y");
      this.fmrDrag = null;
    },

    fmrReset() {
      this.updateAttributes({ width: "100%", previewHeight: null });
    },
  },
};
