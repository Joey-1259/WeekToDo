<template>
  <div class="fx-toolbar" role="toolbar" aria-label="文档格式工具栏">
    <!-- 1 · 格式工具 -->
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
        <i v-if="isPainterLocked" class="fx-dot" aria-hidden="true"></i>
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

    <!-- 2 · 段落样式与字号 -->
    <div class="fx-group">
      <button
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

    <!-- 3 · 行内样式 -->
    <div class="fx-group">
      <button
        type="button"
        class="fx-btn"
        :class="{ 'is-on': isActive('bold') }"
        v-tip="{ label: '加粗', keys: '⌘B' }"
        @mousedown.prevent
        @click="$emit('run', 'toggleBold')"
      >
        <AppIcon name="bold" />
      </button>

      <button
        type="button"
        class="fx-btn"
        :class="{ 'is-on': isActive('italic') }"
        v-tip="{ label: '斜体', keys: '⌘I' }"
        @mousedown.prevent
        @click="$emit('run', 'toggleItalic')"
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
        @click="$emit('run', 'toggleUnderline')"
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
        @click="$emit('run', 'toggleStrike')"
      >
        <AppIcon name="strike" />
      </button>

      <!-- 文字颜色：主区域套用当前色，箭头开调色板 -->
      <div class="fx-split" :class="{ 'is-open': pop === 'color' }">
        <button
          type="button"
          class="fx-split-main"
          :class="{ 'is-on': hasTextColor }"
          v-tip="{ label: '文字颜色（套用当前色）' }"
          @mousedown.prevent
          @click="$emit('apply-text-color', selectedTextColor)"
        >
          <AppIcon name="textColor" />
          <i class="fx-bar" :style="{ background: selectedTextColor }"></i>
        </button>

        <button
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
          v-tip="{ label: '高亮（套用当前色）' }"
          @mousedown.prevent
          @click="$emit('apply-highlight', selectedHighlightColor)"
        >
          <AppIcon name="highlight" />
          <i class="fx-bar" :style="{ background: selectedHighlightColor }"></i>
        </button>

        <button
          type="button"
          class="fx-split-caret"
          v-tip="{ label: '选择高亮色' }"
          @mousedown.prevent
          @click.stop="togglePop('highlight', $event)"
        >
          <AppIcon name="chevronDown" class="fx-caret" />
        </button>
      </div>

      <button
        v-if="spacious"
        type="button"
        class="fx-btn"
        :class="{ 'is-on': isActive('code') }"
        v-tip="{ label: '行内代码', keys: '⌘E' }"
        @mousedown.prevent
        @click="$emit('run', 'toggleCode')"
      >
        <AppIcon name="inlineCode" />
      </button>
    </div>

    <span class="fx-sep"></span>

    <!-- 4 · 列表与缩进 -->
    <div class="fx-group">
      <button
        type="button"
        class="fx-btn"
        :class="{ 'is-on': isActive('bulletList') }"
        v-tip="{ label: '无序列表' }"
        @mousedown.prevent
        @click="$emit('run', 'toggleBulletList')"
      >
        <AppIcon name="bulletList" />
      </button>

      <button
        type="button"
        class="fx-btn"
        :class="{ 'is-on': isActive('orderedList') }"
        v-tip="{ label: '有序列表' }"
        @mousedown.prevent
        @click="$emit('run', 'toggleOrderedList')"
      >
        <AppIcon name="orderedList" />
      </button>

      <button
        type="button"
        class="fx-btn"
        :class="{ 'is-on': isActive('taskList') }"
        v-tip="{ label: '待办清单' }"
        @mousedown.prevent
        @click="$emit('run', 'toggleTaskList')"
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
        @click="$emit('run', 'toggleBlockquote')"
      >
        <AppIcon name="quote" />
      </button>

      <button
        v-if="spacious"
        type="button"
        class="fx-btn"
        v-tip="{ label: '减少缩进', keys: '⇧Tab' }"
        @mousedown.prevent
        @click="$emit('outdent')"
      >
        <AppIcon name="indentDecrease" />
      </button>

      <button
        v-if="spacious"
        type="button"
        class="fx-btn"
        v-tip="{ label: '增加缩进', keys: 'Tab' }"
        @mousedown.prevent
        @click="$emit('indent')"
      >
        <AppIcon name="indentIncrease" />
      </button>
    </div>

    <span class="fx-sep"></span>

    <!-- 5 · 插入 -->
    <div class="fx-group">
      <button
        v-if="hasLinkMark"
        type="button"
        class="fx-btn"
        :class="{ 'is-on': isActive('link') || pop === 'link' }"
        v-tip="{ label: '链接', keys: '⌘K' }"
        @mousedown.prevent
        @click.stop="openLinkPop($event)"
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
        :class="{ 'is-on': isActive('codeBlock') }"
        v-tip="{ label: '代码块' }"
        @mousedown.prevent
        @click="$emit('run', 'toggleCodeBlock')"
      >
        <AppIcon name="codeBlock" />
      </button>

      <button
        v-if="spacious"
        type="button"
        class="fx-btn"
        v-tip="{ label: '分割线' }"
        @mousedown.prevent
        @click="$emit('run', 'setHorizontalRule')"
      >
        <AppIcon name="horizontalRule" />
      </button>
    </div>

    <!-- 6 · 代码块上下文工具 -->
    <template v-if="inCodeBlock">
      <span class="fx-sep"></span>

      <div class="fx-group">
        <button
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
        <template v-if="pop === 'block'">
          <button
            v-for="item in blockOptions"
            :key="item.value"
            type="button"
            class="fx-pop-row"
            :class="{ selected: currentBlock === item.value }"
            @click="chooseBlock(item.value)"
          >
            <span :class="item.preview">{{ item.label }}</span>
          </button>
        </template>

        <template v-else-if="pop === 'size'">
          <div class="fx-pop-scroll">
            <button
              v-for="item in sizeOptions"
              :key="item.label"
              type="button"
              class="fx-pop-row is-compact"
              :class="{ selected: normalizedFontSize === item.value }"
              @click="chooseFontSize(item.value)"
            >
              {{ item.label }}
            </button>
          </div>
        </template>

        <template v-else-if="pop === 'lang'">
          <div class="fx-pop-scroll">
            <button
              v-for="item in (codeLanguages || [])"
              :key="item.value"
              type="button"
              class="fx-pop-row is-compact"
              :class="{ selected: currentCodeLanguage === item.value }"
              @click="chooseLanguage(item.value)"
            >
              {{ item.label }}
            </button>
          </div>
        </template>

        <template v-else-if="pop === 'color'">
          <strong class="fx-pop-title">文字颜色</strong>
          <div class="fx-swatches">
            <button
              type="button"
              class="fx-swatch-reset"
              @click="emitAndClose('clear-text-color')"
            >
              自动
            </button>
            <button
              v-for="color in (textColors || [])"
              :key="color"
              type="button"
              class="fx-swatch"
              :class="{ selected: selectedTextColor === color }"
              :style="{ background: color }"
              :title="color"
              @click="emitAndClose('apply-text-color', color)"
            ></button>
          </div>
          <label class="fx-custom">
            <span>自定义</span>
            <input
              type="color"
              :value="selectedTextColor"
              @input="$emit('apply-text-color', $event.target.value)"
            />
          </label>
        </template>

        <template v-else-if="pop === 'highlight'">
          <strong class="fx-pop-title">高亮颜色</strong>
          <div class="fx-swatches">
            <button
              type="button"
              class="fx-swatch-reset"
              @click="emitAndClose('clear-highlight')"
            >
              无
            </button>
            <button
              v-for="color in (highlightColors || [])"
              :key="color"
              type="button"
              class="fx-swatch"
              :class="{ selected: selectedHighlightColor === color }"
              :style="{ background: color }"
              :title="color"
              @click="emitAndClose('apply-highlight', color)"
            ></button>
          </div>
          <label class="fx-custom">
            <span>自定义</span>
            <input
              type="color"
              :value="selectedHighlightColor"
              @input="$emit('apply-highlight', $event.target.value)"
            />
          </label>
        </template>

        <template v-else-if="pop === 'link'">
          <strong class="fx-pop-title">链接地址</strong>
          <input
            ref="linkInput"
            v-model.trim="linkDraft"
            class="fx-link-input"
            type="text"
            placeholder="https://"
            @keydown.enter.prevent="commitLink"
            @keydown.esc.stop.prevent="closePop"
          />
          <div class="fx-pop-footer">
            <button
              v-if="isActive('link')"
              type="button"
              class="fx-text-button"
              @click="removeLink"
            >
              移除链接
            </button>
            <span class="fx-spacer"></span>
            <button type="button" class="fx-text-button" @click="closePop">
              取消
            </button>
            <button
              type="button"
              class="fx-text-button is-primary"
              @click="commitLink"
            >
              确定
            </button>
          </div>
        </template>
      </div>
    </Teleport>
  </div>
</template>

<script>
/* FOCUS_UI_SYSTEM_20260909_V4 */
import AppIcon from "../../components/ui/AppIcon.vue";
import { tip } from "../../directives/tooltip";

/**
 * 单文本工具栏（纯受控表现层）。
 *
 * 设计原则：这个组件不持有任何编辑器业务逻辑。
 * 所有状态由 FocusDocumentEditor 以 props 注入，所有动作 emit 回去，
 * 由父组件里已经存在并且久经使用的方法（run / setBlock / setFontSize /
 * applyTextColor / increaseIndent ...）执行。
 *
 * 这么做的原因很实际：直接在工具栏里调 editor.chain().setFontSize() 之类
 * 需要假设对应的 tiptap 扩展命令存在，而本项目的字号、缩进、颜色能力是
 * 由父组件的方法实现的，绕过去必然 "chain[x] is not a function"。
 *
 * 唯一的例外是链接浮层——父组件目前没有对应方法，所以这里直连 editor，
 * 并且用 hasLinkMark 守住：schema 里没有 link mark 时按钮根本不渲染。
 */

const SIZE_OPTIONS = [
  { label: "12px", value: "12px" },
  { label: "14px（默认）", value: "" },
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
    currentBlock: { type: String, default: "paragraph" },
    currentFontSize: { type: String, default: "" },
    currentCodeLanguage: { type: String, default: "" },
    codeLanguages: { type: Array, default: () => [] },
    textColors: { type: Array, default: () => [] },
    highlightColors: { type: Array, default: () => [] },
    selectedTextColor: { type: String, default: "#292d33" },
    selectedHighlightColor: { type: String, default: "#fff0a6" },
  },

  emits: [
    "run",
    "set-block",
    "set-font-size",
    "set-code-language",
    "sample-format",
    "clear-format",
    "toggle-paste-style",
    "toggle-code-wrap",
    "copy-code",
    "insert-image",
    "request-task",
    "open-markdown",
    "indent",
    "outdent",
    "apply-text-color",
    "clear-text-color",
    "apply-highlight",
    "clear-highlight",
  ],

  data() {
    return {
      pop: null,
      popStyle: {},
      painterTimer: null,
      linkDraft: "",
      sizeOptions: SIZE_OPTIONS,
      blockOptions: BLOCK_OPTIONS,
    };
  },

  computed: {
    isPainterLocked() {
      return Boolean(this.formatSample && this.formatSample.sticky);
    },

    painterTip() {
      if (!this.formatSample) {
        return { label: "格式刷：单击取样，双击锁定连刷", keys: "⌘⌥C" };
      }

      const summary = this.formatSample.summary || "默认样式";

      return {
        label:
          (this.isPainterLocked ? "连刷中" : "已取样") +
          "（" +
          summary +
          "）：选中文字即套用，Esc 退出",
      };
    },

    pasteTip() {
      return this.keepPasteStyle
        ? { label: "粘贴保留来源样式（点击改为清洗）" }
        : { label: "粘贴清洗来源样式（点击改为保留）" };
    },

    blockLabel() {
      if (this.isActive("codeBlock")) return "代码块";
      if (this.isActive("blockquote")) return "引用";

      const found = BLOCK_OPTIONS.find(
        (item) => item.value === this.currentBlock
      );

      return found ? found.label : "正文";
    },

    /** 父组件用 "" 表示 14px 默认值，这里统一成同一套口径。 */
    normalizedFontSize() {
      return this.currentFontSize || "";
    },

    sizeLabel() {
      return this.normalizedFontSize || "14px";
    },

    hasTextColor() {
      if (!this.editor) return false;

      return Boolean(this.editor.getAttributes("textStyle").color);
    },

    inCodeBlock() {
      return this.isActive("codeBlock");
    },

    languageLabel() {
      const found = (this.codeLanguages || []).find(
        (item) => item.value === this.currentCodeLanguage
      );

      return found ? found.label : "纯文本";
    },

    hasLinkMark() {
      return Boolean(
        this.editor && this.editor.schema && this.editor.schema.marks.link
      );
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

      try {
        return this.editor.isActive(name, attrs);
      } catch (error) {
        // schema 里没有这个节点/标记时 isActive 会抛，按"未激活"处理。
        return false;
      }
    },

    /* ---------- 格式刷：210ms 内的第二次点击算双击 ---------- */

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

    /* ---------- 浮层 ---------- */

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
        const wide = ["color", "highlight", "link"].includes(name);
        const width = wide ? 236 : 172;
        const height = 268;

        const left = Math.max(
          10,
          Math.min(window.innerWidth - width - 10, rect.left)
        );

        const openAbove = rect.bottom + height > window.innerHeight - 10;

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

    emitAndClose(name, payload) {
      if (payload === undefined) this.$emit(name);
      else this.$emit(name, payload);

      this.closePop();
    },

    /* ---------- 下拉项 ---------- */

    chooseBlock(value) {
      this.$emit("set-block", value);
      this.closePop();
    },

    chooseFontSize(value) {
      this.$emit("set-font-size", value);
      this.closePop();
    },

    chooseLanguage(value) {
      this.$emit("set-code-language", value);
      this.closePop();
    },

    /* ---------- 链接（父组件暂无对应方法，这里直连 editor） ---------- */

    openLinkPop(event) {
      if (!this.editor) return;

      const attrs = this.editor.getAttributes("link") || {};
      this.linkDraft = attrs.href || "";

      this.togglePop("link", event);

      this.$nextTick(() => {
        if (this.$refs.linkInput) this.$refs.linkInput.focus();
      });
    },

    commitLink() {
      if (!this.editor) return;

      const href = this.linkDraft;

      if (!href) {
        this.removeLink();
        return;
      }

      const normalized = /^(https?:|mailto:|weektodo:|\/)/i.test(href)
        ? href
        : "https://" + href;

      this.editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: normalized })
        .run();

      this.closePop();
    },

    removeLink() {
      if (!this.editor) return;

      this.editor.chain().focus().extendMarkRange("link").unsetLink().run();
      this.closePop();
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
  transition: background-color 0.13s ease, color 0.13s ease;

  &:hover {
    background: #f0f2f5;
    color: #24282e;
  }

  &.is-on {
    background: #eef2ff;
    color: #4263eb;
  }

  &.is-locked {
    background: #e0e8ff;
  }
}

.fx-dot {
  position: absolute;
  right: 3px;
  bottom: 3px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #4263eb;
}

.fx-select {
  display: flex;
  height: 28px;
  min-width: 84px;
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

  &.is-narrow {
    min-width: 68px;
  }

  &:hover,
  &.is-open {
    background: #f0f2f5;
  }
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

.fx-split {
  display: flex;
  height: 28px;
  align-items: center;
  border-radius: 6px;
  overflow: hidden;

  &:hover,
  &.is-open {
    background: #f0f2f5;
  }
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

  &.is-on {
    color: #4263eb;
  }
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
/* 浮层 Teleport 到 body，不能 scoped。 */
.fx-pop {
  z-index: 22000;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px;
  border: 1px solid rgba(31, 35, 41, 0.12);
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 16px 42px rgba(24, 29, 38, 0.16),
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

  &.is-compact {
    padding: 5px 9px;
    font-size: 12px;
  }

  &:hover {
    background: #f0f2f5;
  }

  &.selected {
    background: #eef2ff;
    color: #4263eb;
  }
}

.fx-preview-h1 { font-size: 17px; font-weight: 680; }
.fx-preview-h2 { font-size: 15px; font-weight: 660; }
.fx-preview-h3 { font-size: 13.5px; font-weight: 640; }

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

  &.selected {
    box-shadow: 0 0 0 2px #fff, 0 0 0 4px #4263eb;
  }
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

  input {
    width: 34px;
    height: 22px;
    padding: 0;
    border: 1px solid #dfe3e8;
    border-radius: 5px;
    background: none;
    cursor: pointer;
  }
}

.fx-link-input {
  width: 100%;
  height: 28px;
  padding: 0 8px;
  border: 1px solid #dfe3e8;
  border-radius: 6px;
  color: #2f353d;
  font-family: inherit;
  font-size: 12px;
  outline: none;

  &:focus {
    border-color: #4263eb;
  }
}

.fx-pop-footer {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-top: 2px;
}

.fx-text-button {
  padding: 4px 9px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #626a75;
  font-family: inherit;
  font-size: 11.5px;
  cursor: pointer;

  &:hover {
    background: #f0f2f5;
  }

  &.is-primary {
    background: #4263eb;
    color: #fff;

    &:hover {
      background: #3853cc;
    }
  }
}

.dark-theme .fx-pop {
  border-color: #39414c;
  background: #1d232b;
}

.dark-theme .fx-pop-row {
  color: #d3d8de;

  &:hover {
    background: #262e38;
  }

  &.selected {
    background: #1e2740;
    color: #8da2fb;
  }
}

.dark-theme .fx-custom {
  border-color: #333a44;
}

.dark-theme .fx-link-input {
  border-color: #39414c;
  background: #161b22;
  color: #dfe3e8;
}
</style>
