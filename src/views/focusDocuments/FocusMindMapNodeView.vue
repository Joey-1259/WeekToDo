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
            class="focus-mind-map-global-control"
          >
            <button
              type="button"
              class="focus-mind-map-global-trigger"
              :class="{ active: skeletonMenuOpen }"
              aria-haspopup="true"
              :aria-expanded="String(skeletonMenuOpen)"
              title="选择脑图骨架"
              @click.stop="
                skeletonMenuOpen = !skeletonMenuOpen;
                themeMenuOpen = false
              "
            >
              <svg
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <rect
                  x="2.5"
                  y="7.5"
                  width="5"
                  height="5"
                  rx="1"
                />
                <rect
                  x="13"
                  y="3"
                  width="4.5"
                  height="4"
                  rx="1"
                />
                <rect
                  x="13"
                  y="13"
                  width="4.5"
                  height="4"
                  rx="1"
                />
                <path
                  d="M7.5 10h2.3V5h3.2M9.8 10v5H13"
                />
              </svg>

              <span class="tool-label">骨架</span>

              <svg
                class="focus-mind-map-trigger-chevron"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path d="m6 8 4 4 4-4" />
              </svg>
            </button>

            <section
              v-if="skeletonMenuOpen"
              class="
                focus-mind-map-global-menu
                focus-mind-map-skeleton-menu fmm-is-list
              "
              aria-label="选择思维导图骨架"
              @click.stop
            >
              <header>
                <strong>骨架</strong>
                <small>
                  控制方向、密度与连接线
                </small>
              </header>

              <!-- FMM_ENHANCE_20260923_V3：列表式骨架选择，一行一个 -->
              <div class="fmm-skl-panel" role="listbox" aria-label="骨架">
                <div class="fmm-skl-scroll">
                  <section
                    v-for="group in skeletonGroups"
                    :key="group.id"
                    class="fmm-skl-group"
                  >
                    <div class="fmm-skl-group-title">
                      {{ group.label }}
                    </div>

                    <button
                      v-for="skeleton in group.items"
                      :key="skeleton.id"
                      type="button"
                      role="option"
                      class="fmm-skl-row"
                      :class="{ active: activeSkeletonId === skeleton.id }"
                      :aria-selected="String(activeSkeletonId === skeleton.id)"
                      @click="fmmxPickSkeleton(skeleton.id)"
                    >
                      <span
                        class="fmm-skl-thumb"
                        aria-hidden="true"
                        v-html="skeleton.svg"
                      ></span>

                      <span class="fmm-skl-text">
                        <strong>{{ skeleton.label }}</strong>
                        <small>{{ skeleton.description }}</small>
                      </span>

                      <svg
                        v-if="activeSkeletonId === skeleton.id"
                        class="fmm-skl-check"
                        viewBox="0 0 20 20"
                        aria-hidden="true"
                      >
                        <path d="m5 10.5 3.2 3L15 6.5" />
                      </svg>
                    </button>
                  </section>
                </div>
              </div>
            </section>
          </div>

          <div
            class="focus-mind-map-theme-control"
          >
            <button
              type="button"
              class="
                focus-mind-map-global-trigger
                focus-mind-map-theme-trigger
              "
              :class="{ active: themeMenuOpen }"
              aria-haspopup="true"
              :aria-expanded="String(themeMenuOpen)"
              title="选择思维导图配色"
              @click.stop="
                themeMenuOpen = !themeMenuOpen;
                skeletonMenuOpen = false
              "
            >
              <span
                class="focus-mind-map-theme-dot"
                :style="{
                  background:
                    activeTheme.preview
                }"
              ></span>

              <span class="tool-label">配色</span>

              <svg
                class="focus-mind-map-trigger-chevron"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path d="m6 8 4 4 4-4" />
              </svg>
            </button>

            <section
              v-if="themeMenuOpen"
              class="
                focus-mind-map-theme-menu
                focus-mind-map-global-menu
              "
              aria-label="选择思维导图配色"
              @click.stop
            >
              <header>
                <strong>配色</strong>
                <small>
                  同步应用到预览和导出图片
                </small>
              </header>

              <div class="focus-mind-map-theme-grid">
                <button
                  v-for="theme in themeChoices"
                  :key="theme.id"
                  type="button"
                  class="focus-mind-map-theme-option"
                  :class="{
                    active:
                      activeThemeId
                      === theme.id,
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
                      :style="{
                        background: color,
                      }"
                    ></i>
                  </span>

                  <span>
                    <strong>
                      {{ theme.label }}
                    </strong>
                    <small>
                      {{ theme.description }}
                    </small>
                  </span>

                  <b
                    v-if="
                      activeThemeId
                      === theme.id
                    "
                  >
                    ✓
                  </b>
                </button>
              </div>
            </section>
          </div>

          <button
            type="button"
            class="
              focus-mind-map-global-trigger
              focus-mind-map-style-trigger
            "
            :class="{ active: inspectorVisible }"
            title="设置节点与画布样式"
            @click="
              inspectorVisible = !inspectorVisible;
              skeletonMenuOpen = false;
              themeMenuOpen = false
            "
          >
            <svg
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                d="M4 5h12M4 10h12M4 15h12"
              />
              <circle cx="7" cy="5" r="1.6" />
              <circle cx="13" cy="10" r="1.6" />
              <circle cx="9" cy="15" r="1.6" />
            </svg>

            <span class="tool-label">样式</span>
          </button>

          <!-- FMM_ADV_20260924_V5：插入 / 大纲 / 导出 -->
          <span class="focus-mind-map-toolbar-rule"></span>

          <div class="focus-mind-map-tool-group" aria-label="插入">
            <button
              type="button"
              :disabled="!selectedCount"
              title="概要：为选中的同级节点添加总结"
              @click="fmmaAddSummary"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M4 4h6M4 10h6M4 16h6M12 4c2 0 2 1.5 2 3v1.5c0 .8.6 1.5 1.5 1.5-.9 0-1.5.7-1.5 1.5V13c0 1.5 0 3-2 3" />
              </svg>
              <span class="tool-label">概要</span>
            </button>

            <button
              type="button"
              :disabled="!selectedCount"
              title="外框（Ctrl/⌘ B）"
              @click="fmmaAddBoundary"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <rect x="3" y="4" width="14" height="12" rx="3" stroke-dasharray="2.4 2" />
                <path d="M7 8.5h6M7 11.5h4" />
              </svg>
              <span class="tool-label">外框</span>
            </button>
          </div>

          <button
            type="button"
            class="focus-mind-map-global-trigger"
            :class="{ active: fmmaOutlineOpen }"
            title="查看文字大纲"
            @click="fmmaToggleOutline"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M4 5h1M8 5h8M6 10h1M10 10h6M6 15h1M10 15h6" />
            </svg>
            <span class="tool-label">大纲</span>
          </button>

          <div class="fmma-export">
            <button
              type="button"
              class="focus-mind-map-global-trigger"
              :class="{ active: fmmaExportOpen }"
              aria-haspopup="menu"
              :aria-expanded="String(fmmaExportOpen)"
              :disabled="Boolean(fmmaBusy)"
              title="导出思维导图"
              @click.stop="fmmaExportOpen = !fmmaExportOpen; skeletonMenuOpen = false; themeMenuOpen = false"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M10 3v9M6.5 8.5 10 12l3.5-3.5M4 14v2h12v-2" />
              </svg>
              <span class="tool-label">{{ fmmaBusy ? "导出中…" : "导出" }}</span>
              <svg class="focus-mind-map-trigger-chevron" viewBox="0 0 20 20" aria-hidden="true">
                <path d="m6 8 4 4 4-4" />
              </svg>
            </button>

            <div v-if="fmmaExportOpen" class="fmma-menu" role="menu" @click.stop>
              <div class="fmma-menu-title">图形</div>
              <button type="button" role="menuitem" @click="fmmaExport('png')">
                <b style="background:#5b8def">PNG</b>
                <span><strong>图片</strong><small>2 倍高清，含概要与外框</small></span>
              </button>
              <button type="button" role="menuitem" @click="fmmaExport('pdf')">
                <b style="background:#d9534f">PDF</b>
                <span><strong>PDF 文档</strong><small>打印对话框中选择「存储为 PDF」</small></span>
              </button>
              <hr />
              <div class="fmma-menu-title">文字大纲</div>
              <button type="button" role="menuitem" @click="fmmaExport('md')">
                <b style="background:#3f3f46">MD</b>
                <span><strong>Markdown</strong><small>层级列表，可粘贴到文档</small></span>
              </button>
              <button type="button" role="menuitem" @click="fmmaExport('txt')">
                <b style="background:#7b8494">TXT</b>
                <span><strong>纯文本</strong><small>Tab 缩进，兼容性最好</small></span>
              </button>
              <button type="button" role="menuitem" @click="fmmaCopyOutline('md')">
                <b style="background:#4f7d68">⧉</b>
                <span><strong>复制大纲</strong><small>Markdown 格式到剪贴板</small></span>
              </button>
            </div>
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

        <main
          class="focus-mind-map-stage"
          :class="{
            'has-inspector': inspectorVisible,
          }"
        >
          <div
            ref="editorCanvas"
            class="focus-mind-map-editor-canvas"
          ></div>

          <!-- FMM_ADV_20260924_V5：文字大纲抽屉 -->
          <aside v-if="fmmaOutlineOpen" class="fmma-outline" aria-label="文字大纲">
            <header>
              <div>
                <strong>大纲</strong>
                <small>{{ fmmaOutlineCount }} 个主题 · 点击定位节点</small>
              </div>
              <div class="fmma-seg">
                <button type="button" :class="{ active: fmmaFormat === 'md' }" @click="fmmaFormat = 'md'">Markdown</button>
                <button type="button" :class="{ active: fmmaFormat === 'txt' }" @click="fmmaFormat = 'txt'">纯文本</button>
              </div>
              <button type="button" class="fmma-x" aria-label="关闭大纲" @click="fmmaOutlineOpen = false">×</button>
            </header>
            <ol class="fmma-rows">
              <li
                v-for="row in fmmaOutlineRows"
                :key="row.key"
                :class="'is-' + row.kind"
                :style="{ '--d': row.depth }"
                @click="fmmaSelectRow(row.id)"
              >
                <i class="fmma-bullet"></i>
                <span>{{ row.kind === 'summary' ? '概要：' + row.text : row.text }}</span>
                <em v-if="row.boundary">{{ row.boundary }}</em>
              </li>
            </ol>
            <footer>
              <button type="button" class="fmma-primary" @click="fmmaCopyOutline()">
                {{ fmmaCopied ? "已复制 ✓" : "复制大纲" }}
              </button>
              <button type="button" @click="fmmaExport(fmmaFormat)">导出文件</button>
            </footer>
          </aside>

          <div v-if="fmmaToast" class="fmma-toast" role="status">{{ fmmaToast }}</div>

          <FocusMindMapInspector
            v-if="inspectorVisible"
            :selection-count="selectedCount"
            :node-style="selectedNodeStyle"
            :branch-color="selectedBranchColor"
            :themes="themeChoices"
            :active-theme-id="activeThemeId"
            :skeletons="skeletonChoices"
            :active-skeleton-id="activeSkeletonId"
            :compact="mapCompact"
            @close="inspectorVisible = false"
            @update-style="fmmxApplyStyle"
            @toggle-format="toggleNodeFormat"
            @change-branch-color="applyBranchColor"
            @quick-style="fmmxToggleQuickStyle"
            @reset-style="fmmxResetStyle"
            @change-theme="applyTheme"
            @change-skeleton="applyStableSkeleton"
            @toggle-compact="toggleCompactMode"
          />
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
import FocusMindMapInspector from "./FocusMindMapInspector.vue";
import {
  focusMindMapEnhancerMixin,
  createBranchGenerators,
  skeletonThumb,
} from "./focusMindMapEnhancer.js";

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


/* PATCH_20260923_V2: 骨架缩略图（64×40 坐标系，线条随卡片状态着色） */
const skRoot = (x, y, w = 14, h = 8) =>
  `<rect class="sk-root" x="${x}" y="${y}" width="${w}" height="${h}" rx="2"/>`;
const skLeaf = (x, y, w, h = 5) =>
  `<rect class="sk-leaf" x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5"/>`;
const skPath = (d) => `<path class="sk-line" d="${d}"/>`;

function skeletonSvg(kind, compact = false) {
  const [side, style] = kind.split("-");
  let body = "";

  if (side === "right" || side === "left") {
    const ys = compact ? [13, 20, 27] : [8, 20, 32];
    let d;
    if (style === "bracket") {
      d = `M18 20 H28 M28 ${ys[0]} V${ys[2]} ` +
        ys.map((y) => `M28 ${y} H40`).join(" ");
    } else if (style === "curve") {
      d = ys.map((y) => `M18 20 C29 20 29 ${y} 40 ${y}`).join(" ");
    } else {
      d = ys.map((y) => `M18 20 L40 ${y}`).join(" ");
    }
    body = skPath(d) + skRoot(4, 16) +
      ys.map((y) => skLeaf(40, y - 2.5, 18)).join("");
    if (side === "left") {
      body = `<g transform="matrix(-1 0 0 1 64 0)">${body}</g>`;
    }
  } else if (side === "side") {
    const ys = compact ? [15, 25] : [10, 30];
    let d;
    if (style === "bracket") {
      d = `M39 20 H43.5 M43.5 ${ys[0]} V${ys[1]} ` +
        `M25 20 H20.5 M20.5 ${ys[0]} V${ys[1]} ` +
        ys.map((y) => `M43.5 ${y} H48 M20.5 ${y} H16`).join(" ");
    } else {
      d = ys.map((y) =>
        `M39 20 C44 20 44 ${y} 48 ${y} M25 20 C20 20 20 ${y} 16 ${y}`
      ).join(" ");
    }
    body = skPath(d) + skRoot(25, 16) +
      ys.map((y) => skLeaf(48, y - 2.5, 13) + skLeaf(3, y - 2.5, 13)).join("");
  } else {
    const xs = compact ? [18, 32, 46] : [10, 32, 54];
    let d;
    if (style === "bracket") {
      d = `M32 12 V19 M${xs[0]} 19 H${xs[2]} ` +
        xs.map((x) => `M${x} 19 V27`).join(" ");
    } else {
      d = xs.map((x) => {
        if (x === 32) return "M32 12 V27";
        const dir = x > 32 ? 1 : -1;
        return `M32 12 V16 Q32 19.5 ${32 + dir * 3.5} 19.5 ` +
          `H${x - dir * 3.5} Q${x} 19.5 ${x} 23 V27`;
      }).join(" ");
    }
    body = skPath(d) + skRoot(25, 4) +
      xs.map((x) => skLeaf(x - 6, 27, 12, 6)).join("");
  }

  return `<svg viewBox="0 0 64 40" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
}

const SKELETON_GROUPS = Object.freeze([
  { id: "logic", label: "逻辑图" },
  { id: "mind", label: "思维导图" },
  { id: "org", label: "组织结构图" },
]);

const sk = (group, id, label, description, direction, lineStyle, kind, compact = false) => ({
  group, id, label, description, direction, lineStyle, compact,
  preview: kind,
  svg: skeletonThumb(kind, compact),
});

const MIND_MAP_SKELETONS = Object.freeze([
  sk("logic", "right-logic", "右向逻辑图", "从左到右展开，括号式折线，连线对齐节点中心", MindElixir.RIGHT, "bracket", "right-bracket"),
  sk("logic", "right-compact", "紧凑逻辑图", "右向括号结构，行距更紧凑", MindElixir.RIGHT, "bracket", "right-bracket", true),
  sk("logic", "right-curve", "右向曲线图", "柔和曲线，适合头脑风暴", MindElixir.RIGHT, "rounded", "right-curve"),
  sk("logic", "right-tree", "右向直线图", "父节点以直线放射连接子节点", MindElixir.RIGHT, "straight", "right-straight"),
  sk("logic", "left-logic", "左向逻辑图", "从右到左展开，适合倒推目标", MindElixir.LEFT, "bracket", "left-bracket"),
  sk("logic", "left-curve", "左向曲线图", "向左发散的柔和曲线", MindElixir.LEFT, "rounded", "left-curve"),
  sk("mind", "balanced-map", "双向思维图", "围绕中心主题向左右发散", MindElixir.SIDE, "rounded", "side-curve"),
  sk("mind", "balanced-bracket", "双向直角图", "左右对称的括号式折线", MindElixir.SIDE, "bracket", "side-bracket"),
  sk("mind", "balanced-compact", "紧凑双向图", "双向发散，适合大型脑图", MindElixir.SIDE, "rounded", "side-curve", true),
  sk("org", "org-down", "向下组织图", "自上而下，直角连线（组织架构）", MindElixir.DOWN, "bracket", "down-bracket"),
  sk("org", "org-down-rounded", "圆角组织图", "自上而下，圆角折线更柔和", MindElixir.DOWN, "rounded", "down-rounded"),
  sk("org", "org-down-compact", "紧凑组织图", "向下直角结构，节点更密集", MindElixir.DOWN, "bracket", "down-bracket", true),
]);

function getSkeleton(id) {
  return (
    MIND_MAP_SKELETONS.find(
      (item) => item.id === id
    )
    || MIND_MAP_SKELETONS[0]
  );
}

function resolveSkeletonId(data) {
  const id =
    data?.meta?.skeletonId;

  return getSkeleton(id).id;
}

/*
 * Mind Elixir 的主分支与子分支不是同一套坐标模型。
 *
 * 主分支：
 *   根节点中心边缘 -> 一级节点中心边缘
 *
 * 子分支：
 *   父节点底部支线 -> 子节点底部支线
 *
 * 不能复用同一个 center-to-center 生成器，否则新增节点、
 * 字号变化或紧凑模式重排后会出现路径悬空和末端错位。
 */
/* PATCH_20260923_V2
 * 与 mind-elixir 5.15.1 utils/generateBranch.ts 同一坐标模型：
 * - 主分支：cL/cT 为一级节点 tpc 本身
 * - 子分支：pL/cL 为 me-parent（左右各含 --node-gap-x 内边距）
 *   → 父文字右缘 = pL + pW - GAP；子文字左缘 = cL + GAP；中缝 = cL
 */
function readGapX(mind) {
  const value = parseInt(
    mind?.container?.style?.getPropertyValue("--node-gap-x"),
    10
  );
  return Number.isFinite(value) ? value : 30;
}

function generateHorizontalMainBracket({ pT, pL, pW, pH, cT, cL, cW, cH, direction }) {
  const left = direction === "lhs";
  const x1 = left ? pL : pL + pW;
  const x2 = left ? cL + cW : cL;
  const y1 = pT + pH / 2;
  const y2 = cT + cH / 2;
  const reach = Math.max(12, Math.min(40, Math.abs(x2 - x1) * 0.45));
  const elbow = left ? x1 - reach : x1 + reach;

  if (Math.abs(y2 - y1) < 0.5) return `M ${x1} ${y1} H ${x2}`;
  return `M ${x1} ${y1} H ${elbow} V ${y2} H ${x2}`;
}

function generateHorizontalSubBracket({ pT, pL, pW, pH, cT, cL, cW, cH, direction, isFirst }) {
  const GAP = readGapX(this);
  const y1 = isFirst ? pT + pH / 2 : pT + pH;
  const y2 = cT + cH;

  if (direction === "lhs") {
    return `M ${pL + GAP} ${y1} H ${cL + cW} V ${y2} H ${cL + GAP}`;
  }
  return `M ${pL + pW - GAP} ${y1} H ${cL} V ${y2} H ${cL + cW - GAP}`;
}

function generateHorizontalMainStraight({ pT, pL, pW, pH, cT, cL, cW, cH, direction }) {
  const left = direction === "lhs";
  const x1 = left ? pL : pL + pW;
  const x2 = left ? cL + cW : cL;
  return `M ${x1} ${pT + pH / 2} L ${x2} ${cT + cH / 2}`;
}

function generateHorizontalSubStraight({ pT, pL, pW, pH, cT, cL, cW, cH, direction, isFirst }) {
  const GAP = readGapX(this);
  const y1 = isFirst ? pT + pH / 2 : pT + pH;
  const y2 = cT + cH;

  if (direction === "lhs") {
    return `M ${pL + GAP} ${y1} L ${cL + cW - GAP} ${y2} H ${cL + GAP}`;
  }
  return `M ${pL + pW - GAP} ${y1} L ${cL + GAP} ${y2} H ${cL + cW - GAP}`;
}

function generateVerticalBracket({ pT, pL, pW, pH, cT, cL, cW }) {
  const x1 = pL + pW / 2;
  const y1 = pT + pH;
  const x2 = cL + cW / 2;
  const y2 = cT;

  if (Math.abs(x2 - x1) < 0.5) return `M ${x1} ${y1} V ${y2}`;
  const mid = (y1 + y2) / 2;
  return `M ${x1} ${y1} V ${mid} H ${x2} V ${y2}`;
}

const generateVerticalMainBracket = generateVerticalBracket;
const generateVerticalSubBracket = generateVerticalBracket;

/* 所有骨架均返回自定义生成器，不再回落到引擎默认连线 */
function getBranchGenerators(skeletonId) {
  /* FMM_ENHANCE_20260923_V3：XMind 式中心对齐连线，覆盖全部骨架 */
  const skeleton = getSkeleton(skeletonId);
  return createBranchGenerators(skeleton, MindElixir) || {};
}

/*
 * 关键修复：mind-elixir 的 init() → changeTheme() 会执行
 *   this.generateMainBranch = theme.generateMainBranch || main
 * 构造参数里的生成器会被默认曲线覆盖（右向逻辑图显示为曲线的根因）。
 * 这里接管实例的 changeTheme，把骨架生成器写进 theme，
 * 初始化、切换配色、切换紧凑都不会再丢失。
 */
function bindSkeletonBranches(mind, skeletonId) {
  const generators = getBranchGenerators(skeletonId);
  const baseChangeTheme = mind.changeTheme;

  mind.changeTheme = function (theme, shouldRefresh = true) {
    const nextTheme = { ...(theme || {}) };
    delete nextTheme.generateMainBranch;
    delete nextTheme.generateSubBranch;
    Object.assign(nextTheme, generators);
    return baseChangeTheme.call(this, nextTheme, shouldRefresh);
  };

  Object.assign(mind, generators);
  return mind;
}

/*
 * 切换骨架前必须清理节点上遗留的方向信息。
 *
 * 例如：
 * - 原骨架为 SIDE；
 * - 一级节点分别保存 lhs/rhs；
 * - 只修改根数据 direction 为 RIGHT；
 * - 新节点使用 RIGHT，旧节点仍保持 lhs/rhs。
 *
 * 最终就会形成两套布局来源。
 */
function canonicalizeSkeletonData(
  value,
  skeleton
) {
  const data = clone(value);

  const walk = (node) => {
    if (!node || typeof node !== "object") {
      return;
    }

    delete node.parent;
    delete node.direction;

    if (Array.isArray(node.children)) {
      node.children.forEach(walk);
    }
  };

  walk(data?.nodeData);

  const mainChildren =
    data?.nodeData?.children;

  if (Array.isArray(mainChildren)) {
    if (
      skeleton.direction
      === MindElixir.SIDE
    ) {
      mainChildren.forEach(
        (node, index) => {
          node.direction =
            index % 2 === 0
              ? MindElixir.RIGHT
              : MindElixir.LEFT;
        }
      );
    } else if (
      skeleton.direction
      === MindElixir.RIGHT
    ) {
      mainChildren.forEach((node) => {
        node.direction =
          MindElixir.RIGHT;
      });
    } else if (
      skeleton.direction
      === MindElixir.LEFT
    ) {
      mainChildren.forEach((node) => {
        node.direction =
          MindElixir.LEFT;
      });
    }
  }

  data.direction = skeleton.direction;
  data.compact = Boolean(skeleton.compact);
  data.meta = { ...(data.meta || {}), compact: data.compact };

  return data;
}

function normalizeStylePatch(
  current,
  patch
) {
  const next = {
    ...(current || {}),
  };

  Object.entries(
    patch || {}
  ).forEach(([key, value]) => {
    if (
      value === null
      || value === undefined
      || value === ""
    ) {
      delete next[key];
    } else {
      next[key] = value;
    }
  });

  return next;
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
    direction: MindElixir.RIGHT,
    compact: false,
    meta: {
      skeletonId: "right-logic",
      themeId: "minimal",
      compact: false,
    },
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
    : MindElixir.RIGHT;

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
  mixins: [focusMindMapEnhancerMixin],
  name: "FocusMindMapNodeView",

  components: {
    NodeViewWrapper,
    FocusMindMapInspector,
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
      skeletonMenuOpen: false,
      skeletonHoverId: "",
      selectedCount: 0,
      selectedIsRoot: false,
      selectedHasChildren: false,
      selectedExpanded: true,
      actionMessage: "",
      inspectorVisible: false,
      activeSkeletonId:
        resolveSkeletonId(
          this.node.attrs.data
        ),
      mapCompact: Boolean(
        getSkeleton(
          resolveSkeletonId(this.node.attrs.data)
        ).compact
      ),
      selectedNodeStyle: {},
      selectedBranchColor: "",
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

    skeletonChoices() {
      return MIND_MAP_SKELETONS;
    },

    skeletonGroups() {
      return SKELETON_GROUPS.map((group) => ({
        ...group,
        items: MIND_MAP_SKELETONS.filter(
          (item) => item.group === group.id
        ),
      }));
    },

    skeletonHint() {
      const item = getSkeleton(
        this.skeletonHoverId || this.activeSkeletonId
      );
      return item ? `${item.label} · ${item.description}` : "";
    },

    activeSkeleton() {
      return getSkeleton(
        this.activeSkeletonId
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
    async applyStableSkeleton(
      skeletonId
    ) {
      const nextSkeleton =
        getSkeleton(skeletonId);

      this.mapCompact = Boolean(nextSkeleton?.compact);

      if (
        !nextSkeleton
        || this.closing
      ) {
        return;
      }

      this.skeletonMenuOpen = false;
      this.themeMenuOpen = false;
      this.skeletonMenuOpen = false;

      /*
       * 必须先从旧实例读取数据，再切换 activeSkeletonId。
       * 否则 currentData 会把新方向写入仍包含旧节点方向的数据。
       */
      const rawData =
        this.currentData();

      this.activeSkeletonId =
        nextSkeleton.id;

      this.mapCompact =
        Boolean(nextSkeleton.compact);

      let nextData =
        canonicalizeSkeletonData(
          rawData,
          nextSkeleton
        );

      nextData.meta = {
        ...(nextData.meta || {}),
        themeId: this.activeThemeId,
        skeletonId: nextSkeleton.id,
        compact: this.mapCompact,
      };

      nextData.theme =
        getTheme(this.activeThemeId);

      nextData.direction =
        nextSkeleton.direction;

      nextData.compact =
        this.mapCompact;

      try {
        this.saveState = "saving";

        /*
         * 先写入 Tiptap，确保即使实例重建失败，
         * 数据层仍然保留完整节点内容。
         */
        this.updateAttributes({
          data: clone(nextData),
          nodeCount:
            walkNodeCount(
              nextData.nodeData
            ),
          updatedAt:
            new Date().toISOString(),
        });

        this.destroyEditor();

        await this.$nextTick();
        await nextAnimationFrame();

        const element =
          this.$refs.editorCanvas;

        await waitForUsableCanvas(
          element,
          "思维导图编辑画布"
        );

        const nextMind =
          this.createMind(
            element,
            true
          );

        this.editingMind = nextMind;

        await Promise.resolve(
          nextMind.init(
            clone(nextData)
          )
        );

        /*
         * 重建实例后重新绑定必要事件。
         * 不依赖旧实例上的 bus listener。
         */
        const refreshSelection = () => {
          const candidates = [
            "syncSelectionState",
            "syncSelection",
            "refreshSelectionState",
          ];

          for (const name of candidates) {
            if (
              typeof this[name]
              === "function"
            ) {
              this[name]();
              break;
            }
          }
        };

        nextMind.bus?.addListener?.(
          "operation",
          () => {
            refreshSelection();
            this.queueSave();
          }
        );

        nextMind.bus?.addListener?.(
          "selectNode",
          refreshSelection
        );

        nextMind.bus?.addListener?.(
          "unselectNode",
          refreshSelection
        );

        nextMind.bus?.addListener?.(
          "expandNode",
          () => {
            refreshSelection();
            this.queueSave();
          }
        );

        this.scale = 1;

        await fitMindMap(nextMind);

        refreshSelection();

        this.saveState = "saved";
        this.queueSave();
        this.queueSnapshot();

        this.actionMessage =
          `已切换为${nextSkeleton.label}`;
      } catch (error) {
        console.error(
          "[FocusMindMap] 骨架切换失败",
          error
        );

        this.saveState = "error";
        this.errorMessage =
          "骨架切换失败，已保留脑图数据";

        /*
         * 数据已经写入 Tiptap。
         * 尝试按当前状态重新打开编辑实例。
         */
        try {
          await this.$nextTick();

          const element =
            this.$refs.editorCanvas;

          if (
            element
            && !this.editingMind
          ) {
            await waitForUsableCanvas(
              element,
              "思维导图恢复画布"
            );

            this.editingMind =
              this.createMind(
                element,
                true
              );

            await Promise.resolve(
              this.editingMind.init(
                clone(nextData)
              )
            );

            await fitMindMap(
              this.editingMind
            );
          }
        } catch (restoreError) {
          console.error(
            "[FocusMindMap] 骨架切换恢复失败",
            restoreError
          );
        }
      }
    },

    currentData() {
      const raw =
        this.editingMind?.getData?.()
        || this.node.attrs.data
        || fallbackData(this.mapTitle);

      const data = clone(raw);

      const skeleton =
        getSkeleton(
          this.activeSkeletonId
        );

      data.meta = {
        ...(data.meta || {}),
        themeId: this.activeThemeId,
        skeletonId:
          this.activeSkeletonId,
        compact: this.mapCompact,
      };

      data.theme = getTheme(
        this.activeThemeId
      );
      data.direction =
        skeleton.direction;
      data.compact =
        this.mapCompact;

      return data;
    },

    prepareData(value, title) {
      const data =
        normalizeMindMapData(
          value,
          title
        );

      const skeleton =
        getSkeleton(
          this.activeSkeletonId
        );

      data.meta = {
        ...(data.meta || {}),
        themeId: this.activeThemeId,
        skeletonId:
          this.activeSkeletonId,
        compact: this.mapCompact,
      };

      data.theme = getTheme(
        this.activeThemeId
      );
      data.direction =
        skeleton.direction;
      data.compact =
        this.mapCompact;

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

      const skeleton =
        getSkeleton(
          this.activeSkeletonId
        );

      const branchGenerators =
        getBranchGenerators(
          this.activeSkeletonId
        );

      const mindInstance = new MindElixir({
        el: element,
        direction:
          skeleton.direction,
        editable,
        theme: getTheme(
          this.activeThemeId
        ),
        /*
         * rounded 骨架返回空对象，使用 Mind Elixir 原生生成器；
         * bracket 骨架才注入匹配其坐标模型的主/子分支生成器。
         */
        ...branchGenerators,

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
        compact:
          this.mapCompact,
        overflowHidden: false,
        handleWheel: true,
        newTopicName: "新主题",
        scaleMin: 0.35,
        scaleMax: 2.2,
        scaleSensitivity: 0.08,
      });

      /* PATCH_20260923_V2 */
      return bindSkeletonBranches(mindInstance, skeleton.id);
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
      this.selectedNodeStyle = {};
      this.selectedBranchColor = "";
      this.inspectorVisible = false;

      if (this.$refs.editorCanvas) {
        this.$refs.editorCanvas
          .replaceChildren();
      }
    },

    async applySkeleton(
      skeletonId
    ) {
      const skeleton =
        getSkeleton(skeletonId);

      if (
        skeleton.id
        === this.activeSkeletonId
      ) {
        return;
      }

      try {
        const data =
          this.currentData();

        this.activeSkeletonId =
          skeleton.id;

        if (
          skeleton.id
          === "right-compact"
        ) {
          this.mapCompact = true;
        }

        data.meta = {
          ...(data.meta || {}),
          skeletonId:
            skeleton.id,
          compact:
            this.mapCompact,
        };

        data.direction =
          skeleton.direction;
        data.compact =
          this.mapCompact;

        const generators =
          getBranchGenerators(
            skeleton.id
          );

        this.editingMind.direction =
          skeleton.direction;
        this.editingMind.compact =
          this.mapCompact;
        this.editingMind
          .generateMainBranch =
            generators
              .generateMainBranch;
        this.editingMind
          .generateSubBranch =
            generators
              .generateSubBranch;

        this.editingMind.refresh(
          data
        );

        this.editingMind
          .clearHistory?.();

        this.saveState = "saving";
        this.queueSave();

        await fitMindMap(
          this.editingMind
        );

        this.scale =
          Number(
            this.editingMind.scaleVal
          )
          || 1;

        this.syncSelectionState();
      } catch (error) {
        console.error(
          "[mind-map] 骨架切换失败",
          error
        );

        this.saveState = "error";

        window.alert(
          error?.message
          || "切换思维导图骨架失败。"
        );
      }
    },

    toggleCompactMode() {
      if (!this.editingMind) return;

      this.mapCompact =
        !this.mapCompact;

      this.editingMind
        .changeCompact?.(
          this.mapCompact
        );

      this.saveState = "saving";
      this.queueSave();

      window.setTimeout(
        () => {
          this.fitAndCenterMap();
        },
        80
      );
    },

    async patchSelectedNodes(
      createPatch
    ) {
      const selected =
        this.selectedTopics();

      if (!selected.length) return;

      try {
        await Promise.all(
          selected.map((topic) => {
            const patch =
              createPatch(topic);

            return this.editingMind
              .reshapeNode(
                topic,
                patch
              );
          })
        );

        this.saveState = "saving";

        await this.$nextTick();
        this.syncSelectionState();
        this.queueSave();
      } catch (error) {
        console.error(
          "[mind-map] 节点格式更新失败",
          error
        );

        this.saveState = "error";

        window.alert(
          error?.message
          || "更新节点格式失败。"
        );
      }
    },

    applyNodeStyle(patch) {
      this.patchSelectedNodes(
        (topic) => ({
          style:
            normalizeStylePatch(
              topic.nodeObj?.style,
              patch
            ),
        })
      );
    },

    applyBranchColor(color) {
      this.patchSelectedNodes(
        () => ({
          branchColor:
            color || undefined,
        })
      );
    },

    toggleNodeFormat(type) {
      const current =
        this.selectedNodeStyle || {};

      if (type === "bold") {
        const bold =
          String(
            current.fontWeight
          ) === "700";

        this.applyNodeStyle({
          fontWeight:
            bold ? null : "700",
        });

        return;
      }

      const tokens =
        new Set(
          String(
            current.textDecoration
            || ""
          )
            .split(/\s+/)
            .filter(Boolean)
        );

      if (tokens.has(type)) {
        tokens.delete(type);
      } else {
        tokens.add(type);
      }

      this.applyNodeStyle({
        textDecoration:
          [...tokens].join(" ")
          || null,
      });
    },

    applyQuickStyle(type) {
      const presets = {
        important: {
          style: {
            fontWeight: "700",
            color: "#a33f3f",
            background: "#fbecec",
            border:
              "1px solid #e8bcbc",
          },
          branchColor: "#c55252",
        },

        idea: {
          style: {
            fontWeight: "700",
            color: "#72561f",
            background: "#fbf2d9",
            border:
              "1px solid #e8d397",
          },
          branchColor: "#b88a32",
        },

        done: {
          style: {
            color: "#718078",
            background: "#eef4f0",
            border:
              "1px solid #cbdccf",
            textDecoration:
              "line-through",
          },
          branchColor: "#789584",
        },
      };

      const preset = presets[type];

      if (!preset) return;

      this.patchSelectedNodes(
        (topic) => ({
          style:
            normalizeStylePatch(
              topic.nodeObj?.style,
              preset.style
            ),
          branchColor:
            preset.branchColor,
        })
      );
    },

    resetNodeStyle() {
      this.patchSelectedNodes(
        () => ({
          style: {},
          branchColor: undefined,
        })
      );
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

      this.selectedNodeStyle = {
        ...(first?.style || {}),
      };

      this.selectedBranchColor =
        first?.branchColor || "";
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

/* ==========================================================
 * 2026-09-20 · 最短路径工具栏
 * ========================================================== */

.focus-mind-map-global-control,
.focus-mind-map-theme-control {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.focus-mind-map-global-trigger {
  min-width: 64px;
  height: 32px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: #555a64;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  transition:
    color 150ms ease,
    background 150ms ease,
    border-color 150ms ease,
    box-shadow 150ms ease;
}

.focus-mind-map-global-trigger:hover {
  color: #30343b;
  background: #f2f3f6;
}

.focus-mind-map-global-trigger.active {
  color: #5064bd;
  background: #edf0fb;
  border-color: #dce2f8;
}

.focus-mind-map-global-trigger > svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.45;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.focus-mind-map-global-trigger
  .focus-mind-map-trigger-chevron {
  width: 12px;
  height: 12px;
  margin-left: -2px;
  opacity: 0.58;
}

.focus-mind-map-style-trigger {
  margin-left: 2px;
}

.focus-mind-map-global-menu {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 30;
  width: 310px;
  max-height: min(540px, calc(100vh - 150px));
  overflow: auto;
  padding: 10px;
  border: 1px solid #e1e3e8;
  border-radius: 11px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow:
    0 16px 42px rgba(36, 40, 51, 0.13),
    0 2px 8px rgba(36, 40, 51, 0.06);
  backdrop-filter: blur(16px);
}

.focus-mind-map-global-menu > header {
  padding: 3px 4px 10px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.focus-mind-map-global-menu > header strong {
  color: #252830;
  font-size: 13px;
  font-weight: 650;
}

.focus-mind-map-global-menu > header small {
  color: #8a8f99;
  font-size: 11px;
}

.focus-mind-map-skeleton-options {
  display: grid;
  gap: 5px;
}

.focus-mind-map-skeleton-option {
  width: 100%;
  min-height: 62px;
  padding: 7px 9px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: #353942;
  display: grid;
  grid-template-columns: 72px 1fr 18px;
  align-items: center;
  gap: 9px;
  text-align: left;
  cursor: pointer;
}

.focus-mind-map-skeleton-option:hover {
  background: #f5f6f8;
}

.focus-mind-map-skeleton-option.active {
  border-color: #d8def5;
  background: #f0f2fb;
}

.focus-mind-map-skeleton-option > span:nth-child(2) {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.focus-mind-map-skeleton-option strong {
  font-size: 12px;
  font-weight: 620;
}

.focus-mind-map-skeleton-option small {
  color: #8a8f99;
  font-size: 10px;
  line-height: 1.35;
}

.focus-mind-map-skeleton-option > b {
  color: #586ec7;
  font-size: 12px;
  text-align: center;
}

.focus-mind-map-skeleton-miniature {
  position: relative;
  width: 70px;
  height: 42px;
  border: 1px solid #e2e3e6;
  border-radius: 6px;
  background: #fbfbfa;
  overflow: hidden;
}

.focus-mind-map-skeleton-miniature i {
  position: absolute;
  display: block;
  box-sizing: border-box;
}

.focus-mind-map-skeleton-miniature .root {
  left: 7px;
  top: 16px;
  width: 18px;
  height: 11px;
  border: 1px solid #676b72;
  border-radius: 2px;
  background: #fff;
}

.focus-mind-map-skeleton-miniature .trunk {
  left: 25px;
  top: 11px;
  width: 12px;
  height: 21px;
  border-top: 1px solid #777b82;
  border-right: 1px solid #777b82;
  border-bottom: 1px solid #777b82;
}

.focus-mind-map-skeleton-miniature .branch {
  left: 37px;
  width: 12px;
  height: 1px;
  background: #777b82;
}

.focus-mind-map-skeleton-miniature .branch::after {
  content: "";
  position: absolute;
  left: 11px;
  top: -4px;
  width: 13px;
  height: 9px;
  border: 1px solid #989ca3;
  border-radius: 2px;
  background: #fff;
}

.focus-mind-map-skeleton-miniature .branch.one {
  top: 11px;
}

.focus-mind-map-skeleton-miniature .branch.two {
  top: 21px;
}

.focus-mind-map-skeleton-miniature .branch.three {
  top: 32px;
}

.focus-mind-map-skeleton-miniature.is-balanced
  .root {
  left: 26px;
}

.focus-mind-map-skeleton-miniature.is-balanced
  .trunk {
  left: 18px;
  width: 34px;
  border-left: 1px solid #777b82;
}

.focus-mind-map-skeleton-miniature.is-down
  .root {
  left: 26px;
  top: 5px;
}

.focus-mind-map-skeleton-miniature.is-down
  .trunk {
  left: 34px;
  top: 16px;
  width: 1px;
  height: 11px;
  border: 0;
  background: #777b82;
}

.focus-mind-map-skeleton-miniature.is-down
  .branch {
  top: 27px;
  left: 15px;
  width: 39px;
}

.focus-mind-map-skeleton-miniature.is-down
  .branch::after {
  top: 0;
  left: auto;
  width: 11px;
  height: 8px;
}

.focus-mind-map-skeleton-miniature.is-down
  .branch.one::after {
  left: -5px;
}

.focus-mind-map-skeleton-miniature.is-down
  .branch.two::after {
  left: 14px;
}

.focus-mind-map-skeleton-miniature.is-down
  .branch.three::after {
  right: -5px;
}

.focus-mind-map-theme-dot {
  width: 11px;
  height: 11px;
  flex: 0 0 auto;
  border-radius: 50%;
  box-shadow:
    inset 0 0 0 1px rgba(0, 0, 0, 0.08);
}

.focus-mind-map-fullscreen.is-theme-night
  .focus-mind-map-global-trigger {
  color: #c5cad5;
}

.focus-mind-map-fullscreen.is-theme-night
  .focus-mind-map-global-trigger:hover {
  color: #f2f4f8;
  background: #303640;
}

.focus-mind-map-fullscreen.is-theme-night
  .focus-mind-map-global-trigger.active {
  color: #aebcff;
  border-color: #46527a;
  background: #303a58;
}

.focus-mind-map-fullscreen.is-theme-night
  .focus-mind-map-global-menu {
  border-color: #414955;
  background: rgba(39, 44, 53, 0.98);
  box-shadow:
    0 18px 46px rgba(0, 0, 0, 0.34);
}

.focus-mind-map-fullscreen.is-theme-night
  .focus-mind-map-global-menu
  > header
  strong,
.focus-mind-map-fullscreen.is-theme-night
  .focus-mind-map-skeleton-option {
  color: #e3e6ed;
}

.focus-mind-map-fullscreen.is-theme-night
  .focus-mind-map-global-menu
  > header
  small,
.focus-mind-map-fullscreen.is-theme-night
  .focus-mind-map-skeleton-option
  small {
  color: #979eaa;
}

.focus-mind-map-fullscreen.is-theme-night
  .focus-mind-map-skeleton-option:hover {
  background: #303640;
}

.focus-mind-map-fullscreen.is-theme-night
  .focus-mind-map-skeleton-option.active {
  border-color: #46527a;
  background: #303a58;
}

@media (max-width: 900px) {
  .focus-mind-map-global-trigger {
    min-width: 34px;
    padding: 0 8px;
  }

  .focus-mind-map-global-trigger
    .tool-label,
  .focus-mind-map-global-trigger
    .focus-mind-map-trigger-chevron {
    display: none;
  }

  .focus-mind-map-global-menu {
    width: min(310px, calc(100vw - 24px));
  }
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



/* FOCUS_MIND_MAP_SKELETON_AND_FORMAT_V4 */

.focus-mind-map-stage {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
  transition:
    grid-template-columns 180ms ease;
}

.focus-mind-map-stage.has-inspector {
  grid-template-columns:
    minmax(0, 1fr) 296px;
}

.focus-mind-map-format-trigger {
  flex: 0 0 auto;
}

.focus-mind-map-editor-canvas :deep(svg path) {
  stroke-linecap: square;
  stroke-linejoin: miter;
}

.focus-mind-map-editor-canvas :deep(me-tpc) {
  min-height: 20px;
}

.focus-mind-map-editor-canvas
  :deep(me-root > me-tpc) {
  padding: 8px 13px;
}

.focus-mind-map-preview-canvas :deep(svg path) {
  stroke-linecap: square;
  stroke-linejoin: miter;
}

@media (max-width: 820px) {
  .focus-mind-map-stage.has-inspector {
    grid-template-columns:
      minmax(0, 1fr);
  }
}

</style>

<style>
/* PATCH_20260923_V1: 骨架缩略图与菜单 */
.focus-mind-map-skeleton-miniature.is-svg {
  position: relative;
  display: block;
  width: 64px;
  height: 40px;
  flex: 0 0 64px;
  overflow: hidden;
  border: 1px solid #e0e3e8;
  border-radius: 7px;
  background: #fbfbfa;
}

.focus-mind-map-skeleton-miniature.is-svg svg {
  display: block;
  width: 100%;
  height: 100%;
}

.focus-mind-map-skeleton-option.active .focus-mind-map-skeleton-miniature.is-svg {
  border-color: #b9c4ec;
  background: #f5f7fe;
}

.focus-mind-map-skeleton-options {
  max-height: min(62vh, 560px);
  overflow-y: auto;
  overscroll-behavior: contain;
}
</style>

<style>
/* PATCH_20260923_V2: 骨架结构选择器 */
.focus-mind-map-fullscreen .focus-mind-map-global-control > .focus-mind-map-skeleton-menu {
  width: 356px !important;
  max-width: calc(100vw - 24px) !important;
}

.fmm-sk-panel {
  display: flex;
  flex-direction: column;
  margin-top: 10px;
}

.fmm-sk-scroll {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: min(64vh, 500px);
  overflow-y: auto;
  overscroll-behavior: contain;
  margin: 0 -4px;
  padding: 0 4px 4px;
}

.fmm-sk-group-title {
  margin: 0 0 6px 2px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: #8b919b;
}

.fmm-sk-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.fmm-sk-card {
  appearance: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: 8px 4px 7px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: #8a909b;
  font: inherit;
  text-align: center;
  cursor: pointer;
  transition: background-color 0.12s ease, border-color 0.12s ease, color 0.12s ease;
}

.fmm-sk-card:hover {
  background: #f5f6f8;
  color: #5f6570;
}

.fmm-sk-card:focus-visible {
  outline: 2px solid rgba(101, 121, 200, 0.45);
  outline-offset: 1px;
}

.fmm-sk-card.active {
  border-color: #c9d1f4;
  background: #f3f5fe;
  color: #5566c8;
}

.fmm-sk-thumb {
  display: block;
  width: 76px;
  height: 48px;
  border-radius: 7px;
  background: #ffffff;
  box-shadow: inset 0 0 0 1px #e4e6ea;
}

.fmm-sk-card.active .fmm-sk-thumb {
  box-shadow: inset 0 0 0 1px #c9d1f4;
}

.fmm-sk-thumb svg {
  display: block;
  width: 100%;
  height: 100%;
}

.fmm-sk-thumb .sk-line {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.fmm-sk-thumb .sk-root {
  fill: #ffffff;
  stroke: currentColor;
  stroke-width: 1.3;
}

.fmm-sk-thumb .sk-leaf {
  fill: #dfe3ea;
}

.fmm-sk-card.active .sk-leaf {
  fill: #d9def7;
}

.fmm-sk-label {
  font-size: 12px;
  line-height: 1.3;
  color: #3b4049;
  white-space: nowrap;
}

.fmm-sk-card.active .fmm-sk-label {
  color: #4453b3;
  font-weight: 600;
}

.fmm-sk-hint {
  margin-top: 6px;
  padding: 8px 2px 0;
  border-top: 1px solid #eef0f3;
  font-size: 11.5px;
  color: #8b919b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.focus-mind-map-fullscreen.is-theme-night .fmm-sk-card:hover {
  background: #2d333d;
  color: #aab3c2;
}

.focus-mind-map-fullscreen.is-theme-night .fmm-sk-card.active {
  border-color: #515b6a;
  background: #343b47;
  color: #8ca3ff;
}

.focus-mind-map-fullscreen.is-theme-night .fmm-sk-thumb {
  background: #232830;
  box-shadow: inset 0 0 0 1px #3d4550;
}

.focus-mind-map-fullscreen.is-theme-night .sk-root {
  fill: #2b313b;
}

.focus-mind-map-fullscreen.is-theme-night .sk-leaf {
  fill: #3e4652;
}

.focus-mind-map-fullscreen.is-theme-night .fmm-sk-label {
  color: #d5dae4;
}

.focus-mind-map-fullscreen.is-theme-night .fmm-sk-hint {
  border-top-color: #3a414c;
}
</style>
