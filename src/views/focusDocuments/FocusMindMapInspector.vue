<template>
  <aside
    class="mind-map-inspector"
    aria-label="思维导图格式面板"
  >
    <header class="mind-map-inspector-header">
      <div>
        <strong>格式</strong>
        <small>
          {{
            selectionCount
              ? `已选择 ${selectionCount} 个节点`
              : "请选择一个节点"
          }}
        </small>
      </div>

      <button
        type="button"
        aria-label="关闭格式面板"
        title="关闭格式面板"
        @click="$emit('close')"
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="m5 5 10 10M15 5 5 15" />
        </svg>
      </button>
    </header>

    <div class="mind-map-inspector-content">
      <!-- INSPECTOR_SLIM_20260923: 骨架与配色已迁至顶部工具栏 -->
      <section
        class="mind-map-inspector-section"
        :class="{
          disabled: !selectionCount,
        }"
      >
        <header>
          <strong>快速样式</strong>
          <small>快速表达节点状态和重要程度</small>
        </header>

        <div class="mind-map-quick-styles">
          <button
            type="button"
            :disabled="!selectionCount"
            @click="$emit('quick-style', 'important')"
          >
            <i class="is-important">!</i>
            重要
          </button>

          <button
            type="button"
            :disabled="!selectionCount"
            @click="$emit('quick-style', 'idea')"
          >
            <i class="is-idea">✦</i>
            灵感
          </button>

          <button
            type="button"
            :disabled="!selectionCount"
            @click="$emit('quick-style', 'done')"
          >
            <i class="is-done">✓</i>
            已完成
          </button>

          <button
            type="button"
            :disabled="!selectionCount"
            @click="$emit('reset-style')"
          >
            <i class="is-reset">↺</i>
            默认
          </button>
        </div>
      </section>

      <section
        class="mind-map-inspector-section"
        :class="{
          disabled: !selectionCount,
        }"
      >
        <header>
          <strong>文字</strong>
          <small>设置所选节点的字体与层级</small>
        </header>

        <label class="mind-map-field">
          <span>字体</span>

          <select
            :value="nodeStyle.fontFamily || ''"
            :disabled="!selectionCount"
            @change="
              emitStyle(
                'fontFamily',
                $event.target.value || null
              )
            "
          >
            <option value="">跟随主题</option>
            <option
              value='Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
            >
              系统默认
            </option>
            <option
              value='"PingFang SC", "Microsoft YaHei", sans-serif'
            >
              苹方 / 微软雅黑
            </option>
            <option
              value='Georgia, "Times New Roman", serif'
            >
              衬线字体
            </option>
            <option
              value='"SFMono-Regular", Consolas, monospace'
            >
              等宽字体
            </option>
          </select>
        </label>

        <div class="mind-map-field">
          <span>字号</span>

          <div class="mind-map-segmented">
            <button
              v-for="size in fontSizes"
              :key="size"
              type="button"
              :disabled="!selectionCount"
              :class="{
                active:
                  nodeStyle.fontSize === `${size}px`,
              }"
              @click="
                emitStyle(
                  'fontSize',
                  `${size}px`
                )
              "
            >
              {{ size }}
            </button>
          </div>
        </div>

        <div class="mind-map-field">
          <span>强调</span>

          <div class="mind-map-format-buttons">
            <button
              type="button"
              :disabled="!selectionCount"
              :class="{
                active:
                  String(nodeStyle.fontWeight)
                    === '700',
              }"
              title="粗体"
              @click="$emit('toggle-format', 'bold')"
            >
              <b>B</b>
            </button>

            <button
              type="button"
              :disabled="!selectionCount"
              :class="{
                active:
                  hasDecoration('underline'),
              }"
              title="下划线"
              @click="
                $emit(
                  'toggle-format',
                  'underline'
                )
              "
            >
              <u>U</u>
            </button>

            <button
              type="button"
              :disabled="!selectionCount"
              :class="{
                active:
                  hasDecoration('line-through'),
              }"
              title="删除线"
              @click="
                $emit(
                  'toggle-format',
                  'line-through'
                )
              "
            >
              <s>S</s>
            </button>
          </div>
        </div>

        <div class="mind-map-field">
          <span>文字颜色</span>

          <div class="mind-map-color-row">
            <button
              v-for="color in textColors"
              :key="color.value || 'default'"
              type="button"
              :disabled="!selectionCount"
              :title="color.label"
              :class="{
                active:
                  (
                    nodeStyle.color || ''
                  ) === color.value,
              }"
              @click="
                emitStyle(
                  'color',
                  color.value || null
                )
              "
            >
              <i
                v-if="color.value"
                :style="{
                  background: color.value,
                }"
              ></i>
              <i
                v-else
                class="is-default-color"
              >
                A
              </i>
            </button>
          </div>
        </div>
      </section>

      <section
        class="mind-map-inspector-section"
        :class="{
          disabled: !selectionCount,
        }"
      >
        <header>
          <strong>节点</strong>
          <small>设置填充、边框和内容宽度</small>
        </header>

        <div class="mind-map-field">
          <span>填充色</span>

          <div class="mind-map-color-row">
            <button
              v-for="color in fillColors"
              :key="color.value || 'default'"
              type="button"
              :disabled="!selectionCount"
              :title="color.label"
              :class="{
                active:
                  (
                    nodeStyle.background || ''
                  ) === color.value,
              }"
              @click="
                emitStyle(
                  'background',
                  color.value || null
                )
              "
            >
              <i
                v-if="color.value"
                :style="{
                  background: color.value,
                }"
              ></i>
              <i
                v-else
                class="is-transparent"
              ></i>
            </button>
          </div>
        </div>

        <div class="mind-map-field">
          <span>边框</span>

          <div class="mind-map-border-grid">
            <button
              v-for="border in borders"
              :key="border.label"
              type="button"
              :disabled="!selectionCount"
              :class="{
                active:
                  (
                    nodeStyle.border || ''
                  ) === border.value,
              }"
              @click="
                emitStyle(
                  'border',
                  border.value || null
                )
              "
            >
              <i :style="{ border: border.preview }"></i>
              {{ border.label }}
            </button>
          </div>
        </div>

        <div class="mind-map-field">
          <span>节点宽度</span>

          <div class="mind-map-segmented">
            <button
              v-for="width in widths"
              :key="width.label"
              type="button"
              :disabled="!selectionCount"
              :class="{
                active:
                  (
                    nodeStyle.width || ''
                  ) === width.value,
              }"
              @click="
                emitStyle(
                  'width',
                  width.value || null
                )
              "
            >
              {{ width.label }}
            </button>
          </div>
        </div>
      </section>

      <section
        class="mind-map-inspector-section"
        :class="{
          disabled: !selectionCount,
        }"
      >
        <header>
          <strong>分支</strong>
          <small>强调当前节点所属的逻辑路径</small>
        </header>

        <div class="mind-map-color-row">
          <button
            v-for="color in branchColors"
            :key="color.value || 'default'"
            type="button"
            :disabled="!selectionCount"
            :title="color.label"
            :class="{
              active:
                (
                  branchColor || ''
                ) === color.value,
            }"
            @click="
              $emit(
                'change-branch-color',
                color.value || null
              )
            "
          >
            <i
              v-if="color.value"
              :style="{
                background: color.value,
              }"
            ></i>
            <i v-else class="is-default-branch"></i>
          </button>
        </div>
      </section>
    </div>
  </aside>
</template>

<script>
const palette = (
  defaultLabel,
  values
) => [
  {
    label: defaultLabel,
    value: "",
  },
  ...values.map(
    ([label, value]) => ({
      label,
      value,
    })
  ),
];

export default {
  name: "FocusMindMapInspector",

  props: {
    selectionCount: {
      type: Number,
      default: 0,
    },

    nodeStyle: {
      type: Object,
      default: () => ({}),
    },

    branchColor: {
      type: String,
      default: "",
    },

    themes: {
      type: Array,
      default: () => [],
    },

    activeThemeId: {
      type: String,
      default: "minimal",
    },

    skeletons: {
      type: Array,
      default: () => [],
    },

    activeSkeletonId: {
      type: String,
      default: "right-logic",
    },

    compact: {
      type: Boolean,
      default: false,
    },
  },

  emits: [
    "close",
    "update-style",
    "toggle-format",
    "change-branch-color",
    "quick-style",
    "reset-style",
    "change-theme",
    "change-skeleton",
    "toggle-compact",
  ],

  data() {
    return {
      fontSizes: [
        12,
        14,
        16,
        18,
        22,
      ],

      textColors: palette(
        "跟随主题",
        [
          ["石墨黑", "#2f3338"],
          ["沉静灰", "#68707c"],
          ["商务蓝", "#526dcc"],
          ["森林绿", "#4f7d68"],
          ["暖棕色", "#9b6345"],
          ["强调红", "#c55252"],
        ]
      ),

      fillColors: palette(
        "跟随主题",
        [
          ["纯白", "#ffffff"],
          ["冷灰", "#f1f3f6"],
          ["浅蓝", "#edf2ff"],
          ["浅绿", "#edf6f0"],
          ["暖纸", "#fbf2e7"],
          ["浅红", "#fbecec"],
        ]
      ),

      branchColors: palette(
        "跟随主题",
        [
          ["石墨黑", "#35383d"],
          ["商务蓝", "#526dcc"],
          ["森林绿", "#4f7d68"],
          ["暖棕色", "#9b6345"],
          ["强调红", "#c55252"],
          ["柔和紫", "#7669b3"],
        ]
      ),

      borders: [
        {
          label: "默认",
          value: "",
          preview: "1px solid #d7dbe2",
        },
        {
          label: "无边框",
          value: "1px solid transparent",
          preview: "1px dashed #c7ccd4",
        },
        {
          label: "细描边",
          value: "1px solid #b8bec8",
          preview: "1px solid #8e96a3",
        },
        {
          label: "强描边",
          value: "2px solid #383d46",
          preview: "2px solid #383d46",
        },
      ],

      widths: [
        {
          label: "自适应",
          value: "",
        },
        {
          label: "窄",
          value: "120px",
        },
        {
          label: "中",
          value: "180px",
        },
        {
          label: "宽",
          value: "240px",
        },
      ],
    };
  },

  methods: {
    emitStyle(key, value) {
      this.$emit(
        "update-style",
        {
          [key]: value,
        }
      );
    },

    hasDecoration(value) {
      return String(
        this.nodeStyle.textDecoration
        || ""
      )
        .split(/\s+/)
        .includes(value);
    },
  },
};
</script>

<style scoped>
.mind-map-inspector {
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-rows: 58px minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid #dde1e7;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow:
    0 10px 32px rgba(27, 33, 43, 0.08);
}

.mind-map-inspector-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px 0 16px;
  border-bottom: 1px solid #e8eaee;
}

.mind-map-inspector-header > div,
.mind-map-inspector-section > header {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mind-map-inspector-header strong {
  color: #30353d;
  font-size: 13px;
}

.mind-map-inspector-header small,
.mind-map-inspector-section header small {
  color: #969da8;
  font-size: 10px;
}

.mind-map-inspector-header button {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #89919d;
  cursor: pointer;
}

.mind-map-inspector-header button:hover {
  background: #f0f2f5;
  color: #48515e;
}

.mind-map-inspector-header svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-width: 1.7;
}

.mind-map-inspector-content {
  min-height: 0;
  padding: 0 14px 24px;
  overflow-y: auto;
}

.mind-map-inspector-section {
  padding: 17px 0;
  border-bottom: 1px solid #eceef1;
}

.mind-map-inspector-section:last-child {
  border-bottom: 0;
}

.mind-map-inspector-section.disabled
  > :not(header) {
  opacity: 0.55;
}

.mind-map-inspector-section > header {
  margin-bottom: 12px;
}

.mind-map-inspector-section > header strong {
  color: #464d58;
  font-size: 11px;
  font-weight: 700;
}

.mind-map-skeleton-grid,
.mind-map-theme-list {
  display: grid;
  gap: 6px;
}

.mind-map-skeleton-card,
.mind-map-theme-list > button {
  display: grid;
  min-width: 0;
  grid-template-columns: 64px minmax(0, 1fr) 16px;
  align-items: center;
  gap: 9px;
  padding: 7px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: #4b535f;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}

.mind-map-skeleton-card:hover,
.mind-map-theme-list > button:hover {
  border-color: #e0e3e8;
  background: #f7f8fa;
}

.mind-map-skeleton-card.active,
.mind-map-theme-list > button.active {
  border-color: #ccd4ef;
  background: #f1f3fb;
}

.mind-map-skeleton-card > span:nth-child(2),
.mind-map-theme-list > button > span:nth-child(2) {
  min-width: 0;
}

.mind-map-skeleton-card strong,
.mind-map-skeleton-card small,
.mind-map-theme-list strong,
.mind-map-theme-list small {
  display: block;
}

.mind-map-skeleton-card strong,
.mind-map-theme-list strong {
  font-size: 10px;
  font-weight: 650;
}

.mind-map-skeleton-card small,
.mind-map-theme-list small {
  overflow: hidden;
  margin-top: 2px;
  color: #969da8;
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mind-map-skeleton-card b,
.mind-map-theme-list b {
  color: #5c72c5;
  font-size: 12px;
}

.mind-map-skeleton-preview {
  position: relative;
  display: block;
  width: 64px;
  height: 40px;
  overflow: hidden;
  border: 1px solid #e0e3e8;
  border-radius: 7px;
  background: #fbfbfa;
}

.mind-map-skeleton-preview i {
  position: absolute;
  display: block;
}

.mind-map-skeleton-preview .root {
  top: 16px;
  left: 7px;
  width: 15px;
  height: 8px;
  border: 1px solid #52565c;
  border-radius: 2px;
  background: #fff;
}

.mind-map-skeleton-preview .branch {
  width: 20px;
  height: 9px;
  border-top: 1px solid #666a70;
  border-left: 1px solid #666a70;
}

.mind-map-skeleton-preview .one {
  top: 7px;
  left: 22px;
}

.mind-map-skeleton-preview .two {
  top: 19px;
  left: 22px;
}

.mind-map-skeleton-preview .three {
  top: 31px;
  left: 22px;
}

.mind-map-skeleton-preview.is-balanced .root {
  left: 24px;
}

.mind-map-skeleton-preview.is-balanced .one {
  left: 7px;
  transform: scaleX(-1);
}

.mind-map-skeleton-preview.is-balanced .two {
  left: 39px;
}

.mind-map-skeleton-preview.is-balanced .three {
  display: none;
}

.mind-map-skeleton-preview.is-down .root {
  top: 5px;
  left: 24px;
}

.mind-map-skeleton-preview.is-down .one {
  top: 14px;
  left: 14px;
  transform: rotate(90deg);
}

.mind-map-skeleton-preview.is-down .two {
  top: 14px;
  left: 31px;
  transform: rotate(90deg);
}

.mind-map-skeleton-preview.is-down .three {
  display: none;
}

.mind-map-theme-canvas {
  display: flex;
  width: 64px;
  height: 38px;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 1px solid rgba(39, 44, 53, 0.1);
  border-radius: 7px;
}

.mind-map-theme-canvas i {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255, 255, 255, 0.85);
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(25, 30, 38, 0.16);
}

.mind-map-switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-top: 11px;
}

.mind-map-switch-row > span strong,
.mind-map-switch-row > span small {
  display: block;
}

.mind-map-switch-row > span strong {
  color: #565e69;
  font-size: 10px;
}

.mind-map-switch-row > span small {
  margin-top: 2px;
  color: #9aa1ab;
  font-size: 9px;
}

.mind-map-switch-row > button {
  position: relative;
  width: 34px;
  height: 20px;
  flex: 0 0 auto;
  border: 0;
  border-radius: 999px;
  background: #d5d9df;
  cursor: pointer;
  transition: background 140ms ease;
}

.mind-map-switch-row > button i {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(23, 28, 36, 0.2);
  transition: transform 140ms ease;
}

.mind-map-switch-row > button.active {
  background: #6075c8;
}

.mind-map-switch-row > button.active i {
  transform: translateX(14px);
}

.mind-map-quick-styles {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 5px;
}

.mind-map-quick-styles button {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 7px 2px;
  border: 1px solid #e2e5e9;
  border-radius: 8px;
  background: #fff;
  color: #626a76;
  font-family: inherit;
  font-size: 9px;
  cursor: pointer;
}

.mind-map-quick-styles button:hover {
  border-color: #cfd5e4;
  background: #f7f8fb;
}

.mind-map-quick-styles button:disabled {
  cursor: not-allowed;
}

.mind-map-quick-styles i {
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  border-radius: 7px;
  font-style: normal;
  font-weight: 700;
}

.mind-map-quick-styles .is-important {
  background: #fbeaea;
  color: #c45353;
}

.mind-map-quick-styles .is-idea {
  background: #f8f0db;
  color: #a67b29;
}

.mind-map-quick-styles .is-done {
  background: #e8f4ec;
  color: #4f8060;
}

.mind-map-quick-styles .is-reset {
  background: #eef0f4;
  color: #68717e;
}

.mind-map-field {
  display: grid;
  gap: 7px;
  margin-top: 12px;
}

.mind-map-field > span {
  color: #777f8b;
  font-size: 9px;
  font-weight: 600;
}

.mind-map-field select {
  width: 100%;
  height: 32px;
  padding: 0 9px;
  border: 1px solid #dfe2e7;
  border-radius: 8px;
  outline: none;
  background: #fff;
  color: #505864;
  font-family: inherit;
  font-size: 10px;
}

.mind-map-field select:focus {
  border-color: #7184ca;
  box-shadow: 0 0 0 3px rgba(96, 117, 200, 0.1);
}

.mind-map-segmented,
.mind-map-format-buttons {
  display: flex;
  padding: 3px;
  border-radius: 8px;
  background: #f1f3f6;
}

.mind-map-segmented button,
.mind-map-format-buttons button {
  min-width: 0;
  height: 27px;
  flex: 1;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #69717d;
  font-family: inherit;
  font-size: 9px;
  cursor: pointer;
}

.mind-map-segmented button:hover,
.mind-map-format-buttons button:hover {
  background: rgba(255, 255, 255, 0.7);
}

.mind-map-segmented button.active,
.mind-map-format-buttons button.active {
  background: #fff;
  color: #4e64b6;
  box-shadow: 0 1px 4px rgba(28, 34, 44, 0.1);
}

.mind-map-color-row {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.mind-map-color-row button {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
}

.mind-map-color-row button:hover,
.mind-map-color-row button.active {
  border-color: #bcc6e4;
  background: #f0f3fb;
}

.mind-map-color-row button > i {
  display: grid;
  width: 17px;
  height: 17px;
  place-items: center;
  border: 1px solid rgba(39, 44, 53, 0.13);
  border-radius: 50%;
  color: #656d78;
  font-size: 9px;
  font-style: normal;
  font-weight: 700;
}

.is-transparent {
  background:
    linear-gradient(
      45deg,
      transparent 45%,
      #d26767 46%,
      #d26767 54%,
      transparent 55%
    ),
    #fff;
}

.is-default-branch {
  border-radius: 2px !important;
  background:
    linear-gradient(
      90deg,
      #555 0 44%,
      transparent 44% 56%,
      #555 56%
    );
}

.mind-map-border-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5px;
}

.mind-map-border-grid button {
  display: flex;
  height: 31px;
  align-items: center;
  gap: 7px;
  padding: 0 7px;
  border: 1px solid #e1e4e8;
  border-radius: 7px;
  background: #fff;
  color: #69717d;
  font-family: inherit;
  font-size: 9px;
  cursor: pointer;
}

.mind-map-border-grid button:hover,
.mind-map-border-grid button.active {
  border-color: #bcc6e4;
  background: #f2f4fb;
  color: #4f63b0;
}

.mind-map-border-grid i {
  width: 18px;
  height: 11px;
  border-radius: 2px;
}

button:disabled,
select:disabled {
  opacity: 0.55;
}

:global(.is-theme-night) .mind-map-inspector {
  border-color: #3c4450;
  background: rgba(38, 44, 54, 0.98);
  color: #dce1e9;
}

:global(.is-theme-night)
  .mind-map-inspector-header,
:global(.is-theme-night)
  .mind-map-inspector-section {
  border-color: #414955;
}

:global(.is-theme-night)
  .mind-map-inspector-header strong,
:global(.is-theme-night)
  .mind-map-inspector-section header strong {
  color: #e2e6ed;
}

:global(.is-theme-night)
  .mind-map-skeleton-card,
:global(.is-theme-night)
  .mind-map-theme-list > button {
  color: #d2d7e0;
}

:global(.is-theme-night)
  .mind-map-skeleton-card:hover,
:global(.is-theme-night)
  .mind-map-theme-list > button:hover,
:global(.is-theme-night)
  .mind-map-skeleton-card.active,
:global(.is-theme-night)
  .mind-map-theme-list > button.active {
  border-color: #515b6a;
  background: #343b47;
}

@media (max-width: 820px) {
  .mind-map-inspector {
    position: fixed;
    z-index: 25;
    top: 118px;
    right: 8px;
    bottom: 8px;
    width: min(310px, calc(100vw - 16px));
  }
}
</style>
