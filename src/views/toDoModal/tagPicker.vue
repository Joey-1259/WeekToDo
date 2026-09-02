<template>
  <div class="tag-picker d-flex flex-wrap align-items-center">
    <span
      v-for="tag in allTags"
      :key="tag.id"
      class="tag-chip"
      :class="{ active: selectedIds.includes(tag.id) }"
      :style="selectedIds.includes(tag.id) ? { backgroundColor: tag.color, color: '#fff' } : {}"
      @click="toggleTag(tag.id)"
    >{{ tag.name }}</span>
  </div>
</template>

<script>
export default {
  name: "tagPicker",
  props: {
    modelValue: { type: Array, default: () => [] },
    allTags: { type: Array, default: () => [] },
  },
  emits: ["update:modelValue"],
  computed: {
    selectedIds() {
      return this.modelValue || [];
    },
  },
  methods: {
    toggleTag(id) {
      const next = this.selectedIds.includes(id)
        ? this.selectedIds.filter((t) => t !== id)
        : [...this.selectedIds, id];
      this.$emit("update:modelValue", next);
    },
  },
};
</script>

<style scoped lang="scss">
.tag-chip {
  padding: 4px 12px;
  border-radius: 14px;
  font-size: 0.76rem;
  background: #f0f1f3;
  color: #6b7078;
  margin: 3px 3px 3px 0;
  cursor: pointer;
  transition: all 0.15s ease;
  display: inline-block;

  .dark-theme & {
    background: #21262d;
    color: #9aa0a8;
  }

  &:hover {
    opacity: 0.85;
  }
}
</style>
