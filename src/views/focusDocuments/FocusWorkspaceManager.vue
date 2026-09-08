<template>
  <div
    class="workspace-manager-backdrop"
    @mousedown.self="requestClose"
  >
    <section
      ref="dialog"
      class="workspace-manager"
      role="dialog"
      aria-modal="true"
      aria-labelledby="workspace-manager-title"
      tabindex="-1"
      @keydown.esc.stop.prevent="requestClose"
    >
      <header class="workspace-manager-header">
        <div>
          <h2 id="workspace-manager-title">
            工作区排列
          </h2>
          <p>
            调整文档顺序、置顶状态和打开位置
          </p>
        </div>

        <div class="workspace-manager-header-actions">
          <button
            type="button"
            class="manager-create"
            @click="$emit('create-document')"
          >
            ＋ 新建文档
          </button>

          <button
            type="button"
            class="manager-close"
            aria-label="关闭工作区排列"
            title="关闭"
            @click="requestClose"
          >
            ×
          </button>
        </div>
      </header>

      <main class="workspace-manager-content">
        <label class="manager-search">
          <i class="bi-search"></i>
          <input
            ref="search"
            v-model.trim="query"
            type="search"
            placeholder="搜索文档"
          />
        </label>

        <section
          v-if="filteredPinnedRows.length"
          class="manager-section"
        >
          <header class="manager-section-header">
            <div>
              <i class="bi-pin-angle-fill"></i>
              <strong>置顶文档</strong>
              <span>{{ filteredPinnedRows.length }}</span>
            </div>

            <small>置顶文档始终排在普通文档之前</small>
          </header>

          <div class="manager-list">
            <document-row
              v-for="row in filteredPinnedRows"
              :key="row.id"
              :row="row"
              :open="openIds.includes(row.id)"
              :can-up="canMove(row.id, -1)"
              :can-down="canMove(row.id, 1)"
              :drop-target="dropTargetId === row.id"
              @move="moveRow(row.id, $event)"
              @toggle-pin="togglePin(row.id)"
              @open="$emit('open-document', row.id)"
              @dragstart="startDrag($event, row.id)"
              @dragend="endDrag"
              @dragover="dragOver($event, row.id)"
              @drop="dropBefore($event, row.id)"
            />
          </div>
        </section>

        <section class="manager-section">
          <header class="manager-section-header">
            <div>
              <i class="bi-files"></i>
              <strong>全部文档</strong>
              <span>{{ filteredNormalRows.length }}</span>
            </div>

            <small>拖动或使用箭头调整展示顺序</small>
          </header>

          <div
            v-if="filteredNormalRows.length"
            class="manager-list"
          >
            <document-row
              v-for="row in filteredNormalRows"
              :key="row.id"
              :row="row"
              :open="openIds.includes(row.id)"
              :can-up="canMove(row.id, -1)"
              :can-down="canMove(row.id, 1)"
              :drop-target="dropTargetId === row.id"
              @move="moveRow(row.id, $event)"
              @toggle-pin="togglePin(row.id)"
              @open="$emit('open-document', row.id)"
              @dragstart="startDrag($event, row.id)"
              @dragend="endDrag"
              @dragover="dragOver($event, row.id)"
              @drop="dropBefore($event, row.id)"
            />
          </div>

          <div v-else class="manager-empty">
            {{ query ? "没有匹配的文档" : "还没有普通文档" }}
          </div>
        </section>
      </main>

      <footer class="workspace-manager-footer">
        <p>
          最多同时显示 3 篇文档，其余文档通过工作区翻页查看
        </p>

        <div>
          <button
            type="button"
            class="manager-cancel"
            :disabled="saving"
            @click="requestClose"
          >
            取消
          </button>

          <button
            type="button"
            class="manager-save"
            :disabled="saving || !dirty"
            @click="save"
          >
            {{ saving ? "保存中…" : "保存排列" }}
          </button>
        </div>
      </footer>
    </section>
  </div>
</template>

<script>
const DocumentRow = {
  name: "FocusWorkspaceDocumentRow",

  props: {
    row: {
      type: Object,
      required: true,
    },
    open: Boolean,
    canUp: Boolean,
    canDown: Boolean,
    dropTarget: Boolean,
  },

  emits: [
    "move",
    "toggle-pin",
    "open",
    "dragstart",
    "dragend",
    "dragover",
    "drop",
  ],

  template: `
    <article
      class="manager-document-row"
      :class="{
        'is-open': open,
        'is-drop-target': dropTarget,
      }"
      draggable="true"
      @dragstart="$emit('dragstart', $event)"
      @dragend="$emit('dragend')"
      @dragover.prevent="$emit('dragover', $event)"
      @drop.prevent="$emit('drop', $event)"
    >
      <span
        class="manager-drag-handle"
        title="拖动调整顺序"
        aria-hidden="true"
      >
        <i class="bi-grip-vertical"></i>
      </span>

      <div class="manager-document-copy">
        <strong>
          {{ row.title || "未命名文档" }}
        </strong>

        <span>
          <em v-if="row.pinned">已置顶</em>
          <em v-if="open">当前已打开</em>
          <em v-if="row.draft">草稿</em>
        </span>
      </div>

      <div class="manager-row-actions">
        <button
          type="button"
          :disabled="!canUp"
          title="向上移动"
          aria-label="向上移动"
          @click="$emit('move', -1)"
        >
          <i class="bi-chevron-up"></i>
        </button>

        <button
          type="button"
          :disabled="!canDown"
          title="向下移动"
          aria-label="向下移动"
          @click="$emit('move', 1)"
        >
          <i class="bi-chevron-down"></i>
        </button>

        <button
          type="button"
          class="manager-pin-button"
          :class="{ active: row.pinned }"
          :title="row.pinned ? '取消置顶' : '置顶文档'"
          :aria-pressed="String(row.pinned)"
          @click="$emit('toggle-pin')"
        >
          <i
            :class="
              row.pinned
                ? 'bi-pin-angle-fill'
                : 'bi-pin-angle'
            "
          ></i>
        </button>

        <button
          type="button"
          class="manager-open-button"
          @click="$emit('open')"
        >
          {{ open ? "定位" : "打开" }}
        </button>
      </div>
    </article>
  `,
};

export default {
  name: "FocusWorkspaceManager",

  components: {
    DocumentRow,
  },

  props: {
    documents: {
      type: Array,
      default: () => [],
    },

    openIds: {
      type: Array,
      default: () => [],
    },
  },

  emits: [
    "close",
    "save",
    "open-document",
    "create-document",
  ],

  data() {
    return {
      rows: [],
      initialFingerprint: "",
      query: "",
      saving: false,
      draggedId: null,
      dropTargetId: null,
    };
  },

  computed: {
    dirty() {
      return (
        JSON.stringify(this.serializedRows()) !==
        this.initialFingerprint
      );
    },

    filteredPinnedRows() {
      return this.filterRows(
        this.rows.filter((row) => row.pinned)
      );
    },

    filteredNormalRows() {
      return this.filterRows(
        this.rows.filter((row) => !row.pinned)
      );
    },
  },

  mounted() {
    this.resetRows();

    this.$nextTick(() => {
      this.$refs.dialog?.focus();
    });
  },

  methods: {
    resetRows() {
      this.rows = this.documents.map((document) => ({
        id: document.id,
        title: document.title || "",
        pinned: Boolean(document.pinned),
        draft: Boolean(document.draft),
      }));

      this.initialFingerprint = JSON.stringify(
        this.serializedRows()
      );
    },

    serializedRows() {
      return this.rows.map((row) => ({
        id: row.id,
        pinned: row.pinned,
      }));
    },

    filterRows(rows) {
      const query = this.query.toLowerCase();

      if (!query) return rows;

      return rows.filter((row) =>
        String(row.title || "")
          .toLowerCase()
          .includes(query)
      );
    },

    groupRows(row) {
      return this.rows.filter(
        (item) => item.pinned === row.pinned
      );
    },

    canMove(id, step) {
      const row = this.rows.find(
        (item) => item.id === id
      );

      if (!row || this.query) return false;

      const group = this.groupRows(row);
      const index = group.findIndex(
        (item) => item.id === id
      );
      const target = index + Number(step);

      return target >= 0 && target < group.length;
    },

    moveRow(id, step) {
      if (!this.canMove(id, step)) return;

      const row = this.rows.find(
        (item) => item.id === id
      );
      const groupIds = this.groupRows(row).map(
        (item) => item.id
      );
      const index = groupIds.indexOf(id);
      const targetId =
        groupIds[index + Number(step)];

      const sourceIndex = this.rows.findIndex(
        (item) => item.id === id
      );
      const targetIndex = this.rows.findIndex(
        (item) => item.id === targetId
      );

      const next = [...this.rows];

      [next[sourceIndex], next[targetIndex]] = [
        next[targetIndex],
        next[sourceIndex],
      ];

      this.rows = next;
    },

    togglePin(id) {
      const row = this.rows.find(
        (item) => item.id === id
      );

      if (!row) return;

      row.pinned = !row.pinned;

      this.rows = [
        ...this.rows.filter((item) => item.pinned),
        ...this.rows.filter((item) => !item.pinned),
      ];
    },

    startDrag(event, id) {
      if (this.query) {
        event.preventDefault();
        return;
      }

      this.draggedId = id;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(
        "application/x-weektodo-workspace-row",
        id
      );
    },

    dragOver(event, targetId) {
      const source = this.rows.find(
        (item) => item.id === this.draggedId
      );
      const target = this.rows.find(
        (item) => item.id === targetId
      );

      this.dropTargetId =
        source &&
        target &&
        source.id !== target.id &&
        source.pinned === target.pinned
          ? targetId
          : null;
    },

    dropBefore(event, targetId) {
      const sourceId =
        event.dataTransfer.getData(
          "application/x-weektodo-workspace-row"
        ) || this.draggedId;

      const source = this.rows.find(
        (item) => item.id === sourceId
      );
      const target = this.rows.find(
        (item) => item.id === targetId
      );

      if (
        !source ||
        !target ||
        source.id === target.id ||
        source.pinned !== target.pinned
      ) {
        this.endDrag();
        return;
      }

      const next = this.rows.filter(
        (item) => item.id !== source.id
      );
      const targetIndex = next.findIndex(
        (item) => item.id === target.id
      );

      next.splice(targetIndex, 0, source);
      this.rows = next;
      this.endDrag();
    },

    endDrag() {
      this.draggedId = null;
      this.dropTargetId = null;
    },

    requestClose() {
      if (
        this.dirty &&
        !window.confirm(
          "排列或置顶状态尚未保存，确定关闭吗？"
        )
      ) {
        return;
      }

      this.$emit("close");
    },

    save() {
      if (!this.dirty || this.saving) return;

      this.saving = true;

      this.$emit("save", {
        orderedIds: this.rows.map(
          (row) => row.id
        ),
        pinnedById: Object.fromEntries(
          this.rows.map((row) => [
            row.id,
            row.pinned,
          ])
        ),
      });
    },
  },
};
</script>

<style scoped lang="scss">
.workspace-manager-backdrop {
  position: fixed;
  z-index: 22000;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(19, 23, 29, 0.48);
  backdrop-filter: blur(5px);
}

.workspace-manager {
  display: flex;
  width: min(760px, calc(100vw - 40px));
  height: min(720px, calc(100vh - 40px));
  min-height: 480px;
  flex-direction: column;
  border: 1px solid rgba(31, 35, 41, 0.14);
  border-radius: 15px;
  outline: none;
  background: #fff;
  box-shadow:
    0 28px 80px rgba(18, 22, 28, 0.25),
    0 4px 14px rgba(18, 22, 28, 0.08);
  overflow: hidden;
}

.workspace-manager-header {
  display: flex;
  min-height: 72px;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 13px 17px 12px 21px;
  border-bottom: 1px solid #eceef1;

  h2 {
    margin: 0;
    color: #282d34;
    font-size: 17px;
    font-weight: 680;
  }

  p {
    margin: 3px 0 0;
    color: #969ca5;
    font-size: 11px;
  }
}

.workspace-manager-header-actions {
  display: flex;
  align-items: center;
  gap: 7px;
}

.manager-create,
.manager-close {
  height: 34px;
  border: 0;
  border-radius: 8px;
  font-family: inherit;
  cursor: pointer;
}

.manager-create {
  padding: 0 13px;
  background: #4263eb;
  color: #fff;
  font-size: 11px;
}

.manager-close {
  width: 34px;
  padding: 0;
  background: transparent;
  color: #727a85;
  font-size: 21px;

  &:hover {
    background: #eef1f5;
  }
}

.workspace-manager-content {
  min-height: 0;
  flex: 1;
  padding: 16px 18px 22px;
  overflow-y: auto;
}

.manager-search {
  display: flex;
  height: 38px;
  align-items: center;
  gap: 8px;
  padding: 0 11px;
  border: 1px solid #dfe3e8;
  border-radius: 9px;
  background: #fff;
  color: #949ba4;

  input {
    min-width: 0;
    flex: 1;
    border: 0;
    outline: none;
    background: transparent;
    color: #343a42;
    font-family: inherit;
    font-size: 12px;
  }

  &:focus-within {
    border-color: #91a5e9;
    box-shadow: 0 0 0 3px rgba(66, 99, 235, 0.09);
  }
}

.manager-section {
  margin-top: 20px;
}

.manager-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 8px;
  padding: 0 3px;

  > div {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  strong {
    color: #454c55;
    font-size: 12px;
  }

  span {
    min-width: 20px;
    padding: 2px 6px;
    border-radius: 999px;
    background: #eef1f5;
    color: #777f89;
    font-size: 9px;
    text-align: center;
  }

  small {
    color: #a0a6ae;
    font-size: 9px;
  }

  i {
    color: #7d65b1;
  }
}

.manager-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

:deep(.manager-document-row) {
  display: grid;
  min-height: 54px;
  grid-template-columns:
    26px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 5px 7px;
  border: 1px solid #e4e7eb;
  border-radius: 9px;
  background: #fff;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;
}

:deep(.manager-document-row.is-open) {
  border-color: #c8d2f5;
  background: #fafbff;
}

:deep(.manager-document-row.is-drop-target) {
  border-color: #6984e5;
  box-shadow:
    inset 0 2px 0 #6984e5;
}

:deep(.manager-drag-handle) {
  display: grid;
  width: 26px;
  height: 34px;
  place-items: center;
  color: #a2a8b0;
  cursor: grab;
}

:deep(.manager-document-copy) {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

:deep(.manager-document-copy strong) {
  overflow: hidden;
  color: #343a42;
  font-size: 12px;
  font-weight: 570;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.manager-document-copy span) {
  display: flex;
  gap: 5px;
}

:deep(.manager-document-copy em) {
  padding: 2px 5px;
  border-radius: 999px;
  background: #eef1f5;
  color: #7c848e;
  font-size: 8px;
  font-style: normal;
}

:deep(.manager-row-actions) {
  display: flex;
  align-items: center;
  gap: 3px;
}

:deep(.manager-row-actions button) {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #747c87;
  font-family: inherit;
  cursor: pointer;
}

:deep(.manager-row-actions button:hover:not(:disabled)) {
  background: #eef1f5;
  color: #4263eb;
}

:deep(.manager-row-actions button:disabled) {
  cursor: default;
  opacity: 0.28;
}

:deep(.manager-row-actions .manager-pin-button.active) {
  background: #eee9f9;
  color: #7950c7;
}

:deep(.manager-row-actions .manager-open-button) {
  display: inline-flex;
  width: auto;
  min-width: 48px;
  padding: 0 9px;
  color: #4263eb;
  font-size: 10px;
}

.manager-empty {
  padding: 42px 20px;
  border: 1px dashed #dfe3e8;
  border-radius: 9px;
  color: #a0a6ae;
  font-size: 11px;
  text-align: center;
}

.workspace-manager-footer {
  display: flex;
  min-height: 62px;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 10px 17px;
  border-top: 1px solid #eceef1;
  background: #fafbfc;

  p {
    margin: 0;
    color: #989fa8;
    font-size: 10px;
  }

  > div {
    display: flex;
    gap: 8px;
  }

  button {
    min-width: 82px;
    height: 35px;
    border-radius: 8px;
    font-family: inherit;
    cursor: pointer;
  }
}

.manager-cancel {
  border: 1px solid #dfe3e8;
  background: #fff;
  color: #565e68;
}

.manager-save {
  border: 1px solid #4263eb;
  background: #4263eb;
  color: #fff;

  &:disabled {
    cursor: default;
    opacity: 0.5;
  }
}

.dark-theme {
  .workspace-manager {
    border-color: #38414b;
    background: #1d232b;
  }

  .workspace-manager-header,
  .workspace-manager-footer {
    border-color: #343b45;
  }

  .workspace-manager-header h2 {
    color: #e1e5ea;
  }

  .manager-close:hover {
    background: #29313b;
  }

  .manager-search,
  :deep(.manager-document-row),
  .manager-cancel {
    border-color: #36404a;
    background: #20262e;
    color: #d8dde3;
  }

  .manager-search input,
  :deep(.manager-document-copy strong) {
    color: #d8dde3;
  }

  :deep(.manager-document-row.is-open) {
    border-color: #4f6098;
    background: #202637;
  }

  :deep(.manager-row-actions button:hover:not(:disabled)) {
    background: #29313b;
  }

  .workspace-manager-footer {
    background: #181e25;
  }

  .manager-empty {
    border-color: #36404a;
  }
}

@media (max-width: 720px) {
  .workspace-manager-backdrop {
    justify-content: start;
    overflow-x: auto;
  }

  .workspace-manager {
    min-width: 680px;
  }
}
</style>
