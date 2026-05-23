import test from "node:test";
import assert from "node:assert/strict";
import {
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
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
    },
    removeEventListener(type, handler) {
      listeners.get(type)?.delete(handler);
    },
    emit(type) {
      listeners.get(type)?.forEach((handler) => handler());
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

test("returning to the bottom re-sticks the controller", () => {
  const element = createFakeElement({ scrollHeight: 500, clientHeight: 200, scrollTop: 300 });
  const controller = createStickToBottomController(element, { observeResize: false });

  element.scrollTop = 50;
  element.emit("scroll");
  assert.equal(controller.isStuck, false);

  element.scrollTop = element.scrollHeight - element.clientHeight;
  element.emit("scroll");
  assert.equal(controller.isStuck, true);
});

test("notifyContentChanged scrolls to bottom only when stuck", () => {
  const element = createFakeElement({ scrollHeight: 500, clientHeight: 200, scrollTop: 50 });
  const controller = createStickToBottomController(element, { observeResize: false, initialStuck: false });

  element.scrollHeight = 1200;
  controller.notifyContentChanged();
  assert.equal(element.scrollTop, 50);

  element.scrollTop = element.scrollHeight - element.clientHeight;
  element.emit("scroll");
  assert.equal(controller.isStuck, true);

  element.scrollHeight = 2000;
  controller.notifyContentChanged();
  assert.equal(element.scrollTop, 2000);
});

test("programmatic scrollToBottom does not flip the stuck flag", () => {
  const element = createFakeElement({ scrollHeight: 500, clientHeight: 200, scrollTop: 50 });
  const controller = createStickToBottomController(element, { observeResize: false, initialStuck: false });

  controller.scrollToBottom();
  assert.equal(element.scrollTop, 500);
  assert.equal(controller.isStuck, true);

  element.emit("scroll");
  assert.equal(
    controller.isStuck,
    true,
    "scroll event triggered by programmatic call must not unstick",
  );
});

test("dispose removes the scroll listener", () => {
  const element = createFakeElement();
  const controller = createStickToBottomController(element, { observeResize: false });
  controller.dispose();
  element.scrollTop = 0;
  element.emit("scroll");
  assert.equal(controller.isStuck, true, "stuck flag should not move after dispose");
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
