<template>
  <NodeViewWrapper
    class="focus-mind-map-block"
    :class="{
      'is-selected': selected,
      'is-missing': Boolean(errorMessage),
    }"
    data-type="focus-mind-map"
    contenteditable="false"
    @mousedown.stop
  >
    <header class="focus-mind-map-card-header">
      <div class="focus-mind-map-heading">
        <span
          class="focus-mind-map-glyph"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="3" />
            <circle cx="4.5" cy="6" r="2" />
            <circle cx="19.5" cy="6" r="2" />
            <circle cx="4.5" cy="18" r="2" />
            <circle cx="19.5" cy="18" r="2" />
            <path d="M9.5 10.5 6.3 7.3M14.5 10.5l3.2-3.2M9.5 13.5l-3.2 3.2M14.5 13.5l3.2 3.2" />
          </svg>
        </span>

        <div>
          <span class="focus-mind-map-eyebrow">
            思维导图
          </span>
          <strong>{{ mapTitle }}</strong>
        </div>
      </div>

      <div class="focus-mind-map-card-actions">
        <button
          type="button"
          class="focus-mind-map-edit-button"
          @click.stop="openEditor"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M7 3H4a1 1 0 0 0-1 1v3M13 3h3a1 1 0 0 1 1 1v3M7 17H4a1 1 0 0 1-1-1v-3M13 17h3a1 1 0 0 0 1-1v-3" />
          </svg>
          全屏编辑
        </button>

        <button
          type="button"
          class="focus-mind-map-delete-button"
          title="删除思维导图"
          aria-label="删除思维导图"
          @click.stop="requestDelete"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M4 6h12M8 3h4l1 2H7l1-2ZM6 6l.7 11h6.6L14 6M8.5 9v5M11.5 9v5" />
          </svg>
        </button>
      </div>
    </header>

    <button
      type="button"
      class="focus-mind-map-preview-shell"
      aria-label="打开思维导图全屏编辑"
      @dblclick.stop="openEditor"
      @click.stop="selectBlock"
    >
      <span
        v-if="previewLoading"
        class="focus-mind-map-loading"
      >
        <i></i>
        正在准备思维导图…
      </span>

      <span
        v-if="errorMessage"
        class="focus-mind-map-error"
      >
        {{ errorMessage }}
      </span>

      <!--
        FOCUS_MIND_MAP_RUNTIME_FIX_20260920_V2

        Mind Elixir 5.15.1 的构造函数只接受
        HTMLDivElement 或 CSS selector。
        这里不能使用 span。
      -->
      <div
        ref="previewCanvas"
        class="focus-mind-map-preview-canvas"
        :aria-hidden="
          String(
            previewLoading
            || Boolean(errorMessage)
          )
        "
      ></div>
    </button>

    <footer class="focus-mind-map-card-footer">
      <span>
        {{ nodeCount }} 个节点
      </span>

      <span class="focus-mind-map-separator">
        ·
      </span>

      <span
        :class="{
          'is-error':
            snapshotState === 'error',
        }"
      >
        {{ snapshotLabel }}
      </span>

      <span class="focus-mind-map-card-hint">
        双击进入全屏编辑
      </span>
    </footer>

    <Teleport to="body">
      <div
        v-if="fullscreenVisible"
        ref="fullscreenDialog"
        class="focus-mind-map-fullscreen"
        :class="`is-theme-${activeThemeId}`"
        role="dialog"
        aria-modal="true"
        aria-labelledby="focus-mind-map-dialog-title"
        tabindex="-1"
        @keydown.esc.stop.prevent="closeEditor"
      >
        <header class="focus-mind-map-fullscreen-header">
          <div class="focus-mind-map-fullscreen-title">
            <button
              type="button"
              class="focus-mind-map-back"
              aria-label="返回文档"
              @click="closeEditor"
            >
              <svg viewBox="0 0 20 20">
                <path d="m12.5 4-6 6 6 6" />
              </svg>
            </button>

            <div>
              <small>思维导图</small>
              <strong id="focus-mind-map-dialog-title">
                {{ mapTitle }}
              </strong>
            </div>
          </div>

          <div class="focus-mind-map-save-state">
            <i :class="`is-${saveState}`"></i>
            {{ saveStateLabel }}
          </div>

          <button
            type="button"
            class="focus-mind-map-done"
            @click="closeEditor"
          >
            完成
          </button>
        </header>

        <nav
          class="focus-mind-map-toolbar"
          aria-label="思维导图工具栏"
        >
          <div
            class="focus-mind-map-tool-group"
            aria-label="历史操作"
          >
            <button
              type="button"
              title="撤销（Ctrl/⌘ Z）"
              @click="undo"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M7 6 3.5 9.5 7 13M4 9.5h7a5 5 0 0 1 5 5" />
              </svg>
              <span class="tool-label">撤销</span>
            </button>

            <button
              type="button"
              title="重做（Ctrl/⌘ Shift Z）"
              @click="redo"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="m13 6 3.5 3.5L13 13m3-3.5H9a5 5 0 0 0-5 5" />
              </svg>
              <span class="tool-label">重做</span>
            </button>
          </div>

          <span class="focus-mind-map-toolbar-rule"></span>

          <div
            class="focus-mind-map-tool-group"
            aria-label="节点操作"
          >
            <button
              type="button"
              :disabled="!hasSelection"
              title="添加子节点（Tab）"
              @click="addChildNode"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <circle cx="5" cy="10" r="2.5" />
                <circle cx="15" cy="5" r="2.5" />
                <circle cx="15" cy="15" r="2.5" />
                <path d="M7.5 10h2.4c1.5 0 2.1-1 2.1-2.2V7.5M12 12.5v-.3c0-1.2-.6-2.2-2.1-2.2" />
              </svg>
              <span class="tool-label">子节点</span>
            </button>

            <button
              type="button"
              :disabled="!hasSelection || selectedIsRoot"
              title="添加同级节点（Enter）"
              @click="addSiblingNode"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <circle cx="6" cy="6" r="2.4" />
                <circle cx="6" cy="14" r="2.4" />
                <path d="M10.5 10h6M13.5 7v6" />
              </svg>
              <span class="tool-label">同级节点</span>
            </button>

            <button
              type="button"
              :disabled="!hasSelection"
              title="编辑所选节点（F2）"
              @click="editSelectedNode"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="m4 14.5-.5 2 2-.5L15 6.5 12.5 4 4 14.5Z" />
                <path d="m11.5 5 2.5 2.5" />
              </svg>
              <span class="tool-label">编辑</span>
            </button>

            <button
              type="button"
              class="is-danger"
              :disabled="!hasSelection || selectedIsRoot"
              title="删除所选节点"
              @click="deleteSelectedNodes"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M4 6h12M8 3h4l1 2H7l1-2M6.5 6l.6 10h5.8l.6-10M8.5 9v4M11.5 9v4" />
              </svg>
              <span class="tool-label">删除</span>
            </button>
          </div>

          <span class="focus-mind-map-toolbar-rule"></span>

          <div
            class="focus-mind-map-tool-group"
            aria-label="分支显示"
          >
            <button
              type="button"
              :disabled="!canToggleBranch"
              :title="
                selectedExpanded
                  ? '折叠当前节点的子分支'
                  : '展开当前节点的子分支'
              "
              @click="toggleSelectedBranch"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <rect x="3" y="4" width="5" height="5" rx="1" />
                <rect x="12" y="11" width="5" height="5" rx="1" />
                <path d="M8 6.5h2a3 3 0 0 1 3 3V11M4.5 6.5h2M13.5 13.5h2" />
              </svg>
              <span class="tool-label">
                {{ selectedExpanded ? "折叠分支" : "展开分支" }}
              </span>
            </button>

            <button
              type="button"
              title="折叠全部分支"
              @click="collapseAllBranches"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M4 6h12M6 10h8M8 14h4" />
              </svg>
              <span class="tool-label">全部折叠</span>
            </button>

            <button
              type="button"
              title="展开全部分支"
              @click="expandAllBranches"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M8 4h4M6 8h8M4 12h12M2 16h16" />
              </svg>
              <span class="tool-label">全部展开</span>
            </button>
          </div>

          <span class="focus-mind-map-toolbar-rule"></span>

          <div class="focus-mind-map-theme-control">
            <button
              type="button"
              class="focus-mind-map-theme-trigger"
              :class="{ active: themeMenuOpen }"
              aria-haspopup="true"
              :aria-expanded="String(themeMenuOpen)"
              title="切换思维导图主题"
              @click.stop="themeMenuOpen = !themeMenuOpen"
            >
              <span
                class="focus-mind-map-theme-dot"
                :style="{ background: activeTheme.preview }"
              ></span>
              <span class="tool-label">{{ activeTheme.label }}</span>
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="m6 8 4 4 4-4" />
              </svg>
            </button>

            <section
              v-if="themeMenuOpen"
              class="focus-mind-map-theme-menu"
              aria-label="选择思维导图主题"
              @click.stop
            >
              <header>
                <strong>主题风格</strong>
                <small>主题会同步到预览和导出图片</small>
              </header>

              <div class="focus-mind-map-theme-grid">
                <button
                  v-for="theme in themeChoices"
                  :key="theme.id"
                  type="button"
                  class="focus-mind-map-theme-option"
                  :class="{
                    active: activeThemeId === theme.id,
                  }"
                  @click="applyTheme(theme.id)"
                >
                  <span
                    class="focus-mind-map-theme-preview"
                    :style="{
                      background: theme.canvas,
                    }"
                  >
                    <i
                      v-for="color in theme.colors"
                      :key="color"
                      :style="{ background: color }"
                    ></i>
                  </span>

                  <span>
                    <strong>{{ theme.label }}</strong>
                    <small>{{ theme.description }}</small>
                  </span>

                  <b v-if="activeThemeId === theme.id">✓</b>
                </button>
              </div>
            </section>
          </div>

          <span class="focus-mind-map-toolbar-spacer"></span>

          <div
            class="focus-mind-map-tool-group"
            aria-label="画布操作"
          >
            <button
              type="button"
              aria-label="缩小"
              title="缩小"
              @click="zoomOut"
            >
              −
            </button>

            <span class="focus-mind-map-zoom">
              {{ Math.round(scale * 100) }}%
            </span>

            <button
              type="button"
              aria-label="放大"
              title="放大"
              @click="zoomIn"
            >
              ＋
            </button>

            <button
              type="button"
              title="适应并居中显示"
              @click="fitAndCenterMap"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M7 3H4a1 1 0 0 0-1 1v3M13 3h3a1 1 0 0 1 1 1v3M7 17H4a1 1 0 0 1-1-1v-3M13 17h3a1 1 0 0 0 1-1v-3" />
              </svg>
              <span class="tool-label">适应画布</span>
            </button>
          </div>
        </nav>

        <main class="focus-mind-map-stage">
          <div
            ref="editorCanvas"
            class="focus-mind-map-editor-canvas"
          ></div>
        </main>

        <footer class="focus-mind-map-shortcuts">
          <span class="focus-mind-map-selection-status">
            <template v-if="hasSelection">
              已选择 {{ selectedCount }} 个节点
              <template v-if="selectedHasChildren">
                · 当前分支可{{ selectedExpanded ? "折叠" : "展开" }}
              </template>
            </template>
            <template v-else>
              选择一个节点，即可使用上方图形化操作
            </template>
          </span>

          <span class="focus-mind-map-shortcut-list">
            <span><kbd>Tab</kbd> 子节点</span>
            <span><kbd>Enter</kbd> 同级节点</span>
            <span><kbd>F2</kbd> 编辑</span>
            <span><kbd>Space</kbd> 折叠/展开</span>
          </span>
        </footer>
      </div>
    </Teleport>
  </NodeViewWrapper>
</template>

<script>
import {
  NodeViewWrapper,
  nodeViewProps,
} from "@tiptap/vue-3";
import MindElixir from "mind-elixir";
import {
  zh_CN,
} from "mind-elixir/i18n";
import "mind-elixir/style.css";

import focusAssetRepository from "../../repositories/focusAssetRepository";

const SAVE_DELAY = 550;
const SNAPSHOT_DELAY = 950;
const MAX_NODE_COUNT = 1000;
const MAX_DATA_BYTES = 2 * 1024 * 1024;

const MIND_MAP_THEMES = Object.freeze({
  minimal: {
    id: "minimal",
    label: "极简黑白",
    description: "清晰、克制，适合正式文档",
    preview: "#323232",
    canvas: "#fafaf8",
    colors: ["#2f2f2f", "#686868", "#a0a0a0"],
    theme: {
      name: "WeekToDo Minimal",
      type: "light",
      palette: [
        "#333333",
        "#4b4b4b",
        "#626262",
        "#787878",
        "#909090",
        "#4f4f4f",
      ],
      cssVar: {
        "--node-gap-x": "30px",
        "--node-gap-y": "13px",
        "--main-gap-x": "72px",
        "--main-gap-y": "44px",
        "--main-color": "#303030",
        "--main-bgcolor": "#ffffff",
        "--main-bgcolor-transparent": "rgba(255,255,255,.92)",
        "--main-border": "1.5px solid #343434",
        "--color": "#303030",
        "--bgcolor": "#fafaf8",
        "--selected": "#6579c8",
        "--accent-color": "#343434",
        "--root-color": "#242424",
        "--root-bgcolor": "#ffffff",
        "--root-border-color": "#303030",
        "--root-radius": "7px",
        "--main-radius": "5px",
        "--topic-padding": "5px 8px",
        "--panel-color": "#303030",
        "--panel-bgcolor": "#ffffff",
        "--panel-border-color": "#dededb",
        "--map-padding": "72px 96px",
      },
    },
  },

  business: {
    id: "business",
    label: "商务蓝",
    description: "稳重清晰，适合项目与汇报",
    preview: "#526dcc",
    canvas: "#f7f9fd",
    colors: ["#4059ad", "#6683d9", "#9bb2ef"],
    theme: {
      name: "WeekToDo Business",
      type: "light",
      palette: [
        "#4059ad",
        "#5273c8",
        "#6683d9",
        "#3f7cac",
        "#6379b8",
        "#7897df",
      ],
      cssVar: {
        "--node-gap-x": "32px",
        "--node-gap-y": "13px",
        "--main-gap-x": "72px",
        "--main-gap-y": "44px",
        "--main-color": "#34456d",
        "--main-bgcolor": "#ffffff",
        "--main-bgcolor-transparent": "rgba(255,255,255,.92)",
        "--main-border": "1px solid #cfd8ec",
        "--color": "#33405c",
        "--bgcolor": "#f7f9fd",
        "--selected": "#526dcc",
        "--accent-color": "#526dcc",
        "--root-color": "#ffffff",
        "--root-bgcolor": "#526dcc",
        "--root-border-color": "#526dcc",
        "--root-radius": "9px",
        "--main-radius": "7px",
        "--topic-padding": "5px 9px",
        "--panel-color": "#34405a",
        "--panel-bgcolor": "#ffffff",
        "--panel-border-color": "#d8deea",
        "--map-padding": "72px 96px",
      },
    },
  },

  forest: {
    id: "forest",
    label: "森林绿",
    description: "柔和自然，适合知识与规划",
    preview: "#4f7d68",
    canvas: "#f7faf7",
    colors: ["#416b59", "#6c927e", "#9ab5a6"],
    theme: {
      name: "WeekToDo Forest",
      type: "light",
      palette: [
        "#416b59",
        "#527d68",
        "#6c927e",
        "#789d89",
        "#477667",
        "#83a590",
      ],
      cssVar: {
        "--node-gap-x": "32px",
        "--node-gap-y": "13px",
        "--main-gap-x": "72px",
        "--main-gap-y": "44px",
        "--main-color": "#355747",
        "--main-bgcolor": "#ffffff",
        "--main-bgcolor-transparent": "rgba(255,255,255,.92)",
        "--main-border": "1px solid #cfddd4",
        "--color": "#344b40",
        "--bgcolor": "#f7faf7",
        "--selected": "#4f7d68",
        "--accent-color": "#4f7d68",
        "--root-color": "#ffffff",
        "--root-bgcolor": "#4f7d68",
        "--root-border-color": "#4f7d68",
        "--root-radius": "9px",
        "--main-radius": "7px",
        "--topic-padding": "5px 9px",
        "--panel-color": "#344b40",
        "--panel-bgcolor": "#ffffff",
        "--panel-border-color": "#d5e0d8",
        "--map-padding": "72px 96px",
      },
    },
  },

  warm: {
    id: "warm",
    label: "暖纸",
    description: "温和舒展，适合阅读与创意",
    preview: "#a86f4d",
    canvas: "#fcfaf5",
    colors: ["#9b6345", "#c18a63", "#d6ae78"],
    theme: {
      name: "WeekToDo Warm Paper",
      type: "light",
      palette: [
        "#9b6345",
        "#b87855",
        "#c18a63",
        "#a97845",
        "#bf965e",
        "#8e6650",
      ],
      cssVar: {
        "--node-gap-x": "32px",
        "--node-gap-y": "14px",
        "--main-gap-x": "74px",
        "--main-gap-y": "46px",
        "--main-color": "#624b3c",
        "--main-bgcolor": "#fffefa",
        "--main-bgcolor-transparent": "rgba(255,254,250,.92)",
        "--main-border": "1px solid #e3d8c9",
        "--color": "#58493f",
        "--bgcolor": "#fcfaf5",
        "--selected": "#a86f4d",
        "--accent-color": "#a86f4d",
        "--root-color": "#ffffff",
        "--root-bgcolor": "#9b6345",
        "--root-border-color": "#9b6345",
        "--root-radius": "9px",
        "--main-radius": "7px",
        "--topic-padding": "5px 9px",
        "--panel-color": "#58493f",
        "--panel-bgcolor": "#fffefa",
        "--panel-border-color": "#e5dccf",
        "--map-padding": "72px 96px",
      },
    },
  },

  night: {
    id: "night",
    label: "深色专注",
    description: "低眩光，适合夜间沉浸编辑",
    preview: "#8ca3ff",
    canvas: "#1e222a",
    colors: ["#8297e8", "#76aaa0", "#bc8ea8"],
    theme: {
      name: "WeekToDo Night",
      type: "dark",
      palette: [
        "#8297e8",
        "#76aaa0",
        "#bc8ea8",
        "#bd9a70",
        "#769ac5",
        "#9d8bc1",
      ],
      cssVar: {
        "--node-gap-x": "32px",
        "--node-gap-y": "13px",
        "--main-gap-x": "72px",
        "--main-gap-y": "44px",
        "--main-color": "#d9deea",
        "--main-bgcolor": "#292f39",
        "--main-bgcolor-transparent": "rgba(41,47,57,.92)",
        "--main-border": "1px solid #454e5d",
        "--color": "#d5dae4",
        "--bgcolor": "#1e222a",
        "--selected": "#8ca3ff",
        "--accent-color": "#8ca3ff",
        "--root-color": "#ffffff",
        "--root-bgcolor": "#6077ce",
        "--root-border-color": "#8297e8",
        "--root-radius": "9px",
        "--main-radius": "7px",
        "--topic-padding": "5px 9px",
        "--panel-color": "#e3e7ef",
        "--panel-bgcolor": "#292f39",
        "--panel-border-color": "#444c59",
        "--map-padding": "72px 96px",
      },
    },
  },
});

function resolveThemeId(data) {
  const requested =
    data?.meta?.themeId;

  if (requested && MIND_MAP_THEMES[requested]) {
    return requested;
  }

  const legacyName = data?.theme?.name;

  const matched = Object.values(
    MIND_MAP_THEMES
  ).find(
    (item) =>
      item.theme.name === legacyName
  );

  return matched?.id || "minimal";
}

function getTheme(themeId) {
  return clone(
    (
      MIND_MAP_THEMES[themeId]
      || MIND_MAP_THEMES.minimal
    ).theme
  );
}

const EXPORT_CSS = `
  me-tpc {
    font-family:
      Inter, -apple-system, BlinkMacSystemFont,
      "Segoe UI", "PingFang SC",
      "Microsoft YaHei", sans-serif;
  }
`;

function clone(value) {
  return JSON.parse(
    JSON.stringify(value || null)
  );
}

function fallbackData(title = "中心主题") {
  const id =
    globalThis.crypto?.randomUUID?.()
    || `node-${Date.now()}`;

  return {
    nodeData: {
      id,
      topic: title,
      root: true,
      children: [],
    },
    arrows: [],
    summaries: [],
    direction: 2,
  };
}

function walkNodeCount(node) {
  if (!node || typeof node !== "object") {
    return 0;
  }

  return (
    1
    + (
      Array.isArray(node.children)
        ? node.children.reduce(
            (total, child) =>
              total + walkNodeCount(child),
            0
          )
        : 0
    )
  );
}

function dataSize(value) {
  return new Blob([
    JSON.stringify(value || {}),
  ]).size;
}

/*
 * FOCUS_MIND_MAP_RUNTIME_FIX_20260920_V2
 *
 * Vue nextTick 只能保证 DOM 已写入，不能保证：
 * - Teleport 已完成最终布局；
 * - CSS Grid 已计算出画布高度；
 * - Electron 已完成当前帧样式计算。
 *
 * Mind Elixir 的初始化和 scaleFit 都依赖非零尺寸。
 */
function nextAnimationFrame() {
  return new Promise((resolve) => {
    requestAnimationFrame(resolve);
  });
}

async function waitForUsableCanvas(
  element,
  label
) {
  if (
    !element
    || !(
      element
      instanceof HTMLDivElement
    )
  ) {
    throw new TypeError(
      `${label}必须是 HTMLDivElement`
    );
  }

  for (
    let attempt = 0;
    attempt < 8;
    attempt += 1
  ) {
    const rect =
      element.getBoundingClientRect();

    if (
      rect.width >= 40
      && rect.height >= 40
    ) {
      return rect;
    }

    await nextAnimationFrame();
  }

  const rect =
    element.getBoundingClientRect();

  throw new Error(
    `${label}尺寸异常：`
    + `${Math.round(rect.width)} × `
    + `${Math.round(rect.height)}`
  );
}

function normalizeMindMapData(
  value,
  title = "中心主题"
) {
  const data = clone(value);

  if (
    !data
    || typeof data !== "object"
    || !data.nodeData
    || typeof data.nodeData !== "object"
  ) {
    return fallbackData(title);
  }

  const normalizeNode = (
    node,
    isRoot = false
  ) => {
    if (
      !node
      || typeof node !== "object"
    ) {
      return null;
    }

    const normalized = {
      ...node,
      id:
        String(node.id || "").trim()
        || (
          globalThis.crypto
            ?.randomUUID?.()
          || `node-${Date.now()}-${Math.random()
            .toString(16)
            .slice(2)}`
        ),
      topic:
        String(
          node.topic
          || (
            isRoot
              ? title
              : "新主题"
          )
        ),
    };

    /*
     * parent 是 Mind Elixir 运行时引用。
     * 不能重新写回持久化 JSON，否则会产生循环引用。
     */
    delete normalized.parent;

    if (isRoot) {
      normalized.root = true;
    }

    normalized.children = Array.isArray(
      node.children
    )
      ? node.children
          .map((child) =>
            normalizeNode(
              child,
              false
            )
          )
          .filter(Boolean)
      : [];

    return normalized;
  };

  data.nodeData = normalizeNode(
    data.nodeData,
    true
  );

  data.arrows = Array.isArray(
    data.arrows
  )
    ? data.arrows
    : [];

  data.summaries = Array.isArray(
    data.summaries
  )
    ? data.summaries
    : [];

  data.direction = [
    MindElixir.LEFT,
    MindElixir.RIGHT,
    MindElixir.SIDE,
    MindElixir.DOWN,
  ].includes(data.direction)
    ? data.direction
    : MindElixir.SIDE;

  return data;
}

async function fitMindMap(
  mind
) {
  await nextAnimationFrame();
  await nextAnimationFrame();

  /*
   * scaleFit 先让整张脑图进入可视区域，
   * toCenter 再把视觉中心对齐到画布中心。
   */
  mind?.scaleFit?.();

  await nextAnimationFrame();

  mind?.toCenter?.();
}

export default {
  name: "FocusMindMapNodeView",

  components: {
    NodeViewWrapper,
  },

  props: nodeViewProps,

  data() {
    return {
      previewMind: null,
      editingMind: null,
      fullscreenVisible: false,
      previewLoading: true,
      errorMessage: "",
      saveState: "saved",
      snapshotState:
        this.node.attrs.assetId
          ? "ready"
          : "pending",
      scale: 1,
      saveTimer: null,
      snapshotTimer: null,
      snapshotRevision: 0,
      closing: false,
      activeThemeId:
        resolveThemeId(
          this.node.attrs.data
        ),
      themeMenuOpen: false,
      selectedCount: 0,
      selectedIsRoot: false,
      selectedHasChildren: false,
      selectedExpanded: true,
      actionMessage: "",
    };
  },

  computed: {
    mapTitle() {
      return (
        String(
          this.node.attrs.title
          || this.node.attrs.data
            ?.nodeData?.topic
          || "中心主题"
        ).trim()
        || "中心主题"
      );
    },

    nodeCount() {
      return (
        Number(this.node.attrs.nodeCount)
        || walkNodeCount(
          this.node.attrs.data?.nodeData
        )
        || 1
      );
    },

    themeChoices() {
      return Object.values(
        MIND_MAP_THEMES
      );
    },

    activeTheme() {
      return (
        MIND_MAP_THEMES[
          this.activeThemeId
        ]
        || MIND_MAP_THEMES.minimal
      );
    },

    hasSelection() {
      return this.selectedCount > 0;
    },

    canToggleBranch() {
      return (
        this.selectedCount === 1
        && this.selectedHasChildren
      );
    },

    snapshotLabel() {
      if (
        this.snapshotState === "working"
      ) {
        return "正在更新导出快照";
      }

      if (
        this.snapshotState === "error"
      ) {
        return "导出快照生成失败";
      }

      if (
        this.snapshotState === "ready"
      ) {
        return "导出快照已就绪";
      }

      return "正在准备导出快照";
    },

    saveStateLabel() {
      switch (this.saveState) {
        case "saving":
          return "正在保存";

        case "error":
          return "保存失败";

        default:
          return "已保存";
      }
    },
  },

  mounted() {
    this.buildPreview();

    if (!this.node.attrs.assetId) {
      this.queueSnapshot(1200);
    }
  },

  beforeUnmount() {
    window.clearTimeout(this.saveTimer);
    window.clearTimeout(
      this.snapshotTimer
    );

    this.destroyPreview();
    this.destroyEditor();
  },

  methods: {
    currentData() {
      const raw =
        this.editingMind?.getData?.()
        || this.node.attrs.data
        || fallbackData(this.mapTitle);

      const data = clone(raw);

      data.meta = {
        ...(data.meta || {}),
        themeId: this.activeThemeId,
      };

      data.theme = getTheme(
        this.activeThemeId
      );

      return data;
    },

    prepareData(value, title) {
      const data =
        normalizeMindMapData(
          value,
          title
        );

      data.meta = {
        ...(data.meta || {}),
        themeId: this.activeThemeId,
      };

      data.theme = getTheme(
        this.activeThemeId
      );

      return data;
    },

    createMind(element, editable) {
      if (
        !(
          element
          instanceof HTMLDivElement
        )
      ) {
        throw new TypeError(
          "Mind Elixir 挂载点必须是 div"
        );
      }

      return new MindElixir({
        el: element,
        direction:
          MindElixir.SIDE,
        editable,
        theme: getTheme(
          this.activeThemeId
        ),

        /*
         * draggable 在 5.15.1 中已经废弃，
         * 是否允许拖动由 editable 控制。
         */
        contextMenu: editable
          ? {
              locale: zh_CN,
              focus: true,
              link: true,
            }
          : false,

        toolBar: false,
        keypress: editable,
        allowUndo: editable,
        compact: false,
        overflowHidden: false,
        handleWheel: true,
        newTopicName: "新主题",
        scaleMin: 0.35,
        scaleMax: 2.2,
        scaleSensitivity: 0.08,
      });
    },

    async buildPreview() {
      this.previewLoading = true;
      this.errorMessage = "";

      await this.$nextTick();

      try {
        this.destroyPreview();

        const element =
          this.$refs.previewCanvas;

        if (!element) return;

        await waitForUsableCanvas(
          element,
          "思维导图预览画布"
        );

        this.previewMind =
          this.createMind(
            element,
            false
          );

        const error =
          this.previewMind.init(
            this.prepareData(
              this.node.attrs.data,
              this.mapTitle
            )
          );

        if (error instanceof Error) {
          throw error;
        }

        await fitMindMap(
          this.previewMind
        );
      } catch (error) {
        console.error(
          "[mind-map] 预览初始化失败",
          error
        );

        this.destroyPreview();

        this.errorMessage =
          "思维导图加载失败，请进入全屏编辑重试。";
      } finally {
        this.previewLoading = false;
      }
    },

    destroyPreview() {
      try {
        this.previewMind?.destroy?.();
      } catch (_) {
        // Mind Elixir 的 destroy 必须允许重复调用。
      }

      this.previewMind = null;

      if (this.$refs.previewCanvas) {
        this.$refs.previewCanvas
          .replaceChildren();
      }
    },

    selectBlock() {
      try {
        const position = this.getPos();

        this.editor.commands.setNodeSelection(
          position
        );
      } catch (_) {
        // 文档事务执行期间节点可能已被删除。
      }
    },

    async openEditor() {
      if (this.fullscreenVisible) return;

      this.fullscreenVisible = true;
      this.saveState = "saved";
      this.scale = 1;

      document.body.classList.add(
        "focus-mind-map-is-open"
      );

      await this.$nextTick();

      try {
        const element =
          this.$refs.editorCanvas;

        await waitForUsableCanvas(
          element,
          "思维导图全屏画布"
        );

        this.editingMind =
          this.createMind(
            element,
            true
          );

        const error =
          this.editingMind.init(
            this.prepareData(
              this.node.attrs.data,
              this.mapTitle
            )
          );

        if (error instanceof Error) {
          throw error;
        }

        const handleDataChange = () => {
          this.saveState = "saving";
          this.syncSelectionState();
          this.queueSave();
        };

        this.editingMind.bus.addListener(
          "operation",
          handleDataChange
        );

        this.editingMind.bus.addListener(
          "expandNode",
          handleDataChange
        );

        this.editingMind.bus.addListener(
          "selectNode",
          () => {
            this.$nextTick(
              this.syncSelectionState
            );
          }
        );

        await fitMindMap(
          this.editingMind
        );

        this.scale =
          Number(
            this.editingMind.scaleVal
          )
          || 1;

        this.$refs.fullscreenDialog
          ?.focus?.();

        this.editingMind.container
          ?.focus?.();

        this.syncSelectionState();
      } catch (error) {
        console.error(
          "[mind-map] 编辑器初始化失败",
          error
        );

        this.destroyEditor();
        this.saveState = "error";

        window.alert(
          "思维导图编辑器初始化失败："
          + (
            error?.message
            || "未知错误"
          )
        );
      }
    },

    queueSave() {
      window.clearTimeout(
        this.saveTimer
      );

      this.saveTimer = window.setTimeout(
        () => {
          this.persistNow();
        },
        SAVE_DELAY
      );
    },

    validateData(data) {
      const count =
        walkNodeCount(data?.nodeData);

      if (count > MAX_NODE_COUNT) {
        throw new Error(
          `单张思维导图最多支持 ${MAX_NODE_COUNT} 个节点。`
        );
      }

      if (dataSize(data) > MAX_DATA_BYTES) {
        throw new Error(
          "思维导图数据不能超过 2MB。"
        );
      }

      return count;
    },

    async persistNow() {
      window.clearTimeout(
        this.saveTimer
      );

      if (!this.editingMind) {
        return;
      }

      try {
        const data = this.currentData();
        const count =
          this.validateData(data);
        const title =
          String(
            data.nodeData?.topic
            || "中心主题"
          ).trim()
          || "中心主题";

        this.updateAttributes({
          data,
          title,
          alt: `思维导图：${title}`,
          nodeCount: count,
          updatedAt:
            new Date().toISOString(),
        });

        this.saveState = "saved";
        this.queueSnapshot();
      } catch (error) {
        console.error(
          "[mind-map] 保存失败",
          error
        );

        this.saveState = "error";

        window.alert(
          error?.message
          || "保存思维导图失败。"
        );
      }
    },

    queueSnapshot(
      delay = SNAPSHOT_DELAY
    ) {
      window.clearTimeout(
        this.snapshotTimer
      );

      this.snapshotTimer =
        window.setTimeout(
          () => {
            this.generateSnapshot();
          },
          delay
        );
    },

    async generateSnapshot() {
      const source =
        this.editingMind
        || this.previewMind;

      if (!source?.exportPng) return;

      const revision =
        ++this.snapshotRevision;

      this.snapshotState = "working";

      try {
        const blob =
          await source.exportPng(
            false,
            EXPORT_CSS
          );

        if (!blob) {
          throw new Error(
            "未生成思维导图图片"
          );
        }

        if (
          revision
          !== this.snapshotRevision
        ) {
          return;
        }

        const previousAssetId =
          this.node.attrs.assetId;

        const asset =
          await focusAssetRepository
            .saveImage(
              blob,
              `mind-map:${
                this.node.attrs.mapId
                || "unknown"
              }`
            );

        const bitmap =
          await createImageBitmap(blob);

        this.updateAttributes({
          assetId: asset.id,
          originalWidth: bitmap.width,
          originalHeight: bitmap.height,
          width: "100%",
          updatedAt:
            new Date().toISOString(),
        });

        bitmap.close?.();

        this.snapshotState = "ready";

        /*
         * 不在这里立即删除 previousAssetId。
         *
         * 用户执行文档撤销时，旧节点可能重新引用旧快照；
         * 立即删除会造成撤销后的思维导图无法导出。
         *
         * 旧快照由 focusAssetRepository.pruneUnreferenced()
         * 在宽限期后统一清理。
         */
        void previousAssetId;
      } catch (error) {
        console.error(
          "[mind-map] 快照生成失败",
          error
        );

        this.snapshotState = "error";
      }
    },

    async closeEditor() {
      if (this.closing) return;

      this.closing = true;

      try {
        if (this.editingMind) {
          await this.persistNow();

          window.clearTimeout(
            this.snapshotTimer
          );
          this.snapshotTimer = null;

          await this.generateSnapshot();
        }
      } finally {
        this.destroyEditor();
        this.fullscreenVisible = false;
        this.closing = false;

        document.body.classList.remove(
          "focus-mind-map-is-open"
        );

        await this.$nextTick();
        this.buildPreview();
      }
    },

    destroyEditor() {
      try {
        this.editingMind?.destroy?.();
      } catch (_) {
        // 允许视图卸载和关闭动作重复执行。
      }

      this.editingMind = null;
      this.themeMenuOpen = false;
      this.selectedCount = 0;
      this.selectedIsRoot = false;
      this.selectedHasChildren = false;
      this.selectedExpanded = true;

      if (this.$refs.editorCanvas) {
        this.$refs.editorCanvas
          .replaceChildren();
      }
    },

    selectedTopics() {
      if (!this.editingMind) {
        return [];
      }

      const selected =
        Array.isArray(
          this.editingMind.currentNodes
        )
          ? this.editingMind.currentNodes
              .filter(Boolean)
          : [];

      if (selected.length) {
        return selected;
      }

      return this.editingMind.currentNode
        ? [this.editingMind.currentNode]
        : [];
    },

    syncSelectionState() {
      const selected =
        this.selectedTopics();

      this.selectedCount =
        selected.length;

      const first =
        selected[0]?.nodeObj;

      this.selectedIsRoot =
        Boolean(first?.root);

      this.selectedHasChildren =
        Boolean(first?.children?.length);

      this.selectedExpanded =
        first?.expanded !== false;
    },

    async runNodeAction(action) {
      if (!this.editingMind) return;

      try {
        await action();

        this.saveState = "saving";

        await this.$nextTick();
        this.syncSelectionState();
        this.queueSave();
      } catch (error) {
        console.error(
          "[mind-map] 节点操作失败",
          error
        );

        this.saveState = "error";

        window.alert(
          error?.message
          || "节点操作失败，请重试。"
        );
      }
    },

    addChildNode() {
      const target =
        this.selectedTopics()[0];

      if (!target) return;

      this.runNodeAction(
        () =>
          this.editingMind.addChild(
            target
          )
      );
    },

    addSiblingNode() {
      const target =
        this.selectedTopics()[0];

      if (!target || target.nodeObj?.root) {
        return;
      }

      this.runNodeAction(
        () =>
          this.editingMind.insertSibling(
            "after",
            target
          )
      );
    },

    editSelectedNode() {
      const target =
        this.selectedTopics()[0];

      if (!target) return;

      this.runNodeAction(
        () =>
          this.editingMind.beginEdit(
            target
          )
      );
    },

    deleteSelectedNodes() {
      const selected =
        this.selectedTopics().filter(
          (topic) =>
            !topic.nodeObj?.root
        );

      if (!selected.length) return;

      const accepted =
        window.confirm(
          selected.length > 1
            ? `删除选中的 ${selected.length} 个节点及其子节点？`
            : "删除当前节点及其所有子节点？"
        );

      if (!accepted) return;

      this.runNodeAction(
        () =>
          this.editingMind.removeNodes(
            selected
          )
      );
    },

    toggleSelectedBranch() {
      const target =
        this.selectedTopics()[0];

      if (
        !target
        || !target.nodeObj
          ?.children?.length
      ) {
        return;
      }

      const expand =
        target.nodeObj.expanded === false;

      this.editingMind.expandNode(
        target,
        expand
      );

      this.selectedExpanded = expand;
      this.saveState = "saving";
      this.queueSave();
    },

    rootTopic() {
      const rootId =
        this.editingMind
          ?.nodeData?.id;

      if (!rootId) return null;

      return this.editingMind.findEle(
        rootId
      );
    },

    collapseAllBranches() {
      const root = this.rootTopic();

      if (!root) return;

      this.editingMind.expandNodeAll(
        root,
        false
      );

      this.syncSelectionState();
      this.saveState = "saving";
      this.queueSave();
    },

    expandAllBranches() {
      const root = this.rootTopic();

      if (!root) return;

      this.editingMind.expandNodeAll(
        root,
        true
      );

      this.syncSelectionState();
      this.saveState = "saving";
      this.queueSave();
    },

    applyTheme(themeId) {
      if (!MIND_MAP_THEMES[themeId]) {
        return;
      }

      this.activeThemeId = themeId;
      this.themeMenuOpen = false;

      this.editingMind?.changeTheme?.(
        getTheme(themeId),
        true
      );

      this.saveState = "saving";
      this.queueSave();

      window.setTimeout(
        () => {
          this.editingMind?.toCenter?.();
        },
        80
      );
    },

    async fitAndCenterMap() {
      if (!this.editingMind) return;

      await fitMindMap(
        this.editingMind
      );

      this.scale =
        Number(
          this.editingMind.scaleVal
        )
        || 1;
    },

    undo() {
      this.editingMind?.undo?.();
      this.saveState = "saving";
      this.queueSave();
      this.$nextTick(
        this.syncSelectionState
      );
    },

    redo() {
      this.editingMind?.redo?.();
      this.saveState = "saving";
      this.queueSave();
      this.$nextTick(
        this.syncSelectionState
      );
    },

    applyScale(nextScale) {
      const value = Math.min(
        2.2,
        Math.max(0.35, nextScale)
      );

      this.scale = value;
      this.editingMind?.scale?.(value);
    },

    zoomIn() {
      this.applyScale(
        this.scale + 0.1
      );
    },

    zoomOut() {
      this.applyScale(
        this.scale - 0.1
      );
    },

    centerMap() {
      this.scale =
        Number(
          this.editingMind?.scaleVal
        )
        || 1;

      this.editingMind
        ?.toCenter?.();
    },

    requestDelete() {
      const accepted =
        window.confirm(
          "删除这张思维导图？此操作可以通过文档撤销恢复。"
        );

      if (!accepted) return;

      this.deleteNode();
    },
  },
};
</script>

<style>
body.focus-mind-map-is-open {
  overflow: hidden !important;
}
</style>

<style scoped>
.focus-mind-map-block {
  margin: 18px 0;
  overflow: hidden;
  border: 1px solid #e2e6eb;
  border-radius: 14px;
  background: #fff;
  box-shadow:
    0 1px 2px rgba(20, 27, 38, 0.03),
    0 8px 28px rgba(20, 27, 38, 0.04);
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.focus-mind-map-block:hover {
  border-color: #ced5df;
  box-shadow:
    0 1px 2px rgba(20, 27, 38, 0.04),
    0 12px 32px rgba(20, 27, 38, 0.07);
}

.focus-mind-map-block.is-selected {
  border-color: #8098e8;
  box-shadow:
    0 0 0 3px rgba(98, 123, 218, 0.12),
    0 12px 32px rgba(20, 27, 38, 0.07);
}

.focus-mind-map-card-header,
.focus-mind-map-card-footer,
.focus-mind-map-fullscreen-header,
.focus-mind-map-toolbar,
.focus-mind-map-shortcuts {
  display: flex;
  align-items: center;
}

.focus-mind-map-card-header {
  min-height: 64px;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 12px 10px 16px;
  border-bottom: 1px solid #edf0f3;
}

.focus-mind-map-heading {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 11px;
}

.focus-mind-map-heading > div {
  min-width: 0;
}

.focus-mind-map-heading strong {
  display: block;
  overflow: hidden;
  color: #242933;
  font-size: 14px;
  font-weight: 650;
  line-height: 21px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.focus-mind-map-eyebrow {
  display: block;
  color: #959ca8;
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.08em;
  line-height: 16px;
}

.focus-mind-map-glyph {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 10px;
  background: #eef1ff;
  color: #627bda;
}

.focus-mind-map-glyph svg {
  width: 20px;
  height: 20px;
  fill: #fff;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
}

.focus-mind-map-card-actions {
  display: flex;
  align-items: center;
  gap: 5px;
}

.focus-mind-map-card-actions button,
.focus-mind-map-toolbar button,
.focus-mind-map-back,
.focus-mind-map-done {
  border: 0;
  font-family: inherit;
  cursor: pointer;
}

.focus-mind-map-edit-button {
  display: inline-flex;
  height: 34px;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  border-radius: 9px !important;
  background: #f0f2f7;
  color: #4c5668;
  font-size: 12px;
  font-weight: 600;
}

.focus-mind-map-edit-button:hover {
  background: #e8ebf3;
  color: #2f3f74;
}

.focus-mind-map-edit-button svg,
.focus-mind-map-delete-button svg,
.focus-mind-map-toolbar svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.6;
}

.focus-mind-map-delete-button {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 9px;
  background: transparent;
  color: #a1a7b1;
}

.focus-mind-map-delete-button:hover {
  background: #fff0f0;
  color: #c95050;
}

.focus-mind-map-preview-shell {
  position: relative;
  display: block;
  width: 100%;
  height: clamp(250px, 34vw, 390px);
  overflow: hidden;
  border: 0;
  background:
    radial-gradient(
      circle at 1px 1px,
      rgba(91, 105, 132, 0.12) 1px,
      transparent 1px
    );
  background-color: #fafbfc;
  background-size: 20px 20px;
  cursor: default;
}

.focus-mind-map-preview-canvas {
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

/*
 * Mind Elixir 内部以百分比尺寸挂载，
 * 外层和内部容器都必须有确定高度。
 */
.focus-mind-map-preview-canvas
  :deep(.map-container),
.focus-mind-map-preview-canvas
  :deep(.map-canvas) {
  width: 100%;
  height: 100%;
}

.focus-mind-map-loading,
.focus-mind-map-error {
  position: absolute;
  z-index: 2;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  color: #8d95a1;
  font-size: 12px;
}

.focus-mind-map-error {
  color: #b85a5a;
}

.focus-mind-map-loading i {
  width: 14px;
  height: 14px;
  border: 2px solid #d9dde5;
  border-top-color: #7087df;
  border-radius: 50%;
  animation: focus-map-spin 700ms linear infinite;
}

.focus-mind-map-card-footer {
  min-height: 38px;
  gap: 5px;
  padding: 0 16px;
  border-top: 1px solid #edf0f3;
  color: #969da8;
  font-size: 11px;
}

.focus-mind-map-card-footer .is-error {
  color: #c55d5d;
}

.focus-mind-map-card-hint {
  margin-left: auto;
  color: #b0b5bd;
}

.focus-mind-map-fullscreen {
  position: fixed;
  z-index: 30000;
  inset: 0;
  display: grid;
  grid-template-rows: 64px 48px minmax(0, 1fr) 38px;
  background: #f7f8fa;
  color: #252a33;
}

.focus-mind-map-fullscreen-header {
  justify-content: space-between;
  gap: 18px;
  padding: 0 22px;
  border-bottom: 1px solid #e2e6eb;
  background: rgba(255, 255, 255, 0.96);
}

.focus-mind-map-fullscreen-title {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}

.focus-mind-map-fullscreen-title > div {
  min-width: 0;
}

.focus-mind-map-fullscreen-title small {
  display: block;
  color: #949ba7;
  font-size: 10px;
  letter-spacing: 0.08em;
}

.focus-mind-map-fullscreen-title strong {
  display: block;
  overflow: hidden;
  max-width: 48vw;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.focus-mind-map-back {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: 10px;
  background: #f1f3f6;
  color: #566071;
}

.focus-mind-map-back:hover {
  background: #e8ebef;
}

.focus-mind-map-back svg {
  width: 19px;
  height: 19px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.focus-mind-map-save-state {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-left: auto;
  color: #8c939e;
  font-size: 11px;
}

.focus-mind-map-save-state i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #61a174;
}

.focus-mind-map-save-state i.is-saving {
  background: #d0a24d;
}

.focus-mind-map-save-state i.is-error {
  background: #c95b5b;
}

.focus-mind-map-done {
  height: 34px;
  padding: 0 17px;
  border-radius: 9px;
  background: #627bda;
  color: #fff;
  font-size: 12px;
  font-weight: 650;
}

.focus-mind-map-done:hover {
  background: #526ccf;
}

.focus-mind-map-toolbar {
  gap: 10px;
  padding: 0 22px;
  border-bottom: 1px solid #e2e6eb;
  background: #fff;
}

.focus-mind-map-tool-group {
  display: flex;
  align-items: center;
  gap: 3px;
}

.focus-mind-map-toolbar button {
  display: inline-flex;
  min-width: 34px;
  height: 32px;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 0 9px;
  border-radius: 8px;
  background: transparent;
  color: #616a79;
  font-size: 11px;
}

.focus-mind-map-toolbar button:hover {
  background: #f0f2f5;
  color: #2f3f74;
}

.focus-mind-map-toolbar-rule {
  width: 1px;
  height: 20px;
  background: #e4e7eb;
}

.focus-mind-map-zoom {
  min-width: 45px;
  color: #89919d;
  font-size: 11px;
  text-align: center;
}

.focus-mind-map-stage {
  position: relative;
  min-height: 0;
  padding: 14px;
  overflow: hidden;
}

.focus-mind-map-editor-canvas {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid #e0e4e9;
  border-radius: 14px;
  background:
    radial-gradient(
      circle at 1px 1px,
      rgba(91, 105, 132, 0.13) 1px,
      transparent 1px
    );
  background-color: #fff;
  background-size: 22px 22px;
  box-shadow: 0 12px 40px rgba(24, 32, 45, 0.06);
}

.focus-mind-map-editor-canvas
  :deep(.map-container),
.focus-mind-map-editor-canvas
  :deep(.map-canvas) {
  width: 100%;
  height: 100%;
}

.focus-mind-map-editor-canvas
  :deep(.map-container) {
  border-radius: inherit;
}

.focus-mind-map-shortcuts {
  justify-content: center;
  gap: 20px;
  border-top: 1px solid #e2e6eb;
  background: #fff;
  color: #959ca7;
  font-size: 10px;
}

.focus-mind-map-shortcuts kbd {
  padding: 1px 5px;
  border: 1px solid #d9dde3;
  border-bottom-width: 2px;
  border-radius: 5px;
  background: #f8f9fa;
  color: #69717e;
  font-family: inherit;
  font-size: 9px;
}

@keyframes focus-map-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 720px) {
  .focus-mind-map-card-hint,
  .focus-mind-map-shortcuts {
    display: none;
  }

  .focus-mind-map-preview-shell {
    height: 260px;
  }

  .focus-mind-map-fullscreen {
    grid-template-rows:
      58px 46px minmax(0, 1fr);
  }

  .focus-mind-map-stage {
    padding: 8px;
  }

  .focus-mind-map-fullscreen-header,
  .focus-mind-map-toolbar {
    padding-right: 10px;
    padding-left: 10px;
  }

  .focus-mind-map-toolbar button {
    font-size: 0;
  }

  .focus-mind-map-toolbar button svg {
    margin: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .focus-mind-map-block {
    transition: none;
  }

  .focus-mind-map-loading i {
    animation-duration: 1400ms;
  }
}

:global(.dark-theme) .focus-mind-map-block {
  border-color: #343a45;
  background: #20242b;
  box-shadow: none;
}

:global(.dark-theme) .focus-mind-map-card-header,
:global(.dark-theme) .focus-mind-map-card-footer {
  border-color: #343a45;
}

:global(.dark-theme) .focus-mind-map-heading strong {
  color: #e5e8ed;
}

:global(.dark-theme) .focus-mind-map-glyph {
  background: rgba(111, 137, 224, 0.16);
  color: #91a6eb;
}

:global(.dark-theme) .focus-mind-map-preview-shell {
  background-color: #1d2128;
  background-image:
    radial-gradient(
      circle at 1px 1px,
      rgba(171, 181, 201, 0.12) 1px,
      transparent 1px
    );
}

:global(.dark-theme) .focus-mind-map-edit-button {
  background: #303641;
  color: #c4cad4;
}


/* FOCUS_MIND_MAP_PRODUCT_SYSTEM_20260920_V3 */

.focus-mind-map-preview-shell,
.focus-mind-map-editor-canvas {
  background-color: #fafaf8;
  background-image: none;
}

.focus-mind-map-fullscreen {
  grid-template-rows:
    64px 58px minmax(0, 1fr) 40px;
  background: #f4f5f6;
}

.focus-mind-map-toolbar {
  position: relative;
  z-index: 8;
  gap: 8px;
  min-width: 0;
  padding: 0 16px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 1px 0 rgba(29, 34, 43, 0.04);
}

.focus-mind-map-toolbar-spacer {
  min-width: 10px;
  flex: 1 1 auto;
}

.focus-mind-map-toolbar button {
  white-space: nowrap;
  transition:
    color 140ms ease,
    background 140ms ease,
    opacity 140ms ease;
}

.focus-mind-map-toolbar button.active {
  background: #eef1fb;
  color: #5369bb;
}

.focus-mind-map-toolbar button:disabled {
  background: transparent;
  color: #c5c9d0;
  cursor: not-allowed;
  opacity: 0.62;
}

.focus-mind-map-toolbar button.is-danger:not(:disabled):hover {
  background: #fff0f0;
  color: #c34f4f;
}

.focus-mind-map-theme-control {
  position: relative;
  flex: 0 0 auto;
}

.focus-mind-map-theme-trigger {
  min-width: 104px;
}

.focus-mind-map-theme-dot {
  width: 13px;
  height: 13px;
  flex: 0 0 auto;
  border: 2px solid rgba(255, 255, 255, 0.92);
  border-radius: 50%;
  box-shadow:
    0 0 0 1px rgba(39, 44, 53, 0.16);
}

.focus-mind-map-theme-trigger svg {
  width: 12px;
  height: 12px;
}

.focus-mind-map-theme-menu {
  position: absolute;
  z-index: 20;
  top: calc(100% + 9px);
  left: 0;
  width: 330px;
  padding: 12px;
  border: 1px solid #dde1e7;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow:
    0 18px 50px rgba(25, 31, 43, 0.15),
    0 2px 8px rgba(25, 31, 43, 0.06);
  backdrop-filter: blur(18px);
}

.focus-mind-map-theme-menu > header {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 2px 3px 10px;
}

.focus-mind-map-theme-menu > header strong {
  color: #303640;
  font-size: 13px;
}

.focus-mind-map-theme-menu > header small {
  color: #969da8;
  font-size: 10px;
}

.focus-mind-map-theme-grid {
  display: grid;
  gap: 5px;
}

.focus-mind-map-theme-option {
  display: grid !important;
  width: 100%;
  height: auto !important;
  min-height: 54px;
  grid-template-columns: 72px minmax(0, 1fr) 18px;
  align-items: center;
  justify-content: initial !important;
  gap: 10px !important;
  padding: 7px !important;
  border: 1px solid transparent !important;
  border-radius: 10px !important;
  text-align: left;
}

.focus-mind-map-theme-option:hover {
  border-color: #e0e3e9 !important;
  background: #f7f8fa !important;
}

.focus-mind-map-theme-option.active {
  border-color: #cbd3ed !important;
  background: #f1f3fb !important;
}

.focus-mind-map-theme-preview {
  display: flex;
  height: 38px;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 1px solid rgba(44, 49, 59, 0.1);
  border-radius: 8px;
}

.focus-mind-map-theme-preview i {
  width: 13px;
  height: 13px;
  border: 2px solid rgba(255, 255, 255, 0.86);
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(23, 28, 38, 0.15);
}

.focus-mind-map-theme-option > span:nth-child(2) {
  min-width: 0;
}

.focus-mind-map-theme-option strong,
.focus-mind-map-theme-option small {
  display: block;
}

.focus-mind-map-theme-option strong {
  color: #414854;
  font-size: 11px;
  font-weight: 650;
}

.focus-mind-map-theme-option small {
  overflow: hidden;
  margin-top: 2px;
  color: #969da7;
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.focus-mind-map-theme-option b {
  color: #6075c8;
  font-size: 13px;
}

.focus-mind-map-stage {
  padding: 12px;
}

.focus-mind-map-editor-canvas {
  border-color: #dfe2e5;
  border-radius: 12px;
  box-shadow:
    0 8px 32px rgba(27, 32, 40, 0.05);
}

.focus-mind-map-shortcuts {
  justify-content: space-between;
  padding: 0 18px;
}

.focus-mind-map-selection-status {
  overflow: hidden;
  color: #7e8794;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.focus-mind-map-shortcut-list {
  display: flex;
  align-items: center;
  gap: 14px;
}

/*
 * Mind Elixir 原生分支折叠控件。
 * 保留原生事件，只重新设计视觉与点击面积。
 */
.focus-mind-map-editor-canvas :deep(me-epd) {
  display: grid;
  width: 18px;
  height: 18px;
  place-items: center;
  border: 1px solid #c9ced6;
  border-radius: 50%;
  background: #ffffff;
  color: #5e6775;
  box-shadow: 0 2px 6px rgba(29, 35, 45, 0.1);
  font-size: 11px;
  font-weight: 700;
  line-height: 16px;
  transition:
    transform 140ms ease,
    border-color 140ms ease,
    box-shadow 140ms ease;
}

.focus-mind-map-editor-canvas :deep(me-epd:hover) {
  z-index: 3;
  border-color: #7183c7;
  color: #5368ba;
  box-shadow:
    0 0 0 3px rgba(91, 111, 191, 0.12),
    0 3px 8px rgba(29, 35, 45, 0.12);
  transform: scale(1.08);
}

.focus-mind-map-editor-canvas :deep(me-tpc) {
  font-family:
    Inter,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    "PingFang SC",
    "Microsoft YaHei",
    sans-serif;
  line-height: 1.45;
}

.focus-mind-map-editor-canvas :deep(me-tpc.selected) {
  box-shadow:
    0 0 0 3px rgba(93, 113, 194, 0.15);
}

.focus-mind-map-fullscreen.is-theme-night {
  background: #181c22;
  color: #e5e9f0;
}

.focus-mind-map-fullscreen.is-theme-night
  .focus-mind-map-fullscreen-header,
.focus-mind-map-fullscreen.is-theme-night
  .focus-mind-map-toolbar,
.focus-mind-map-fullscreen.is-theme-night
  .focus-mind-map-shortcuts {
  border-color: #343b46;
  background: rgba(35, 40, 49, 0.98);
}

.focus-mind-map-fullscreen.is-theme-night
  .focus-mind-map-editor-canvas {
  border-color: #363e49;
  background: #1e222a;
}

.focus-mind-map-fullscreen.is-theme-night
  .focus-mind-map-fullscreen-title strong {
  color: #edf0f5;
}

.focus-mind-map-fullscreen.is-theme-night
  .focus-mind-map-toolbar button {
  color: #c4cad5;
}

.focus-mind-map-fullscreen.is-theme-night
  .focus-mind-map-toolbar button:hover {
  background: #343b47;
  color: #ffffff;
}

.focus-mind-map-fullscreen.is-theme-night
  .focus-mind-map-toolbar button:disabled {
  color: #69717e;
}

.focus-mind-map-fullscreen.is-theme-night
  .focus-mind-map-toolbar-rule {
  background: #3a414c;
}

.focus-mind-map-fullscreen.is-theme-night
  .focus-mind-map-theme-menu {
  border-color: #414956;
  background: rgba(40, 46, 56, 0.98);
}

.focus-mind-map-fullscreen.is-theme-night
  .focus-mind-map-theme-menu strong {
  color: #e2e6ed;
}

.focus-mind-map-fullscreen.is-theme-night
  .focus-mind-map-theme-option:hover,
.focus-mind-map-fullscreen.is-theme-night
  .focus-mind-map-theme-option.active {
  border-color: #4c5666 !important;
  background: #343b47 !important;
}

@media (max-width: 1160px) {
  .focus-mind-map-toolbar {
    gap: 5px;
    padding-right: 10px;
    padding-left: 10px;
  }

  .focus-mind-map-toolbar .tool-label {
    display: none;
  }

  .focus-mind-map-theme-trigger {
    min-width: 34px;
  }

  .focus-mind-map-toolbar-rule {
    margin: 0 1px;
  }
}

@media (max-width: 760px) {
  .focus-mind-map-fullscreen {
    grid-template-rows:
      58px 52px minmax(0, 1fr);
  }

  .focus-mind-map-shortcuts {
    display: none;
  }

  .focus-mind-map-theme-menu {
    position: fixed;
    top: 118px;
    right: 10px;
    left: 10px;
    width: auto;
  }

  .focus-mind-map-tool-group[aria-label="历史操作"] {
    display: none;
  }
}

</style>
