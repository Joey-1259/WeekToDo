"use strict";
const electron = require("electron");
const desktopApi = Object.freeze({
  isElectron: true,
  openExternal(url) {
    return electron.ipcRenderer.invoke(
      "open-external",
      String(url || "")
    );
  },
  showCurrentWindow() {
    electron.ipcRenderer.send("show-current-window");
  },
  isWindowVisible() {
    return electron.ipcRenderer.sendSync(
      "is-windows-visible"
    );
  },
  matchOpenOnStartup(enabled) {
    electron.ipcRenderer.send(
      "match-open-on-startup",
      Boolean(enabled)
    );
  },
  setOpenOnStartup(enabled) {
    electron.ipcRenderer.send(
      "set-open-on-startup",
      Boolean(enabled)
    );
  },
  setRunInBackground(enabled) {
    electron.ipcRenderer.send(
      "set-run-in-background",
      Boolean(enabled)
    );
  },
  clearMainConfig() {
    electron.ipcRenderer.send("clear-config");
  },
  setTrayContextMenuLabel(labels) {
    electron.ipcRenderer.send(
      "set-tray-context-menu-label",
      labels
    );
  },
  setDarkTrayIcon(enabled) {
    electron.ipcRenderer.send(
      "set-dark-tray-icon",
      Boolean(enabled)
    );
  },
  onInitialChecks(callback) {
    if (typeof callback !== "function") {
      return function noop() {
      };
    }
    const listener = () => callback();
    electron.ipcRenderer.on(
      "initial-checks",
      listener
    );
    return () => {
      electron.ipcRenderer.removeListener(
        "initial-checks",
        listener
      );
    };
  },
  getDataLocation() {
    return electron.ipcRenderer.invoke(
      "get-data-location"
    );
  }
});
const SEND_CHANNELS = /* @__PURE__ */ new Set([
  "show-current-window",
  "match-open-on-startup",
  "set-open-on-startup",
  "set-run-in-background",
  "clear-config",
  "set-tray-context-menu-label",
  "set-dark-tray-icon"
]);
const SYNC_CHANNELS = /* @__PURE__ */ new Set([
  "is-windows-visible"
]);
const RECEIVE_CHANNELS = /* @__PURE__ */ new Set([
  "initial-checks"
]);
const callbackWrappers = /* @__PURE__ */ new WeakMap();
const ipcRendererCompatibilityApi = Object.freeze({
  send(channel, ...args) {
    if (!SEND_CHANNELS.has(channel)) {
      throw new Error(
        `Blocked IPC send channel: ${channel}`
      );
    }
    electron.ipcRenderer.send(channel, ...args);
  },
  sendSync(channel, ...args) {
    if (!SYNC_CHANNELS.has(channel)) {
      throw new Error(
        `Blocked IPC sync channel: ${channel}`
      );
    }
    return electron.ipcRenderer.sendSync(
      channel,
      ...args
    );
  },
  on(channel, callback) {
    if (!RECEIVE_CHANNELS.has(channel)) {
      throw new Error(
        `Blocked IPC receive channel: ${channel}`
      );
    }
    if (typeof callback !== "function") {
      throw new TypeError(
        "IPC callback must be a function"
      );
    }
    const wrappedCallback = (event, ...args) => callback(event, ...args);
    callbackWrappers.set(
      callback,
      wrappedCallback
    );
    electron.ipcRenderer.on(
      channel,
      wrappedCallback
    );
    return ipcRendererCompatibilityApi;
  },
  removeListener(channel, callback) {
    if (!RECEIVE_CHANNELS.has(channel)) {
      return ipcRendererCompatibilityApi;
    }
    const wrappedCallback = callbackWrappers.get(callback);
    if (wrappedCallback) {
      electron.ipcRenderer.removeListener(
        channel,
        wrappedCallback
      );
      callbackWrappers.delete(callback);
    }
    return ipcRendererCompatibilityApi;
  }
});
function restrictedRequire(moduleName) {
  if (moduleName === "electron") {
    return {
      ipcRenderer: ipcRendererCompatibilityApi,
      shell: Object.freeze({
        openExternal(url) {
          return electron.ipcRenderer.invoke(
            "open-external",
            String(url || "")
          );
        }
      })
    };
  }
  if (moduleName === "is-electron") {
    return function isElectron() {
      return true;
    };
  }
  throw new Error(
    `Renderer Node module access blocked: ${moduleName}`
  );
}
electron.contextBridge.exposeInMainWorld(
  "weekToDoDesktop",
  desktopApi
);
electron.contextBridge.exposeInMainWorld(
  "require",
  restrictedRequire
);
