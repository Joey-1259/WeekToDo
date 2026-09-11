<template>
  <Teleport to="body">
    <div
      class="tnc-layer"
      role="presentation"
      @mousedown.self="requestClose"
    >
      <section
        ref="panel"
        class="tnc"
        role="dialog"
        aria-modal="true"
        :aria-label="label + '：' + (taskTitle || '未命名事项')"
      >
        <header class="tnc-head">
          <div class="tnc-crumbs">
            <span class="tnc-crumb-icon" aria-hidden="true">
              <svg viewBox="0 0 20 20">
                <path d="M4 4h12M4 9h12M4 14h8" />
              </svg>
            </span>
            <span v-if="contextLabel" class="tnc-crumb">
              {{ contextLabel }}
            </span>
            <i v-if="contextLabel" aria-hidden="true">/</i>
            <strong :title="taskTitle">
              {{ taskTitle || "未命名事项" }}
            </strong>
            <span class="tnc-crumb-tail">· {{ label }}</span>
          </div>

          <div class="tnc-head-actions">
            <span
              class="tnc-status"
              :class="`is-${state}`"
              role="status"
              aria-live="polite"
            >
              <i aria-hidden="true"></i>
              <span>{{ statusLabel }}</span>
            </span>

            <button
              type="button"
              class="tnc-act"
              :class="{ active: preview }"
              :aria-pressed="String(preview)"
              title="Markdown 预览（并排）"
              @click="togglePreview"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <rect x="2.5" y="4" width="15" height="12" rx="1.6" />
                <path d="M10 4v12" />
              </svg>
            </button>

            <button
              type="button"
              class="tnc-act"
              title="Markdown 语法说明"
              @click="openMarkdownHelp"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <rect x="1.5" y="5" width="17" height="10" rx="1.6" />
                <path d="M4.5 13V7l2.4 3 2.4-3v6M13 7v6M13 13l1.9-2.2M13 13l-1.9-2.2" />
              </svg>
            </button>

            <span class="tnc-act-divider" aria-hidden="true"></span>

            <button
              type="button"
              class="tnc-act is-close"
              title="保存并返回（esc）"
              aria-label="保存并返回"
              @click="requestClose"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M5 5l10 10M15 5 5 15" />
              </svg>
            </button>
          </div>
        </header>

        <div class="tnc-body" :class="{ 'is-split': preview }">
          <div class="tnc-input-wrap">
            <textarea
              ref="input"
              v-model="draft"
              class="tnc-input"
              spellcheck="false"
              :placeholder="placeholder"
              @input="onInput"
              @keydown.tab.prevent="insertIndent"
            ></textarea>
          </div>

          <div v-if="preview" class="tnc-preview" aria-label="预览">
            <div
              v-if="renderer"
              class="tnc-preview-body"
              v-html="rendered"
            ></div>
            <pre v-else class="tnc-preview-fallback">{{ draft }}</pre>
          </div>
        </div>

        <footer class="tnc-foot">
          <span class="tnc-meta">{{ stats }}</span>
          <span class="tnc-hint">
            <kbd>⌘</kbd><kbd>↩</kbd> 保存并返回
            <em>·</em>
            <kbd>esc</kbd> 返回
            <em>·</em>
            <kbd>tab</kbd> 缩进
          </span>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<script>
/* TASK_NOTES_COMPOSER_20260911_V1
 *
 * 「任务细节」的沉浸式编辑层。
 *
 * 一、为什么不是嵌套 Bootstrap modal。
 *     toDoModal 里已经有一段手动移除 .modal-backdrop、手动摘掉
 *     body.modal-open 的补偿代码——那正是"modal 套 modal"在这个
 *     项目里已经付过的学费。这一层因此完全不碰 Bootstrap：
 *     Teleport 到 body，自己画遮罩，自己管焦点与 Esc。
 *
 * 二、z-index 台账（读代码得出，集中记在这里以免继续散落）：
 *       1050/1055  Bootstrap modal + backdrop（toDoModal）
 *       1056       toastMessage
 *       19000      FocusDocumentDialog（沉浸式文档）
 *       20000      FocusColumnInserter
 *       21000      FocusColumnCard 菜单 / 移动目录遮罩
 *       22000      本组件 —— 必须高于以上全部，因为它可能从
 *                  任意一层之上被唤起。
 *
 * 三、Esc 的归属。本层在 document 上以 capture 阶段监听，命中
 *     Escape 后 stopImmediatePropagation，确保底下的 Bootstrap
 *     modal 不会跟着一起关掉（否则用户按一次 esc 会连退两层）。
 */

const SAVE_DEBOUNCE = 380;

export default {
  name: "TaskNotesComposer",

  props: {
    modelValue: { type: String, default: "" },
    taskTitle: { type: String, default: "" },
    contextLabel: { type: String, default: "" },
    label: { type: String, default: "任务细节" },
    placeholder: {
      type: String,
      default: "在这里从容地写。支持 Markdown：# 标题、- 列表、**加粗**、`代码`。",
    },
  },

  emits: ["update:modelValue", "close"],

  data() {
    return {
      draft: this.modelValue || "",
      state: "saved",
      timer: null,
      preview: false,
      renderer: null,
      /* FOCUS_OWNERSHIP_FIX_20260911 焦点归属守卫的状态 */
      lastInside: null,
      strikes: 0,
      strikeTimer: null,
      closing: false,
    };
  },

  computed: {
    statusLabel() {
      if (this.state === "dirty") return "编辑中…";
      return "已保存";
    },

    stats() {
      const text = this.draft || "";
      const lines = text ? text.split("\n").length : 0;

      return `${text.length} 字符 · ${lines} 行`;
    },

    rendered() {
      if (!this.renderer) return "";

      try {
        return this.renderer.render(this.draft || "");
      } catch (error) {
        console.error(error);
        return "";
      }
    },
  },

  watch: {
    /* 只在外部值与本地草稿真的不同时才回写，否则父级每次
       持久化都会重置一次 draft，光标随之跳回。 */
    modelValue(value) {
      const next = value || "";
      if (next !== this.draft) this.draft = next;
    },
  },

  mounted() {
    /* 顺序要紧：focusin 守卫必须先于下面 nextTick 里的首次 focus()
       注册，否则第一次聚焦就会被 Bootstrap 抢掉。 */
    document.addEventListener("focusin", this.onFocusinCapture, true);
    document.addEventListener("keydown", this.onKeydownCapture, true);

    this.$nextTick(() => {
      const input = this.$refs.input;
      if (!input) return;

      input.focus();
      // 光标落在末尾，而不是选中全文——打开沉浸式通常是为了"接着写"。
      const end = input.value.length;
      input.setSelectionRange(end, end);
    });
  },

  beforeUnmount() {
    document.removeEventListener(
      "focusin",
      this.onFocusinCapture,
      true
    );
    document.removeEventListener(
      "keydown",
      this.onKeydownCapture,
      true
    );
    clearTimeout(this.strikeTimer);
    this.flush();
  },

  methods: {
    /* ---------- 焦点归属守卫 ---------- */

    /* FOCUS_OWNERSHIP_FIX_20260911
     *
     * Bootstrap 5.3 util/focustrap.js：
     *
     *   activate() {
     *     EventHandler.on(document, EVENT_FOCUSIN, e => this._handleFocusin(e))
     *   }
     *   _handleFocusin(event) {
     *     const { trapElement } = this._config
     *     if (event.target === document || event.target === trapElement
     *         || trapElement.contains(event.target)) return
     *     SelectorEngine.focusableChildren(trapElement)[0].focus()
     *   }
     *
     * trapElement 是 #toDoModal。本层 Teleport 到 body，永远不在那棵
     * 子树里，所以 contains() 恒为 false —— 每次聚焦都被拽回弹窗的
     * 第一个 input，键入落到背后被遮住的字段上。
     *
     * 它的监听在 document 的【冒泡】阶段，我们在【捕获】阶段截断，
     * 捕获先行，它就永远收不到这个事件。不动私有 _focustrap，也不设
     * data-bs-focus="false"（那会永久废掉弹窗的焦点陷阱，普通场景下
     * Tab 就能跑出去，是拿无障碍换便利）。
     */
    onFocusinCapture(event) {
      if (this.closing) return;

      const panel = this.$refs.panel;
      if (!panel) return;

      const target = event.target;
      const inside = target === panel || panel.contains(target);

      /* body / document 这一类也必须拦：点击面板头部留白时焦点会
         落到 body，放过去的话焦点就被吸回背后的弹窗，用户的下一个
         按键会写到错误的字段里。 */
      const neutral =
        target === document ||
        target === document.body ||
        target === document.documentElement;

      if (inside || neutral) {
        if (inside) this.lastInside = target;
        event.stopPropagation();
      }

      if (inside) return;

      /* 防线二：若焦点仍被别的陷阱抢走（或将来某个版本改用捕获），
         把它拉回来。限额 3 次 / 400ms —— 宁可让焦点跑掉，
         也绝不制造无限抢焦循环。 */
      if (this.strikes >= 3) return;

      this.strikes += 1;
      clearTimeout(this.strikeTimer);
      this.strikeTimer = setTimeout(() => {
        this.strikes = 0;
      }, 400);

      const back =
        this.lastInside && panel.contains(this.lastInside)
          ? this.lastInside
          : this.$refs.input;

      if (back) back.focus();
    },

    onKeydownCapture(event) {
      const key = event.key || "";

      if (key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.requestClose();
        return;
      }

      const meta = event.metaKey || event.ctrlKey;
      if (!meta) return;

      if (key === "Enter") {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.requestClose();
        return;
      }

      if (key.toLowerCase() === "s") {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.flush();
      }
    },

    onInput() {
      this.state = "dirty";

      clearTimeout(this.timer);
      this.timer = setTimeout(this.flush, SAVE_DEBOUNCE);
    },

    flush() {
      clearTimeout(this.timer);
      this.timer = null;

      if (this.draft === (this.modelValue || "")) {
        this.state = "saved";
        return;
      }

      this.$emit("update:modelValue", this.draft);
      this.state = "saved";
    },

    requestClose() {
      /* 关闭期彻底让开：父级要把焦点交还给触发按钮，
         此时守卫再去抢焦就会和它打架。 */
      this.closing = true;
      this.flush();
      this.$emit("close");
    },

    /* Tab 插入两个空格：写嵌套列表时不至于把焦点甩出编辑区。 */
    insertIndent() {
      const input = this.$refs.input;
      if (!input) return;

      const start = input.selectionStart;
      const end = input.selectionEnd;

      this.draft =
        this.draft.slice(0, start) + "  " + this.draft.slice(end);

      this.$nextTick(() => {
        input.setSelectionRange(start + 2, start + 2);
      });

      this.onInput();
    },

    /* markdown-it 已是既有依赖，但按需加载：预览是可选能力，
       不该让它的解析器进入首屏体积；解析器不可用时降级成纯文本，
       写作能力永不受影响。 */
    async togglePreview() {
      this.preview = !this.preview;

      if (!this.preview || this.renderer) return;

      try {
        const module = await import("markdown-it");
        const MarkdownIt = module.default || module;

        this.renderer = new MarkdownIt({
          html: false,
          linkify: true,
          breaks: true,
        });
      } catch (error) {
        console.error(error);
        this.renderer = null;
      }
    },

    openMarkdownHelp() {
      window.open("https://commonmark.org/help/", "_blank");
    },
  },
};
</script>

<style lang="scss">
.tnc-layer {
  position: fixed;
  z-index: 22000;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 26px;
  background: rgba(18, 22, 28, 0.5);
  backdrop-filter: blur(6px);
  animation: tnc-layer-in 0.14s ease-out;
}

@keyframes tnc-layer-in {
  from {
    opacity: 0;
  }
}

.tnc {
  display: flex;
  width: min(980px, 94vw);
  height: min(760px, 88vh);
  flex-direction: column;
  border: 1px solid rgba(31, 35, 41, 0.1);
  border-radius: 16px;
  background: #fff;
  box-shadow:
    0 32px 88px rgba(14, 19, 28, 0.26),
    0 4px 14px rgba(14, 19, 28, 0.08);
  overflow: hidden;
  animation: tnc-in 0.16s cubic-bezier(0.22, 0.9, 0.36, 1);
}

@keyframes tnc-in {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.988);
  }
}

/* ---------------- 头部 ---------------- */

.tnc-head {
  display: flex;
  min-height: 52px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 12px 0 18px;
  border-bottom: 1px solid #eef0f3;
}

.tnc-crumbs {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 7px;
  color: #979ea7;
  font-size: 11.5px;
}

.tnc-crumb-icon svg {
  display: block;
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
}

.tnc-crumbs i {
  font-style: normal;
  opacity: 0.55;
}

.tnc-crumbs strong {
  overflow: hidden;
  max-width: 40ch;
  color: #2d323a;
  font-size: 13px;
  font-weight: 620;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tnc-crumb-tail {
  flex: 0 0 auto;
  opacity: 0.8;
}

.tnc-head-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 2px;
}

.tnc-status {
  display: inline-flex;
  height: 24px;
  align-items: center;
  gap: 5px;
  margin-right: 4px;
  padding: 0 8px;
  border-radius: 999px;
  color: #8a9199;
  font-size: 10px;
  white-space: nowrap;
}

.tnc-status > i {
  width: 6px;
  height: 6px;
  flex: 0 0 6px;
  border-radius: 50%;
  background: #68a67d;
  transition: background-color 0.2s ease;
}

.tnc-status.is-dirty > i {
  background: #d99a3b;
}

.tnc-act {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 8px;
  outline: none;
  background: transparent;
  color: #757d87;
  cursor: pointer;
  transition:
    background-color 0.14s ease,
    color 0.14s ease;
}

.tnc-act:hover {
  background: #eef1f5;
  color: #343a43;
}

.tnc-act.active {
  background: #eef2ff;
  color: #4263eb;
}

.tnc-act.is-close:hover {
  background: #fdecec;
  color: #d14343;
}

.tnc-act:focus-visible {
  box-shadow: 0 0 0 2px rgba(66, 99, 235, 0.3);
}

.tnc-act svg {
  width: 17px;
  height: 17px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.55;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.tnc-act-divider {
  width: 1px;
  height: 18px;
  margin: 0 5px;
  background: #e6e9ed;
}

/* ---------------- 正文 ---------------- */

.tnc-body {
  display: grid;
  min-height: 0;
  flex: 1;
  grid-template-columns: minmax(0, 1fr);
}

.tnc-body.is-split {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}

.tnc-input-wrap {
  display: flex;
  min-width: 0;
  min-height: 0;
}

.tnc-input {
  width: 100%;
  padding: 26px 30px 40px;
  border: 0;
  outline: none;
  background: transparent;
  color: #2a2f36;
  font-family: inherit;
  font-size: 15px;
  line-height: 1.85;
  resize: none;
  /* 这一层是唯一的滚动容器，天然没有嵌套滚动问题。 */
  overflow-y: auto;
  overscroll-behavior: contain;
  white-space: pre-wrap;
  word-break: break-word;
  caret-color: #4263eb;
}

.tnc-input::placeholder {
  color: #b7bdc5;
}

/* 阅读宽度上限：正文不超过约 42em，超宽屏上靠左排版而不是
   把一行拉到 90 个字——长行会显著降低回视准确率。 */
.tnc-body:not(.is-split) .tnc-input {
  padding-right: max(30px, calc(100% - 46em));
}

.tnc-preview {
  min-width: 0;
  min-height: 0;
  padding: 26px 30px 40px;
  border-left: 1px solid #eef0f3;
  background: #fcfcfd;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.tnc-preview-body {
  color: #343a42;
  font-size: 14px;
  line-height: 1.8;
  word-break: break-word;
}

.tnc-preview-body h1,
.tnc-preview-body h2,
.tnc-preview-body h3 {
  margin: 1.1em 0 0.5em;
  color: #23272e;
  font-weight: 660;
  line-height: 1.4;
}

.tnc-preview-body h1 { font-size: 19px; }
.tnc-preview-body h2 { font-size: 16.5px; }
.tnc-preview-body h3 { font-size: 14.5px; }

.tnc-preview-body p {
  margin: 0 0 0.85em;
}

.tnc-preview-body ul,
.tnc-preview-body ol {
  margin: 0 0 0.85em;
  padding-left: 1.4em;
}

.tnc-preview-body li {
  margin: 0.22em 0;
}

.tnc-preview-body a {
  color: #4263eb;
  text-decoration: none;
}

.tnc-preview-body a:hover {
  text-decoration: underline;
}

.tnc-preview-body code {
  padding: 1px 5px;
  border-radius: 4px;
  background: #f1f3f6;
  color: #3b4149;
  font-size: 12.5px;
}

.tnc-preview-body pre {
  padding: 12px 14px;
  border-radius: 9px;
  background: #f6f7f9;
  overflow-x: auto;
}

.tnc-preview-body pre code {
  padding: 0;
  background: transparent;
}

.tnc-preview-body blockquote {
  margin: 0 0 0.85em;
  padding: 2px 0 2px 13px;
  border-left: 3px solid #dfe3e9;
  color: #6d747e;
}

.tnc-preview-body hr {
  margin: 1.3em 0;
  border: 0;
  border-top: 1px solid #e9ecef;
}

.tnc-preview-fallback {
  margin: 0;
  color: #6d747e;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
}

/* ---------------- 底部 ---------------- */

.tnc-foot {
  display: flex;
  min-height: 40px;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 0 16px;
  border-top: 1px solid #eef0f3;
  background: #fafbfc;
  color: #9ba1aa;
  font-size: 10.5px;
}

.tnc-meta {
  font-variant-numeric: tabular-nums;
}

.tnc-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.tnc-hint em {
  margin: 0 3px;
  font-style: normal;
  opacity: 0.5;
}

.tnc-hint kbd {
  display: inline-grid;
  min-width: 17px;
  height: 17px;
  place-items: center;
  padding: 0 4px;
  border: 1px solid #e2e6ec;
  border-radius: 4px;
  background: #fff;
  color: #868d96;
  font-family: inherit;
  font-size: 10px;
  line-height: 1;
}

/* ---------------- 暗色 ---------------- */

.dark-theme .tnc {
  border-color: #333a44;
  background: #161b22;
}

.dark-theme .tnc-head,
.dark-theme .tnc-foot {
  border-color: #262d36;
}

.dark-theme .tnc-foot {
  background: #131920;
}

.dark-theme .tnc-crumbs strong {
  color: #e1e5ea;
}

.dark-theme .tnc-input {
  color: #d7dce2;
}

.dark-theme .tnc-input::placeholder {
  color: #5d6670;
}

.dark-theme .tnc-act:hover {
  background: #252c35;
  color: #e3e7ec;
}

.dark-theme .tnc-act.active {
  background: #223052;
  color: #93a8f5;
}

.dark-theme .tnc-act-divider {
  background: #333a44;
}

.dark-theme .tnc-preview {
  border-color: #262d36;
  background: #131920;
}

.dark-theme .tnc-preview-body {
  color: #cdd3da;
}

.dark-theme .tnc-preview-body h1,
.dark-theme .tnc-preview-body h2,
.dark-theme .tnc-preview-body h3 {
  color: #e6eaef;
}

.dark-theme .tnc-preview-body code,
.dark-theme .tnc-preview-body pre {
  background: #20262e;
  color: #cfd5dc;
}

.dark-theme .tnc-preview-body blockquote {
  border-color: #3a424d;
  color: #9aa1ab;
}

.dark-theme .tnc-hint kbd {
  border-color: #39414c;
  background: #20262e;
  color: #9aa1ab;
}

/* 窄窗自动退出分栏预览：两栏各不足 340px 时并排已无意义。 */
@media (max-width: 820px) {
  .tnc-body.is-split {
    grid-template-columns: minmax(0, 1fr);
  }

  .tnc-preview {
    display: none;
  }
}
</style>
