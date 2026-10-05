import MindElixir from "mind-elixir";
import { planMindMapViewport } from "../../services/focusMindMapViewport.mjs";

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

  if (!host || !mind?.map || !mind?.nodes || state?.busy) return;

  const container = mind.container;
  const viewport = container.getBoundingClientRect();
  const root = rootTopic(mind);

  if (!root || viewport.width < 60 || viewport.height < 60) return;

  const rootRect = root.getBoundingClientRect();
  const rootCenterX = rootRect.left + rootRect.width / 2;
  const rootCenterY = rootRect.top + rootRect.height / 2;
  const currentScale = Math.max(Number(mind.scaleVal) || 1, 0.00001);
  const elements = measurableElements(mind);

  if (!elements.length) return;

  const bounds = {
    left: Infinity,
    top: Infinity,
    right: -Infinity,
    bottom: -Infinity,
  };

  elements.forEach((element) => {
    const rect = element.getBoundingClientRect();
    bounds.left = Math.min(
      bounds.left,
      (rect.left - rootCenterX) / currentScale
    );
    bounds.right = Math.max(
      bounds.right,
      (rect.right - rootCenterX) / currentScale
    );
    bounds.top = Math.min(
      bounds.top,
      (rect.top - rootCenterY) / currentScale
    );
    bounds.bottom = Math.max(
      bounds.bottom,
      (rect.bottom - rootCenterY) / currentScale
    );
  });

  const plan = planMindMapViewport({
    width: viewport.width,
    height: viewport.height,
    bounds,
    direction: mind.direction,
    single: !mind.nodeData?.children?.length,
    padding: Math.max(16, Math.min(28, viewport.width * 0.04)),
  });

  if (!plan) return;

  if (state) state.busy = true;

  try {
    // 预览允许低于编辑画布的缩放下限，以完整展示大脑图。
    mind.scaleMin = Math.min(
      Number(mind.scaleMin) || 0.1,
      plan.scale
    );

    mind.map.style.transition = "none";
    mind.scale(plan.scale);

    const nextRoot = root.getBoundingClientRect();
    const dx =
      viewport.left + plan.rootX -
      (nextRoot.left + nextRoot.width / 2);
    const dy =
      viewport.top + plan.rootY -
      (nextRoot.top + nextRoot.height / 2);

    // 只读预览需要精确取景，不采用编辑模式的拖动边界限制。
    const matrix = new DOMMatrixReadOnly(
      getComputedStyle(mind.map).transform
    );

    mind.map.style.transform =
      `translate3d(${matrix.m41 + dx}px, ` +
      `${matrix.m42 + dy}px, 0) scale(${plan.scale})`;
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
