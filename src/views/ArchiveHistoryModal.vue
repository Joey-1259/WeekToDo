<template>
  <div v-if="visible" class="archive-history-mask" @click.self="close">
    <div class="archive-history-panel">
      <div class="archive-header d-flex align-items-center">
        <i class="bi-archive archive-header-icon"></i>
        <h5 class="mb-0 ms-2">{{ $t("ui.archiveHistoryTitle") }}</h5>
        <i class="bi-x close-icon ms-auto" @click="close"></i>
      </div>

      <div class="archive-body">
        <div v-if="!groupedItems.length" class="empty-hint">
          {{ $t("ui.archiveEmpty") }}
        </div>
        <div v-for="group in groupedItems" :key="group.dateLabel" class="archive-group">
          <div class="archive-group-header d-flex align-items-center">
            <span class="group-date">{{ group.dateLabel }}</span>
            <span class="group-list-name">{{ group.listName }}</span>
            <span class="group-count">{{ group.items.length }} {{ $t("ui.archiveItemUnit") }}</span>
          </div>
          <div
            v-for="(item, idx) in group.items"
            :key="idx"
            class="archive-item d-flex align-items-center"
          >
            <span
              v-if="item.color && item.color !== 'none'"
              class="bi-check-circle-fill item-circle"
              :style="{ color: item.color }"
            ></span>
            <span v-else class="bi-check-circle-fill item-circle default-circle"></span>
            <span class="item-text">{{ item.text }}</span>
            <span v-if="item.time" class="item-time">{{ item.time }}</span>
          </div>
        </div>
      </div>

      <div class="archive-footer d-flex">
        <button
          v-if="groupedItems.length"
          type="button"
          class="btn btn-outline-danger btn-sm"
          @click="clearAll"
        >
          {{ $t("ui.archiveClearAll") }}
        </button>
        <button type="button" class="btn btn-outline-secondary btn-sm ms-auto" @click="close">
          {{ $t("ui.cancel") }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import archiveRepository from "../repositories/archiveRepository";
import moment from "moment";

export default {
  name: "ArchiveHistoryModal",
  props: {
    visible: { type: Boolean, default: false },
  },
  emits: ["close"],
  data() {
    return {
      items: [],
    };
  },
  watch: {
    visible(val) {
      if (val) {
        this.items = archiveRepository.load();
      }
    },
  },
  methods: {
    close() {
      this.$emit("close");
    },
    clearAll() {
      if (confirm(this.$t("ui.archiveClearConfirm"))) {
        archiveRepository.clear();
        this.items = [];
      }
    },
  },
  computed: {
    groupedItems() {
      // 按归档日期（天级） + 来源列表名 分组，倒序排列（最近的在最前）
      let map = {};
      this.items.forEach((item) => {
        let dayKey = moment(item.archivedAt).format("YYYY-MM-DD");
        let groupKey = dayKey + "|" + (item.sourceListName || "");
        if (!map[groupKey]) {
          map[groupKey] = {
            dateLabel: moment(item.archivedAt).format("YYYY-MM-DD HH:mm"),
            dateSortKey: item.archivedAt,
            listName: item.sourceListName || "",
            items: [],
          };
        }
        map[groupKey].items.push(item);
      });
      let groups = Object.values(map);
      groups.sort((a, b) => (a.dateSortKey > b.dateSortKey ? -1 : 1));
      return groups;
    },
  },
};
</script>

<style scoped lang="scss">
.archive-history-mask {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(2px);
  z-index: 1050;
  display: flex;
  align-items: center;
  justify-content: center;
}

.archive-history-panel {
  width: 480px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  background-color: white;
  border-radius: 14px;
  padding: 20px 22px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);

  .dark-theme & {
    background-color: #21262d;
    color: #c9d1d9;
  }
}

.archive-header {
  margin-bottom: 14px;

  .archive-header-icon {
    font-size: 1.1rem;
    color: #9aa0a8;
  }

  h5 {
    font-weight: 600;
    font-size: 1rem;
  }

  .close-icon {
    font-size: 1.3rem;
    cursor: pointer;
    padding: 4px;

    &:hover {
      opacity: 0.7;
    }
  }
}

.archive-body {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.empty-hint {
  color: #b0b3b8;
  font-size: 0.85rem;
  text-align: center;
  padding: 40px 0;
}

.archive-group {
  margin-bottom: 16px;
}

.archive-group-header {
  gap: 8px;
  margin-bottom: 6px;
  padding-bottom: 4px;
  border-bottom: 1px solid #eaecef;

  .dark-theme & {
    border-bottom-color: #30363d;
  }
}

.group-date {
  font-size: 0.78rem;
  color: #8a8f98;
  font-weight: 500;
}

.group-list-name {
  font-size: 0.75rem;
  color: #4263eb;
  background-color: #eef1ff;
  padding: 1px 8px;
  border-radius: 10px;

  .dark-theme & {
    color: #6c8fff;
    background-color: #1c2333;
  }
}

.group-count {
  font-size: 0.72rem;
  color: #b0b3b8;
  margin-left: auto;
}

.archive-item {
  padding: 5px 4px;
  border-radius: 4px;

  &:hover {
    background-color: #f8f9fb;

    .dark-theme & {
      background-color: #1a1e24;
    }
  }
}

.item-circle {
  font-size: 10px;
  margin-right: 8px;
  flex-shrink: 0;
}

.default-circle {
  color: #16a34a;

  .dark-theme & {
    color: #4ade80;
  }
}

.item-text {
  font-size: 0.84rem;
  flex: 1;
  word-break: break-word;
  color: #6b7078;

  .dark-theme & {
    color: #9aa0a8;
  }
}

.item-time {
  font-size: 0.75rem;
  color: #b0b3b8;
  margin-left: 8px;
  white-space: nowrap;
}

.archive-footer {
  margin-top: 14px;
  gap: 8px;
}
</style>
