<template>
  <section
    class="focus-board-shell"
    :class="{ 'has-pager': pageCount > 1 }"
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

      <div
        class="focus-rail is-tail"
        :class="{ 'is-drop-target': dropIndex === tailIndex }"
        @dragover.prevent="dropIndex = tailIndex"
        @dragleave="onRailDragLeave(tailIndex)"
        @drop.prevent="onRailDrop(tailIndex, $event)"
      >
        <button
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

    <FocusBoardPager
      :page="page"
      :page-count="pageCount"
      @step="stepPage"
      @go="goToPage"
    />

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
import FocusBoardPager from "./FocusBoardPager.vue";
import focusLayoutService from "../../services/focusLayoutService";

const COLUMN_DRAG_TYPE = "application/x-weektodo-column";
const DOCUMENT_DRAG_TYPE = "application/x-weektodo-document";

export default {
  name: "FocusColumnBoard",

  components: {
    FocusColumnCard,
    FocusColumnInserter,
    FocusBoardPager,
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

      const pageFlex = this.pageEntries.reduce(
        (total, entry) => total + entry.column.flex,
        0
      );

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
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.focus-board-shell.has-pager {
  padding-bottom: 30px;
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
  align-items: center;
  justify-content: center;
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

/* FOCUS_UI_SYSTEM_20260912_V7
   仅 tail rail 上的 + 号上移到 38%：它和翻页箭头共处最右侧
   这一条窄带，是唯一会打架的一个。列间的 + 号没有这个问题，
   保持中线不动 —— 同类控件不该因为个别位置的冲突而整体位移。 */
.focus-rail.is-tail {
  align-items: flex-start;
  padding-top: 38%;
}
</style>
