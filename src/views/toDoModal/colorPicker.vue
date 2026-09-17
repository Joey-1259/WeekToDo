<template>
  <div class="unified-tag-picker">
    <button
      type="button"
      class="unified-tag-trigger"
      :title="triggerTitle"
      @click.stop="togglePanel"
    >
      <i
        :class="currentColor !== 'none' ? 'bi-circle-fill' : 'bi-circle'"
        :style="currentColor !== 'none' ? `color: ${currentColor}` : ''"
      ></i>
      <span v-if="activeTagName" class="trigger-label">{{ activeTagName }}</span>
    </button>

    <Teleport to="body">
      <div
        v-if="panelVisible"
        class="unified-tag-panel"
        :class="{ 'dark-theme': isDark }"
        :style="panelStyle"
        @mousedown.stop
        @click.stop
      >
        <header class="unified-tag-header">
          <div class="unified-tag-header-row">
            <strong>颜色标签</strong>
            <button
              type="button"
              class="unified-tag-edit-toggle"
              :class="{ active: editMode }"
              :title="editMode ? '退出编辑' : '编辑标签名称'"
              @click="editMode = !editMode"
            >
              <svg viewBox="0 0 16 16" width="12" height="12">
                <path d="M11.5 1.5l3 3L5 14H2v-3z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
          <small v-if="editMode">点击名称进行编辑，回车确认</small>
          <small v-else>选择标签分类</small>
        </header>

        <div class="unified-tag-grid">
          <button
            type="button"
            class="unified-tag-item"
            :class="{ active: currentColor === 'none' }"
            @click="selectTag('none', '')"
          >
            <i class="bi-circle unified-tag-dot" style="color: #c9d1d9"></i>
            <span class="unified-tag-name">无标签</span>
          </button>

          <div
            v-for="tag in allTags"
            :key="tag.id"
            class="unified-tag-row"
          >
            <button
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
                :class="{ 'is-placeholder': !tag.name }"
                @click.stop="editMode && startEdit(tag)"
              >
                {{ tag.name || '点击命名…' }}
              </span>
              <input
                v-else
                :ref="el => { if (el) editRefs[tag.id] = el }"
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
      </div>
    </Teleport>
  </div>
</template>

<script>
import defaultTaskTags from "../../data/defaultTaskTags.js";

export default {
  name: "colorPicker",
  /* FIX: Vue 3 emit 名用 camelCase，模板中自动匹配 kebab-case */
  emits: ["colorSelected", "tagSelected"],
  props: {
    color: { required: true, type: [String, null] },
    tags: { type: Array, default: () => [] },
  },
  data() {
    return {
      panelVisible: false,
      panelStyle: {},
      editMode: false,
      editingId: null,
      editRefs: {},
      allTags: defaultTaskTags.getDefaultTags(),
    };
  },
  computed: {
    currentColor() { return this.color || "none"; },
    isDark() { return document.body.classList.contains("dark-theme") ||
                      document.querySelector(".dark-theme") !== null; },
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
      if (this.panelVisible) { this.panelVisible = false; return; }
      this.allTags = defaultTaskTags.getDefaultTags();
      this.editMode = false;
      this.editingId = null;
      const rect = event.currentTarget.getBoundingClientRect();
      const w = 250, h = 420;
      const left = Math.max(10, Math.min(window.innerWidth - w - 10, rect.left));
      const openAbove = rect.bottom + h > window.innerHeight - 10;
      this.panelStyle = {
        position: "fixed", width: `${w}px`, left: `${left}px`,
        top: openAbove ? "auto" : `${rect.bottom + 6}px`,
        bottom: openAbove ? `${window.innerHeight - rect.top + 6}px` : "auto",
      };
      this.panelVisible = true;
    },
    selectTag(color, tagId) {
      this.$emit("colorSelected", color);
      if (tagId) this.$emit("tagSelected", tagId);
      if (!this.editMode) this.panelVisible = false;
    },
    startEdit(tag) {
      this.editingId = tag.id;
      this.$nextTick(() => {
        const input = this.editRefs[tag.id];
        if (input) { input.focus(); input.select(); }
      });
    },
    commitEdit(tagId, event) {
      const newName = (event.target.value || "").trim();
      defaultTaskTags.renameTag(tagId, newName);
      this.allTags = defaultTaskTags.getDefaultTags();
      this.editingId = null;
    },
    cancelEdit() { this.editingId = null; },
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
  .dark-theme & { color: #9aa0a8; }
  &:hover { background: #f0f1f3; .dark-theme & { background: #21262d; } }
  i { font-size: 14px; }
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
  box-shadow: 0 16px 42px rgba(24, 29, 38, 0.16), 0 2px 8px rgba(24, 29, 38, 0.07);
  &.dark-theme { border-color: #39414c; background: #1d232b; }
}

.unified-tag-header {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 2px 4px 8px;
  strong { color: #3f454e; font-size: 12px; .dark-theme & { color: #d3d8de; } }
  small { color: #9aa0a8; font-size: 10px; }
}

.unified-tag-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.unified-tag-edit-toggle {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #9aa0a8;
  cursor: pointer;
  transition: all 0.12s ease;
  &:hover { background: #f0f1f3; color: #4263eb; }
  &.active { background: #eef2ff; color: #4263eb; }
  .dark-theme &:hover { background: #252c35; }
  .dark-theme &.active { background: #1e2740; color: #8da2fb; }
}

.unified-tag-grid { display: flex; flex-direction: column; gap: 1px; }
.unified-tag-row { display: flex; align-items: center; }

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
  .dark-theme & { color: #c5cbd3; }
  &:hover { background: #f4f5f7; .dark-theme & { background: #252c35; } }
  &.active {
    background: #eef2ff; color: #4263eb; font-weight: 500;
    .dark-theme & { background: #1e2740; color: #8da2fb; }
  }
}

.unified-tag-dot { font-size: 12px; flex: 0 0 16px; }

.unified-tag-name {
  flex: 1; min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  &.is-placeholder { color: #c0c5cc; font-style: italic; .dark-theme & { color: #4a515b; } }
}

.unified-tag-edit {
  flex: 1; min-width: 0; height: 22px;
  padding: 0 6px; border: 1px solid #4263eb; border-radius: 4px;
  outline: none; background: #fff; color: #2f353d;
  font-family: inherit; font-size: 12px;
  .dark-theme & { border-color: #6c8fff; background: #161b22; color: #e0e5eb; }
}
</style>
