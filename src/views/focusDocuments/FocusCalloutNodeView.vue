<!-- FOCUS_EXPERIENCE_20261005_V2 -->
<template>
  <NodeViewWrapper
    ref="card"
    as="aside"
    class="focus-callout fc2"
    :class="`is-${tone}`"
    :style="cssVariables"
    data-type="focus-callout"
    :data-tone="tone"
    :data-color="color"
  >
    <div class="fc2-icon-area" contenteditable="false">
      <button
        type="button"
        class="fc2-icon-button"
        :aria-label="`${palette.label}高亮块，打开设置`"
        :aria-expanded="String(menuOpen)"
        @mousedown.prevent
        @click.stop="menuOpen = !menuOpen"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path :d="iconPath" />
        </svg>
      </button>
    </div>

    <NodeViewContent class="focus-callout-content fc2-content" />

    <section
      v-if="menuOpen"
      class="fc2-panel"
      contenteditable="false"
      aria-label="高亮块设置"
      @keydown.esc.stop.prevent="menuOpen = false"
      @mousedown.stop
    >
      <strong>高亮块</strong>

      <div class="fc2-types" role="group" aria-label="语义类型">
        <button
          v-for="(item, key) in types"
          :key="key"
          type="button"
          :aria-pressed="String(tone === key)"
          @click="change({ tone: key })"
        >
          {{ item.label }}
        </button>
      </div>

      <small>背景配色</small>

      <div class="fc2-colors" role="group" aria-label="背景配色">
        <button
          type="button"
          aria-label="跟随类型颜色"
          :aria-pressed="String(color === 'default')"
          @click="change({ color: 'default' })"
        >↺</button>

        <button
          v-for="(item, key) in colors"
          :key="key"
          type="button"
          :aria-label="item.label"
          :title="item.label"
          :aria-pressed="String(color === key)"
          :style="{ background: item.accent }"
          @click="change({ color: key })"
        >
          <span v-if="color === key" aria-hidden="true">✓</span>
        </button>
      </div>

      <label class="fc2-custom">
        <span>自定义主题色</span>
        <input
          type="color"
          :value="palette.accent"
          aria-label="自定义高亮块主题色"
          @change="change({ color: $event.target.value })"
        />
      </label>

      <p>新建高亮块会记住本次类型和颜色。</p>

      <button type="button" class="fc2-unwrap" @click="unwrap">
        转为正文，保留内容
      </button>
    </section>
  </NodeViewWrapper>
</template>

<script>
import {
  NodeViewWrapper,
  NodeViewContent,
  nodeViewProps,
} from "@tiptap/vue-3";
import {
  CALLOUT_TYPES,
  CALLOUT_COLORS,
  normalizeCalloutTone,
  normalizeCalloutColor,
  getCalloutPresentation,
  getCalloutCssVariables,
  rememberCalloutPreference,
} from "../../services/focusCalloutPresentation.mjs";

export default {
  name: "FocusCalloutNodeView",
  components: { NodeViewWrapper, NodeViewContent },
  props: nodeViewProps,

  data() {
    return { menuOpen: false };
  },

  computed: {
    types() { return CALLOUT_TYPES; },
    colors() { return CALLOUT_COLORS; },
    tone() { return normalizeCalloutTone(this.node.attrs.tone); },
    color() { return normalizeCalloutColor(this.node.attrs.color); },
    palette() { return getCalloutPresentation(this.tone, this.color); },
    cssVariables() { return getCalloutCssVariables(this.tone, this.color); },
    iconPath() {
      const paths = {
        info: "M12 8h.01M11 11h1v6h1M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z",
        tip: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z",
        success: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM7.5 12l3 3L17 8.5",
        warning: "m12 3 10 18H2L12 3ZM12 9v5m0 3h.01",
        danger: "M8 3h8l5 5v8l-5 5H8l-5-5V8l5-5ZM12 7v7m0 3h.01",
      };
      return paths[this.tone];
    },
  },

  mounted() {
    document.addEventListener("pointerdown", this.outside);
  },

  beforeUnmount() {
    document.removeEventListener("pointerdown", this.outside);
  },

  methods: {
    outside(event) {
      const root = this.$refs.card?.$el || this.$refs.card;
      if (!root?.contains?.(event.target)) this.menuOpen = false;
    },

    change(patch) {
      const attrs = {
        tone: normalizeCalloutTone(patch.tone ?? this.tone),
        color: normalizeCalloutColor(patch.color ?? this.color),
      };

      this.updateAttributes(attrs);
      rememberCalloutPreference(attrs);
    },

    unwrap() {
      const position = this.getPos();
      if (!Number.isInteger(position)) return;

      this.menuOpen = false;

      this.editor
        .chain()
        .setTextSelection(position + 1)
        .unwrapFocusCallout()
        .focus()
        .run();
    },
  },
};
</script>

<style lang="scss">
.focus-callout.fc2 {
  position: relative;
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  gap: 11px;
  margin: 16px 0;
  padding: 15px 16px;
  border: 1px solid var(--fc-border);
  border-radius: 8px;
  background: var(--fc-bg);
  color: #29313d;
}

.fc2-icon-button {
  display: grid;
  width: 22px;
  height: 24px;
  place-items: center;
  margin-top: 1px;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--fc-accent);
  cursor: pointer;

  &:hover { background: rgba(0, 0, 0, 0.06); }
  &:focus-visible { outline: 2px solid var(--fc-accent); }

  svg {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.7;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
}

.fc2-content {
  min-width: 0;

  > :first-child { margin-top: 0; }
  > :last-child { margin-bottom: 0; }
}

.fc2-panel {
  position: absolute;
  z-index: 60;
  top: 42px;
  left: 12px;
  width: min(300px, calc(100% - 24px));
  box-sizing: border-box;
  padding: 12px;
  border: 1px solid #dce2e9;
  border-radius: 10px;
  background: #fff;
  color: #29313d;
  box-shadow: 0 12px 32px rgba(20, 26, 36, 0.16);

  strong { display: block; margin-bottom: 10px; font-size: 12px; }
  small { display: block; margin: 12px 0 7px; color: #87919e; font-size: 10px; }
  p { margin: 9px 0 !important; color: #87919e; font-size: 10px; }
}

.fc2-types {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;

  button {
    padding: 4px 7px;
    border: 1px solid #e0e5ec;
    border-radius: 5px;
    background: transparent;
    color: inherit;
    font-size: 11px;
    cursor: pointer;
  }

  button[aria-pressed="true"] {
    border-color: #879bd7;
    background: #edf2ff;
  }
}

.fc2-colors {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;

  button {
    display: grid;
    width: 24px;
    height: 24px;
    place-items: center;
    padding: 0;
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 50%;
    background: #f1f3f6;
    color: #fff;
    font-size: 13px;
    cursor: pointer;
  }

  button:first-child { color: #697584; }

  button[aria-pressed="true"] {
    outline: 2px solid #8b9bc0;
    outline-offset: 2px;
  }
}

.fc2-custom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
  font-size: 11px;

  input {
    width: 36px;
    height: 25px;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
  }
}

.fc2-unwrap {
  width: 100%;
  padding: 7px;
  border: 1px solid #dce2e9;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font-size: 11px;
  cursor: pointer;
}

.dark-theme {
  .focus-callout.fc2 {
    border-color: var(--fc-dark-border);
    background: var(--fc-dark-bg);
    color: #e2e8f0;
  }

  .fc2-icon-button { color: var(--fc-dark-accent); }
  .fc2-panel { border-color: #3b4654; background: #232b36; color: #e2e8f0; }
  .fc2-types button, .fc2-unwrap { border-color: #465164; }
  .fc2-types button[aria-pressed="true"] { background: #344364; }
}
</style>
