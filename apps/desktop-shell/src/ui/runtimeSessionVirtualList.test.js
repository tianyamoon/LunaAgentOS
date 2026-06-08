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
    offsetWidth: 800,
    clientWidth: 800,
    offsetHeight: 400,
    scrollHeight: 2000,
    clientHeight: 400,
    ownerDocument: {
      defaultView: {
        ResizeObserver: null,
        requestAnimationFrame: () => 1,
        cancelAnimationFrame: () => {},
        setTimeout: () => 1,
        clearTimeout: () => {},
      },
    },
    getBoundingClientRect() {
      return { width: this.clientWidth || this.offsetWidth || 800, height: 400 };
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
    style: {},
    append(node) {
      const previousIndex = this.children.indexOf(node);
      if (previousIndex >= 0) this.children.splice(previousIndex, 1);
      node.parent = this;
      this.children.push(node);
    },
    insertBefore(node, before) {
      const previousIndex = this.children.indexOf(node);
      if (previousIndex >= 0) this.children.splice(previousIndex, 1);
      const idx = this.children.indexOf(before);
      node.parent = this;
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

function fakeRow(id, signature = id, height = 80) {
  return {
    dataset: { messageId: id, messageSignature: signature },
    className: "runtime-message-row",
    style: {},
    innerHTML: "",
    parent: null,
    offsetHeight: height,
    getBoundingClientRect() {
      return { width: 800, height: this.offsetHeight };
    },
    setAttribute(name, value) {
      if (name === "data-index") this.dataset.index = String(value);
    },
    getAttribute(name) {
      if (name === "data-index") return this.dataset.index ?? null;
      return null;
    },
    remove() {
      const index = this.parent?.children.indexOf(this) ?? -1;
      if (index >= 0) this.parent.children.splice(index, 1);
    },
  };
}

function rows(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `row-${index}`,
    kind: "assistant",
    content: `内容 ${index}`,
    status: "completed",
  }));
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

test("runtimeSessionVirtualList: details 展开导致行高变化后重新定位后续行", () => {
  const scroller = fakeScroller();
  const content = fakeContent();
  const frames = [];
  const list = createRuntimeSessionVirtualList({
    scroller,
    content,
    requestFrame: (cb) => { frames.push(cb); return frames.length; },
    cancelFrame: () => {},
  });

  list.reconcile(rows(3), {
    renderRow: (row) => `<div data-message-id="${row.id}" data-message-signature="${row.id}"></div>`,
    createRowElement: (html) => {
      const id = html.match(/data-message-id="([^"]+)"/)?.[1] || "missing";
      return fakeRow(id, id, 80);
    },
  });
  frames.splice(0).forEach((cb) => cb());

  const row0 = content.children.find((child) => child.dataset.messageId === "row-0");
  const row1 = content.children.find((child) => child.dataset.messageId === "row-1");
  const before = Number(row1.style.transform.match(/translateY\(([-\d.]+)/)?.[1] || 0);

  row0.offsetHeight = 180;
  list.measureChangedRows(["row-0"]);
  frames.splice(0).forEach((cb) => cb());
  const after = Number(row1.style.transform.match(/translateY\(([-\d.]+)/)?.[1] || 0);

  assert.ok(after > before);
  assert.equal(after, 188);
  list.dispose();
});

test("runtimeSessionVirtualList: 容器变窄后稳定行也会重新测量高度", () => {
  const scroller = fakeScroller();
  const content = fakeContent();
  const frames = [];
  const heights = new Map([
    ["row-0", 80],
    ["row-1", 80],
  ]);
  const list = createRuntimeSessionVirtualList({
    scroller,
    content,
    requestFrame: (cb) => { frames.push(cb); return frames.length; },
    cancelFrame: () => {},
  });

  list.reconcile(rows(2), {
    renderRow: (row) => `<div data-message-id="${row.id}" data-message-signature="${row.id}"></div>`,
    createRowElement: (html) => {
      const id = html.match(/data-message-id="([^"]+)"/)?.[1] || "missing";
      return fakeRow(id, id, heights.get(id) || 80);
    },
  });
  frames.splice(0).forEach((cb) => cb());

  const row0 = content.children.find((child) => child.dataset.messageId === "row-0");
  const row1 = content.children.find((child) => child.dataset.messageId === "row-1");
  const before = Number(row1.style.transform.match(/translateY\(([-\d.]+)/)?.[1] || 0);

  row0.offsetHeight = 180;
  scroller.clientWidth = 360;
  list.reconcile(rows(2), {
    renderRow: (row) => `<div data-message-id="${row.id}" data-message-signature="${row.id}"></div>`,
    createRowElement: (html) => fakeRow(html.match(/data-message-id="([^"]+)"/)?.[1] || "missing"),
  });
  frames.splice(0).forEach((cb) => cb());
  const after = Number(row1.style.transform.match(/translateY\(([-\d.]+)/)?.[1] || 0);

  assert.ok(after > before);
  assert.equal(after, 188);
  list.dispose();
});

test("runtimeSessionVirtualList: pinned rows stay mounted outside visible range", () => {
  const scroller = fakeScroller();
  const content = fakeContent();
  const list = createRuntimeSessionVirtualList({
    scroller,
    content,
    getPinnedRowIds: () => ["row-60", "row-61"],
    requestFrame: (cb) => { cb(); return 1; },
    cancelFrame: () => {},
  });

  list.reconcile(rows(120), {
    renderRow: (row) => `<div data-message-id="${row.id}" data-message-signature="${row.id}"></div>`,
    createRowElement: (html) => fakeRow(html.match(/data-message-id="([^"]+)"/)?.[1] || "missing"),
  });

  const mountedIds = content.children.map((child) => child.dataset.messageId);
  assert.ok(mountedIds.includes("row-60"));
  assert.ok(mountedIds.includes("row-61"));
  assert.ok(content.children.length < 120);
  list.dispose();
});

test("runtimeSessionVirtualList: first reconcile adopts server-rendered rows without duplicates", () => {
  const scroller = fakeScroller();
  const content = fakeContent();
  content.append(fakeRow("row-0"));
  content.append(fakeRow("row-1"));
  const list = createRuntimeSessionVirtualList({
    scroller,
    content,
    requestFrame: (cb) => { cb(); return 1; },
    cancelFrame: () => {},
  });

  list.reconcile(rows(2), {
    renderRow: (row) => `<div data-message-id="${row.id}" data-message-signature="${row.id}"></div>`,
    createRowElement: (html) => fakeRow(html.match(/data-message-id="([^"]+)"/)?.[1] || "missing"),
  });

  const mountedIds = content.children.map((child) => child.dataset.messageId);
  assert.deepEqual(mountedIds, ["row-0", "row-1"]);
  list.dispose();
});

test("runtimeSessionVirtualList: adopted rows are normalized with current row body", () => {
  const scroller = fakeScroller();
  const content = fakeContent();
  const stale = fakeRow("row-0", "row-0");
  stale.innerHTML = "stale";
  content.append(stale);
  const list = createRuntimeSessionVirtualList({
    scroller,
    content,
    requestFrame: (cb) => { cb(); return 1; },
    cancelFrame: () => {},
  });

  const report = list.reconcile(rows(1), {
    renderRow: (row) => `<div data-message-id="${row.id}" data-message-signature="${row.id}"></div>`,
    renderRowBody: (row) => `fresh:${row.content}`,
    createRowElement: (html) => fakeRow(html.match(/data-message-id="([^"]+)"/)?.[1] || "missing"),
  });

  assert.equal(content.children[0], stale);
  assert.equal(content.children[0].innerHTML, "fresh:内容 0");
  assert.deepEqual(report.changedIds, ["row-0"]);
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

test("runtimeSessionVirtualList: 渲染时维护总高度和稳定完整 rows 索引", () => {
  const scroller = fakeScroller();
  const content = fakeContent();
  const list = createRuntimeSessionVirtualList({
    scroller,
    content,
    requestFrame: (cb) => { cb(); return 1; },
    cancelFrame: () => {},
  });

  const report = list.reconcile(rows(30), {
    renderRow: (row) => `<div data-message-id="${row.id}" data-message-signature="${row.id}"></div>`,
    createRowElement: (html) => fakeRow(html.match(/data-message-id="([^"]+)"/)?.[1] || "missing"),
  });

  assert.ok(report.addedIds.length > 0);
  assert.equal(content.style.position, "relative");
  assert.match(content.style.height, /px$/);
  assert.ok(content.children.length < 30);
  assert.ok(content.children.every((child) => child.dataset.index !== undefined));
  list.dispose();
});

test("runtimeSessionVirtualList: scrollToRow 使用完整 rows 索引而不是已挂载 DOM 索引", () => {
  const scroller = fakeScroller();
  const content = fakeContent();
  const list = createRuntimeSessionVirtualList({
    scroller,
    content,
    requestFrame: (cb) => { cb(); return 1; },
    cancelFrame: () => {},
  });

  list.reconcile(rows(80), {
    renderRow: (row) => `<div data-message-id="${row.id}" data-message-signature="${row.id}"></div>`,
    createRowElement: (html) => fakeRow(html.match(/data-message-id="([^"]+)"/)?.[1] || "missing"),
  });
  list.scrollToRow("row-50");

  assert.ok(scroller.scrollTop >= 50 * 70);
  list.dispose();
});

test("runtimeSessionVirtualList: 测量动态高度后重新定位已挂载行", () => {
  const scroller = fakeScroller();
  const content = fakeContent();
  const frames = [];
  const heights = new Map([
    ["row-0", 32],
    ["row-1", 140],
    ["row-2", 80],
  ]);
  const list = createRuntimeSessionVirtualList({
    scroller,
    content,
    requestFrame: (cb) => { frames.push(cb); return frames.length; },
    cancelFrame: () => {},
  });

  list.reconcile(rows(3), {
    renderRow: (row) => `<div data-message-id="${row.id}" data-message-signature="${row.id}"></div>`,
    createRowElement: (html) => {
      const id = html.match(/data-message-id="([^"]+)"/)?.[1] || "missing";
      return fakeRow(id, id, heights.get(id) || 80);
    },
  });

  const row1 = content.children.find((child) => child.dataset.messageId === "row-1");
  const before = Number(row1.style.transform.match(/translateY\(([-\d.]+)/)?.[1] || 0);
  frames.forEach((cb) => cb());
  const after = Number(row1.style.transform.match(/translateY\(([-\d.]+)/)?.[1] || 0);

  assert.ok(before > 80);
  assert.equal(after, 40);
  list.dispose();
});

test("runtimeSessionVirtualList: running row keeps active classes after body update", () => {
  const scroller = fakeScroller();
  const content = fakeContent();
  const active = fakeRow("row-0", "stale");
  content.append(active);
  const list = createRuntimeSessionVirtualList({
    scroller,
    content,
    requestFrame: (cb) => { cb(); return 1; },
    cancelFrame: () => {},
  });

  list.reconcile([{
    id: "row-0",
    kind: "tool",
    content: "fetching",
    status: "running",
    metadata: {},
  }], {
    renderRow: (row) => `<div data-message-id="${row.id}" data-message-signature="${row.id}"></div>`,
    renderRowBody: (row) => `fresh:${row.content}`,
    createRowElement: (html) => fakeRow(html.match(/data-message-id="([^"]+)"/)?.[1] || "missing"),
  });

  assert.match(active.className, /runtime-message-status-running/);
  assert.match(active.className, /is-active/);
  list.dispose();
});
