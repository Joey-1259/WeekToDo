import {
  contextBridge,
  ipcRenderer,
  webUtils,
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

  /*
   * FOCUS_DOCUMENT_EXPORT_20260920_V2
   * 渲染进程只提交受限的导出数据，不接触 fs、dialog 或任意路径。
   */
  saveDocumentExport(payload) {
    return ipcRenderer.invoke(
      "save-document-export",
      payload
    );
  },

  /* FOCUS_ATTACHMENT_20261109_V1：附件只传路径字符串，不传文件内容 */
  pickAttachments(options) {
    return ipcRenderer.invoke("attachment:pick", {
      multiple: !(options && options.multiple === false),
      defaultPath: String((options && options.defaultPath) || ""),
    });
  },

  revealAttachment(filePath) {
    return ipcRenderer.invoke("attachment:reveal", String(filePath || ""));
  },

  openAttachment(filePath) {
    return ipcRenderer.invoke("attachment:open", String(filePath || ""));
  },

  statAttachments(paths) {
    return ipcRenderer.invoke(
      "attachment:stat",
      Array.isArray(paths) ? paths.map((item) => String(item || "")) : []
    );
  },

  getHomeDir() {
    return ipcRenderer.invoke("attachment:home");
  },

  /* Electron 32+ 移除了 File.path，拖入的文件用 webUtils 取路径 */
  getPathForFile(file) {
    try {
      return webUtils.getPathForFile(file) || "";
    } catch (_) {
      return "";
    }
  },
});

contextBridge.exposeInMainWorld(
  "weekToDoDesktop",
  desktopApi
);
