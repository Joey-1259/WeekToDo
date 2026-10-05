import MindElixir from "mind-elixir";
/* FOCUS_EXPERIENCE_20261005_V2 */
import { fitFocusMindMap } from "./focusMindMapViewportController.js";

const FLAG = "__focusPreviewFitV1";
const states = new WeakMap();

function previewHost(mind) {
  return mind?.el?.closest?.(".focus-mind-map-preview-canvas") || null;
}

function rootTopic(mind) {
  try {
    return mind.findEle(mind.nodeData.id);
  } catch {
    return mind.root?.querySelector?.("me-tpc") || mind.root;
  }
}

function measurableElements(mind) {
  const result = new Set(
    mind.nodes?.querySelectorAll(
      "me-tpc, .fmma-bd-label, .fmma-bd-rect"
    ) || []
  );

  [
    mind.lines,
    mind.summarySvg,
    mind.arrowSvg,
  ].forEach((svg) => {
    svg?.querySelectorAll?.(
      "path, rect, circle, ellipse, polygon, polyline, text"
    ).forEach((element) => result.add(element));
  });

  mind.labelContainer?.querySelectorAll?.(".svg-label")
    .forEach((element) => result.add(element));

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

export function fitMindMapPreview(mind) {
  const host = previewHost(mind);
  const state = states.get(mind);

  if (!host || state?.busy) return;

  if (state) state.busy = true;

  try {
    const width = host.getBoundingClientRect().width;

    fitFocusMindMap(mind, {
      host,
      padding: Math.max(16, Math.min(28, width * 0.04)),
    });
  } finally {
    if (state) state.busy = false;
  }
}

function queueFit(mind) {
  const state = states.get(mind);
  if (!state || state.busy) return;

  cancelAnimationFrame(state.frame);
  state.frame = requestAnimationFrame(() => {
    state.frame = requestAnimationFrame(() => {
      state.frame = 0;
      fitMindMapPreview(mind);
    });
  });
}

function attach(mind) {
  const host = previewHost(mind);
  if (!host || states.has(mind)) return;

  const state = {
    busy: false,
    frame: 0,
    resize: null,
    mutation: null,
  };

  states.set(mind, state);

  state.resize = new ResizeObserver(() => queueFit(mind));
  state.resize.observe(host);

  state.mutation = new MutationObserver(() => queueFit(mind));
  state.mutation.observe(host, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  const onImage = () => queueFit(mind);
  host.addEventListener("load", onImage, true);

  state.dispose = () => {
    cancelAnimationFrame(state.frame);
    state.resize.disconnect();
    state.mutation.disconnect();
    host.removeEventListener("load", onImage, true);
    states.delete(mind);
  };

  document.fonts?.ready?.then(() => {
    if (states.has(mind)) queueFit(mind);
  });

  queueFit(mind);
}

function install() {
  const prototype = MindElixir.prototype;
  if (prototype[FLAG]) return;

  /*
   * 项目现有增强模块也通过实例方法包装接入。
   * 所有分支均先检查 previewHost，编辑实例不会被取景覆盖。
   */
  ["linkDiv", "toCenter", "scaleFit", "scale"].forEach((name) => {
    const original = prototype[name];
    if (typeof original !== "function") return;

    prototype[name] = function (...args) {
      const result = original.apply(this, args);
      if (previewHost(this)) {
        attach(this);
        queueFit(this);
      }
      return result;
    };
  });

  const originalDestroy = prototype.destroy;
  prototype.destroy = function (...args) {
    states.get(this)?.dispose?.();
    return originalDestroy.apply(this, args);
  };

  prototype[FLAG] = true;
}

install();
