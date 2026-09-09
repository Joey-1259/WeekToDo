<template>
  <div
    class="focus-doc-title"
    :class="[`is-${variant}`, { 'is-open': menuVisible }]"
  >
    <input
      ref="input"
      :value="modelValue"
      :placeholder="placeholder"
      :style="computedStyle"
      maxlength="120"
      :aria-label="placeholder"
      @input="$emit('update:modelValue', $event.target.value)"
      @keydown.enter.prevent="$emit('submit')"
    />

    <button
      ref="trigger"
      type="button"
      class="focus-doc-title-trigger"
      title="标题样式"
      aria-haspopup="dialog"
      :aria-expanded="String(menuVisible)"
      @click.stop="toggleMenu"
    >
      Aa
    </button>

    <Teleport to="body">
      <div
        v-if="menuVisible"
        ref="menu"
        class="focus-title-menu"
        :style="menuStyle"
        role="dialog"
        aria-label="标题样式"
        @mousedown.stop
        @click.stop
      >
        <div class="focus-title-row">
          <span>字号</span>
          <div class="focus-title-sizes">
            <button
              v-for="size in sizes"
              :key="String(size.value)"
              type="button"
              :class="{ selected: styles.fontSize === size.value }"
              @click="patch({ fontSize: size.value })"
            >
              {{ size.label }}
            </button>
          </div>
        </div>

        <div class="focus-title-row">
          <span>字形</span>
          <div class="focus-title-inline">
            <button
              type="button"
              :class="{ selected: styles.bold }"
              title="加粗"
              @click="patch({ bold: !styles.bold })"
            >
              <strong>B</strong>
            </button>
            <button
              type="button"
              :class="{ selected: styles.italic }"
              title="斜体"
              @click="patch({ italic: !styles.italic })"
            >
              <em>I</em>
            </button>
            <span class="focus-title-divider"></span>
            <button
              v-for="align in aligns"
              :key="align.value"
              type="button"
              :class="{ selected: styles.align === align.value }"
              :title="align.label"
              @click="patch({ align: align.value })"
            >
              {{ align.icon }}
            </button>
          </div>
        </div>

        <div class="focus-title-row is-stack">
          <span>文字颜色</span>
          <div class="focus-title-swatches">
            <button
              type="button"
              class="is-reset"
              title="默认颜色"
              @click="patch({ color: null })"
            >
              自动
            </button>
            <button
              v-for="color in textColors"
              :key="color"
              type="button"
              class="is-swatch"
              :class="{ selected: styles.color === color }"
              :style="{ backgroundColor: color }"
              :title="color"
              @click="patch({ color })"
            ></button>
          </div>
        </div>

        <div class="focus-title-row is-stack">
          <span>背景色</span>
          <div class="focus-title-swatches">
            <button
              type="button"
              class="is-reset"
              title="无背景"
              @click="patch({ background: null })"
            >
              无
            </button>
            <button
              v-for="color in backgroundColors"
              :key="color"
              type="button"
              class="is-swatch"
              :class="{ selected: styles.background === color }"
              :style="{ backgroundColor: color }"
              :title="color"
              @click="patch({ background: color })"
            ></button>
          </div>
        </div>

        <footer>
          <button type="button" @click="reset">恢复默认</button>
          <button
            type="button"
            class="primary"
            @click="closeMenu"
          >
            完成
          </button>
        </footer>
      </div>
    </Teleport>
  </div>
</template>

<script>
/* FOCUS_TITLE_STYLE_20260909_V1 */

const TEXT_COLORS = [
  "#292d33","#626a75","#d14343","#c26a22","#9a7614",
  "#2f7d4a","#267a8a","#3f63c8","#7354b5",
];

const BACKGROUND_COLORS = [
  "#fff0a6","#ffd8a8","#ffc9c9","#d3f9d8",
  "#c5f6fa","#d0ebff","#e5dbff","#f1f3f5",
];

export const DEFAULT_TITLE_STYLE = Object.freeze({
  fontSize: null,
  color: null,
  background: null,
  bold: true,
  italic: false,
  align: "left",
});

export default {
  name: "FocusDocumentTitle",

  props: {
    modelValue: { type: String, default: "" },
    styles: {
      type: Object,
      default: () => ({ ...DEFAULT_TITLE_STYLE }),
    },
    variant: { type: String, default: "card" },
    placeholder: { type: String, default: "未命名文档" },
  },

  emits: ["update:modelValue", "update:styles", "submit"],

  data() {
    return {
      menuVisible: false,
      menuStyle: {},
      textColors: TEXT_COLORS,
      backgroundColors: BACKGROUND_COLORS,
      aligns: [
        { value: "left", label: "左对齐", icon: "⇤" },
        { value: "center", label: "居中", icon: "≡" },
        { value: "right", label: "右对齐", icon: "⇥" },
      ],
    };
  },

  computed: {
    sizes() {
      const base = this.variant === "dialog" ? 29 : 15;

      return [
        { label: "默认", value: null },
        { label: "小", value: Math.round(base * 0.85) },
        { label: "中", value: Math.round(base * 1.15) },
        { label: "大", value: Math.round(base * 1.4) },
        { label: "特大", value: Math.round(base * 1.75) },
      ];
    },

    computedStyle() {
      const styles = this.styles || {};

      return {
        fontSize: styles.fontSize
          ? `${styles.fontSize}px`
          : null,
        color: styles.color || null,
        backgroundColor: styles.background || null,
        fontWeight: styles.bold === false ? 500 : 700,
        fontStyle: styles.italic ? "italic" : null,
        textAlign: styles.align || "left",
        padding: styles.background ? "2px 8px" : null,
        borderRadius: styles.background ? "6px" : null,
      };
    },
  },

  mounted() {
    document.addEventListener("mousedown", this.onPointerDown);
    window.addEventListener("resize", this.closeMenu);
    window.addEventListener("scroll", this.closeMenu, true);
  },

  beforeUnmount() {
    document.removeEventListener(
      "mousedown",
      this.onPointerDown
    );
    window.removeEventListener("resize", this.closeMenu);
    window.removeEventListener("scroll", this.closeMenu, true);
  },

  methods: {
    focus() {
      this.$nextTick(() => {
        this.$refs.input?.focus();
        this.$refs.input?.select();
      });
    },

    onPointerDown(event) {
      if (
        event.target.closest(".focus-title-menu") ||
        event.target.closest(".focus-doc-title-trigger")
      ) {
        return;
      }

      this.menuVisible = false;
    },

    toggleMenu() {
      if (this.menuVisible) {
        this.menuVisible = false;
        return;
      }

      const rect =
        this.$refs.trigger?.getBoundingClientRect();

      if (rect) {
        const width = 268;
        const height = 300;

        const left = Math.max(
          12,
          Math.min(
            window.innerWidth - width - 12,
            rect.right - width
          )
        );

        const openAbove =
          rect.bottom + height > window.innerHeight - 12;

        this.menuStyle = {
          position: "fixed",
          width: `${width}px`,
          left: `${left}px`,
          top: openAbove ? "auto" : `${rect.bottom + 8}px`,
          bottom: openAbove
            ? `${window.innerHeight - rect.top + 8}px`
            : "auto",
        };
      }

      this.menuVisible = true;
    },

    closeMenu() {
      this.menuVisible = false;
    },

    patch(partial) {
      this.$emit("update:styles", {
        ...DEFAULT_TITLE_STYLE,
        ...(this.styles || {}),
        ...partial,
      });
    },

    reset() {
      this.$emit("update:styles", {
        ...DEFAULT_TITLE_STYLE,
      });
    },
  },
};
</script>

<style scoped lang="scss">
.focus-doc-title {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 4px;
}

.focus-doc-title input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: none;
  background: transparent;
  color: #24272d;
  font-family: inherit;
  font-size: 15px;
  letter-spacing: -0.01em;
}

.focus-doc-title.is-dialog input {
  font-size: 29px;
  letter-spacing: -0.025em;
}

.focus-doc-title input::placeholder {
  color: #b3b8bf;
  font-weight: 500;
}

.focus-doc-title-trigger {
  display: grid;
  width: 26px;
  height: 26px;
  flex: 0 0 26px;
  place-items: center;
  border: 0;
  border-radius: 6px;
  opacity: 0;
  background: transparent;
  color: #767d87;
  font-size: 11px;
  font-weight: 650;
  cursor: pointer;
  transition: opacity 0.14s ease, background-color 0.14s ease;
}

.focus-doc-title:hover .focus-doc-title-trigger,
.focus-doc-title.is-open .focus-doc-title-trigger,
.focus-doc-title:focus-within .focus-doc-title-trigger {
  opacity: 1;
}

.focus-doc-title-trigger:hover,
.focus-doc-title.is-open .focus-doc-title-trigger {
  background: #eef1f5;
  color: #4263eb;
}

.dark-theme .focus-doc-title input {
  color: #e4e8ed;
}

.dark-theme .focus-doc-title-trigger:hover {
  background: #262d36;
  color: #93a8f5;
}
</style>

<style lang="scss">
/* 浮层被 Teleport 到 body，样式不能 scoped。 */
.focus-title-menu {
  z-index: 22000;
  display: flex;
  flex-direction: column;
  gap: 11px;
  padding: 13px 14px 11px;
  border: 1px solid rgba(31, 35, 41, 0.12);
  border-radius: 12px;
  background: #fff;
  box-shadow:
    0 18px 48px rgba(24, 29, 38, 0.16),
    0 3px 10px rgba(24, 29, 38, 0.08);
}

.focus-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.focus-title-row.is-stack {
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
}

.focus-title-row > span {
  color: #868d96;
  font-size: 11px;
  white-space: nowrap;
}

.focus-title-sizes,
.focus-title-inline {
  display: flex;
  gap: 3px;
}

.focus-title-sizes button,
.focus-title-inline button {
  min-width: 28px;
  height: 26px;
  padding: 0 7px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: #f4f6f8;
  color: #4d545d;
  font-family: inherit;
  font-size: 11px;
  cursor: pointer;
}

.focus-title-sizes button.selected,
.focus-title-inline button.selected {
  border-color: #a8b8f0;
  background: #eef2ff;
  color: #4263eb;
}

.focus-title-divider {
  width: 1px;
  height: 18px;
  margin: 4px 3px 0;
  background: #e3e6ea;
}

.focus-title-swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.focus-title-swatches .is-swatch {
  width: 20px;
  height: 20px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 50%;
  cursor: pointer;
}

.focus-title-swatches .is-swatch.selected {
  box-shadow: 0 0 0 2px #fff, 0 0 0 4px #4263eb;
}

.focus-title-swatches .is-reset {
  height: 20px;
  padding: 0 8px;
  border: 1px solid #dfe3e8;
  border-radius: 10px;
  background: #fff;
  color: #6a717b;
  font-size: 10px;
  cursor: pointer;
}

.focus-title-menu > footer {
  display: flex;
  justify-content: flex-end;
  gap: 7px;
  padding-top: 9px;
  border-top: 1px solid #eef0f3;
}

.focus-title-menu > footer button {
  height: 28px;
  padding: 0 12px;
  border: 1px solid #dfe2e7;
  border-radius: 7px;
  background: #fff;
  color: #545b65;
  font-family: inherit;
  font-size: 11px;
  cursor: pointer;
}

.focus-title-menu > footer button.primary {
  border-color: #4263eb;
  background: #4263eb;
  color: #fff;
}

.dark-theme .focus-title-menu {
  border-color: #38414b;
  background: #1d232b;
}

.dark-theme .focus-title-row > span {
  color: #98a1ac;
}

.dark-theme .focus-title-sizes button,
.dark-theme .focus-title-inline button {
  background: #262d36;
  color: #d3d8de;
}

.dark-theme .focus-title-menu > footer {
  border-color: #333a44;
}

.dark-theme .focus-title-menu > footer button {
  border-color: #3a424d;
  background: #20262e;
  color: #d8dde3;
}
</style>
