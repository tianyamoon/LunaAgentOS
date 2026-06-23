// Session 流式滚动控制器。
//
// 状态机适配自 AionUi useAutoScroll：
// https://github.com/iOfficeAI/AionUi/blob/main/packages/desktop/src/renderer/pages/conversation/Messages/useAutoScroll.ts
// Copyright 2025 AionUi (aionui.com), Apache-2.0。
//
// Luna 使用原生 DOM + Tauri WebView，因此保留 AionUi 的交互语义，
// 但将 React Hook 改写为可测试的轻量控制器。

const PROGRAMMATIC_SCROLL_GUARD_MS = 150;
const AT_BOTTOM_THRESHOLD_PX = 100;
const FOLLOW_BOTTOM_THRESHOLD_PX = 4;

function defaultRequestFrame(callback) {
  if (typeof requestAnimationFrame === "function") return requestAnimationFrame(callback);
  callback();
  return 0;
}

function defaultCancelFrame(frameId) {
  if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(frameId);
}

function scrollTarget(element) {
  return Math.max(0, element.scrollHeight - element.clientHeight);
}

export function bottomGap(element) {
  if (!element) return Number.POSITIVE_INFINITY;
  return element.scrollHeight - element.clientHeight - element.scrollTop;
}

export function isAtBottom(element, threshold = AT_BOTTOM_THRESHOLD_PX) {
  return bottomGap(element) <= threshold;
}

export function createStickToBottomController(element, options = {}) {
  if (!element) throw new Error("stickToBottom: element is required");
  const observeResize = options.observeResize !== false;
  const onStateChange = typeof options.onStateChange === "function" ? options.onStateChange : null;
  const requestFrame = options.requestFrame || defaultRequestFrame;
  const cancelFrame = options.cancelFrame || defaultCancelFrame;
  const now = options.now || (() => Date.now());
  let contentElement = options.contentElement || element.firstElementChild || null;
  let userScrolled = !(options.initialFollowing ?? options.initialStuck ?? true);
  let userInputActive = false;
  let showScrollButton = bottomGap(element) > AT_BOTTOM_THRESHOLD_PX;
  let lastScrollTop = element.scrollTop;
  let lastProgrammaticScrollTime = 0;
  let pendingAutoFollowFrame = null;
  let disposed = false;
  let resizeObserver = null;

  function markProgrammaticScroll() {
    lastProgrammaticScrollTime = now();
  }

  function emitStateChange() {
    onStateChange?.({
      isFollowing: !userScrolled,
      showScrollButton,
      bottomGap: bottomGap(element),
    });
  }

  function setUserScrolled(nextValue) {
    const previous = userScrolled;
    userScrolled = Boolean(nextValue);
    if (previous !== userScrolled) emitStateChange();
  }

  function setShowScrollButton(nextValue) {
    const previous = showScrollButton;
    showScrollButton = Boolean(nextValue);
    if (previous !== showScrollButton) emitStateChange();
  }

  // 回到底部后恢复自动跟随；这与 AionUi 的用户预期一致。
  function updateBottomState() {
    const gap = bottomGap(element);
    const pinnedToBottom = gap <= FOLLOW_BOTTOM_THRESHOLD_PX;
    setShowScrollButton(gap > AT_BOTTOM_THRESHOLD_PX);
    if (pinnedToBottom) {
      setUserScrolled(false);
      userInputActive = false;
      lastProgrammaticScrollTime = now() - (PROGRAMMATIC_SCROLL_GUARD_MS - 50);
    }
    return pinnedToBottom;
  }

  function onScroll() {
    if (disposed) return;
    const currentScrollTop = element.scrollTop;
    const delta = currentScrollTop - lastScrollTop;
    const pinnedToBottom = bottomGap(element) <= FOLLOW_BOTTOM_THRESHOLD_PX;
    const outsideProgrammaticGuard = now() - lastProgrammaticScrollTime >= PROGRAMMATIC_SCROLL_GUARD_MS;
    if (!pinnedToBottom && Math.abs(delta) > 2 && (userInputActive || outsideProgrammaticGuard)) {
      setUserScrolled(true);
    }
    if (pinnedToBottom) {
      userInputActive = false;
    } else if (Math.abs(delta) > 2) {
      userInputActive = false;
    }
    lastScrollTop = currentScrollTop;
    updateBottomState();
  }

  function onWheel(event = {}) {
    if (Math.abs(event.deltaY || 0) > 0 || Math.abs(event.deltaX || 0) > 0) {
      userInputActive = true;
    }
  }

  function onPointerDown() {
    userInputActive = true;
  }

  function scrollToBottom(behavior = "auto") {
    if (disposed) return;
    markProgrammaticScroll();
    const top = scrollTarget(element);
    if (typeof element.scrollTo === "function") {
      element.scrollTo({ top, behavior });
    } else {
      element.scrollTop = top;
    }
    lastScrollTop = element.scrollTop;
    setUserScrolled(false);
    setShowScrollButton(false);
  }

  function scheduleAutoFollow() {
    if (disposed || userScrolled) return;
    if (pendingAutoFollowFrame !== null) cancelFrame(pendingAutoFollowFrame);
    pendingAutoFollowFrame = requestFrame(() => {
      pendingAutoFollowFrame = null;
      if (disposed || userScrolled) return;
      if (bottomGap(element) > 2) scrollToBottom("auto");
    });
  }

  function observeContentElement() {
    if (!resizeObserver) return;
    resizeObserver.disconnect();
    resizeObserver.observe(element);
    const nextContentElement = contentElement || element.firstElementChild;
    if (nextContentElement) resizeObserver.observe(nextContentElement);
  }

  function resumeFollowing(behavior = "smooth") {
    if (disposed) return;
    setUserScrolled(false);
    scrollToBottom(behavior);
  }

  function notifyUserSubmission() {
    if (disposed) return;
    setUserScrolled(false);
    requestFrame(() => requestFrame(() => scrollToBottom("auto")));
  }

  function scrollElementIntoView(target, options = {}) {
    if (!target?.scrollIntoView) return;
    setUserScrolled(false);
    setShowScrollButton(false);
    markProgrammaticScroll();
    target.scrollIntoView({
      behavior: options.behavior || "smooth",
      block: options.block || "start",
      inline: "nearest",
    });
  }

  element.addEventListener("scroll", onScroll, { passive: true });
  element.addEventListener("wheel", onWheel, { passive: true });
  element.addEventListener("pointerdown", onPointerDown, { passive: true });
  element.addEventListener("touchstart", onPointerDown, { passive: true });

  if (observeResize && typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => {
      scheduleAutoFollow();
      updateBottomState();
    });
    observeContentElement();
  }

  return {
    get isFollowing() {
      return !userScrolled;
    },
    get showScrollButton() {
      return showScrollButton;
    },
    // 兼容旧调用方读取；新代码统一使用 isFollowing。
    get isStuck() {
      return !userScrolled;
    },
    pauseFollowing() {
      setUserScrolled(true);
    },
    resumeFollowing,
    scrollToBottom,
    scrollElementIntoView,
    notifyContentChanged() {
      observeContentElement();
      scheduleAutoFollow();
    },
    notifyUserSubmission,
    setContentElement(nextContentElement) {
      contentElement = nextContentElement || null;
      observeContentElement();
    },
    markUserIntent() {
      userInputActive = true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (pendingAutoFollowFrame !== null) cancelFrame(pendingAutoFollowFrame);
      element.removeEventListener("scroll", onScroll);
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("touchstart", onPointerDown);
      resizeObserver?.disconnect();
    },
  };
}

// 渲染器按 Session 复用控制器，确保局部刷新不会丢失用户滚动意图。
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
