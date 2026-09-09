<template>
  <header class="module-header">
    <span class="module-header-icon" aria-hidden="true">
      <i :class="icon"></i>
    </span>

    <h2 class="module-header-title">{{ title }}</h2>

    <span v-if="subtitle" class="module-header-subtitle">
      {{ subtitle }}
    </span>

    <span class="module-header-spacer"></span>

    <div class="module-header-actions">
      <slot name="actions"></slot>
    </div>
  </header>
</template>

<script>
/* FOCUS_UI_SYSTEM_20260909_V4 */

/**
 * 三个一级模块（每周事项 / 日历中心 / 重点事项）共用的标题栏。
 *
 * 统一的量值：
 * - 高度 56px，图标块 28×28 圆角 8，图标 15px
 * - 标题 17px / 650 / -0.01em
 * - 左侧起始位置由各模块容器把内容内边距对齐到 24px
 *
 * 侧边栏图标必须与这里的 icon 保持同一个 bootstrap-icons 名字，
 * 否则同一个模块会出现两套视觉符号。
 */
export default {
  name: "ModuleHeader",

  props: {
    icon: { type: String, required: true },
    title: { type: String, required: true },
    subtitle: { type: String, default: "" },
  },
};
</script>

<style scoped lang="scss">
.module-header {
  display: flex;
  min-height: 56px;
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;
  padding: 0;
  margin-bottom: 10px;
}

.module-header-icon {
  display: grid;
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  place-items: center;
  border-radius: 8px;
  background: #eef2ff;
  color: #4263eb;

  i {
    font-size: 15px;
    line-height: 1;
  }
}

.module-header-title {
  margin: 0;
  color: #24282e;
  font-size: 17px;
  font-weight: 650;
  letter-spacing: -0.01em;
  white-space: nowrap;
}

.module-header-subtitle {
  color: #9aa0a9;
  font-size: 11.5px;
  white-space: nowrap;
}

.module-header-spacer {
  flex: 1 1 auto;
  min-width: 12px;
}

.module-header-actions {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 7px;
}

.dark-theme .module-header-icon {
  background: #1c2333;
  color: #6c8fff;
}

.dark-theme .module-header-title {
  color: #e3e7ec;
}

.dark-theme .module-header-subtitle {
  color: #838b96;
}

@media (max-width: 1000px) {
  .module-header {
    min-height: 52px;
    flex-wrap: wrap;
  }
}
</style>
