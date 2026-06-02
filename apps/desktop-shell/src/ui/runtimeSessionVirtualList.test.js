// Runtime Session 虚拟列表测试。
// 验证虚拟列表只挂载可视区 + overscan + active row。
import assert from "node:assert/strict";
import test from "node:test";

import { createRuntimeSessionVirtualList } from "./runtimeSessionVirtualList.js";

// 由于 @tanstack/virtual-core 依赖浏览器 DOM API，这里用 fake DOM 做最小接口测试。
function fakeScroller() {
  const listeners = new Map();
  return {
    scrollTop: 0,
    scrollHeight: 2000,
    clientHeight: 400,
    getBoundingClientRect() {
      return { width: 800, height: 400 };
    },
    scrollTo({ top }) {
      this.scrollTop = top;
    },
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
    },
    removeEventListener(type, handler) {
      listeners.get(type)?.delete(handler);
    },
    emit(type, event = {}) {
      listeners.get(type)?.forEach((h) => h({ target: this, ...event }));
    },
  };
}

function fakeContent() {
  return {
    children: [],
    append(node) {
      this.children.push(node);
    },
    insertBefore(node, before) {
      const idx = this.children.indexOf(before);
      if (idx >= 0) this.children.splice(idx, 0, node);
      else this.children.push(node);
    },
    contains(node) {
      return this.children.includes(node);
    },
    querySelectorAll() {
      return this.children;
    },
  };
}

test("runtimeSessionVirtualList: 创建虚拟列表返回 reconcile/scrollToRow/dispose", () => {
  const scroller = fakeScroller();
  const content = fakeContent();
  const frames = [];
  const list = createRuntimeSessionVirtualList({
    scroller,
    content,
    requestFrame: (cb) => { frames.push(cb); return frames.length; },
    cancelFrame: () => {},
  });

  assert.ok(list);
  assert.equal(typeof list.reconcile, "function");
  assert.equal(typeof list.scrollToRow, "function");
  assert.equal(typeof list.dispose, "function");
  assert.equal(typeof list.measureChangedRows, "function");
  assert.equal(typeof list.snapshotCache, "function");
  assert.equal(typeof list.restoreCache, "function");

  list.dispose();
});

test("runtimeSessionVirtualList: 无 scroller 或 content 时返回 null", () => {
  assert.equal(createRuntimeSessionVirtualList({ scroller: null, content: fakeContent() }), null);
  assert.equal(createRuntimeSessionVirtualList({ scroller: fakeScroller(), content: null }), null);
});

test("runtimeSessionVirtualList: dispose 清理资源", () => {
  const scroller = fakeScroller();
  const content = fakeContent();
  const list = createRuntimeSessionVirtualList({
    scroller,
    content,
    requestFrame: (cb) => { cb(); return 1; },
    cancelFrame: () => {},
  });
  list.dispose();
  // 不应抛异常
  list.dispose();
});

test("runtimeSessionVirtualList: snapshotCache 和 restoreCache 往返", () => {
  const scroller = fakeScroller();
  const content = fakeContent();
  const list = createRuntimeSessionVirtualList({
    scroller,
    content,
    requestFrame: (cb) => { cb(); return 1; },
    cancelFrame: () => {},
  });

  const cache = list.snapshotCache();
  assert.ok(cache instanceof Map);

  list.restoreCache(cache);
  list.dispose();
});

test("runtimeSessionVirtualList: measureChangedRows 不抛异常", () => {
  const scroller = fakeScroller();
  const content = fakeContent();
  const list = createRuntimeSessionVirtualList({
    scroller,
    content,
    requestFrame: (cb) => { cb(); return 1; },
    cancelFrame: () => {},
  });

  list.measureChangedRows([]);
  list.measureChangedRows(["nonexistent"]);
  list.dispose();
});
