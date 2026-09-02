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

        <!-- 公历日期选择 -->
        <div class="mb-3" v-if="form.dateType === 'solar'">
          <label class="form-label">{{ $t("calendarHub.date") }}</label>
          <datepicker v-model="dateObj" :locale="datepickerLocale" class="modern-datepicker" />
        </div>

        <!-- 农历日期直选 -->
        <div class="mb-3" v-if="form.dateType === 'lunar'">
          <label class="form-label">{{ $t("calendarHub.lunarDateDirect") }}</label>
          <div class="lunar-direct-row d-flex">
            <select class="form-select form-select-sm" v-model.number="lunarYear" @change="onLunarChange">
              <option v-for="y in lunarYearOptions" :key="y" :value="y">{{ y }}年</option>
            </select>
            <select class="form-select form-select-sm" v-model.number="lunarMonth" @change="onLunarMonthChange">
              <option v-for="opt in lunarMonthOptions" :key="opt.value + (opt.isLeap ? 'L' : '')" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
            <label v-if="showLeapCheckbox" class="leap-inline-check d-flex align-items-center">
              <input type="checkbox" v-model="lunarIsLeap" @change="onLunarChange" />
              <span>{{ $t("calendarHub.leapMonth") }}</span>
            </label>
            <select class="form-select form-select-sm" v-model.number="lunarDay" @change="onLunarChange">
              <option v-for="d in lunarDayOptions" :key="d.value" :value="d.value">{{ d.label }}</option>
            </select>
          </div>
          <div class="lunar-solar-preview" v-if="lunarSolarPreviewText">
            {{ $t("calendarHub.lunarSolarPreview") }}: {{ lunarSolarPreviewText }}
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
import { lunar2solar, solar2lunar, lunarMonthLength } from "../../helpers/solarLunarCore";

const colorPalette = ["#f06595", "#748ffc", "#4dabf7", "#40c057", "#f59f00", "#e64980", "#adb5bd", "#845ef7"];

const lunarMonthNames = ["正月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "冬月", "腊月"];
const lunarDayNames = [
  "初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十",
  "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
  "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十",
];

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

// 获取农历某年的闰月月份，0 表示无闰月
function getLeapMonth(y) {
  try {
    // 用 solarLunarCore 的内部逻辑推导：先转一个已知公历日期到农历取 leapMonth 信息
    // 更直接的方式是用 lunarMonthLength 检测每个月
    // 但最简单的办法是借助 solar2lunar 查一月一日对应的信息
    let info = solar2lunar(y, 6, 15); // 取年中的一天，确保在该农历年范围内
    if (!info || info === -1) return 0;
    // solarLunarCore 的 lunarInfo 编码方式：低 4 位就是闰月月份
    // 但我们没有直接导出 leapMonth 函数，所以用间接方式：
    // 遍历 1-12 月检查哪个月有闰月长度 > 0
    for (let m = 1; m <= 12; m++) {
      if (lunarMonthLength(y, m, true) > 0) return m;
    }
    return 0;
  } catch (e) {
    return 0;
  }
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
      // 农历直选状态
      lunarYear: 1996,
      lunarMonth: 1,
      lunarDay: 1,
      lunarIsLeap: false,
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
          // 如果是编辑农历类型，回填农历年/月/日
          if (this.form.dateType === "lunar" && this.form.lunarMonth && this.form.lunarDay) {
            let info = anniversaryHelper.solarToLunarInfo(this.form.date);
            this.lunarYear = info.lunarYear;
            this.lunarMonth = this.form.lunarMonth;
            this.lunarDay = this.form.lunarDay;
            this.lunarIsLeap = !!this.form.lunarLeap;
          } else {
            this.resetLunarFromSolarDate();
          }
        } else {
          this.form = defaultForm();
          this.resetLunarFromSolarDate();
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
      let prevType = this.form.dateType;
      this.form.dateType = val;
      if (val === "lunar" && this.form.repeat === "monthly") {
        this.form.repeat = "yearly";
      }
      if (val === "lunar" && prevType === "solar") {
        // 从公历切换到农历：根据当前公历日期推算农历，作为下拉初始值
        this.resetLunarFromSolarDate();
      }
      if (val === "solar" && prevType === "lunar") {
        // 从农历切换到公历：尝试根据当前农历选择推算公历
        this.syncSolarFromLunar();
      }
    },
    resetLunarFromSolarDate: function () {
      let info = anniversaryHelper.solarToLunarInfo(this.form.date);
      this.lunarYear = info.lunarYear;
      this.lunarMonth = info.lunarMonth;
      this.lunarDay = info.lunarDay;
      this.lunarIsLeap = info.isLeap;
    },
    onLunarMonthChange: function () {
      // 切换月份时：检查闰月状态是否还有效，检查日数是否越界
      let leapM = getLeapMonth(this.lunarYear);
      if (this.lunarMonth !== leapM) {
        this.lunarIsLeap = false;
      }
      let maxDay = this.currentLunarMonthDays;
      if (this.lunarDay > maxDay) {
        this.lunarDay = maxDay;
      }
      this.onLunarChange();
    },
    onLunarChange: function () {
      // 重新推算公历
      let maxDay = this.currentLunarMonthDays;
      if (this.lunarDay > maxDay) {
        this.lunarDay = maxDay;
      }
      this.syncSolarFromLunar();
      // 同步到 form 的 lunarMonth / lunarDay / lunarLeap
      this.form.lunarMonth = this.lunarMonth;
      this.form.lunarDay = this.lunarDay;
      this.form.lunarLeap = this.lunarIsLeap;
    },
    syncSolarFromLunar: function () {
      let result = null;
      try {
        result = lunar2solar(this.lunarYear, this.lunarMonth, this.lunarDay, this.lunarIsLeap);
      } catch (e) {
        // ignore
      }
      if (result && result !== -1) {
        this.form.date = `${result.cYear}-${String(result.cMonth).padStart(2, "0")}-${String(result.cDay).padStart(2, "0")}`;
        this.form.lunarMonth = this.lunarMonth;
        this.form.lunarDay = this.lunarDay;
        this.form.lunarLeap = this.lunarIsLeap;
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
      },
    },
    datepickerLocale: function () {
      let lang = this.$store.getters.config.language;
      return languageHelper.getLanguagePack(lang);
    },
    // ---------- 农历下拉选项 ----------
    lunarYearOptions: function () {
      let years = [];
      for (let y = 1901; y <= 2099; y++) years.push(y);
      return years;
    },
    lunarMonthOptions: function () {
      let options = [];
      let leapM = getLeapMonth(this.lunarYear);
      for (let m = 1; m <= 12; m++) {
        options.push({ value: m, label: lunarMonthNames[m - 1], isLeap: false });
      }
      // 如果有闰月，在对应月份后面插入一个"闰X月"选项
      // 注意：闰月选择通过独立的 checkbox 控制，这里只是展示信息
      if (leapM > 0) {
        // 用户通过 lunarIsLeap checkbox 切换
      }
      return options;
    },
    showLeapCheckbox: function () {
      let leapM = getLeapMonth(this.lunarYear);
      return leapM > 0 && this.lunarMonth === leapM;
    },
    currentLunarMonthDays: function () {
      let days = lunarMonthLength(this.lunarYear, this.lunarMonth, this.lunarIsLeap);
      return days > 0 ? days : 30; // 如果闰月不存在就降级到 30
    },
    lunarDayOptions: function () {
      let max = this.currentLunarMonthDays;
      let options = [];
      for (let d = 1; d <= max; d++) {
        options.push({ value: d, label: lunarDayNames[d - 1] || String(d) });
      }
      return options;
    },
    lunarSolarPreviewText: function () {
      if (this.form.dateType !== "lunar") return "";
      let result = null;
      try {
        result = lunar2solar(this.lunarYear, this.lunarMonth, this.lunarDay, this.lunarIsLeap);
      } catch (e) {
        // ignore
      }
      if (!result || result === -1) return this.$t("calendarHub.lunarInvalidDate");
      return `${result.cYear}-${String(result.cMonth).padStart(2, "0")}-${String(result.cDay).padStart(2, "0")}`;
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
  width: 440px;
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

.form-select {
  .dark-theme & {
    background-color: #15161e;
    border: 1px solid #30363d;
    color: #c9d1d9;
  }
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

/* 农历直选行 */
.lunar-direct-row {
  gap: 6px;
  flex-wrap: wrap;

  .form-select {
    flex: 1;
    min-width: 80px;
  }
}

.leap-inline-check {
  gap: 4px;
  font-size: 0.78rem;
  white-space: nowrap;
  color: #8a8f98;
  cursor: pointer;

  input {
    margin: 0;
  }
}

.lunar-solar-preview {
  font-size: 0.78rem;
  color: #4263eb;
  margin-top: 6px;

  .dark-theme & {
    color: #6c8fff;
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
