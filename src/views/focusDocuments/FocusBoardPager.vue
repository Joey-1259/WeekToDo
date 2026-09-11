<template>
  <div
    v-if="pageCount > 1"
    class="focus-pager"
    role="group"
    aria-label="版面翻页"
  >
    <button
      type="button"
      class="focus-pager-step"
      :disabled="page <= 0"
      title="上一版面（⌘⌥←）"
      aria-label="上一版面"
      @click="$emit('step', -1)"
    >
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M12 4 6.5 10 12 16" />
      </svg>
    </button>

    <span class="focus-pager-count" aria-live="polite">
      <b>{{ page + 1 }}</b><i>/</i><em>{{ pageCount }}</em>
    </span>

    <button
      type="button"
      class="focus-pager-step"
      :disabled="page >= pageCount - 1"
      title="下一版面（⌘⌥→）"
      aria-label="下一版面"
      @click="$emit('step', 1)"
    >
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M8 4l5.5 6L8 16" />
      </svg>
    </button>
  </div>
</template>

<script>
/* UI_SYSTEM_20260911_V9 · 版面翻页
 *
 * 旧实现把箭头以 position:absolute + top:calc(62% - 17px) +
 * left/right:-15px 悬浮在看板之上：
 *   · 百分比 top 按高度解析、left 为负值溢出容器 —— 两个维度都
 *     随窗口漂移，这正是"改变窗口大小时位置很奇怪"的来源；
 *   · 它压在卡片正文上方，与 rail 上的 + 争抢同一条窄带，上一版
 *     只能靠"箭头下移 62% / + 号上移 38%"互相让位，是症状级修补。
 *
 * 层级原则：局部操作（插入分栏）留在画布里，贴着它作用的对象；
 * 全局导航（翻版面）属于 chrome。这里因此改为与 .focus-pagesize
 * 同高、同圆角、同边框的分段控件，安放在顶部功能区 —— 一个固定
 * 高度的 flex 行，窗口如何变化它都不会移动一个像素。
 *
 * 拖拽翻页的职责移交给 FocusColumnBoard 的边缘热区：那里能做到
 * 整列高的命中区域，且只在拖拽进行时出现。
 */
export default {
  name: "FocusBoardPager",

  props: {
    page: { type: Number, default: 0 },
    pageCount: { type: Number, default: 1 },
  },

  emits: ["step", "go"],
};
</script>

<style scoped lang="scss">
.focus-pager {
  display: flex;
  height: var(--focus-control-height, 36px);
  box-sizing: border-box;
  flex: 0 0 auto;
  align-items: center;
  gap: 1px;
  padding: 3px;
  border: 1px solid #dfe3e8;
  border-radius: 9px;
  background: #fff;
}

.focus-pager-step {
  display: grid;
  width: 26px;
  height: 28px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 6px;
  outline: none;
  background: transparent;
  color: #6f7782;
  cursor: pointer;
  transition:
    background-color 0.14s ease,
    color 0.14s ease;
}

.focus-pager-step:hover:not(:disabled) {
  background: #eef2ff;
  color: #4263eb;
}

.focus-pager-step:focus-visible {
  box-shadow: 0 0 0 2px rgba(66, 99, 235, 0.28);
}

.focus-pager-step:disabled {
  color: #c9ced5;
  cursor: default;
}

.focus-pager-step svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* 等宽数字：从 1/3 翻到 2/3 时控件宽度不跳。 */
.focus-pager-count {
  display: inline-flex;
  min-width: 34px;
  align-items: baseline;
  justify-content: center;
  gap: 1px;
  color: #8b929b;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  user-select: none;
}

.focus-pager-count b {
  color: #3f454e;
  font-size: 12px;
  font-weight: 620;
}

.focus-pager-count i {
  font-style: normal;
  opacity: 0.5;
}

.focus-pager-count em {
  font-style: normal;
}

.dark-theme .focus-pager {
  border-color: #343b45;
  background: #161b22;
}

.dark-theme .focus-pager-step {
  color: #a3abb6;
}

.dark-theme .focus-pager-step:hover:not(:disabled) {
  background: #223052;
  color: #93a8f5;
}

.dark-theme .focus-pager-step:disabled {
  color: #4a525c;
}

.dark-theme .focus-pager-count {
  color: #8d95a0;
}

.dark-theme .focus-pager-count b {
  color: #d7dce2;
}
</style>
