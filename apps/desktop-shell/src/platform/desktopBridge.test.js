import test from "node:test";
import assert from "node:assert/strict";

import { createDesktopBridge } from "./desktopBridge.js";

test("desktopBridge: Tauri API is bound and forwarded", async () => {
  const core = {
    value: "core",
    invoke(command) {
      return `${this.value}:${command}`;
    },
  };
  const event = {
    value: "event",
    listen(name) {
      return `${this.value}:${name}`;
    },
  };
  const bridge = createDesktopBridge({ core, event });

  assert.equal(await bridge.invoke("load_history_entries"), "core:load_history_entries");
  assert.equal(bridge.listenRuntimeEvent("runtime-session-update"), "event:runtime-session-update");
  assert.equal(bridge.isWebPreview, false);
});

test("desktopBridge: web preview exposes empty startup snapshots", async () => {
  const bridge = createDesktopBridge(undefined);

  assert.deepEqual(await bridge.invoke("load_adapters"), { adapters: [], warnings: [] });
  assert.deepEqual(await bridge.invoke("load_history_entries"), []);
  assert.deepEqual(await bridge.invoke("runtime_probe"), { providers: [], instances: [] });
  assert.equal(bridge.listenRuntimeEvent, null);
  assert.equal(bridge.isWebPreview, true);
});

test("desktopBridge: web preview rejects commands that could imply a real desktop side effect", async () => {
  const bridge = createDesktopBridge(undefined);
  await assert.rejects(bridge.invoke("append_history_entry"), /unavailable in web preview/);
});
