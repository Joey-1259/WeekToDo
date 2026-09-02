<template>
  <div class="home-view-toggle d-flex align-items-center">
    <button
      type="button"
      class="toggle-btn"
      :class="{ active: modelValue === 'week' }"
      @click="$emit('update:modelValue', 'week')"
    >{{ $t('ui.weekView') }}</button>
    <button
      type="button"
      class="toggle-btn"
      :class="{ active: modelValue === 'month' }"
      @click="$emit('update:modelValue', 'month')"
    >{{ $t('ui.monthView') }}</button>
  </div>
</template>

<script>
export default {
  name: 'homeViewToggle',
  props: { modelValue: { type: String, default: 'week' } },
  emits: ['update:modelValue'],
};
</script>

<style scoped lang="scss">
.home-view-toggle {
  background: #f0f1f3;
  border-radius: 20px;
  padding: 3px;
  display: inline-flex;

  .dark-theme & {
    background: #21262d;
  }
}

.toggle-btn {
  border: none;
  background: transparent;
  padding: 5px 16px;
  border-radius: 17px;
  font-size: 0.82rem;
  color: #6b7078;
  transition: all .2s ease;

  .dark-theme & {
    color: #9aa0a8;
  }

  &.active {
    background: #ffffff;
    color: #212529;
    box-shadow: 0 1px 3px rgba(0,0,0,.12);

    .dark-theme & {
      background: #30363d;
      color: #fff;
    }
  }
}
</style>
