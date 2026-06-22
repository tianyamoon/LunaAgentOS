import test from "node:test";
import assert from "node:assert/strict";

import {
  createRuntimeSessionCardController,
  focusNewPromptInMessageList,
  patchSessionCardPreservingBody,
} from "./runtimeSessionCardController.js";

test("focusNewPromptInMessageList: 新 prompt 定位后恢复跟随底部", () => {
  const calls = [];

  const focused = focusNewPromptInMessageList({
    targetRowId: "turn-5:user",
    virtualList: {
      scrollToRow(rowId, options) {
        calls.push(["target", rowId, options.align]);
      },
    },
    controller: {
      notifyUserSubmission() {
        calls.push(["follow-bottom"]);
      },
    },
  });

  assert.equal(focused, true);
  assert.deepEqual(calls, [
    ["target", "turn-5:user", "start"],
    ["follow-bottom"],
  ]);
});

// mini card 必须同时更新焦点和当前 Session，避免全屏内容与缩略图脱节。
test("runtimeSessionCardController: mini card 点击统一切换焦点与当前 Session", () => {
  const calls = [];
  const listeners = {};
  const miniCard = {
    dataset: { sessionId: "session-b" },
    disabled: false,
    closest(selector) {
      if (selector === ".session-action-btn, .session-retry-btn, .session-mini-card") return this;
      if (selector === ".session-mini-card") return this;
      return null;
    },
  };
  const sessionDeck = {
    matches() {
      return false;
    },
    addEventListener(type, listener) {
      listeners[type] = listener;
    },
    querySelectorAll(selector) {
      return selector === ".session-mini-card" ? [miniCard] : [];
    },
  };
  const controller = createRuntimeSessionCardController({
    sessionDeck,
    sessionStickRegistry: {},
    buildSessionCardViewModel: () => ({ className: "", headerHtml: "", headerDigest: "" }),
    focusSessionInWorkspace: (id) => calls.push(["focus", id]),
    activateWorkspaceSession: (id) => calls.push(["activate", id]),
  });

  controller.bindSessionActions();
  listeners.click({ target: miniCard });

  assert.deepEqual(calls, [
    ["focus", "session-b"],
    ["activate", "session-b"],
  ]);
});

test("runtimeSessionCardController: in-place reconnecting refresh localizes runtime row text", () => {
  let reconnectingRuntimeText = "";
  const body = {
    querySelector() {
      return null;
    },
    addEventListener() {},
  };
  const card = {
    dataset: { sessionId: "session-r" },
    matches(selector) {
      return selector === ".session-card";
    },
    addEventListener() {},
    querySelectorAll() {
      return [];
    },
    querySelector(selector) {
      if (selector === ".session-card-body") return body;
      if (selector === ".session-card-header") return { innerHTML: "" };
      return null;
    },
    setAttribute() {},
    removeAttribute() {},
    className: "session-card",
  };
  const sessionDeck = {
    querySelector(selector) {
      if (selector === '.session-card[data-session-id="session-r"]') return card;
      return null;
    },
    querySelectorAll() {
      return [];
    },
  };
  const controller = createRuntimeSessionCardController({
    sessionDeck,
    sessionStickRegistry: {
      get: () => null,
      ensure: () => ({
        isFollowing: true,
        showScrollButton: false,
        setContentElement() {},
        notifyContentChanged() {},
      }),
      sweep() {},
    },
    getSession: () => ({
      id: "session-r",
      turns: [],
      activePromptRunId: null,
      runtime_binding: { state: "reconnecting", stage: "load" },
    }),
    buildSessionCardViewModel: () => ({ className: "session-card is-reconnecting", headerHtml: "", headerDigest: "" }),
    projectRuntimeSessionMessageList: (_session, options = {}) => {
      reconnectingRuntimeText = options.reconnectingRuntimeText("load");
      return { rows: [], scrollTargetRowId: null, activePromptRunId: null };
    },
    runtimeSessionMessageListView: {
      renderMessageRow: () => "",
      renderMessageRowBody: () => "",
      syncMessageList() {},
    },
    isSessionLatestOnly: () => false,
    renderMermaidDiagrams: () => Promise.resolve(),
    scheduleWorkspaceRender() {},
    focusSessionInWorkspace() {},
    activateWorkspaceSession() {},
    toggleSessionFocus() {},
    dismissWorkspaceSession() {},
    archiveLiveSession() {},
    stopSession() {},
    requestDeleteConfirmation() {},
    restoreArchivedSession() {},
    setFlowDetailOpen() {},
    sessionTranscriptText: () => "",
    copyTextToClipboard: async () => true,
    toggleSessionLatestOnly() {},
    setAppNotice() {},
    isAtBottom: () => true,
    t: (key, values = {}) => {
      if (key === "restore.reconnectingStage.load") return "加载历史会话";
      if (key === "restore.reconnectingStage.runtime") return "确认连接状态";
      if (key === "restore.reconnectingRuntimeRow") return `正在恢复当前会话连接：${values.stage}`;
      return key;
    },
    streamRenderIntervalMs: 0,
    requestFrame: (callback) => {
      callback();
      return 0;
    },
    setTimer: () => 0,
  });

  controller.refreshSessionCard("session-r");
  assert.equal(reconnectingRuntimeText, "正在恢复当前会话连接：加载历史会话");
});

test("patchSessionCardPreservingBody: 流式局部更新保留滚动容器身份", () => {
  const previousHeader = { innerHTML: "旧头部" };
  const previousBody = { innerHTML: "旧内容" };
  const calls = [];
  const nextBody = {
    innerHTML: "新内容",
  };
  const nextHeader = { innerHTML: "新头部" };
  const nextArticle = {
    className: "session-card is-waiting",
    getAttribute(name) {
      return name === "aria-label" ? "新标签" : null;
    },
    querySelector(selector) {
      if (selector === ".session-card-header") return nextHeader;
      return selector === ".session-card-body" ? nextBody : null;
    },
  };
  const previousCard = {
    className: "session-card",
    attrs: {},
    setAttribute(name, value) {
      this.attrs[name] = value;
    },
    removeAttribute(name) {
      this.attrs[name] = undefined;
    },
    querySelector(selector) {
      if (selector === ".session-card-header") return previousHeader;
      return selector === ".session-card-body" ? previousBody : null;
    },
    replaceWith() {
      calls.push("replace-card");
    },
  };

  const body = patchSessionCardPreservingBody(previousCard, nextArticle);

  assert.equal(body, previousBody);
  assert.equal(previousBody.innerHTML, "新内容");
  assert.equal(previousHeader.innerHTML, "新头部");
  assert.equal(previousCard.className, "session-card is-waiting");
  assert.equal(previousCard.attrs["aria-label"], "新标签");
  assert.deepEqual(calls, []);
});

test("patchSessionCardPreservingBody: MessageList 对账时不会替换稳定正文", () => {
  const previousBody = { innerHTML: "稳定内容" };
  const nextBody = {
    innerHTML: "临时新壳",
  };
  const previousCard = {
    querySelector(selector) {
      if (selector === ".session-card-header") return null;
      return selector === ".session-card-body" ? previousBody : null;
    },
    replaceWith() {
      throw new Error("不应替换 Card 外壳");
    },
  };
  const nextArticle = {
    getAttribute: () => null,
    querySelector(selector) {
      if (selector === ".session-card-header") return null;
      return selector === ".session-card-body" ? nextBody : null;
    },
  };
  const calls = [];

  patchSessionCardPreservingBody(previousCard, nextArticle, {
    reconcileBody(body, candidate) {
      calls.push([body, candidate]);
    },
  });

  assert.deepEqual(calls, [[previousBody, nextBody]]);
  assert.equal(previousBody.innerHTML, "稳定内容");
});
