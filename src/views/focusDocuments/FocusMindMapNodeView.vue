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
          <div class="focus-mind-map-tool-group">
            <button
              type="button"
              title="撤销"
              @click="undo"
            >
              <svg viewBox="0 0 20 20">
                <path d="M7 6 3.5 9.5 7 13M4 9.5h7a5 5 0 0 1 5 5" />
              </svg>
              撤销
            </button>

            <button
              type="button"
              title="重做"
              @click="redo"
            >
              <svg viewBox="0 0 20 20">
                <path d="m13 6 3.5 3.5L13 13m3-3.5H9a5 5 0 0 0-5 5" />
              </svg>
              重做
            </button>
          </div>

          <span class="focus-mind-map-toolbar-rule"></span>

          <div class="focus-mind-map-tool-group">
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
              title="居中显示"
              @click="centerMap"
            >
              <svg viewBox="0 0 20 20">
                <circle cx="10" cy="10" r="2.5" />
                <path d="M10 2v3M10 15v3M2 10h3M15 10h3" />
              </svg>
              居中
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
          <span><kbd>Tab</kbd> 添加子节点</span>
          <span><kbd>Enter</kbd> 添加同级节点</span>
          <span><kbd>F2</kbd> 编辑节点</span>
          <span><kbd>Delete</kbd> 删除节点</span>
          <span><kbd>Ctrl/⌘ Z</kbd> 撤销</span>
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
      const data =
        this.editingMind?.getData?.()
        || this.node.attrs.data
        || fallbackData(this.mapTitle);

      return clone(data);
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
            normalizeMindMapData(
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
            normalizeMindMapData(
              this.node.attrs.data,
              this.mapTitle
            )
          );

        if (error instanceof Error) {
          throw error;
        }

        this.editingMind.bus.addListener(
          "operation",
          () => {
            this.saveState = "saving";
            this.queueSave();
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

      if (this.$refs.editorCanvas) {
        this.$refs.editorCanvas
          .replaceChildren();
      }
    },

    undo() {
      this.editingMind?.undo?.();
    },

    redo() {
      this.editingMind?.redo?.();
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
</style>
