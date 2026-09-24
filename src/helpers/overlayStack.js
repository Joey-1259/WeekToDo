/* OVERLAY_STACK_20260924_V1
 *
 * 浮层栈：解决「从任意层唤起的浮层」的 z-index。
 *
 * layers.scss 是静态台账，只能保证"高于已登记的层"。
 * 但任务细节的沉浸式编辑可能从以下任意一层之上被唤起：
 *   - 每周事项里的 #toDoModal（Bootstrap，1055）
 *   - 重点事项里被抬高的关联事项弹窗（focus-linked-task-modal）
 *   - 未来任何新增的浮层
 * 固定数字注定会在某一处被压住。这里改为：挂载前量一次
 * 当前最高的可见浮层，站在它之上。
 *
 * 约定：可被叠加的自绘浮层根节点加 data-overlay-layer 属性，
 * 这样后续从它之上再唤起的浮层也能正确叠在它上面。
 */

const SCAN_SELECTOR = [
  ".modal.show",
  ".modal-backdrop",
  ".focus-dialog-backdrop",
  "[data-overlay-layer]",
].join(",");

function readZ(el) {
  const z = parseInt(window.getComputedStyle(el).zIndex, 10);
  return Number.isFinite(z) ? z : 0;
}

function isVisible(el) {
  const style = window.getComputedStyle(el);
  return style.display !== "none" && style.visibility !== "hidden";
}

/** 当前可见浮层中的最高 z-index；exclude 用于排除自身。 */
export function topOverlayZ(exclude = null) {
  if (typeof document === "undefined") return 0;

  let top = 0;

  document.querySelectorAll(SCAN_SELECTOR).forEach((el) => {
    if (exclude && (el === exclude || exclude.contains(el))) return;
    if (!isVisible(el)) return;
    top = Math.max(top, readZ(el));
  });

  return top;
}

/** 取 base 与「最高浮层 + gap」中较大者。 */
export function zAbove(base, exclude = null, gap = 10) {
  return Math.max(base, topOverlayZ(exclude) + gap);
}

/** 读取 :root 上的数值型 CSS 变量，读不到时用 fallback。 */
export function cssVarNumber(name, fallback) {
  if (typeof document === "undefined") return fallback;

  const raw = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue(name);
  const value = parseInt(raw, 10);

  return Number.isFinite(value) ? value : fallback;
}

export default { topOverlayZ, zAbove, cssVarNumber };
