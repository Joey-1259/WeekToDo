<template>
  <div
    class="header-menu-icons"
    type="button"
    data-bs-toggle="dropdown"
    data-bs-auto-close="outside"
    :title="$t('todoDetails.alarm')"
  >
    <i :class="{ 'bi-bell': !reminders.length, 'bi-bell-fill': reminders.length }"></i>
  </div>

  <ul class="dropdown-menu reminder-dropdown px-3 py-2">
    <div class="reminder-option" v-for="opt in options" :key="opt.value"
      :class="{ selected: reminders.includes(opt.value) }"
      @click="toggle(opt.value)">
      <i class="bi-check2" v-show="reminders.includes(opt.value)"></i>
      <span>{{ opt.label }}</span>
    </div>
  </ul>
</template>

<script>
export default {
  name: "reminderPicker",
  props: { modelValue: { type: Array, default: () => [] } },
  emits: ["update:modelValue"],
  data() {
    return {
      reminders: this.modelValue || [],
    };
  },
  computed: {
    options() {
      return [
        { value: 0, label: this.$t("todoDetails.reminderAtTime") },
        { value: 5, label: this.$t("todoDetails.reminderMinBefore", [5]) },
        { value: 15, label: this.$t("todoDetails.reminderMinBefore", [15]) },
        { value: 60, label: this.$t("todoDetails.reminderHourBefore", [1]) },
        { value: 1440, label: this.$t("todoDetails.reminderDayBefore", [1]) },
      ];
    },
  },
  methods: {
    toggle(v) {
      this.reminders = this.reminders.includes(v)
        ? this.reminders.filter((r) => r !== v)
        : [...this.reminders, v];
      this.$emit("update:modelValue", this.reminders);
    },
  },
  watch: {
    modelValue(v) {
      this.reminders = v || [];
    },
  },
};
</script>

<style scoped lang="scss">
@import "/src/assets/style/globalVars.scss";

.header-menu-icons {
  margin-left: 6px;
  @include btn-icon;
}

.reminder-dropdown {
  min-width: 190px;
}

.reminder-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 4px;
  font-size: 0.85rem;
  cursor: pointer;
  border-radius: 4px;

  i {
    width: 14px;
    color: #4263eb;
  }

  &:hover {
    background-color: #f4f5f7;

    .dark-theme & {
      background-color: #1a1e24;
    }
  }

  &.selected {
    font-weight: 500;
  }
}
</style>
