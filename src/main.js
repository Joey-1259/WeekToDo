import { createApp } from "vue";
import App from "./App.vue";
import { store } from "./store/store";
import * as Sentry from "@sentry/vue";

import { createI18n } from "vue-i18n";
import { languages } from "./assets/languages/languages.js";
const messages = Object.assign(languages);
const i18n = createI18n({
  locale: "en",
  fallbackLocale: "en",
  messages,
});

import "bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";

import "bootstrap-icons/font/bootstrap-icons.css";

import "./assets/style/globalVars.scss";
import "./assets/style/main.scss";
import "./assets/style/uiComponents.scss";

Sentry.init({
  dsn: process.env.VUE_APP_SENTRY_DNS,
  integrations: [
    new Sentry.BrowserTracing({
      // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
      tracePropagationTargets: ["localhost", /^https:\/\/yourserver\.io\/api/],
    })
    // Sentry.replayIntegration({
    //   maskAllText: true,
    //   blockAllMedia: true,
    // }),
  ],
  // Performance Monitoring
  tracesSampleRate: 1.0, //  Capture 100% of the transactions
  // Session Replay
  replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
  replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
  // beforeSend(event) {
  //   if (!store.getters.config.reportErrors) {
  //     return null;
  //   }
  //   return event;
  // },
});

// ------------------------------------------------------------------
// 全局兜底：一旦渲染进程出现未捕获异常（导致 Vue 应用无法挂载/白屏），
// 就在页面上直接渲染出错误信息，而不是让用户看到一片空白、无从排查。
// 这段代码不依赖 Vue 本身，纯 DOM 操作，即使 Vue 都没能跑起来也能生效。
// ------------------------------------------------------------------
function renderFatalErrorOverlay(title, detail) {
  try {
    let existing = document.getElementById("fatalErrorOverlay");
    if (existing) return; // 避免重复叠加多个错误框

    let overlay = document.createElement("div");
    overlay.id = "fatalErrorOverlay";
    overlay.style.cssText =
      "position:fixed;top:0;left:0;right:0;bottom:0;z-index:999999;background:#1a1e24;color:#f0f0f0;" +
      "font-family:monospace;padding:24px;overflow:auto;box-sizing:border-box;";

    let heading = document.createElement("div");
    heading.style.cssText = "font-size:16px;font-weight:bold;color:#ff7875;margin-bottom:12px;";
    heading.textContent = "WeekToDo 启动失败：" + title;

    let pre = document.createElement("pre");
    pre.style.cssText = "white-space:pre-wrap;word-break:break-all;font-size:12px;line-height:1.5;";
    pre.textContent = detail;

    let hint = document.createElement("div");
    hint.style.cssText = "margin-top:16px;font-size:12px;color:#9aa0a8;";
    hint.textContent = "请把上面这段完整文字截图或复制发给开发者，用于定位问题。";

    overlay.appendChild(heading);
    overlay.appendChild(pre);
    overlay.appendChild(hint);
    document.body.appendChild(overlay);
  } catch (e) {
    // 兜底逻辑本身绝不能再抛错
    console.error("renderFatalErrorOverlay failed:", e);
  }
}

window.addEventListener("error", function (event) {
  let detail = (event.error && event.error.stack) || event.message || String(event);
  renderFatalErrorOverlay("脚本运行时错误", detail);
});

window.addEventListener("unhandledrejection", function (event) {
  let reason = event.reason;
  let detail = (reason && reason.stack) || (reason && reason.message) || String(reason);
  renderFatalErrorOverlay("未处理的 Promise 异常", detail);
});

try {
  const app = createApp(App);
  app.use(store);
  app.use(i18n);
  app.mount("#app");
} catch (e) {
  // 兜底：即使 createApp/mount 阶段同步抛错（例如某个组件 script 顶层代码出错），
  // 也能在页面上看到具体报错，而不是纯白屏。
  renderFatalErrorOverlay("应用初始化失败", (e && e.stack) || String(e));
  console.error(e);
}
