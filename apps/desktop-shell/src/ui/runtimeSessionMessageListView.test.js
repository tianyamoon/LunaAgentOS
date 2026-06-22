import assert from "node:assert/strict";
import test from "node:test";

import {
  createMergedReconciler,
  createRuntimeSessionMessageListView,
  formatRuntimeMessageDuration,
  messageRowClass,
  reconcileMessageList,
  rowSignature,
} from "./runtimeSessionMessageListView.js";

test("runtimeSessionMessageListView: 渲染稳定 MessageList 外壳与浮动按钮", () => {
  const view = createView();
  const html = view.renderMessageListShell({
    rows: [
      { id: "t1:user", kind: "user", content: "检查项目", metadata: {} },
      { id: "t1:assistant", kind: "assistant", content: "已经完成", status: "completed", metadata: { final: true } },
    ],
  });

  assert.match(html, /data-runtime-message-scroller/);
  assert.match(html, /data-runtime-message-content/);
  assert.match(html, /data-runtime-scroll-latest hidden/);
  assert.match(html, /data-message-id="t1:user"/);
  assert.match(html, /data-phase="final"/);
  assert.doesNotMatch(html, /runtime-message-label/);
});

test("runtimeSessionMessageListView: worked row folds completed trace and debug into one details", () => {
  const view = createView();
  const html = view.renderMessageRow({
    id: "t1:worked",
    kind: "worked_for",
    status: "completed",
    metadata: {
      summary: { durationMs: 65_000, toolCount: 2, fileChangeCount: 1 },
      rows: [{ id: "t1:trace:thinking", kind: "thinking", content: "analyze", status: "completed" }],
      debug: { rawEvents: [{ type: "tool", payload: { id: "tool-1" } }], logs: ["log line"] },
    },
  });

  assert.match(html, /runtime-message-worked-for/);
  assert.match(html, /Turn completed/);
  assert.match(html, /Duration 1m 5s/);
  assert.match(html, /Expand/);
  assert.match(html, /Collapse trace/);
  assert.match(html, /runtime-message-trace-row-thinking/);
  assert.match(html, /runtime-message-debug-placeholder/);
  assert.equal(formatRuntimeMessageDuration(5_000), "5s");
});

test("runtimeSessionMessageListView: worked row uses completion scoped detail key", () => {
  const requestedKeys = [];
  const view = createView({
    isOpenForKey: (key, defaultOpen) => {
      requestedKeys.push([key, defaultOpen]);
      return key === "t1:worked:message-worked-for";
    },
  });

  const html = view.renderMessageRow({
    id: "t1:worked",
    kind: "worked_for",
    status: "completed",
    metadata: {
      detailKey: "t1:completed:done:worked-for",
      summary: { durationMs: 5_000, toolCount: 0, fileChangeCount: 0 },
      rows: [],
    },
  });

  assert.deepEqual(requestedKeys, [["t1:completed:done:worked-for", false]]);
  assert.match(html, /data-detail-key="t1:completed:done:worked-for"/);
  assert.doesNotMatch(html, /<details[^>]* open/);
});

test("runtimeSessionMessageListView: compact event row uses projected detail key", () => {
  const requestedKeys = [];
  const view = createView({
    isOpenForKey: (key, defaultOpen) => {
      requestedKeys.push([key, defaultOpen]);
      return key === "completed-tool-key";
    },
  });

  const html = view.renderMessageRow({
    id: "t1:completed-timeline:tool-1",
    kind: "tool",
    status: "completed",
    content: "Read file",
    metadata: { detailKey: "completed-tool-key", turnCompleted: true },
  });

  assert.deepEqual(requestedKeys, [["completed-tool-key", false]]);
  assert.match(html, /data-detail-key="completed-tool-key"/);
  assert.match(html, /<details[^>]* open/);
});

test("runtimeSessionMessageListView: completed timeline does not render a separate completion bar", () => {
  const view = createView();
  const html = view.renderMessageListShell({
    rows: [
      {
        id: "t1:worked",
        kind: "worked_for",
        status: "completed",
        metadata: {
          summary: { durationMs: 8_000, toolCount: 1, fileChangeCount: 0 },
          rows: [{ id: "t1:tool", kind: "tool", content: "read_file", status: "completed", metadata: { turnCompleted: true } }],
        },
      },
    ],
  });

  assert.doesNotMatch(html, /runtime-completion-bar/);
  assert.match(html, /runtime-message-worked-for/);
  assert.match(html, /Turn completed/);
  assert.match(html, /Duration 8s/);
  assert.match(html, /runtime-message-trace-row-tool/);
});

test("runtimeSessionMessageListView: failed worked row does not claim completion", () => {
  const view = createView();
  const html = view.renderMessageRow({
    id: "t1:worked",
    kind: "worked_for",
    status: "failed",
    metadata: {
      summary: { durationMs: 3_000, toolCount: 0, fileChangeCount: 0 },
      rows: [{ id: "t1:error", kind: "error", content: "runtime exited", status: "failed" }],
      debug: { rawEvents: [{ type: "error" }], logs: ["runtime exited"] },
    },
  });

  assert.match(html, /Turn failed/);
  assert.doesNotMatch(html, /Turn completed/);
  assert.match(html, /runtime-message-worked-for-failed/);
});

test("runtimeSessionMessageListView: cancelled worked row uses cancelled title", () => {
  const view = createView();
  const html = view.renderMessageRow({
    id: "t1:worked",
    kind: "worked_for",
    status: "cancelled",
    metadata: {
      summary: { durationMs: 1_000, toolCount: 0, fileChangeCount: 0 },
      rows: [],
    },
  });

  assert.match(html, /Turn cancelled/);
  assert.doesNotMatch(html, /Turn completed/);
});

test("runtimeSessionMessageListView: Debug 折叠态保留可展开 JSON 模板", () => {
  const view = createView();
  const html = view.renderMessageRow({
    id: "debug-1",
    kind: "debug",
    metadata: {
      rawEvents: [{ type: "tool", payload: { id: "tool-1" } }],
      logs: ["工具调用"],
    },
  });

  assert.match(html, /runtime-message-debug-placeholder/);
  assert.match(html, /template data-debug-json/);
  assert.match(html, /tool-1/);
});

test("runtimeSessionMessageListView: 对账保留已有行节点并只移除过期行", () => {
  const oldStable = fakeNode("stable", rowSignature({ id: "stable", kind: "assistant", content: "不变" }));
  const oldChanged = fakeNode("changed", "old-signature");
  const oldRemoved = fakeNode("removed", "removed-signature");
  const content = fakeContent([oldStable, oldChanged, oldRemoved]);
  const rows = [
    { id: "stable", kind: "assistant", content: "不变" },
    { id: "changed", kind: "assistant", content: "更新" },
    { id: "added", kind: "tool", content: "新增" },
  ];

  const result = reconcileMessageList(content, rows, {
    renderMessageRow: (row) => row.id,
    renderMessageRowBody: (row) => `body:${row.content}`,
    createRowElement: (id) => fakeNode(id, rowSignature(rows.find((row) => row.id === id))),
  });

  assert.equal(result.nodes[0], oldStable);
  assert.equal(result.nodes[1], oldChanged);
  assert.equal(oldChanged.innerHTML, "body:更新");
  assert.equal(oldRemoved.removed, true);
  assert.deepEqual(content.children.map((node) => node.dataset.messageId), ["stable", "changed", "added"]);
  assert.deepEqual(result.report, {
    addedIds: ["added"],
    changedIds: ["changed"],
    movedIds: [],
    removedIds: ["removed"],
    stableIds: ["stable"],
  });
});

test("runtimeSessionMessageListView: 未变化且顺序稳定的行不应被重新 append", () => {
  const stable = fakeNode("stable", rowSignature({ id: "stable", kind: "assistant", content: "不变" }));
  const content = fakeContent([stable]);
  content.operations = [];

  const result = reconcileMessageList(content, [
    { id: "stable", kind: "assistant", content: "不变" },
  ], {
    renderMessageRow: (row) => row.id,
    renderMessageRowBody: (row) => `body:${row.content}`,
    createRowElement: (id) => fakeNode(id, ""),
  });

  assert.equal(result.nodes[0], stable);
  assert.deepEqual(result.report.stableIds, ["stable"]);
  assert.deepEqual(content.operations, []);
});

test("runtimeSessionMessageListView: active row 变化时只更新该行内容", () => {
  const stable = fakeNode("stable", rowSignature({ id: "stable", kind: "assistant", content: "历史" }));
  const active = fakeNode("active", "old-signature");
  const content = fakeContent([stable, active]);
  content.operations = [];

  reconcileMessageList(content, [
    { id: "stable", kind: "assistant", content: "历史" },
    { id: "active", kind: "assistant", content: "最新 delta", status: "running" },
  ], {
    renderMessageRow: (row) => row.id,
    renderMessageRowBody: (row) => `body:${row.content}`,
    createRowElement: (id) => fakeNode(id, ""),
  });

  assert.equal(stable.innerHTML, "");
  assert.equal(active.innerHTML, "body:最新 delta");
  assert.match(active.className, /runtime-message-status-running/);
  assert.match(active.className, /is-active/);
  assert.deepEqual(content.operations, []);
});

test("runtimeSessionMessageListView: running row class is shared by render and reconcile", () => {
  const row = { id: "active", kind: "tool", content: "fetching", status: "running", metadata: {} };
  const view = createView();
  assert.match(view.renderMessageRow(row), /runtime-message-status-running/);
  assert.match(messageRowClass(row), /is-active/);
});

test("runtimeSessionMessageListView: reconnecting runtime row is visible without running classes", () => {
  const row = {
    id: "session:runtime:load",
    kind: "runtime",
    content: "Restoring runtime",
    status: "reconnecting",
    metadata: { source: "runtime_binding", stage: "load" },
  };
  const view = createView();
  const html = view.renderMessageRow(row);

  assert.match(html, /runtime-message-status-reconnecting/);
  assert.doesNotMatch(html, /runtime-message-status-running/);
  assert.doesNotMatch(messageRowClass(row), /is-active/);
});

test("runtimeSessionMessageListView: 换序时只移动真实错位的行", () => {
  const first = fakeNode("first", rowSignature({ id: "first", kind: "tool", content: "1" }));
  const second = fakeNode("second", rowSignature({ id: "second", kind: "tool", content: "2" }));
  const content = fakeContent([first, second]);
  content.operations = [];

  const result = reconcileMessageList(content, [
    { id: "second", kind: "tool", content: "2" },
    { id: "first", kind: "tool", content: "1" },
  ], {
    renderMessageRow: (row) => row.id,
    renderMessageRowBody: (row) => `body:${row.content}`,
    createRowElement: (id) => fakeNode(id, ""),
  });

  assert.deepEqual(content.children.map((node) => node.dataset.messageId), ["second", "first"]);
  assert.deepEqual(result.report.movedIds, ["second"]);
  assert.deepEqual(content.operations, [["insertBefore", "second", "first"]]);
});

function createView(overrides = {}) {
  return createRuntimeSessionMessageListView({
    renderAssistantResponse: (content, phase) => `<article data-phase="${phase}">${content}</article>`,
    isOpenForKey: overrides.isOpenForKey || (() => false),
    t: (key, values = {}) => {
      const messages = {
        "action.scrollLatest": "Scroll to latest",
        "turn.timeline.assistant": "Assistant",
        "turn.timeline.thinking": "Thinking",
        "turn.timeline.workedFor": "Worked for {duration}{tools}{files}",
        "turn.timeline.completionTitle": "Turn completed",
        "turn.timeline.failedTitle": "Turn failed",
        "turn.timeline.cancelledTitle": "Turn cancelled",
        "turn.timeline.duration": "Duration {duration}",
        "turn.timeline.expandHint": "Expand",
        "turn.timeline.collapseHint": "Collapse trace",
        "turn.timeline.thinkingCount": " | {count} thoughts",
        "turn.timeline.runtimeCount": " | {count} runtime",
        "turn.timeline.responseCount": " | {count} replies",
        "turn.timeline.debugCount": " | {count} diagnostics",
        "turn.timeline.toolCount": " · {count} tools",
        "turn.timeline.fileCount": " · {count} files",
      };
      return Object.entries(values).reduce(
        (text, [name, value]) => text.replace(`{${name}}`, value),
        messages[key] || key,
      );
    },
    escapeHtml: (value) => String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("\"", "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;"),
  });
}

// Fake DOM 只覆盖 keyed 对账需要的最小接口，避免把浏览器实现带入纯逻辑回归。
function fakeContent(nodes) {
  const content = {
    children: [],
    operations: [],
    querySelectorAll: () => content.children,
    append(node) {
      content.operations.push(["append", node.dataset.messageId]);
      const previousIndex = content.children.indexOf(node);
      if (previousIndex >= 0) content.children.splice(previousIndex, 1);
      node.parent = content;
      content.children.push(node);
    },
    insertBefore(node, before) {
      content.operations.push(["insertBefore", node.dataset.messageId, before?.dataset?.messageId || null]);
      const previousIndex = content.children.indexOf(node);
      if (previousIndex >= 0) content.children.splice(previousIndex, 1);
      const nextIndex = content.children.indexOf(before);
      node.parent = content;
      if (nextIndex >= 0) content.children.splice(nextIndex, 0, node);
      else content.children.push(node);
    },
  };
  nodes.forEach((node) => content.append(node));
  content.operations = [];
  return content;
}

function fakeNode(messageId, messageSignature) {
  return {
    className: "runtime-message-row",
    dataset: { messageId, messageSignature },
    innerHTML: "",
    parent: null,
    removed: false,
    remove() {
      this.removed = true;
      const index = this.parent?.children.indexOf(this) ?? -1;
      if (index >= 0) this.parent.children.splice(index, 1);
    },
  };
}

test("createMergedReconciler: 同一帧内多次对账只执行最后一次", () => {
  const frames = [];
  const reconciler = createMergedReconciler({
    requestFrame: (cb) => { frames.push(cb); return frames.length; },
    cancelFrame: () => {},
  });

  const active = fakeNode("active", "sig-old");
  const content = fakeContent([active]);
  content.operations = [];

  // 同一帧内三次对账
  reconciler.mergeReconcile(content, [
    { id: "active", kind: "assistant", content: "delta 1", status: "running", metadata: {} },
  ], {
    renderMessageRow: (row) => row.id,
    renderMessageRowBody: (row) => `body:${row.content}`,
    createRowElement: (id) => fakeNode(id, ""),
  });
  reconciler.mergeReconcile(content, [
    { id: "active", kind: "assistant", content: "delta 2", status: "running", metadata: {} },
  ], {
    renderMessageRow: (row) => row.id,
    renderMessageRowBody: (row) => `body:${row.content}`,
    createRowElement: (id) => fakeNode(id, ""),
  });
  reconciler.mergeReconcile(content, [
    { id: "active", kind: "assistant", content: "delta 3", status: "running", metadata: {} },
  ], {
    renderMessageRow: (row) => row.id,
    renderMessageRowBody: (row) => `body:${row.content}`,
    createRowElement: (id) => fakeNode(id, ""),
  });

  // 帧回调尚未执行，内容未变
  assert.equal(active.innerHTML, "");

  // 执行帧回调
  frames.forEach((cb) => cb());

  // 只有最后一次 delta 生效
  assert.equal(active.innerHTML, "body:delta 3");
});

test("createMergedReconciler: flushPending 立即执行待处理对账", () => {
  const reconciler = createMergedReconciler({
    requestFrame: () => 1,
    cancelFrame: () => {},
  });

  const active = fakeNode("active", "sig-old");
  const content = fakeContent([active]);
  content.operations = [];

  reconciler.mergeReconcile(content, [
    { id: "active", kind: "assistant", content: "立即生效", status: "running", metadata: {} },
  ], {
    renderMessageRow: (row) => row.id,
    renderMessageRowBody: (row) => `body:${row.content}`,
    createRowElement: (id) => fakeNode(id, ""),
  });

  const result = reconciler.flushPending();
  assert.equal(active.innerHTML, "body:立即生效");
  assert.ok(result);
});

test("rowSignature: 相同内容产生相同签名", () => {
  const row1 = { id: "a", kind: "assistant", content: "hello", status: "completed", metadata: {} };
  const row2 = { id: "a", kind: "assistant", content: "hello", status: "completed", metadata: {} };
  assert.equal(rowSignature(row1), rowSignature(row2));
});

test("rowSignature: 不同内容产生不同签名", () => {
  const row1 = { id: "a", kind: "assistant", content: "hello", status: "completed", metadata: {} };
  const row2 = { id: "a", kind: "assistant", content: "world", status: "completed", metadata: {} };
  assert.notEqual(rowSignature(row1), rowSignature(row2));
});

test("rowSignature: 忽略不影响渲染的字段", () => {
  const row1 = { id: "a", kind: "assistant", content: "hello", status: "completed", metadata: {}, turnId: "t1" };
  const row2 = { id: "b", kind: "assistant", content: "hello", status: "completed", metadata: {}, turnId: "t2" };
  assert.equal(rowSignature(row1), rowSignature(row2));
});
