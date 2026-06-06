import test from "node:test";
import assert from "node:assert/strict";
import { shouldRestoreActiveHistoryItem } from "./historyView.js";

test("historyView: 已打开的只读活跃历史再次点击应尝试恢复", () => {
  const readOnlyExisting = { id: "s1", access_mode: "read_only" };
  assert.equal(shouldRestoreActiveHistoryItem(readOnlyExisting, () => false), true);
});

test("historyView: 可发送的现有会话点击时只需要激活", () => {
  const liveExisting = { id: "s1", access_mode: "interactive" };
  assert.equal(shouldRestoreActiveHistoryItem(liveExisting, () => true), false);
});

test("historyView: 不存在工作区会话时由原点击路径负责恢复", () => {
  assert.equal(shouldRestoreActiveHistoryItem(null, () => false), false);
});
