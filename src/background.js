"use strict";

import { app, protocol, BrowserWindow, ipcMain } from "electron";
import { createProtocol } from "vue-cli-plugin-electron-builder/lib";
import installExtension, { VUEJS_DEVTOOLS } from "electron-devtools-installer";

const Config = require("electron-config");
const config = new Config();

const isDevelopment = process.env.NODE_ENV !== "production";
const gotTheLock = app.requestSingleInstanceLock();
const isServeMode = () => {
  return process.env.WEBPACK_DEV_SERVER_URL;
};

let mainWindow = null;
var SplashScreenIsHidden = true;
const path = require("path");

protocol.registerSchemesAsPrivileged([{ scheme: "app", privileges: { secure: true, standard: true, stream: true } }]);

// 判断这次启动是不是系统登录时自动触发的（例如"登录时打开"这个开机自启动功能）
// 只有在这种场景下才会遵循 runInBackground 配置去隐藏窗口；
// 用户手动通过 Spotlight / Dock / Finder 打开时，永远直接显示窗口
function wasOpenedAtLogin() {
  if (process.platform === "darwin") {
    try {
      return app.getLoginItemSettings().wasOpenedAtLogin;
    } catch (e) {
      return false;
    }
  }
  return false;
}

async function createWindow() {
  let openedAtLogin = wasOpenedAtLogin();

  let opts = {
    minWidth: 1000,
    minHeight: 600,
    show: openedAtLogin ? !config.get("runInBackground") : true,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      nodeIntegration: process.env.ELECTRON_NODE_INTEGRATION,
      contextIsolation: false,
    },
  };

  Object.assign(opts, config.get("winBounds"));

  mainWindow = new BrowserWindow(opts);
  mainWindow.removeMenu();

   mainWindow.webContents.setWindowOpenHandler((details) => {
    require("electron").shell.openExternal(details.url);
    return { action: 'deny' }
  })

  ipcMain.on("show-current-window", showCurrentWindow);
  ipcMain.on("is-windows-visible", isWindowsVisible);
  ipcMain.on("match-open-on-startup", matchOpenOnStartup);
  ipcMain.on("set-open-on-startup", setOpenOnStartup);
  ipcMain.on("set-run-in-background", setRunInBackground);
  ipcMain.on("clear-config", clearConfig);

  if (typeof config.get("runInBackground") == "undefined") {
    config.set("runInBackground", true);
  }

  mainWindow.on("close", function (event) {
    if (!app.isQuiting) {
      event.preventDefault();
      config.set("winBounds", mainWindow.getBounds());
      config.set("isMaximized", mainWindow.isMaximized());
      if (config.get("runInBackground")) {
        hideWindow(mainWindow);
      } else {
        closeApp();
      }
    }

    return false;
  });

  mainWindow.on("restore", function () {
    setTimeout(hideSplashScreen, 4500);
  });

  if (process.env.WEBPACK_DEV_SERVER_URL) {
    // Load the url of the dev server if in development mode
    await mainWindow.loadURL(process.env.WEBPACK_DEV_SERVER_URL);
    if (!process.env.IS_TEST) mainWindow.webContents.openDevTools();
  } else {
    createProtocol("app");
    mainWindow.loadURL("app://./index.html");
  }
}

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      } else {
        if (config.get("isMaximized")) mainWindow.maximize();
      }
      showWindow(mainWindow);
    } else {
      createWindow();
    }
    setTimeout(hideSplashScreen, 5000);
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  // Dock 图标始终可见，这里改成用窗口自身的可见性来判断要不要重新显示
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (!mainWindow.isVisible()) {
      showWindow(mainWindow);
    }
  });

  // 关键修复：不管退出动作从哪里触发（Dock 右键退出、Cmd+Q、代码里调用 app.quit()），
  // before-quit 都会先被触发，统一在这里把 isQuiting 置为 true，
  // 这样 close 事件里的拦截逻辑才会放行，应用才能真正退出，而不是只隐藏窗口。
  app.on("before-quit", () => {
    app.isQuiting = true;
  });

  app.on("ready", async () => {
    createWindow();

    if (isDevelopment && !process.env.IS_TEST) {
      try {
        await installExtension(VUEJS_DEVTOOLS);
      } catch (e) {
        console.error("Vue Devtools failed to install:", e.toString());
      }
    }
  });

  if (isDevelopment) {
    if (process.platform === "win32") {
      process.on("message", (data) => {
        if (data === "graceful-exit") {
          app.quit();
        }
      });
    } else {
      process.on("SIGTERM", () => {
        app.quit();
      });
    }
  }
}

function hideSplashScreen() {
  mainWindow.webContents.executeJavaScript(
    "if(document.getElementById('splashScreen')) document.getElementById('splashScreen').classList.add('hiddenSplashScreen');"
  );
}

function showCurrentWindow(event) {
  const webContents = event.sender;
  const win = BrowserWindow.fromWebContents(webContents);
  if (config.get("isMaximized")) mainWindow.maximize();
  showWindow(win);
}

function isWindowsVisible(event) {
  const webContents = event.sender;
  const win = BrowserWindow.fromWebContents(webContents);
  event.returnValue = win.isVisible();
}

function setOpenOnStartup(event, openOnStartup) {
  let AutoLaunch = require("auto-launch");
  let autoLauncher = new AutoLaunch({
    name: "WeekToDo Planner",
    path: app.getPath("exe"),
  });
  if (openOnStartup) {
    autoLauncher.enable();
  } else {
    autoLauncher.disable();
  }
}

function clearConfig() {
  config.set("runInBackground", true);
}

function setRunInBackground(event, runInBackground) {
  config.set("runInBackground", runInBackground);
}

function matchOpenOnStartup(event, openOnStartup) {
  let AutoLaunch = require("auto-launch");
  let autoLauncher = new AutoLaunch({
    name: "WeekToDo Planner",
    path: app.getPath("exe"),
  });

  autoLauncher
    .isEnabled()
    .then((isEnabled) => {
      if (openOnStartup != isEnabled) {
        if (openOnStartup) {
          autoLauncher.enable();
        } else {
          autoLauncher.disable();
        }
      }
    })
    .catch(function (err) {
      throw err;
    });
}

// Dock 图标常驻，这里不再需要显式调用 app.dock.show()
function showWindow(window) {
  window.show();
  if (SplashScreenIsHidden) {
    SplashScreenIsHidden = false;
    setTimeout(function () {
      mainWindow.webContents.send("initial-checks");
    }, 4000);
  }
}

// 关闭窗口时只隐藏窗口本身，不再隐藏 Dock 图标，
// 这样点击 X 之后 Dock 图标依旧常驻，点击 Dock 图标即可重新唤出主界面
function hideWindow(window) {
  window.hide();
}

function closeApp() {
  app.isQuiting = true;
  config.set("winBounds", mainWindow.getBounds());
  config.set("isMaximized", mainWindow.isMaximized());
  app.quit();
}
