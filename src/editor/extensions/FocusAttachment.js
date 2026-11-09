/* FOCUS_ATTACHMENT_20261109_V1：本地附件块（参考语雀附件卡片）
 * 只记录文件路径，不复制、不存储文件内容：
 *   单击 → 在 Finder 中显示（选中该文件）   双击 / ↗ → 用默认应用打开
 *   复制路径 · 文件被移动后显示「找不到文件」并可「重新定位」 · 移除附件不会删除本地文件
 */
import { Node } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import "./focusAttachment.css";
import {
  attachmentsSupported,
  baseName,
  dirName,
  extOf,
  kindOf,
  formatBytes,
  shortPath,
  homeDir,
  statPath,
  revealPath,
  openPath,
  pickFiles,
  pathForFile,
} from "../attachmentBridge";

const CLICK_DELAY = 240;

const ICONS = {
  open: '<svg viewBox="0 0 16 16"><path d="M9 3h4v4M13 3 7.5 8.5M11.5 9.5V12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1h2.5"/></svg>',
  copy: '<svg viewBox="0 0 16 16"><rect x="5" y="5" width="8" height="8" rx="1.5"/><path d="M3 10.5v-6A1.5 1.5 0 0 1 4.5 3h6"/></svg>',
  remove: '<svg viewBox="0 0 16 16"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/></svg>',
  folder: '<svg viewBox="0 0 24 24"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.6l2 2h7.4A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5Z"/></svg>',
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function toAttachmentAttrs(item) {
  const path = String(item?.path || "");
  return {
    path,
    name: String(item?.name || baseName(path)),
    size: Number.isFinite(item?.size) ? item.size : null,
    isDirectory: Boolean(item?.isDirectory),
    addedAt: new Date().toISOString(),
  };
}

export function insertAttachments(editor, items, position) {
  const nodes = (items || [])
    .filter((item) => item && item.path)
    .map((item) => ({ type: "focusAttachment", attrs: toAttachmentAttrs(item) }));
  if (!editor || !nodes.length) return false;

  const content = [...nodes, { type: "paragraph" }];
  const chain = editor.chain().focus();
  if (Number.isFinite(position)) chain.insertContentAt(position, content).run();
  else chain.insertContent(content).run();
  return true;
}

export async function pickAndInsertAttachments(editor) {
  if (!attachmentsSupported()) {
    window.alert("附件功能仅在 WeekToDo 桌面版中可用。");
    return;
  }
  try {
    const files = await pickFiles({ multiple: true });
    if (files && files.length) insertAttachments(editor, files);
    else editor?.commands.focus();
  } catch (error) {
    console.error(error);
    window.alert(error?.message || "添加附件失败，请重试。");
  }
}

class AttachmentView {
  constructor(node, editor, getPos) {
    this.node = node;
    this.editor = editor;
    this.getPos = getPos;
    this.status = null;
    this.home = undefined;
    this.flashTimer = 0;
    this.clickTimer = 0;
    this.actsKey = "";

    const dom = document.createElement("div");
    dom.className = "fa-card";
    dom.contentEditable = "false";
    dom.dataset.type = "focus-attachment";
    dom.innerHTML =
      '<span class="fa-badge" aria-hidden="true"></span>' +
      '<span class="fa-main"><span class="fa-name"></span><span class="fa-meta"></span></span>' +
      '<span class="fa-acts"></span>';

    this.dom = dom;
    this.badge = dom.querySelector(".fa-badge");
    this.nameEl = dom.querySelector(".fa-name");
    this.metaEl = dom.querySelector(".fa-meta");
    this.acts = dom.querySelector(".fa-acts");

    this.onClick = this.onClick.bind(this);
    this.onDblClick = this.onDblClick.bind(this);
    this.onWindowFocus = () => this.refresh();

    dom.addEventListener("click", this.onClick);
    dom.addEventListener("dblclick", this.onDblClick);
    window.addEventListener("focus", this.onWindowFocus);

    this.render();
    this.refresh();
  }

  get attrs() {
    return this.node.attrs;
  }

  get isDirectory() {
    return Boolean(this.attrs.isDirectory || this.status?.isDirectory);
  }

  get missing() {
    return Boolean(this.status && this.status.exists === false);
  }

  render() {
    const a = this.attrs;
    const name = a.name || baseName(a.path) || "未命名附件";
    const kind = kindOf(extOf(name), this.isDirectory);

    this.badge.dataset.tone = kind.tone;
    this.badge.innerHTML = kind.tone === "folder" ? ICONS.folder : `<b>${escapeHtml(kind.label)}</b>`;
    this.nameEl.textContent = name;
    this.dom.classList.toggle("is-missing", this.missing);
    this.dom.title = !attachmentsSupported()
      ? a.path
      : this.missing
        ? `找不到文件：${a.path}`
        : `${a.path}\n单击在 Finder 中显示 · 双击打开`;

    if (!this.flashTimer) this.metaEl.textContent = this.metaText();
    this.renderActions();
  }

  metaText() {
    const a = this.attrs;
    if (!attachmentsSupported()) return `${a.path} · 仅桌面版可打开`;
    if (this.missing) return "找不到文件 · 可能已被移动、重命名或删除";

    const parts = [shortPath(dirName(a.path), this.home)];
    if (this.isDirectory) parts.push("文件夹");
    else {
      const size = this.status?.size ?? a.size;
      if (Number.isFinite(size)) parts.push(formatBytes(size));
    }
    return parts.filter(Boolean).join(" · ");
  }

  renderActions() {
    const editable = this.editor.isEditable;
    const buttons = [];
    if (this.missing) {
      if (editable) buttons.push(["relink", "重新定位", null]);
    } else if (attachmentsSupported()) {
      buttons.push(["open", this.isDirectory ? "打开文件夹" : "用默认应用打开", ICONS.open]);
    }
    buttons.push(["copy", "复制路径", ICONS.copy]);
    if (editable) buttons.push(["remove", "移除附件（不会删除本地文件）", ICONS.remove]);

    const key = buttons.map((b) => b[0]).join(",") + (editable ? "|e" : "");
    if (key === this.actsKey) return;
    this.actsKey = key;

    this.acts.innerHTML = buttons
      .map(([act, title, icon]) =>
        icon
          ? `<button type="button" class="fa-btn" data-act="${act}" title="${title}" aria-label="${title}">${icon}</button>`
          : `<button type="button" class="fa-btn is-text" data-act="${act}" title="选择文件的新位置">${title}</button>`
      )
      .join("");
  }

  async refresh() {
    if (!attachmentsSupported() || !this.attrs.path) return;
    if (this.home === undefined) {
      this.home = null;
      homeDir().then((home) => {
        if (this.destroyed) return;
        this.home = home;
        this.render();
      });
    }
    const status = await statPath(this.attrs.path);
    if (this.destroyed || !status) return;
    this.status = status;
    this.render();
  }

  flash(text) {
    clearTimeout(this.flashTimer);
    this.metaEl.textContent = text;
    this.metaEl.classList.add("is-flash");
    this.flashTimer = setTimeout(() => {
      this.flashTimer = 0;
      this.metaEl.classList.remove("is-flash");
      this.render();
    }, 1800);
  }

  onClick(event) {
    const button = event.target.closest("button[data-act]");
    if (button) {
      event.preventDefault();
      event.stopPropagation();
      this.run(button.dataset.act);
      return;
    }
    if (event.detail > 1) return;
    clearTimeout(this.clickTimer);
    this.clickTimer = setTimeout(() => this.run(this.missing ? "noop" : "reveal"), CLICK_DELAY);
  }

  onDblClick(event) {
    if (event.target.closest("button")) return;
    clearTimeout(this.clickTimer);
    if (!this.missing) this.run("open");
  }

  pos() {
    const p = typeof this.getPos === "function" ? this.getPos() : null;
    return Number.isInteger(p) ? p : null;
  }

  markMissing() {
    this.status = { exists: false };
    this.render();
  }

  async run(act) {
    const path = this.attrs.path;

    if (act === "copy") {
      try {
        await navigator.clipboard.writeText(path);
        this.flash("已复制路径");
      } catch {
        this.flash("复制失败，请检查剪贴板权限");
      }
      return;
    }

    if (act === "remove") {
      const pos = this.pos();
      if (pos === null) return;
      this.editor.view.dispatch(this.editor.state.tr.delete(pos, pos + this.node.nodeSize));
      this.editor.commands.focus();
      return;
    }

    if (act === "noop") return;
    if (!attachmentsSupported()) {
      this.run("copy");
      return;
    }

    try {
      if (act === "reveal") {
        const result = await revealPath(path);
        if (result?.missing) this.markMissing();
        return;
      }

      if (act === "open") {
        const result = await openPath(path);
        if (result?.missing) this.markMissing();
        else if (result?.blocked) this.flash("出于安全考虑，可执行文件只在 Finder 中显示");
        else if (result?.error) this.flash(`无法打开：${result.error}`);
        return;
      }

      if (act === "relink") {
        const files = await pickFiles({ multiple: false, defaultPath: dirName(path) });
        const file = files && files[0];
        const pos = this.pos();
        if (!file || pos === null) return;
        this.editor.view.dispatch(
          this.editor.state.tr.setNodeMarkup(pos, undefined, {
            ...this.attrs,
            ...toAttachmentAttrs(file),
            addedAt: this.attrs.addedAt || new Date().toISOString(),
          })
        );
      }
    } catch (error) {
      console.error("[attachment]", error);
      this.flash(error?.message || "操作失败");
    }
  }

  update(node) {
    if (node.type !== this.node.type) return false;
    const pathChanged = node.attrs.path !== this.node.attrs.path;
    this.node = node;
    if (pathChanged) {
      this.status = null;
      this.refresh();
    }
    this.render();
    return true;
  }

  selectNode() {
    this.dom.classList.add("is-selected");
  }

  deselectNode() {
    this.dom.classList.remove("is-selected");
  }

  stopEvent(event) {
    return Boolean(event.target?.closest?.("button"));
  }

  ignoreMutation() {
    return true;
  }

  destroy() {
    this.destroyed = true;
    clearTimeout(this.flashTimer);
    clearTimeout(this.clickTimer);
    this.dom.removeEventListener("click", this.onClick);
    this.dom.removeEventListener("dblclick", this.onDblClick);
    window.removeEventListener("focus", this.onWindowFocus);
  }
}

function filesWithPaths(fileList) {
  return Array.from(fileList || [])
    .filter((file) => !String(file.type || "").startsWith("image/"))
    .map((file) => ({ path: pathForFile(file), name: file.name, size: file.size }))
    .filter((item) => item.path);
}

export default Node.create({
  name: "focusAttachment",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      path: { default: "", rendered: false },
      name: { default: "", rendered: false },
      size: { default: null, rendered: false },
      isDirectory: { default: false, rendered: false },
      addedAt: { default: null, rendered: false },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="focus-attachment"]',
        getAttrs: (el) => ({
          path: el.getAttribute("data-path") || "",
          name: el.getAttribute("data-name") || "",
          isDirectory: el.getAttribute("data-dir") === "true",
        }),
      },
    ];
  },

  renderHTML({ node }) {
    const name = node.attrs.name || baseName(node.attrs.path);
    return [
      "div",
      {
        "data-type": "focus-attachment",
        "data-path": node.attrs.path,
        "data-name": name,
        "data-dir": String(Boolean(node.attrs.isDirectory)),
      },
      `📎 ${name}`,
    ];
  },

  renderText({ node }) {
    return `📎 ${node.attrs.name || baseName(node.attrs.path)}（${node.attrs.path}）`;
  },

  renderMarkdown(node) {
    const a = node?.attrs || {};
    const name = a.name || baseName(a.path) || "附件";
    return `[📎 ${name}](${encodeURI("file://" + String(a.path || ""))})`;
  },

  addNodeView() {
    return ({ node, editor, getPos }) => new AttachmentView(node, editor, getPos);
  },

  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: new PluginKey("focusAttachmentDrop"),
        props: {
          /* 编辑器自身的 handleDrop 只处理图片；非图片文件（含文件夹）落到这里成为附件 */
          handleDrop(view, event, _slice, moved) {
            if (moved || !attachmentsSupported()) return false;
            const items = filesWithPaths(event.dataTransfer?.files);
            if (!items.length) return false;
            event.preventDefault();
            const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
            return insertAttachments(editor, items, pos);
          },
          handlePaste(_view, event) {
            if (!attachmentsSupported()) return false;
            const items = filesWithPaths(event.clipboardData?.files);
            if (!items.length) return false;
            event.preventDefault();
            return insertAttachments(editor, items);
          },
        },
      }),
    ];
  },
});
