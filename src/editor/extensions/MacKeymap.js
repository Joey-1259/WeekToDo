import { Extension } from "@tiptap/core";

/*
 * MAC_KEYMAP_20260923_V1
 * macOS 编辑快捷键：优先级高于 StarterKit，保证由 ProseMirror 历史栈处理。
 *   ⌘Z 撤销 / ⌘⇧Z、⌘Y 重做 / ⌘] ⌘[ 缩进 / ⌘K 链接
 */
export default Extension.create({
  name: "focusMacKeymap",
  priority: 1100,

  addOptions() {
    return { onLink: null };
  },

  addKeyboardShortcuts() {
    const undo = () => {
      this.editor.commands.undo?.();
      return true;
    };
    const redo = () => {
      this.editor.commands.redo?.();
      return true;
    };

    const indent = (dir) => () => {
      const e = this.editor;
      const listType = e.isActive("taskItem")
        ? "taskItem"
        : e.isActive("listItem")
          ? "listItem"
          : null;

      if (listType) {
        return dir > 0
          ? e.commands.sinkListItem(listType)
          : e.commands.liftListItem(listType);
      }

      return dir > 0
        ? Boolean(e.commands.increaseIndent?.())
        : Boolean(e.commands.decreaseIndent?.());
    };

    return {
      "Mod-z": undo,
      "Mod-Shift-z": redo,
      "Mod-y": redo,
      "Mod-]": indent(1),
      "Mod-[": indent(-1),
      "Mod-k": () => {
        if (typeof this.options.onLink === "function") {
          this.options.onLink();
          return true;
        }
        return false;
      },
    };
  },
});
