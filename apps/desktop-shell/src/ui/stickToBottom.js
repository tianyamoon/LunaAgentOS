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
//   - When the user scrolls and ends up above the bottom threshold, we drop
//     the stuck flag. Programmatic scrolls do NOT toggle the flag.
//   - When new content arrives we only adjust scrollTop while stuck.
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
  let stuck = options.initialStuck !== false;
  let programmaticScroll = false;
  let disposed = false;

  const setStuckFromDom = () => {
    stuck = isAtBottom(element, threshold);
  };

  const onScroll = () => {
    if (disposed) return;
    if (programmaticScroll) {
      programmaticScroll = false;
      return;
    }
    setStuckFromDom();
  };

  const scrollToBottom = () => {
    if (disposed) return;
    programmaticScroll = true;
    element.scrollTop = element.scrollHeight;
    stuck = true;
  };

  const onResize = () => {
    if (disposed) return;
    if (!stuck) return;
    scrollToBottom();
  };

  element.addEventListener("scroll", onScroll, { passive: true });

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
    get isStuck() {
      return stuck;
    },
    scrollToBottom,
    notifyContentChanged() {
      if (stuck) scrollToBottom();
    },
    markUserIntent() {
      setStuckFromDom();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      element.removeEventListener("scroll", onScroll);
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
