<template>
  <div v-if="visible" class="anniversary-edit-mask" @click.self="close">
    <div class="anniversary-edit-panel">
      <div class="edit-header d-flex align-items-center">
        <h5 class="mb-0">{{ isNew ? $t("calendarHub.newAnniversary") : $t("calendarHub.editAnniversary") }}</h5>
        <i class="bi-x close-icon ms-auto" @click="close"></i>
      </div>

      <div class="edit-body">
        <div class="mb-3">
          <label class="form-label">{{ $t("calendarHub.name") }}</label>
          <input type="text" class="form-control" v-model="form.name" :placeholder="$t('calendarHub.namePlaceholder')" />
        </div>

        <div class="mb-3">
          <label class="form-label">{{ $t("calendarHub.type") }}</label>
          <div class="type-switch d-flex">
            <button
              type="button"
              class="type-btn"
              :class="{ active: form.type === 'countdown' }"
              @click="form.type = 'countdown'"
            >{{ $t("calendarHub.typeCountdown") }}</button>
            <button
              type="button"
              class="type-btn"
              :class="{ active: form.type === 'countup' }"
              @click="setCountup"
            >{{ $t("calendarHub.typeCountup") }}</button>
            <button
              type="button"
              class="type-btn"
              :class="{ active: form.type === 'birthday' }"
              @click="setBirthday"
            >{{ $t("calendarHub.typeBirthday") }}</button>
          </div>
        </div>

        <div class="mb-3">
          <label class="form-label">{{ $t("calendarHub.dateType") }}</label>
          <div class="type-switch d-flex">
            <button type="button" class="type-btn" :class="{ active: form.dateType === 'solar' }" @click="setDateType('solar')">
              {{ $t("calendarHub.solar") }}
            </button>
            <button type="button" class="type-btn" :class="{ active: form.dateType === 'lunar' }" @click="setDateType('lunar')">
              {{ $t("calendarHub.lunar") }}
            </button>
          </div>
        </div>

        <div class="mb-3">
          <label class="form-label">{{ $t("calendarHub.date") }}</label>
          <input type="date" class="form-control" v-model="form.date" @change="onDateChange" />
          <div v-if="form.dateType === 'lunar' && lunarPreview" class="lunar-preview">
            {{ $t("calendarHub.lunarPreview") }}: {{ lunarPreview.text }}
            <label class="leap-check ms-2" v-if="lunarPreview.isLeap">
              <input type="checkbox" v-model="form.lunarLeap" /> {{ $t("calendarHub.leapMonth") }}
            </label>
          </div>
        </div>

        <div class="mb-3 form-check form-switch d-flex justify-content-between" v-if="form.type === 'countdown'">
          <label class="form-check-label">{{ $t("calendarHub.repeatYearly") }}</label>
          <input class="form-check-input" type="checkbox" v-model="form.repeatYearly" />
        </div>

        <div class="mb-3">
          <label class="form-label">{{ $t("calendarHub.remindDaysBefore") }}</label>
          <input type="number" min="0" max="30" class="form-control" v-model.number="form.remindDaysBefore" />
        </div>

        <div class="mb-3">
          <label class="form-label">{{ $t("calendarHub.color") }}</label>
          <div class="color-row">
            <i
              v-for="c in colorPalette"
              :key="c"
              class="bi-circle-fill color-dot"
              :class="{ selected: form.color === c }"
              :style="{ color: c }"
              @click="form.color = c"
            ></i>
          </div>
        </div>

        <div class="mb-1">
          <label class="form-label">{{ $t("calendarHub.note") }}</label>
          <textarea class="form-control" rows="2" v-model="form.note"></textarea>
        </div>
      </div>

      <div class="edit-footer d-flex">
        <button v-if="!isNew" type="button" class="btn btn-outline-danger" @click="remove">{{ $t("ui.remove") }}</button>
        <span class="flex-grow-1"></span>
        <button type="button" class="btn btn-light" @click="close">{{ $t("ui.cancel") }}</button>
        <button type="button" class="btn btn-primary" :disabled="!form.name" @click="save">{{ $t("ui.ok") }}</button>
      </div>
    </div>
  </div>
</template>

<script>
import moment from "moment";
import anniversaryHelper from "../../helpers/anniversaryHelper";

const COLOR_PALETTE = ["#77e785", "#06b6d4", "#5e6ef2", "#8b5cf6", "#ed56a1", "#ed544b", "#f97316", "#f9d54a", "#ba7956", "#6b7280"];

function emptyForm() {
  return {
    id: null,
    name: "",
    type: "countdown",
    dateType: "solar",
    date: moment().format("YYYY-MM-DD"),
    lunarMonth: null,
    lunarDay: null,
    lunarLeap: false,
    repeatYearly: true,
    remindDaysBefore: 3,
    color: COLOR_PALETTE[2],
    note: "",
  };
}

export default {
  name: "anniversaryEditModal",
  props: {
    visible: { type: Boolean, default: false },
    editingItem: { type: Object, default: null },
  },
  emits: ["close", "save", "remove"],
  data() {
    return {
      form: emptyForm(),
      colorPalette: COLOR_PALETTE,
    };
  },
  methods: {
    setCountup: function () {
      this.form.type = "countup";
      this.form.repeatYearly = false;
    },
    setBirthday: function () {
      this.form.type = "birthday";
      this.form.repeatYearly = true;
    },
    setDateType: function (val) {
      this.form.dateType = val;
      this.onDateChange();
    },
    onDateChange: function () {
      if (this.form.dateType === "lunar" && this.form.date) {
        let info = anniversaryHelper.solarToLunarInfo(this.form.date);
        this.form.lunarMonth = info.lunarMonth;
        this.form.lunarDay = info.lunarDay;
        if (!info.isLeap) this.form.lunarLeap = false;
      }
    },
    resetForm: function () {
      if (this.editingItem) {
        this.form = Object.assign({}, emptyForm(), this.editingItem);
      } else {
        this.form = emptyForm();
      }
    },
    close: function () {
      this.$emit("close");
    },
    save: function () {
      if (!this.form.name) return;
      let payload = Object.assign({}, this.form);
      if (!payload.id) {
        payload.id = moment().format("YYYYMMDDTHHmmssSSS");
        payload.createdAt = moment().toISOString();
      }
      this.$emit("save", payload);
    },
    remove: function () {
      this.$emit("remove", this.form.id);
    },
  },
  computed: {
    isNew: function () {
      return !this.form.id;
    },
    lunarPreview: function () {
      if (!this.form.date) return null;
      return anniversaryHelper.solarToLunarInfo(this.form.date);
    },
  },
  watch: {
    visible: function (val) {
      if (val) this.resetForm();
    },
  },
};
</script>

<style scoped lang="scss">
.anniversary-edit-mask {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1070;
}

.anniversary-edit-panel {
  width: 420px;
  max-height: 85vh;
  overflow-y: auto;
  background-color: white;
  border-radius: 10px;
  padding: 20px 22px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);

  .dark-theme & {
    background-color: #21262d;
    color: #c9d1d9;
  }
}

.edit-header {
  margin-bottom: 14px;

  .close-icon {
    font-size: 1.3rem;
    cursor: pointer;
    padding: 4px;

    &:hover {
      opacity: 0.7;
    }
  }
}

.form-label {
  font-size: 0.85rem;
  margin-bottom: 4px;
  color: #6b7078;

  .dark-theme & {
    color: #9aa0a8;
  }
}

.form-control,
textarea.form-control {
  .dark-theme & {
    background-color: #15161e;
    border: 1px solid #30363d;
    color: #c9d1d9;
  }
}

.form-control:focus {
  box-shadow: none;
  border-color: #4263eb;
}

.type-switch {
  gap: 6px;
}

.type-btn {
  flex: 1;
  padding: 6px 4px;
  border: 1px solid #dcdfe4;
  background-color: white;
  border-radius: 6px;
  font-size: 0.82rem;
  cursor: pointer;

  &.active {
    background-color: #4263eb;
    border-color: #4263eb;
    color: white;
  }

  .dark-theme & {
    background-color: #15161e;
    border-color: #30363d;
    color: #c9d1d9;

    &.active {
      background-color: #4263eb;
      border-color: #4263eb;
      color: white;
    }
  }
}

.lunar-preview {
  font-size: 0.78rem;
  color: #8a8f98;
  margin-top: 4px;

  .leap-check {
    font-size: 0.78rem;
  }
}

.color-row {
  display: flex;
  gap: 6px;
}

.color-dot {
  font-size: 1.4rem;
  cursor: pointer;
  opacity: 0.55;
  transition: opacity 0.15s;

  &.selected,
  &:hover {
    opacity: 1;
  }
}

.edit-footer {
  margin-top: 16px;
  gap: 8px;
}
</style>
