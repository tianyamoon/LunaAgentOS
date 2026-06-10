import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const stylesPath = resolve(dirname(fileURLToPath(import.meta.url)), "../styles.css");
const styles = readFileSync(stylesPath, "utf8");

function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = styles.match(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([\\s\\S]*?)\\}`));
  assert.ok(match, `missing CSS rule for ${selector}`);
  return match[1];
}

function assertDeclarations(selector, declarations) {
  const body = rule(selector);
  declarations.forEach((declaration) => {
    assert.match(body, new RegExp(`${declaration.name}\\s*:\\s*${declaration.value}\\s*;`), `${selector} missing ${declaration.name}: ${declaration.value}`);
  });
}

test("workspace layout CSS keeps multi-card grid and message scrollers constrained", () => {
  assertDeclarations(".session-deck", [
    { name: "min-width", value: "0" },
    { name: "min-height", value: "0" },
    { name: "align-items", value: "stretch" },
  ]);
  assertDeclarations(".session-card", [
    { name: "min-width", value: "0" },
    { name: "max-width", value: "100%" },
  ]);
  assertDeclarations(".session-card-body", [
    { name: "min-width", value: "0" },
    { name: "max-width", value: "100%" },
    { name: "overflow", value: "hidden" },
  ]);
  assertDeclarations(".runtime-message-list-scroller", [
    { name: "min-width", value: "0" },
    { name: "max-width", value: "100%" },
    { name: "overflow", value: "auto" },
  ]);
});

test("focused workspace keeps the main card bounded above the mini bar", () => {
  assertDeclarations(".session-deck.is-focused > .session-card", [
    { name: "grid-row", value: "1" },
    { name: "width", value: "100%" },
    { name: "min-height", value: "0" },
  ]);
  assertDeclarations(".session-mini-bar", [
    { name: "min-width", value: "0" },
    { name: "max-width", value: "100%" },
    { name: "overflow-x", value: "auto" },
  ]);
});

test("narrow topbar tools wrap instead of clipping the theme control", () => {
  assert.match(styles, /@media \(max-width: 480px\)[\s\S]*?\.topbar-tools\s*\{[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0;[\s\S]*?flex-wrap:\s*wrap;/);
});
