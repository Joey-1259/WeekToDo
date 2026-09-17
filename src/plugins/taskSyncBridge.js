/**
 * V5_SYNC: 双向同步桥接
 *
 * 监听 weektodo:task-changed 事件，当重点事项修改/删除关联事项时，
 * 自动刷新每周事项的 Vuex store。
 *
 * 同时，在 Vuex store 的 todo 数据变更后，派发 weektodo:task-changed
 * 事件通知重点事项刷新关联事项节点。
 *
 * 使用方式：在 main.js 中 app.use(taskSyncBridge)
 */
export default {
  install(app) {
    /* 延迟到 app mounted 后获取 store */
    let store = null;

    const getStore = () => {
      if (store) return store;
      store = app.config.globalProperties.$store;
      return store;
    };

    /* 重点事项变更 → 刷新每周事项 store */
    const onTaskChanged = (event) => {
      const s = getStore();
      if (!s) return;
      const detail = event.detail || {};
      const action = detail.action;

      if (action === "deleted" || action === "unlinked" || action === "updated") {
        /* 重新加载当前显示的 todo list */
        try {
          s.dispatch("getToDoList");
        } catch (e) {
          /* ignore */
        }
      }
    };

    window.addEventListener("weektodo:task-changed", onTaskChanged);

    /* 提供一个全局方法让 Vuex actions 调用 */
    app.config.globalProperties.$notifyTaskChanged = function(taskId, listId, action) {
      window.dispatchEvent(new CustomEvent("weektodo:task-changed", {
        detail: { taskId, listId, action: action || "updated" }
      }));
    };
  }
};
