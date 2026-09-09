/* FOCUS_UI_SYSTEM_20260909_V4 */

/**
 * v-tip 提示指令。
 *
 * 用法：
 *   v-tip="'加粗'"
 *   v-tip="{ label: '加粗', keys: '⌘B', placement: 'bottom' }"
 *
 * 设计取舍：
 * - 首次悬停延时 90ms（原生 title 在 macOS 上要 1~2 秒，是"没有提示"的根因）。
 * - 350ms 内在相邻控件间移动时零延迟切换，工具栏扫视手感连贯。
 * - 全局复用同一个 DOM 节点，不随按钮数量增长。
 * - mousedown / 滚动 / 失焦立刻隐藏，避免提示压住刚打开的浮层。
 */

const OPEN_DELAY = 90;
const WARM_WINDOW = 350;
const GAP = 8;
const EDGE = 8;

let tipEl = null;
let labelEl = null;
let keysEl = null;
let openTimer = null;
let lastHideAt = 0;
let activeTarget = null;
let listenersBound = false;

function normalize(value) {
  if (!value) return null;

  if (typeof value === "string") {
    return { label: value, keys: "", placement: "bottom" };
  }

  return {
    label: value.label || "",
    keys: value.keys || "",
    placement: value.placement || "bottom",
  };
}

function ensureElement() {
  if (tipEl) return;

  tipEl = document.createElement("div");
  tipEl.className = "app-tip";
  tipEl.setAttribute("role", "tooltip");

  labelEl = document.createElement("span");
  labelEl.className = "app-tip-label";

  keysEl = document.createElement("kbd");
  keysEl.className = "app-tip-keys";

  tipEl.appendChild(labelEl);
  tipEl.appendChild(keysEl);
  document.body.appendChild(tipEl);
}

function bindGlobalListeners() {
  if (listenersBound) return;

  listenersBound = true;

  window.addEventListener("mousedown", hide, true);
  window.addEventListener("wheel", hide, { passive: true, capture: true });
  window.addEventListener("scroll", hide, true);
  window.addEventListener("blur", hide);
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hide();
  });
}

function place(target, placement) {
  const anchor = target.getBoundingClientRect();
  const box = tipEl.getBoundingClientRect();

  let top =
    placement === "top"
      ? anchor.top - box.height - GAP
      : anchor.bottom + GAP;

  // 贴近视口边缘时自动翻面，不让提示被裁掉。
  if (placement !== "top" && top + box.height > window.innerHeight - EDGE) {
    top = anchor.top - box.height - GAP;
  }

  if (top < EDGE) top = anchor.bottom + GAP;

  let left = anchor.left + anchor.width / 2 - box.width / 2;

  left = Math.max(
    EDGE,
    Math.min(window.innerWidth - box.width - EDGE, left)
  );

  tipEl.style.top = Math.round(top) + "px";
  tipEl.style.left = Math.round(left) + "px";
}

function show(target, options) {
  if (!options || !options.label) return;

  ensureElement();

  labelEl.textContent = options.label;
  keysEl.textContent = options.keys || "";
  keysEl.style.display = options.keys ? "" : "none";

  tipEl.style.visibility = "hidden";
  tipEl.classList.add("is-visible");

  // 先渲染再量尺寸，否则拿不到正确的 box。
  requestAnimationFrame(() => {
    if (!tipEl.classList.contains("is-visible")) return;

    place(target, options.placement);
    tipEl.style.visibility = "visible";
  });

  activeTarget = target;
}

function hide() {
  clearTimeout(openTimer);
  openTimer = null;

  if (tipEl && tipEl.classList.contains("is-visible")) {
    tipEl.classList.remove("is-visible");
    tipEl.style.visibility = "hidden";
    lastHideAt = Date.now();
  }

  activeTarget = null;
}

function attach(el, options) {
  el.__tipOptions = options;

  if (el.__tipBound) return;

  el.__tipBound = true;

  el.addEventListener("mouseenter", () => {
    const current = el.__tipOptions;
    if (!current) return;

    clearTimeout(openTimer);

    const warm = Date.now() - lastHideAt < WARM_WINDOW;

    if (warm) {
      show(el, current);
      return;
    }

    openTimer = setTimeout(() => show(el, current), OPEN_DELAY);
  });

  el.addEventListener("mouseleave", hide);
  el.addEventListener("mousedown", hide);
  el.addEventListener("focusout", hide);

  // 键盘可达性：Tab 聚焦时也给出提示。
  el.addEventListener("focusin", (event) => {
    if (event.target !== el) return;
    const current = el.__tipOptions;
    if (current) show(el, current);
  });
}

export const tip = {
  mounted(el, binding) {
    bindGlobalListeners();

    const options = normalize(binding.value);
    if (!options) return;

    // 有自绘提示就不要再让系统 title 重复弹一次。
    if (el.hasAttribute("title")) el.removeAttribute("title");
    if (!el.getAttribute("aria-label")) {
      el.setAttribute("aria-label", options.label);
    }

    attach(el, options);
  },

  updated(el, binding) {
    const options = normalize(binding.value);
    el.__tipOptions = options;

    if (options && !el.getAttribute("aria-label")) {
      el.setAttribute("aria-label", options.label);
    }

    if (activeTarget === el && options) show(el, options);
  },

  beforeUnmount(el) {
    if (activeTarget === el) hide();
    el.__tipOptions = null;
  },
};

export default tip;

/* 样式随指令一起注入，避免使用方各自复制一份。 */
if (typeof document !== "undefined" && !document.getElementById("app-tip-style")) {
  const style = document.createElement("style");

  style.id = "app-tip-style";
  style.textContent = `
.app-tip {
  position: fixed;
  z-index: 30000;
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 260px;
  padding: 5px 8px;
  border-radius: 7px;
  background: rgba(32, 37, 45, 0.95);
  color: #f2f4f7;
  font-size: 11.5px;
  line-height: 1.45;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  box-shadow: 0 6px 20px rgba(16, 20, 26, 0.24);
  transform: translateY(-2px);
  transition: opacity 0.11s ease, transform 0.11s ease;
}

.app-tip.is-visible {
  opacity: 1;
  transform: translateY(0);
}

.app-tip-keys {
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.13);
  color: #c9cfd8;
  font-family: inherit;
  font-size: 10.5px;
  letter-spacing: 0.02em;
}
`;

  document.head.appendChild(style);
}
