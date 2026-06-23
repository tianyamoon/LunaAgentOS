function defaultRequestAnimationFrame(callback) {
  if (typeof globalThis !== "undefined" && typeof globalThis.requestAnimationFrame === "function") {
    return globalThis.requestAnimationFrame(callback);
  }
  return defaultSetTimeout(callback, 0);
}

function defaultSetTimeout(callback, delayMs) {
  if (typeof globalThis !== "undefined" && typeof globalThis.setTimeout === "function") {
    return globalThis.setTimeout(callback, delayMs);
  }
  callback();
  return 0;
}

export function createRenderScheduler({
  render,
  requestAnimationFrame = defaultRequestAnimationFrame,
  setTimeout = defaultSetTimeout,
} = {}) {
  let pendingOptions = null;
  let scheduledFrame = 0;
  let scheduledTimer = 0;

  function flushOnFrame() {
    scheduledFrame = requestAnimationFrame(() => {
      const nextOptions = pendingOptions || {};
      pendingOptions = null;
      scheduledFrame = 0;
      render?.(nextOptions);
    });
  }

  function schedule(options = {}, delayMs = 0) {
    // 同一帧内的多个渲染请求合并成一次，调用方只表达“需要刷新”的意图。
    pendingOptions = {
      ...(pendingOptions || {}),
      ...options,
    };
    if (scheduledFrame || scheduledTimer) return;
    if (delayMs > 0) {
      scheduledTimer = setTimeout(() => {
        scheduledTimer = 0;
        flushOnFrame();
      }, delayMs);
      return;
    }
    flushOnFrame();
  }

  function updatePendingOptions(updater) {
    if (!pendingOptions || typeof updater !== "function") return;
    pendingOptions = updater({ ...pendingOptions }) || null;
  }

  return {
    schedule,
    updatePendingOptions,
    hasPending() {
      return Boolean(pendingOptions || scheduledFrame || scheduledTimer);
    },
  };
}
