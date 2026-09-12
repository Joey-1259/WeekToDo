import { createApp } from "vue";
import App from "./App.vue";
import moment from "moment";
import "moment/locale/es";
import "moment/locale/ru";
import "moment/locale/fr";
import "moment/locale/pt";
import "moment/locale/zh-cn";
import "moment/locale/zh-tw";
import "moment/locale/de";
import "moment/locale/it";
import "moment/locale/ar";
import "moment/locale/pl";
import "moment/locale/ja";
import "moment/locale/tr";
import "moment/locale/uk";
import "moment/locale/ko";
import "moment/locale/hi";
import "moment/locale/he";
import "moment/locale/vi";

moment.locale("en");

import { store } from "./store/store";
import * as Sentry from "@sentry/vue";

import { createI18n } from "vue-i18n";
import { languages, defaultLocale } from "./assets/languages/languages.js";
const messages = Object.assign(languages);
const i18n = createI18n({
  locale: defaultLocale,
  fallbackLocale: "en", // 关键：任何语言包缺 key 时自动回退显示英文，杜绝界面上出现裸的 key 路径字符串
  messages,
  missingWarn: false,
  fallbackWarn: false,
});

import "bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";

import "bootstrap-icons/font/bootstrap-icons.css";

/* HARDENING_20260911_V13 · z-index 台账
   这些数字原先散在多个文件里当字面量，新增浮层只能翻代码猜比谁大。
   集中成令牌后，Bootstrap 占用的 1050 / 1055 也被显式记录下来。 */
import "./assets/style/layers.scss";

import "./assets/style/globalVars.scss";
import "./assets/style/main.scss";
import "./assets/style/uiComponents.scss";

/* FOCUS_UI_SYSTEM_20260909_V4 */
import { tip as vTipDirective } from "./directives/tooltip";

Sentry.init({
  /* HARDENING_20260911_V13 · 防御性取值
     渲染进程默认没有 process 这个全局量。若构建配置里没有 define 它，
     本行会在模块求值阶段抛 ReferenceError —— 时机早于 createApp，
     下面所有兜底都还没装上，症状是纯白屏加一行看不出因果的报错。 */
  dsn:
    (typeof process !== "undefined" &&
      process.env &&
      process.env.VUE_APP_SENTRY_DNS) ||
    undefined,
  ignoreErrors: [
    /ResizeObserver loop limit exceeded/i,
    /ResizeObserver loop completed with undelivered notifications/i,
  ],
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
  /* HARDENING_20260911_V13 · 桌面端不需要全量性能追踪来发现回归，
     而 1.0 意味着每次交互都产生一条外发记录。 */
  tracesSampleRate: 0.05,
  // Session Replay
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  /* HARDENING_20260911_V13 · 让错误上报开关真正生效
   *
   * beforeSend 此前整段是注释，意味着设置里那个开关完全不起作用：
   * 用户关掉它，数据照样发。对一个把 focused on privacy 写进
   * package.json description 的产品，这是最该修的一条。
   */
  beforeSend(event) {
    try {
      /* 读不到配置时按未同意处理 —— 隐私默认值必须站在保守一侧。 */
      if (!store.getters.config.reportErrors) return null;
    } catch (error) {
      return null;
    }
    return event;
  },

  beforeSendTransaction(event) {
    try {
      if (!store.getters.config.reportErrors) return null;
    } catch (error) {
      return null;
    }
    return event;
  },
});

// ------------------------------------------------------------------
// 全局兜底：一旦渲染进程出现未捕获异常（导致 Vue 应用无法挂载/白屏），
// 就在页面上直接渲染出错误信息，而不是让用户看到一片空白、无从排查。
// 这段代码不依赖 Vue 本身，纯 DOM 操作，即使 Vue 都没能跑起来也能生效。
// ------------------------------------------------------------------
// FOCUS_UI_SYSTEM_20260909_V4
// 应用挂载成功之后再出现的异常，不应该再用全屏遮罩把整个界面盖掉。
// 之前无论什么时候出错都渲染 position:fixed;inset:0 的红字页面，
// 结果编辑器里一个局部异常看起来就像"整个程序闪退"，数据其实都还在。
// 现在：挂载前 -> 全屏兜底；挂载后 -> 右下角可关闭的错误卡片，界面继续可用。
let weekToDoAppMounted = false;

function renderRuntimeErrorToast(title, detail) {
  try {
    let host = document.getElementById("runtimeErrorHost");

    if (!host) {
      host = document.createElement("div");
      host.id = "runtimeErrorHost";
      host.style.cssText =
        "position:fixed;right:16px;bottom:16px;z-index:var(--z-diagnostic,99999);display:flex;" +
        "flex-direction:column;gap:8px;max-width:420px;";
      document.body.appendChild(host);
    }

    if (host.childElementCount >= 3) return;

    const card = document.createElement("div");
    card.style.cssText =
      "border-radius:10px;background:#242a33;color:#eef1f5;padding:12px 14px;" +
      "box-shadow:0 12px 34px rgba(12,16,22,.34);font-size:12px;line-height:1.55;";

    const head = document.createElement("div");
    head.style.cssText =
      "display:flex;align-items:center;justify-content:space-between;gap:12px;" +
      "margin-bottom:6px;font-weight:600;color:#ff9c99;";
    head.textContent = title;

    const close = document.createElement("button");
    close.textContent = "\u00d7";
    close.style.cssText =
      "border:0;background:transparent;color:#9aa2ad;font-size:17px;cursor:pointer;line-height:1;";
    close.onclick = () => card.remove();
    head.appendChild(close);

    const body = document.createElement("pre");
    body.style.cssText =
      "margin:0;max-height:180px;overflow:auto;white-space:pre-wrap;" +
      "word-break:break-all;font-size:11px;color:#c6ccd4;";
    body.textContent = detail;

    card.appendChild(head);
    card.appendChild(body);
    host.appendChild(card);

    setTimeout(() => card.remove(), 20000);
  } catch (e) {
    console.error("renderRuntimeErrorToast failed:", e);
  }
}

function renderFatalErrorOverlay(title, detail) {
  if (weekToDoAppMounted) {
    renderRuntimeErrorToast(title, detail);
    return;
  }

  try {
    let existing = document.getElementById("fatalErrorOverlay");
    if (existing) return; // 避免重复叠加多个错误框

    let overlay = document.createElement("div");
    overlay.id = "fatalErrorOverlay";
    overlay.style.cssText =
      "position:fixed;top:0;left:0;right:0;bottom:0;z-index:var(--z-diagnostic,99999);background:#1a1e24;color:#f0f0f0;" +
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

// FOCUS_INTERACTION_STABILITY_20260907_V1
// ResizeObserver 的循环通知可能由浏览器布局调度产生，
// 它不代表 Vue 应用崩溃，不能升级为全屏“启动失败”。
function isBenignObserverNotification(event) {
  const message = String(
    event?.message ||
    event?.error?.message ||
    ""
  );

  return (
    message.includes(
      "ResizeObserver loop limit exceeded"
    ) ||
    message.includes(
      "ResizeObserver loop completed with undelivered notifications"
    )
  );
}

window.addEventListener("error", function (event) {
  if (isBenignObserverNotification(event)) {
    event.preventDefault();
    console.warn(
      "已忽略非致命 ResizeObserver 布局通知：",
      event.message
    );
    return;
  }

  let detail =
    (event.error && event.error.stack) ||
    event.message ||
    String(event);

  renderFatalErrorOverlay(
    "脚本运行时错误",
    detail
  );
});

window.addEventListener("unhandledrejection", function (event) {
  let reason = event.reason;
  let detail = (reason && reason.stack) || (reason && reason.message) || String(reason);
  renderFatalErrorOverlay("未处理的 Promise 异常", detail);
});

try {
  const app = createApp(App);

  // ------------------------------------------------------------------
  // 关键补充：Vue 3 组件内部（created/mounted/渲染函数/计算属性等）抛出的异常，
  // 默认只会被 Vue 自己 console.error 打印，并不会冒泡成浏览器原生的
  // window.onerror / unhandledrejection 事件，因此上面那套全局兜底逻辑对这类
  // 错误是"看不见"的——这正是本次排查中发现的一个盲区。
  // 显式注册 errorHandler 后，任何组件级异常都会被这里接管并展示成同样的错误浮层，
  // 以后再遇到类似问题，第一时间就能看到具体报错堆栈，而不是又一次纯白屏。
  // ------------------------------------------------------------------
  app.config.errorHandler = function (err, instance, info) {
    let detail = (err && err.stack) || String(err);
    if (info) detail += `\n\n[Vue errorInfo]: ${info}`;
    renderFatalErrorOverlay("组件运行时错误", detail);
    console.error(err, info);
  };

  app.use(store);
  app.use(i18n);
  app.directive("tip", vTipDirective);
  app.mount("#app");
  weekToDoAppMounted = true;
} catch (e) {
  // 兜底：即使 createApp/mount 阶段同步抛错（例如某个组件 script 顶层代码出错），
  // 也能在页面上看到具体报错，而不是纯白屏。
  renderFatalErrorOverlay("应用初始化失败", (e && e.stack) || String(e));
  console.error(e);
}
