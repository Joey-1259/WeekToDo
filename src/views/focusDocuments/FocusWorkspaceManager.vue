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
      @keydown="onDialogKeydown"
    >
      <header class="workspace-manager-header">
        <div>
          <strong
            id="workspace-manager-title"
            ref="title"
            tabindex="-1"
          >
            工作区排列
          </strong>
          <small>
            调整分页顺序、置顶文档和工作区显示范围
          </small>
        </div>

        <button
          type="button"
          class="icon-button"
          aria-label="关闭排列窗口"
          title="关闭"
          @click="requestClose"
        >
          ×
        </button>
      </header>

      <div class="workspace-manager-toolbar">
        <label class="workspace-manager-search">
          <span aria-hidden="true">⌕</span>
          <input
            v-model.trim="query"
            type="search"
            placeholder="搜索文档"
            aria-label="搜索文档"
          />
        </label>

        <span class="workspace-manager-summary">
          {{ openCount }} 个工作区文档
          · {{ pageCount }} 页
        </span>
      </div>

      <div class="workspace-manager-body">
        <section class="workspace-manager-section">
          <header>
            <div>
              <strong>工作区文档</strong>
              <small>
                每 3 个文档组成一页，置顶文档优先显示
              </small>
            </div>
          </header>

          <div
            v-if="workspaceRows.length"
            class="workspace-manager-list"
          >
            <article
              v-for="row in workspaceRows"
              :key="row.id"
              class="workspace-manager-row"
              :class="{
                pinned: row.pinned,
                dragging: draggedId === row.id,
              }"
              :draggable="!query"
              @dragstart="startDrag($event, row)"
              @dragend="endDrag"
              @dragover.prevent
              @drop="dropBefore($event, row)"
            >
              <span
                class="drag-handle"
                :title="
                  query
                    ? '搜索状态下不能拖动'
                    : '拖动调整位置'
                "
                aria-hidden="true"
              >
                ⠿
              </span>

              <span
                v-if="row.pinned"
                class="pin-indicator"
                title="已置顶"
              >
                ◆
              </span>

              <div class="workspace-manager-copy">
                <strong>
                  {{ row.title || "未命名文档" }}
                </strong>
                <small>
                  {{
                    row.pinned
                      ? "置顶文档"
                      : `第 ${pageFor(row.id)} 页`
                  }}
                </small>
              </div>

              <div class="workspace-manager-actions">
                <button
                  type="button"
                  :title="row.pinned ? '取消置顶' : '置顶'"
                  @click="togglePin(row)"
                >
                  {{ row.pinned ? "取消置顶" : "置顶" }}
                </button>

                <button
                  type="button"
                  title="向前移动"
                  :disabled="
                    Boolean(query) || !canMove(row, -1)
                  "
                  @click="move(row, -1)"
                >
                  ↑
                </button>

                <button
                  type="button"
                  title="向后移动"
                  :disabled="
                    Boolean(query) || !canMove(row, 1)
                  "
                  @click="move(row, 1)"
                >
                  ↓
                </button>

                <button
                  type="button"
                  title="暂时从工作区移除，不删除文档"
                  @click="toggleWorkspace(row)"
                >
                  移出
                </button>
              </div>
            </article>
          </div>

          <div v-else class="workspace-manager-empty">
            {{
              query
                ? "没有匹配的工作区文档"
                : "工作区暂时为空"
            }}
          </div>
        </section>

        <section class="workspace-manager-section secondary">
          <header>
            <div>
              <strong>未显示文档</strong>
              <small>
                文档仍然保留，只是没有加入当前工作区
              </small>
            </div>
          </header>

          <div
            v-if="libraryRows.length"
            class="workspace-manager-list"
          >
            <article
              v-for="row in libraryRows"
              :key="row.id"
              class="workspace-manager-row"
            >
              <span
                class="drag-handle muted"
                aria-hidden="true"
              >
                ·
              </span>

              <span
                v-if="row.pinned"
                class="pin-indicator"
                title="已置顶"
              >
                ◆
              </span>

              <div class="workspace-manager-copy">
                <strong>
                  {{ row.title || "未命名文档" }}
                </strong>
                <small>
                  {{ row.pinned ? "已置顶" : "未加入工作区" }}
                </small>
              </div>

              <div class="workspace-manager-actions">
                <button
                  type="button"
                  :title="row.pinned ? '取消置顶' : '置顶'"
                  @click="togglePin(row)"
                >
                  {{ row.pinned ? "取消置顶" : "置顶" }}
                </button>

                <button
                  type="button"
                  class="primary-text"
                  @click="toggleWorkspace(row)"
                >
                  加入工作区
                </button>
              </div>
            </article>
          </div>

          <div v-else class="workspace-manager-empty">
            {{
              query
                ? "没有匹配的未显示文档"
                : "所有文档都已加入工作区"
            }}
          </div>
        </section>
      </div>

      <footer class="workspace-manager-footer">
        <p>
          置顶文档始终排列在普通文档之前；移出工作区不会删除内容。
        </p>

        <div>
          <button type="button" @click="requestClose">
            取消
          </button>

          <button
            type="button"
            class="primary"
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
function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

export default {
  name: "FocusWorkspaceManager",
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
  emits: ["close", "save"],
  data() {
    return {
      rows: [],
      initialState: "",
      query: "",
      draggedId: null,
      saving: false,
    };
  },
  computed: {
    filteredRows() {
      const term = normalizeText(this.query);

      if (!term) return this.rows;

      return this.rows.filter((row) =>
        [
          row.title,
          ...(row.tags || []),
        ]
          .join(" ")
          .toLowerCase()
          .includes(term)
      );
    },

    workspaceRows() {
      return this.filteredRows.filter((row) => row.open);
    },

    libraryRows() {
      return this.filteredRows.filter((row) => !row.open);
    },

    openCount() {
      return this.rows.filter((row) => row.open).length;
    },

    pageCount() {
      return Math.max(1, Math.ceil(this.openCount / 3));
    },

    serializedState() {
      return JSON.stringify(
        this.rows.map((row) => ({
          id: row.id,
          open: row.open,
          pinned: row.pinned,
        }))
      );
    },

    dirty() {
      return this.serializedState !== this.initialState;
    },
  },
  mounted() {
    this.buildRows();

    this.$nextTick(() => {
      this.$refs.title?.focus();
    });
  },
  methods: {
    buildRows() {
      const documentMap = new Map(
        this.documents.map((document) => [
          document.id,
          document,
        ])
      );

      const orderedIds = [
        ...this.openIds,
        ...this.documents
          .map((document) => document.id)
          .filter((id) => !this.openIds.includes(id)),
      ];

      this.rows = orderedIds
        .map((id) => documentMap.get(id))
        .filter(Boolean)
        .map((document) => ({
          id: document.id,
          title: document.title,
          tags: document.tags || [],
          pinned: Boolean(document.pinned),
          open: this.openIds.includes(document.id),
        }));

      this.normalizeGroups();
      this.initialState = this.serializedState;
    },

    normalizeGroups() {
      this.rows = [
        ...this.rows.filter((row) => row.pinned),
        ...this.rows.filter((row) => !row.pinned),
      ];
    },

    pageFor(id) {
      const openRows = this.rows.filter((row) => row.open);
      const index = openRows.findIndex((row) => row.id === id);

      return index < 0 ? 1 : Math.floor(index / 3) + 1;
    },

    groupRows(row) {
      return this.rows.filter(
        (item) =>
          item.open === row.open &&
          item.pinned === row.pinned
      );
    },

    canMove(row, step) {
      const group = this.groupRows(row);
      const index = group.findIndex(
        (item) => item.id === row.id
      );
      const target = index + Number(step);

      return (
        index >= 0 &&
        target >= 0 &&
        target < group.length
      );
    },

    move(row, step) {
      if (this.query || !this.canMove(row, step)) return;

      const group = this.groupRows(row);
      const index = group.findIndex(
        (item) => item.id === row.id
      );
      const target = group[index + Number(step)];
      const sourceIndex = this.rows.findIndex(
        (item) => item.id === row.id
      );
      const targetIndex = this.rows.findIndex(
        (item) => item.id === target.id
      );

      const next = [...this.rows];

      [next[sourceIndex], next[targetIndex]] = [
        next[targetIndex],
        next[sourceIndex],
      ];

      this.rows = next;
    },

    togglePin(row) {
      row.pinned = !row.pinned;
      this.normalizeGroups();
    },

    toggleWorkspace(row) {
      row.open = !row.open;

      if (row.open) {
        const currentIndex = this.rows.findIndex(
          (item) => item.id === row.id
        );

        const next = [...this.rows];
        next.splice(currentIndex, 1);

        const lastOpenIndex = next.reduce(
          (result, item, index) =>
            item.open ? index : result,
          -1
        );

        next.splice(lastOpenIndex + 1, 0, row);
        this.rows = next;
      }
    },

    startDrag(event, row) {
      if (this.query || !row.open) {
        event.preventDefault();
        return;
      }

      this.draggedId = row.id;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(
        "application/x-weektodo-workspace-row",
        row.id
      );
    },

    endDrag() {
      this.draggedId = null;
    },

    dropBefore(event, target) {
      if (this.query || !target.open) return;

      const sourceId =
        event.dataTransfer.getData(
          "application/x-weektodo-workspace-row"
        ) || this.draggedId;

      const source = this.rows.find(
        (row) => row.id === sourceId
      );

      if (
        !source ||
        source.id === target.id ||
        !source.open ||
        source.pinned !== target.pinned
      ) {
        this.endDrag();
        return;
      }

      const next = this.rows.filter(
        (row) => row.id !== source.id
      );
      const targetIndex = next.findIndex(
        (row) => row.id === target.id
      );

      next.splice(targetIndex, 0, source);
      this.rows = next;
      this.endDrag();
    },

    requestClose() {
      if (
        this.dirty &&
        !window.confirm("排列尚未保存，确定放弃修改吗？")
      ) {
        return;
      }

      this.$emit("close");
    },

    onDialogKeydown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        this.requestClose();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = Array.from(
        this.$refs.dialog?.querySelectorAll(
          'button:not(:disabled), input:not(:disabled), [tabindex="0"]'
        ) || []
      );

      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === last
      ) {
        event.preventDefault();
        first.focus();
      }
    },

    save() {
      if (this.saving || !this.dirty) return;

      this.saving = true;

      this.$emit("save", {
        orderedIds: this.rows.map((row) => row.id),
        openIds: this.rows
          .filter((row) => row.open)
          .map((row) => row.id),
        pinnedIds: this.rows
          .filter((row) => row.pinned)
          .map((row) => row.id),
      });
    },
  },
};
</script>

<style scoped lang="scss">
.workspace-manager-backdrop {
  position: fixed;
  z-index: 23000;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(18, 22, 28, 0.48);
  backdrop-filter: blur(6px);
}

.workspace-manager {
  display: flex;
  width: min(820px, calc(100vw - 40px));
  height: min(720px, calc(100vh - 40px));
  min-height: 460px;
  flex-direction: column;
  border: 1px solid rgba(31, 35, 41, 0.14);
  border-radius: 16px;
  outline: none;
  background: #fff;
  box-shadow: 0 28px 90px rgba(18, 22, 28, 0.28);
  color: #2d3239;
  overflow: hidden;
}

.workspace-manager-header,
.workspace-manager-toolbar,
.workspace-manager-footer {
  flex: 0 0 auto;
}

.workspace-manager-header {
  display: flex;
  min-height: 70px;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 0 18px 0 22px;
  border-bottom: 1px solid #e9ecf0;
}

.workspace-manager-header > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.workspace-manager-header strong {
  outline: none;
  font-size: 17px;
}

.workspace-manager-header small,
.workspace-manager-section header small {
  color: #9299a3;
  font-size: 11px;
}

.icon-button {
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #747c87;
  font-size: 22px;
  cursor: pointer;
}

.icon-button:hover {
  background: #eef1f5;
}

.workspace-manager-toolbar {
  display: flex;
  min-height: 58px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 22px;
  border-bottom: 1px solid #edf0f3;
  background: #fafbfc;
}

.workspace-manager-search {
  display: flex;
  width: min(360px, 60%);
  height: 36px;
  align-items: center;
  gap: 8px;
  padding: 0 11px;
  border: 1px solid #dce1e6;
  border-radius: 9px;
  background: #fff;
}

.workspace-manager-search input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: none;
  background: transparent;
}

.workspace-manager-summary {
  color: #858d98;
  font-size: 11px;
}

.workspace-manager-body {
  min-height: 0;
  flex: 1;
  padding: 18px 22px;
  overflow-y: auto;
}

.workspace-manager-section + .workspace-manager-section {
  margin-top: 24px;
}

.workspace-manager-section > header {
  margin-bottom: 9px;
}

.workspace-manager-section header > div {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.workspace-manager-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.workspace-manager-row {
  display: grid;
  min-height: 52px;
  grid-template-columns: 24px 18px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border: 1px solid #e3e7eb;
  border-radius: 10px;
  background: #fff;
}

.workspace-manager-row.pinned {
  border-color: #cbd5f7;
  background: #f8f9ff;
}

.workspace-manager-row.dragging {
  opacity: 0.5;
}

.drag-handle {
  color: #929aa5;
  cursor: grab;
  font-size: 18px;
  text-align: center;
}

.drag-handle.muted {
  cursor: default;
  opacity: 0.45;
}

.pin-indicator {
  color: #4263eb;
  font-size: 10px;
  text-align: center;
}

.workspace-manager-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.workspace-manager-copy strong {
  overflow: hidden;
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workspace-manager-copy small {
  color: #969da7;
  font-size: 10px;
}

.workspace-manager-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.workspace-manager-actions button,
.workspace-manager-footer button {
  height: 30px;
  padding: 0 9px;
  border: 1px solid #dfe3e8;
  border-radius: 7px;
  background: #fff;
  color: #59616c;
  font-family: inherit;
  font-size: 11px;
  cursor: pointer;
}

.workspace-manager-actions button:hover:not(:disabled) {
  border-color: #aebcf0;
  color: #4263eb;
}

.workspace-manager-actions button:disabled {
  cursor: default;
  opacity: 0.4;
}

.workspace-manager-actions .primary-text {
  color: #4263eb;
}

.workspace-manager-empty {
  padding: 24px;
  border: 1px dashed #dce1e6;
  border-radius: 10px;
  color: #969da7;
  font-size: 12px;
  text-align: center;
}

.workspace-manager-footer {
  display: flex;
  min-height: 64px;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 10px 18px 10px 22px;
  border-top: 1px solid #e9ecf0;
  background: #fafbfc;
}

.workspace-manager-footer p {
  margin: 0;
  color: #8b929c;
  font-size: 10px;
}

.workspace-manager-footer > div {
  display: flex;
  gap: 8px;
}

.workspace-manager-footer button {
  min-width: 76px;
  height: 34px;
}

.workspace-manager-footer button.primary {
  border-color: #4263eb;
  background: #4263eb;
  color: #fff;
}

.workspace-manager-footer button:disabled {
  cursor: default;
  opacity: 0.5;
}

.dark-theme .workspace-manager {
  border-color: #38414b;
  background: #1d232b;
  color: #e1e5ea;
}

.dark-theme .workspace-manager-header,
.dark-theme .workspace-manager-toolbar,
.dark-theme .workspace-manager-footer {
  border-color: #343b45;
}

.dark-theme .workspace-manager-toolbar,
.dark-theme .workspace-manager-footer {
  background: #181e25;
}

.dark-theme .workspace-manager-search,
.dark-theme .workspace-manager-row,
.dark-theme .workspace-manager-actions button,
.dark-theme .workspace-manager-footer button {
  border-color: #3a424d;
  background: #20262e;
  color: #d8dde3;
}

.dark-theme .workspace-manager-row.pinned {
  border-color: #5167ad;
  background: #202944;
}

.dark-theme .workspace-manager-empty {
  border-color: #3a424d;
}

@media (max-width: 680px) {
  .workspace-manager-backdrop {
    padding: 10px;
  }

  .workspace-manager {
    width: calc(100vw - 20px);
    height: calc(100vh - 20px);
  }

  .workspace-manager-row {
    grid-template-columns: 20px 14px minmax(0, 1fr);
  }

  .workspace-manager-actions {
    grid-column: 3;
    flex-wrap: wrap;
  }

  .workspace-manager-footer {
    align-items: flex-end;
    flex-direction: column;
  }
}
</style>
