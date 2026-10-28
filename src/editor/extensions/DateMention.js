/*
 * FOCUS_EDITOR_ENHANCE_20261028_V1：@ 插入日期（参考语雀 @ 提及）
 * @ → 今天/明天/昨天/本周五/下周一/现在；直接键入 1105、11-5、2026.11.5、+3 解析指定日期。
 */
import { Extension } from "@tiptap/core";
import Suggestion, { exitSuggestion } from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import { shift } from "@floating-ui/dom";
import { fuzzyFilter } from "../fuzzyMatch";

const dateKey = new PluginKey("focusDateMention");
const WEEK = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const pad = (n) => String(n).padStart(2, "0");

export function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${WEEK[date.getDay()]}`;
}

function addDays(base, n) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

/** weekday：1=周一 … 7=周日；weekOffset：0 本周，1 下周 */
function weekDay(base, weekday, weekOffset) {
  const monday = addDays(base, -((base.getDay() + 6) % 7) + weekOffset * 7);
  return addDays(monday, weekday - 1);
}

function parseQuery(raw, today) {
  const source = String(raw || "").trim();
  let m = source.match(/^\+(\d{1,3})$/);
  if (m) return addDays(today, Number(m[1]));

  const q = source.replace(/[年月/.]/g, "-").replace(/日$/, "");
  let y = today.getFullYear();
  let mo;
  let d;
  if ((m = q.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) [y, mo, d] = [+m[1], +m[2], +m[3]];
  else if ((m = q.match(/^(\d{4})(\d{2})(\d{2})$/))) [y, mo, d] = [+m[1], +m[2], +m[3]];
  else if ((m = q.match(/^(\d{1,2})-(\d{1,2})$/))) [mo, d] = [+m[1], +m[2]];
  else if ((m = q.match(/^(\d{2})(\d{2})$/))) [mo, d] = [+m[1], +m[2]];
  else return null;

  const date = new Date(y, mo - 1, d);
  return date.getMonth() === mo - 1 && date.getDate() === d ? date : null;
}

function buildItems(query) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const presets = [
    { id: "today", title: "今天", aliases: ["today", "jt", "date", "rq", "日期"], date: today },
    { id: "tomorrow", title: "明天", aliases: ["tomorrow", "mt"], date: addDays(today, 1) },
    { id: "yesterday", title: "昨天", aliases: ["yesterday", "zt"], date: addDays(today, -1) },
    { id: "friday", title: "本周五", aliases: ["friday", "bzw", "周五"], date: weekDay(today, 5, 0) },
    { id: "next-monday", title: "下周一", aliases: ["monday", "xzy", "下周"], date: weekDay(today, 1, 1) },
    {
      id: "now", title: "现在（含时间）", aliases: ["now", "time", "sj", "时间"],
      text: `${formatDate(now)} ${pad(now.getHours())}:${pad(now.getMinutes())}`,
    },
  ];

  let list = fuzzyFilter(presets, query, (item) => [item.title, ...item.aliases]);
  const parsed = parseQuery(query, today);
  if (parsed) list = [{ id: "parsed", title: "指定日期", date: parsed }, ...list];

  return list.map((item) => ({ ...item, text: item.text || formatDate(item.date) }));
}

const escapeHtml = (v) =>
  String(v || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

function createRenderer() {
  let menu = null;
  let props = null;
  let selected = 0;
  let unmount = null;

  const pick = (index) => {
    const item = props?.items?.[index];
    if (item) props.command(item);
  };

  const sync = () => {
    menu?.querySelectorAll("[data-index]").forEach((button) => {
      button.classList.toggle("is-selected", Number(button.dataset.index) === selected);
    });
  };

  const draw = () => {
    if (!menu || !props) return;
    menu.style.display = props.items.length ? "" : "none";
    menu.innerHTML = `
      <div class="focus-command-header">
        <span>插入日期</span>
        <span><kbd>↑↓</kbd> 选择　<kbd>Enter</kbd> 插入</span>
      </div>
      <div class="focus-command-scroll"><div class="focus-command-list">
        ${props.items.map((item, index) => `
          <button type="button" data-index="${index}"
            class="focus-command-item ${index === selected ? "is-selected" : ""}">
            <span class="focus-command-icon">日</span>
            <span class="focus-command-copy">
              <strong>${escapeHtml(item.title)}</strong>
              <small>${escapeHtml(item.text)}</small>
            </span>
          </button>`).join("")}
      </div></div>`;
  };

  return {
    onStart(next) {
      props = next;
      selected = 0;
      menu = document.createElement("div");
      menu.className = "focus-command-menu focus-date-menu";
      menu.addEventListener("mousedown", (event) => {
        event.preventDefault();
        const button = event.target.closest("[data-index]");
        if (button) pick(Number(button.dataset.index));
      });
      unmount = props.mount(menu, { autoUpdate: { animationFrame: false } });
      draw();
    },
    onUpdate(next) {
      props = next;
      selected = 0;
      draw();
    },
    onKeyDown({ event }) {
      if (event.key === "Escape") {
        exitSuggestion(props.editor.view, dateKey);
        return true;
      }
      if (!props?.items?.length) return false;
      const total = props.items.length;
      if (event.key === "ArrowDown") { selected = (selected + 1) % total; sync(); return true; }
      if (event.key === "ArrowUp") { selected = (selected - 1 + total) % total; sync(); return true; }
      if (event.key === "Enter" || event.key === "Tab") { pick(selected); return true; }
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

export default Extension.create({
  name: "focusDateMention",

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: "@",
        pluginKey: dateKey,
        allowedPrefixes: null,
        allowSpaces: false,
        startOfLine: false,
        placement: "bottom-start",
        offset: { mainAxis: 8, crossAxis: -4 },
        dismissOnOutsideClick: true,
        flip: true,
        floatingUi: { strategy: "fixed", middleware: [shift({ padding: 10 })] },
        allow: ({ state }) => !state.selection.$from.parent.type.spec.code,
        items: ({ query }) => buildItems(query),
        command: ({ editor, range, props: item }) =>
          editor.chain().focus().deleteRange(range).insertContent(`${item.text} `).run(),
        render: () => createRenderer(),
      }),
    ];
  },
});
