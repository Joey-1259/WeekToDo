<template>
  <div class="tag-picker-chips">
    <span
      v-for="tag in visibleTags"
      :key="tag.id"
      class="tag-chip"
      :class="{ active: isSelected(tag.id) }"
      :style="chipStyle(tag)"
      @click="toggleTag(tag.id)"
      :title="tag.name || tag.color"
    >
      <i class="bi-circle-fill chip-dot" :style="`color: ${tag.color}`"></i>
      <span v-if="tag.name" class="chip-text">{{ tag.name }}</span>
    </span>
  </div>
</template>

<script>
import defaultTaskTags from "../../data/defaultTaskTags.js";

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
    visibleTags() {
      // 使用统一标签源，只显示有名称的标签
      const tags = defaultTaskTags.getDefaultTags();
      return tags.filter((t) => t.name);
    },
  },
  methods: {
    isSelected(id) {
      return this.selectedIds.includes(id);
    },
    chipStyle(tag) {
      if (this.isSelected(tag.id)) {
        return {
          backgroundColor: tag.color + "1a",
          color: tag.color,
          borderColor: tag.color + "33",
        };
      }
      return {};
    },
    toggleTag(id) {
      const next = this.isSelected(id)
        ? this.selectedIds.filter((t) => t !== id)
        : [...this.selectedIds, id];
      this.$emit("update:modelValue", next);
    },
  },
};
</script>

<style scoped lang="scss">
.tag-picker-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid transparent;
  border-radius: 14px;
  background: #f0f1f3;
  color: #6b7078;
  font-size: 0.76rem;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;

  .dark-theme & {
    background: #21262d;
    color: #9aa0a8;
  }

  &:hover {
    opacity: 0.85;
  }

  &.active {
    border-style: solid;
    font-weight: 500;
  }

  .chip-dot {
    font-size: 8px;
    flex: 0 0 auto;
  }

  .chip-text {
    max-width: 50px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
