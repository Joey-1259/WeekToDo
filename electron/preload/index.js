import {
  contextBridge,
  ipcRenderer,
} from "electron";

const desktopApi = Object.freeze({
  isElectron: true,

  openExternal(url) {
    return ipcRenderer.invoke(
      "open-external",
      String(url || "")
    );
  },

  showCurrentWindow() {
    ipcRenderer.send(
      "show-current-window"
    );
  },

  isWindowVisible() {
    return ipcRenderer.sendSync(
      "is-windows-visible"
    );
  },

  matchOpenOnStartup(enabled) {
    ipcRenderer.send(
      "match-open-on-startup",
      Boolean(enabled)
    );
  },

  setOpenOnStartup(enabled) {
    ipcRenderer.send(
      "set-open-on-startup",
      Boolean(enabled)
    );
  },

  setRunInBackground(enabled) {
    ipcRenderer.send(
      "set-run-in-background",
      Boolean(enabled)
    );
  },

  clearMainConfig() {
    ipcRenderer.send(
      "clear-config"
    );
  },

  setTrayContextMenuLabel(labels) {
    ipcRenderer.send(
      "set-tray-context-menu-label",
      {
        open: String(
          labels && labels.open || ""
        ),
        quit: String(
          labels && labels.quit || ""
        ),
      }
    );
  },

  setDarkTrayIcon(enabled) {
    ipcRenderer.send(
      "set-dark-tray-icon",
      Boolean(enabled)
    );
  },

  onInitialChecks(callback) {
    if (typeof callback !== "function") {
      return function noop() {};
    }

    const listener = () => callback();

    ipcRenderer.on(
      "initial-checks",
      listener
    );

    return () => {
      ipcRenderer.removeListener(
        "initial-checks",
        listener
      );
    };
  },

  getDataLocation() {
    return ipcRenderer.invoke(
      "get-data-location"
    );
  },
});

contextBridge.exposeInMainWorld(
  "weekToDoDesktop",
  desktopApi
);
