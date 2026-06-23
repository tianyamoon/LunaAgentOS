import test from "node:test";
import assert from "node:assert/strict";

import {
  healthEvidenceSourceText,
  renderHealthDiagnostics,
} from "./healthText.js";

test("health evidence sources use user-facing labels", () => {
  assert.equal(healthEvidenceSourceText("runtime_command"), "Runtime 命令");
  assert.equal(healthEvidenceSourceText("custom_probe"), "custom_probe");
});

test("health diagnostics fold raw details and explain unknown facts", () => {
  const html = renderHealthDiagnostics({
    diagnostics: [
      { field: "cli_callable", state: "ok" },
      { field: "logged_in", state: "unknown" },
    ],
    evidence: [{
      field: "cli_callable",
      source: "runtime_command",
      detail: "first line\nraw second line",
      checkedAt: "2026-06-11T00:00:00Z",
    }],
  });

  assert.match(html, /Runtime 命令/);
  assert.match(html, /health-technical-detail/);
  assert.match(html, /raw second line/);
  assert.match(html, /当前 Runtime 无法确认此项/);
});
