<template>
  <main class="focus-workspace">
    <header class="focus-workspace-header">
      <div class="focus-workspace-heading">
        <h1>重点事项</h1>
        <span>
          {{ documents.length }} 篇文档 ·
          {{ layout.columns.length }} 栏 ·
          第 {{ layout.page + 1 }} / {{ pageCount }} 版面
        </span>
      </div>

      <div class="focus-workspace-actions">
        <div class="focus-search-anchor">
          <label class="focus-search">
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <circle cx="8.5" cy="8.5" r="5.5" />
              <path d="m13 13 4 4" />
            </svg>
            <input
              v-model.trim="search"
              type="text"
              placeholder="查找文档，回车在新分栏中打开"
              @focus="searchOpen = true"
              @keydown.esc.stop.prevent="closeSearch"
              @keydown.enter.prevent="openFirstSearchResult"
            />
          </label>

          <div
            v-if="searchOpen && search && searchResults.length"
            class="focus-search-results"
          >
            <button
              v-for="row in searchResults"
              :key="row.id"
              type="button"
              @click="openFromSearch(row.id)"
            >
              <strong>{{ row.title || "未命名文档" }}</strong>
              <small>{{ row.path }}</small>
            </button>
          </div>

          <div
            v-else-if="searchOpen && search"
            class="focus-search-results is-empty"
          >
            没有匹配的文档
          </div>
        </div>

        <div class="focus-directory-anchor">
          <button
            ref="directoryButton"
            type="button"
            class="focus-icon-button"
            :class="{ active: treeVisible }"
            :aria-expanded="String(treeVisible)"
            aria-haspopup="dialog"
            title="管理文档目录"
            @click.stop="toggleDirectory"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M3 5h5l1.5 2H17v8H3Z" />
            </svg>
          </button>

          <Teleport to="body">
            <FocusDirectoryManager
              v-if="treeVisible"
              :documents="documents"
              :open-ids="openIds"
              :columns="layout.pageSize"
              @close="closeDirectory"
              @changed="reload"
              @open-in-pane="openDirectoryDocument"
              @create-document="createFromDirectory"
            />
          </Teleport>
        </div>

        <div
          class="focus-pagesize"
          role="group"
          aria-label="每个版面的分栏数量"
        >
          <button
            v-for="size in pageSizeOptions"
            :key="size"
            type="button"
            :class="{ active: layout.pageSize === size }"
            :title="`每个版面显示 ${size} 栏`"
            :aria-pressed="String(layout.pageSize === size)"
            @click="setPageSize(size)"
          >
            <i
              v-for="bar in size"
              :key="bar"
              aria-hidden="true"
            ></i>
          </button>
        </div>

        <button
          type="button"
          class="focus-icon-button"
          title="均分所有分栏宽度"
          :disabled="layout.columns.length < 2"
          @click="equalizeColumns"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M10 3v14M4 7 1.5 10 4 13M16 7l2.5 3-2.5 3" />
          </svg>
        </button>

        <button
          type="button"
          class="primary"
          @click="createDocument()"
        >
          + 新建文档
        </button>
      </div>
    </header>

    <FocusColumnBoard
      :layout="layout"
      :documents="documents"
      :folders="folders"
      :folder-paths="folderPaths"
      @update:layout="applyLayout"
      @create-document="createDocumentAt"
      @saved="replaceDocument"
      @expand="editDocument"
      @action="handleDocumentAction"
      @open-task="openTask"
      @jump-task="jumpTask"
      @create-task="createLinkedTask"
    />

    <FocusDocumentDialog
      v-if="dialogDocument"
      :document="dialogDocument"
      :folder-paths="folderPaths"
      @close="closeDialog"
      @saved="replaceDocument"
      @open-task="openTask"
      @jump-task="jumpTask"
      @create-task="createLinkedTask"
    />

    <div
      v-if="moveDialogDocument"
      class="focus-move-backdrop"
      role="presentation"
      @mousedown.self="closeMoveDialog"
    >
      <section
        class="focus-move-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="focus-move-dialog-title"
        @keydown.esc.stop.prevent="closeMoveDialog"
      >
        <header>
          <div>
            <strong id="focus-move-dialog-title">移动到目录</strong>
            <small>
              {{ moveDialogDocument.title || "未命名文档" }}
            </small>
          </div>

          <button
            type="button"
            aria-label="关闭"
            title="关闭"
            :disabled="moveSaving"
            @click="closeMoveDialog"
          >
            &times;
          </button>
        </header>

        <div class="focus-move-dialog-body">
          <FocusFolderPicker
            ref="moveFolderPicker"
            v-model="moveFolderId"
            :folders="moveFolders"
            :current-folder-id="moveDialogDocument.folderId"
          />

          <p class="focus-move-dialog-hint">
            文档内容和关联事项不会改变，仅调整目录归属。
          </p>
        </div>

        <footer>
          <button
            type="button"
            :disabled="moveSaving"
            @click="closeMoveDialog"
          >
            取消
          </button>

          <button
            type="button"
            class="primary"
            :disabled="moveSaving || !moveDialogDirty"
            @click="confirmMoveDocument"
          >
            {{ moveSaving ? "移动中…" : "确认移动" }}
          </button>
        </footer>
      </section>
    </div>
  </main>
</template>

<script>
/* FOCUS_COLUMN_PAGES_20260909_V3 */
import FocusColumnBoard from "./FocusColumnBoard.vue";
import FocusDocumentDialog from "./FocusDocumentDialog.vue";
import FocusDirectoryManager from "./FocusDirectoryManager.vue";
import FocusFolderPicker from "./FocusFolderPicker.vue";
import focusDocumentService from "../../services/focusDocumentService";
import focusFolderService from "../../services/focusFolderService";
import focusLayoutService from "../../services/focusLayoutService";
import focusTaskService from "../../services/focusTaskService";

function extractText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(extractText).join(" ");

  return [
    value.text || "",
    (value.attrs && value.attrs.title) || "",
    extractText(value.content),
  ].join(" ");
}

function escapeMarkdown(value) {
  return String(value || "").replace(/([\\`*_[\]<>])/g, "\\$1");
}

function contentToMarkdown(node) {
  if (!node) return "";

  if (node.type === "text") {
    let text = escapeMarkdown(node.text || "");

    (node.marks || []).forEach((mark) => {
      if (mark.type === "bold") text = "**" + text + "**";
      if (mark.type === "italic") text = "*" + text + "*";
      if (mark.type === "strike") text = "~~" + text + "~~";
      if (mark.type === "code") text = "`" + text + "`";
      if (mark.type === "link") {
        text =
          "[" +
          text +
          "](" +
          ((mark.attrs && mark.attrs.href) || "") +
          ")";
      }
    });

    return text;
  }

  const children = (node.content || [])
    .map((item) => contentToMarkdown(item))
    .join("");

  const level = (node.attrs && node.attrs.level) || 1;
  const checked = node.attrs && node.attrs.checked;

  switch (node.type) {
    case "doc":
      return children.trim();
    case "paragraph":
      return children + "\n\n";
    case "heading":
      return "#".repeat(level) + " " + children + "\n\n";
    case "blockquote":
      return (
        children
          .trim()
          .split("\n")
          .map((line) => "> " + line)
          .join("\n") + "\n\n"
      );
    case "bulletList":
    case "orderedList":
    case "taskList":
      return children + "\n";
    case "listItem":
      return "- " + children.trim() + "\n";
    case "taskItem":
      return (
        "- [" + (checked ? "x" : " ") + "] " + children.trim() + "\n"
      );
    case "codeBlock":
      return (
        "```" +
        ((node.attrs && node.attrs.language) || "") +
        "\n" +
        children +
        "\n```\n\n"
      );
    case "horizontalRule":
      return "---\n\n";
    case "hardBreak":
      return "  \n";
    case "linkedTask":
      return (
        "- [" +
        (checked ? "x" : " ") +
        "] " +
        ((node.attrs && node.attrs.title) || "关联事项") +
        "\n"
      );
    case "detailsSummary":
      return "**" + children.trim() + "**\n\n";
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
    FocusColumnBoard,
    FocusDocumentDialog,
    FocusDirectoryManager,
    FocusFolderPicker,
  },

  emits: ["open-week", "open-task-detail"],

  data() {
    return {
      documents: [],
      layout: focusLayoutService.empty(),
      folders: [],
      search: "",
      searchOpen: false,
      dialogDocument: null,
      treeVisible: false,
      selectedFolderId: null,
      moveDialogDocument: null,
      moveFolderId: "__root__",
      moveFolders: [],
      moveSaving: false,
      pageSizeOptions: [1, 2, 3],
    };
  },

  computed: {
    openIds() {
      return (this.layout.columns || []).map(
        (column) => column.documentId
      );
    },

    pageCount() {
      return focusLayoutService.pageCount(this.layout);
    },

    moveDialogDirty() {
      if (!this.moveDialogDocument) return false;

      return (
        this.moveFolderId !==
        (this.moveDialogDocument.folderId || "__root__")
      );
    },

    folderPaths() {
      const map = new Map(
        this.folders.map((folder) => [folder.id, folder])
      );
      const paths = {};

      this.folders.forEach((folder) => {
        const names = [];
        const seen = new Set();
        let cursor = folder;

        while (cursor && !seen.has(cursor.id)) {
          seen.add(cursor.id);
          names.unshift(cursor.name);
          cursor = cursor.parentId
            ? map.get(cursor.parentId)
            : null;
        }

        paths[folder.id] = names.join(" / ") || "未分类";
      });

      return paths;
    },

    /**
     * 搜索不再过滤画布（那会让正在对照的分栏凭空消失），
     * 而是作为一个查找器，命中后在新分栏中打开。
     */
    searchResults() {
      const terms = this.search
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);

      if (!terms.length) return [];

      return this.documents
        .filter((document) => {
          const text = [
            document.title,
            ...(document.tags || []),
            extractText(document.content),
            document.linkedTaskText || "",
          ]
            .join(" ")
            .toLowerCase();

          return terms.every((term) => text.includes(term));
        })
        .slice(0, 12)
        .map((document) => ({
          id: document.id,
          title: document.title,
          path: document.folderId
            ? this.folderPaths[document.folderId] || "未分类"
            : "未分类",
        }));
    },
  },

  async mounted() {
    this.folders = focusFolderService.listFolders();
    this.layout = focusLayoutService.load();

    await focusTaskService.initializeTaskIds();
    await this.reload();

    window.addEventListener("weektodo:focus-refresh", this.reload);
    window.addEventListener(
      "weektodo:focus-folders-changed",
      this.reloadFolders
    );
    window.addEventListener("focus", this.reload);
    document.addEventListener("mousedown", this.onGlobalPointerDown);
  },

  beforeUnmount() {
    window.removeEventListener(
      "weektodo:focus-refresh",
      this.reload
    );
    window.removeEventListener(
      "weektodo:focus-folders-changed",
      this.reloadFolders
    );
    window.removeEventListener("focus", this.reload);
    document.removeEventListener(
      "mousedown",
      this.onGlobalPointerDown
    );
  },

  methods: {
    onGlobalPointerDown(event) {
      if (event.target.closest(".focus-search-anchor")) return;

      this.searchOpen = false;
    },

    closeSearch() {
      this.search = "";
      this.searchOpen = false;
    },

    reloadFolders() {
      this.folders = focusFolderService.listFolders();
    },

    applyLayout(next) {
      this.layout = focusLayoutService.save(next);
    },

    setPageSize(size) {
      this.applyLayout(
        focusLayoutService.setPageSize(this.layout, size)
      );
    },

    equalizeColumns() {
      this.applyLayout(focusLayoutService.equalize(this.layout));
    },

    async reload() {
      const documents = await focusDocumentService.listDocuments();

      this.documents = await Promise.all(
        documents.map(async (document) => ({
          ...document,
          linkedTaskText:
            await focusTaskService.getLinkedTaskText(document.id),
        }))
      );

      this.reloadFolders();

      const sanitized = focusLayoutService.sanitize(
        this.layout,
        this.documents.map((item) => item.id)
      );

      if (
        JSON.stringify(sanitized) !== JSON.stringify(this.layout)
      ) {
        this.applyLayout(sanitized);
      }
    },

    toggleDirectory() {
      this.treeVisible = !this.treeVisible;
    },

    closeDirectory() {
      this.treeVisible = false;

      this.$nextTick(() => {
        if (this.$refs.directoryButton) {
          this.$refs.directoryButton.focus();
        }
      });
    },

    openFromSearch(documentId) {
      this.closeSearch();
      this.openAtEnd(documentId);
    },

    openFirstSearchResult() {
      const first = this.searchResults[0];
      if (first) this.openFromSearch(first.id);
    },

    openAtEnd(documentId) {
      const existing = focusLayoutService.indexOfDocument(
        this.layout,
        documentId
      );

      if (existing >= 0) {
        // 已经打开了：直接翻到它所在的版面。
        this.applyLayout(
          focusLayoutService.goToPage(
            this.layout,
            focusLayoutService.pageOfIndex(this.layout, existing)
          )
        );
        return;
      }

      this.applyLayout(
        focusLayoutService.insert(
          this.layout,
          (this.layout.columns || []).length,
          documentId
        )
      );

      focusDocumentService
        .touchDocument(documentId)
        .catch(() => {});
    },

    /** 目录里的"第 N 栏"指当前版面的第 N 个槽位。 */
    openDirectoryDocument(payload) {
      const id = (payload && payload.id) || payload;
      if (!id) return;

      const slot = payload && Number(payload.index);

      if (!Number.isFinite(slot)) {
        this.openAtEnd(id);
        return;
      }

      const absolute =
        focusLayoutService.pageStart(this.layout) + slot;

      this.applyLayout(
        focusLayoutService.replace(this.layout, absolute, id)
      );

      focusDocumentService.touchDocument(id).catch(() => {});
    },

    createFromDirectory(folderId) {
      this.closeDirectory();
      this.createDocument(folderId);
    },

    async createDocument(folderId = undefined) {
      const target =
        folderId === undefined ? this.selectedFolderId : folderId;

      await this.createDocumentAt({
        folderId: target === "__root__" ? null : target || null,
        index: (this.layout.columns || []).length,
        open: true,
      });
    },

    /** 新建即落盘：不再有"草稿丢失"的可能。 */
    async createDocumentAt({
      title = "",
      folderId = null,
      index = null,
      open = false,
    } = {}) {
      try {
        const created = await focusDocumentService.createDocument({
          title,
          folderId,
        });

        this.documents.unshift({
          ...created,
          linkedTaskText: "",
        });

        const position = Number.isFinite(index)
          ? index
          : (this.layout.columns || []).length;

        this.applyLayout(
          focusLayoutService.insert(
            this.layout,
            position,
            created.id
          )
        );

        if (open || !title) {
          this.dialogDocument = created;
        }

        return created;
      } catch (error) {
        console.error(error);
        window.alert("新建文档失败，请重试。");
        return null;
      }
    },

    editDocument(id) {
      this.dialogDocument =
        this.documents.find((item) => item.id === id) || null;
    },

    async closeDialog(saved) {
      this.dialogDocument = null;

      if (saved && saved.id) {
        this.replaceDocument(saved);
      } else {
        await this.reload();
      }
    },

    replaceDocument(saved) {
      if (!saved || !saved.id) return;

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

    openMoveDialog(document) {
      this.moveFolders = focusFolderService.listFolders();
      this.moveDialogDocument = document;
      this.moveFolderId = document.folderId || "__root__";
      this.moveSaving = false;

      this.$nextTick(() => {
        if (this.$refs.moveFolderPicker) {
          this.$refs.moveFolderPicker.focus();
        }
      });
    },

    closeMoveDialog() {
      if (this.moveSaving) return;

      this.moveDialogDocument = null;
      this.moveFolderId = "__root__";
      this.moveFolders = [];
    },

    async confirmMoveDocument() {
      if (!this.moveDialogDocument || this.moveSaving) return;

      this.moveSaving = true;

      try {
        const saved = await focusDocumentService.moveDocument(
          this.moveDialogDocument.id,
          this.moveFolderId === "__root__"
            ? null
            : this.moveFolderId
        );

        this.replaceDocument(saved);
        this.moveDialogDocument = null;
        this.moveFolderId = "__root__";
        this.moveFolders = [];
      } catch (error) {
        console.error(error);
        window.alert("移动文档失败，请重试。");
      } finally {
        this.moveSaving = false;
      }
    },

    async handleDocumentAction({ action, document }) {
      if (action === "duplicate") {
        const copy = await focusDocumentService.duplicateDocument(
          document.id
        );

        this.replaceDocument(copy);
        this.openAtEnd(copy.id);
        return;
      }

      if (action === "move") {
        this.openMoveDialog(document);
        return;
      }

      if (action === "export") {
        const markdown = [
          "# " + (document.title || "未命名文档"),
          "",
        ]
          .concat(
            (document.tags || []).length
              ? ["标签：" + document.tags.join("、"), ""]
              : []
          )
          .concat([contentToMarkdown(document.content)])
          .join("\n");

        const blob = new Blob([markdown], {
          type: "text/markdown;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const anchor = window.document.createElement("a");

        anchor.href = url;
        anchor.download = safeFilename(document.title) + ".md";
        anchor.click();

        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return;
      }

      if (action === "delete") {
        const confirmed = window.confirm(
          "确定删除「" +
            (document.title || "未命名文档") +
            "」吗？\n该操作会同时解除文档中的事项关联。"
        );

        if (!confirmed) return;

        await focusDocumentService.deleteDocument(document.id);

        this.applyLayout(
          focusLayoutService.removeDocument(
            this.layout,
            document.id
          )
        );

        if (
          this.dialogDocument &&
          this.dialogDocument.id === document.id
        ) {
          this.dialogDocument = null;
        }

        await this.reload();
      }
    },

    async createLinkedTask(payload) {
      if (!payload || !payload.documentId) return;

      try {
        const targets = focusTaskService.listTargets();

        const attrs = await focusTaskService.createLinkedTask(
          payload.documentId,
          {
            text: "新建事项",
            desc: "",
            listId: targets[0] && targets[0].listId,
            time: null,
            priority: 0,
            alarm: false,
            reminders: [],
            tags: [],
            color: "none",
            subTaskList: [],
          }
        );

        if (payload.insert) payload.insert(attrs);

        await this.$nextTick();
        this.openTask(attrs);
      } catch (error) {
        console.error(error);
        window.alert("创建关联事项失败，请重试。");
      }
    },

    jumpTask(task) {
      if (!task || !task.taskId || !task.listId) {
        window.alert("关联事项不存在或已经被删除。");
        return;
      }

      this.dialogDocument = null;
      this.$emit("open-week", {
        taskId: task.taskId,
        listId: task.listId,
      });
    },

    openTask(task) {
      if (!task || !task.taskId || !task.listId) {
        window.alert("关联事项不存在或已经被删除。");
        return;
      }

      this.$emit("open-task-detail", {
        taskId: task.taskId,
        listId: task.listId,
      });
    },
  },
};
</script>

<style scoped lang="scss">
.focus-workspace {
  --focus-control-height: 36px;

  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  padding: 16px 18px 18px;
  background: #f5f7f9;
}

.focus-workspace-header {
  display: flex;
  min-height: 48px;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 0 2px 12px;
}

.focus-workspace-heading {
  display: flex;
  align-items: baseline;
  gap: 9px;
}

.focus-workspace-heading h1 {
  margin: 0;
  color: #272b31;
  font-size: 20px;
  font-weight: 680;
  letter-spacing: -0.015em;
}

.focus-workspace-heading span {
  color: #969ca5;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.focus-workspace-actions {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 7px;
}

.focus-search-anchor {
  position: relative;
  flex: 0 1 auto;
}

.focus-search {
  display: flex;
  width: 246px;
  height: var(--focus-control-height);
  box-sizing: border-box;
  align-items: center;
  gap: 7px;
  padding: 0 11px;
  border: 1px solid #dfe3e8;
  border-radius: 9px;
  background: #fff;
  transition: border-color 0.14s ease, box-shadow 0.14s ease;
}

.focus-search:focus-within {
  border-color: #91a5e9;
  box-shadow: 0 0 0 3px rgba(66, 99, 235, 0.09);
}

.focus-search svg {
  width: 14px;
  height: 14px;
  flex: 0 0 14px;
  fill: none;
  stroke: #a2a8b1;
  stroke-width: 1.6;
  stroke-linecap: round;
}

.focus-search input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: none;
  background: transparent;
  font-family: inherit;
  font-size: 12px;
}

.focus-search-results {
  position: absolute;
  z-index: 40;
  top: calc(100% + 6px);
  left: 0;
  width: 306px;
  max-height: 320px;
  padding: 5px;
  border: 1px solid rgba(31, 35, 41, 0.12);
  border-radius: 11px;
  background: #fff;
  box-shadow:
    0 16px 42px rgba(24, 29, 38, 0.16),
    0 2px 8px rgba(24, 29, 38, 0.07);
  overflow-y: auto;
}

.focus-search-results.is-empty {
  padding: 14px;
  color: #a0a6af;
  font-size: 11px;
  text-align: center;
}

.focus-search-results button {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 2px;
  padding: 7px 9px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}

.focus-search-results button:hover {
  background: #eef2ff;
}

.focus-search-results strong {
  overflow: hidden;
  color: #2f343c;
  font-size: 12.5px;
  font-weight: 560;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.focus-search-results small {
  color: #9aa0a9;
  font-size: 10px;
}

.focus-workspace-actions > button,
.focus-directory-anchor > button {
  height: var(--focus-control-height);
  box-sizing: border-box;
  padding: 0 11px;
  border: 1px solid #dfe3e8;
  border-radius: 9px;
  outline: none;
  background: #fff;
  color: #505761;
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
}

.focus-icon-button {
  display: grid;
  width: var(--focus-control-height);
  place-items: center;
  padding: 0 !important;
}

.focus-icon-button svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.focus-workspace-actions button:disabled {
  cursor: default;
  opacity: 0.45;
}

.focus-workspace-actions button.active,
.focus-directory-anchor button.active {
  border-color: #9aacec;
  background: #eef2ff;
  color: #4263eb;
}

.focus-workspace-actions button.primary {
  padding: 0 14px;
  border-color: #4263eb;
  background: #4263eb;
  color: #fff;
  box-shadow: 0 1px 2px rgba(49, 81, 204, 0.18);
  font-weight: 550;
}

.focus-workspace-actions button.primary:hover {
  border-color: #3456d7;
  background: #3456d7;
}

.focus-workspace-actions button:focus-visible {
  box-shadow: 0 0 0 3px rgba(66, 99, 235, 0.13);
}

.focus-directory-anchor {
  display: flex;
  flex: 0 0 auto;
}

/* 版面分栏数：1 / 2 / 3 的图形化分段控件 */
.focus-pagesize {
  display: flex;
  height: var(--focus-control-height);
  box-sizing: border-box;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border: 1px solid #dfe3e8;
  border-radius: 9px;
  background: #fff;
}

.focus-pagesize button {
  display: flex;
  height: 28px;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 0 7px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  transition: background-color 0.14s ease;
}

.focus-pagesize button:hover {
  background: #f2f4f7;
}

.focus-pagesize button.active {
  background: #eef2ff;
}

.focus-pagesize i {
  width: 3px;
  height: 13px;
  border-radius: 1.5px;
  background: #b8bec6;
  transition: background-color 0.14s ease;
}

.focus-pagesize button.active i {
  background: #4263eb;
}

.focus-move-backdrop {
  position: fixed;
  z-index: 21000;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(18, 22, 28, 0.46);
  backdrop-filter: blur(5px);
}

.focus-move-dialog {
  width: min(560px, calc(100vw - 32px));
  border: 1px solid rgba(31, 35, 41, 0.13);
  border-radius: 14px;
  outline: none;
  background: #fff;
  box-shadow:
    0 24px 70px rgba(18, 22, 28, 0.24),
    0 4px 14px rgba(18, 22, 28, 0.08);
  overflow: hidden;
}

.focus-move-dialog > header {
  display: flex;
  min-height: 66px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 13px 16px 12px 18px;
  border-bottom: 1px solid #eceef1;
}

.focus-move-dialog > header > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.focus-move-dialog > header strong {
  color: #282d34;
  font-size: 15px;
  font-weight: 650;
}

.focus-move-dialog > header small {
  overflow: hidden;
  color: #969ca5;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.focus-move-dialog > header button {
  display: grid;
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #747c87;
  font-size: 21px;
  cursor: pointer;
}

.focus-move-dialog > header button:hover {
  background: #eef1f5;
  color: #343a42;
}

.focus-move-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 18px 18px;
}

.focus-move-dialog-hint {
  margin: 0;
  color: #969ca5;
  font-size: 10px;
  line-height: 1.55;
}

.focus-move-dialog > footer {
  display: flex;
  min-height: 58px;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 16px;
  border-top: 1px solid #eceef1;
  background: #fafbfc;
}

.focus-move-dialog > footer button {
  min-width: 76px;
  height: 34px;
  padding: 0 14px;
  border: 1px solid #dfe2e7;
  border-radius: 7px;
  background: #fff;
  color: #505761;
  font-family: inherit;
  cursor: pointer;
}

.focus-move-dialog > footer button.primary {
  border-color: #4263eb;
  background: #4263eb;
  color: #fff;
}

.focus-move-dialog button:disabled {
  cursor: default;
  opacity: 0.55;
}

.dark-theme .focus-workspace {
  background: #0f141a;
}

.dark-theme .focus-workspace-heading h1 {
  color: #e1e5ea;
}

.dark-theme .focus-search,
.dark-theme .focus-pagesize,
.dark-theme .focus-workspace-actions > button:not(.primary),
.dark-theme .focus-directory-anchor > button {
  border-color: #343b45;
  background: #161b22;
  color: #d1d6dc;
}

.dark-theme .focus-search-results {
  border-color: #39414c;
  background: #1d232b;
}

.dark-theme .focus-search-results strong {
  color: #dfe4ea;
}

.dark-theme .focus-search-results button:hover,
.dark-theme .focus-pagesize button:hover {
  background: #28303c;
}

.dark-theme .focus-pagesize button.active {
  background: #223052;
}

.dark-theme .focus-move-dialog {
  border-color: #38414b;
  background: #1d232b;
}

.dark-theme .focus-move-dialog > header,
.dark-theme .focus-move-dialog > footer {
  border-color: #343b45;
}

.dark-theme .focus-move-dialog > header strong {
  color: #e1e5ea;
}

.dark-theme .focus-move-dialog > footer {
  background: #181e25;
}

.dark-theme .focus-move-dialog > footer button {
  border-color: #3a424d;
  background: #20262e;
  color: #d8dde3;
}

@media (max-width: 1000px) {
  .focus-workspace-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .focus-workspace-actions {
    width: 100%;
    flex-wrap: wrap;
  }

  .focus-search {
    width: 100%;
    min-width: 200px;
  }

  .focus-search-anchor {
    flex: 1 1 200px;
  }

  .focus-search-results {
    width: 100%;
  }
}
</style>
