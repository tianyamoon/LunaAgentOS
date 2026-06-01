// stick-to-bottom controller
//
// Streaming chat surfaces (Hermes thought stream, Claude response stream)
// need to follow new content automatically when the user is at the bottom,
// but never yank the viewport back when the user has scrolled up to read.
//
// Inspired by stackblitz-labs/use-stick-to-bottom: track stickiness as an
// intent flag, not an unconditional `scrollTop = scrollHeight` write.
//
// Design:
//   - Each scroll container (`.session-card-body`) gets its own controller.
//   - The controller starts as "stuck to bottom".
//   - 用户滚轮、触控或按下滚动条时立即暂停跟随。
//   - 手动回到底部不会自动恢复，只有明确点击“滚动到最新”才恢复。
//   - When new content arrives we only adjust scrollTop while following.
//   - Optional ResizeObserver follows DOM-driven height changes without
//     touching the flag on its own.
//
// The implementation is intentionally framework-free so it can be unit
// tested with a minimal DOM stub.

const DEFAULT_BOTTOM_THRESHOLD = 24;

export function isAtBottom(element, threshold = DEFAULT_BOTTOM_THRESHOLD) {
  if (!element) return false;
  const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
  return distance <= threshold;
}

export function createStickToBottomController(element, options = {}) {
  if (!element) throw new Error("stickToBottom: element is required");
  const threshold = options.threshold ?? DEFAULT_BOTTOM_THRESHOLD;
  const observeResize = options.observeResize !== false;
  let following = options.initialFollowing ?? options.initialStuck ?? true;
  let disposed = false;

  const pauseFollowing = () => {
    if (disposed) return;
    following = false;
  };

  const onScroll = () => {
    if (disposed) return;
    // 非手势来源的滚动也可能来自键盘；只在离开底部时暂停，不从 DOM 位置自动恢复。
    if (following && !isAtBottom(element, threshold)) pauseFollowing();
  };

  const scrollToBottom = () => {
    if (disposed) return;
    element.scrollTop = element.scrollHeight;
  };

  const resumeFollowing = () => {
    if (disposed) return;
    following = true;
    scrollToBottom();
  };

  const onResize = () => {
    if (disposed) return;
    if (!following) return;
    scrollToBottom();
  };

  element.addEventListener("scroll", onScroll, { passive: true });
  element.addEventListener("wheel", pauseFollowing, { passive: true });
  element.addEventListener("pointerdown", pauseFollowing, { passive: true });
  element.addEventListener("touchstart", pauseFollowing, { passive: true });

  let resizeObserver = null;
  if (observeResize && typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(element);
    // Observing only the scroll container will not fire when inner content
    // grows beyond clientHeight, so also watch the first child if present.
    const inner = element.firstElementChild;
    if (inner instanceof Element) resizeObserver.observe(inner);
  }

  return {
    get isFollowing() {
      return following;
    },
    // 兼容旧调用方读取；新代码统一使用 isFollowing。
    get isStuck() {
      return following;
    },
    pauseFollowing,
    resumeFollowing,
    scrollToBottom,
    notifyContentChanged() {
      if (following) scrollToBottom();
    },
    markUserIntent() {
      pauseFollowing();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      element.removeEventListener("scroll", onScroll);
      element.removeEventListener("wheel", pauseFollowing);
      element.removeEventListener("pointerdown", pauseFollowing);
      element.removeEventListener("touchstart", pauseFollowing);
      resizeObserver?.disconnect();
    },
  };
}

// Manages a controller per element keyed by string id. Renderers that wipe
// the DOM tree can call ensure() after each render to refresh references.
export function createStickToBottomRegistry(options = {}) {
  const controllers = new Map();
  const factory = options.factory || ((element, opts) => createStickToBottomController(element, opts));

  const ensure = (key, element, opts = {}) => {
    if (!key || !element) return null;
    const existing = controllers.get(key);
    if (existing?.element === element) return existing.controller;
    existing?.controller.dispose();
    const controller = factory(element, opts);
    controllers.set(key, { element, controller });
    return controller;
  };

  const get = (key) => controllers.get(key)?.controller || null;

  const release = (key) => {
    const entry = controllers.get(key);
    if (!entry) return;
    entry.controller.dispose();
    controllers.delete(key);
  };

  const sweep = (activeKeys) => {
    const active = new Set(activeKeys);
    for (const key of [...controllers.keys()]) {
      if (!active.has(key)) release(key);
    }
  };

  const disposeAll = () => {
    for (const key of [...controllers.keys()]) release(key);
  };

  return { ensure, get, release, sweep, disposeAll };
}
