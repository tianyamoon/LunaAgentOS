// Runtime Session Card 动作委托测试。
// Header 在流式 patch 中会替换 innerHTML，按钮点击必须仍走稳定委托。
import assert from "node:assert/strict";
import test from "node:test";

import { createRuntimeSessionCardController } from "./runtimeSessionCardController.js";

function fakeButton(className, sessionId = "s1") {
  return {
    className,
    dataset: { sessionId },
    listeners: {},
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
    closest(selector) {
      if (selector === ".session-action-btn, .session-retry-btn, .session-mini-card") return this;
      if (selector === "button, a, summary, details, input, textarea, select") return this;
      if (selector === ".session-fullscreen-btn" && this.className.includes("session-fullscreen-btn")) return this;
      if (selector === ".session-stop-btn" && this.className.includes("session-stop-btn")) return this;
      return null;
    },
  };
}

function fakeCard(buttons) {
  return {
    dataset: { sessionId: "s1" },
    listeners: {},
    matches(selector) {
      return selector === ".session-card";
    },
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
    querySelectorAll(selector) {
      if (selector === ".session-card") return [this];
      if (selector === ".session-fullscreen-btn") return buttons.filter((b) => b.className.includes("session-fullscreen-btn"));
      if (selector === ".session-stop-btn") return buttons.filter((b) => b.className.includes("session-stop-btn"));
      return [];
    },
  };
}

function controllerFor(overrides = {}) {
  const noop = () => {};
  return createRuntimeSessionCardController({
    sessionDeck: { querySelectorAll: () => [], querySelector: () => null },
    sessionStickRegistry: { get: () => null, ensure: () => null, sweep: noop },
    getSession: () => null,
    renderSessionCard: () => "",
    buildSessionCardViewModel: () => ({}),
    projectRuntimeSessionMessageList: () => ({ rows: [] }),
    runtimeSessionMessageListView: {},
    isSessionLatestOnly: () => false,
    renderMermaidDiagrams: noop,
    scheduleWorkspaceRender: noop,
    focusSessionInWorkspace: noop,
    activateWorkspaceSession: noop,
    toggleSessionFocus: noop,
    dismissWorkspaceSession: noop,
    archiveLiveSession: noop,
    stopSession: noop,
    requestDeleteConfirmation: noop,
    restoreArchivedSession: noop,
    setFlowDetailOpen: noop,
    sessionTranscriptText: () => "",
    copyTextToClipboard: async () => false,
    toggleSessionLatestOnly: noop,
    setAppNotice: noop,
    isAtBottom: () => true,
    t: (key) => key,
    streamRenderIntervalMs: 0,
    ...overrides,
  });
}

test("bindSessionActions: Header 替换后的新按钮仍通过 Card 委托触发动作", () => {
  const calls = [];
  const firstButton = fakeButton("session-fullscreen-btn");
  const card = fakeCard([firstButton]);
  const controller = controllerFor({
    toggleSessionFocus: (id) => calls.push(["focus", id]),
  });

  controller.bindSessionActions(card);
  const replacedButton = fakeButton("session-fullscreen-btn", "s2");
  card.listeners.click({ target: replacedButton });

  assert.deepEqual(calls, [["focus", "s2"]]);
});
