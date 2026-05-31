import test from "node:test";
import assert from "node:assert/strict";

import { createRuntimeSessionCardController } from "./runtimeSessionCardController.js";

// mini card 必须同时更新焦点和当前 Session，避免全屏内容与缩略图脱节。
test("runtimeSessionCardController: mini card 点击统一切换焦点与当前 Session", () => {
  const calls = [];
  const listeners = {};
  const miniCard = {
    dataset: { sessionId: "session-b" },
    addEventListener(type, listener) {
      listeners[type] = listener;
    },
  };
  const sessionDeck = {
    matches() {
      return false;
    },
    querySelectorAll(selector) {
      return selector === ".session-mini-card" ? [miniCard] : [];
    },
  };
  const controller = createRuntimeSessionCardController({
    sessionDeck,
    sessionStickRegistry: {},
    focusSessionInWorkspace: (id) => calls.push(["focus", id]),
    activateWorkspaceSession: (id) => calls.push(["activate", id]),
  });

  controller.bindSessionActions();
  listeners.click();

  assert.deepEqual(calls, [
    ["focus", "session-b"],
    ["activate", "session-b"],
  ]);
});
