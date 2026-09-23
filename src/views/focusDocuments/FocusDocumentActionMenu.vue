<template>
  <!-- FMM_ENHANCE_20260923_V3
    分栏卡片与全屏编辑共用的「更多操作」菜单。
    沿用 .focus-column-menu 的全局样式（定义在 FocusColumnCard），
    两处视觉与行为完全一致。 -->
  <Teleport to="body">
    <div
      ref="menu"
      class="focus-column-menu focus-doc-action-menu"
      :style="menuStyle"
      role="menu"
      tabindex="-1"
      @mousedown.stop
    >
      <button type="button" role="menuitem" @click="pick('duplicate')">
        复制文档
      </button>
      <button type="button" role="menuitem" @click="pick('move')">
        移动到目录…
      </button>

      <div class="focus-export-label" role="presentation">导出文档</div>

      <button
        type="button"
        role="menuitem"
        class="focus-export-format"
        @click="pick('export-markdown')"
      >
        <span class="focus-export-badge">MD</span>
        <span>Markdown</span>
      </button>

      <button
        type="button"
        role="menuitem"
        class="focus-export-format"
        @click="pick('export-word')"
      >
        <span class="focus-export-badge is-word">W</span>
        <span>Word 文档</span>
      </button>

      <button
        type="button"
        role="menuitem"
        class="focus-export-format"
        @click="pick('export-pdf')"
      >
        <span class="focus-export-badge is-pdf">PDF</span>
        <span>PDF 文档</span>
      </button>

      <div class="menu-divider" role="separator"></div>

      <button
        v-if="showCloseColumn"
        type="button"
        role="menuitem"
        @click="pick('close-column')"
      >
        关闭此分栏
      </button>

      <button
        type="button"
        role="menuitem"
        class="danger"
        @click="pick('delete')"
      >
        删除文档
      </button>
    </div>
  </Teleport>
</template>

<script>
const MENU_WIDTH = 190;
const EDGE = 12;
const OFFSET = 7;

export default {
  name: "FocusDocumentActionMenu",

  props: {
    anchor: { type: null, default: null },
    showCloseColumn: { type: Boolean, default: false },
  },

  emits: ["select", "dismiss"],

  data() {
    return {
      menuStyle: {
        position: "fixed",
        zIndex: 21000,
        left: "0px",
        top: "0px",
        width: `${MENU_WIDTH}px`,
        visibility: "hidden",
      },
    };
  },

  mounted() {
    this.$nextTick(this.place);
    document.addEventListener("mousedown", this.onOutside, true);
    window.addEventListener("keydown", this.onKeydown, true);
    window.addEventListener("resize", this.dismiss);
    window.addEventListener("blur", this.dismiss);
  },

  beforeUnmount() {
    document.removeEventListener("mousedown", this.onOutside, true);
    window.removeEventListener("keydown", this.onKeydown, true);
    window.removeEventListener("resize", this.dismiss);
    window.removeEventListener("blur", this.dismiss);
  },

  methods: {
    anchorEl() {
      const el = this.anchor;
      return el && typeof el.getBoundingClientRect === "function"
        ? el
        : null;
    },

    place() {
      const menu = this.$refs.menu;
      const anchor = this.anchorEl();

      if (!menu || !anchor) {
        this.menuStyle = { ...this.menuStyle, visibility: "visible" };
        return;
      }

      const rect = anchor.getBoundingClientRect();
      const height = menu.offsetHeight || 320;

      const left = Math.max(
        EDGE,
        Math.min(window.innerWidth - MENU_WIDTH - EDGE, rect.right - MENU_WIDTH)
      );

      const openAbove =
        rect.bottom + OFFSET + height > window.innerHeight - EDGE &&
        rect.top - OFFSET - height >= EDGE;

      const top = openAbove
        ? rect.top - OFFSET - height
        : Math.min(rect.bottom + OFFSET, window.innerHeight - EDGE - height);

      this.menuStyle = {
        position: "fixed",
        zIndex: 21000,
        width: `${MENU_WIDTH}px`,
        left: `${left}px`,
        top: `${Math.max(EDGE, top)}px`,
        visibility: "visible",
      };
    },

    onOutside(event) {
      const target = event.target;
      if (this.$refs.menu && this.$refs.menu.contains(target)) return;
      const anchor = this.anchorEl();
      if (anchor && anchor.contains(target)) return;
      this.dismiss();
    },

    /* 捕获阶段拦截 Esc：先关菜单，不连带关闭全屏弹窗。 */
    onKeydown(event) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      this.dismiss();
    },

    dismiss() {
      this.$emit("dismiss");
    },

    pick(action) {
      this.$emit("select", action);
    },
  },
};
</script>
