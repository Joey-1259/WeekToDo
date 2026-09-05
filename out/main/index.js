"use strict";
const electron = require("electron");
const path = require("node:path");
const node_url = require("node:url");
const AutoLaunch = require("auto-launch");
const fs = require("node:fs");
let storeCache = null;
function getConfigPath() {
  return path.join(electron.app.getPath("userData"), "config.json");
}
function readStore() {
  if (storeCache) {
    return storeCache;
  }
  const configPath = getConfigPath();
  try {
    if (!fs.existsSync(configPath)) {
      storeCache = {};
      return storeCache;
    }
    const content = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(content);
    storeCache = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    return storeCache;
  } catch (error) {
    console.error(
      "[mainConfig] 读取旧版 config.json 失败：",
      error
    );
    storeCache = {};
    return storeCache;
  }
}
function writeStore(store) {
  const configPath = getConfigPath();
  const directory = path.dirname(configPath);
  const temporaryPath = `${configPath}.tmp`;
  fs.mkdirSync(directory, {
    recursive: true
  });
  fs.writeFileSync(
    temporaryPath,
    JSON.stringify(store, null, 2),
    "utf8"
  );
  fs.renameSync(temporaryPath, configPath);
}
const mainConfig = {
  get(key, fallbackValue) {
    const store = readStore();
    if (Object.prototype.hasOwnProperty.call(store, key)) {
      return store[key];
    }
    return fallbackValue;
  },
  set(key, value) {
    const store = readStore();
    store[key] = value;
    writeStore(store);
  },
  has(key) {
    const store = readStore();
    return Object.prototype.hasOwnProperty.call(
      store,
      key
    );
  },
  getAll() {
    return {
      ...readStore()
    };
  },
  getPath() {
    return getConfigPath();
  }
};
const BACKUP_REVISION = 1;
const MARKER_FILE = `.modernization-backup-v${BACKUP_REVISION}.json`;
const DATA_ENTRIES = [
  "Local Storage",
  "IndexedDB",
  "Session Storage",
  "config.json",
  "Preferences",
  "Local State"
];
function copyEntry(source, destination) {
  if (!fs.existsSync(source)) {
    return false;
  }
  const stat = fs.statSync(source);
  if (stat.isDirectory()) {
    fs.cpSync(source, destination, {
      recursive: true,
      force: false,
      errorOnExist: false
    });
  } else {
    fs.mkdirSync(path.dirname(destination), {
      recursive: true
    });
    fs.copyFileSync(
      source,
      destination,
      fs.constants.COPYFILE_EXCL
    );
  }
  return true;
}
function ensurePreModernizationBackup() {
  const userDataPath = electron.app.getPath("userData");
  const markerPath = path.join(userDataPath, MARKER_FILE);
  if (fs.existsSync(markerPath)) {
    return {
      created: false,
      userDataPath,
      reason: "backup-already-exists"
    };
  }
  const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
  const backupRoot = path.join(
    userDataPath,
    "data-backups",
    `pre-modernization-v${BACKUP_REVISION}-${timestamp}`
  );
  const copiedEntries = [];
  try {
    fs.mkdirSync(backupRoot, {
      recursive: true
    });
    DATA_ENTRIES.forEach((entryName) => {
      const source = path.join(
        userDataPath,
        entryName
      );
      const destination = path.join(
        backupRoot,
        entryName
      );
      if (copyEntry(source, destination)) {
        copiedEntries.push(entryName);
      }
    });
    const manifest = {
      backupRevision: BACKUP_REVISION,
      appName: electron.app.getName(),
      appVersion: electron.app.getVersion(),
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      userDataPath,
      backupRoot,
      copiedEntries
    };
    fs.writeFileSync(
      path.join(backupRoot, "backup-manifest.json"),
      JSON.stringify(manifest, null, 2),
      "utf8"
    );
    fs.writeFileSync(
      markerPath,
      JSON.stringify(manifest, null, 2),
      "utf8"
    );
    console.info(
      "[dataBackup] 旧版用户数据已备份：",
      backupRoot
    );
    return {
      created: true,
      ...manifest
    };
  } catch (error) {
    console.error(
      "[dataBackup] 自动备份失败，为避免覆盖风险将终止启动：",
      error
    );
    throw new Error(
      `无法备份 WeekToDo 用户数据。应用已停止启动，原数据未被删除。
${error.message}`
    );
  }
}
const APP_NAME = "WeekToDo";
const APP_SCHEME = "app";
const PRODUCTION_URL = "app://./index.html";
electron.app.setName(APP_NAME);
electron.protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      codeCache: true
    }
  }
]);
const gotSingleInstanceLock = electron.app.requestSingleInstanceLock();
let mainWindow = null;
let isQuitting = false;
let splashScreenIsHidden = true;
function isDevelopment() {
  return Boolean(
    process.env.ELECTRON_RENDERER_URL
  );
}
function isAllowedExternalUrl(value) {
  try {
    const url = new URL(value);
    return [
      "https:",
      "http:",
      "mailto:"
    ].includes(url.protocol);
  } catch (_) {
    return false;
  }
}
function safeOpenExternal(value) {
  if (!isAllowedExternalUrl(value)) {
    console.warn(
      "[security] 已阻止外部 URL：",
      value
    );
    return;
  }
  electron.shell.openExternal(value).catch((error) => {
    console.error(
      "[shell] 打开外部链接失败：",
      error
    );
  });
}
function rendererRoot() {
  return path.resolve(
    __dirname,
    "../renderer"
  );
}
function registerProductionProtocol() {
  electron.protocol.handle(
    APP_SCHEME,
    async (request) => {
      try {
        const requestUrl = new URL(
          request.url
        );
        if (requestUrl.host !== "." && requestUrl.host !== "") {
          return new Response(
            "Invalid app host",
            {
              status: 400
            }
          );
        }
        let requestedPath = decodeURIComponent(
          requestUrl.pathname
        );
        if (!requestedPath || requestedPath === "/") {
          requestedPath = "/index.html";
        }
        const root = rendererRoot();
        const filePath = path.resolve(
          root,
          `.${requestedPath}`
        );
        const relativePath = path.relative(root, filePath);
        const escapedRoot = relativePath.startsWith("..") || path.isAbsolute(relativePath);
        if (escapedRoot) {
          return new Response(
            "Path is outside renderer root",
            {
              status: 403
            }
          );
        }
        return electron.net.fetch(
          node_url.pathToFileURL(filePath).toString()
        );
      } catch (error) {
        console.error(
          "[protocol] 资源加载失败：",
          error
        );
        return new Response(
          "Resource not found",
          {
            status: 404
          }
        );
      }
    }
  );
}
function sanitizeWindowBounds(value) {
  if (!value || typeof value !== "object") {
    return {};
  }
  const result = {};
  ["x", "y", "width", "height"].forEach(
    (key) => {
      if (Number.isFinite(value[key])) {
        result[key] = value[key];
      }
    }
  );
  return result;
}
function wasOpenedAtLogin() {
  if (process.platform !== "darwin") {
    return false;
  }
  try {
    return Boolean(
      electron.app.getLoginItemSettings().wasOpenedAtLogin
    );
  } catch (_) {
    return false;
  }
}
function getAutoLauncher() {
  return new AutoLaunch({
    name: "WeekToDo Planner",
    path: electron.app.getPath("exe")
  });
}
async function setOpenOnStartup(enabled) {
  const shouldEnable = Boolean(enabled);
  try {
    const autoLauncher = getAutoLauncher();
    const currentlyEnabled = await autoLauncher.isEnabled();
    if (shouldEnable === currentlyEnabled) {
      return;
    }
    if (shouldEnable) {
      await autoLauncher.enable();
    } else {
      await autoLauncher.disable();
    }
  } catch (error) {
    console.error(
      "[autoLaunch] 修改开机启动失败：",
      error
    );
  }
}
function isTrustedSender(event) {
  return Boolean(
    mainWindow && !mainWindow.isDestroyed() && event.sender === mainWindow.webContents
  );
}
function registerIpcHandlers() {
  electron.ipcMain.on(
    "show-current-window",
    (event) => {
      if (!isTrustedSender(event)) {
        return;
      }
      showWindow(
        electron.BrowserWindow.fromWebContents(
          event.sender
        )
      );
    }
  );
  electron.ipcMain.on(
    "is-windows-visible",
    (event) => {
      if (!isTrustedSender(event)) {
        event.returnValue = false;
        return;
      }
      const window = electron.BrowserWindow.fromWebContents(
        event.sender
      );
      event.returnValue = Boolean(
        window && window.isVisible()
      );
    }
  );
  electron.ipcMain.on(
    "match-open-on-startup",
    (event, enabled) => {
      if (!isTrustedSender(event)) {
        return;
      }
      setOpenOnStartup(
        Boolean(enabled)
      );
    }
  );
  electron.ipcMain.on(
    "set-open-on-startup",
    (event, enabled) => {
      if (!isTrustedSender(event)) {
        return;
      }
      setOpenOnStartup(
        Boolean(enabled)
      );
    }
  );
  electron.ipcMain.on(
    "set-run-in-background",
    (event, enabled) => {
      if (!isTrustedSender(event)) {
        return;
      }
      mainConfig.set(
        "runInBackground",
        Boolean(enabled)
      );
    }
  );
  electron.ipcMain.on(
    "clear-config",
    (event) => {
      if (!isTrustedSender(event)) {
        return;
      }
      mainConfig.set(
        "runInBackground",
        true
      );
    }
  );
  electron.ipcMain.on(
    "set-dark-tray-icon",
    (event, enabled) => {
      if (!isTrustedSender(event)) {
        return;
      }
      mainConfig.set(
        "darkTrayIcon",
        Boolean(enabled)
      );
    }
  );
  electron.ipcMain.on(
    "set-tray-context-menu-label",
    (event, labels) => {
      if (!isTrustedSender(event)) {
        return;
      }
      if (labels && typeof labels === "object") {
        mainConfig.set(
          "trayContextMenuLabels",
          {
            open: String(
              labels.open || ""
            ).slice(0, 100),
            quit: String(
              labels.quit || ""
            ).slice(0, 100)
          }
        );
      }
    }
  );
  electron.ipcMain.handle(
    "open-external",
    async (event, value) => {
      if (!isTrustedSender(event)) {
        throw new Error(
          "Untrusted renderer"
        );
      }
      const url = String(value || "");
      if (!isAllowedExternalUrl(url)) {
        throw new Error(
          `Blocked external URL: ${url}`
        );
      }
      await electron.shell.openExternal(url);
      return true;
    }
  );
  electron.ipcMain.handle(
    "get-data-location",
    (event) => {
      if (!isTrustedSender(event)) {
        throw new Error(
          "Untrusted renderer"
        );
      }
      return electron.app.getPath("userData");
    }
  );
}
async function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    showWindow(mainWindow);
    return mainWindow;
  }
  const openedAtLogin = wasOpenedAtLogin();
  const runInBackground = mainConfig.get(
    "runInBackground",
    true
  );
  const savedBounds = sanitizeWindowBounds(
    mainConfig.get(
      "winBounds",
      null
    )
  );
  mainWindow = new electron.BrowserWindow({
    minWidth: 1e3,
    minHeight: 600,
    show: openedAtLogin ? !runInBackground : true,
    icon: path.join(
      rendererRoot(),
      "icon.png"
    ),
    ...savedBounds,
    webPreferences: {
      preload: path.join(
        __dirname,
        "../preload/index.js"
      ),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });
  mainWindow.setMenu(null);
  mainWindow.webContents.setWindowOpenHandler(
    ({ url }) => {
      safeOpenExternal(url);
      return {
        action: "deny"
      };
    }
  );
  mainWindow.webContents.on(
    "will-navigate",
    (event, destinationUrl) => {
      const currentUrl = mainWindow.webContents.getURL();
      try {
        const destination = new URL(destinationUrl);
        const current = new URL(currentUrl);
        if (destination.origin !== current.origin) {
          event.preventDefault();
          safeOpenExternal(
            destinationUrl
          );
        }
      } catch (_) {
        event.preventDefault();
      }
    }
  );
  mainWindow.webContents.on(
    "will-attach-webview",
    (event) => {
      event.preventDefault();
    }
  );
  mainWindow.on(
    "close",
    (event) => {
      if (isQuitting) {
        return;
      }
      event.preventDefault();
      mainConfig.set(
        "winBounds",
        mainWindow.getBounds()
      );
      mainConfig.set(
        "isMaximized",
        mainWindow.isMaximized()
      );
      if (mainConfig.get(
        "runInBackground",
        true
      )) {
        hideWindow(mainWindow);
      } else {
        closeApp();
      }
    }
  );
  mainWindow.on(
    "restore",
    () => {
      setTimeout(
        hideSplashScreen,
        4500
      );
    }
  );
  if (isDevelopment() && process.env.ELECTRON_RENDERER_URL) {
    await mainWindow.loadURL(
      process.env.ELECTRON_RENDERER_URL
    );
    mainWindow.webContents.openDevTools({
      mode: "detach"
    });
  } else {
    await mainWindow.loadURL(
      PRODUCTION_URL
    );
  }
  if (mainConfig.get(
    "isMaximized",
    false
  )) {
    mainWindow.maximize();
  }
  return mainWindow;
}
function hideSplashScreen() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  mainWindow.webContents.executeJavaScript(
    "if(document.getElementById('splashScreen')) document.getElementById('splashScreen').classList.add('hiddenSplashScreen');",
    true
  ).catch((error) => {
    console.error(
      "[splash] 隐藏启动页失败：",
      error
    );
  });
}
function showWindow(window) {
  if (!window || window.isDestroyed()) {
    return;
  }
  if (window.isMinimized()) {
    window.restore();
  }
  if (mainConfig.get(
    "isMaximized",
    false
  )) {
    window.maximize();
  }
  window.show();
  window.focus();
  if (splashScreenIsHidden) {
    splashScreenIsHidden = false;
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(
          "initial-checks"
        );
      }
    }, 4e3);
  }
}
function hideWindow(window) {
  if (window && !window.isDestroyed()) {
    window.hide();
  }
}
function closeApp() {
  isQuitting = true;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainConfig.set(
      "winBounds",
      mainWindow.getBounds()
    );
    mainConfig.set(
      "isMaximized",
      mainWindow.isMaximized()
    );
  }
  electron.app.quit();
}
if (!gotSingleInstanceLock) {
  electron.app.quit();
} else {
  registerIpcHandlers();
  electron.app.on(
    "second-instance",
    () => {
      if (mainWindow) {
        showWindow(mainWindow);
        setTimeout(
          hideSplashScreen,
          5e3
        );
      } else {
        createWindow();
      }
    }
  );
  electron.app.on(
    "before-quit",
    () => {
      isQuitting = true;
    }
  );
  electron.app.on(
    "window-all-closed",
    () => {
      if (process.platform !== "darwin") {
        electron.app.quit();
      }
    }
  );
  electron.app.on(
    "activate",
    () => {
      if (electron.BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      } else if (mainWindow && !mainWindow.isVisible()) {
        showWindow(mainWindow);
      }
    }
  );
  electron.app.whenReady().then(async () => {
    ensurePreModernizationBackup();
    if (!isDevelopment()) {
      registerProductionProtocol();
    }
    await createWindow();
    console.info(
      "[WeekToDo] userData:",
      electron.app.getPath("userData")
    );
    console.info(
      "[WeekToDo] renderer URL:",
      mainWindow.webContents.getURL()
    );
  }).catch((error) => {
    console.error(
      "[WeekToDo] 启动失败：",
      error
    );
    electron.app.quit();
  });
}
