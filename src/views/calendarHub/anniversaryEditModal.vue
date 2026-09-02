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
          <label class="form-label">{{ $t("calendarHub.repeat") }}</label>
          <div class="type-switch d-flex">
            <button type="button" class="type-btn" :class="{ active: form.repeat === 'none' }" @click="setRepeat('none')">
              {{ $t("calendarHub.repeatNone") }}
            </button>
            <button type="button" class="type-btn" :class="{ active: form.repeat === 'yearly' }" @click="setRepeat('yearly')">
              {{ $t("calendarHub.repeatYearlyOpt") }}
            </button>
            <button
              type="button"
              class="type-btn"
              :class="{ active: form.repeat === 'monthly', disabled: form.dateType === 'lunar' }"
              :disabled="form.dateType === 'lunar'"
              @click="setRepeat('monthly')"
            >
              {{ $t("calendarHub.repeatMonthlyOpt") }}
            </button>
          </div>
        </div>

        <div class="mb-3">
          <label class="form-label">{{ $t("calendarHub.dateType") }}</label>
          <div class="type-switch d-flex">
            <button type="button" class="type-btn" :class="{ active: form.dateType === 'solar' }" @click="setDateType('solar')">
              {{ $t("calendarHub.solar") }}
            </button>
            <button
              type="button"
              class="type-btn"
              :class="{ active: form.dateType === 'lunar', disabled: form.repeat === 'monthly' }"
              :disabled="form.repeat === 'monthly'"
              @click="setDateType('lunar')"
            >
              {{ $t("calendarHub.lunar") }}
            </button>
          </div>
        </div>

        <div class="mb-3">
          <label class="form-label">{{ $t("calendarHub.date") }}</label>
          <datepicker v-model="dateObj" :locale="datepickerLocale" class="modern-datepicker" />
          <div v-if="form.dateType === 'lunar' && lunarPreview" class="lunar-preview">
            {{ $t("calendarHub.lunarPreview") }}: {{ lunarPreview.text }}
            <label class="leap-check ms-2" v-if="lunarPreview.isLeap">
              <input type="checkbox" v-model="form.lunarLeap" /> {{ $t("calendarHub.leapMonth") }}
            </label>
          </div>
        </div>

        <div class="mb-3">
          <label class="form-label">{{ $t("calendarHub.remindDaysBefore") }}</label>
          <input type="number" min="0" max="30" class="form-control" v-model.number="form.remindDaysBefore" />
        </div>

        <div class="mb-3">
          <label class="form-label">{{ $t("calendarHub.tag") }}</label>
          <div class="tag-row d-flex flex-wrap">
            <span
              v-for="t in tags"
              :key="t.id"
              class="tag-chip"
              :class="{ active: form.tagId === t.id }"
              :style="{ borderColor: t.color, backgroundColor: form.tagId === t.id ? t.color : 'transparent', color: form.tagId === t.id ? 'white' : t.color }"
              @click="selectTag(t)"
            >{{ t.name }}</span>
            <span class="tag-chip new-tag-chip" @click="newTagFormVisible = !newTagFormVisible">
              <i class="bi-plus-lg"></i> {{ $t("calendarHub.newTag") }}
            </span>
          </div>

          <div v-if="newTagFormVisible" class="new-tag-form d-flex align-items-center">
            <input type="text" class="form-control" v-model="newTagName" :placeholder="$t('calendarHub.tagNamePlaceholder')" />
            <div class="new-tag-color-row">
              <i
                v-for="c in colorPalette"
                :key="c"
                class="bi-circle-fill color-dot"
                :class="{ selected: newTagColor === c }"
                :style="{ color: c }"
                @click="newTagColor = c"
              ></i>
            </div>
            <button type="button" class="btn btn-sm btn-primary" @click="confirmNewTag">{{ $t("ui.ok") }}</button>
          </div>
        </div>

        <div class="mb-1">
          <label class="form-label">{{ $t("calendarHub.note") }}</label>
          <textarea class="form-control" rows="2" v-model="form.note"></textarea>
        </div>
      </div>

      <div class="edit-footer d-flex">
        <button v-if="!isNew" type="button" class="btn btn-outline-danger" @click="remove">{{ $t("ui.remove") }}</button>
        <button type="button" class="btn btn-outline-secondary ms-auto" @click="close">{{ $t("ui.cancel") }}</button>
        <button type="button" class="btn btn-primary" @click="save">{{ $t("ui.ok") }}</button>
      </div>
    </div>
  </div>
</template>

<script>
import moment from "moment";
import Datepicker from "vue3-datepicker";
import anniversaryHelper from "../../helpers/anniversaryHelper";
import anniversaryTagRepository from "../../repositories/anniversaryTagRepository";
import languageHelper from "../../helpers/languageHelper.js";

const colorPalette = ["#f06595", "#748ffc", "#4dabf7", "#40c057", "#f59f00", "#e64980", "#adb5bd", "#845ef7"];

function genId() {
  return "anv_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function defaultForm() {
  return {
    id: null,
    name: "",
    dateType: "solar",
    date: moment().format("YYYY-MM-DD"),
    lunarMonth: null,
    lunarDay: null,
    lunarLeap: false,
    repeat: "none",
    tagId: "tag_anniversary",
    color: "#748ffc",
    remindDaysBefore: 0,
    note: "",
  };
}

export default {
  name: "anniversaryEditModal",
  components: { Datepicker },
  props: {
    visible: { type: Boolean, default: false },
    editingItem: { type: Object, default: null },
  },
  emits: ["close", "save", "remove"],
  data() {
    return {
      form: defaultForm(),
      tags: anniversaryTagRepository.load(),
      colorPalette,
      newTagFormVisible: false,
      newTagName: "",
      newTagColor: colorPalette[0],
    };
  },
  watch: {
    visible: function (val) {
      if (val) {
        this.tags = anniversaryTagRepository.load();
        this.newTagFormVisible = false;
        this.newTagName = "";
        if (this.editingItem) {
          let normalized = anniversaryHelper.normalize(this.editingItem);
          this.form = Object.assign(defaultForm(), normalized);
        } else {
          this.form = defaultForm();
        }
      }
    },
  },
  methods: {
    setRepeat: function (val) {
      this.form.repeat = val;
      if (val === "monthly" && this.form.dateType === "lunar") {
        this.form.dateType = "solar";
      }
    },
    setDateType: function (val) {
      this.form.dateType = val;
      if (val === "lunar" && this.form.repeat === "monthly") {
        this.form.repeat = "yearly";
      }
      this.syncLunarFields();
    },
    syncLunarFields: function () {
      if (this.form.dateType === "lunar") {
        let info = anniversaryHelper.solarToLunarInfo(this.form.date);
        this.form.lunarMonth = info.lunarMonth;
        this.form.lunarDay = info.lunarDay;
        this.form.lunarLeap = info.isLeap ? this.form.lunarLeap : false;
      }
    },
    selectTag: function (tag) {
      this.form.tagId = tag.id;
      this.form.color = tag.color;
    },
    confirmNewTag: function () {
      if (!this.newTagName.trim()) return;
      let tag = { id: genId(), name: this.newTagName.trim(), color: this.newTagColor };
      anniversaryTagRepository.add(tag);
      this.tags = anniversaryTagRepository.load();
      this.selectTag(tag);
      this.newTagFormVisible = false;
      this.newTagName = "";
    },
    save: function () {
      if (!this.form.name || !this.form.date) return;
      let payload = Object.assign({}, this.form, { id: this.form.id || genId() });
      this.$emit("save", payload);
    },
    remove: function () {
      this.$emit("remove", this.form.id);
    },
    close: function () {
      this.$emit("close");
    },
  },
  computed: {
    isNew: function () {
      return !this.editingItem;
    },
    dateObj: {
      get: function () {
        return moment(this.form.date, "YYYY-MM-DD").toDate();
      },
      set: function (val) {
        this.form.date = moment(val).format("YYYY-MM-DD");
        this.syncLunarFields();
      },
    },
    datepickerLocale: function () {
      let lang = this.$store.getters.config.language;
      return languageHelper.getLanguagePack(lang);
    },
    lunarPreview: function () {
      if (this.form.dateType !== "lunar") return null;
      let info = anniversaryHelper.solarToLunarInfo(this.form.date);
      return { text: info.text, isLeap: info.isLeap };
    },
  },
};
</script>

<style scoped lang="scss">
.anniversary-edit-mask {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(2px);
  z-index: 1050;
  display: flex;
  align-items: center;
  justify-content: center;
}

.anniversary-edit-panel {
  width: 420px;
  max-height: 90vh;
  overflow-y: auto;
  background-color: white;
  border-radius: 14px;
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

  &.disabled,
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
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

.modern-datepicker {
  width: 100%;
}

.lunar-preview {
  font-size: 0.78rem;
  color: #8a8f98;
  margin-top: 4px;

  .leap-check {
    font-size: 0.78rem;
  }
}

.tag-row {
  gap: 8px;
}

.tag-chip {
  font-size: 0.78rem;
  padding: 4px 12px;
  border-radius: 14px;
  border: 1.5px solid #adb5bd;
  cursor: pointer;
  transition: 0.15s ease-out;
}

.new-tag-chip {
  border: 1.5px dashed #adb5bd;
  color: #8a8f98;
  background-color: transparent;

  .dark-theme & {
    color: #9aa0a8;
  }
}

.new-tag-form {
  margin-top: 8px;
  gap: 8px;

  .form-control {
    flex: 1;
  }
}

.new-tag-color-row {
  display: flex;
  gap: 4px;
}

.color-dot {
  font-size: 1.2rem;
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
