/**
 * 一次只运行一个任务。
 * 新请求取消旧任务；旧任务即使稍后返回，也不再被视为当前任务。
 */
export function createLatestImportQueue({ onError = console.error } = {}) {
  let version = 0;
  let pending = null;
  let running = false;
  let activeController = null;
  let timer = null;
  let ready = false;
  let disposed = false;
  const idleWaiters = [];

  function notifyIdle() {
    if (running || pending || timer) return;
    idleWaiters.splice(0).forEach((resolve) => resolve());
  }

  async function drain() {
    if (disposed || running || !pending || !ready) {
      notifyIdle();
      return;
    }

    const job = pending;
    pending = null;
    ready = false;
    running = true;

    const controller = new AbortController();
    activeController = controller;

    const isCurrent = () =>
      !disposed &&
      job.version === version &&
      !controller.signal.aborted;

    try {
      await job.task({
        signal: controller.signal,
        isCurrent,
      });
    } catch (error) {
      if (isCurrent() && error?.name !== "AbortError") {
        onError(error);
      }
    } finally {
      if (activeController === controller) activeController = null;
      running = false;

      if (pending && ready && !disposed) {
        void drain();
      } else {
        notifyIdle();
      }
    }
  }

  return {
    request(task, delay = 250) {
      if (disposed) return;

      version++;
      activeController?.abort();
      clearTimeout(timer);
      timer = null;
      ready = false;

      pending = { version, task };

      timer = setTimeout(() => {
        timer = null;
        ready = true;
        void drain();
      }, delay);
    },

    cancel() {
      version++;
      activeController?.abort();
      clearTimeout(timer);
      timer = null;
      pending = null;
      ready = false;
      notifyIdle();
    },

    dispose() {
      this.cancel();
      disposed = true;
    },

    idle() {
      if (!running && !pending && !timer) return Promise.resolve();

      return new Promise((resolve) => {
        idleWaiters.push(resolve);
      });
    },
  };
}
