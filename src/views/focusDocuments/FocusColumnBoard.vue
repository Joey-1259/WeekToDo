<template>
  <section
    v-if="columns.length"
    ref="board"
    class="focus-board"
  >
    <template v-for="(column, index) in columns" :key="column.id">
      <div
        class="focus-rail"
        :class="{
          'is-resizable': index > 0,
          'is-active': resizingIndex === index,
          'is-drop-target': dropIndex === index,
        }"
        @pointerdown="startResize(index, $event)"
        @dblclick="equalizePair(index)"
        @dragover.prevent="onRailDragOver(index, $event)"
        @dragleave="onRailDragLeave(index)"
        @drop.prevent="onRailDrop(index, $event)"
      >
        <button
          type="button"
          class="focus-rail-add"
          :title="
            index === 0
              ? '在最左侧添加分栏'
              : '在这两栏之间添加分栏'
          "
          :disabled="columns.length >= maxColumns"
          @pointerdown.stop
          @click.stop="openInserter(index, $event)"
        >
          ＋
        </button>
      </div>

      <div
        class="focus-column"
        :style="{ flex: `${column.flex} 1 0%` }"
      >
        <FocusColumnCard
          :document="documentMap[column.documentId]"
          :folder-path="pathOf(documentMap[column.documentId])"
          :active="activeColumnId === column.id"
          :dragging="draggingColumnId === column.id"
          @activate="activeColumnId = column.id"
          @drag-start="onCardDragStart(column.id, $event)"
          @drag-end="onCardDragEnd"
          @saved="$emit('saved', $event)"
          @expand="$emit('expand', column.documentId)"
          @action="$emit('action', $event)"
          @close="closeColumn(index)"
          @open-task="$emit('open-task', $event)"
          @jump-task="$emit('jump-task', $event)"
          @create-task="$emit('create-task', $event)"
        />
      </div>
    </template>

    <div
      class="focus-rail is-tail"
      :class="{ 'is-drop-target': dropIndex === columns.length }"
      @dragover.prevent="onRailDragOver(columns.length, $event)"
      @dragleave="onRailDragLeave(columns.length)"
      @drop.prevent="onRailDrop(columns.length, $event)"
    >
      <button
        type="button"
        class="focus-rail-add"
        title="在最右侧添加分栏"
        :disabled="columns.length >= maxColumns"
        @click.stop="openInserter(columns.length, $event)"
      >
        ＋
      </button>
    </div>

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

  <section v-else class="focus-board is-empty">
    <div class="focus-board-empty">
      <span class="focus-board-empty-icon" aria-hidden="true">▤</span>
      <strong>还没有打开任何文档</strong>
      <small>
        分栏用于把需要同时对照的文档并排放在一起，
        <br />
        每一栏都可以独立编辑、独立调宽。
      </small>

      <button
        ref="emptyButton"
        type="button"
        class="focus-board-empty-action"
        @click="openInserter(0, $event)"
      >
        ＋ 添加第一个分栏
      </button>
    </div>

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
/* FOCUS_COLUMN_LAYOUT_20260909_V1 */
import FocusColumnCard from "./FocusColumnCard.vue";
import FocusColumnInserter from "./FocusColumnInserter.vue";
import focusLayoutService from "../../services/focusLayoutService";

const COLUMN_DRAG_TYPE = "application/x-weektodo-column";
const DOCUMENT_DRAG_TYPE = "application/x-weektodo-document";

export default {
  name: "FocusColumnBoard",

  components: { FocusColumnCard, FocusColumnInserter },

  props: {
    columns: { type: Array, default: () => [] },
    documents: { type: Array, default: () => [] },
    folders: { type: Array, default: () => [] },
    folderPaths: { type: Object, default: () => ({}) },
  },

  emits: [
    "update:columns",
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
      resizingIndex: null,
      resizeState: null,
      inserter: null,
    };
  },

  computed: {
    documentMap() {
      const map = {};
      this.documents.forEach((item) => {
        map[item.id] = item;
      });
      return map;
    },

    openIds() {
      return this.columns.map((column) => column.documentId);
    },
  },

  beforeUnmount() {
    window.removeEventListener("pointermove", this.onResizeMove);
    window.removeEventListener("pointerup", this.stopResize);
  },

  methods: {
    pathOf(document) {
      if (!document?.folderId) return "未分类";
      return this.folderPaths[document.folderId] || "未分类";
    },

    emitColumns(next) {
      this.$emit("update:columns", next);
    },

    /* ---------- 插入 ---------- */

    openInserter(index, event) {
      const rect =
        event?.currentTarget?.getBoundingClientRect();

      const neighbour =
        this.columns[index - 1] || this.columns[index];

      const neighbourDocument = neighbour
        ? this.documentMap[neighbour.documentId]
        : null;

      this.inserter = {
        index,
        defaultFolderId:
          neighbourDocument?.folderId || "__root__",
        anchor: {
          x: rect ? rect.left + rect.width / 2 : 200,
          y: rect ? rect.bottom : 120,
          top: rect ? rect.top : 100,
        },
      };
    },

    onInserterPick(documentId) {
      const index = this.inserter?.index ?? this.columns.length;
      this.inserter = null;

      this.emitColumns(
        focusLayoutService.insert(this.columns, index, documentId)
      );
    },

    onInserterCreate(payload) {
      const index = this.inserter?.index ?? this.columns.length;
      this.inserter = null;

      this.$emit("create-document", { ...payload, index });
    },

    closeColumn(index) {
      this.emitColumns(
        focusLayoutService.removeAt(this.columns, index)
      );
    },

    /* ---------- 拖拽排序 ---------- */

    onCardDragStart(columnId, event) {
      this.draggingColumnId = columnId;

      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(COLUMN_DRAG_TYPE, columnId);
    },

    onCardDragEnd() {
      this.draggingColumnId = null;
      this.dropIndex = null;
    },

    onRailDragOver(index) {
      this.dropIndex = index;
    },

    onRailDragLeave(index) {
      if (this.dropIndex === index) this.dropIndex = null;
    },

    onRailDrop(index, event) {
      this.dropIndex = null;

      const columnId =
        event.dataTransfer?.getData(COLUMN_DRAG_TYPE) ||
        this.draggingColumnId;

      if (columnId) {
        const from = this.columns.findIndex(
          (column) => column.id === columnId
        );

        this.draggingColumnId = null;

        if (from >= 0) {
          this.emitColumns(
            focusLayoutService.move(this.columns, from, index)
          );
        }

        return;
      }

      const documentId = event.dataTransfer?.getData(
        DOCUMENT_DRAG_TYPE
      );

      if (documentId) {
        this.emitColumns(
          focusLayoutService.insert(
            this.columns,
            index,
            documentId
          )
        );
      }
    },

    /* ---------- 拖拽调宽 ---------- */

    startResize(index, event) {
      if (index === 0 || event.button !== 0) return;
      if (event.target.closest(".focus-rail-add")) return;

      const board = this.$refs.board;
      if (!board) return;

      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);

      this.resizingIndex = index;
      this.resizeState = {
        startX: event.clientX,
        width: board.clientWidth,
        totalFlex: this.columns.reduce(
          (total, column) => total + column.flex,
          0
        ),
        columns: this.columns.map((column) => ({ ...column })),
      };

      document.body.classList.add("focus-resizing");
      window.addEventListener("pointermove", this.onResizeMove);
      window.addEventListener("pointerup", this.stopResize);
    },

    onResizeMove(event) {
      if (!this.resizeState) return;

      const { startX, width, totalFlex, columns } =
        this.resizeState;

      const deltaPx = event.clientX - startX;
      const flexPerPx = totalFlex / Math.max(width, 1);

      this.emitColumns(
        focusLayoutService.applyResize(
          columns,
          this.resizingIndex,
          deltaPx * flexPerPx
        )
      );
    },

    stopResize() {
      this.resizingIndex = null;
      this.resizeState = null;

      document.body.classList.remove("focus-resizing");
      window.removeEventListener("pointermove", this.onResizeMove);
      window.removeEventListener("pointerup", this.stopResize);
    },

    equalizePair(index) {
      if (index === 0) return;

      const next = this.columns.map((column) => ({ ...column }));
      const left = next[index - 1];
      const right = next[index];

      if (!left || !right) return;

      const average = (left.flex + right.flex) / 2;
      left.flex = average;
      right.flex = average;

      this.emitColumns(next);
    },
  },
};
</script>

<style scoped lang="scss">
.focus-board {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  align-items: stretch;
  overflow-x: auto;
  scrollbar-gutter: stable;
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
  max-width: 340px;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.focus-board-empty-icon {
  display: grid;
  width: 40px;
  height: 40px;
  margin-bottom: 12px;
  place-items: center;
  border-radius: 11px;
  background: #f0f2f5;
  color: #99a0a9;
  font-size: 19px;
}

.focus-board-empty strong {
  color: #4d545e;
  font-size: 14px;
  font-weight: 580;
}

.focus-board-empty small {
  margin: 6px 0 16px;
  color: #a0a6af;
  font-size: 11px;
  line-height: 1.7;
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
  min-width: 300px;
  min-height: 0;
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
  width: 40px;
  flex: 0 0 40px;
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
  opacity: 0;
  background: #fff;
  color: #7b828c;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
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
  opacity: 0.75;
}

.focus-rail-add:hover {
  border-color: #4263eb;
  color: #4263eb;
  transform: scale(1.12);
}

.focus-rail-add:disabled {
  cursor: default;
  opacity: 0;
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

.dark-theme .focus-rail-add {
  border-color: #3a424d;
  background: #1d232b;
  color: #99a1ac;
}

.dark-theme .focus-rail-add:hover {
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
</style>
