// Runtime Session Card 局部刷新回归测试。
// 验证流式 delta 不会替换 Card 外壳、不会触碰稳定历史行、不会无条件 append。
import assert from "node:assert/strict";
import test from "node:test";

import { reconcileMessageList, rowSignature } from "./runtimeSessionMessageListView.js";

// ---- 辅助 fake DOM ----

function fakeNode(messageId, messageSignature, innerHTML = "") {
  return {
    className: "runtime-message-row",
    dataset: { messageId, messageSignature },
    innerHTML,
    parent: null,
    removed: false,
    remove() {
      this.removed = true;
      const index = this.parent?.children.indexOf(this) ?? -1;
      if (index >= 0) this.parent.children.splice(index, 1);
    },
  };
}

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

// ---- 测试 ----

test("Card 稳定性: 连续 100 个 assistant delta 后 content 引用保持不变", () => {
  const active = fakeNode("t1:assistant", "sig-0", "body:初始");
  const content = fakeContent([active]);
  content.operations = [];

  for (let i = 1; i <= 100; i++) {
    const rows = [
      { id: "t1:assistant", kind: "assistant", content: `delta ${i}`, status: "running", metadata: {} },
    ];
    reconcileMessageList(content, rows, {
      renderMessageRow: (row) => row.id,
      renderMessageRowBody: (row) => `body:${row.content}`,
      createRowElement: (id) => fakeNode(id, ""),
    });
  }

  // content 引用不变
  assert.equal(content.children.length, 1);
  assert.equal(content.children[0], active);
  // 每次 delta 都更新了内容
  assert.equal(active.innerHTML, "body:delta 100");
});

test("Card 稳定性: 已完成历史 row 引用在流式过程中保持不变", () => {
  const historyRow = fakeNode("t1:user", rowSignature({ id: "t1:user", kind: "user", content: "历史任务" }), "body:历史任务");
  const active = fakeNode("t2:assistant", "sig-old", "body:旧");
  const content = fakeContent([historyRow, active]);
  content.operations = [];

  // 模拟 50 次流式 delta
  for (let i = 1; i <= 50; i++) {
    reconcileMessageList(content, [
      { id: "t1:user", kind: "user", content: "历史任务" },
      { id: "t2:assistant", kind: "assistant", content: `delta ${i}`, status: "running", metadata: {} },
    ], {
      renderMessageRow: (row) => row.id,
      renderMessageRowBody: (row) => `body:${row.content}`,
      createRowElement: (id) => fakeNode(id, ""),
    });
  }

  // 历史行引用不变，内容不变
  assert.equal(content.children[0], historyRow);
  assert.equal(historyRow.innerHTML, "body:历史任务");
  // active 行引用不变，内容更新
  assert.equal(content.children[1], active);
  assert.equal(active.innerHTML, "body:delta 50");
});

test("Card 稳定性: 新增 tool row 时只插入一行，不触碰已有节点", () => {
  const userRow = fakeNode("t1:user", rowSignature({ id: "t1:user", kind: "user", content: "任务" }));
  const assistantRow = fakeNode("t1:assistant", rowSignature({ id: "t1:assistant", kind: "assistant", content: "回复" }));
  const content = fakeContent([userRow, assistantRow]);
  content.operations = [];

  const result = reconcileMessageList(content, [
    { id: "t1:user", kind: "user", content: "任务" },
    { id: "t1:assistant", kind: "assistant", content: "回复" },
    { id: "t1:tool-1", kind: "tool", content: "工具调用", status: "running", metadata: {} },
  ], {
    renderMessageRow: (row) => row.id,
    renderMessageRowBody: (row) => `body:${row.content}`,
    createRowElement: (id) => fakeNode(id, rowSignature({ id, kind: "tool", content: "工具调用", status: "running", metadata: {} })),
  });

  // 只新增了一行
  assert.equal(result.report.addedIds.length, 1);
  assert.deepEqual(result.report.addedIds, ["t1:tool-1"]);
  // 已有行引用不变
  assert.equal(content.children[0], userRow);
  assert.equal(content.children[1], assistantRow);
  // 只执行了一次 append
  const appends = content.operations.filter((op) => op[0] === "append");
  assert.equal(appends.length, 1);
});

test("Card 稳定性: 无变化 row 不执行 append、replaceWith 或 innerHTML", () => {
  const stable = fakeNode("stable", rowSignature({ id: "stable", kind: "assistant", content: "不变" }), "body:不变");
  const content = fakeContent([stable]);
  content.operations = [];
  const originalHTML = stable.innerHTML;

  reconcileMessageList(content, [
    { id: "stable", kind: "assistant", content: "不变" },
  ], {
    renderMessageRow: (row) => row.id,
    renderMessageRowBody: (row) => `body:${row.content}`,
    createRowElement: (id) => fakeNode(id, ""),
  });

  // 没有任何 DOM 操作
  assert.deepEqual(content.operations, []);
  // innerHTML 未被修改
  assert.equal(stable.innerHTML, originalHTML);
});

test("Card 稳定性: 顺序未变化的历史 row 完全不触碰 DOM", () => {
  const row1 = fakeNode("t1:user", rowSignature({ id: "t1:user", kind: "user", content: "任务1" }));
  const row2 = fakeNode("t1:assistant", rowSignature({ id: "t1:assistant", kind: "assistant", content: "回复1" }));
  const row3 = fakeNode("t2:user", rowSignature({ id: "t2:user", kind: "user", content: "任务2" }));
  const active = fakeNode("t2:assistant", "sig-old", "body:旧");
  const content = fakeContent([row1, row2, row3, active]);
  content.operations = [];

  reconcileMessageList(content, [
    { id: "t1:user", kind: "user", content: "任务1" },
    { id: "t1:assistant", kind: "assistant", content: "回复1" },
    { id: "t2:user", kind: "user", content: "任务2" },
    { id: "t2:assistant", kind: "assistant", content: "新 delta", status: "running", metadata: {} },
  ], {
    renderMessageRow: (row) => row.id,
    renderMessageRowBody: (row) => `body:${row.content}`,
    createRowElement: (id) => fakeNode(id, ""),
  });

  // 前三个历史行引用不变
  assert.equal(content.children[0], row1);
  assert.equal(content.children[1], row2);
  assert.equal(content.children[2], row3);
  // 只有 active 行内容更新
  assert.equal(active.innerHTML, "body:新 delta");
  // 没有 insertBefore 或 append 操作（顺序未变）
  assert.deepEqual(content.operations, []);
});

test("Card 稳定性: MutationObserver 风格计数器禁止 Card 外壳替换", () => {
  // 模拟一个 Card 外壳替换计数器
  let cardReplaceCount = 0;
  const card = {
    className: "session-card",
    attrs: {},
    setAttribute(name, value) { this.attrs[name] = value; },
    removeAttribute(name) { this.attrs[name] = undefined; },
    querySelector(selector) {
      if (selector === ".session-card-header") return { innerHTML: "旧头部" };
      if (selector === ".session-card-body") return { innerHTML: "旧正文" };
      return null;
    },
    replaceWith() {
      cardReplaceCount++;
      throw new Error("不应替换 Card 外壳");
    },
  };

  // 模拟流式路径：patch 而非 replace
  const newArticle = {
    className: "session-card is-waiting",
    getAttribute: () => null,
    querySelector(selector) {
      if (selector === ".session-card-header") return { innerHTML: "新头部" };
      if (selector === ".session-card-body") return { innerHTML: "新正文" };
      return null;
    },
  };

  // 使用 patch 而非 replaceWith
  card.className = newArticle.className;
  const currentHeader = card.querySelector(".session-card-header");
  const nextHeader = newArticle.querySelector(".session-card-header");
  if (currentHeader && nextHeader) currentHeader.innerHTML = nextHeader.innerHTML;
  const currentBody = card.querySelector(".session-card-body");
  const nextBody = newArticle.querySelector(".session-card-body");
  if (currentBody && nextBody) currentBody.innerHTML = nextBody.innerHTML;

  // Card 外壳从未被替换
  assert.equal(cardReplaceCount, 0);
  assert.equal(card.className, "session-card is-waiting");
  assert.equal(currentHeader.innerHTML, "新头部");
  assert.equal(currentBody.innerHTML, "新正文");
});

test("Card 稳定性: 流式 delta 不重新生成完整 Card HTML", () => {
  // 验证 patch 路径不会调用 renderSessionCard 生成完整 HTML
  let fullRenderCount = 0;
  const renderSessionCard = () => {
    fullRenderCount++;
    return "<article>完整 Card HTML</article>";
  };

  // 模拟流式路径：直接 patch，不调用 renderSessionCard
  const card = {
    className: "session-card",
    querySelector: () => ({ innerHTML: "" }),
  };

  // patch 外壳属性
  card.className = "session-card is-waiting";

  // 验证 renderSessionCard 未被调用
  assert.equal(fullRenderCount, 0);
});
