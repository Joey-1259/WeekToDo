/*
 * 图片块（参考 Notion / 语雀）
 *
 * 交互：
 *   · 单击选中（蓝色描边 + 浮动工具条）；双击，或选中后按空格 → 查看大图；
 *     只读模式单击即预览。
 *   · 悬停或选中时左右边缘出现拖拽手柄；居中图片两侧对称缩放。
 *     吸附 25 / 33 / 50 / 67 / 75 / 100% 与原始尺寸，按住 ⌥ 关闭吸附，Esc 取消。
 *     拖拽中只改 DOM，松手时一次事务写入 → 一次 ⌘Z 即可还原。
 *     双击手柄 → 原始大小。
 *   · 工具条：对齐（满宽时隐藏）/ 原始大小 / 适应宽度 / 图片说明 / 查看大图 / 删除。
 *
 * 数据：width 以百分比保存（相对正文宽度），分栏、沉浸模式与导出按比例还原；
 *       历史 "100%" / "320px" 照常读取。新增 align / caption，旧文档缺省居中、无说明。
 *       仅 assetId 变化时才重新读取图片，调整尺寸不会闪烁。
 */
import { Node, mergeAttributes } from "@tiptap/core";
import { NodeSelection, Selection, TextSelection } from "@tiptap/pm/state";
import focusAssetRepository from "../../repositories/focusAssetRepository";
import "./focusImage.css";

const MIN_WIDTH_PX = 48;
const SNAP_POINTS = [25, 100 / 3, 50, 200 / 3, 75, 100];
const SNAP_DISTANCE_PX = 6;
const ALIGNS = ["left", "center", "right"];
const ALIGN_LABELS = { left: "左对齐", center: "居中", right: "右对齐" };

const ICONS = {
  left: '<path d="M2.5 4h11M2.5 8h7M2.5 12h11" />',
  center: '<path d="M2.5 4h11M4.5 8h7M2.5 12h11" />',
  right: '<path d="M2.5 4h11M6.5 8h7M2.5 12h11" />',
  fit: '<path d="M2 3v10M14 3v10M4.5 8h7M6.5 6 4.5 8l2 2M9.5 6l2 2-2 2" />',
  caption: '<rect x="2.5" y="2.5" width="11" height="7.5" rx="1.5" /><path d="M4.5 13h7" />',
  preview: '<path d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5 9.25 6.75M2.5 13.5l4.25-4.25" />',
  remove: '<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.2c.05.7.6 1.3 1.3 1.3h3.2c.7 0 1.25-.6 1.3-1.3l.6-8.2" />',
};

export function normalizeImageAlign(value) {
  return ALIGNS.includes(value) ? value : "center";
}

/** 宽度 → 百分比 (0, 100]。百分比直接读；像素按容器宽度换算；无法识别按 100。 */
export function imageWidthPercent(value, containerPx = 0) {
  const raw = String(value ?? "").trim();
  const number = Number.parseFloat(raw);

  if (!Number.isFinite(number) || number <= 0) return 100;
  if (raw.endsWith("%")) return Math.min(number, 100);
  if (containerPx > 0) return Math.min(100, (number / containerPx) * 100);
  return 100;
}

function formatPercent(percent) {
  const clamped = Math.min(100, Math.max(1, percent));
  return `${Math.round(clamped * 10) / 10}%`;
}

function scrollParent(element) {
  for (let node = element?.parentElement; node; node = node.parentElement) {
    const { overflowY } = window.getComputedStyle(node);
    if (overflowY === "auto" || overflowY === "scroll") return node;
  }
  return null;
}

function openPreview(editor, attrs) {
  window.dispatchEvent(
    new CustomEvent("focus-image-preview", {
      detail: { ...attrs, sourceEditor: editor },
    })
  );
}

function el(tag, className, attrs = {}) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  return node;
}

function iconButton(icon, label, extraClass = "") {
  const button = el("button", `fi-btn ${extraClass}`.trim(), {
    type: "button",
    title: label,
    "aria-label": label,
  });
  button.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true">${ICONS[icon]}</svg>`;
  return button;
}

export default Node.create({
  name: "focusImage",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      assetId: { default: null },
      alt: { default: "" },
      title: { default: "" },
      width: { default: "100%" },
      originalWidth: { default: null },
      originalHeight: { default: null },
      align: {
        default: "center",
        parseHTML: (element) => normalizeImageAlign(element.getAttribute("data-align")),
        renderHTML: (attrs) => ({ "data-align": normalizeImageAlign(attrs.align) }),
      },
      caption: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-caption") || "",
        renderHTML: (attrs) => (attrs.caption ? { "data-caption": attrs.caption } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'figure[data-type="focus-image"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["figure", mergeAttributes(HTMLAttributes, { "data-type": "focus-image" })];
  },

  addKeyboardShortcuts() {
    return {
      /* 选中图片后按空格查看大图（Notion 同款）。 */
      Space: () => {
        const { selection } = this.editor.state;
        if (!(selection instanceof NodeSelection) || selection.node.type.name !== this.name) {
          return false;
        }
        openPreview(this.editor, selection.node.attrs);
        return true;
      },
    };
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      let current = node;
      let objectUrl = null;
      let loadToken = 0;
      let captionOpen = false;
      let drag = null;

      /* ---------- DOM ---------- */

      const dom = el("figure", "focus-img", { "data-type": "focus-image" });
      dom.contentEditable = "false";

      const frame = el("div", "fi-frame");
      const image = el("img", "fi-img", { draggable: "false" });
      const status = el("span", "fi-status");
      const handleLeft = el("span", "fi-handle is-left", { "aria-hidden": "true" });
      const handleRight = el("span", "fi-handle is-right", { "aria-hidden": "true" });
      const badge = el("span", "fi-badge", { "aria-hidden": "true" });

      const bar = el("div", "fi-bar", { role: "toolbar", "aria-label": "图片" });
      const alignGroup = el("div", "fi-group fi-align");
      const alignButtons = Object.fromEntries(
        ALIGNS.map((key) => [key, iconButton(key, ALIGN_LABELS[key])])
      );
      alignGroup.append(...Object.values(alignButtons), el("span", "fi-sep"));

      const naturalButton = el("button", "fi-btn", {
        type: "button",
        title: "原始大小",
        "aria-label": "原始大小",
      });
      naturalButton.textContent = "1:1";

      const fitButton = iconButton("fit", "适应宽度");
      const captionButton = iconButton("caption", "图片说明");
      const previewButton = iconButton("preview", "查看大图（空格）");
      const removeButton = iconButton("remove", "删除图片", "is-danger");

      bar.append(
        alignGroup,
        naturalButton,
        fitButton,
        el("span", "fi-sep"),
        captionButton,
        previewButton,
        el("span", "fi-sep"),
        removeButton
      );

      const caption = el("input", "fi-caption", {
        type: "text",
        placeholder: "添加图片说明",
        maxlength: "200",
        spellcheck: "false",
        "aria-label": "图片说明",
      });

      frame.append(image, status, handleLeft, handleRight, badge, bar);
      dom.append(frame, caption);

      /* ---------- 文档读写 ---------- */

      const position = () => {
        if (typeof getPos !== "function") return null;
        const pos = getPos();
        return Number.isInteger(pos) ? pos : null;
      };

      const liveNode = (pos) => {
        const found = editor.state.doc.nodeAt(pos);
        return found && found.type.name === "focusImage" ? found : null;
      };

      const setAttrs = (patch, { select = true } = {}) => {
        const pos = position();
        if (pos === null) return;
        const live = liveNode(pos);
        if (!live) return;

        const tr = editor.state.tr.setNodeMarkup(pos, undefined, { ...live.attrs, ...patch });
        if (select) tr.setSelection(NodeSelection.create(tr.doc, pos));
        editor.view.dispatch(tr);
      };

      const selectSelf = () => {
        const pos = position();
        if (pos === null) return;
        editor.view.dispatch(
          editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pos))
        );
        editor.view.focus();
      };

      const remove = () => {
        const pos = position();
        if (pos === null) return;
        const live = liveNode(pos);
        if (!live) return;

        const { state } = editor;
        const tr = state.tr;
        const end = pos + live.nodeSize;

        if (state.doc.resolve(pos).parent.childCount === 1) {
          tr.replaceWith(pos, end, state.schema.nodes.paragraph.create());
        } else {
          tr.delete(pos, end);
        }

        tr.setSelection(Selection.near(tr.doc.resolve(Math.min(pos, tr.doc.content.size))));
        editor.view.dispatch(tr.scrollIntoView());
        editor.view.focus();
      };

      const moveAfter = () => {
        const pos = position();
        if (pos === null) return;
        const live = liveNode(pos);
        if (!live) return;

        const { state } = editor;
        const after = pos + live.nodeSize;
        const next = state.doc.nodeAt(after);
        const tr = state.tr;

        if (!next || !next.isTextblock) tr.insert(after, state.schema.nodes.paragraph.create());
        tr.setSelection(TextSelection.create(tr.doc, after + 1)).scrollIntoView();
        editor.view.dispatch(tr);
        editor.view.focus();
      };

      /* ---------- 尺寸 ---------- */

      const containerWidth = () => dom.clientWidth || dom.getBoundingClientRect().width || 0;

      const naturalPercent = () => {
        const natural = Number(current.attrs.originalWidth) || image.naturalWidth || 0;
        const box = containerWidth();
        return natural > 0 && box > 0 ? Math.min(100, (natural / box) * 100) : null;
      };

      /* ---------- 渲染 ---------- */

      const render = () => {
        const attrs = current.attrs;
        const align = normalizeImageAlign(attrs.align);
        const raw = String(attrs.width || "100%").trim();
        const percent = imageWidthPercent(raw, containerWidth());
        const editable = editor.isEditable;

        dom.dataset.align = align;
        if (!drag) frame.style.width = /px$/.test(raw) ? raw : formatPercent(percent);
        dom.classList.toggle("is-full", percent >= 99.5);

        image.alt = attrs.alt || "";

        Object.entries(alignButtons).forEach(([key, button]) =>
          button.setAttribute("aria-pressed", String(key === align))
        );

        const natural = naturalPercent();
        naturalButton.disabled = natural === null || Math.abs(natural - percent) < 0.5;
        fitButton.disabled = percent >= 99.5;

        const text = attrs.caption || "";
        if (document.activeElement !== caption) caption.value = text;
        caption.readOnly = !editable;
        caption.hidden = !(text || (captionOpen && editable));
        captionButton.setAttribute("aria-pressed", String(!caption.hidden));
      };

      /* ---------- 加载 ---------- */

      const releaseUrl = () => {
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
          objectUrl = null;
        }
      };

      const setState = (state, message = "") => {
        dom.classList.toggle("is-loading", state === "loading");
        dom.classList.toggle("is-missing", state === "missing");
        status.hidden = state === "ready";
        status.textContent = message;

        const w = Number(current.attrs.originalWidth);
        const h = Number(current.attrs.originalHeight);
        frame.style.aspectRatio = state === "loading" && w > 0 && h > 0 ? `${w} / ${h}` : "";
      };

      const load = async () => {
        const token = ++loadToken;
        const { assetId } = current.attrs;

        releaseUrl();
        image.removeAttribute("src");
        setState("loading", "正在加载图片…");

        if (!assetId) {
          setState("missing", "图片数据无效");
          return;
        }

        try {
          const { url } = await focusAssetRepository.getObjectUrl(assetId);
          if (token !== loadToken) {
            URL.revokeObjectURL(url);
            return;
          }
          objectUrl = url;
          image.src = url;
        } catch {
          if (token === loadToken) setState("missing", "图片文件不存在，可能已被清理");
        }
      };

      image.addEventListener("load", () => {
        if (!image.getAttribute("src")) return;
        setState("ready");
        render();
      });

      image.addEventListener("error", () => {
        if (image.getAttribute("src")) setState("missing", "图片无法显示");
      });

      /* ---------- 拖拽缩放 ---------- */

      const snap = (percent, box, free) => {
        if (free) return { percent, label: null };

        const points = SNAP_POINTS.map((p) => ({ p, label: p === 100 ? "适应宽度" : null }));
        const natural = naturalPercent();
        if (natural !== null) points.push({ p: natural, label: "原始大小" });

        let best = null;
        points.forEach((point) => {
          const distance = (Math.abs(point.p - percent) * box) / 100;
          if (distance <= SNAP_DISTANCE_PX && (!best || distance < best.distance)) {
            best = { ...point, distance };
          }
        });

        return best ? { percent: best.p, label: best.label } : { percent, label: null };
      };

      const onDragKey = (event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        finishResize(false);
      };

      function finishResize(commit) {
        if (!drag) return;

        const { percent, handle, pointerId, initial } = drag;
        drag = null;

        try {
          handle.releasePointerCapture(pointerId);
        } catch {
          /* 已释放 */
        }

        dom.classList.remove("is-resizing");
        document.body.classList.remove("fi-resizing");
        window.removeEventListener("keydown", onDragKey, true);

        if (commit && percent !== null) {
          const next = formatPercent(percent);
          if (next !== String(current.attrs.width)) {
            setAttrs({ width: next });
            return;
          }
        }

        frame.style.width = initial;
        render();
      }

      const startResize = (side) => (event) => {
        if (!editor.isEditable || event.button !== 0) return;
        if (dom.classList.contains("is-loading") || dom.classList.contains("is-missing")) return;

        event.preventDefault();
        event.stopPropagation();

        const box = containerWidth();
        if (!box) return;

        selectSelf();

        drag = {
          side,
          box,
          startX: event.clientX,
          startPx: frame.getBoundingClientRect().width,
          initial: frame.style.width,
          percent: null,
          handle: event.currentTarget,
          pointerId: event.pointerId,
        };

        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          /* 不支持时退化为普通移动事件 */
        }

        dom.classList.add("is-resizing");
        document.body.classList.add("fi-resizing");
        window.addEventListener("keydown", onDragKey, true);
      };

      const onResizeMove = (event) => {
        if (!drag || event.pointerId !== drag.pointerId) return;

        const factor = normalizeImageAlign(current.attrs.align) === "center" ? 2 : 1;
        const direction = drag.side === "right" ? 1 : -1;
        const minPx = Math.min(MIN_WIDTH_PX, drag.box);
        const px = Math.min(
          drag.box,
          Math.max(minPx, drag.startPx + (event.clientX - drag.startX) * direction * factor)
        );

        const result = snap((px / drag.box) * 100, drag.box, event.altKey);
        drag.percent = result.percent;
        frame.style.width = formatPercent(result.percent);
        badge.textContent = result.label || `${Math.round(result.percent)}%`;
      };

      [handleLeft, handleRight].forEach((handle, index) => {
        handle.addEventListener("pointerdown", startResize(index === 0 ? "left" : "right"));
        handle.addEventListener("pointermove", onResizeMove);
        handle.addEventListener("pointerup", () => finishResize(true));
        handle.addEventListener("pointercancel", () => finishResize(false));
        handle.addEventListener("lostpointercapture", () => finishResize(true));
        handle.addEventListener("mousedown", (event) => {
          event.preventDefault();
          event.stopPropagation();
        });
        handle.addEventListener("dragstart", (event) => event.preventDefault());
        handle.addEventListener("dblclick", (event) => {
          event.preventDefault();
          event.stopPropagation();
          setAttrs({ width: formatPercent(naturalPercent() ?? 100) });
        });
      });

      /* ---------- 工具条 ---------- */

      bar.addEventListener("mousedown", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });

      Object.entries(alignButtons).forEach(([key, button]) =>
        button.addEventListener("click", () => setAttrs({ align: key }))
      );

      naturalButton.addEventListener("click", () => {
        const natural = naturalPercent();
        if (natural !== null) setAttrs({ width: formatPercent(natural) });
      });

      fitButton.addEventListener("click", () => setAttrs({ width: "100%" }));

      captionButton.addEventListener("click", () => {
        captionOpen = true;
        render();
        caption.focus();
      });

      previewButton.addEventListener("click", () => openPreview(editor, current.attrs));
      removeButton.addEventListener("click", remove);

      /* ---------- 图片说明 ---------- */

      const commitCaption = () => {
        const value = caption.value.replace(/\s+/g, " ").trim();
        if (value !== (current.attrs.caption || "")) setAttrs({ caption: value }, { select: false });
        if (!value) captionOpen = false;
        render();
      };

      caption.addEventListener("focus", () => {
        dom.draggable = false;
      });

      caption.addEventListener("blur", () => {
        dom.draggable = true;
        commitCaption();
      });

      caption.addEventListener("keydown", (event) => {
        event.stopPropagation();
        if (event.isComposing || event.keyCode === 229) return;

        if (event.key === "Escape") {
          event.preventDefault();
          caption.value = current.attrs.caption || "";
          caption.blur();
          selectSelf();
        } else if (event.key === "Enter") {
          event.preventDefault();
          caption.blur();
          moveAfter();
        }
      });

      /* ---------- 图片本身 ---------- */

      image.addEventListener("dblclick", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openPreview(editor, current.attrs);
      });

      image.addEventListener("click", (event) => {
        if (editor.isEditable) return; // 编辑态：交给 ProseMirror 选中节点
        event.preventDefault();
        event.stopPropagation();
        openPreview(editor, current.attrs);
      });

      load();
      render();

      return {
        dom,

        update(updated) {
          if (updated.type.name !== "focusImage") return false;
          const assetChanged = updated.attrs.assetId !== current.attrs.assetId;
          current = updated;
          if (assetChanged) load();
          render();
          return true;
        },

        selectNode() {
          dom.classList.add("is-selected");
          const scroller = scrollParent(dom);
          const top =
            frame.getBoundingClientRect().top -
            (scroller ? scroller.getBoundingClientRect().top : 0);
          bar.classList.toggle("is-below", top < 52);
          render();
        },

        deselectNode() {
          dom.classList.remove("is-selected");
        },

        stopEvent(event) {
          const target = event.target;
          if (!(target instanceof Element)) return false;
          return (
            bar.contains(target) ||
            target === caption ||
            target === handleLeft ||
            target === handleRight
          );
        },

        ignoreMutation() {
          return true;
        },

        destroy() {
          loadToken += 1;
          if (drag) {
            window.removeEventListener("keydown", onDragKey, true);
            document.body.classList.remove("fi-resizing");
            drag = null;
          }
          releaseUrl();
        },
      };
    };
  },
});
