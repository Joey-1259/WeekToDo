<!-- FOCUS_CALLOUT_COLOR_20261007_V3 -->
<template>
  <NodeViewWrapper
    as="aside"
    class="focus-callout fc3"
    :class="{ 'is-active': barVisible, 'is-selected': selected }"
    :style="cssVariables"
    data-type="focus-callout"
    :data-color="effectiveColor"
  >
    <!-- v-show 而非 v-if：原生取色器打开时编辑器会失焦，
         输入框必须保持挂载，change 事件才能送达。 -->
    <div
      v-show="barVisible"
      class="fc3-bar"
      :class="{ 'is-below': below }"
      contenteditable="false"
      role="toolbar"
      aria-label="高亮块"
      @mousedown="onBarMouseDown"
    >
      <button
        v-for="item in swatches"
        :key="item.key"
        type="button"
        class="fc3-swatch"
        :class="{ 'is-current': item.key === effectiveColor }"
        :style="item.style"
        :title="item.label"
        :aria-label="item.label"
        :aria-pressed="String(item.key === effectiveColor)"
        @click="apply(item.key)"
      >
        <svg v-if="item.key === effectiveColor" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M3.5 8.4 6.6 11.4 12.5 4.8" />
        </svg>
      </button>

      <label
        class="fc3-swatch fc3-custom"
        :class="{ 'is-current': isCustom }"
        title="自定义颜色"
      >
        <input
          type="color"
          :value="palette.accent"
          aria-label="自定义高亮块颜色"
          @focus="picking = true"
          @blur="picking = false"
          @input="previewColor = $event.target.value"
          @change="apply($event.target.value)"
        />
      </label>

      <span class="fc3-sep" aria-hidden="true"></span>

      <button
        type="button"
        class="fc3-action"
        title="去掉底色，保留内容"
        @click="unwrap"
      >
        转为正文
      </button>

      <button
        type="button"
        class="fc3-action is-icon is-danger"
        title="删除高亮块及其内容"
        aria-label="删除高亮块"
        @click="remove"
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.2c.05.7.6 1.3 1.3 1.3h3.2c.7 0 1.25-.6 1.3-1.3l.6-8.2M6.8 7v4.5M9.2 7v4.5" />
        </svg>
      </button>
    </div>

    <NodeViewContent class="focus-callout-content fc3-content" />
  </NodeViewWrapper>
</template>

<script>
import {
  NodeViewWrapper,
  NodeViewContent,
  nodeViewProps,
} from "@tiptap/vue-3";
import {
  CALLOUT_COLORS,
  normalizeCalloutTone,
  resolveCalloutColor,
  getCalloutPresentation,
  getCalloutCssVariables,
  rememberCalloutPreference,
} from "../../services/focusCalloutPresentation.mjs";

export default {
  name: "FocusCalloutNodeView",
  components: { NodeViewWrapper, NodeViewContent },
  props: nodeViewProps,

  data() {
    return {
      inside: false,
      below: false,
      picking: false,
      previewColor: "",
    };
  },

  computed: {
    tone() {
      return normalizeCalloutTone(this.node.attrs.tone);
    },

    effectiveColor() {
      return resolveCalloutColor(this.tone, this.node.attrs.color);
    },

    isCustom() {
      return this.effectiveColor.startsWith("#");
    },

    shownColor() {
      return this.previewColor || this.effectiveColor;
    },

    palette() {
      return getCalloutPresentation(this.tone, this.shownColor);
    },

    cssVariables() {
      return getCalloutCssVariables(this.tone, this.shownColor);
    },

    swatches() {
      return Object.entries(CALLOUT_COLORS).map(([key, item]) => {
        const preset = getCalloutPresentation(this.tone, key);

        return {
          key,
          label: item.label,
          style: {
            "--sw-bg": preset.background,
            "--sw-border": preset.border,
            "--sw-accent": preset.accent,
            "--sw-dark-bg": preset.darkBackground,
            "--sw-dark-border": preset.darkBorder,
          },
        };
      });
    },

    barVisible() {
      return Boolean(
        this.editor?.isEditable &&
          (this.inside || this.selected || this.picking)
      );
    },
  },

  watch: {
    "node.attrs.color"() {
      this.previewColor = "";
    },
  },

  mounted() {
    this.editor.on("selectionUpdate", this.sync);
    this.editor.on("update", this.sync);
    this.editor.on("focus", this.sync);
    this.editor.on("blur", this.onBlur);
    this.sync();
  },

  beforeUnmount() {
    this.editor.off("selectionUpdate", this.sync);
    this.editor.off("update", this.sync);
    this.editor.off("focus", this.sync);
    this.editor.off("blur", this.onBlur);
  },

  methods: {
    position() {
      try {
        const pos = this.getPos();
        return Number.isInteger(pos) ? pos : null;
      } catch {
        return null;
      }
    },

    sync() {
      const pos = this.position();

      if (pos === null || this.editor.isDestroyed) {
        this.inside = false;
        return;
      }

      const { from, to } = this.editor.state.selection;
      const end = pos + this.node.nodeSize;
      const next = this.editor.view.hasFocus() && from > pos && to < end;

      if (next && !this.inside) this.$nextTick(this.measure);
      this.inside = next;
    },

    onBlur() {
      setTimeout(() => {
        if (!this.picking) this.sync();
      }, 0);
    },

    /* 块距离滚动区顶部不足一条工具条高度时，工具条翻到块下方。 */
    measure() {
      const root = this.$el;
      if (!root?.getBoundingClientRect) return;

      const scroller = root.closest(".focus-editor-content");
      const top =
        root.getBoundingClientRect().top -
        (scroller ? scroller.getBoundingClientRect().top : 0);

      this.below = top < 48;
    },

    /* 点击工具条不抢编辑器焦点；自定义取色器除外（它需要拿到焦点）。 */
    onBarMouseDown(event) {
      if (!event.target.closest(".fc3-custom")) event.preventDefault();
    },

    apply(color) {
      const pos = this.position();
      if (pos === null) return;

      this.previewColor = "";
      this.editor.commands.updateFocusCallout({ color }, pos);
      rememberCalloutPreference({ tone: this.tone, color });
    },

    unwrap() {
      const pos = this.position();
      if (pos === null) return;
      this.editor.chain().focus().unwrapFocusCallout(pos).run();
    },

    remove() {
      const pos = this.position();
      if (pos === null) return;
      this.editor.chain().focus().deleteFocusCallout(pos).run();
    },
  },
};
</script>

<style lang="scss">
/* FOCUS_CALLOUT_COLOR_20261007_V3：前缀 fc3-，与旧版 fc2- 完全隔离 */
.focus-callout.fc3 {
  position: relative;
  margin: 12px 0;
  padding: 12px 16px;
  border: 1px solid var(--fc-border);
  border-radius: 8px;
  background: var(--fc-bg);
  color: #29313d;
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease,
    box-shadow 0.16s ease;

  &.is-selected,
  &.ProseMirror-selectednode {
    box-shadow: 0 0 0 2px rgba(66, 99, 235, 0.28);
  }
}

.fc3-content {
  min-width: 0;

  > :first-child { margin-top: 0; }
  > :last-child { margin-bottom: 0; }

  > p.is-empty:only-child::before {
    content: "输入高亮内容…";
    float: left;
    height: 0;
    color: rgba(41, 49, 61, 0.38);
    pointer-events: none;
  }
}

.fc3-bar {
  position: absolute;
  z-index: 30;
  bottom: calc(100% + 6px);
  left: 8px;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 6px;
  border: 1px solid #e1e5ea;
  border-radius: 9px;
  background: #fff;
  box-shadow:
    0 8px 24px rgba(24, 29, 38, 0.14),
    0 1px 3px rgba(24, 29, 38, 0.06);
  line-height: 1;
  white-space: nowrap;
  user-select: none;

  &.is-below {
    top: calc(100% + 6px);
    bottom: auto;
  }
}

.fc3-swatch {
  position: relative;
  display: inline-grid;
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
  place-items: center;
  box-sizing: border-box;
  padding: 0;
  border: 1px solid var(--sw-border);
  border-radius: 50%;
  background: var(--sw-bg);
  color: var(--sw-accent);
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease;

  &:hover { transform: scale(1.12); }

  &.is-current {
    box-shadow: 0 0 0 2px #fff, 0 0 0 3.5px var(--sw-accent);
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px #fff, 0 0 0 3.5px #4263eb;
  }

  svg {
    width: 12px;
    height: 12px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
}

.fc3-custom {
  overflow: hidden;
  border-color: rgba(0, 0, 0, 0.12);
  background: conic-gradient(
    #f6c4c4, #f6e2a6, #c7ebcf, #bfe3ee, #cdd4f6, #e5cdf2, #f6c4c4
  );

  &.is-current {
    box-shadow: 0 0 0 2px #fff, 0 0 0 3.5px var(--fc-accent);
  }

  input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    padding: 0;
    border: 0;
    opacity: 0;
    cursor: pointer;
  }
}

.fc3-sep {
  width: 1px;
  height: 16px;
  margin: 0 2px;
  background: #e3e6ea;
}

.fc3-action {
  display: inline-flex;
  height: 24px;
  align-items: center;
  padding: 0 7px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #4f5863;
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;

  &:hover { background: #f0f2f5; color: #2f353d; }

  &.is-icon {
    width: 24px;
    justify-content: center;
    padding: 0;
  }

  &.is-danger:hover { background: #fdecec; color: #c84444; }

  svg {
    width: 14px;
    height: 14px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
}

.dark-theme {
  .focus-callout.fc3 {
    border-color: var(--fc-dark-border);
    background: var(--fc-dark-bg);
    color: #e2e8f0;
  }

  .fc3-content > p.is-empty:only-child::before {
    color: rgba(226, 232, 240, 0.38);
  }

  .fc3-bar {
    border-color: #39414c;
    background: #1d232b;
  }

  .fc3-swatch {
    border-color: var(--sw-dark-border);
    background: var(--sw-dark-bg);

    &.is-current {
      box-shadow: 0 0 0 2px #1d232b, 0 0 0 3.5px var(--sw-accent);
    }
  }

  .fc3-swatch.fc3-custom {
    border-color: rgba(255, 255, 255, 0.16);
    background: conic-gradient(
      #8a5656, #8a7a4a, #4f7a5c, #4a7584, #5a6390, #7a5a8a, #8a5656
    );
  }

  .fc3-sep { background: #333a44; }

  .fc3-action {
    color: #c4cad1;

    &:hover { background: #262e38; color: #e1e5ea; }
    &.is-danger:hover { background: rgba(209, 67, 67, 0.16); color: #ef9292; }
  }
}
</style>
