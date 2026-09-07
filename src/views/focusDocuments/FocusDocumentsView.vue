<template>
  <main class="focus-workspace">
    <header class="focus-workspace-header">
      <div>
        <h1>重点事项</h1>
        <span>{{ documents.length }} 篇文档</span>
      </div>

      <div class="focus-workspace-actions">
        <label class="focus-search">
          <span>⌕</span>
          <input
            v-model.trim="search"
            type="search"
            placeholder="搜索标题、标签、正文、关联事项"
          />
        </label>

        <div class="focus-directory-anchor">
          <button
            ref="directoryButton"
            type="button"
            :class="{ active: treeVisible }"
            :aria-expanded="String(treeVisible)"
            aria-haspopup="dialog"
            title="管理文档目录"
            @click.stop="toggleDirectory"
          >
            ☷
          </button>

          <Teleport to="body">
            <FocusDirectoryManager
              v-if="treeVisible"
              :documents="documents"
              :open-ids="openIds"
              :columns="columns"
              @close="closeDirectory"
              @changed="reload"
              @open-in-pane="openDirectoryDocument"
              @create-document="createFromDirectory"
            />
          </Teleport>
        </div>

        <select v-model.number="columns">
          <option :value="1">1 列</option>
          <option :value="2">2 列</option>
          <option :value="3">3 列</option>
          <option :value="4">4 列</option>
        </select>

        <button class="primary" @click="createDocument()">
          ＋ 新建文档
        </button>
      </div>
    </header>

    <div class="focus-workspace-body">


      <section
        class="focus-grid"
        :style="{ '--columns': columns }"
      >
        <template v-for="index in columns" :key="index">
          <FocusDocumentPane
            v-if="documentForPane(index - 1)"
            :document="documentForPane(index - 1)"
            :can-swap-left="index > 1"
            :can-swap-right="index < columns"
            draggable="true"
            @dragstart="
              startPaneDrag(
                $event,
                documentForPane(index - 1).id
              )
            "
            @dragend="draggedDocumentId = null"
            @dragover.prevent
            @drop="dropPane(index - 1, $event)"
            @saved="replaceDocument"
            @edit="editDocument"
            @document-action="handleDocumentAction"
            @open-task="openTask"
            @jump-task="jumpTask"
            @swap="swapPane(index - 1, $event)"
          />

          <div
            v-else
            class="focus-empty-pane"
            :class="{
              'is-drop-target': emptyDropIndex === index - 1,
            }"
            @dragover.prevent="emptyDropIndex = index - 1"
            @dragleave="
              clearEmptyDrag(index - 1, $event)
            "
            @drop="dropIntoPane(index - 1, $event)"
          >
            <div class="focus-empty-state">
              <span
                class="focus-empty-icon"
                aria-hidden="true"
              >
                ▤
              </span>

              <strong>选择一篇文档</strong>
              <small>从目录拖入，或在下方直接选择</small>

              <FocusDocumentTree
                class="focus-tree-compact"
                compact
                :documents="filteredDocuments"
                :open-ids="openIds"
                :selected-folder-id="selectedFolderId"
                @open-document="
                  selectDocument($event, index - 1)
                "
              />

              <button
                type="button"
                class="focus-empty-create"
                @click="createDocument()"
              >
                ＋ 新建文档
              </button>
            </div>
          </div>
        </template>
      </section>
    </div>

    <FocusDocumentModal
      v-if="modalDocument"
      :document="modalDocument"
      :require-folder="modalIsNew"
      @close="closeModal"
      @saved="finishModal"
      @open-task="openTask"
      @jump-task="jumpTask"
    />
  </main>
</template>

<script>
import FocusDocumentPane from "./FocusDocumentPane.vue";
import FocusDocumentModal from "./FocusDocumentModal.vue";
import FocusDocumentTree from "./FocusDocumentTree.vue";
import FocusDirectoryManager from "./FocusDirectoryManager.vue";
import focusDocumentService from "../../services/focusDocumentService";
import focusFolderService from "../../services/focusFolderService";
import focusTaskService from "../../services/focusTaskService";

function extractText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;

  if (Array.isArray(value)) {
    return value.map(extractText).join(" ");
  }

  return [
    value.text || "",
    value.attrs?.title || "",
    extractText(value.content),
  ].join(" ");
}

function escapeMarkdown(value) {
  return String(value || "").replace(
    /([\\`*_[\]<>])/g,
    "\\$1"
  );
}

function contentToMarkdown(node, depth = 0) {
  if (!node) return "";

  if (node.type === "text") {
    let text = escapeMarkdown(node.text || "");

    for (const mark of node.marks || []) {
      if (mark.type === "bold") text = `**${text}**`;
      if (mark.type === "italic") text = `*${text}*`;
      if (mark.type === "strike") text = `~~${text}~~`;
      if (mark.type === "code") text = `\`${text}\``;
      if (mark.type === "link") {
        text = `[${text}](${mark.attrs?.href || ""})`;
      }
    }

    return text;
  }

  const children = (node.content || [])
    .map((item) => contentToMarkdown(item, depth + 1))
    .join("");

  switch (node.type) {
    case "doc":
      return children.trim();
    case "paragraph":
      return `${children}\n\n`;
    case "heading":
      return `${"#".repeat(node.attrs?.level || 1)} ${children}\n\n`;
    case "blockquote":
      return children
        .trim()
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n") + "\n\n";
    case "bulletList":
    case "orderedList":
    case "taskList":
      return `${children}\n`;
    case "listItem":
      return `- ${children.trim()}\n`;
    case "taskItem":
      return `- [${node.attrs?.checked ? "x" : " "}] ${children.trim()}\n`;
    case "codeBlock":
      return `\`\`\`${node.attrs?.language || ""}\n${children}\n\`\`\`\n\n`;
    case "horizontalRule":
      return "---\n\n";
    case "hardBreak":
      return "  \n";
    case "linkedTask":
      return `- [${node.attrs?.checked ? "x" : " "}] ${
        node.attrs?.title || "关联事项"
      }\n`;
    case "detailsSummary":
      return `**${children.trim()}**\n\n`;
    case "detailsContent":
      return children;
    case "details":
      return children;
    default:
      return children;
  }
}

function safeFilename(value) {
  return (
    String(value || "未命名文档")
      .replace(/[\\/:*?"<>|]/g, "-")
      .trim()
      .slice(0, 80) || "未命名文档"
  );
}

export default {
  name: "FocusDocumentsView",
  components: {
    FocusDocumentPane,
    FocusDocumentModal,
    FocusDocumentTree,
    FocusDirectoryManager,
  },
  emits: ["open-week", "open-task-detail"],
  data() {
    return {
      documents: [],
      openIds: [],
      columns: 3,
      search: "",
      modalDocument: null,
      modalIsNew: false,
      treeVisible: false,
      selectedFolderId: null,
      draggedDocumentId: null,
      emptyDropIndex: null,
    };
  },
  computed: {
    filteredDocuments() {
      const terms = this.search
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);

      if (!terms.length) return this.documents;

      return this.documents.filter((document) => {
        const text = [
          document.title,
          ...(document.tags || []),
          extractText(document.content),
          document.linkedTaskText || "",
        ]
          .join(" ")
          .toLowerCase();

        return terms.every((term) => text.includes(term));
      });
    },

    visiblePickerDocuments() {
      if (!this.selectedFolderId) {
        return this.filteredDocuments;
      }

      if (this.selectedFolderId === "__root__") {
        return this.filteredDocuments.filter(
          (document) => !document.folderId
        );
      }

      return this.filteredDocuments.filter(
        (document) =>
          document.folderId === this.selectedFolderId
      );
    },
  },
  watch: {
    columns(value) {
      localStorage.setItem(
        "focusDocumentColumns",
        String(value)
      );
    },

    openIds: {
      deep: true,
      handler(value) {
        localStorage.setItem(
          "focusDocumentOpenIds",
          JSON.stringify(value)
        );
      },
    },
  },
  async mounted() {
    const savedColumns = Number(
      localStorage.getItem("focusDocumentColumns")
    );

    if (savedColumns >= 1 && savedColumns <= 4) {
      this.columns = savedColumns;
    }

    try {
      const ids = JSON.parse(
        localStorage.getItem("focusDocumentOpenIds") || "[]"
      );
      this.openIds = Array.isArray(ids) ? ids : [];
    } catch {
      this.openIds = [];
    }

    await focusTaskService.initializeTaskIds();
    await this.reload();

    window.addEventListener(
      "weektodo:focus-refresh",
      this.reload
    );
    window.addEventListener("focus", this.reload);
  },
  beforeUnmount() {
    window.removeEventListener(
      "weektodo:focus-refresh",
      this.reload
    );
    window.removeEventListener("focus", this.reload);
  },
  methods: {
    toggleDirectory() {
      this.treeVisible = !this.treeVisible;
    },

    closeDirectory() {
      this.treeVisible = false;

      this.$nextTick(() => {
        this.$refs.directoryButton?.focus();
      });
    },

    openDirectoryDocument({ id, index }) {
      this.selectDocument(id, index);
    },

    createFromDirectory(folderId) {
      this.closeDirectory();
      this.createDocument(folderId);
    },

    clearEmptyDrag(index, event) {
      if (
        this.emptyDropIndex === index &&
        !event.currentTarget.contains(event.relatedTarget)
      ) {
        this.emptyDropIndex = null;
      }
    },

    async dropIntoPane(index, event) {
      this.emptyDropIndex = null;
      await this.dropPane(index, event);
    },

    async reload() {
      const documents =
        await focusDocumentService.listDocuments();

      this.documents = await Promise.all(
        documents.map(async (document) => ({
          ...document,
          linkedTaskText:
            await focusTaskService.getLinkedTaskText(
              document.id
            ),
        }))
      );

      const existing = new Set(
        this.documents.map((item) => item.id)
      );

      this.openIds = this.openIds.filter((id) =>
        existing.has(id)
      );
    },

    documentForPane(index) {
      const id = this.openIds[index];

      return (
        this.documents.find((item) => item.id === id) ||
        null
      );
    },

    selectDocument(id, index) {
      const next = Array.from(
        { length: this.columns },
        (_, paneIndex) =>
          this.openIds[paneIndex] || null
      );

      const sourceIndex = next.indexOf(id);
      const targetId = next[index];

      if (sourceIndex >= 0 && sourceIndex !== index) {
        next[sourceIndex] = targetId || null;
      }

      next[index] = id;

      while (next.length && !next[next.length - 1]) {
        next.pop();
      }

      this.openIds = next;
    },

    openDocumentFromTree(id) {
      this.treeVisible = false;
      if (this.openIds.includes(id)) return;

      const next = [...this.openIds];
      const emptyIndex = Array.from(
        { length: this.columns },
        (_, index) => index
      ).find((index) => !next[index]);

      next[emptyIndex ?? 0] = id;
      this.openIds = next;
    },

    createDocument(folderId = undefined) {
      this.modalIsNew = true;

      const targetFolder =
        folderId === undefined
          ? this.selectedFolderId
          : folderId;

      this.modalDocument =
        focusDocumentService.createDraftRecord(
          targetFolder === "__root__"
            ? null
            : targetFolder || null
        );
    },

    editDocument(id) {
      this.modalIsNew = false;
      this.modalDocument =
        this.documents.find((item) => item.id === id) ||
        null;
    },

    async closeModal(saved) {
      this.modalDocument = null;
      this.modalIsNew = false;

      if (saved?.id) {
        this.replaceDocument(saved);
      } else {
        await this.reload();
      }
    },

    finishModal(saved) {
      this.replaceDocument(saved);
      this.modalDocument = null;
      this.modalIsNew = false;
      this.openDocumentFromTree(saved.id);
    },

    replaceDocument(saved) {
      const index = this.documents.findIndex(
        (item) => item.id === saved.id
      );

      if (index >= 0) {
        this.documents.splice(index, 1, {
          ...this.documents[index],
          ...saved,
        });
      } else {
        this.documents.unshift(saved);
      }
    },

    startPaneDrag(event, id) {
      this.draggedDocumentId = id;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(
        "application/x-weektodo-pane",
        id
      );

      event.currentTarget.classList.add("is-dragging");
    },

    async dropPane(targetIndex, event) {
      const transferredId =
        event?.dataTransfer?.getData(
          "application/x-weektodo-document"
        ) ||
        event?.dataTransfer?.getData(
          "application/x-weektodo-pane"
        );

      const id = transferredId || this.draggedDocumentId;
      this.draggedDocumentId = null;

      document
        .querySelectorAll(".focus-pane.is-dragging")
        .forEach((item) =>
          item.classList.remove("is-dragging")
        );

      if (!id) return;

      const next = Array.from(
        { length: this.columns },
        (_, index) => this.openIds[index] || null
      );

      const sourceIndex = next.indexOf(id);
      const targetId = next[targetIndex];

      if (sourceIndex >= 0 && sourceIndex !== targetIndex) {
        // 已在其他栏：交换两栏。
        next[sourceIndex] = targetId || null;
        next[targetIndex] = id;
      } else {
        // 从目录拖入：替换目标栏。
        next[targetIndex] = id;
      }

      this.openIds = next.filter(
        (item, index) =>
          item || next.slice(index + 1).some(Boolean)
      );

      const remaining = this.documents
        .map((item) => item.id)
        .filter((item) => !this.openIds.includes(item));

      await focusDocumentService.reorderDocuments([
        ...this.openIds.filter(Boolean),
        ...remaining,
      ]);

      await this.reload();
    },

    swapPane(index, step) {
      const target = index + Number(step);

      if (
        target < 0 ||
        target >= this.columns ||
        !this.openIds[index]
      ) {
        return;
      }

      const next = Array.from(
        { length: this.columns },
        (_, itemIndex) => this.openIds[itemIndex] || null
      );

      [next[index], next[target]] = [
        next[target],
        next[index],
      ];

      this.openIds = next;
    },

    async moveDocument({ documentId, folderId }) {
      const saved =
        await focusDocumentService.moveDocument(
          documentId,
          folderId
        );

      this.replaceDocument(saved);
    },

    async releaseFolder(folderId) {
      await focusDocumentService.releaseFolder(folderId);

      if (this.selectedFolderId === folderId) {
        this.selectedFolderId = null;
      }

      await this.reload();
    },

    async handleDocumentAction({ action, document }) {
      if (action === "duplicate") {
        const copy =
          await focusDocumentService.duplicateDocument(
            document.id
          );

        this.replaceDocument(copy);
        this.openDocumentFromTree(copy.id);
        return;
      }

      if (action === "move") {
        const folders = focusFolderService.listFolders();
        const lines = [
          "0. 未分类",
          ...folders.map(
            (folder, index) =>
              `${index + 1}. ${folder.name}`
          ),
        ];

        const value = window.prompt(
          `移动到哪个目录？\n\n${lines.join("\n")}`,
          "0"
        );

        if (value === null) return;

        const index = Number(value);
        const folderId =
          index > 0 ? folders[index - 1]?.id : null;

        if (index > 0 && !folderId) {
          window.alert("目录编号无效。");
          return;
        }

        await this.moveDocument({
          documentId: document.id,
          folderId,
        });
        return;
      }

      if (action === "export") {
        const markdown = [
          `# ${document.title || "未命名文档"}`,
          "",
          ...(document.tags?.length
            ? [`标签：${document.tags.join("、")}`, ""]
            : []),
          contentToMarkdown(document.content),
        ].join("\n");

        const blob = new Blob([markdown], {
          type: "text/markdown;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const anchor = window.document.createElement("a");

        anchor.href = url;
        anchor.download = `${safeFilename(
          document.title
        )}.md`;
        anchor.click();

        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return;
      }

      if (action === "delete") {
        if (
          !window.confirm(
            `确定删除“${
              document.title || "未命名文档"
            }”吗？\n该操作会同时解除文档中的事项关联。`
          )
        ) {
          return;
        }

        await focusDocumentService.deleteDocument(
          document.id
        );

        this.openIds = this.openIds.filter(
          (id) => id !== document.id
        );

        await this.reload();
      }
    },

    jumpTask(task) {
      if (!task?.taskId || !task?.listId) {
        window.alert("关联事项不存在或已经被删除。");
        return;
      }

      this.modalDocument = null;
      this.modalIsNew = false;
      this.$emit("open-week", {
        taskId: task.taskId,
        listId: task.listId,
      });
    },

    openTask(task) {
      if (!task?.taskId || !task?.listId) {
        window.alert("关联事项不存在或已经被删除。");
        return;
      }

      this.$emit("open-task-detail", {
        taskId: task.taskId,
        listId: task.listId,
      });
    },

    formatDate(value) {
      if (!value) return "";

      return new Intl.DateTimeFormat("zh-CN", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value));
    },
  },
};
</script>

<style scoped lang="scss">
.focus-workspace {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  padding: 16px;
  background: #f5f7f9;
}

.focus-workspace-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 0 2px 14px;
}

.focus-workspace-header > div:first-child {
  display: flex;
  align-items: baseline;
  gap: 9px;
}

.focus-workspace-header h1 {
  margin: 0;
  color: #272b31;
  font-size: 19px;
  font-weight: 680;
}

.focus-workspace-header > div:first-child span {
  color: #969ca5;
  font-size: 11px;
}

.focus-workspace-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.focus-search {
  display: flex;
  width: 250px;
  height: 34px;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  background: #fff;
}

.focus-search input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: none;
  background: transparent;
  font-size: 12px;
}

.focus-workspace-actions select,
.focus-workspace-actions button {
  height: 34px;
  padding: 0 11px;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  background: #fff;
  color: #505761;
}

.focus-workspace-actions button.active {
  border-color: #9aacec;
  background: #eef2ff;
  color: #4263eb;
}

.focus-workspace-actions button.primary {
  border-color: #4263eb;
  background: #4263eb;
  color: #fff;
}

.focus-workspace-body {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  gap: 10px;
}

.focus-grid {
  display: grid;
  min-width: 0;
  min-height: 0;
  flex: 1;
  grid-template-columns:
    repeat(var(--columns), minmax(290px, 1fr));
  gap: 10px;
  overflow-x: auto;
}

.focus-empty-pane {
  display: grid;
  min-width: 290px;
  place-items: center;
  border: 1px dashed #d6dbe1;
  border-radius: 11px;
  background: rgba(255, 255, 255, 0.58);
}

.focus-empty-pane > div {
  display: flex;
  width: min(290px, calc(100% - 30px));
  max-height: 80%;
  flex-direction: column;
  align-items: center;
  color: #747b85;
}

.empty-icon {
  margin-bottom: 7px;
  color: #a5abb4;
  font-size: 34px;
}

.focus-empty-pane > div > small {
  margin-top: 4px;
  color: #9da3ac;
}

.focus-picker {
  width: 100%;
  max-height: 250px;
  margin: 15px 0 9px;
  overflow-y: auto;
}

.focus-picker button {
  display: flex;
  width: 100%;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 9px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #505761;
  text-align: left;
  cursor: pointer;
}

.focus-picker button:hover {
  background: #edf1f5;
}

.focus-picker button > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.focus-picker em {
  margin-left: 5px;
  color: #a77b15;
  font-size: 9px;
  font-style: normal;
}

.focus-picker small {
  flex: 0 0 auto;
  color: #9ba1aa;
  font-size: 9px;
}

.create-link {
  padding: 7px 12px;
  border: 1px solid #dfe3e8;
  border-radius: 7px;
  background: #fff;
  color: #59616c;
  cursor: pointer;
}

.dark-theme .focus-workspace {
  background: #0f141a;
}

.dark-theme .focus-workspace-header h1 {
  color: #e1e5ea;
}

.dark-theme .focus-search,
.dark-theme .focus-workspace-actions select,
.dark-theme .focus-workspace-actions button:not(.primary) {
  border-color: #343b45;
  background: #161b22;
  color: #d1d6dc;
}

.dark-theme .focus-empty-pane {
  border-color: #353d47;
  background: rgba(22, 27, 34, 0.62);
}

.dark-theme .focus-picker button {
  color: #cbd0d7;
}

.dark-theme .focus-picker button:hover {
  background: #252c35;
}

@media (max-width: 900px) {
  .focus-workspace-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .focus-workspace-actions {
    width: 100%;
    flex-wrap: wrap;
  }

  .focus-search {
    min-width: 220px;
    flex: 1;
  }

  .focus-workspace-body {
    flex-direction: column;
  }

  .focus-workspace-body :deep(.focus-tree) {
    width: 100%;
    max-width: none;
    max-height: 280px;
  }
}

.focus-directory-anchor {
  position: relative;
}

.focus-directory-popover {
  position: absolute !important;
  z-index: 14000;
  top: calc(100% + 8px);
  right: 0;
  width: 300px !important;
  height: min(520px, calc(100vh - 120px));
  box-shadow:
    0 18px 48px rgba(25, 30, 40, 0.16),
    0 3px 10px rgba(25, 30, 40, 0.08);
}

.focus-empty-tree {
  display: flex;
  width: 100% !important;
  height: 100%;
  max-height: none !important;
  align-items: stretch !important;
  flex-direction: column;
}

.focus-empty-heading {
  display: flex;
  min-height: 42px;
  align-items: center;
  justify-content: space-between;
  padding: 0 13px;
  border-bottom: 1px solid #eceff2;
  color: #6f7680;
  font-size: 12px;
  font-weight: 600;
}

.focus-empty-heading button {
  border: 0;
  background: transparent;
  color: #4263eb;
  cursor: pointer;
}

.focus-empty-pane {
  align-items: stretch;
  justify-items: stretch;
  overflow: hidden;
}

.dark-theme .focus-empty-heading {
  border-color: #303740;
}

/*
 * 顶部目录按钮只保留为浮层定位锚点。
 * Teleport 后的目录不参与页面布局。
 */
.focus-directory-anchor {
  display: flex;
  flex: 0 0 auto;
}

.focus-directory-anchor > button {
  width: 34px;
  padding: 0;
  font-size: 15px;
}

.focus-directory-popover {
  z-index: 16000;
  box-sizing: border-box;
  border-radius: 11px;
  filter:
    drop-shadow(0 18px 38px rgba(24, 29, 38, 0.14))
    drop-shadow(0 3px 9px rgba(24, 29, 38, 0.08));
}

.focus-directory-popover :deep(.focus-tree) {
  width: 100%;
  min-width: 0;
  max-width: none;
  max-height: var(--directory-height, 440px);
  border-color: rgba(31, 35, 41, 0.12);
  box-shadow: none;
}

/*
 * 空栏自身就是文档选择界面。
 * 不再在大面板中嵌套第二张卡片。
 */
.focus-empty-pane {
  display: flex;
  min-width: 290px;
  align-items: center;
  justify-content: center;
  border: 1px dashed #d9dde3;
  border-radius: 11px;
  background: rgba(255, 255, 255, 0.46);
  overflow: hidden;
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease,
    box-shadow 0.16s ease;
}

.focus-empty-pane.is-drop-target {
  border-color: #8fa5ee;
  background: rgba(238, 242, 255, 0.78);
  box-shadow:
    inset 0 0 0 2px rgba(66, 99, 235, 0.08);
}

.focus-empty-state {
  display: flex;
  width: min(250px, calc(100% - 38px));
  max-height: calc(100% - 44px);
  flex-direction: column;
  align-items: center;
  color: #656d78;
}

.focus-empty-icon {
  display: grid;
  width: 34px;
  height: 34px;
  margin-bottom: 8px;
  place-items: center;
  border-radius: 10px;
  background: #f0f2f5;
  color: #969da7;
  font-size: 17px;
}

.focus-empty-state > strong {
  color: #555d67;
  font-size: 13px;
  font-weight: 560;
}

.focus-empty-state > small {
  margin: 4px 0 14px;
  color: #a0a6ae;
  font-size: 10px;
  line-height: 1.5;
  text-align: center;
}

.focus-empty-state :deep(.focus-tree-compact) {
  width: 100%;
  max-height: min(270px, 45vh);
}

.focus-empty-create {
  margin-top: 10px;
  padding: 6px 9px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #687181;
  font-size: 11px;
  cursor: pointer;
}

.focus-empty-create:hover {
  background: #eef1f5;
  color: #4263eb;
}

.dark-theme .focus-empty-pane {
  border-color: #343b45;
  background: rgba(22, 27, 34, 0.48);
}

.dark-theme .focus-empty-pane.is-drop-target {
  border-color: #738ce3;
  background: rgba(39, 48, 74, 0.58);
}

.dark-theme .focus-empty-icon {
  background: #252c35;
  color: #9ca5b0;
}

.dark-theme .focus-empty-state > strong {
  color: #c7cdd4;
}

.dark-theme .focus-empty-create:hover {
  background: #252c35;
}

/* 目录入口只显示状态，不再承担浮层定位。 */
.focus-directory-anchor {
  position: static;
}

.focus-directory-anchor > button {
  display: grid;
  width: 34px;
  place-items: center;
  padding: 0;
  font-size: 15px;
}
</style>
