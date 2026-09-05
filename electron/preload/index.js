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
    ipcRenderer.send("show-current-window");
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
    ipcRenderer.send("clear-config");
  },

  setTrayContextMenuLabel(labels) {
    ipcRenderer.send(
      "set-tray-context-menu-label",
      labels
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

const SEND_CHANNELS = new Set([
  "show-current-window",
  "match-open-on-startup",
  "set-open-on-startup",
  "set-run-in-background",
  "clear-config",
  "set-tray-context-menu-label",
  "set-dark-tray-icon",
]);

const SYNC_CHANNELS = new Set([
  "is-windows-visible",
]);

const RECEIVE_CHANNELS = new Set([
  "initial-checks",
]);

const callbackWrappers = new WeakMap();

const ipcRendererCompatibilityApi = Object.freeze({
  send(channel, ...args) {
    if (!SEND_CHANNELS.has(channel)) {
      throw new Error(
        `Blocked IPC send channel: ${channel}`
      );
    }

    ipcRenderer.send(channel, ...args);
  },

  sendSync(channel, ...args) {
    if (!SYNC_CHANNELS.has(channel)) {
      throw new Error(
        `Blocked IPC sync channel: ${channel}`
      );
    }

    return ipcRenderer.sendSync(
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

    const wrappedCallback = (
      event,
      ...args
    ) => callback(event, ...args);

    callbackWrappers.set(
      callback,
      wrappedCallback
    );

    ipcRenderer.on(
      channel,
      wrappedCallback
    );

    return ipcRendererCompatibilityApi;
  },

  removeListener(channel, callback) {
    if (!RECEIVE_CHANNELS.has(channel)) {
      return ipcRendererCompatibilityApi;
    }

    const wrappedCallback =
      callbackWrappers.get(callback);

    if (wrappedCallback) {
      ipcRenderer.removeListener(
        channel,
        wrappedCallback
      );

      callbackWrappers.delete(callback);
    }

    return ipcRendererCompatibilityApi;
  },
});

function restrictedRequire(moduleName) {
  if (moduleName === "electron") {
    return {
        ipcRenderer:
        ipcRendererCompatibilityApi,

        shell: Object.freeze({
        openExternal(url) {
            return ipcRenderer.invoke(
            "open-external",
            String(url || "")
            );
        },
        }),
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

contextBridge.exposeInMainWorld(
  "weekToDoDesktop",
  desktopApi
);

// 只用于兼容旧组件中 require("electron") 的调用。
// 它不是 Node.js require，不能访问 fs/path/child_process 等模块。
contextBridge.exposeInMainWorld(
  "require",
  restrictedRequire
);
