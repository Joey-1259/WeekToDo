import storageRepository from "./storageRepository";
import version_json from "../data/version.json";
import moment from "moment";

// 新增字段的默认值：老配置里如果缺这个 key，load() 时会自动补上
const NEW_FIELD_DEFAULTS = {
  holidayCountries: ["CN"],
};

// UI 默认值调整记录：每次我们改了某个开关的"默认值"（不是新增字段，是已有字段的默认值变了），
// 就把 UI_DEFAULTS_REVISION 加一，并在 applyUiDefaultsRevision 里写清楚要刷新哪些字段。
// 已经把某个 revision 应用过的本地配置会打上 __uiDefaultsRev 标记，不会被重复覆盖，
// 用户在这之后自己修改的值不会被再次强制改回去。
//
// revision 2：全屏显示待办事项（fullscreenToDoModal）默认值由 true 调整为 false，
// 与本次调整一并生效，覆盖所有仍停留在 revision < 2 的存量配置。
const UI_DEFAULTS_REVISION = 2;
function applyUiDefaultsRevision(config) {
  if (!config.__uiDefaultsRev || config.__uiDefaultsRev < UI_DEFAULTS_REVISION) {
    config.moveCompletedTaskToBottom = false;
    config.fullscreenToDoModal = false;
    config.__uiDefaultsRev = UI_DEFAULTS_REVISION;
    return true;
  }
  return false;
}

export default {
  load() {
    let config = storageRepository.get("config");
    if (config) {
      let patched = false;
      Object.keys(NEW_FIELD_DEFAULTS).forEach((key) => {
        if (!(key in config)) {
          config[key] = NEW_FIELD_DEFAULTS[key];
          patched = true;
        }
      });
      if (applyUiDefaultsRevision(config)) patched = true;
      if (patched) {
        storageRepository.set("config", config);
      }
      return config;
    } else {
      let default_config = {
        darkTheme: false,
        customList: true,
        calendar: true,
        firstTimeOpen: true,
        language: "zh_cn",
        version: version_json.version,
        checkUpdates: true,
        columns: 5,
        customColumns: 5,
        zoom: 100,
        calendarHeight: "calc(50% - 50px)",
        notificationOnStartup: true,
        notificationSound: "pop",
        openOnStartup: true,
        runInBackground: true,
        moveOldTasks: false,
        dateToShowInitialDonateModal: moment().add(15, "d").format("YYYY-MM-DD"),
        InitialDonateModalShown: false,
        mainDividerPosition: 1,
        darkTrayIcon: false,
        importing: false,
        compactView: false,
        startCalendarYesterday: false,
        notificationIndicator: true,
        autoReorderTasks: false,
        moveCompletedTaskToBottom: false,
        moveCompletedSubTaskToBottom: true,
        fullscreenToDoModal: false,
        weekStartOnMonday: true,
        lastDayOpened: moment().format("YYYY-MM-DD"),
        holidayCountries: ["CN"],
        __uiDefaultsRev: UI_DEFAULTS_REVISION,
      };
      storageRepository.set("config", default_config);
      return default_config;
    }
  },
  update(config) {
    storageRepository.set("config", config);
  },
};
