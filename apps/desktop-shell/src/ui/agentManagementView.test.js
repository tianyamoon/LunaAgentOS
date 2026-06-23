import test from "node:test";
import assert from "node:assert/strict";

import { createAgentManagementView } from "./agentManagementView.js";

// 弹窗测试使用最小 DOM 壳，只验证视图模块是否独立完成可用性弹窗渲染。
test("agentManagementView: 可用性弹窗由统一视图打开", () => {
  const confirmDialog = {
    hidden: true,
    innerHTML: "",
    querySelectorAll() {
      return [];
    },
    querySelector() {
      return null;
    },
  };
  const store = {
    data: {
      summary: {
        providers: { total: 0, available: 0 },
        runtimes: { total: 0, available: 0 },
        targets: { total: 0, sendable: 0 },
      },
      providers: [],
      problems: [],
      lastCheck: "2026-06-01T00:00:00.000Z",
    },
    getData() {
      return this.data;
    },
    refresh() {
      return this.data;
    },
  };
  const view = createAgentManagementView({
    confirmDialog,
    getAvailabilityStore: () => store,
    providersSnapshot: () => [],
    runtimeInstancesSnapshot: () => [],
    getRuntimeAvailabilitySnapshot: () => ({}),
    currentTargetAgent: () => null,
    t: (key) => key,
  });

  view.openAvailabilityModal();

  assert.equal(confirmDialog.hidden, false);
  assert.match(confirmDialog.innerHTML, /availability-dialog/);
  assert.match(confirmDialog.innerHTML, /availability\.title/);
});
