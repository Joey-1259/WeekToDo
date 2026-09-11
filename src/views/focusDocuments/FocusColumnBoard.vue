<template>
  <section
    class="focus-board-shell"
    :class="{
      'has-pager': pageCount > 1,
      'is-drag-active': dragActive,
    }"
    @dragover.prevent="onShellDragOver"
    @dragleave="onShellDragLeave"
    @drop="endShellDrag"
    @wheel.passive="onWheel"
  >
    <div
      v-if="pageEntries.length"
      ref="board"
      class="focus-board"
      :class="slideClass"
    >
      <template
        v-for="(entry, localIndex) in pageEntries"
        :key="entry.column.id"
      >
        <div
          class="focus-rail"
          :class="{
            'is-resizable': localIndex > 0,
            'is-active': resizeRail === entry.index,
            'is-drop-target': dropIndex === entry.index,
          }"
          @pointerdown="startResize(entry.index, localIndex, $event)"
          @dblclick="equalizePair(entry.index, localIndex)"
          @dragover.prevent="dropIndex = entry.index"
          @dragleave="onRailDragLeave(entry.index)"
          @drop.prevent="onRailDrop(entry.index, $event)"
        >
          <button
            type="button"
            class="focus-rail-add"
            :title="
              localIndex === 0
                ? '在此版面最左侧添加分栏'
                : '在这两栏之间添加分栏'
            "
            :disabled="!canAddColumn"
            @pointerdown.stop
            @click.stop="openInserter(entry.index, $event)"
          >
            +
          </button>
        </div>

        <div
          class="focus-column"
          :style="{ flex: entry.column.flex + ' 1 0%' }"
        >
          <FocusColumnCard
            v-if="documentMap[entry.column.documentId]"
            :document="documentMap[entry.column.documentId]"
            :folder-path="
              pathOf(documentMap[entry.column.documentId])
            "
            :active="activeColumnId === entry.column.id"
            :dragging="draggingColumnId === entry.column.id"
            @activate="activeColumnId = entry.column.id"
            @drag-start="onCardDragStart(entry.column.id, $event)"
            @drag-end="onCardDragEnd"
            @saved="$emit('saved', $event)"
            @expand="$emit('expand', entry.column.documentId)"
            @action="$emit('action', $event)"
            @close="closeColumn(entry.index)"
            @open-task="$emit('open-task', $event)"
            @jump-task="$emit('jump-task', $event)"
            @create-task="$emit('create-task', $event)"
          />

          <div v-else class="focus-column-missing">
            <strong>文档已不存在</strong>
            <button type="button" @click="closeColumn(entry.index)">
              关闭此分栏
            </button>
          </div>
        </div>
      </template>

      <!-- UI_SYSTEM_20260911_V9
        分页排版守恒：4 栏 / 每版 3 栏时，第 2 版原先是一张被拉满
        全宽的孤卡，翻页瞬间栏宽突变。补上虚线占位槽后，每一版的
        栏宽恒定；顺带把"再加一栏"变成一个正向入口。
        仅在存在多个版面时生效 —— 单版面继续铺满，不造无谓留白。 -->
      <template
        v-for="ghost in ghostSlots"
        :key="'ghost-' + ghost"
      >
        <div class="focus-rail is-ghost" aria-hidden="true"></div>

        <div class="focus-column is-ghost">
          <button
            type="button"
            class="focus-ghost-slot"
            :disabled="!canAddColumn"
            :title="
              canAddColumn
                ? '在此处添加分栏'
                : '已达到分栏上限（' + maxColumns + ' 栏）'
            "
            @click.stop="openInserter(tailIndex, $event)"
          >
            <span aria-hidden="true">＋</span>
            <small>添加分栏</small>
          </button>
        </div>
      </template>

      <div
        class="focus-rail is-tail"
        :class="{ 'is-drop-target': dropIndex === tailIndex }"
        @dragover.prevent="dropIndex = tailIndex"
        @dragleave="onRailDragLeave(tailIndex)"
        @drop.prevent="onRailDrop(tailIndex, $event)"
      >
        <button
          v-if="!ghostSlots"
          type="button"
          class="focus-rail-add"
          :title="
            canAddColumn
              ? '在最右侧添加分栏'
              : '已达到分栏上限（' + maxColumns + ' 栏）'
          "
          :disabled="!canAddColumn"
          @click.stop="openInserter(tailIndex, $event)"
        >
          +
        </button>
      </div>
    </div>

    <div v-else class="focus-board is-empty">
      <div class="focus-board-empty">
        <span class="focus-board-empty-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <rect x="2.5" y="4" width="5.5" height="16" rx="1.4" />
            <rect x="9.5" y="4" width="5.5" height="16" rx="1.4" />
            <rect x="16.5" y="4" width="5" height="16" rx="1.4" />
          </svg>
        </span>

        <strong>还没有打开任何分栏</strong>
        <small>
          分栏用于把需要同时对照的文档并排放在一起。
          <br />
          每栏独立编辑、独立调宽，超过一个版面可左右翻页。
        </small>

        <button
          type="button"
          class="focus-board-empty-action"
          @click="openInserter(0, $event)"
        >
          + 添加第一个分栏
        </button>
      </div>
    </div>

    <!-- UI_SYSTEM_20260911_V9
      翻页箭头已移入顶部功能区（见 FocusDocumentsView）。这里只保留
      拖拽场景专属的边缘热区：需要跨版面重排时才浮现，命中区域是
      整列高而非一个 34px 圆点，悬停 620ms 自动翻页。
      需要时才出现、出现时极易命中、平时零占位。 -->
    <template v-if="pageCount > 1 && dragActive">
      <div
        class="focus-board-edge is-prev"
        :class="{
          'is-armed': edgeArmed === -1,
          'is-blocked': page <= 0,
        }"
        @dragover.prevent="armEdge(-1)"
        @dragleave="disarmEdge"
        @drop.prevent="disarmEdge"
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M12 4 6.5 10 12 16" />
        </svg>
      </div>

      <div
        class="focus-board-edge is-next"
        :class="{
          'is-armed': edgeArmed === 1,
          'is-blocked': page >= pageCount - 1,
        }"
        @dragover.prevent="armEdge(1)"
        @dragleave="disarmEdge"
        @drop.prevent="disarmEdge"
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M8 4l5.5 6L8 16" />
        </svg>
      </div>
    </template>

    <FocusColumnInserter
      v-if="inserter"
      :anchor="inserter.anchor"
      :documents="documents"
      :folders="folders"
      :folder-paths="folderPaths"
      :exclude-ids="openIds"
      :default-folder-id="inserter.defaultFolderId"
      @close="inserter = null"
      @pick="onInserterPick"
      @create="onInserterCreate"
    />
  </section>
</template>

<script>
/* FOCUS_COLUMN_PAGES_20260909_V3 */
import FocusColumnCard from "./FocusColumnCard.vue";
import FocusColumnInserter from "./FocusColumnInserter.vue";
import focusLayoutService from "../../services/focusLayoutService";

const COLUMN_DRAG_TYPE = "application/x-weektodo-column";
const DOCUMENT_DRAG_TYPE = "application/x-weektodo-document";

export default {
  name: "FocusColumnBoard",

  components: {
    FocusColumnCard,
    FocusColumnInserter,
  },

  props: {
    layout: {
      type: Object,
      default: () => focusLayoutService.empty(),
    },
    documents: { type: Array, default: () => [] },
    folders: { type: Array, default: () => [] },
    folderPaths: { type: Object, default: () => ({}) },
  },

  emits: [
    "update:layout",
    "create-document",
    "saved",
    "expand",
    "action",
    "open-task",
    "jump-task",
    "create-task",
  ],

  data() {
    return {
      maxColumns: focusLayoutService.MAX_COLUMNS,
      activeColumnId: null,
      draggingColumnId: null,
      dropIndex: null,
      resizeRail: null,
      resizeState: null,
      inserter: null,
      slideClass: "",
      slideTimer: null,
      dragActive: false,
      dragEndTimer: null,
      edgeArmed: null,
      edgeTimer: null,
      wheelAccum: 0,
      wheelLock: false,
    };
  },

  computed: {
    page() {
      return this.layout.page || 0;
    },

    pageSize() {
      return this.layout.pageSize || 3;
    },

    pageCount() {
      return focusLayoutService.pageCount(this.layout);
    },

    pageEntries() {
      return focusLayoutService.pageColumns(this.layout);
    },

    tailIndex() {
      const start = focusLayoutService.pageStart(this.layout);

      return start + this.pageEntries.length;
    },

    /* 本版面还差几栏才填满。只有存在其它版面时才补占位，
       单版面铺满是正确的 —— 否则就是为了整齐而浪费画布。 */
    ghostSlots() {
      if (this.pageCount <= 1) return 0;

      return Math.max(0, this.pageSize - this.pageEntries.length);
    },

    /* 调宽换算的分母必须包含占位槽，否则补槽的版面上
       拖动 1px 会得到偏大的 flex 增量。 */
    pageFlexTotal() {
      const real = this.pageEntries.reduce(
        (total, entry) => total + entry.column.flex,
        0
      );

      return real + this.ghostSlots;
    },

    canAddColumn() {
      return (
        (this.layout.columns || []).length <
        focusLayoutService.MAX_COLUMNS
      );
    },

    documentMap() {
      const map = {};

      this.documents.forEach((item) => {
        map[item.id] = item;
      });

      return map;
    },

    openIds() {
      return (this.layout.columns || []).map(
        (column) => column.documentId
      );
    },
  },

  watch: {
    page(next, previous) {
      if (next === previous) return;

      clearTimeout(this.slideTimer);

      this.slideClass =
        next > previous ? "is-slide-next" : "is-slide-prev";

      this.slideTimer = setTimeout(() => {
        this.slideClass = "";
      }, 220);
    },
  },

  mounted() {
    window.addEventListener("keydown", this.onKeydown);
  },

  beforeUnmount() {
    window.removeEventListener("keydown", this.onKeydown);
    window.removeEventListener("pointermove", this.onResizeMove);
    window.removeEventListener("pointerup", this.stopResize);

    clearTimeout(this.slideTimer);
    clearTimeout(this.edgeTimer);
    clearTimeout(this.dragEndTimer);
    document.body.classList.remove("focus-resizing");
  },

  methods: {
    pathOf(document) {
      if (!document || !document.folderId) return "未分类";

      return this.folderPaths[document.folderId] || "未分类";
    },

    emitLayout(next) {
      this.$emit("update:layout", next);
    },

    /* ---------- 翻页 ---------- */

    stepPage(delta) {
      this.emitLayout(
        focusLayoutService.stepPage(this.layout, delta)
      );
    },

    goToPage(page) {
      this.emitLayout(
        focusLayoutService.goToPage(this.layout, page)
      );
    },

    onKeydown(event) {
      if (!(event.metaKey || event.ctrlKey) || !event.altKey) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        this.stepPage(-1);
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        this.stepPage(1);
      }
    },

    /* ---------- 插入 ---------- */

    openInserter(index, event) {
      const rect =
        event &&
        event.currentTarget &&
        event.currentTarget.getBoundingClientRect
          ? event.currentTarget.getBoundingClientRect()
          : null;

      const columns = this.layout.columns || [];
      const neighbour = columns[index - 1] || columns[index];

      const neighbourDocument = neighbour
        ? this.documentMap[neighbour.documentId]
        : null;

      this.inserter = {
        index,
        defaultFolderId:
          (neighbourDocument && neighbourDocument.folderId) ||
          "__root__",
        anchor: {
          x: rect ? rect.left + rect.width / 2 : 240,
          y: rect ? rect.bottom : 140,
          top: rect ? rect.top : 120,
        },
      };
    },

    onInserterPick(documentId) {
      const index = this.inserter
        ? this.inserter.index
        : this.tailIndex;

      this.inserter = null;

      this.emitLayout(
        focusLayoutService.insert(this.layout, index, documentId)
      );
    },

    onInserterCreate(payload) {
      const index = this.inserter
        ? this.inserter.index
        : this.tailIndex;

      this.inserter = null;

      this.$emit("create-document", { ...payload, index });
    },

    closeColumn(index) {
      this.emitLayout(
        focusLayoutService.removeAt(this.layout, index)
      );
    },

    /* ---------- 拖拽排序 ---------- */

    onCardDragStart(columnId, event) {
      this.draggingColumnId = columnId;

      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(COLUMN_DRAG_TYPE, columnId);
      event.dataTransfer.setData("text/plain", "column:" + columnId);
    },

    onCardDragEnd() {
      this.draggingColumnId = null;
      this.dropIndex = null;
      this.endShellDrag();
    },

    /* ---------- 拖拽态（驱动边缘热区的显隐） ---------- */

    onShellDragOver() {
      clearTimeout(this.dragEndTimer);
      this.dragActive = true;
    },

    /* dragleave 在子元素之间移动时也会触发，所以用一个短延时
       去抖：真正离开才收起热区，穿越 rail 时不会闪。 */
    onShellDragLeave() {
      clearTimeout(this.dragEndTimer);
      this.dragEndTimer = setTimeout(this.endShellDrag, 140);
    },

    endShellDrag() {
      clearTimeout(this.dragEndTimer);
      this.dragActive = false;
      this.disarmEdge();
    },

    armEdge(direction) {
      const target = this.page + direction;

      if (target < 0 || target > this.pageCount - 1) {
        this.edgeArmed = direction;
        return;
      }

      if (this.edgeArmed === direction && this.edgeTimer) return;

      clearTimeout(this.edgeTimer);
      this.edgeArmed = direction;

      this.edgeTimer = setTimeout(() => {
        this.edgeTimer = null;
        this.edgeArmed = null;
        this.stepPage(direction);
      }, 620);
    },

    disarmEdge() {
      clearTimeout(this.edgeTimer);
      this.edgeTimer = null;
      this.edgeArmed = null;
    },

    /* ---------- 触控板横向滑动翻页 ---------- */

    /* 看板本身不横向滚动，deltaX 是一份白送的输入。阈值取 120px
       且要求横向分量显著大于纵向，再加 520ms 锁 —— 宁可少翻一次，
       也不要在纵向滚动正文时被横向抖动意外翻页。 */
    onWheel(event) {
      if (this.pageCount <= 1 || this.wheelLock) return;

      const dx = event.deltaX || 0;
      const dy = event.deltaY || 0;

      if (Math.abs(dx) < Math.abs(dy) * 1.5) {
        this.wheelAccum = 0;
        return;
      }

      this.wheelAccum += dx;

      if (Math.abs(this.wheelAccum) < 120) return;

      const direction = this.wheelAccum > 0 ? 1 : -1;

      this.wheelAccum = 0;

      const target = this.page + direction;
      if (target < 0 || target > this.pageCount - 1) return;

      this.wheelLock = true;
      setTimeout(() => {
        this.wheelLock = false;
      }, 520);

      this.stepPage(direction);
    },

    onRailDragLeave(index) {
      if (this.dropIndex === index) this.dropIndex = null;
    },

    onRailDrop(index, event) {
      this.dropIndex = null;

      const columnId =
        (event.dataTransfer &&
          event.dataTransfer.getData(COLUMN_DRAG_TYPE)) ||
        this.draggingColumnId;

      if (columnId) {
        const from = (this.layout.columns || []).findIndex(
          (column) => column.id === columnId
        );

        this.draggingColumnId = null;

        if (from >= 0) {
          this.emitLayout(
            focusLayoutService.move(this.layout, from, index)
          );
        }

        return;
      }

      const documentId =
        event.dataTransfer &&
        event.dataTransfer.getData(DOCUMENT_DRAG_TYPE);

      if (documentId) {
        this.emitLayout(
          focusLayoutService.insert(this.layout, index, documentId)
        );
      }
    },

    /* ---------- 拖拽调宽（仅版面内相邻两栏） ---------- */

    startResize(index, localIndex, event) {
      if (localIndex === 0 || event.button !== 0) return;
      if (event.target.closest(".focus-rail-add")) return;

      const board = this.$refs.board;
      if (!board) return;

      event.preventDefault();

      if (event.currentTarget.setPointerCapture) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }

      const pageFlex = this.pageFlexTotal;

      this.resizeRail = index;
      this.resizeState = {
        startX: event.clientX,
        width: board.clientWidth,
        pageFlex: pageFlex || 1,
        layout: JSON.parse(JSON.stringify(this.layout)),
      };

      document.body.classList.add("focus-resizing");
      window.addEventListener("pointermove", this.onResizeMove);
      window.addEventListener("pointerup", this.stopResize);
    },

    onResizeMove(event) {
      if (!this.resizeState) return;

      const { startX, width, pageFlex, layout } = this.resizeState;

      const deltaPx = event.clientX - startX;
      const flexPerPx = pageFlex / Math.max(width, 1);

      this.emitLayout(
        focusLayoutService.applyResize(
          layout,
          this.resizeRail,
          deltaPx * flexPerPx
        )
      );
    },

    stopResize() {
      this.resizeRail = null;
      this.resizeState = null;

      document.body.classList.remove("focus-resizing");
      window.removeEventListener("pointermove", this.onResizeMove);
      window.removeEventListener("pointerup", this.stopResize);
    },

    equalizePair(index, localIndex) {
      if (localIndex === 0) return;

      const layout = JSON.parse(JSON.stringify(this.layout));
      const left = layout.columns[index - 1];
      const right = layout.columns[index];

      if (!left || !right) return;

      const average = (left.flex + right.flex) / 2;

      left.flex = average;
      right.flex = average;

      this.emitLayout(layout);
    },
  },
};
</script>

<style scoped lang="scss">
.focus-board-shell {
  /* UI_SYSTEM_20260911_V9 · 唯一的纵向锚点
     卡片头部 min-height 46px，rail 上的 + 号 22px，
     于是 (46 - 22) / 2 = 12px 恰好落在标题栏的垂直中心。
     左/中/右三种 rail 共用这同一个声明 —— 对齐由一个变量保证，
     而不是靠三处各自算出同一个数。 */
  --focus-affordance-top: 12px;

  position: relative;
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

/* 翻页已移入顶部功能区，这 30px 的预留可以归还给内容。 */
.focus-board-shell.has-pager {
  padding-bottom: 0;
}

.focus-board {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  align-items: stretch;
  /* 一个版面 = 一屏，不做横向滚动。 */
  overflow: hidden;
}

.focus-board.is-slide-next {
  animation: focus-slide-next 0.22s ease-out;
}

.focus-board.is-slide-prev {
  animation: focus-slide-prev 0.22s ease-out;
}

@keyframes focus-slide-next {
  from {
    opacity: 0.35;
    transform: translateX(22px);
  }
}

@keyframes focus-slide-prev {
  from {
    opacity: 0.35;
    transform: translateX(-22px);
  }
}

.focus-board.is-empty {
  display: grid;
  place-items: center;
  border: 1px dashed #d9dde3;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.5);
}

.focus-board-empty {
  display: flex;
  max-width: 360px;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.focus-board-empty-icon {
  display: grid;
  width: 44px;
  height: 44px;
  margin-bottom: 13px;
  place-items: center;
  border-radius: 12px;
  background: #f0f2f5;
  color: #a8aeb7;
}

.focus-board-empty-icon svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
}

.focus-board-empty strong {
  color: #4d545e;
  font-size: 14px;
  font-weight: 580;
}

.focus-board-empty small {
  margin: 7px 0 17px;
  color: #a0a6af;
  font-size: 11px;
  line-height: 1.75;
}

.focus-board-empty-action {
  height: 34px;
  padding: 0 16px;
  border: 1px solid #4263eb;
  border-radius: 9px;
  background: #4263eb;
  color: #fff;
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
}

.focus-column {
  display: flex;
  min-width: 0;
  min-height: 0;
}

.focus-column-missing {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: 1px dashed #dfe3e8;
  border-radius: 12px;
  color: #979da6;
  font-size: 12px;
}

.focus-column-missing button {
  height: 30px;
  padding: 0 12px;
  border: 1px solid #dfe3e8;
  border-radius: 7px;
  background: #fff;
  color: #545b65;
  font-family: inherit;
  font-size: 11px;
  cursor: pointer;
}

.focus-rail {
  position: relative;
  display: flex;
  width: 16px;
  flex: 0 0 16px;
  /* 从"垂直居中"改为"对齐头部基线"：+ 号作用于分栏这个整体，
     贴着标题栏读起来就是"在这里插一栏"；居中则会浮在正文中央，
     既遮内容，也随窗口高度漂移。 */
  align-items: flex-start;
  justify-content: center;
  padding-top: var(--focus-affordance-top, 12px);
  touch-action: none;
}

.focus-rail.is-tail {
  width: 34px;
  flex: 0 0 34px;
}

.focus-rail.is-resizable {
  cursor: col-resize;
}

.focus-rail::before {
  position: absolute;
  top: 10px;
  bottom: 10px;
  width: 2px;
  border-radius: 2px;
  background: transparent;
  content: "";
  transition: background-color 0.14s ease, width 0.14s ease;
}

.focus-rail.is-resizable:hover::before,
.focus-rail.is-active::before {
  background: rgba(66, 99, 235, 0.34);
}

.focus-rail.is-drop-target::before {
  width: 3px;
  background: #4263eb;
}

.focus-rail-add {
  position: relative;
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  padding: 0;
  border: 1px solid #dde1e7;
  border-radius: 50%;
  background: #fff;
  color: #7b828c;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
  transition:
    opacity 0.14s ease,
    transform 0.14s ease,
    border-color 0.14s ease,
    color 0.14s ease;
}

.focus-rail:hover .focus-rail-add,
.focus-rail-add:focus-visible {
  opacity: 1;
}

.focus-rail.is-tail .focus-rail-add {
  opacity: 0.7;
}

.focus-rail-add:hover:not(:disabled) {
  border-color: #4263eb;
  color: #4263eb;
  transform: scale(1.12);
}

.focus-rail-add:disabled {
  cursor: default;
  opacity: 0;
}

.focus-rail.is-tail .focus-rail-add:disabled {
  cursor: default;
  opacity: 0.25;
}

.dark-theme .focus-board.is-empty {
  border-color: #343b45;
  background: rgba(22, 27, 34, 0.5);
}

.dark-theme .focus-board-empty-icon {
  background: #252c35;
  color: #99a1ac;
}

.dark-theme .focus-board-empty strong {
  color: #c8ced5;
}

.dark-theme .focus-column-missing,
.dark-theme .focus-column-missing button {
  border-color: #3a424d;
}

.dark-theme .focus-column-missing button {
  background: #20262e;
  color: #d8dde3;
}

.dark-theme .focus-rail-add {
  border-color: #3a424d;
  background: #1d232b;
  color: #99a1ac;
}

.dark-theme .focus-rail-add:hover:not(:disabled) {
  border-color: #6f8bea;
  color: #93a8f5;
}
</style>

<style lang="scss">
body.focus-resizing {
  cursor: col-resize;
  user-select: none;
}

body.focus-resizing * {
  cursor: col-resize !important;
}

/* FOCUS_UI_SYSTEM_20260911_V6
   tail rail 原本 34px，而首列前的 rail 是 16px，导致看板左右不对称：
   最后一张卡片离右边 58px、第一张离左边 40px。统一到 16px 之后，
   卡片区左右都是 gutter + rail = 40px，与头部完全同基线。
   22px 的 + 按钮会向 24px 的 gutter 里溢出 3px，视觉上正好
   悬在页面留白中，不与卡片抢边界。 */
.focus-rail.is-tail {
  width: var(--focus-rail, 16px);
  flex: 0 0 var(--focus-rail, 16px);
}

/* 空态卡也对齐到同一条基线，否则"没有分栏"和"有分栏"
   两个状态之间会出现 16px 的横向跳动。 */
.focus-board.is-empty {
  margin: 0 var(--focus-rail, 16px);
  background: #fcfcfd;
}

/* UI_SYSTEM_20260911_V9 · 修掉 padding-top:38% 的解析 bug
 *
 * 上一版写的是 `.focus-rail.is-tail { padding-top: 38% }`，意图是
 * "rail 高度的 38%"。但 padding 的百分比永远按包含块的 inline
 * size（宽度）解析 —— rail 是 flex item，包含块是 .focus-board，
 * 所以实际值 ≈ 看板宽度的 38%（940px 宽时约 357px）。
 * 后果有两个，正好就是用户报的两条：
 *   1. 右侧 + 号比左侧低几百像素 —— "两个加号没有水平对齐"；
 *   2. 该偏移随窗口宽度线性变化 —— "改变窗口大小时位置很奇怪"。
 *
 * 根治办法不是换一个百分比，而是让三种 rail 共享同一个绝对
 * 令牌。冲突的另一半（悬浮翻页箭头）已经被移出画布，这条窄带
 * 不再需要任何人让位。
 */
.focus-rail.is-tail {
  align-items: flex-start;
  padding-top: var(--focus-affordance-top, 12px);
}
</style>

<style scoped lang="scss">
/* UI_SYSTEM_20260911_V9 · 占位槽与拖拽边缘热区 */

.focus-rail.is-ghost {
  cursor: default;
  pointer-events: none;
}

.focus-column.is-ghost {
  display: flex;
  min-width: 0;
  flex: 1 1 0%;
}

.focus-ghost-slot {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px dashed #dde1e7;
  border-radius: 12px;
  background: transparent;
  color: #b4bac2;
  font-family: inherit;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    color 0.15s ease,
    background-color 0.15s ease;
}

.focus-ghost-slot:hover:not(:disabled) {
  border-color: #a9bbf2;
  background: rgba(66, 99, 235, 0.03);
  color: #4263eb;
}

.focus-ghost-slot:focus-visible {
  outline: none;
  border-color: #4263eb;
  box-shadow: 0 0 0 3px rgba(66, 99, 235, 0.1);
}

.focus-ghost-slot:disabled {
  cursor: default;
  opacity: 0.5;
}

.focus-ghost-slot span {
  font-size: 20px;
  line-height: 1;
}

.focus-ghost-slot small {
  font-size: 10.5px;
}

/* ---- 拖拽边缘热区 ----
   只在拖拽进行时挂载，所以平时既不占空间也不拦指针。
   命中区域是整列高 × 46px，比原先 34px 的圆点好命中一个量级。 */
.focus-board-edge {
  position: absolute;
  z-index: 8;
  top: 0;
  bottom: 0;
  display: grid;
  width: 46px;
  place-items: center;
  color: #7c8694;
  animation: focus-edge-in 0.14s ease-out;
}

.focus-board-edge.is-prev {
  left: 0;
  background: linear-gradient(
    to right,
    rgba(66, 99, 235, 0.1),
    rgba(66, 99, 235, 0)
  );
}

.focus-board-edge.is-next {
  right: 0;
  background: linear-gradient(
    to left,
    rgba(66, 99, 235, 0.1),
    rgba(66, 99, 235, 0)
  );
}

.focus-board-edge.is-armed {
  color: #4263eb;
}

.focus-board-edge.is-armed.is-prev {
  background: linear-gradient(
    to right,
    rgba(66, 99, 235, 0.2),
    rgba(66, 99, 235, 0)
  );
}

.focus-board-edge.is-armed.is-next {
  background: linear-gradient(
    to left,
    rgba(66, 99, 235, 0.2),
    rgba(66, 99, 235, 0)
  );
}

/* 已到首/末版：热区仍在（否则手感像"按钮消失了"），但明确示意无路可走。 */
.focus-board-edge.is-blocked {
  color: #c6ccd4;
  background: linear-gradient(
    to right,
    rgba(120, 128, 140, 0.07),
    rgba(120, 128, 140, 0)
  );
}

.focus-board-edge.is-blocked.is-next {
  background: linear-gradient(
    to left,
    rgba(120, 128, 140, 0.07),
    rgba(120, 128, 140, 0)
  );
}

.focus-board-edge svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.focus-board-edge.is-armed svg {
  animation: focus-edge-pulse 0.62s ease-in-out infinite;
}

@keyframes focus-edge-in {
  from {
    opacity: 0;
  }
}

@keyframes focus-edge-pulse {
  50% {
    opacity: 0.4;
    transform: scale(0.88);
  }
}

.dark-theme .focus-ghost-slot {
  border-color: #333a44;
  color: #6c7480;
}

.dark-theme .focus-ghost-slot:hover:not(:disabled) {
  border-color: #4f6ac4;
  background: rgba(111, 139, 234, 0.06);
  color: #93a8f5;
}

.dark-theme .focus-board-edge {
  color: #98a1ad;
}

.dark-theme .focus-board-edge.is-armed {
  color: #93a8f5;
}
</style>
