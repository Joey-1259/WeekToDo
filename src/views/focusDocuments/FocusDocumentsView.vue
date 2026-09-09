<template>
  <main class="focus-workspace">
    <header class="focus-workspace-header">
      <!-- FOCUS_UI_SYSTEM_20260909_V4
           删掉"N 篇文档 · N 栏 · 第 x/y 版面"：这是开发期的状态字符串，
           栏数用户在画面上直接数得出来，文档总数与当前视图无关。 -->
      <ModuleHeader icon="bi-journal-richtext" title="重点事项" />

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
            <!-- FOCUS_UI_SYSTEM_20260911_V6
              旧版左右双栏（左目录 / 右该目录下的文档）把层级关系藏了起来，
              而层级正是目录唯一要表达的东西。新版单一树：目录与文档同处
              一棵树，文档就是目录的子节点——Notion / 语雀都是这个形态。

              排序从 ··· 菜单里的"向上 / 向下移动"改为拖拽三段落点：
              上缘=排在它前面，中间=放进它里面，下缘=排在它后面。
              一个手势覆盖三个旧菜单项。

              事件由 focusDirectoryBridge mixin 实现，move-* 事件带
              beforeId / afterId 并真正落地 reorder，不是只移动不排序。 -->
            <FocusDirectoryBrowser
              v-if="treeVisible"
              :folders="folders"
              :documents="documents"
              :open-ids="openIds"
              :selected-folder-id="selectedFolderId"
              @close="closeDirectory"
              @open-document="openDirectoryDocument"
              @select-folder="fdSelectFolder"
              @create-folder="fdCreateFolder"
              @rename-folder="fdRenameFolder"
              @delete-folder="fdDeleteFolder"
              @rename-document="fdRenameDocument"
              @delete-document="fdDeleteDocument"
              @move-document="fdMoveDocument"
              @move-folder="fdMoveFolder"
              @document-action="fdDocumentAction"
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

    <!-- FOCUS_UI_SYSTEM_20260912_V8
      原本这里是一个只能选目录的独立弹窗（FocusFolderPicker），
      与顶部那个完整目录树是两套实现：搜索、折叠、键盘各写一遍。
      同一个心智对象有两个化身，用户每次都要重新学，我们每次改
      交互都要改两处。现在统一为同一棵树的 pick 模式 ——
      差异只在"能做什么"，不在"长什么样、怎么操作"。 -->
    <Teleport to="body">
      <FocusDirectoryBrowser
        v-if="moveDialogDocument"
        mode="pick"
        :folders="folders"
        :documents="documents"
        :pick-document="moveDialogDocument"
        @close="fdClosePicker"
        @pick="fdConfirmPick"
        @create-folder="fdCreateFolder"
        @rename-folder="fdRenameFolder"
        @delete-folder="fdDeleteFolder"
      />
    </Teleport>
  </main>
</template>

<script>
/* FOCUS_COLUMN_PAGES_20260909_V3 */
import FocusColumnBoard from "./FocusColumnBoard.vue";
import FocusDocumentDialog from "./FocusDocumentDialog.vue";
import FocusFolderPicker from "./FocusFolderPicker.vue";
import focusDocumentService from "../../services/focusDocumentService";
import focusFolderService from "../../services/focusFolderService";
import focusLayoutService from "../../services/focusLayoutService";
import focusTaskService from "../../services/focusTaskService";

/* FOCUS_UI_SYSTEM_20260909_V4 */
import ModuleHeader from "../../components/layout/ModuleHeader.vue";

/* FOCUS_UI_SYSTEM_20260912_V7 */
import focusDirectoryBridge from "./focusDirectoryBridge";
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
  /* FOCUS_UI_SYSTEM_20260912_V7：mixin 内部已注册 components。
     V6 这里注入失败且被静默跳过，导致模板里的
     <FocusDirectoryBrowser> 成了未注册组件，
     Vue 只 warn 不报错 → 目录按钮点了没反应。 */
  mixins: [focusDirectoryBridge],

  name: "FocusDocumentsView",

  components: {
    ModuleHeader,
    FocusColumnBoard,
    FocusDocumentDialog,
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

    /* FOCUS_UI_SYSTEM_20260912_V8：统一走 bridge 的 fdOpenPicker。 */
    openMoveDialog(document) {
      this.fdOpenPicker(document);
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
  padding: 16px 24px 18px;
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

/* FOCUS_UI_SYSTEM_20260909_V4
   头部外壳保留，只把内部量值对齐到 ModuleHeader 的 56px 基线。 */
.focus-workspace-header {
  align-items: center;
}

.focus-workspace-header :deep(.module-header) {
  min-height: 56px;
  margin-bottom: 0;
}

/* FOCUS_UI_SYSTEM_20260911_V6
   一、底色统一为白。层次交给 1px 分隔线，而不是灰底色块——
      白底上的浅灰区块会读成"另一个面板"，把一个模块视觉切成两半。

   二、单一基线。看板结构是「rail → 列 → rail → 列 → tail rail」，
      第一列前面也有一条 rail，所以卡片左边界 = 24 + 16 = 40px，
      而头部图标在 24 + 2 = 26px，右侧 tail rail 34px 又让最后一张
      卡片离右边 58px。左差 14、右差 32 且不对称——这就是肉眼看到的
      "右边缺一块"。修法不是微调 padding，而是让头部内缩一个 rail 宽，
      并把 tail rail 统一到 16px（见 FocusColumnBoard 的追加块）。
      于是三者共用同一条 40px 基线。 */
.focus-workspace {
  --focus-gutter: 24px;
  --focus-rail: 16px;

  padding: 14px var(--focus-gutter) 16px;
  background: #ffffff;
}

.focus-workspace-header {
  align-items: center;
  margin-bottom: 12px;
  padding: 0 var(--focus-rail) 10px;
  border-bottom: 1px solid #eef0f3;
}

.focus-workspace-header :deep(.module-header) {
  min-height: 52px;
  margin-bottom: 0;
}

/* 搜索浮层跟着头部内缩，否则它的左边界会比搜索框还靠外。 */
.focus-search-results {
  box-shadow:
    0 14px 38px rgba(24, 29, 38, 0.14),
    0 2px 7px rgba(24, 29, 38, 0.06);
}

.dark-theme .focus-workspace-header {
  border-color: #262d36;
}

/* FOCUS_UI_SYSTEM_20260912_V7
   一、去掉标题下的分隔线。
      加它的初衷是"白底上用线做层次"，但这里头部与看板之间
      已经有 12px 留白 + 卡片自身的边框两重分隔，再加一条
      通栏线就成了第三重，把一个模块视觉切成上下两块。
      Notion / 语雀的顶栏都不画这条线，靠的正是留白本身。

   二、右侧功能区与卡片右边界对齐。
      看板结构是「rail(16) 列 rail(16) 列 … tail rail(16)」，
      所以最后一张卡片的右边界 = gutter(24) + tail rail(16) = 40px。
      头部此前 padding-right 是一个 rail(16)，按钮落在 40px —— 数值
      是对的，但 .primary 按钮有 1px 边框且 box-shadow 外扩，
      视觉重心比几何边界更靠右，看起来就是"顶出去了"。
      这里显式用同一个表达式声明左右内边距，把意图写进代码，
      而不是依赖两处各自算出同一个数。 */
.focus-workspace-header {
  padding: 0 var(--focus-rail) 0;
  border-bottom: 0;
  margin-bottom: 10px;
}

/* 功能区整体右边界 = 卡片右边界。primary 按钮不再有向外的
   投影，避免它比卡片边界更"重"。 */
.focus-workspace-actions {
  margin-right: 0;
}

.focus-workspace-actions button.primary {
  box-shadow: none;
}

.dark-theme .focus-workspace-header {
  border-bottom: 0;
}
</style>
