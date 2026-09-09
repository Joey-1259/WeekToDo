<template>
  <div class="fx-toolbar" role="toolbar" aria-label="文档格式工具栏">
    <!-- 1. 格式工具：格式刷 / 清除格式 / 粘贴模式 -->
    <div class="fx-group">
      <button
        type="button"
        class="fx-btn"
        :class="{ 'is-on': !!formatSample, 'is-locked': isPainterLocked }"
        v-tip="painterTip"
        @mousedown.prevent
        @click="onPainterClick"
        @dblclick="onPainterDoubleClick"
      >
        <AppIcon name="formatPainter" />
        <i v-if="isPainterLocked" class="fx-lock" aria-hidden="true"></i>
      </button>

      <button
        type="button"
        class="fx-btn"
        v-tip="{ label: '清除格式', keys: '⌘\\' }"
        @mousedown.prevent
        @click="$emit('clear-format')"
      >
        <AppIcon name="eraser" />
      </button>

      <button
        type="button"
        class="fx-btn"
        :class="{ 'is-on': keepPasteStyle }"
        v-tip="pasteTip"
        @mousedown.prevent
        @click="$emit('toggle-paste-style')"
      >
        <AppIcon name="clipboard" />
      </button>
    </div>

    <span class="fx-sep"></span>

    <!-- 2. 段落样式与字号 -->
    <div class="fx-group">
      <button
        ref="blockTrigger"
        type="button"
        class="fx-select"
        :class="{ 'is-open': pop === 'block' }"
        v-tip="{ label: '文字样式' }"
        @mousedown.prevent
        @click.stop="togglePop('block', $event)"
      >
        <span class="fx-select-text">{{ blockLabel }}</span>
        <AppIcon name="chevronDown" class="fx-caret" />
      </button>

      <button
        ref="sizeTrigger"
        type="button"
        class="fx-select is-narrow"
        :class="{ 'is-open': pop === 'size' }"
        v-tip="{ label: '字号' }"
        @mousedown.prevent
        @click.stop="togglePop('size', $event)"
      >
        <span class="fx-select-text">{{ sizeLabel }}</span>
        <AppIcon name="chevronDown" class="fx-caret" />
      </button>
    </div>

    <span class="fx-sep"></span>

    <!-- 3. 行内样式 -->
    <div class="fx-group">
      <button
        type="button"
        class="fx-btn"
        :class="{ 'is-on': isActive('bold') }"
        v-tip="{ label: '加粗', keys: '⌘B' }"
        @mousedown.prevent
        @click="run('toggleBold')"
      >
        <AppIcon name="bold" />
      </button>

      <button
        type="button"
        class="fx-btn"
        :class="{ 'is-on': isActive('italic') }"
        v-tip="{ label: '斜体', keys: '⌘I' }"
        @mousedown.prevent
        @click="run('toggleItalic')"
      >
        <AppIcon name="italic" />
      </button>

      <button
        v-if="spacious"
        type="button"
        class="fx-btn"
        :class="{ 'is-on': isActive('underline') }"
        v-tip="{ label: '下划线', keys: '⌘U' }"
        @mousedown.prevent
        @click="run('toggleUnderline')"
      >
        <AppIcon name="underline" />
      </button>

      <button
        v-if="spacious"
        type="button"
        class="fx-btn"
        :class="{ 'is-on': isActive('strike') }"
        v-tip="{ label: '删除线', keys: '⌘⇧X' }"
        @mousedown.prevent
        @click="run('toggleStrike')"
      >
        <AppIcon name="strike" />
      </button>

      <!-- 文字颜色：主区域直接套用当前色，箭头开调色板 -->
      <div class="fx-split" :class="{ 'is-open': pop === 'color' }">
        <button
          type="button"
          class="fx-split-main"
          :class="{ 'is-on': hasTextColor }"
          v-tip="{ label: '文字颜色' }"
          @mousedown.prevent
          @click="applyTextColor(currentTextColor)"
        >
          <AppIcon name="textColor" />
          <i class="fx-bar" :style="{ background: currentTextColor }"></i>
        </button>

        <button
          ref="colorTrigger"
          type="button"
          class="fx-split-caret"
          v-tip="{ label: '选择文字颜色' }"
          @mousedown.prevent
          @click.stop="togglePop('color', $event)"
        >
          <AppIcon name="chevronDown" class="fx-caret" />
        </button>
      </div>

      <!-- 高亮 -->
      <div class="fx-split" :class="{ 'is-open': pop === 'highlight' }">
        <button
          type="button"
          class="fx-split-main"
          :class="{ 'is-on': isActive('highlight') }"
          v-tip="{ label: '高亮' }"
          @mousedown.prevent
          @click="applyHighlight(currentHighlight)"
        >
          <AppIcon name="highlight" />
          <i class="fx-bar" :style="{ background: currentHighlight }"></i>
        </button>

        <button
          ref="highlightTrigger"
          type="button"
          class="fx-split-caret"
          v-tip="{ label: '选择高亮色' }"
          @mousedown.prevent
          @click.stop="togglePop('highlight', $event)"
        >
          <AppIcon name="chevronDown" class="fx-caret" />
        </button>
      </div>
    </div>

    <span class="fx-sep"></span>

    <!-- 4. 列表与缩进 -->
    <div class="fx-group">
      <button
        type="button"
        class="fx-btn"
        :class="{ 'is-on': isActive('bulletList') }"
        v-tip="{ label: '无序列表' }"
        @mousedown.prevent
        @click="run('toggleBulletList')"
      >
        <AppIcon name="bulletList" />
      </button>

      <button
        type="button"
        class="fx-btn"
        :class="{ 'is-on': isActive('orderedList') }"
        v-tip="{ label: '有序列表' }"
        @mousedown.prevent
        @click="run('toggleOrderedList')"
      >
        <AppIcon name="orderedList" />
      </button>

      <button
        type="button"
        class="fx-btn"
        :class="{ 'is-on': isActive('taskList') }"
        v-tip="{ label: '待办清单' }"
        @mousedown.prevent
        @click="run('toggleTaskList')"
      >
        <AppIcon name="taskList" />
      </button>

      <button
        v-if="spacious"
        type="button"
        class="fx-btn"
        :class="{ 'is-on': isActive('blockquote') }"
        v-tip="{ label: '引用' }"
        @mousedown.prevent
        @click="run('toggleBlockquote')"
      >
        <AppIcon name="quote" />
      </button>

      <button
        v-if="spacious"
        type="button"
        class="fx-btn"
        v-tip="{ label: '减少缩进', keys: '⇧Tab' }"
        @mousedown.prevent
        @click="outdent"
      >
        <AppIcon name="indentDecrease" />
      </button>

      <button
        v-if="spacious"
        type="button"
        class="fx-btn"
        v-tip="{ label: '增加缩进', keys: 'Tab' }"
        @mousedown.prevent
        @click="indent"
      >
        <AppIcon name="indentIncrease" />
      </button>
    </div>

    <span class="fx-sep"></span>

    <!-- 5. 插入 -->
    <div class="fx-group">
      <button
        type="button"
        class="fx-btn"
        :class="{ 'is-on': isActive('link') }"
        v-tip="{ label: '链接' }"
        @mousedown.prevent
        @click="$emit('edit-link')"
      >
        <AppIcon name="link" />
      </button>

      <button
        type="button"
        class="fx-btn"
        v-tip="{ label: '插入图片' }"
        @mousedown.prevent
        @click="$emit('insert-image')"
      >
        <AppIcon name="image" />
      </button>

      <button
        type="button"
        class="fx-btn"
        v-tip="{ label: '关联每周事项' }"
        @mousedown.prevent
        @click="$emit('request-task')"
      >
        <AppIcon name="taskLink" />
      </button>

      <button
        v-if="spacious"
        type="button"
        class="fx-btn"
        v-tip="{ label: '分割线' }"
        @mousedown.prevent
        @click="run('setHorizontalRule')"
      >
        <AppIcon name="horizontalRule" />
      </button>
    </div>

    <!-- 6. 代码块上下文工具（仅光标在代码块内时出现） -->
    <template v-if="inCodeBlock">
      <span class="fx-sep"></span>

      <div class="fx-group">
        <button
          ref="langTrigger"
          type="button"
          class="fx-select"
          :class="{ 'is-open': pop === 'lang' }"
          v-tip="{ label: '代码语言' }"
          @mousedown.prevent
          @click.stop="togglePop('lang', $event)"
        >
          <span class="fx-select-text">{{ languageLabel }}</span>
          <AppIcon name="chevronDown" class="fx-caret" />
        </button>

        <button
          type="button"
          class="fx-btn"
          v-tip="{ label: '复制代码' }"
          @mousedown.prevent
          @click="$emit('copy-code')"
        >
          <AppIcon name="copy" />
        </button>

        <button
          type="button"
          class="fx-btn"
          :class="{ 'is-on': codeWrap }"
          v-tip="{ label: '代码自动换行' }"
          @mousedown.prevent
          @click="$emit('toggle-code-wrap')"
        >
          <AppIcon name="textWrap" />
        </button>
      </div>
    </template>

    <span class="fx-spacer"></span>

    <button
      v-if="spacious"
      type="button"
      class="fx-btn"
      v-tip="{ label: 'Markdown 源码' }"
      @mousedown.prevent
      @click="$emit('open-markdown')"
    >
      <AppIcon name="markdown" />
    </button>

    <!-- ---------- 浮层 ---------- -->
    <Teleport to="body">
      <div
        v-if="pop"
        class="fx-pop"
        :style="popStyle"
        role="dialog"
        @mousedown.stop
        @click.stop
      >
        <!-- 段落样式 -->
        <template v-if="pop === 'block'">
          <button
            v-for="item in blockOptions"
            :key="item.value"
            type="button"
            class="fx-pop-row"
            :class="{ selected: currentBlock === item.value }"
            @click="setBlock(item.value)"
          >
            <span :class="item.preview">{{ item.label }}</span>
          </button>
        </template>

        <!-- 字号 -->
        <template v-else-if="pop === 'size'">
          <div class="fx-pop-scroll">
            <button
              v-for="item in sizeOptions"
              :key="String(item.value)"
              type="button"
              class="fx-pop-row is-compact"
              :class="{ selected: currentFontSize === item.value }"
              @click="setFontSize(item.value)"
            >
              {{ item.label }}
            </button>
          </div>
        </template>

        <!-- 代码语言 -->
        <template v-else-if="pop === 'lang'">
          <div class="fx-pop-scroll">
            <button
              v-for="item in codeLanguages"
              :key="item.value"
              type="button"
              class="fx-pop-row is-compact"
              :class="{ selected: currentLanguage === item.value }"
              @click="setLanguage(item.value)"
            >
              {{ item.label }}
            </button>
          </div>
        </template>

        <!-- 文字颜色 -->
        <template v-else-if="pop === 'color'">
          <strong class="fx-pop-title">文字颜色</strong>
          <div class="fx-swatches">
            <button
              type="button"
              class="fx-swatch-reset"
              @click="clearTextColor"
            >
              自动
            </button>
            <button
              v-for="color in textColors"
              :key="color"
              type="button"
              class="fx-swatch"
              :class="{ selected: currentTextColor === color }"
              :style="{ background: color }"
              :title="color"
              @click="applyTextColor(color)"
            ></button>
          </div>
          <label class="fx-custom">
            <span>自定义</span>
            <input
              type="color"
              :value="currentTextColor"
              @input="applyTextColor($event.target.value)"
            />
          </label>
        </template>

        <!-- 高亮 -->
        <template v-else-if="pop === 'highlight'">
          <strong class="fx-pop-title">高亮颜色</strong>
          <div class="fx-swatches">
            <button
              type="button"
              class="fx-swatch-reset"
              @click="clearHighlight"
            >
              无
            </button>
            <button
              v-for="color in highlightColors"
              :key="color"
              type="button"
              class="fx-swatch"
              :class="{ selected: currentHighlight === color }"
              :style="{ background: color }"
              :title="color"
              @click="applyHighlight(color)"
            ></button>
          </div>
          <label class="fx-custom">
            <span>自定义</span>
            <input
              type="color"
              :value="currentHighlight"
              @input="applyHighlight($event.target.value)"
            />
          </label>
        </template>
      </div>
    </Teleport>
  </div>
</template>

<script>
/* FOCUS_UI_SYSTEM_20260909_V4 */
import AppIcon from "../../components/ui/AppIcon.vue";
import { tip } from "../../directives/tooltip";

const TEXT_COLORS = [
  "#292d33", "#626a75", "#d14343", "#c26a22", "#9a7614",
  "#2f7d4a", "#267a8a", "#3f63c8", "#7354b5",
];

const HIGHLIGHT_COLORS = [
  "#fff0a6", "#ffd8a8", "#ffc9c9", "#d3f9d8",
  "#c5f6fa", "#d0ebff", "#e5dbff", "#f1f3f5",
];

const SIZE_OPTIONS = [
  { label: "默认", value: null },
  { label: "12px", value: "12px" },
  { label: "13px", value: "13px" },
  { label: "14px", value: "14px" },
  { label: "16px", value: "16px" },
  { label: "18px", value: "18px" },
  { label: "20px", value: "20px" },
  { label: "24px", value: "24px" },
  { label: "28px", value: "28px" },
  { label: "32px", value: "32px" },
  { label: "40px", value: "40px" },
];

const BLOCK_OPTIONS = [
  { value: "paragraph", label: "正文", preview: "fx-preview-p" },
  { value: "h1", label: "一级标题", preview: "fx-preview-h1" },
  { value: "h2", label: "二级标题", preview: "fx-preview-h2" },
  { value: "h3", label: "三级标题", preview: "fx-preview-h3" },
  { value: "blockquote", label: "引用", preview: "fx-preview-quote" },
  { value: "codeBlock", label: "代码块", preview: "fx-preview-code" },
];

const CODE_LANGUAGES = [
  { value: "plaintext", label: "纯文本" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "json", label: "JSON" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "scss", label: "SCSS" },
  { value: "bash", label: "Shell" },
  { value: "sql", label: "SQL" },
  { value: "xml", label: "XML" },
  { value: "markdown", label: "Markdown" },
];

const DOUBLE_CLICK_WINDOW = 210;

export default {
  name: "FocusEditorToolbar",

  components: { AppIcon },

  directives: { tip },

  props: {
    editor: { type: Object, default: null },
    spacious: { type: Boolean, default: false },
    formatSample: { type: Object, default: null },
    keepPasteStyle: { type: Boolean, default: false },
    codeWrap: { type: Boolean, default: true },
  },

  emits: [
    "sample-format",
    "clear-format",
    "toggle-paste-style",
    "toggle-code-wrap",
    "copy-code",
    "edit-link",
    "insert-image",
    "request-task",
    "open-markdown",
  ],

  data() {
    return {
      pop: null,
      popStyle: {},
      painterTimer: null,
      textColors: TEXT_COLORS,
      highlightColors: HIGHLIGHT_COLORS,
      sizeOptions: SIZE_OPTIONS,
      blockOptions: BLOCK_OPTIONS,
      codeLanguages: CODE_LANGUAGES,
      lastTextColor: TEXT_COLORS[2],
      lastHighlight: HIGHLIGHT_COLORS[0],
    };
  },

  computed: {
    isPainterLocked() {
      return Boolean(this.formatSample && this.formatSample.sticky);
    },

    painterTip() {
      if (!this.formatSample) {
        return {
          label: "格式刷：单击取样，双击锁定连刷",
          keys: "⌘⌥C",
        };
      }

      return {
        label:
          (this.isPainterLocked ? "连刷中" : "已取样") +
          "（" +
          (this.formatSample.summary || "默认样式") +
          "）：选中文字即套用，Esc 退出",
      };
    },

    pasteTip() {
      return this.keepPasteStyle
        ? { label: "粘贴保留来源样式（点击改为清洗）", keys: "⌘⇧V 纯文本" }
        : { label: "粘贴清洗来源样式（点击改为保留）", keys: "⌘⇧V 纯文本" };
    },

    currentBlock() {
      if (!this.editor) return "paragraph";

      if (this.editor.isActive("codeBlock")) return "codeBlock";
      if (this.editor.isActive("blockquote")) return "blockquote";

      for (const level of [1, 2, 3]) {
        if (this.editor.isActive("heading", { level })) {
          return "h" + level;
        }
      }

      return "paragraph";
    },

    blockLabel() {
      const found = BLOCK_OPTIONS.find(
        (item) => item.value === this.currentBlock
      );

      return found ? found.label : "正文";
    },

    currentFontSize() {
      if (!this.editor) return null;

      return this.editor.getAttributes("textStyle").fontSize || null;
    },

    sizeLabel() {
      return this.currentFontSize || "默认";
    },

    hasTextColor() {
      if (!this.editor) return false;

      return Boolean(this.editor.getAttributes("textStyle").color);
    },

    currentTextColor() {
      if (!this.editor) return this.lastTextColor;

      return (
        this.editor.getAttributes("textStyle").color ||
        this.lastTextColor
      );
    },

    currentHighlight() {
      if (!this.editor) return this.lastHighlight;

      return (
        this.editor.getAttributes("highlight").color ||
        this.lastHighlight
      );
    },

    inCodeBlock() {
      return Boolean(this.editor && this.editor.isActive("codeBlock"));
    },

    currentLanguage() {
      if (!this.editor) return "plaintext";

      return (
        this.editor.getAttributes("codeBlock").language || "plaintext"
      );
    },

    languageLabel() {
      const found = CODE_LANGUAGES.find(
        (item) => item.value === this.currentLanguage
      );

      return found ? found.label : "纯文本";
    },
  },

  mounted() {
    document.addEventListener("mousedown", this.onGlobalPointerDown);
    window.addEventListener("resize", this.closePop);
  },

  beforeUnmount() {
    document.removeEventListener("mousedown", this.onGlobalPointerDown);
    window.removeEventListener("resize", this.closePop);
    clearTimeout(this.painterTimer);
  },

  methods: {
    isActive(name, attrs) {
      if (!this.editor) return false;

      return this.editor.isActive(name, attrs);
    },

    run(command, ...args) {
      if (!this.editor) return;

      const chain = this.editor.chain().focus();

      if (typeof chain[command] !== "function") {
        console.warn("[FocusEditorToolbar] 未知命令：" + command);
        return;
      }

      chain[command](...args).run();
    },

    /* ---------- 格式刷：单击一次性，双击锁定 ---------- */

    onPainterClick() {
      clearTimeout(this.painterTimer);

      this.painterTimer = setTimeout(() => {
        this.$emit("sample-format", false);
      }, DOUBLE_CLICK_WINDOW);
    },

    onPainterDoubleClick() {
      clearTimeout(this.painterTimer);
      this.$emit("sample-format", true);
    },

    /* ---------- 浮层定位 ---------- */

    togglePop(name, event) {
      if (this.pop === name) {
        this.closePop();
        return;
      }

      const rect =
        event && event.currentTarget
          ? event.currentTarget.getBoundingClientRect()
          : null;

      if (rect) {
        const width = name === "color" || name === "highlight" ? 232 : 168;
        const height = 260;

        const left = Math.max(
          10,
          Math.min(window.innerWidth - width - 10, rect.left)
        );

        const openAbove =
          rect.bottom + height > window.innerHeight - 10;

        this.popStyle = {
          position: "fixed",
          width: width + "px",
          left: left + "px",
          top: openAbove ? "auto" : rect.bottom + 6 + "px",
          bottom: openAbove
            ? window.innerHeight - rect.top + 6 + "px"
            : "auto",
        };
      }

      this.pop = name;
    },

    closePop() {
      this.pop = null;
    },

    onGlobalPointerDown(event) {
      if (event.target.closest(".fx-pop")) return;
      if (event.target.closest(".fx-toolbar")) return;

      this.closePop();
    },

    /* ---------- 具体命令 ---------- */

    setBlock(value) {
      if (!this.editor) return;

      const chain = this.editor.chain().focus();

      if (value === "paragraph") chain.setParagraph().run();
      else if (value === "blockquote") chain.toggleBlockquote().run();
      else if (value === "codeBlock") chain.toggleCodeBlock().run();
      else chain.setHeading({ level: Number(value.slice(1)) }).run();

      this.closePop();
    },

    setFontSize(value) {
      if (!this.editor) return;

      const chain = this.editor.chain().focus();

      if (!value) chain.unsetFontSize().run();
      else chain.setFontSize(value).run();

      this.closePop();
    },

    setLanguage(value) {
      if (!this.editor) return;

      this.editor
        .chain()
        .focus()
        .updateAttributes("codeBlock", { language: value || "plaintext" })
        .run();

      this.closePop();
    },

    applyTextColor(color) {
      if (!this.editor || !color) return;

      this.lastTextColor = color;
      this.editor.chain().focus().setColor(color).run();
      this.closePop();
    },

    clearTextColor() {
      if (!this.editor) return;

      this.editor.chain().focus().unsetColor().run();
      this.closePop();
    },

    applyHighlight(color) {
      if (!this.editor || !color) return;

      this.lastHighlight = color;
      this.editor.chain().focus().setHighlight({ color }).run();
      this.closePop();
    },

    clearHighlight() {
      if (!this.editor) return;

      this.editor.chain().focus().unsetHighlight().run();
      this.closePop();
    },

    indent() {
      if (!this.editor) return;

      if (this.editor.isActive("taskItem")) {
        this.editor.chain().focus().sinkListItem("taskItem").run();
        return;
      }

      if (this.editor.isActive("listItem")) {
        this.editor.chain().focus().sinkListItem("listItem").run();
        return;
      }

      this.editor.chain().focus().increaseIndent().run();
    },

    outdent() {
      if (!this.editor) return;

      if (this.editor.isActive("taskItem")) {
        this.editor.chain().focus().liftListItem("taskItem").run();
        return;
      }

      if (this.editor.isActive("listItem")) {
        this.editor.chain().focus().liftListItem("listItem").run();
        return;
      }

      this.editor.chain().focus().decreaseIndent().run();
    },
  },
};
</script>

<style scoped lang="scss">
.fx-toolbar {
  position: sticky;
  z-index: 5;
  top: 0;
  display: flex;
  min-height: 40px;
  align-items: center;
  gap: 2px;
  padding: 4px 8px;
  border-bottom: 1px solid #eceef1;
  background: rgba(255, 255, 255, 0.95);
  overflow-x: auto;
  overflow-y: visible;
  scrollbar-width: none;
  backdrop-filter: blur(6px);

  &::-webkit-scrollbar {
    display: none;
  }
}

.fx-group {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 1px;
}

.fx-sep {
  width: 1px;
  height: 16px;
  flex: 0 0 1px;
  margin: 0 5px;
  background: #e5e8ec;
}

.fx-spacer {
  flex: 1 1 auto;
  min-width: 6px;
}

.fx-btn {
  position: relative;
  display: grid;
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #575e68;
  cursor: pointer;
  transition:
    background-color 0.13s ease,
    color 0.13s ease;
}

.fx-btn:hover {
  background: #f0f2f5;
  color: #24282e;
}

.fx-btn.is-on {
  background: #eef2ff;
  color: #4263eb;
}

.fx-btn.is-locked {
  background: #e5ecff;
}

.fx-lock {
  position: absolute;
  right: 3px;
  bottom: 3px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #4263eb;
}

/* 段落样式 / 字号 / 语言：自绘下拉，避免原生 select 的系统外观 */
.fx-select {
  display: flex;
  height: 28px;
  min-width: 76px;
  align-items: center;
  justify-content: space-between;
  gap: 3px;
  padding: 0 5px 0 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #4a515b;
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.13s ease;
}

.fx-select.is-narrow {
  min-width: 62px;
}

.fx-select:hover,
.fx-select.is-open {
  background: #f0f2f5;
}

.fx-select-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fx-caret {
  width: 12px;
  height: 12px;
  opacity: 0.55;
}

/* 颜色分体按钮 */
.fx-split {
  display: flex;
  height: 28px;
  align-items: center;
  border-radius: 6px;
  overflow: hidden;
}

.fx-split:hover,
.fx-split.is-open {
  background: #f0f2f5;
}

.fx-split-main {
  display: flex;
  width: 26px;
  height: 28px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #575e68;
  cursor: pointer;
}

.fx-split-main.is-on {
  color: #4263eb;
}

.fx-bar {
  display: block;
  width: 14px;
  height: 3px;
  border-radius: 2px;
}

.fx-split-caret {
  display: grid;
  width: 14px;
  height: 28px;
  place-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: #8d949d;
  cursor: pointer;
}

.dark-theme .fx-toolbar {
  border-color: #262d36;
  background: rgba(22, 27, 34, 0.95);
}

.dark-theme .fx-sep {
  background: #2f3741;
}

.dark-theme .fx-btn,
.dark-theme .fx-select,
.dark-theme .fx-split-main {
  color: #b9c0c9;
}

.dark-theme .fx-btn:hover,
.dark-theme .fx-select:hover,
.dark-theme .fx-select.is-open,
.dark-theme .fx-split:hover,
.dark-theme .fx-split.is-open {
  background: #242b34;
  color: #e0e5eb;
}

.dark-theme .fx-btn.is-on,
.dark-theme .fx-split-main.is-on {
  background: #1e2740;
  color: #8da2fb;
}
</style>

<style lang="scss">
/* 浮层 Teleport 到 body，样式不能 scoped。 */
.fx-pop {
  z-index: 22000;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px;
  border: 1px solid rgba(31, 35, 41, 0.12);
  border-radius: 10px;
  background: #fff;
  box-shadow:
    0 16px 42px rgba(24, 29, 38, 0.16),
    0 2px 8px rgba(24, 29, 38, 0.07);
}

.fx-pop-scroll {
  display: flex;
  max-height: 262px;
  flex-direction: column;
  gap: 1px;
  overflow-y: auto;
}

.fx-pop-title {
  padding: 2px 6px;
  color: #868d96;
  font-size: 10.5px;
  font-weight: 500;
}

.fx-pop-row {
  display: flex;
  width: 100%;
  align-items: center;
  padding: 7px 9px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #3f454e;
  font-family: inherit;
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
}

.fx-pop-row.is-compact {
  padding: 5px 9px;
  font-size: 12px;
}

.fx-pop-row:hover {
  background: #f0f2f5;
}

.fx-pop-row.selected {
  background: #eef2ff;
  color: #4263eb;
}

.fx-preview-h1 { font-size: 17px; font-weight: 680; }
.fx-preview-h2 { font-size: 15px; font-weight: 660; }
.fx-preview-h3 { font-size: 13.5px; font-weight: 640; }
.fx-preview-quote { padding-left: 7px; border-left: 2px solid #98a9e8; color: #6d747e; }
.fx-preview-code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; }

.fx-swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  padding: 0 6px 2px;
}

.fx-swatch {
  width: 20px;
  height: 20px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 50%;
  cursor: pointer;
}

.fx-swatch.selected {
  box-shadow: 0 0 0 2px #fff, 0 0 0 4px #4263eb;
}

.fx-swatch-reset {
  height: 20px;
  padding: 0 9px;
  border: 1px solid #dfe3e8;
  border-radius: 10px;
  background: #fff;
  color: #6a717b;
  font-family: inherit;
  font-size: 10px;
  cursor: pointer;
}

.fx-custom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 6px 2px;
  border-top: 1px solid #eef0f3;
  color: #868d96;
  font-size: 10.5px;
}

.fx-custom input {
  width: 34px;
  height: 22px;
  padding: 0;
  border: 1px solid #dfe3e8;
  border-radius: 5px;
  background: none;
  cursor: pointer;
}

.dark-theme .fx-pop {
  border-color: #39414c;
  background: #1d232b;
}

.dark-theme .fx-pop-row {
  color: #d3d8de;
}

.dark-theme .fx-pop-row:hover {
  background: #262e38;
}

.dark-theme .fx-pop-row.selected {
  background: #1e2740;
  color: #8da2fb;
}

.dark-theme .fx-custom {
  border-color: #333a44;
}
</style>
