<template>
  <svg
    class="app-icon"
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
    v-html="markup"
  ></svg>
</template>

<script>
/* FOCUS_UI_SYSTEM_20260909_V4 */
import { ICONS } from "../../editor/icons";

export default {
  name: "AppIcon",

  props: {
    name: { type: String, required: true },
  },

  computed: {
    markup() {
      const icon = ICONS[this.name];

      if (!icon) {
        // 图标缺失时不静默：开发期能立刻发现拼错的名字。
        console.warn("[AppIcon] 未定义的图标：" + this.name);
        return "";
      }

      return icon;
    },
  },
};
</script>

<style scoped>
.app-icon {
  display: block;
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
