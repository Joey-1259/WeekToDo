import {
  planMindMapViewport,
} from "../../services/focusMindMapViewport.mjs";

function rootTopic(mind) {
  try {
    const topic = mind.findEle(mind.nodeData.id);
    if (topic) return topic;
  } catch {
    // 初始化期间节点尚未就绪。
  }

  return mind.root?.querySelector?.("me-tpc") || mind.root || null;
}

function contentElements(mind) {
  const result = new Set();

  const add = (root, selector) => {
    root?.querySelectorAll?.(selector)
      .forEach((element) => result.add(element));
  };

  add(mind.nodes, "me-tpc, .fmma-bd-label, .fmma-bd-rect");
  add(mind.lines, "path, rect, circle, ellipse, polygon, polyline, text");
  add(mind.summarySvg, "path, rect, text");
  add(mind.arrowSvg, "path, rect, text");
  add(mind.labelContainer, ".svg-label");

  return [...result].filter((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);

    return (
      (rect.width > 0 || rect.height > 0) &&
      style.display !== "none" &&
      style.visibility !== "hidden"
    );
  });
}

function usableViewport(container, host) {
  const rect = container.getBoundingClientRect();
  let left = rect.left;
  let right = rect.right;

  const stage = host?.closest(".focus-mind-map-stage");

  for (const panel of stage?.querySelectorAll(
    ".mind-map-inspector, .fmma-outline"
  ) || []) {
    const overlay = panel.getBoundingClientRect();

    if (
      overlay.bottom <= rect.top ||
      overlay.top >= rect.bottom ||
      overlay.right <= left ||
      overlay.left >= right
    ) {
      continue;
    }

    // 如果面板覆盖画布，选择覆盖区域之外较大的水平区域。
    const leftWidth = Math.max(0, overlay.left - left);
    const rightWidth = Math.max(0, right - overlay.right);

    if (leftWidth >= rightWidth) {
      right = Math.min(right, overlay.left);
    } else {
      left = Math.max(left, overlay.right);
    }
  }

  return {
    left,
    top: rect.top,
    width: right - left,
    height: rect.height,
  };
}

export function fitFocusMindMap(mind, {
  host = mind?.el,
  padding = 32,
} = {}) {
  if (!mind?.map || !mind?.nodes || !mind?.container) return false;

  const root = rootTopic(mind);
  const viewport = usableViewport(mind.container, host);

  if (!root || viewport.width < 80 || viewport.height < 80) return false;

  const rootRect = root.getBoundingClientRect();
  const rootX = rootRect.left + rootRect.width / 2;
  const rootY = rootRect.top + rootRect.height / 2;
  const scale = Math.max(Number(mind.scaleVal) || 1, 0.00001);
  const elements = contentElements(mind);

  if (!elements.length) return false;

  const bounds = {
    left: Infinity,
    right: -Infinity,
    top: Infinity,
    bottom: -Infinity,
  };

  elements.forEach((element) => {
    const rect = element.getBoundingClientRect();

    bounds.left = Math.min(bounds.left, (rect.left - rootX) / scale);
    bounds.right = Math.max(bounds.right, (rect.right - rootX) / scale);
    bounds.top = Math.min(bounds.top, (rect.top - rootY) / scale);
    bounds.bottom = Math.max(bounds.bottom, (rect.bottom - rootY) / scale);
  });

  const plan = planMindMapViewport({
    width: viewport.width,
    height: viewport.height,
    bounds,
    direction: mind.direction,
    single: !mind.nodeData?.children?.length,
    padding,
  });

  if (!plan) return false;

  mind.scaleMin = Math.min(Number(mind.scaleMin) || 0.1, plan.scale);
  mind.map.style.transition = "none";
  mind.scale(plan.scale);

  const updatedRoot = root.getBoundingClientRect();
  const dx =
    viewport.left + plan.rootX -
    (updatedRoot.left + updatedRoot.width / 2);
  const dy =
    viewport.top + plan.rootY -
    (updatedRoot.top + updatedRoot.height / 2);

  const matrix = new DOMMatrixReadOnly(
    getComputedStyle(mind.map).transform
  );

  // 保持引擎使用的 translate3d + scale 结构。
  mind.map.style.transform =
    `translate3d(${matrix.m41 + dx}px, ${matrix.m42 + dy}px, 0) ` +
    `scale(${mind.scaleVal})`;

  return true;
}

export const focusMindMapViewportMixin = {
  watch: {
    fullscreenVisible(value) {
      this.fwStop();

      if (!value) return;

      const state = {
        frame: 0,
        timer: null,
        resize: null,
        host: null,
        manual: false,
        attempts: 0,
        disposeInput: null,
      };

      this._fwState = state;

      const seek = () => {
        if (this._fwState !== state || !this.fullscreenVisible) return;

        const host = this.$refs.editorCanvas;
        const mind = this.fmmxMind?.();

        if (!host || !mind?.nodes || !rootTopic(mind)) {
          state.attempts++;
          if (state.attempts < 180) {
            state.frame = requestAnimationFrame(seek);
          }
          return;
        }

        state.host = host;

        const markManual = (event) => {
          if (!event.isTrusted) return;
          state.manual = true;
          clearTimeout(state.timer);
        };

        host.addEventListener("pointerdown", markManual, true);
        host.addEventListener("wheel", markManual, {
          capture: true,
          passive: true,
        });
        host.addEventListener("keydown", markManual, true);

        state.disposeInput = () => {
          host.removeEventListener("pointerdown", markManual, true);
          host.removeEventListener("wheel", markManual, true);
          host.removeEventListener("keydown", markManual, true);
        };

        state.resize = new ResizeObserver(() => {
          if (!state.manual) this.fwQueue();
        });
        state.resize.observe(host);

        this.fwQueue();

        document.fonts?.ready?.then(() => {
          if (this._fwState === state && !state.manual) this.fwQueue();
        });
      };

      this.$nextTick(seek);
    },

    activeSkeletonId() {
      if (!this.fullscreenVisible || !this._fwState) return;
      this._fwState.manual = false;
      this.fwQueue();
    },

    inspectorVisible() {
      if (!this._fwState?.manual) this.$nextTick(this.fwQueue);
    },

    fmmaOutlineOpen() {
      if (!this._fwState?.manual) this.$nextTick(this.fwQueue);
    },
  },

  beforeUnmount() {
    this.fwStop();
  },

  methods: {
    fwQueue() {
      const state = this._fwState;
      if (!state || !this.fullscreenVisible || state.manual) return;

      clearTimeout(state.timer);

      state.timer = setTimeout(() => {
        if (
          this._fwState === state &&
          this.fullscreenVisible &&
          !state.manual
        ) {
          this.fwFit();
        }
      }, 100);
    },

    fwFit() {
      if (!this.fullscreenVisible) return false;

      const mind = this.fmmxMind?.();
      const fitted = fitFocusMindMap(mind, {
        host: this.$refs.editorCanvas,
        padding: 48,
      });

      if (fitted) this.scale = mind.scaleVal;
      return fitted;
    },

    fwFitRequested() {
      if (this._fwState) this._fwState.manual = false;
      const fitted = this.fwFit();
      this.fwQueue();
      return fitted;
    },

    fwStop() {
      const state = this._fwState;
      this._fwState = null;

      if (!state) return;

      clearTimeout(state.timer);
      cancelAnimationFrame(state.frame);
      state.resize?.disconnect();
      state.disposeInput?.();
    },
  },
};
