import { Extension } from "@tiptap/core";
import Suggestion, {
  exitSuggestion,
} from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import { shift, size } from "@floating-ui/dom";

const slashKey = new PluginKey("focusSlash");
const dunhaoKey = new PluginKey("focusDunhao");
const RECENT_KEY = "focusSlashRecentCommands";

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\s\-_/、]/g, "");
}

function readRecent() {
  try {
    const value = JSON.parse(
      localStorage.getItem(RECENT_KEY) || "[]"
    );
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function remember(item) {
  if (!item?.id) return;

  const recent = [
    item.id,
    ...readRecent().filter((id) => id !== item.id),
  ].slice(0, 3);

  localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
}

function filterItems(items, query) {
  const keyword = normalize(query);

  if (!keyword) return items;

  return items
    .map((item) => {
      const values = [
        item.title,
        item.description,
        item.shortcut,
        ...(item.aliases || []),
      ].map(normalize);

      let score = -1;

      if (values.some((value) => value === keyword)) {
        score = 400;
      } else if (
        values.some((value) => value.startsWith(keyword))
      ) {
        score = 300;
      } else if (
        values.some((value) => value.includes(keyword))
      ) {
        score = 200;
      }

      return { item, score };
    })
    .filter(({ score }) => score >= 0)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item)
    .slice(0, 12);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function createRenderer(pluginKey) {
  let menu = null;
  let props = null;
  let selected = 0;
  let unmount = null;

  function execute(index) {
    const item = props?.items?.[index];
    if (!item) return;

    remember(item);
    props.command(item);
  }

  function itemButton(item, index, compact = false) {
    return `
      <button
        type="button"
        data-index="${index}"
        class="focus-command-item
          ${compact ? "is-compact" : ""}
          ${index === selected ? "is-selected" : ""}"
      >
        <span class="focus-command-icon">
          ${escapeHtml(item.icon)}
        </span>

        ${
          compact
            ? `<span class="focus-command-compact-title">
                 ${escapeHtml(item.title)}
               </span>`
            : `<span class="focus-command-copy">
                 <strong>${escapeHtml(item.title)}</strong>
                 <small>${escapeHtml(item.description)}</small>
               </span>
               <span class="focus-command-shortcut">
                 ${escapeHtml(item.shortcut)}
               </span>`
        }
      </button>
    `;
  }

  function drawSearchResults() {
    return `
      <div class="focus-command-section-title">
        搜索结果
      </div>

      <div class="focus-command-list">
        ${props.items
          .map((item, index) => itemButton(item, index))
          .join("")}
      </div>
    `;
  }

  function drawDefaultMenu() {
    const recentIds = readRecent();
    const recentItems = recentIds
      .map((id) =>
        props.items.find((item) => item.id === id)
      )
      .filter(Boolean);

    const findIndex = (item) =>
      props.items.findIndex(
        (value) => value.id === item.id
      );

    const categoryGroups = props.items.reduce(
      (groups, item) => {
        const category =
          String(item.category || "").trim() || "其他";

        if (!groups.has(category)) {
          groups.set(category, []);
        }

        groups.get(category).push(item);
        return groups;
      },
      new Map()
    );

    const categorySections = Array.from(
      categoryGroups.entries()
    )
      .filter(([, items]) => items.length)
      .map(([category, items]) => `
        <div class="focus-command-section">
          <div class="focus-command-section-title">
            ${escapeHtml(category)}
          </div>

          <div class="focus-command-list">
            ${items
              .map((item) =>
                itemButton(item, findIndex(item))
              )
              .join("")}
          </div>
        </div>
      `)
      .join("");

    return `
      ${
        recentItems.length
          ? `<div class="focus-command-section">
               <div class="focus-command-section-title">
                 最近使用
               </div>

               <div class="focus-command-recent">
                 ${recentItems
                   .map((item) =>
                     itemButton(
                       item,
                       findIndex(item),
                       true
                     )
                   )
                   .join("")}
               </div>
             </div>`
          : ""
      }

      ${categorySections}
    `;
  }

  function draw() {
    if (!menu || !props) return;

    if (!props.items.length) {
      if (props.loading) {
        menu.innerHTML = `
          <div class="focus-command-loading">
            正在加载命令…
          </div>
        `;
        return;
      }

      menu.innerHTML = `
        <div class="focus-command-empty">
          <strong>没有匹配的功能</strong>
          <small>继续输入文字，或按 Esc 退出</small>
        </div>
      `;
      return;
    }

    menu.innerHTML = `
      <div class="focus-command-header">
        <span>
          ${props.query ? "搜索功能" : "插入内容"}
        </span>
        <span><kbd>↑↓</kbd> 选择　<kbd>Enter</kbd> 插入</span>
      </div>

      <div class="focus-command-scroll">
        ${
          props.query
            ? drawSearchResults()
            : drawDefaultMenu()
        }
      </div>
    `;
  }

  return {
    onStart(nextProps) {
      props = nextProps;
      selected = 0;

      menu = document.createElement("div");
      menu.className = "focus-command-menu";

      menu.addEventListener("mousedown", (event) => {
        event.preventDefault();

        const button = event.target.closest("[data-index]");
        if (!button) return;

        execute(Number(button.dataset.index));
      });

      unmount = props.mount(menu, {
        autoUpdate: {
          animationFrame: false,
        },
      });

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

        menu
          ?.querySelector(".is-selected")
          ?.scrollIntoView({ block: "nearest" });

        return true;
      }

      if (event.key === "ArrowUp") {
        selected =
          (selected - 1 + props.items.length) %
          props.items.length;
        draw();

        menu
          ?.querySelector(".is-selected")
          ?.scrollIntoView({ block: "nearest" });

        return true;
      }

      if (event.key === "Enter") {
        execute(selected);
        return true;
      }

      return false;
    },

    onExit() {
      unmount?.();
      unmount = null;
      menu = null;
      props = null;
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
    placement: "bottom-start",
    offset: {
      mainAxis: 8,
      crossAxis: -4,
    },
    dismissOnOutsideClick: true,
    flip: true,
    floatingUi: {
      strategy: "fixed",
      middleware: [
        shift({ padding: 10 }),
        size({
          padding: 10,
          apply({
            availableWidth,
            availableHeight,
            elements,
          }) {
            Object.assign(elements.floating.style, {
              maxWidth: `${Math.max(
                280,
                availableWidth
              )}px`,
              maxHeight: `${Math.max(
                180,
                availableHeight
              )}px`,
            });

            const scroll =
              elements.floating.querySelector(
                ".focus-command-scroll"
              );

            if (scroll) {
              scroll.style.maxHeight = `${Math.max(
                120,
                availableHeight - 56
              )}px`;
              scroll.style.overflowY = "auto";
            }
          },
        }),
      ],
    },
    items: ({ query }) => filterItems(items, query),
    command: ({ editor, range, props: item }) =>
      item.command({ editor, range }),
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
