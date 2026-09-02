<template>
  <div class="anniversary-panel d-flex flex-column">
    <div class="panel-header d-flex align-items-center">
      <h6 class="mb-0">{{ $t("calendarHub.anniversaries") }}</h6>
      <button type="button" class="btn btn-sm add-btn ms-auto" @click="$emit('add')">
        <i class="bi-plus-lg"></i> {{ $t("calendarHub.new") }}
      </button>
    </div>

    <div class="filter-tabs d-flex flex-wrap">
      <span
        v-for="tab in visibleTabs"
        :key="tab.key"
        class="filter-tab"
        :class="{ active: activeTab === tab.key }"
        :style="activeTab === tab.key && tab.color ? { color: tab.color, borderBottomColor: tab.color } : {}"
        @click="activeTab = tab.key"
      >{{ tab.label }}</span>
    </div>

    <div class="anniversary-items flex-grow-1">
      <div v-if="!filteredItems.length" class="empty-hint">{{ $t("calendarHub.noAnniversary") }}</div>
      <div
        v-for="entry in filteredItems"
        :key="entry.item.id"
        class="anniversary-row d-flex align-items-center"
        @click="$emit('edit', entry.item)"
      >
        <span class="color-bar" :style="{ backgroundColor: entry.item.color || '#748ffc' }"></span>
        <div class="row-main flex-grow-1">
          <div class="row-name">{{ entry.item.name }}</div>
          <div class="row-sub">{{ entry.subText }}</div>
        </div>
        <div class="row-days" :class="{ 'past-days': entry.result && entry.result.isPast }">
          {{ entry.daysText }}
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import anniversaryHelper from "../../helpers/anniversaryHelper";
import anniversaryTagRepository from "../../repositories/anniversaryTagRepository";
import moment from "moment";

export default {
  name: "anniversaryList",
  props: {
    list: { type: Array, default: () => [] },
  },
  emits: ["add", "edit"],
  data() {
    return {
      activeTab: "all",
      tags: anniversaryTagRepository.load(),
    };
  },
  mounted() {
    this.tags = anniversaryTagRepository.load();
  },
  methods: {
    buildEntry: function (item) {
      let normalized = anniversaryHelper.normalize(item);
      let result = anniversaryHelper.calc(item);
      let subText = "";
      let daysText = "";

      if (normalized.repeat === "none" && result && result.isPast) {
        subText = moment(item.date).format("YYYY-MM-DD");
        daysText = this.$t("calendarHub.daysElapsed", [result.daysElapsed]);
      } else if (result) {
        subText = moment(result.nextDateStr, "YYYYMMDD").format("YYYY-MM-DD");
        if (result.daysLeft === 0) {
          daysText = this.$t("calendarHub.today");
        } else if (result.daysLeft > 0) {
          daysText = this.$t("calendarHub.daysLeft", [result.daysLeft]);
        } else {
          daysText = this.$t("calendarHub.expired");
        }
        if (normalized.repeat === "yearly" && result.age != null) {
          daysText += ` · ${this.$t("calendarHub.ageLabel", [result.age])}`;
        }
      }

      return { item, result, subText, daysText, tagId: item.tagId || "tag_other" };
    },
  },
  computed: {
    allEntries: function () {
      return this.list.map(this.buildEntry);
    },
    // 标签栏只显示：全部 + 当前纪念日列表里实际用到的那些自定义标签，
    // 用户建了但暂时没有任何事项挂在下面的标签不会出现在这里，避免一堆空标签占地方
    visibleTabs: function () {
      let usedTagIds = new Set(this.allEntries.map((e) => e.tagId));
      let tabs = [{ key: "all", label: this.$t("calendarHub.tabAll"), color: null }];
      this.tags.forEach((tag) => {
        if (usedTagIds.has(tag.id)) {
          tabs.push({ key: tag.id, label: tag.name, color: tag.color });
        }
      });
      return tabs;
    },
    filteredItems: function () {
      let entries = this.allEntries;
      if (this.activeTab !== "all") {
        entries = entries.filter((e) => e.tagId === this.activeTab);
      }
      entries.sort((a, b) => {
        let aPast = a.result ? a.result.isPast : false;
        let bPast = b.result ? b.result.isPast : false;
        if (aPast && bPast) return a.result.daysElapsed - b.result.daysElapsed;
        if (aPast) return 1;
        if (bPast) return -1;
        let aLeft = a.result ? a.result.daysLeft : 999999;
        let bLeft = b.result ? b.result.daysLeft : 999999;
        return aLeft - bLeft;
      });
      return entries;
    },
  },
  watch: {
    list: function () {
      // 列表变化后（比如刚新建了一个新标签的纪念日），标签数量可能变化，
      // 如果当前选中的标签因为最后一条数据被删除而不再存在于可见标签中，自动回退到“全部”
      this.$nextTick(() => {
        if (this.activeTab !== "all" && !this.visibleTabs.find((t) => t.key === this.activeTab)) {
          this.activeTab = "all";
        }
      });
    },
  },
};
</script>

<style scoped lang="scss">
.anniversary-panel {
  height: 100%;
}

.panel-header {
  margin-bottom: 10px;

  h6 {
    font-size: 0.95rem;
    font-weight: 600;
  }

  .add-btn {
    border: 1px solid #dcdfe4;
    border-radius: 6px;
    font-size: 0.78rem;
    padding: 3px 10px;

    .dark-theme & {
      border-color: #30363d;
      color: #c9d1d9;
    }
  }
}

.filter-tabs {
  gap: 14px;
  margin-bottom: 10px;
  border-bottom: 1px solid #eaecef;

  .dark-theme & {
    border-bottom-color: #30363d;
  }
}

.filter-tab {
  font-size: 0.82rem;
  color: #8a8f98;
  padding-bottom: 8px;
  cursor: pointer;
  border-bottom: 2px solid transparent;

  &.active {
    color: #4263eb;
    border-bottom-color: #4263eb;
    font-weight: 500;
  }

  .dark-theme & {
    color: #6b7078;

    &.active {
      color: #6c8fff;
      border-bottom-color: #6c8fff;
    }
  }
}

.anniversary-items {
  overflow-y: auto;
}

.empty-hint {
  color: #b0b3b8;
  font-size: 0.85rem;
  text-align: center;
  padding: 30px 0;
}

.anniversary-row {
  padding: 9px 4px;
  cursor: pointer;
  border-radius: 6px;

  &:hover {
    background-color: #f4f5f7;

    .dark-theme & {
      background-color: #1a1e24;
    }
  }
}

.color-bar {
  width: 4px;
  height: 30px;
  border-radius: 2px;
  margin-right: 10px;
  flex-shrink: 0;
}

.row-name {
  font-size: 0.88rem;
  font-weight: 500;
}

.row-sub {
  font-size: 0.72rem;
  color: #9aa0a8;
}

.row-days {
  font-size: 0.8rem;
  color: #4263eb;
  white-space: nowrap;
  margin-left: 8px;

  .dark-theme & {
    color: #6c8fff;
  }

  &.past-days {
    color: #b0b3b8;
  }
}
</style>
