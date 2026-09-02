<template>
  <div class="upcoming-tile-wrapper">
    <div class="upcoming-header d-flex align-items-center">
      <h6 class="mb-0">{{ $t("calendarHub.recentItems") }}</h6>
      <span class="count-badge ms-2" v-if="items.length">{{ items.length }}</span>
    </div>

    <div v-if="!items.length" class="empty-hint">{{ $t("calendarHub.noUpcomingEvents") }}</div>
    <div v-else class="upcoming-scroll d-flex">
      <div
        v-for="entry in items"
        :key="entry.key"
        class="upcoming-card"
        :style="{ borderTopColor: entry.color }"
        @click="$emit('day-click', entry.startDate)"
      >
        <div class="card-date">{{ formatRange(entry) }}</div>
        <div class="card-name" :title="entry.name">{{ entry.name }}</div>
        <div class="card-days">{{ formatDaysLeft(entry.daysLeft) }}</div>
      </div>
    </div>
    <div v-if="overflowCount > 0" class="overflow-hint">{{ $t("calendarHub.moreItemsHint", [overflowCount]) }}</div>
  </div>
</template>

<script>
import moment from "moment";
import holidayHelper from "../../helpers/holidayHelper";
import anniversaryHelper from "../../helpers/anniversaryHelper";

export default {
  name: "upcomingEventsTile",
  props: {
    anniversaryList: { type: Array, default: () => [] },
    countryCodes: { type: Array, default: () => ["CN"] },
    days: { type: Number, default: 30 },
    maxCategories: { type: Number, default: 5 },
  },
  emits: ["day-click"],
  methods: {
    formatRange: function (entry) {
      if (entry.startDate === entry.endDate) {
        return moment(entry.startDate, "YYYYMMDD").format("MM-DD");
      }
      return `${moment(entry.startDate, "YYYYMMDD").format("MM-DD")} ~ ${moment(entry.endDate, "YYYYMMDD").format("MM-DD")}`;
    },
    formatDaysLeft: function (daysLeft) {
      if (daysLeft === 0) return this.$t("calendarHub.today");
      return this.$t("calendarHub.daysLeft", [daysLeft]);
    },
  },
  computed: {
    mergedList: function () {
      let today = moment().startOf("day");
      let endDate = today.clone().add(this.days, "days");

      // 节假日：按名称把连续日期合并成一个区间（例如中秋节 09-25 ~ 09-27）
      let holidayFlat = holidayHelper
        .getHolidaysBetween(today.format("YYYYMMDD"), endDate.format("YYYYMMDD"), this.countryCodes)
        .filter((h) => h.isOffDay)
        .sort((a, b) => (a.date < b.date ? -1 : 1));

      let holidayGroups = [];
      let lastGroupByName = {};
      holidayFlat.forEach((h) => {
        let g = lastGroupByName[h.name];
        if (g && moment(h.date, "YYYYMMDD").diff(moment(g.endDate, "YYYYMMDD"), "days") === 1) {
          g.endDate = h.date;
        } else {
          g = { name: h.name, startDate: h.date, endDate: h.date, color: "#ed544b", source: "holiday" };
          holidayGroups.push(g);
          lastGroupByName[h.name] = g;
        }
      });

      let holidayEvents = holidayGroups.map((g) => ({
        key: `holiday_${g.name}_${g.startDate}`,
        name: g.name,
        startDate: g.startDate,
        endDate: g.endDate,
        daysLeft: moment(g.startDate, "YYYYMMDD").diff(today, "days"),
        color: g.color,
        source: g.source,
      }));

      let anniversaryEvents = anniversaryHelper.getUpcomingAnniversaries(this.anniversaryList, this.days, today.format("YYYYMMDD")).map((a) => ({
        key: `anniversary_${a.id}_${a.date}`,
        name: a.name,
        startDate: a.date,
        endDate: a.date,
        daysLeft: a.daysLeft,
        color: a.color || "#748ffc",
        source: "anniversary",
      }));

      let merged = holidayEvents.concat(anniversaryEvents);
      merged.sort((a, b) => a.daysLeft - b.daysLeft);
      return merged;
    },
    items: function () {
      return this.mergedList.slice(0, this.maxCategories);
    },
    overflowCount: function () {
      return Math.max(0, this.mergedList.length - this.maxCategories);
    },
  },
};
</script>

<style scoped lang="scss">
.upcoming-tile-wrapper {
  border-top: 1px solid #eaecef;
  padding-top: 12px;
  margin-top: 8px;

  .dark-theme & {
    border-top-color: #30363d;
  }
}

.upcoming-header {
  margin-bottom: 8px;

  h6 {
    font-size: 0.92rem;
    font-weight: 600;
  }

  .count-badge {
    background-color: #eef1ff;
    color: #4263eb;
    font-size: 0.7rem;
    padding: 1px 7px;
    border-radius: 10px;

    .dark-theme & {
      background-color: #1c2333;
      color: #6c8fff;
    }
  }
}

.empty-hint {
  color: #b0b3b8;
  font-size: 0.82rem;
  padding: 14px 0;
}

.upcoming-scroll {
  overflow-x: auto;
  gap: 10px;
  padding-bottom: 6px;
}

.upcoming-card {
  flex: 0 0 128px;
  border-top: 3px solid #748ffc;
  background-color: #f8f9fb;
  border-radius: 8px;
  padding: 8px 10px;
  cursor: pointer;
  transition: transform 0.15s ease-out;

  &:hover {
    transform: translateY(-2px);
  }

  .dark-theme & {
    background-color: #1a1e24;
  }
}

.card-date {
  font-size: 0.68rem;
  color: #9aa0a8;
  margin-bottom: 3px;
}

.card-name {
  font-size: 0.82rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 3px;
}

.card-days {
  font-size: 0.76rem;
  color: #4263eb;

  .dark-theme & {
    color: #6c8fff;
  }
}

.overflow-hint {
  font-size: 0.74rem;
  color: #9aa0a8;
  margin-top: 6px;
}
</style>
