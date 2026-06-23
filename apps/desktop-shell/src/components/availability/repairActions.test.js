import test from "node:test";
import assert from "node:assert/strict";

import { renderRepairActions } from "./repairActions.js";
import { REPAIR_ACTION_TYPE } from "../../state/repairActions.js";

test("renderRepairActions returns empty string for no actions", () => {
  assert.equal(renderRepairActions([]), "");
  assert.equal(renderRepairActions(), "");
});

test("copy_command action renders button with escaped command in data attribute", () => {
  const html = renderRepairActions([
    { type: REPAIR_ACTION_TYPE.copy_command, labelKey: "availability.repairAction.copyLogin", command: "claude auth login" },
  ]);
  assert.match(html, /data-repair-action="copy_command"/);
  assert.match(html, /data-repair-command="claude auth login"/);
  assert.match(html, /class="[^"]*health-repair-action[^"]*"/);
});

test("open_dialog action carries dialog and provider attributes", () => {
  const html = renderRepairActions([
    { type: REPAIR_ACTION_TYPE.open_dialog, labelKey: "availability.repairAction.openConnection", dialog: "provider", providerId: "claude" },
  ]);
  assert.match(html, /data-repair-dialog="provider"/);
  assert.match(html, /data-repair-provider="claude"/);
});

test("reprobe action carries provider attribute", () => {
  const html = renderRepairActions([
    { type: REPAIR_ACTION_TYPE.reprobe, labelKey: "availability.repairAction.reprobe", providerId: "hermes" },
  ]);
  assert.match(html, /data-repair-action="reprobe"/);
  assert.match(html, /data-repair-provider="hermes"/);
});

test("malicious command cannot break out of the data attribute", () => {
  const html = renderRepairActions([
    { type: REPAIR_ACTION_TYPE.copy_command, labelKey: "availability.repairAction.copyLogin", command: '"><img src=x onerror=alert(1)>' },
  ]);
  assert.ok(!html.includes("<img"));
  assert.match(html, /&quot;&gt;&lt;img/);
});
