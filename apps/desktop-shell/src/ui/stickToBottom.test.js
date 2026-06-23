import test from "node:test";
import assert from "node:assert/strict";
import {
  bottomGap,
  createStickToBottomController,
  createStickToBottomRegistry,
  isAtBottom,
} from "./stickToBottom.js";

function createFakeElement({ scrollHeight = 500, clientHeight = 200, scrollTop = 300 } = {}) {
  const listeners = new Map();
  const element = {
    scrollHeight,
    clientHeight,
    scrollTop,
    firstElementChild: null,
    scrollTo({ top }) {
      element.scrollTop = top;
    },
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
    },
    removeEventListener(type, handler) {
      listeners.get(type)?.delete(handler);
    },
    emit(type, event = {}) {
      listeners.get(type)?.forEach((handler) => handler({ target: element, ...event }));
    },
  };
  return element;
}

test("isAtBottom reports true within threshold", () => {
  const element = createFakeElement({ scrollHeight: 500, clientHeight: 200, scrollTop: 290 });
  assert.equal(isAtBottom(element, 24), true);
});

test("isAtBottom reports false when user scrolled up", () => {
  const element = createFakeElement({ scrollHeight: 500, clientHeight: 200, scrollTop: 100 });
  assert.equal(isAtBottom(element, 24), false);
});

test("bottomGap reports remaining distance to bottom", () => {
  const element = createFakeElement({ scrollHeight: 900, clientHeight: 300, scrollTop: 420 });
  assert.equal(bottomGap(element), 180);
});

test("controller starts stuck when initialStuck not provided", () => {
  const element = createFakeElement();
  const controller = createStickToBottomController(element, { observeResize: false });
  assert.equal(controller.isStuck, true);
});

test("user scrolling up unsticks the controller", () => {
  const element = createFakeElement({ scrollHeight: 500, clientHeight: 200, scrollTop: 300 });
  const controller = createStickToBottomController(element, { observeResize: false });
  assert.equal(controller.isStuck, true);

  element.scrollTop = 50;
  element.emit("scroll");
  assert.equal(controller.isStuck, false);
});

test("returning to the bottom manually resumes following like AionUi", () => {
  const element = createFakeElement({ scrollHeight: 500, clientHeight: 200, scrollTop: 300 });
  const controller = createStickToBottomController(element, { observeResize: false });

  element.scrollTop = 50;
  element.emit("scroll");
  assert.equal(controller.isStuck, false);

  element.scrollTop = element.scrollHeight - element.clientHeight;
  element.emit("scroll");
  assert.equal(controller.isFollowing, true);
});

test("notifyContentChanged scrolls to bottom only while following", () => {
  const element = createFakeElement({ scrollHeight: 500, clientHeight: 200, scrollTop: 50 });
  const controller = createStickToBottomController(element, { observeResize: false, initialFollowing: false });

  element.scrollHeight = 1200;
  controller.notifyContentChanged();
  assert.equal(element.scrollTop, 50);

  element.scrollHeight = 2000;
  controller.resumeFollowing();
  controller.notifyContentChanged();
  assert.equal(element.scrollTop, 1800);
});

test("notifyContentChanged can observe an explicit content element", () => {
  const observed = [];
  const disconnected = [];
  const PreviousResizeObserver = globalThis.ResizeObserver;
  globalThis.ResizeObserver = class {
    observe(node) {
      observed.push(node);
    }
    disconnect() {
      disconnected.push(true);
    }
  };
  const element = createFakeElement();
  const contentElement = { role: "content" };
  const nextContentElement = { role: "next-content" };
  const controller = createStickToBottomController(element, { contentElement });

  controller.setContentElement(nextContentElement);

  assert.equal(observed.includes(element), true);
  assert.equal(observed.includes(contentElement), true);
  assert.equal(observed.includes(nextContentElement), true);
  assert.equal(disconnected.length >= 1, true);
  controller.dispose();
  globalThis.ResizeObserver = PreviousResizeObserver;
});

test("resumeFollowing scrolls to bottom and restores following", () => {
  const element = createFakeElement({ scrollHeight: 500, clientHeight: 200, scrollTop: 50 });
  const controller = createStickToBottomController(element, { observeResize: false, initialFollowing: false });

  controller.resumeFollowing();
  assert.equal(element.scrollTop, 300);
  assert.equal(controller.isFollowing, true);
});

test("state change reports follow and scroll button state", () => {
  const states = [];
  const element = createFakeElement({ scrollHeight: 1000, clientHeight: 200, scrollTop: 800 });
  const controller = createStickToBottomController(element, {
    observeResize: false,
    onStateChange: (state) => states.push(state),
  });

  element.scrollTop = 200;
  element.emit("wheel", { deltaY: -120 });
  element.emit("scroll");

  assert.equal(controller.isFollowing, false);
  assert.equal(controller.showScrollButton, true);
  assert.equal(states.at(-1).showScrollButton, true);

  controller.resumeFollowing("auto");

  assert.equal(controller.showScrollButton, false);
  assert.equal(states.at(-1).isFollowing, true);
});

test("notifyUserSubmission forces a bottom sync after nested frames", () => {
  const frames = [];
  const element = createFakeElement({ scrollHeight: 1200, clientHeight: 300, scrollTop: 100 });
  const controller = createStickToBottomController(element, {
    observeResize: false,
    initialFollowing: false,
    requestFrame: (callback) => {
      frames.push(callback);
      return frames.length;
    },
    cancelFrame: () => {},
  });

  controller.notifyUserSubmission();

  assert.equal(element.scrollTop, 100);
  frames.shift()();
  assert.equal(element.scrollTop, 100);
  frames.shift()();
  assert.equal(element.scrollTop, 900);
  assert.equal(controller.isFollowing, true);
});

test("wheel pointer and touch gestures arm manual escape when viewport moves", () => {
  const element = createFakeElement();
  const controller = createStickToBottomController(element, { observeResize: false });

  element.emit("wheel", { deltaY: -20 });
  element.scrollTop = 50;
  element.emit("scroll");
  assert.equal(controller.isFollowing, false);
  controller.resumeFollowing();
  element.emit("pointerdown");
  element.scrollTop = 50;
  element.emit("scroll");
  assert.equal(controller.isFollowing, false);
  controller.resumeFollowing();
  element.emit("touchstart");
  element.scrollTop = 50;
  element.emit("scroll");
  assert.equal(controller.isFollowing, false);
});

test("wheel down keeps following while wheel up escapes", () => {
  const element = createFakeElement();
  const controller = createStickToBottomController(element, { observeResize: false });

  element.emit("wheel", { deltaY: 120 });
  assert.equal(controller.isFollowing, true);

  element.emit("wheel", { deltaY: -120 });
  element.scrollTop = 50;
  element.emit("scroll");
  assert.equal(controller.isFollowing, false);
});

test("pointer down inside transcript does not escape following", () => {
  const element = createFakeElement();
  const controller = createStickToBottomController(element, { observeResize: false });

  element.emit("pointerdown");

  assert.equal(controller.isFollowing, true);
});

test("scrollElementIntoView targets an explicit execution anchor", () => {
  const element = createFakeElement();
  const calls = [];
  const target = {
    scrollIntoView(options) {
      calls.push(options);
    },
  };
  const controller = createStickToBottomController(element, { observeResize: false });

  controller.scrollElementIntoView(target, { behavior: "auto", block: "nearest" });

  assert.deepEqual(calls, [{ behavior: "auto", block: "nearest", inline: "nearest" }]);
  assert.equal(controller.isFollowing, true);
});

test("dispose removes the scroll listener", () => {
  const element = createFakeElement();
  const controller = createStickToBottomController(element, { observeResize: false });
  controller.dispose();
  element.scrollTop = 0;
  element.emit("scroll");
  assert.equal(controller.isFollowing, true, "following flag should not move after dispose");
});

test("registry reuses controllers for the same element", () => {
  const element = createFakeElement();
  const registry = createStickToBottomRegistry({
    factory: (el, opts) => createStickToBottomController(el, { ...opts, observeResize: false }),
  });

  const first = registry.ensure("session-a", element);
  const second = registry.ensure("session-a", element);
  assert.equal(first, second);
});

test("registry replaces controllers when the element changes", () => {
  const elementA = createFakeElement();
  const elementB = createFakeElement();
  const registry = createStickToBottomRegistry({
    factory: (el, opts) => createStickToBottomController(el, { ...opts, observeResize: false }),
  });

  const first = registry.ensure("session-a", elementA);
  const second = registry.ensure("session-a", elementB);
  assert.notEqual(first, second);
});

test("registry.sweep disposes controllers for removed sessions", () => {
  const elementA = createFakeElement();
  const elementB = createFakeElement();
  const registry = createStickToBottomRegistry({
    factory: (el, opts) => createStickToBottomController(el, { ...opts, observeResize: false }),
  });

  registry.ensure("session-a", elementA);
  registry.ensure("session-b", elementB);
  registry.sweep(["session-a"]);

  assert.notEqual(registry.get("session-a"), null);
  assert.equal(registry.get("session-b"), null);
});
