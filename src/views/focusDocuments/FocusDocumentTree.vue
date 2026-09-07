<template>
  <aside class="focus-tree">
    <header v-if="!compact">
      <strong>文档目录</strong>

      <div>
        <button title="新建根目录" @click="createFolder(null)">
          ＋
        </button>
        <button title="关闭目录" @click="$emit('close')">
          ×
        </button>
      </div>
    </header>

    <button
      v-if="!compact"
      class="focus-tree-root"
      :class="{ active: selectedFolderId === null }"
      @click="$emit('select-folder', null)"
      @dragover.prevent
      @drop="dropDocument(null)"
    >
      <span>⌂</span>
      <span>全部文档</span>
      <small>{{ documents.length }}</small>
    </button>

    <div class="focus-tree-scroll">
      <section
        v-for="entry in visibleFolders"
        :key="entry.folder.id"
        class="focus-tree-folder-section"
      >
        <div
          class="focus-tree-folder"
          :class="{
            active: selectedFolderId === entry.folder.id,
          }"
          :style="{ '--depth': entry.depth }"
          @dragover.prevent
          @drop="dropDocument(entry.folder.id)"
        >
          <button
            class="folder-toggle"
            :title="
              entry.folder.collapsed ? '展开目录' : '折叠目录'
            "
            @click.stop="toggleFolder(entry.folder.id)"
          >
            {{ entry.folder.collapsed ? "›" : "⌄" }}
          </button>

          <button
            class="folder-name"
            @click="$emit('select-folder', entry.folder.id)"
          >
            <span>▱</span>
            <span>{{ entry.folder.name }}</span>
            <small>{{ countDocuments(entry.folder.id) }}</small>
          </button>

          <button
            v-if="!compact"
            class="folder-more"
            title="目录操作"
            @click.stop="toggleMenu(entry.folder.id)"
          >
            ⋯
          </button>

          <div
            v-if="openMenuId === entry.folder.id"
            class="focus-tree-menu"
          >
            <button @click="createFolder(entry.folder.id)">
              新建子目录
            </button>
            <button @click="renameFolder(entry.folder)">
              重命名
            </button>
            <button
              class="danger"
              @click="deleteFolder(entry.folder)"
            >
              删除目录
            </button>
          </div>
        </div>

        <div
          v-if="!entry.folder.collapsed"
          class="focus-tree-documents"
          :style="{ '--depth': entry.depth }"
        >
          <button
            v-for="document in documentsForFolder(
              entry.folder.id
            )"
            :key="document.id"
            class="focus-tree-document"
            :class="{ open: openIds.includes(document.id) }"
            draggable="true"
            @dragstart="startDocumentDrag($event, document.id)"
            @click="$emit('open-document', document.id)"
          >
            <span>▤</span>
            <span>{{ document.title || "未命名文档" }}</span>
            <em v-if="document.draft">草稿</em>
          </button>
        </div>
      </section>

      <section class="focus-tree-uncategorized">
        <div class="focus-tree-folder static">
          <span class="folder-toggle">⌄</span>
          <button
            class="folder-name"
            @click="$emit('select-folder', '__root__')"
          >
            <span>▱</span>
            <span>未分类</span>
            <small>{{ documentsForFolder(null).length }}</small>
          </button>
        </div>

        <div class="focus-tree-documents">
          <button
            v-for="document in documentsForFolder(null)"
            :key="document.id"
            class="focus-tree-document"
            :class="{ open: openIds.includes(document.id) }"
            draggable="true"
            @dragstart="startDocumentDrag($event, document.id)"
            @click="$emit('open-document', document.id)"
          >
            <span>▤</span>
            <span>{{ document.title || "未命名文档" }}</span>
            <em v-if="document.draft">草稿</em>
          </button>
        </div>
      </section>
    </div>

    <footer v-if="!compact">
      <button @click="$emit('create-document', selectedFolderId)">
        ＋ 新建文档
      </button>
    </footer>
  </aside>
</template>

<script>
import focusFolderService from "../../services/focusFolderService";

export default {
  name: "FocusDocumentTree",
  props: {
    documents: {
      type: Array,
      default: () => [],
    },
    openIds: {
      type: Array,
      default: () => [],
    },
    selectedFolderId: {
      default: null,
    },
    compact: {
      type: Boolean,
      default: false,
    },
  },
  emits: [
    "close",
    "reload",
    "select-folder",
    "open-document",
    "move-document",
    "delete-folder",
    "create-document",
  ],
  data() {
    return {
      folders: [],
      openMenuId: null,
      draggedDocumentId: null,
    };
  },
  computed: {
    visibleFolders() {
      const foldersByParent = new Map();

      this.folders.forEach((folder) => {
        const key = folder.parentId || "__root__";
        const values = foldersByParent.get(key) || [];
        values.push(folder);
        foldersByParent.set(key, values);
      });

      const result = [];
      const walk = (parentId, depth) => {
        const key = parentId || "__root__";
        const children = foldersByParent.get(key) || [];

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
  },
  mounted() {
    this.reloadFolders();
    window.addEventListener(
      "weektodo:focus-folders-changed",
      this.reloadFolders
    );
  },
  beforeUnmount() {
    window.removeEventListener(
      "weektodo:focus-folders-changed",
      this.reloadFolders
    );
  },
  methods: {
    reloadFolders() {
      this.folders = focusFolderService.listFolders();
    },

    documentsForFolder(folderId) {
      return this.documents.filter(
        (document) => (document.folderId || null) === folderId
      );
    },

    countDocuments(folderId) {
      return this.documentsForFolder(folderId).length;
    },

    toggleMenu(id) {
      this.openMenuId = this.openMenuId === id ? null : id;
    },

    createFolder(parentId) {
      const name = window.prompt("目录名称");
      if (!String(name || "").trim()) return;

      focusFolderService.createFolder(name, parentId);
      this.openMenuId = null;
      this.reloadFolders();
    },

    renameFolder(folder) {
      const name = window.prompt("重命名目录", folder.name);
      if (!String(name || "").trim()) return;

      focusFolderService.renameFolder(folder.id, name);
      this.openMenuId = null;
      this.reloadFolders();
    },

    deleteFolder(folder) {
      if (
        !window.confirm(
          `删除目录“${folder.name}”？\n目录中的文档会移动到“未分类”。`
        )
      ) {
        return;
      }

      focusFolderService.deleteFolder(folder.id);
      this.$emit("delete-folder", folder.id);
      this.openMenuId = null;
      this.reloadFolders();
    },

    toggleFolder(id) {
      focusFolderService.toggleFolder(id);
      this.reloadFolders();
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

    dropDocument(folderId) {
      const id = this.draggedDocumentId;
      this.draggedDocumentId = null;

      if (id) {
        this.$emit("move-document", {
          documentId: id,
          folderId,
        });
      }
    },
  },
};
</script>

<style scoped lang="scss">
.focus-tree {
  position: relative;
  display: flex;
  width: 280px;
  min-width: 240px;
  max-width: min(340px, calc(100vw - 32px));
  max-height: min(520px, calc(100vh - 110px));
  min-height: 0;
  flex-direction: column;
  border: 1px solid #e0e4e8;
  border-radius: 11px;
  background: #fff;
  overflow: hidden;
}

.focus-tree > header,
.focus-tree > footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px;
  border-bottom: 1px solid #edf0f2;
}

.focus-tree > footer {
  border-top: 1px solid #edf0f2;
  border-bottom: 0;
}

.focus-tree > header div {
  display: flex;
  gap: 3px;
}

.focus-tree button {
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.focus-tree > header button {
  width: 28px;
  height: 28px;
  border-radius: 6px;
}

.focus-tree > header button:hover {
  background: #eef1f5;
}

.focus-tree-root,
.focus-tree-folder {
  display: flex;
  width: calc(100% - 12px);
  min-height: 34px;
  align-items: center;
  gap: 6px;
  margin: 6px;
  padding: 0 7px;
  border-radius: 7px;
  color: #4d545e;
  text-align: left;
}

.focus-tree-root.active,
.focus-tree-folder.active {
  background: #eef2ff;
  color: #4263eb;
}

.focus-tree-root span:nth-child(2),
.folder-name span:nth-child(2) {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.focus-tree-root small,
.folder-name small {
  color: #9aa0a9;
}

.focus-tree-scroll {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
}

.focus-tree-folder {
  position: relative;
  padding-left: calc(7px + var(--depth, 0) * 14px);
}

.focus-tree-folder.static {
  margin-bottom: 0;
}

.folder-toggle {
  display: grid;
  width: 20px;
  height: 24px;
  flex: 0 0 20px;
  place-items: center;
  color: #8a919b;
}

.folder-name {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 6px;
  text-align: left;
}

.folder-more {
  width: 24px;
  height: 24px;
  border-radius: 5px;
  opacity: 0;
}

.focus-tree-folder:hover .folder-more {
  opacity: 1;
}

.focus-tree-menu {
  position: absolute;
  z-index: 20;
  top: 30px;
  right: 4px;
  display: flex;
  width: 135px;
  flex-direction: column;
  padding: 5px;
  border: 1px solid #e0e4e8;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 10px 28px rgba(20, 25, 34, 0.16);
}

.focus-tree-menu button {
  padding: 7px 9px;
  border-radius: 5px;
  text-align: left;
}

.focus-tree-menu button:hover {
  background: #f0f2f5;
}

.focus-tree-menu button.danger {
  color: #d14343;
}

.focus-tree-documents {
  padding-left: calc(33px + var(--depth, 0) * 14px);
}

.focus-tree-document {
  display: flex;
  width: calc(100% - 8px);
  align-items: center;
  gap: 7px;
  padding: 6px 8px;
  border-radius: 6px;
  color: #626a75;
  text-align: left;
}

.focus-tree-document:hover,
.focus-tree-document.open {
  background: #f2f4f7;
}

.focus-tree-document > span:nth-child(2) {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.focus-tree-document em {
  color: #9b7415;
  font-size: 9px;
  font-style: normal;
}

.focus-tree > footer button {
  width: 100%;
  padding: 7px;
  border-radius: 6px;
  color: #4263eb;
}

.focus-tree > footer button:hover {
  background: #eef2ff;
}

.dark-theme .focus-tree {
  border-color: #303740;
  background: #161b22;
  color: #d7dce2;
}

.dark-theme .focus-tree > header,
.dark-theme .focus-tree > footer {
  border-color: #303740;
}

.dark-theme .focus-tree-root,
.dark-theme .focus-tree-folder,
.dark-theme .focus-tree-document {
  color: #c4cad1;
}

.dark-theme .focus-tree-root.active,
.dark-theme .focus-tree-folder.active {
  background: #27304a;
  color: #93a8ff;
}

.dark-theme .focus-tree-document:hover,
.dark-theme .focus-tree-document.open {
  background: #252c35;
}

.dark-theme .focus-tree-menu {
  border-color: #3a424d;
  background: #1d232b;
}

.focus-tree.focus-tree-compact {
  width: 100%;
  min-width: 0;
  max-width: none;
  max-height: 100%;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.focus-tree.focus-tree-compact .focus-tree-scroll {
  padding: 4px;
}

.focus-tree.focus-tree-compact .focus-tree-folder {
  margin: 2px 4px;
}

.focus-tree.focus-tree-compact .focus-tree-document {
  padding-top: 7px;
  padding-bottom: 7px;
}

/*
 * compact 模式只负责空栏快速选择，不承担目录管理。
 */
.focus-tree.focus-tree-compact {
  width: 100%;
  min-width: 0;
  max-width: none;
  max-height: 270px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: #626a75;
  overflow: hidden;
}

.focus-tree.focus-tree-compact .focus-tree-scroll {
  width: 100%;
  padding: 0;
  overflow-y: auto;
  scrollbar-width: thin;
}

.focus-tree.focus-tree-compact
  .focus-tree-folder-section {
  margin: 0;
}

.focus-tree.focus-tree-compact .focus-tree-folder {
  width: 100%;
  min-height: 28px;
  margin: 0;
  padding-right: 4px;
  padding-left:
    calc(2px + var(--depth, 0) * 12px);
  border-radius: 5px;
  color: #7b838d;
  font-size: 10px;
}

.focus-tree.focus-tree-compact
  .focus-tree-folder.active {
  background: transparent;
  color: #626b77;
}

.focus-tree.focus-tree-compact .folder-toggle {
  width: 18px;
  height: 22px;
  flex-basis: 18px;
}

.focus-tree.focus-tree-compact .folder-name {
  gap: 5px;
}

.focus-tree.focus-tree-compact .folder-name small {
  font-size: 9px;
  opacity: 0.72;
}

.focus-tree.focus-tree-compact
  .focus-tree-documents {
  padding-left:
    calc(21px + var(--depth, 0) * 12px);
}

.focus-tree.focus-tree-compact
  .focus-tree-document {
  width: 100%;
  min-height: 28px;
  gap: 6px;
  padding: 5px 6px;
  border-radius: 5px;
  color: #626a75;
  font-size: 11px;
}

.focus-tree.focus-tree-compact
  .focus-tree-document:hover {
  background: #eef1f5;
  color: #343a42;
}

.focus-tree.focus-tree-compact
  .focus-tree-document.open {
  background: transparent;
  color: #a0a6ae;
}

.focus-tree.focus-tree-compact
  .focus-tree-document.open:hover {
  background: #eef1f5;
  color: #626a75;
}

.dark-theme
  .focus-tree.focus-tree-compact
  .focus-tree-folder.active {
  background: transparent;
  color: #adb5bf;
}

.dark-theme
  .focus-tree.focus-tree-compact
  .focus-tree-document.open {
  background: transparent;
  color: #737d88;
}
</style>
