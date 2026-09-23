/*
 * MAC_EDIT_SHORTCUTS_20260923_V1
 * 主进程菜单不再拦截 ⌘Z / ⌘⇧Z，这里为普通 textarea / input 提供撤销兜底。
 * contenteditable（Tiptap、Mind Elixir）由各自的键盘逻辑处理，这里跳过。
 */
export default function installMacEditShortcuts() {
  if (window.__weekTodoEditShortcuts) {
    return window.__weekTodoEditShortcuts;
  }

  const handler = (event) => {
    if (!(event.metaKey || event.ctrlKey) || event.altKey) return;

    const key = String(event.key || "").toLowerCase();
    if (key !== "z" && key !== "y") return;

    const target = event.target;
    if (!target || target.isContentEditable) return;

    const tag = target.tagName;
    const textInput =
      tag === "TEXTAREA" ||
      (tag === "INPUT" &&
        /^(text|search|url|email|tel|password|number|)$/i.test(
          target.type || ""
        ));

    if (!textInput || target.readOnly || target.disabled) return;

    event.preventDefault();
    const isRedo = key === "y" || event.shiftKey;
    document.execCommand(isRedo ? "redo" : "undo");
  };

  window.addEventListener("keydown", handler, true);

  const dispose = () => {
    window.removeEventListener("keydown", handler, true);
    window.__weekTodoEditShortcuts = null;
  };

  window.__weekTodoEditShortcuts = dispose;
  return dispose;
}
