import storageRepository from "./storageRepository";
import version_json from "../../public/version.json";
import moment from "moment";

// 这里列出所有"新增字段"的默认值。load() 读取已有配置时，
// 如果发现某个字段缺失，会顺手补上，避免任何遗漏路径下拿到 undefined。
const NEW_FIELD_DEFAULTS = {
  holidayCountries: ["CN"],
};

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
        moveCompletedTaskToBottom: true,
        moveCompletedSubTaskToBottom: true,
        fullscreenToDoModal: false,
        weekStartOnMonday: true,
        lastDayOpened: moment().format("YYYY-MM-DD"),
        holidayCountries: ["CN"],
      };
      storageRepository.set("config", default_config);
      return default_config;
    }
  },
  update(config) {
    storageRepository.set("config", config);
  },
};
