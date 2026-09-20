import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  net,
  protocol,
  shell,
} from "electron";

import path from "node:path";
import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import AutoLaunch from "auto-launch";

import mainConfig from "./configStore";
import {
  ensurePreModernizationBackup,
} from "./dataBackup";

const APP_NAME = "WeekToDo";
const APP_SCHEME = "app";
const PRODUCTION_URL = "app://./index.html";

app.setName(APP_NAME);

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      codeCache: true,
    },
  },
]);

const gotSingleInstanceLock =
  app.requestSingleInstanceLock();

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
      "mailto:",
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

  shell.openExternal(value).catch((error) => {
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
  protocol.handle(
    APP_SCHEME,
    async (request) => {
      try {
        const requestUrl = new URL(
          request.url
        );

        // 必须继续使用 app://./xxx，
        // 以保持旧版 localStorage/IndexedDB Origin。
        if (
          requestUrl.host !== "." &&
          requestUrl.host !== ""
        ) {
          return new Response(
            "Invalid app host",
            {
              status: 400,
            }
          );
        }

        let requestedPath =
          decodeURIComponent(
            requestUrl.pathname
          );

        if (
          !requestedPath ||
          requestedPath === "/"
        ) {
          requestedPath = "/index.html";
        }

        const root = rendererRoot();

        const filePath = path.resolve(
          root,
          `.${requestedPath}`
        );

        const relativePath =
          path.relative(root, filePath);

        const escapedRoot =
          relativePath.startsWith("..") ||
          path.isAbsolute(relativePath);

        if (escapedRoot) {
          return new Response(
            "Path is outside renderer root",
            {
              status: 403,
            }
          );
        }

        return net.fetch(
          pathToFileURL(filePath).toString()
        );
      } catch (error) {
        console.error(
          "[protocol] 资源加载失败：",
          error
        );

        return new Response(
          "Resource not found",
          {
            status: 404,
          }
        );
      }
    }
  );
}

function sanitizeWindowBounds(value) {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return {};
  }

  const result = {};

  ["x", "y", "width", "height"].forEach(
    (key) => {
      if (
        Number.isFinite(value[key])
      ) {
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
      app.getLoginItemSettings()
        .wasOpenedAtLogin
    );
  } catch (_) {
    return false;
  }
}

function getAutoLauncher() {
  return new AutoLaunch({
    name: "WeekToDo Planner",
    path: app.getPath("exe"),
  });
}

async function setOpenOnStartup(
  enabled
) {
  const shouldEnable =
    Boolean(enabled);

  try {
    const autoLauncher =
      getAutoLauncher();

    const currentlyEnabled =
      await autoLauncher.isEnabled();

    if (
      shouldEnable === currentlyEnabled
    ) {
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
    mainWindow &&
      !mainWindow.isDestroyed() &&
      event.sender ===
        mainWindow.webContents
  );
}


/* FOCUS_DOCUMENT_EXPORT_20260920_V2 */
const DOCUMENT_EXPORT_FORMATS =
  Object.freeze({
    markdown: {
      extension: "md",
      filterName: "Markdown",
    },
    word: {
      extension: "docx",
      filterName: "Word 文档",
    },
    pdf: {
      extension: "pdf",
      filterName: "PDF 文档",
    },
  });

/*
 * 图片转为 Data URL 后体积约增加三分之一。
 * 与渲染进程的 64MB 原始图片上限配套，
 * 预留 HTML、DOCX XML 和 Base64 开销。
 */
const MAX_EXPORT_TEXT_BYTES =
  96 * 1024 * 1024;

const MAX_EXPORT_BINARY_BYTES =
  96 * 1024 * 1024;

function sanitizeExportFilename(
  value,
  extension
) {
  const raw = path
    .basename(String(value || "未命名文档"))
    .replace(/[\u0000-\u001f<>:"/\\|?*]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim()
    .slice(0, 120);

  const fallback = "未命名文档";
  const wanted = "." + extension;
  const base = raw || fallback;

  if (
    base.toLowerCase().endsWith(
      wanted.toLowerCase()
    )
  ) {
    return base;
  }

  return base + wanted;
}

function assertExportString(
  value,
  label,
  maxBytes
) {
  if (typeof value !== "string") {
    throw new TypeError(
      label + " 必须是字符串。"
    );
  }

  const bytes = Buffer.byteLength(
    value,
    "utf8"
  );

  if (bytes > maxBytes) {
    throw new Error(
      label
      + " 超出大小限制："
      + String(bytes)
      + " bytes"
    );
  }

  return value;
}

function decodeWordExport(base64) {
  const source = assertExportString(
    base64,
    "Word 数据",
    MAX_EXPORT_BINARY_BYTES * 2
  );

  if (
    !/^[A-Za-z0-9+/]*={0,2}$/.test(source)
  ) {
    throw new Error(
      "Word 数据不是有效的 Base64。"
    );
  }

  const buffer = Buffer.from(
    source,
    "base64"
  );

  if (
    buffer.length < 4 ||
    buffer.length >
      MAX_EXPORT_BINARY_BYTES ||
    buffer[0] !== 0x50 ||
    buffer[1] !== 0x4b
  ) {
    throw new Error(
      "Word 文件内容无效或超过大小限制。"
    );
  }

  return buffer;
}

async function renderDocumentPdf(html) {
  const source = assertExportString(
    html,
    "PDF HTML",
    MAX_EXPORT_TEXT_BYTES
  );

  const printWindow =
    new BrowserWindow({
      show: false,
      backgroundColor: "#ffffff",

      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        /*
         * 页面 CSP 禁止脚本；这里仅允许主进程执行图片 decode
         * 等待逻辑，不允许导出 HTML 自身运行脚本。
         */
        javascript: true,
      },
    });

  try {
    const dataUrl =
      "data:text/html;charset=UTF-8,"
      + encodeURIComponent(source);

    await printWindow.loadURL(dataUrl);

    /*
     * FOCUS_EXPORT_IMAGES_20260920_V3
     * did-finish-load 不代表所有图片都完成像素解码。
     * 明确等待 document.images，避免大图在 PDF 中偶发空白。
     */
    await printWindow.webContents
      .executeJavaScript(`
        Promise.all(
          Array.from(document.images).map(
            async image => {
              if (!image.complete) {
                await new Promise(resolve => {
                  image.addEventListener(
                    "load",
                    resolve,
                    { once: true }
                  );

                  image.addEventListener(
                    "error",
                    resolve,
                    { once: true }
                  );
                });
              }

              if (
                typeof image.decode ===
                "function"
              ) {
                try {
                  await image.decode();
                } catch (_) {
                  // 缺失图片由导出 HTML 的占位结构表达。
                }
              }
            }
          )
        ).then(() => true)
      `);

    return await printWindow
      .webContents
      .printToPDF({
        printBackground: true,
        preferCSSPageSize: true,
        pageSize: "A4",
        generateTaggedPDF: true,
      });
  } finally {
    if (!printWindow.isDestroyed()) {
      printWindow.destroy();
    }
  }
}

async function saveDocumentExport(
  event,
  payload
) {
  if (!isTrustedSender(event)) {
    throw new Error(
      "Untrusted renderer"
    );
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    throw new TypeError(
      "无效的导出请求。"
    );
  }

  const format =
    String(payload.format || "");

  const meta =
    DOCUMENT_EXPORT_FORMATS[format];

  if (!meta) {
    throw new Error(
      "不支持的导出格式："
      + format
    );
  }

  const filename =
    sanitizeExportFilename(
      payload.filename,
      meta.extension
    );

  const owner =
    BrowserWindow.fromWebContents(
      event.sender
    ) || mainWindow;

  const result =
    await dialog.showSaveDialog(
      owner,
      {
        title: "导出重点事项文档",
        buttonLabel: "导出",
        defaultPath: path.join(
          app.getPath("documents"),
          filename
        ),
        nameFieldLabel: "文件名：",
        showsTagField: false,
        filters: [
          {
            name: meta.filterName,
            extensions: [
              meta.extension,
            ],
          },
        ],
        properties: [
          "createDirectory",
          "showOverwriteConfirmation",
        ],
      }
    );

  if (
    result.canceled ||
    !result.filePath
  ) {
    return {
      canceled: true,
    };
  }

  let output;

  if (format === "markdown") {
    output = Buffer.from(
      assertExportString(
        payload.text,
        "Markdown 内容",
        MAX_EXPORT_TEXT_BYTES
      ),
      "utf8"
    );
  } else if (format === "word") {
    output = decodeWordExport(
      payload.base64
    );
  } else {
    output = await renderDocumentPdf(
      payload.html
    );
  }

  await writeFile(
    result.filePath,
    output
  );

  return {
    canceled: false,
    filePath: result.filePath,
    format,
  };
}

function registerIpcHandlers() {
  ipcMain.on(
    "show-current-window",
    (event) => {
      if (!isTrustedSender(event)) {
        return;
      }

      showWindow(
        BrowserWindow.fromWebContents(
          event.sender
        )
      );
    }
  );

  ipcMain.on(
    "is-windows-visible",
    (event) => {
      if (!isTrustedSender(event)) {
        event.returnValue = false;
        return;
      }

      const window =
        BrowserWindow.fromWebContents(
          event.sender
        );

      event.returnValue = Boolean(
        window && window.isVisible()
      );
    }
  );

  ipcMain.on(
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

  ipcMain.on(
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

  ipcMain.on(
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

  ipcMain.on(
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

  // 当前仓库没有完整的托盘创建逻辑。
  // 保留通道和配置，避免旧界面调用报错。
  ipcMain.on(
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

  ipcMain.on(
    "set-tray-context-menu-label",
    (event, labels) => {
      if (!isTrustedSender(event)) {
        return;
      }

      if (
        labels &&
        typeof labels === "object"
      ) {
        mainConfig.set(
          "trayContextMenuLabels",
          {
            open: String(
              labels.open || ""
            ).slice(0, 100),

            quit: String(
              labels.quit || ""
            ).slice(0, 100),
          }
        );
      }
    }
  );

    ipcMain.handle(
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

      await shell.openExternal(url);

      return true;
    }
  );

  ipcMain.handle(
    "get-data-location",
    (event) => {
      if (!isTrustedSender(event)) {
        throw new Error(
          "Untrusted renderer"
        );
      }

      return app.getPath("userData");
    }
  );

  ipcMain.handle(
    "save-document-export",
    saveDocumentExport
  );
}

async function createWindow() {
  if (
    mainWindow &&
    !mainWindow.isDestroyed()
  ) {
    showWindow(mainWindow);
    return mainWindow;
  }

  const openedAtLogin =
    wasOpenedAtLogin();

  const runInBackground =
    mainConfig.get(
      "runInBackground",
      true
    );

  const savedBounds =
    sanitizeWindowBounds(
      mainConfig.get(
        "winBounds",
        null
      )
    );

  mainWindow = new BrowserWindow({
    minWidth: 1000,
    minHeight: 600,

    show: openedAtLogin
      ? !runInBackground
      : true,

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
      allowRunningInsecureContent: false,
    },
  });

  mainWindow.setMenu(null);

  mainWindow.webContents.setWindowOpenHandler(
    ({ url }) => {
      safeOpenExternal(url);

      return {
        action: "deny",
      };
    }
  );

  mainWindow.webContents.on(
    "will-navigate",
    (event, destinationUrl) => {
      const currentUrl =
        mainWindow.webContents.getURL();

      try {
        const destination =
          new URL(destinationUrl);

        const current =
          new URL(currentUrl);

        if (
          destination.origin !==
          current.origin
        ) {
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
      // 当前产品不需要 webview。
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

      if (
        mainConfig.get(
          "runInBackground",
          true
        )
      ) {
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

  if (
    isDevelopment() &&
    process.env.ELECTRON_RENDERER_URL
  ) {
    await mainWindow.loadURL(
      process.env.ELECTRON_RENDERER_URL
    );

    mainWindow.webContents.openDevTools({
      mode: "detach",
    });
  } else {
    await mainWindow.loadURL(
      PRODUCTION_URL
    );
  }

  if (
    mainConfig.get(
      "isMaximized",
      false
    )
  ) {
    mainWindow.maximize();
  }

  return mainWindow;
}

function hideSplashScreen() {
  if (
    !mainWindow ||
    mainWindow.isDestroyed()
  ) {
    return;
  }

  mainWindow.webContents
    .executeJavaScript(
      "if(document.getElementById('splashScreen')) document.getElementById('splashScreen').classList.add('hiddenSplashScreen');",
      true
    )
    .catch((error) => {
      console.error(
        "[splash] 隐藏启动页失败：",
        error
      );
    });
}

function showWindow(window) {
  if (
    !window ||
    window.isDestroyed()
  ) {
    return;
  }

  if (window.isMinimized()) {
    window.restore();
  }

  if (
    mainConfig.get(
      "isMaximized",
      false
    )
  ) {
    window.maximize();
  }

  window.show();
  window.focus();

  if (splashScreenIsHidden) {
    splashScreenIsHidden = false;

    setTimeout(() => {
      if (
        mainWindow &&
        !mainWindow.isDestroyed()
      ) {
        mainWindow.webContents.send(
          "initial-checks"
        );
      }
    }, 4000);
  }
}

function hideWindow(window) {
  if (
    window &&
    !window.isDestroyed()
  ) {
    window.hide();
  }
}

function closeApp() {
  isQuitting = true;

  if (
    mainWindow &&
    !mainWindow.isDestroyed()
  ) {
    mainConfig.set(
      "winBounds",
      mainWindow.getBounds()
    );

    mainConfig.set(
      "isMaximized",
      mainWindow.isMaximized()
    );
  }

  app.quit();
}

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  registerIpcHandlers();

  app.on(
    "second-instance",
    () => {
      if (mainWindow) {
        showWindow(mainWindow);

        setTimeout(
          hideSplashScreen,
          5000
        );
      } else {
        createWindow();
      }
    }
  );

  app.on(
    "before-quit",
    () => {
      isQuitting = true;
    }
  );

  app.on(
    "window-all-closed",
    () => {
      if (
        process.platform !== "darwin"
      ) {
        app.quit();
      }
    }
  );

  app.on(
    "activate",
    () => {
      if (
        BrowserWindow.getAllWindows()
          .length === 0
      ) {
        createWindow();
      } else if (
        mainWindow &&
        !mainWindow.isVisible()
      ) {
        showWindow(mainWindow);
      }
    }
  );

  app.whenReady()
    .then(async () => {
      // 必须在首次加载新渲染页面前完成。
      ensurePreModernizationBackup();

      if (!isDevelopment()) {
        registerProductionProtocol();
      }

      await createWindow();

      console.info(
        "[WeekToDo] userData:",
        app.getPath("userData")
      );

      console.info(
        "[WeekToDo] renderer URL:",
        mainWindow.webContents.getURL()
      );
    })
    .catch((error) => {
      console.error(
        "[WeekToDo] 启动失败：",
        error
      );

      app.quit();
    });
}
