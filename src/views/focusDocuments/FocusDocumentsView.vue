<template>
  <main class="focus-documents-view">
    <header class="focus-topbar">
      <div class="focus-title">
        <i class="bi-journal-richtext"></i>
        <h5>重点客户 / 项目</h5>
      </div>

      <div class="focus-toolbar">
        <div class="focus-search">
          <i class="bi-search"></i>

          <input
            v-model.trim="searchQuery"
            type="search"
            placeholder="搜索文档"
          />
        </div>

        <select v-model="filterTagId">
          <option value="">全部标签</option>

          <option
            v-for="tag in tags"
            :key="tag.id"
            :value="tag.id"
          >
            {{ tag.name }}
          </option>
        </select>

        <select
          v-model.number="columnCount"
          title="并排显示数量"
          @change="saveLayout"
        >
          <option :value="1">1 列</option>
          <option :value="2">2 列</option>
          <option :value="3">3 列</option>
          <option :value="4">4 列</option>
        </select>

        <button
          type="button"
          class="focus-primary-button"
          @click="createDocument"
        >
          <i class="bi-plus-lg"></i>
          新建文档
        </button>
      </div>
    </header>

    <div
      v-if="loading"
      class="focus-empty-state"
    >
      正在加载重点档案…
    </div>

    <div
      v-else-if="documents.length === 0"
      class="focus-empty-state"
    >
      <i class="bi-journal-plus"></i>
      <h4>建立第一篇重点档案</h4>
      <p>
        集中记录重要客户、项目背景和长期进展。
      </p>

      <button
        type="button"
        class="focus-primary-button"
        @click="createDocument"
      >
        新建第一篇文档
      </button>
    </div>

    <div
      v-else
      class="focus-workspace"
      :style="{ '--focus-columns': columnCount }"
    >
      <div
        v-for="slotIndex in columnCount"
        :key="slotIndex"
        class="focus-workspace-slot"
      >
        <div class="slot-document-picker">
          <select
            :value="openIds[slotIndex - 1] || ''"
            @change="
              selectDocument(
                slotIndex - 1,
                $event.target.value
              )
            "
          >
            <option value="">
              选择文档…
            </option>

            <option
              v-for="document in filteredDocuments"
              :key="document.id"
              :value="document.id"
              :disabled="
                isOpenElsewhere(
                  document.id,
                  slotIndex - 1
                )
              "
            >
              {{ document.title }}
            </option>
          </select>
        </div>

        <focus-document-pane
          v-if="documentForSlot(slotIndex - 1)"
          :key="
            documentForSlot(slotIndex - 1).id
          "
          :document-data="
            documentForSlot(slotIndex - 1)
          "
          :tags="tags"
          @save-title="
            saveTitle(
              documentForSlot(slotIndex - 1),
              $event
            )
          "
          @save-content="
            saveContent(
              documentForSlot(slotIndex - 1),
              $event
            )
          "
          @add-tag="
            addTag(
              documentForSlot(slotIndex - 1),
              $event
            )
          "
          @remove-tag="
            removeTag(
              documentForSlot(slotIndex - 1),
              $event
            )
          "
          @create-tag="
            createTag(
              documentForSlot(slotIndex - 1)
            )
          "
          @archive="archiveDocument"
        />

        <div
          v-else
          class="empty-document-slot"
        >
          <i class="bi-file-earmark-text"></i>
          <span>选择一篇文档</span>

          <button
            type="button"
            @click="createDocument(slotIndex - 1)"
          >
            ＋ 新建文档
          </button>
        </div>
      </div>
    </div>
  </main>
</template>

<script>
import configRepository from "../../repositories/configRepository";
import focusDocumentService from "../../services/focusDocumentService";
import FocusDocumentPane from "./FocusDocumentPane.vue";

export default {
  name: "FocusDocumentsView",

  components: {
    FocusDocumentPane,
  },

  data() {
    const config =
      configRepository.load() || {};

    return {
      loading: true,
      documents: [],
      tags: [],
      searchQuery: "",
      filterTagId: "",
      columnCount: Math.min(
        4,
        Math.max(
          1,
          Number(
            config.focusDocumentColumns || 3
          )
        )
      ),
      openIds: Array.isArray(
        config.focusDocumentOpenIds
      )
        ? [
            ...config.focusDocumentOpenIds,
            null,
            null,
            null,
            null,
          ].slice(0, 4)
        : [null, null, null, null],
    };
  },

  computed: {
    filteredDocuments() {
      const query =
        this.searchQuery.toLocaleLowerCase();

      return this.documents.filter(
        (document) => {
          if (
            this.filterTagId &&
            !(document.tagIds || []).includes(
              this.filterTagId
            )
          ) {
            return false;
          }

          if (!query) {
            return true;
          }

          const tagText = this.tags
            .filter((tag) =>
              (document.tagIds || []).includes(
                tag.id
              )
            )
            .map((tag) => tag.name)
            .join(" ");

          const haystack = [
            document.title,
            document.plainText,
            tagText,
          ]
            .join(" ")
            .toLocaleLowerCase();

          return haystack.includes(query);
        }
      );
    },
  },

  async mounted() {
    await this.reload();
  },

  methods: {
    async reload() {
      this.loading = true;

      try {
        const [documents, tags] =
          await Promise.all([
            focusDocumentService.listDocuments(),
            focusDocumentService.listTags(),
          ]);

        this.documents = documents;
        this.tags = tags;

        const validIds = new Set(
          documents.map(
            (document) => document.id
          )
        );

        this.openIds = this.openIds.map(
          (id) =>
            id && validIds.has(id)
              ? id
              : null
        );

        if (
          documents.length &&
          !this.openIds.some(Boolean)
        ) {
          documents
            .slice(0, this.columnCount)
            .forEach((document, index) => {
              this.openIds[index] =
                document.id;
            });
        }

        this.saveLayout();
      } finally {
        this.loading = false;
      }
    },

    documentForSlot(index) {
      const id = this.openIds[index];

      return (
        this.documents.find(
          (document) =>
            document.id === id
        ) || null
      );
    },

    isOpenElsewhere(id, currentIndex) {
      return this.openIds.some(
        (openId, index) =>
          index !== currentIndex &&
          openId === id
      );
    },

    selectDocument(index, id) {
      this.openIds[index] = id || null;
      this.openIds = [...this.openIds];
      this.saveLayout();

      if (id) {
        focusDocumentService
          .touchDocument(id)
          .catch(console.error);
      }
    },

    saveLayout() {
      const config =
        configRepository.load() || {};

      config.focusDocumentColumns =
        this.columnCount;

      config.focusDocumentOpenIds =
        this.openIds.slice(0, 4);

      configRepository.update(config);
    },

    async createDocument(preferredSlot = null) {
      const document =
        await focusDocumentService.createDocument();

      this.documents.unshift(document);

      let slot = Number.isInteger(preferredSlot)
        ? preferredSlot
        : this.openIds
            .slice(0, this.columnCount)
            .findIndex((id) => !id);

      if (slot < 0) {
        slot = 0;
      }

      this.openIds[slot] = document.id;
      this.openIds = [...this.openIds];
      this.saveLayout();
    },

    replaceDocument(updated) {
      const index = this.documents.findIndex(
        (document) =>
          document.id === updated.id
      );

      if (index >= 0) {
        this.documents.splice(
          index,
          1,
          updated
        );

        this.documents = [...this.documents];
      }
    },

    async saveTitle(document, title) {
      const updated =
        await focusDocumentService.updateDocument(
          document.id,
          { title }
        );

      this.replaceDocument(updated);
    },

    async saveContent(document, payload) {
      const updated =
        await focusDocumentService.updateDocument(
          document.id,
          payload
        );

      this.replaceDocument(updated);
    },

    async addTag(document, tagId) {
      const tagIds = Array.from(
        new Set([
          ...(document.tagIds || []),
          tagId,
        ])
      );

      const updated =
        await focusDocumentService.updateDocument(
          document.id,
          { tagIds }
        );

      this.replaceDocument(updated);
    },

    async removeTag(document, tagId) {
      const tagIds = (
        document.tagIds || []
      ).filter((id) => id !== tagId);

      const updated =
        await focusDocumentService.updateDocument(
          document.id,
          { tagIds }
        );

      this.replaceDocument(updated);
    },

    async createTag(document) {
      const name = window.prompt("标签名称");

      if (!name) {
        return;
      }

      try {
        const tag =
          await focusDocumentService.createTag(
            name
          );

        if (
          !this.tags.some(
            (item) => item.id === tag.id
          )
        ) {
          this.tags.push(tag);
        }

        await this.addTag(document, tag.id);
      } catch (error) {
        window.alert(error.message);
      }
    },

    async archiveDocument(id) {
      if (
        !window.confirm(
          "归档后文档不会被删除，确定继续吗？"
        )
      ) {
        return;
      }

      await focusDocumentService.archiveDocument(id);

      this.documents =
        this.documents.filter(
          (document) =>
            document.id !== id
        );

      this.openIds = this.openIds.map(
        (openId) =>
          openId === id ? null : openId
      );

      this.saveLayout();
    },
  },
};
</script>

<style scoped lang="scss">
.focus-documents-view {
  display: flex;
  width: 100%;
  min-width: 0;
  height: 100%;
  flex-direction: column;
  overflow: hidden;
  background: #f6f8fa;
}

.focus-topbar {
  display: flex;
  min-height: 58px;
  padding: 9px 16px;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e2e6ea;
  background: #fff;
  gap: 14px;
}

.focus-title {
  display: flex;
  align-items: center;
  gap: 9px;
  white-space: nowrap;
}

.focus-title i {
  color: #4263eb;
  font-size: 20px;
}

.focus-title h5 {
  margin: 0;
}

.focus-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.focus-toolbar select,
.focus-search {
  height: 34px;
  border: 1px solid #dfe3e8;
  border-radius: 7px;
  background: #fff;
}

.focus-toolbar select {
  padding: 0 8px;
}

.focus-search {
  display: flex;
  width: 190px;
  padding: 0 9px;
  align-items: center;
  gap: 7px;
}

.focus-search i {
  color: #8c959f;
}

.focus-search input {
  width: 100%;
  border: 0;
  background: transparent;
  outline: none;
}

.focus-primary-button {
  min-height: 34px;
  padding: 0 12px;
  border: 0;
  border-radius: 7px;
  background: #4263eb;
  color: #fff;
}

.focus-workspace {
  display: grid;
  min-width: 0;
  flex: 1;
  padding: 12px;
  overflow-x: auto;
  grid-template-columns:
    repeat(
      var(--focus-columns),
      minmax(360px, 1fr)
    );
  gap: 10px;
}

.focus-workspace-slot {
  display: flex;
  min-width: 360px;
  min-height: 0;
  flex-direction: column;
}

.slot-document-picker {
  padding: 0 1px 7px;
}

.slot-document-picker select {
  width: 100%;
  height: 31px;
  padding: 0 8px;
  border: 1px solid #dfe3e8;
  border-radius: 6px;
  background: #fff;
  color: #57606a;
}

.empty-document-slot,
.focus-empty-state {
  display: flex;
  flex: 1;
  min-height: 250px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  color: #8c959f;
  gap: 8px;
}

.empty-document-slot {
  border: 1px dashed #d0d7de;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.55);
}

.empty-document-slot i,
.focus-empty-state > i {
  font-size: 36px;
}

.empty-document-slot button {
  border: 0;
  background: transparent;
  color: #4263eb;
}

.dark-theme .focus-documents-view {
  background: #0d1117;
}

.dark-theme .focus-topbar {
  border-bottom-color: #30363d;
  background: #161b22;
  color: #c9d1d9;
}

.dark-theme .focus-toolbar select,
.dark-theme .focus-search,
.dark-theme .slot-document-picker select {
  border-color: #30363d;
  background: #1c2128;
  color: #c9d1d9;
}

.dark-theme .focus-search input {
  color: #c9d1d9;
}

.dark-theme .empty-document-slot {
  border-color: #30363d;
  background: rgba(22, 27, 34, 0.65);
}
</style>
