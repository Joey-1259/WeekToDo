<template>
  <div class="calendar-hub-view d-flex flex-column">
    <div class="hub-topbar d-flex align-items-center">
      <i class="bi-calendar-heart hub-title-icon"></i>
      <h5 class="mb-0 ms-2">{{ $t("calendarHub.title") }}</h5>
    </div>

    <div class="hub-body flex-grow-1 d-flex">
      <div class="hub-left">
        <div class="country-chip-bar d-flex align-items-center flex-wrap">
          <span class="chip-label">{{ $t("calendarHub.holidayCountry") }}</span>
          <span
            v-for="c in primaryCountries"
            :key="c.code"
            class="country-chip"
            :class="{ active: selectedCountries.includes(c.code) }"
            @click="toggleCountry(c.code)"
          >{{ countryDisplayName(c) }}</span>

          <div class="more-country-wrap">
            <span id="moreCountryBtn" class="country-chip more-chip" data-bs-toggle="dropdown">
              {{ $t("calendarHub.moreCountries") }} <i class="bi-chevron-down"></i>
            </span>
            <ul class="dropdown-menu country-dropdown-menu" aria-labelledby="moreCountryBtn">
              <li v-for="c in extraCountries" :key="c.code">
                <label class="dropdown-item country-item">
                  <input type="checkbox" :value="c.code" v-model="selectedCountries" @change="onCountriesChange" />
                  <span>{{ countryDisplayName(c) }}</span>
                </label>
              </li>
            </ul>
          </div>
        </div>

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
          :maxCategories="5"
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
    toggleCountry: function (code) {
      let idx = this.selectedCountries.indexOf(code);
      if (idx === -1) {
        this.selectedCountries.push(code);
      } else {
        this.selectedCountries.splice(idx, 1);
      }
      this.onCountriesChange();
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
    primaryCountries: function () {
      return this.countryList.slice(0, 5);
    },
    extraCountries: function () {
      return this.countryList.slice(5);
    },
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

  .hub-title-icon {
    font-size: 1.15rem;
    color: #4263eb;

    .dark-theme & {
      color: #6c8fff;
    }
  }
}

.country-chip-bar {
  gap: 8px;
  margin-bottom: 12px;

  .chip-label {
    font-size: 0.8rem;
    color: #8a8f98;
    margin-right: 4px;

    .dark-theme & {
      color: #6b7078;
    }
  }
}

.country-chip {
  font-size: 0.8rem;
  padding: 4px 12px;
  border-radius: 14px;
  background-color: #f4f5f7;
  color: #5c5c5c;
  cursor: pointer;
  transition: 0.2s ease-out;

  &:hover {
    background-color: #eaecef;
  }

  &.active {
    background-color: #4263eb;
    color: white;
  }

  .dark-theme & {
    background-color: #1a1e24;
    color: #c9d1d9;

    &:hover {
      background-color: #21262d;
    }

    &.active {
      background-color: #4263eb;
      color: white;
    }
  }
}

.more-country-wrap {
  position: relative;
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
