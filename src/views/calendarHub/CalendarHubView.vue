<template>
  <div class="calendar-hub-view d-flex flex-column">
    <div class="hub-topbar d-flex align-items-center">
      <i class="bi-arrow-left back-icon" @click="$emit('close')" :title="$t('calendarHub.back')"></i>
      <h5 class="mb-0 ms-2">{{ $t("calendarHub.title") }}</h5>

      <div class="country-selector ms-auto">
        <i id="countrySelectorBtn" class="bi-globe2 country-icon" type="button" data-bs-toggle="dropdown"></i>
        <ul class="dropdown-menu country-dropdown-menu" aria-labelledby="countrySelectorBtn">
          <li v-for="c in countryList" :key="c.code">
            <label class="dropdown-item country-item">
              <input type="checkbox" :value="c.code" v-model="selectedCountries" @change="onCountriesChange" />
              <span>{{ countryDisplayName(c) }}</span>
            </label>
          </li>
        </ul>
      </div>
    </div>

    <div class="hub-body flex-grow-1 d-flex">
      <div class="hub-left">
        <month-calendar
          v-model:month="currentMonth"
          :countryCodes="selectedCountries"
          :anniversaryList="anniversaryList"
          :weekStartOnMonday="weekStartOnMonday"
          :pickedDate="pickedDate"
          :language="language"
          @day-click="onDayClick"
        ></month-calendar>

        <upcoming-events-tile
          :anniversaryList="anniversaryList"
          :countryCodes="selectedCountries"
          :days="30"
          @day-click="onDayClick"
        ></upcoming-events-tile>
      </div>

      <div class="hub-right">
        <anniversary-list :list="anniversaryList" @add="openAddModal" @edit="openEditModal"></anniversary-list>
      </div>
    </div>

    <anniversary-edit-modal
      :visible="editModalVisible"
      :editingItem="editingItem"
      @close="closeEditModal"
      @save="onSaveAnniversary"
      @remove="onRemoveAnniversary"
    ></anniversary-edit-modal>
  </div>
</template>

<script>
import moment from "moment";
import monthCalendar from "./monthCalendar.vue";
import anniversaryList from "./anniversaryList.vue";
import anniversaryEditModal from "./anniversaryEditModal.vue";
import upcomingEventsTile from "./upcomingEventsTile.vue";
import anniversaryRepository from "../../repositories/anniversaryRepository";
import holidayHelper from "../../helpers/holidayHelper";
import configRepository from "../../repositories/configRepository";
import countryListData from "../../data/countryList.js";

export default {
  name: "CalendarHubView",
  components: {
    monthCalendar,
    anniversaryList,
    anniversaryEditModal,
    upcomingEventsTile,
  },
  emits: ["close", "jump-to-date"],
  data() {
    return {
      currentMonth: moment().format("YYYY-MM"),
      pickedDate: moment().format("YYYYMMDD"),
      anniversaryList: anniversaryRepository.load(),
      selectedCountries: this.$store.getters.config.holidayCountries ? this.$store.getters.config.holidayCountries.slice() : ["CN"],
      countryList: countryListData,
      editModalVisible: false,
      editingItem: null,
    };
  },
  mounted() {
    holidayHelper.checkForUpdate(this.selectedCountries);
  },
  methods: {
    countryDisplayName: function (c) {
      return this.language === "zh_cn" || this.language === "zh_tw" ? c.nameZh : c.nameEn;
    },
    onDayClick: function (dateStr) {
      this.pickedDate = dateStr;
      this.$emit("jump-to-date", dateStr);
    },
    onCountriesChange: function () {
      if (!this.selectedCountries.length) {
        this.selectedCountries = ["CN"];
      }
      this.$store.commit("updateConfig", { val: this.selectedCountries, key: "holidayCountries" });
      configRepository.update(this.$store.getters.config);
      holidayHelper.checkForUpdate(this.selectedCountries);
    },
    openAddModal: function () {
      this.editingItem = null;
      this.editModalVisible = true;
    },
    openEditModal: function (item) {
      this.editingItem = item;
      this.editModalVisible = true;
    },
    closeEditModal: function () {
      this.editModalVisible = false;
    },
    onSaveAnniversary: function (payload) {
      let list = anniversaryRepository.load();
      let idx = list.findIndex((x) => x.id === payload.id);
      if (idx === -1) {
        list.push(payload);
      } else {
        list[idx] = payload;
      }
      anniversaryRepository.update(list);
      this.anniversaryList = list;
      this.editModalVisible = false;
    },
    onRemoveAnniversary: function (id) {
      let list = anniversaryRepository.load().filter((x) => x.id !== id);
      anniversaryRepository.update(list);
      this.anniversaryList = list;
      this.editModalVisible = false;
    },
  },
  computed: {
    weekStartOnMonday: function () {
      return this.$store.getters.config.weekStartOnMonday;
    },
    language: function () {
      return this.$store.getters.config.language;
    },
  },
};
</script>

<style scoped lang="scss">
.calendar-hub-view {
  height: 100%;
  padding: 16px 24px;
  overflow: hidden;
}

.hub-topbar {
  margin-bottom: 14px;

  h5 {
    font-weight: 600;
  }

  .back-icon {
    font-size: 1.3rem;
    padding: 6px 8px;
    border-radius: 6px;
    cursor: pointer;

    &:hover {
      background-color: #eaecef;

      .dark-theme & {
        background-color: #21262d;
      }
    }
  }
}

.country-icon {
  font-size: 1.15rem;
  padding: 7px;
  border-radius: 6px;
  cursor: pointer;

  &:hover {
    background-color: #eaecef;

    .dark-theme & {
      background-color: #21262d;
    }
  }
}

.country-dropdown-menu {
  max-height: 320px;
  overflow-y: auto;
  min-width: 180px;
}

.country-item {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;

  input {
    margin: 0;
  }
}

.hub-body {
  flex: 1;
  min-height: 0;
  gap: 24px;
}

.hub-left {
  flex: 0 0 62%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.hub-right {
  flex: 1;
  min-height: 0;
  border-left: 1px solid #eaecef;
  padding-left: 20px;

  .dark-theme & {
    border-left-color: #30363d;
  }
}
</style>
