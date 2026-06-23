import assert from "node:assert/strict";
import test from "node:test";

import { applyWebUnavailableGate } from "./webUnavailableGate.js";

test("webUnavailableGate: 浏览器预览显示阻断页并禁用应用壳", () => {
  const gate = { hidden: true };
  const attrs = {};
  const appShell = {
    inert: false,
    setAttribute(name, value) { attrs[name] = value; },
  };
  const classes = [];
  const document = {
    body: { classList: { add(value) { classes.push(value); } } },
    getElementById(id) { return id === "webUnavailableGate" ? gate : null; },
    querySelector(selector) { return selector === ".app-shell" ? appShell : null; },
  };

  assert.equal(applyWebUnavailableGate({ document, isWebPreview: true }), true);
  assert.equal(gate.hidden, false);
  assert.equal(appShell.inert, true);
  assert.equal(attrs["aria-hidden"], "true");
  assert.deepEqual(classes, ["is-web-unavailable"]);
});

test("webUnavailableGate: Tauri 桌面端保持原界面", () => {
  assert.equal(applyWebUnavailableGate({ document: {}, isWebPreview: false }), false);
});
