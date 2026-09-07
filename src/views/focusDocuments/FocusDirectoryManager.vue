<template>
  <div
    class="directory-manager-backdrop"
    @mousedown.self="$emit('close')"
  >
    <section
      ref="dialog"
      class="directory-manager"
      role="dialog"
      aria-modal="true"
      aria-labelledby="directory-manager-title"
      tabindex="-1"
    >
      <header class="directory-manager-header">
        <div class="directory-manager-heading">
          <strong id="directory-manager-title">
            文档目录
          </strong>
          <small>
            管理目录、重命名文档，并选择并列显示位置
          </small>
        </div>

        <label class="directory-manager-search">
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="8.5" cy="8.5" r="5.5" />
            <path d="m13 13 4 4" />
          </svg>
          <input
            ref="search"
            v-model.trim="query"
            type="search"
            placeholder="搜索文档"
          />
        </label>

        <button
          type="button"
          class="directory-icon-button"
          title="新建根目录"
          @click="beginCreateFolder(null)"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M2.5 5.5h5l1.4 1.7h8.6v8.3a1.5 1.5 0 0 1-1.5 1.5H4a1.5 1.5 0 0 1-1.5-1.5Z" />
            <path d="M10 9.5v5M7.5 12h5" />
          </svg>
        </button>

        <button
          type="button"
          class="directory-icon-button"
          title="关闭目录"
          @click="$emit('close')"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="m5 5 10 10M15 5 5 15" />
          </svg>
        </button>
      </header>

      <div class="directory-manager-body">
        <aside class="directory-folders">
          <div class="directory-section-label">
            <span>目录</span>
            <button
              type="button"
              title="新建根目录"
              @click="beginCreateFolder(null)"
            >
              ＋
            </button>
          </div>

          <button
            type="button"
            class="directory-folder-row directory-all-row"
            :class="{ active: selectedFolderId === null }"
            @click="selectedFolderId = null"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M3 4.5h5l1.5 2H17v9H3Z" />
            </svg>
            <span>全部文档</span>
            <small>{{ documents.length }}</small>
          </button>

          <div
            v-if="creatingFolder"
            class="directory-inline-editor"
            :style="{
              '--depth': createFolderDepth,
            }"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M3 5h5l1.5 2H17v8H3Z" />
            </svg>
            <input
              ref="newFolderInput"
              v-model="newFolderName"
              maxlength="60"
              placeholder="目录名称"
              @keydown.enter.prevent="commitCreateFolder"
              @keydown.esc.prevent="cancelCreateFolder"
              @blur="commitCreateFolder"
            />
          </div>

          <div class="directory-folder-scroll">
            <div
              v-for="entry in folderRows"
              :key="entry.folder.id"
              class="directory-folder-row"
              :class="{
                active:
                  selectedFolderId === entry.folder.id,
                'is-drop-target':
                  dropFolderId === entry.folder.id,
              }"
              :style="{ '--depth': entry.depth }"
              @dragover.prevent="
                dropFolderId = entry.folder.id
              "
              @dragleave="
                dropFolderId === entry.folder.id &&
                (dropFolderId = null)
              "
              @drop="
                dropDocument(entry.folder.id, $event)
              "
            >
              <button
                type="button"
                class="directory-folder-toggle"
                :title="
                  entry.folder.collapsed
                    ? '展开目录'
                    : '折叠目录'
                "
                @click.stop="toggleFolder(entry.folder)"
              >
                <svg
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                  :class="{
                    collapsed: entry.folder.collapsed,
                  }"
                >
                  <path d="m6.5 8 3.5 4 3.5-4" />
                </svg>
              </button>

              <template
                v-if="editingFolderId === entry.folder.id"
              >
                <input
                  ref="folderNameInput"
                  v-model="folderNameDraft"
                  class="directory-folder-input"
                  maxlength="60"
                  @keydown.enter.prevent="
                    commitFolderRename(entry.folder)
                  "
                  @keydown.esc.prevent="cancelFolderRename"
                  @blur="commitFolderRename(entry.folder)"
                />
              </template>

              <button
                v-else
                type="button"
                class="directory-folder-name"
                @click="
                  selectedFolderId = entry.folder.id
                "
                @dblclick="
                  beginFolderRename(entry.folder)
                "
              >
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M3 5h5l1.5 2H17v8H3Z" />
                </svg>
                <span>{{ entry.folder.name }}</span>
                <small>
                  {{ countDocuments(entry.folder.id) }}
                </small>
              </button>

              <div class="directory-folder-actions">
                <button
                  type="button"
                  title="新建子目录"
                  @click.stop="
                    beginCreateFolder(entry.folder.id)
                  "
                >
                  ＋
                </button>
                <button
                  type="button"
                  title="重命名目录"
                  @click.stop="
                    beginFolderRename(entry.folder)
                  "
                >
                  <svg viewBox="0 0 20 20" aria-hidden="true">
                    <path d="m4 14.5-.5 2 2-.5L15 6.5 13.5 5Z" />
                  </svg>
                </button>
                <button
                  type="button"
                  title="删除目录"
                  @click.stop="deleteFolder(entry.folder)"
                >
                  <svg viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M5 6h10M8 6V4h4v2M6.5 6l.7 10h5.6l.7-10" />
                  </svg>
                </button>
              </div>
            </div>

            <div
              class="directory-folder-row directory-uncategorized"
              :class="{
                active: selectedFolderId === '__root__',
                'is-drop-target':
                  dropFolderId === '__root__',
              }"
              @dragover.prevent="dropFolderId = '__root__'"
              @dragleave="
                dropFolderId === '__root__' &&
                (dropFolderId = null)
              "
              @drop="dropDocument(null, $event)"
            >
              <span class="directory-folder-toggle-spacer"></span>
              <button
                type="button"
                class="directory-folder-name"
                @click="selectedFolderId = '__root__'"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M3 5h5l1.5 2H17v8H3Z" />
                </svg>
                <span>未分类</span>
                <small>{{ countDocuments(null) }}</small>
              </button>
            </div>
          </div>
        </aside>

        <main class="directory-documents">
          <header class="directory-documents-header">
            <div>
              <strong>{{ selectedFolderName }}</strong>
              <small>
                {{ visibleDocuments.length }} 篇文档
              </small>
            </div>

            <button
              type="button"
              class="directory-create-document"
              @click="
                $emit(
                  'create-document',
                  normalizedSelectedFolderId
                )
              "
            >
              ＋ 新建文档
            </button>
          </header>

          <div
            v-if="visibleDocuments.length"
            class="directory-document-list"
          >
            <article
              v-for="document in visibleDocuments"
              :key="document.id"
              class="directory-document-row"
              :class="{
                'is-open': openIds.includes(document.id),
              }"
              draggable="true"
              @dragstart="
                startDocumentDrag($event, document.id)
              "
            >
              <span class="directory-document-drag">
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <circle cx="7" cy="6" r="1" />
                  <circle cx="13" cy="6" r="1" />
                  <circle cx="7" cy="10" r="1" />
                  <circle cx="13" cy="10" r="1" />
                  <circle cx="7" cy="14" r="1" />
                  <circle cx="13" cy="14" r="1" />
                </svg>
              </span>

              <svg
                class="directory-document-icon"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path d="M5 2.8h6l4 4V17H5Z" />
                <path d="M11 2.8V7h4M7.5 10h5M7.5 13h5" />
              </svg>

              <div class="directory-document-copy">
                <input
                  v-if="
                    editingDocumentId === document.id
                  "
                  ref="documentNameInput"
                  v-model="documentNameDraft"
                  maxlength="120"
                  @keydown.enter.prevent="
                    commitDocumentRename(document)
                  "
                  @keydown.esc.prevent="
                    cancelDocumentRename
                  "
                  @blur="
                    commitDocumentRename(document)
                  "
                />

                <button
                  v-else
                  type="button"
                  class="directory-document-title"
                  @dblclick="
                    beginDocumentRename(document)
                  "
                  @click="openInFirstAvailable(document.id)"
                >
                  <span>
                    {{ document.title || "未命名文档" }}
                  </span>
                  <small>
                    {{ folderNameFor(document.folderId) }}
                    <em v-if="document.draft">草稿</em>
                  </small>
                </button>
              </div>

              <div class="directory-pane-targets">
                <button
                  v-for="pane in columns"
                  :key="pane"
                  type="button"
                  :class="{
                    active:
                      openIds[pane - 1] === document.id,
                  }"
                  :title="`显示在第 ${pane} 栏`"
                  @click="
                    openInPane(document.id, pane - 1)
                  "
                >
                  {{ pane }}
                </button>
              </div>

              <button
                type="button"
                class="directory-row-action"
                title="重命名文档"
                @click="beginDocumentRename(document)"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="m4 14.5-.5 2 2-.5L15 6.5 13.5 5Z" />
                </svg>
              </button>

              <select
                class="directory-move-select"
                :value="document.folderId || '__root__'"
                title="移动到目录"
                @change="
                  moveDocument(
                    document,
                    $event.target.value
                  )
                "
              >
                <option value="__root__">未分类</option>
                <option
                  v-for="folder in folders"
                  :key="folder.id"
                  :value="folder.id"
                >
                  {{ folder.name }}
                </option>
              </select>

              <div class="directory-more">
                <button
                  type="button"
                  class="directory-row-action"
                  title="更多操作"
                  @click.stop="
                    menuDocumentId =
                      menuDocumentId === document.id
                        ? null
                        : document.id
                  "
                >
                  <svg viewBox="0 0 20 20" aria-hidden="true">
                    <circle cx="5" cy="10" r="1.2" />
                    <circle cx="10" cy="10" r="1.2" />
                    <circle cx="15" cy="10" r="1.2" />
                  </svg>
                </button>

                <div
                  v-if="menuDocumentId === document.id"
                  class="directory-document-menu"
                >
                  <button
                    type="button"
                    @click="duplicateDocument(document)"
                  >
                    <svg viewBox="0 0 20 20" aria-hidden="true">
                      <rect x="6" y="6" width="10" height="10" rx="1.5" />
                      <path d="M4 13H3.5A1.5 1.5 0 0 1 2 11.5v-8A1.5 1.5 0 0 1 3.5 2h8A1.5 1.5 0 0 1 13 3.5V4" />
                    </svg>
                    <span>复制文档</span>
                  </button>

                  <button
                    type="button"
                    @click="exportDocument(document)"
                  >
                    <svg viewBox="0 0 20 20" aria-hidden="true">
                      <path d="M10 2v10M6 8l4 4 4-4M3 15v2h14v-2" />
                    </svg>
                    <span>导出 Markdown</span>
                  </button>

                  <button
                    type="button"
                    class="danger"
                    @click="deleteDocument(document)"
                  >
                    <svg viewBox="0 0 20 20" aria-hidden="true">
                      <path d="M5 6h10M8 6V4h4v2M6.5 6l.7 10h5.6l.7-10" />
                    </svg>
                    <span>删除文档</span>
                  </button>
                </div>
              </div>
            </article>
          </div>

          <div v-else class="directory-empty">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 3.5h8l5 5V21H5Z" />
              <path d="M13 3.5V9h5M8 13h7M8 16h5" />
            </svg>
            <strong>这里还没有文档</strong>
            <small>
              新建文档，或把其他目录中的文档拖到这里
            </small>
          </div>
        </main>
      </div>

      <footer class="directory-manager-footer">
        <span>
          双击名称重命名 · 拖动文档到左侧目录
        </span>
        <kbd>Esc</kbd>
        <span>关闭</span>
      </footer>
    </section>
  </div>
</template>

<script>
import focusFolderService from "../../services/focusFolderService";
import focusDocumentService from "../../services/focusDocumentService";

function extractText(node) {
  if (!node) return "";
  if (typeof node === "string") return node;

  const own = node.text || "";
  const children = Array.isArray(node.content)
    ? node.content.map(extractText).join("")
    : "";

  switch (node.type) {
    case "heading":
      return `${"#".repeat(node.attrs?.level || 1)} ${children}\n\n`;
    case "paragraph":
      return `${children}\n\n`;
    case "bulletList":
    case "orderedList":
    case "taskList":
      return `${children}\n`;
    case "listItem":
      return `- ${children.trim()}\n`;
    case "taskItem":
      return `- [${node.attrs?.checked ? "x" : " "}] ${children.trim()}\n`;
    case "linkedTask":
      return `- [${node.attrs?.checked ? "x" : " "}] ${
        node.attrs?.title || "关联事项"
      }\n`;
    default:
      return own + children;
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
  name: "FocusDirectoryManager",
  props: {
    documents: {
      type: Array,
      default: () => [],
    },
    openIds: {
      type: Array,
      default: () => [],
    },
    columns: {
      type: Number,
      default: 3,
    },
  },
  emits: [
    "close",
    "changed",
    "open-in-pane",
    "create-document",
  ],
  data() {
    return {
      folders: [],
      selectedFolderId: null,
      query: "",
      creatingFolder: false,
      createFolderParentId: null,
      newFolderName: "",
      editingFolderId: null,
      folderNameDraft: "",
      editingDocumentId: null,
      documentNameDraft: "",
      draggedDocumentId: null,
      dropFolderId: null,
      menuDocumentId: null,
    };
  },
  computed: {
    folderRows() {
      const grouped = new Map();

      this.folders.forEach((folder) => {
        const key = folder.parentId || "__root__";
        const rows = grouped.get(key) || [];
        rows.push(folder);
        grouped.set(key, rows);
      });

      const result = [];

      const walk = (parentId, depth) => {
        const children =
          grouped.get(parentId || "__root__") || [];

        children.forEach((folder) => {
          result.push({ folder, depth });

          if (!folder.collapsed) {
            walk(folder.id, depth + 1);
          }
        });
      };

      walk(null, 0);
      return result;
    },

    visibleDocuments() {
      const query = this.query.toLowerCase();

      return this.documents.filter((document) => {
        const folderMatches =
          this.selectedFolderId === null ||
          (this.selectedFolderId === "__root__"
            ? !document.folderId
            : document.folderId === this.selectedFolderId);

        if (!folderMatches) return false;
        if (!query) return true;

        return [
          document.title,
          ...(document.tags || []),
          extractText(document.content),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      });
    },

    selectedFolderName() {
      if (this.selectedFolderId === null) {
        return "全部文档";
      }

      if (this.selectedFolderId === "__root__") {
        return "未分类";
      }

      return (
        this.folders.find(
          (folder) =>
            folder.id === this.selectedFolderId
        )?.name || "文档"
      );
    },

    normalizedSelectedFolderId() {
      if (
        this.selectedFolderId === null ||
        this.selectedFolderId === "__root__"
      ) {
        return null;
      }

      return this.selectedFolderId;
    },

    createFolderDepth() {
      if (!this.createFolderParentId) return 0;

      const row = this.folderRows.find(
        (entry) =>
          entry.folder.id === this.createFolderParentId
      );

      return (row?.depth || 0) + 1;
    },
  },
  mounted() {
    this.reloadFolders();
    window.addEventListener("keydown", this.onKeydown);
    window.addEventListener(
      "weektodo:focus-folders-changed",
      this.reloadFolders
    );

    this.$nextTick(() => {
      this.$refs.search?.focus();
    });
  },
  beforeUnmount() {
    window.removeEventListener("keydown", this.onKeydown);
    window.removeEventListener(
      "weektodo:focus-folders-changed",
      this.reloadFolders
    );
  },
  methods: {
    reloadFolders() {
      this.folders = focusFolderService.listFolders();
    },

    onKeydown(event) {
      if (event.key !== "Escape") return;

      if (this.editingFolderId) {
        this.cancelFolderRename();
        return;
      }

      if (this.editingDocumentId) {
        this.cancelDocumentRename();
        return;
      }

      if (this.creatingFolder) {
        this.cancelCreateFolder();
        return;
      }

      if (this.menuDocumentId) {
        this.menuDocumentId = null;
        return;
      }

      this.$emit("close");
    },

    folderNameFor(folderId) {
      if (!folderId) return "未分类";

      return (
        this.folders.find(
          (folder) => folder.id === folderId
        )?.name || "未分类"
      );
    },

    countDocuments(folderId) {
      return this.documents.filter(
        (document) =>
          (document.folderId || null) === folderId
      ).length;
    },

    toggleFolder(folder) {
      focusFolderService.toggleFolder(folder.id);
      this.reloadFolders();
    },

    beginCreateFolder(parentId) {
      this.createFolderParentId = parentId || null;
      this.newFolderName = "";
      this.creatingFolder = true;

      this.$nextTick(() => {
        this.$refs.newFolderInput?.focus();
      });
    },

    cancelCreateFolder() {
      this.creatingFolder = false;
      this.createFolderParentId = null;
      this.newFolderName = "";
    },

    commitCreateFolder() {
      if (!this.creatingFolder) return;

      const name = this.newFolderName.trim();

      if (!name) {
        this.cancelCreateFolder();
        return;
      }

      const folder = focusFolderService.createFolder(
        name,
        this.createFolderParentId
      );

      this.cancelCreateFolder();
      this.reloadFolders();
      this.selectedFolderId = folder.id;
    },

    beginFolderRename(folder) {
      this.editingFolderId = folder.id;
      this.folderNameDraft = folder.name;

      this.$nextTick(() => {
        const input = Array.isArray(
          this.$refs.folderNameInput
        )
          ? this.$refs.folderNameInput[0]
          : this.$refs.folderNameInput;

        input?.focus();
        input?.select();
      });
    },

    cancelFolderRename() {
      this.editingFolderId = null;
      this.folderNameDraft = "";
    },

    commitFolderRename(folder) {
      if (this.editingFolderId !== folder.id) return;

      const name = this.folderNameDraft.trim();

      if (name && name !== folder.name) {
        focusFolderService.renameFolder(folder.id, name);
      }

      this.cancelFolderRename();
      this.reloadFolders();
    },

    async deleteFolder(folder) {
      if (
        !window.confirm(
          `删除目录“${folder.name}”？\n目录中的文档将移动到“未分类”。`
        )
      ) {
        return;
      }

      const affected = this.documents.filter(
        (document) => document.folderId === folder.id
      );

      await Promise.all(
        affected.map((document) =>
          focusDocumentService.moveDocument(
            document.id,
            null
          )
        )
      );

      focusFolderService.deleteFolder(folder.id);

      if (this.selectedFolderId === folder.id) {
        this.selectedFolderId = "__root__";
      }

      this.reloadFolders();
      this.$emit("changed");
    },

    startDocumentDrag(event, id) {
      this.draggedDocumentId = id;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(
        "application/x-weektodo-document",
        id
      );
      event.dataTransfer.setData("text/plain", id);
    },

    async dropDocument(folderId, event) {
      const documentId =
        event.dataTransfer.getData(
          "application/x-weektodo-document"
        ) ||
        event.dataTransfer.getData("text/plain") ||
        this.draggedDocumentId;

      this.draggedDocumentId = null;
      this.dropFolderId = null;

      if (!documentId) return;

      await focusDocumentService.moveDocument(
        documentId,
        folderId
      );

      this.$emit("changed");
    },

    beginDocumentRename(document) {
      this.editingDocumentId = document.id;
      this.documentNameDraft =
        document.title || "未命名文档";

      this.$nextTick(() => {
        const input = Array.isArray(
          this.$refs.documentNameInput
        )
          ? this.$refs.documentNameInput[0]
          : this.$refs.documentNameInput;

        input?.focus();
        input?.select();
      });
    },

    cancelDocumentRename() {
      this.editingDocumentId = null;
      this.documentNameDraft = "";
    },

    async commitDocumentRename(document) {
      if (this.editingDocumentId !== document.id) return;

      const title = this.documentNameDraft
        .trim()
        .slice(0, 120);

      if (title !== document.title) {
        await focusDocumentService.updateDocument(
          document.id,
          { title }
        );

        this.$emit("changed");
      }

      this.cancelDocumentRename();
    },

    async moveDocument(document, folderValue) {
      const folderId =
        folderValue === "__root__"
          ? null
          : folderValue;

      await focusDocumentService.moveDocument(
        document.id,
        folderId
      );

      this.$emit("changed");
    },

    openInFirstAvailable(documentId) {
      const emptyIndex = Array.from(
        { length: this.columns },
        (_, index) => index
      ).find((index) => !this.openIds[index]);

      this.openInPane(documentId, emptyIndex ?? 0);
    },

    openInPane(documentId, index) {
      this.$emit("open-in-pane", {
        id: documentId,
        index,
      });
    },

    async duplicateDocument(document) {
      const copy =
        await focusDocumentService.duplicateDocument(
          document.id
        );

      this.menuDocumentId = null;
      this.$emit("changed");
      this.openInFirstAvailable(copy.id);
    },

    exportDocument(document) {
      const markdown = [
        `# ${document.title || "未命名文档"}`,
        "",
        extractText(document.content).trim(),
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
      this.menuDocumentId = null;
    },

    async deleteDocument(document) {
      if (
        !window.confirm(
          `确定删除“${
            document.title || "未命名文档"
          }”吗？`
        )
      ) {
        return;
      }

      await focusDocumentService.deleteDocument(
        document.id
      );

      this.menuDocumentId = null;
      this.$emit("changed");
    },
  },
};
</script>

<style scoped lang="scss">
.directory-manager-backdrop {
  position: fixed;
  z-index: 18000;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 28px;
  background: rgba(28, 32, 38, 0.34);
  backdrop-filter: blur(4px);
}

.directory-manager {
  display: flex;
  width: min(940px, calc(100vw - 56px));
  height: min(680px, calc(100vh - 56px));
  min-height: 430px;
  flex-direction: column;
  border: 1px solid rgba(28, 33, 40, 0.12);
  border-radius: 16px;
  outline: none;
  background: #fff;
  box-shadow:
    0 30px 90px rgba(20, 25, 34, 0.22),
    0 4px 14px rgba(20, 25, 34, 0.08);
  color: #2d3239;
  overflow: hidden;
}

.directory-manager svg {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.directory-manager-header {
  display: flex;
  min-height: 66px;
  align-items: center;
  gap: 10px;
  padding: 0 18px 0 22px;
  border-bottom: 1px solid #eceef1;
}

.directory-manager-heading {
  display: flex;
  min-width: 220px;
  flex: 1;
  flex-direction: column;
  gap: 3px;
}

.directory-manager-heading strong {
  font-size: 16px;
  font-weight: 650;
}

.directory-manager-heading small {
  color: #9299a3;
  font-size: 10px;
}

.directory-manager-search {
  display: flex;
  width: min(260px, 30vw);
  height: 34px;
  align-items: center;
  gap: 7px;
  padding: 0 10px;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  background: #f9fafb;
}

.directory-manager-search svg {
  width: 15px;
  height: 15px;
  color: #9299a3;
}

.directory-manager-search input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: none;
  background: transparent;
  color: #343940;
  font-size: 12px;
}

.directory-icon-button {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #69717d;
  cursor: pointer;
}

.directory-icon-button:hover {
  background: #f0f2f5;
  color: #4263eb;
}

.directory-icon-button svg {
  width: 18px;
  height: 18px;
}

.directory-manager-body {
  display: grid;
  min-height: 0;
  flex: 1;
  grid-template-columns: 250px minmax(0, 1fr);
}

.directory-folders {
  display: flex;
  min-height: 0;
  flex-direction: column;
  padding: 12px 9px;
  border-right: 1px solid #eceef1;
  background: #fafbfc;
}

.directory-section-label {
  display: flex;
  height: 28px;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  color: #969da6;
  font-size: 10px;
  font-weight: 600;
}

.directory-section-label button {
  border: 0;
  background: transparent;
  color: #8a929d;
  cursor: pointer;
}

.directory-folder-scroll {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
}

.directory-folder-row {
  position: relative;
  display: flex;
  min-height: 32px;
  align-items: center;
  gap: 3px;
  margin: 1px 0;
  padding:
    0 4px
    0 calc(5px + var(--depth, 0) * 13px);
  border-radius: 7px;
  color: #5e6671;
}

.directory-folder-row:hover,
.directory-folder-row.active {
  background: #eef1f5;
}

.directory-folder-row.active {
  color: #3457c5;
}

.directory-folder-row.is-drop-target {
  background: #e8edff;
  box-shadow: inset 0 0 0 1px #8da2eb;
}

.directory-all-row {
  width: 100%;
  border: 0;
  cursor: pointer;
}

.directory-all-row > svg {
  width: 16px;
  height: 16px;
}

.directory-all-row > span {
  min-width: 0;
  flex: 1;
  text-align: left;
}

.directory-folder-row small {
  color: #9da3ab;
  font-size: 9px;
}

.directory-folder-toggle,
.directory-folder-actions button {
  display: grid;
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #8a929c;
  cursor: pointer;
}

.directory-folder-toggle svg {
  width: 13px;
  height: 13px;
  transition: transform 0.14s ease;
}

.directory-folder-toggle svg.collapsed {
  transform: rotate(-90deg);
}

.directory-folder-toggle-spacer {
  width: 24px;
  flex: 0 0 24px;
}

.directory-folder-name {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.directory-folder-name svg {
  width: 15px;
  height: 15px;
  flex: 0 0 15px;
}

.directory-folder-name span {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.directory-folder-actions {
  display: none;
  align-items: center;
}

.directory-folder-row:hover
  .directory-folder-actions {
  display: flex;
}

.directory-folder-actions svg {
  width: 13px;
  height: 13px;
}

.directory-folder-actions button:hover {
  background: #dfe4ea;
  color: #4263eb;
}

.directory-inline-editor,
.directory-folder-input {
  font-size: 11px;
}

.directory-inline-editor {
  display: flex;
  min-height: 32px;
  align-items: center;
  gap: 6px;
  padding-left:
    calc(33px + var(--depth, 0) * 13px);
}

.directory-inline-editor svg {
  width: 15px;
  height: 15px;
  color: #7e8792;
}

.directory-inline-editor input,
.directory-folder-input {
  min-width: 0;
  flex: 1;
  height: 25px;
  padding: 0 6px;
  border: 1px solid #8097e8;
  border-radius: 5px;
  outline: none;
  background: #fff;
}

.directory-documents {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  background: #fff;
}

.directory-documents-header {
  display: flex;
  min-height: 52px;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px 0 19px;
  border-bottom: 1px solid #eef0f2;
}

.directory-documents-header > div {
  display: flex;
  align-items: baseline;
  gap: 7px;
}

.directory-documents-header strong {
  font-size: 13px;
  font-weight: 620;
}

.directory-documents-header small {
  color: #9aa1aa;
  font-size: 9px;
}

.directory-create-document {
  height: 30px;
  padding: 0 10px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #4263eb;
  font-size: 11px;
  cursor: pointer;
}

.directory-create-document:hover {
  background: #eef2ff;
}

.directory-document-list {
  min-height: 0;
  flex: 1;
  padding: 8px;
  overflow-y: auto;
}

.directory-document-row {
  position: relative;
  display: grid;
  min-height: 48px;
  grid-template-columns:
    18px 22px minmax(120px, 1fr)
    auto 28px minmax(92px, 120px) 30px;
  align-items: center;
  gap: 6px;
  padding: 4px 7px;
  border-radius: 8px;
}

.directory-document-row:hover {
  background: #f5f6f8;
}

.directory-document-row.is-open {
  background: #f1f4ff;
}

.directory-document-drag {
  display: grid;
  place-items: center;
  color: #b0b6be;
  cursor: grab;
  opacity: 0;
}

.directory-document-row:hover
  .directory-document-drag {
  opacity: 1;
}

.directory-document-drag svg,
.directory-document-icon {
  width: 17px;
  height: 17px;
}

.directory-document-icon {
  color: #818b97;
}

.directory-document-copy {
  min-width: 0;
}

.directory-document-copy > input {
  width: 100%;
  height: 29px;
  padding: 0 7px;
  border: 1px solid #8097e8;
  border-radius: 6px;
  outline: none;
}

.directory-document-title {
  display: flex;
  width: 100%;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #343940;
  text-align: left;
  cursor: pointer;
}

.directory-document-title > span {
  overflow: hidden;
  font-size: 12px;
  font-weight: 520;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.directory-document-title small {
  color: #9ba2ab;
  font-size: 9px;
}

.directory-document-title em {
  margin-left: 6px;
  color: #a87c19;
  font-style: normal;
}

.directory-pane-targets {
  display: flex;
  gap: 2px;
}

.directory-pane-targets button {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #89919c;
  font-size: 10px;
  cursor: pointer;
}

.directory-pane-targets button:hover,
.directory-pane-targets button.active {
  background: #e5eaff;
  color: #3457c5;
}

.directory-row-action {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #89919b;
  cursor: pointer;
}

.directory-row-action:hover {
  background: #e8ebef;
  color: #4263eb;
}

.directory-row-action svg {
  width: 15px;
  height: 15px;
}

.directory-move-select {
  min-width: 0;
  height: 28px;
  padding: 0 22px 0 7px;
  border: 1px solid transparent;
  border-radius: 6px;
  outline: none;
  background: transparent;
  color: #7b838d;
  font-size: 10px;
}

.directory-move-select:hover,
.directory-move-select:focus {
  border-color: #dfe3e8;
  background: #fff;
}

.directory-more {
  position: relative;
}

.directory-document-menu {
  position: absolute;
  z-index: 20;
  top: 31px;
  right: 0;
  display: flex;
  width: 172px;
  flex-direction: column;
  padding: 5px;
  border: 1px solid #e0e4e8;
  border-radius: 9px;
  background: #fff;
  box-shadow: 0 14px 36px rgba(20, 25, 34, 0.16);
}

.directory-document-menu button {
  display: flex;
  min-height: 34px;
  align-items: center;
  gap: 9px;
  padding: 0 9px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #4f5762;
  font-size: 11px;
  cursor: pointer;
}

.directory-document-menu button:hover {
  background: #f0f2f5;
}

.directory-document-menu button.danger {
  color: #c84444;
}

.directory-document-menu svg {
  width: 15px;
  height: 15px;
}

.directory-empty {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #9ca3ac;
}

.directory-empty svg {
  width: 34px;
  height: 34px;
  margin-bottom: 10px;
}

.directory-empty strong {
  color: #666e79;
  font-size: 12px;
  font-weight: 560;
}

.directory-empty small {
  margin-top: 5px;
  font-size: 10px;
}

.directory-manager-footer {
  display: flex;
  min-height: 34px;
  align-items: center;
  justify-content: flex-end;
  gap: 5px;
  padding: 0 16px;
  border-top: 1px solid #eceef1;
  background: #fafbfc;
  color: #969da6;
  font-size: 9px;
}

.directory-manager-footer kbd {
  margin-left: 8px;
  padding: 1px 5px;
  border: 1px solid #dfe3e8;
  border-radius: 4px;
  background: #fff;
  font: inherit;
}

.dark-theme .directory-manager {
  border-color: #303740;
  background: #171c23;
  color: #dce1e7;
}

.dark-theme .directory-manager-header,
.dark-theme .directory-documents-header,
.dark-theme .directory-manager-footer {
  border-color: #303740;
}

.dark-theme .directory-folders,
.dark-theme .directory-manager-footer {
  background: #141920;
}

.dark-theme .directory-documents {
  background: #171c23;
}

.dark-theme .directory-manager-search,
.dark-theme .directory-inline-editor input,
.dark-theme .directory-folder-input,
.dark-theme .directory-document-copy > input {
  border-color: #38414b;
  background: #1d232b;
  color: #dce1e7;
}

.dark-theme .directory-folder-row:hover,
.dark-theme .directory-folder-row.active,
.dark-theme .directory-document-row:hover {
  background: #252c35;
}

.dark-theme .directory-document-row.is-open {
  background: #27304a;
}

.dark-theme .directory-document-title {
  color: #d8dde3;
}

.dark-theme .directory-document-menu {
  border-color: #38414b;
  background: #1d232b;
}

.dark-theme .directory-document-menu button {
  color: #d3d8de;
}

.dark-theme .directory-document-menu button:hover {
  background: #29313b;
}

@media (max-width: 760px) {
  .directory-manager-backdrop {
    padding: 12px;
  }

  .directory-manager {
    width: calc(100vw - 24px);
    height: calc(100vh - 24px);
  }

  .directory-manager-heading small {
    display: none;
  }

  .directory-manager-body {
    grid-template-columns: 190px minmax(0, 1fr);
  }

  .directory-move-select {
    display: none;
  }

  .directory-document-row {
    grid-template-columns:
      18px 20px minmax(100px, 1fr)
      auto 28px 30px;
  }
}
</style>
