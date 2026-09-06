import { Extension } from "@tiptap/core";
import Suggestion, {
  exitSuggestion,
} from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";

const slashKey = new PluginKey("focusSlash");
const dunhaoKey = new PluginKey("focusDunhao");

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\s\-_/、]/g, "");
}

function filterItems(items, query) {
  const keyword = normalize(query);

  if (!keyword) return items.slice(0, 10);

  return items
    .map((item) => {
      const values = [
        item.title,
        item.description,
        ...(item.aliases || []),
      ].map(normalize);

      let score = -1;

      if (values.some((value) => value === keyword)) {
        score = 300;
      } else if (
        values.some((value) => value.startsWith(keyword))
      ) {
        score = 200;
      } else if (
        values.some((value) => value.includes(keyword))
      ) {
        score = 100;
      }

      return { item, score };
    })
    .filter(({ score }) => score >= 0)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item)
    .slice(0, 10);
}

function createRenderer(pluginKey) {
  let menu = null;
  let props = null;
  let selected = 0;

  function position() {
    const rect = props?.clientRect?.();
    if (!menu || !rect) return;

    const menuHeight = menu.offsetHeight || 320;
    const below = window.innerHeight - rect.bottom;
    const top =
      below > Math.min(menuHeight, 360)
        ? rect.bottom + 7
        : Math.max(8, rect.top - menuHeight - 7);

    menu.style.left = `${Math.min(
      rect.left,
      window.innerWidth - 326
    )}px`;
    menu.style.top = `${top}px`;
  }

  function execute(index) {
    const item = props?.items?.[index];
    if (!item) return;

    item.command({
      editor: props.editor,
      range: props.range,
    });
  }

  function draw() {
    if (!menu || !props) return;

    if (!props.items.length) {
      if (props.loading) {
        menu.innerHTML = `
          <div class="focus-slash-title">
            <span>正在加载命令…</span>
            <kbd>Esc</kbd>
          </div>
        `;
        position();
        return;
      }

      queueMicrotask(() => {
        if (props?.editor?.view) {
          exitSuggestion(props.editor.view, pluginKey);
        }
      });
      return;
    }

    menu.innerHTML = `
      <div class="focus-slash-title">
        <span>插入内容</span>
        <kbd>Esc</kbd>
      </div>
      ${props.items
        .map(
          (item, index) => `
          <button
            type="button"
            data-index="${index}"
            class="${index === selected ? "selected" : ""}"
          >
            <span class="focus-slash-icon">${item.icon}</span>
            <span class="focus-slash-copy">
              <strong></strong>
              <small></small>
            </span>
          </button>
        `
        )
        .join("")}
    `;

    props.items.forEach((item, index) => {
      const button = menu.querySelector(
        `[data-index="${index}"]`
      );
      button.querySelector("strong").textContent = item.title;
      button.querySelector("small").textContent =
        item.description;
    });

    position();
  }

  function destroy() {
    menu?.remove();
    menu = null;
    props = null;
  }

  return {
    onStart(nextProps) {
      props = nextProps;
      selected = 0;
      menu = document.createElement("div");
      menu.className = "focus-slash-menu";

      menu.addEventListener("mousedown", (event) => {
        event.preventDefault();
        const button = event.target.closest("[data-index]");
        if (button) execute(Number(button.dataset.index));
      });

      document.body.appendChild(menu);
      draw();
    },

    onUpdate(nextProps) {
      props = nextProps;
      selected = 0;
      draw();
    },

    onKeyDown({ event }) {
      if (event.key === "Escape") {
        exitSuggestion(props.editor.view, pluginKey);
        return true;
      }

      if (!props.items.length) return false;

      if (event.key === "ArrowDown") {
        selected = (selected + 1) % props.items.length;
        draw();
        return true;
      }

      if (event.key === "ArrowUp") {
        selected =
          (selected - 1 + props.items.length) %
          props.items.length;
        draw();
        return true;
      }

      if (event.key === "Enter") {
        execute(selected);
        return true;
      }

      return false;
    },

    onExit() {
      destroy();
    },
  };
}

function plugin(editor, items, char, pluginKey) {
  return Suggestion({
    editor,
    char,
    pluginKey,
    startOfLine: true,
    allowedPrefixes: null,
    allowSpaces: false,
    items: ({ query }) => filterItems(items, query),
    command: ({ editor, range, props }) =>
      props.command({ editor, range }),
    render: () => createRenderer(pluginKey),
  });
}

export default Extension.create({
  name: "focusSlashCommands",

  addOptions() {
    return { items: [] };
  },

  addProseMirrorPlugins() {
    return [
      plugin(
        this.editor,
        this.options.items,
        "/",
        slashKey
      ),
      plugin(
        this.editor,
        this.options.items,
        "、",
        dunhaoKey
      ),
    ];
  },
});
