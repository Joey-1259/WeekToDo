<template>
  <NodeViewWrapper
    as="aside"
    class="focus-callout"
    :class="`is-${tone}`"
    data-type="focus-callout"
    :data-tone="tone"
  >
    <div class="focus-callout-tools" contenteditable="false">
      <span class="focus-callout-icon" aria-hidden="true">
        {{ preset.icon }}
      </span>

      <label class="focus-callout-type">
        <span class="focus-callout-sr">高亮块类型</span>
        <select :value="tone" @change="changeTone">
          <option
            v-for="(item, key) in presets"
            :key="key"
            :value="key"
          >
            {{ item.label }}
          </option>
        </select>
      </label>

      <button
        type="button"
        class="focus-callout-unwrap"
        @mousedown.prevent
        @click="unwrap"
      >
        转为正文
      </button>
    </div>

    <NodeViewContent class="focus-callout-content" />
  </NodeViewWrapper>
</template>

<script>
import {
  NodeViewWrapper,
  NodeViewContent,
  nodeViewProps,
} from "@tiptap/vue-3";
import {
  CALLOUT_PRESETS,
  normalizeCalloutTone,
} from "../../editor/extensions/FocusCallout";

export default {
  name: "FocusCalloutNodeView",
  components: { NodeViewWrapper, NodeViewContent },
  props: nodeViewProps,

  computed: {
    presets() {
      return CALLOUT_PRESETS;
    },
    tone() {
      return normalizeCalloutTone(this.node.attrs.tone);
    },
    preset() {
      return CALLOUT_PRESETS[this.tone];
    },
  },

  methods: {
    changeTone(event) {
      this.updateAttributes({
        tone: normalizeCalloutTone(event.target.value),
      });
    },
    unwrap() {
      const position = this.getPos();
      if (!Number.isInteger(position)) return;

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
.focus-callout {
  --callout-bg: #eaf2ff;
  --callout-border: #b9cff5;
  --callout-accent: #355c9c;

  position: relative;
  margin: 16px 0;
  padding: 12px 16px;
  border: 1px solid var(--callout-border);
  border-radius: 10px;
  background: var(--callout-bg);
  color: #29313d;

  &.is-tip {
    --callout-bg: #f2edff;
    --callout-border: #d0c3ef;
    --callout-accent: #71529b;
  }
  &.is-success {
    --callout-bg: #eaf6ee;
    --callout-border: #b8dcc5;
    --callout-accent: #326d47;
  }
  &.is-warning {
    --callout-bg: #fff4d9;
    --callout-border: #ead294;
    --callout-accent: #88651a;
  }
  &.is-danger {
    --callout-bg: #ffeded;
    --callout-border: #edbcbc;
    --callout-accent: #a74444;
  }
}

.focus-callout-tools {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 5px;
  color: var(--callout-accent);
}

.focus-callout-icon {
  display: inline-grid;
  width: 20px;
  height: 20px;
  place-items: center;
  border: 1px solid currentColor;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 700;
}

.focus-callout-type select {
  max-width: 110px;
  padding: 2px 4px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.focus-callout-unwrap {
  margin-left: auto;
  padding: 3px 7px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: inherit;
  font-size: 11px;
  opacity: 0.55;
  cursor: pointer;
}

.focus-callout-unwrap:hover,
.focus-callout-unwrap:focus-visible {
  background: rgba(0, 0, 0, 0.05);
  opacity: 1;
}

.focus-callout-content {
  min-width: 0;
}

.focus-callout-content > :first-child {
  margin-top: 0;
}

.focus-callout-content > :last-child {
  margin-bottom: 0;
}

.focus-callout-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}

.dark-theme .focus-callout {
  --callout-bg: #202d43;
  --callout-border: #3b5275;
  --callout-accent: #a9c9fa;
  color: #e2e8f0;

  &.is-tip {
    --callout-bg: #30263f;
    --callout-border: #554267;
    --callout-accent: #d2b6f4;
  }
  &.is-success {
    --callout-bg: #22372b;
    --callout-border: #3b6049;
    --callout-accent: #a7d7b7;
  }
  &.is-warning {
    --callout-bg: #3b3220;
    --callout-border: #665735;
    --callout-accent: #ecd394;
  }
  &.is-danger {
    --callout-bg: #3d2629;
    --callout-border: #6b4148;
    --callout-accent: #efb2b8;
  }

  option {
    background: #20262e;
    color: #e2e8f0;
  }
}
</style>
