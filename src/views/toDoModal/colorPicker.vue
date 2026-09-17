<template>
  <div class="unified-tag-picker">
    <button
      type="button"
      class="unified-tag-trigger"
      :title="triggerTitle"
      @click.stop="togglePanel"
    >
      <i
        class="bi-circle-fill"
        :style="currentColor !== 'none' ? `color: ${currentColor}` : 'color: #c9d1d9'"
      ></i>
      <span v-if="activeTagName" class="trigger-label">{{ activeTagName }}</span>
    </button>

    <Teleport to="body">
      <div
        v-if="panelVisible"
        class="unified-tag-panel"
        :style="panelStyle"
        @mousedown.stop
        @click.stop
      >
        <header class="unified-tag-header">
          <strong>颜色标签</strong>
          <small>选择颜色 · 双击名称可编辑</small>
        </header>

        <div class="unified-tag-grid">
          <!-- 无颜色选项 -->
          <button
            type="button"
            class="unified-tag-item"
            :class="{ active: currentColor === 'none' }"
            @click="selectTag('none', '')"
          >
            <i class="bi-circle unified-tag-dot"></i>
            <span class="unified-tag-name">无标签</span>
          </button>

          <button
            v-for="tag in allTags"
            :key="tag.id"
            type="button"
            class="unified-tag-item"
            :class="{ active: currentColor === tag.color }"
            @click="selectTag(tag.color, tag.id)"
          >
            <i
              class="bi-circle-fill unified-tag-dot"
              :style="`color: ${tag.color}`"
            ></i>
            <span
              v-if="editingId !== tag.id"
              class="unified-tag-name"
              @dblclick.stop="startEdit(tag)"
            >
              {{ tag.name || '未命名' }}
            </span>
            <input
              v-else
              :ref="'edit_' + tag.id"
              class="unified-tag-edit"
              type="text"
              maxlength="8"
              :value="tag.name"
              @blur="commitEdit(tag.id, $event)"
              @keydown.enter="commitEdit(tag.id, $event)"
              @keydown.esc="cancelEdit"
              @click.stop
            />
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script>
import defaultTaskTags from "../../data/defaultTaskTags.js";

export default {
  name: "colorPicker",
  emits: ["ColorSelected", "TagSelected"],
  props: {
    color: { required: true, type: [String, null] },
    tags: { type: Array, default: () => [] },
  },
  data() {
    return {
      panelVisible: false,
      panelStyle: {},
      editingId: null,
      allTags: defaultTaskTags.getDefaultTags(),
    };
  },
  computed: {
    currentColor() {
      return this.color || "none";
    },
    activeTagName() {
      if (this.currentColor === "none") return "";
      const tag = this.allTags.find((t) => t.color === this.currentColor);
      return tag?.name || "";
    },
    triggerTitle() {
      const name = this.activeTagName;
      return name ? `颜色标签：${name}` : "设置颜色标签";
    },
  },
  mounted() {
    document.addEventListener("mousedown", this.onGlobalClick);
  },
  beforeUnmount() {
    document.removeEventListener("mousedown", this.onGlobalClick);
  },
  methods: {
    togglePanel(event) {
      if (this.panelVisible) {
        this.panelVisible = false;
        return;
      }
      this.allTags = defaultTaskTags.getDefaultTags();
      const rect = event.currentTarget.getBoundingClientRect();
      const width = 240;
      const height = 380;
      const left = Math.max(10, Math.min(window.innerWidth - width - 10, rect.left));
      const openAbove = rect.bottom + height > window.innerHeight - 10;
      this.panelStyle = {
        position: "fixed",
        width: `${width}px`,
        left: `${left}px`,
        top: openAbove ? "auto" : `${rect.bottom + 6}px`,
        bottom: openAbove ? `${window.innerHeight - rect.top + 6}px` : "auto",
      };
      this.panelVisible = true;
    },
    selectTag(color, tagId) {
      this.$emit("ColorSelected", color);
      // 同时更新 tags：如果选了一个有 id 的颜色，添加到 tags
      if (tagId) {
        this.$emit("TagSelected", tagId);
      }
      this.panelVisible = false;
    },
    startEdit(tag) {
      this.editingId = tag.id;
      this.$nextTick(() => {
        const ref = this.$refs["edit_" + tag.id];
        const input = Array.isArray(ref) ? ref[0] : ref;
        if (input) {
          input.focus();
          input.select();
        }
      });
    },
    commitEdit(tagId, event) {
      const input = event.target;
      const newName = (input.value || "").trim();
      defaultTaskTags.renameTag(tagId, newName);
      this.allTags = defaultTaskTags.getDefaultTags();
      this.editingId = null;
    },
    cancelEdit() {
      this.editingId = null;
    },
    onGlobalClick(event) {
      if (!event.target.closest(".unified-tag-panel") &&
          !event.target.closest(".unified-tag-trigger")) {
        this.panelVisible = false;
      }
    },
  },
};
</script>

<style scoped lang="scss">
@use "../../assets/style/globalVars" as *;

.unified-tag-trigger {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #6b7280;
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.14s ease;

  .dark-theme & {
    color: #9aa0a8;
  }

  &:hover {
    background: #f0f1f3;
    .dark-theme & { background: #21262d; }
  }

  i {
    font-size: 14px;
  }

  .trigger-label {
    max-width: 60px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.unified-tag-panel {
  z-index: 22000;
  padding: 10px;
  border: 1px solid rgba(31, 35, 41, 0.12);
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 16px 42px rgba(24, 29, 38, 0.16),
    0 2px 8px rgba(24, 29, 38, 0.07);

  .dark-theme & {
    border-color: #39414c;
    background: #1d232b;
  }
}

.unified-tag-header {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 2px 4px 8px;

  strong {
    color: #3f454e;
    font-size: 12px;
    .dark-theme & { color: #d3d8de; }
  }

  small {
    color: #9aa0a8;
    font-size: 10px;
  }
}

.unified-tag-grid {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.unified-tag-item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 10px;
  padding: 7px 8px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #4a515b;
  font-family: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.12s ease;

  .dark-theme & {
    color: #c5cbd3;
  }

  &:hover {
    background: #f4f5f7;
    .dark-theme & { background: #252c35; }
  }

  &.active {
    background: #eef2ff;
    color: #4263eb;
    font-weight: 500;
    .dark-theme & {
      background: #1e2740;
      color: #8da2fb;
    }
  }
}

.unified-tag-dot {
  font-size: 12px;
  flex: 0 0 16px;
}

.unified-tag-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.unified-tag-edit {
  flex: 1;
  min-width: 0;
  height: 22px;
  padding: 0 6px;
  border: 1px solid #4263eb;
  border-radius: 4px;
  outline: none;
  background: #fff;
  color: #2f353d;
  font-family: inherit;
  font-size: 12px;

  .dark-theme & {
    border-color: #6c8fff;
    background: #161b22;
    color: #e0e5eb;
  }
}
</style>
