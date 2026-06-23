import test from "node:test";
import assert from "node:assert/strict";
import { compactNoticeText, createAppNoticeController } from "./appNoticeController.js";

function createClassList() {
  const active = new Set();
  return {
    toggle(name, enabled) {
      if (enabled) active.add(name);
      else active.delete(name);
    },
    has: (name) => active.has(name),
  };
}

test("appNoticeController: compacts whitespace and long notices", () => {
  assert.equal(compactNoticeText(" a\n b\t c "), "a b c");
  assert.equal(compactNoticeText("abcdef", 3), "abc...");
});

test("appNoticeController: writes notice text and tone classes", () => {
  const element = { textContent: "", classList: createClassList() };
  const notice = createAppNoticeController({ element });
  notice.set("loading", "busy");
  assert.equal(element.textContent, "loading");
  assert.equal(element.classList.has("is-busy"), true);
  assert.equal(element.classList.has("is-error"), false);

  notice.set("failed", "error");
  assert.equal(element.classList.has("is-busy"), false);
  assert.equal(element.classList.has("is-error"), true);
});

test("appNoticeController: missing element is safe", () => {
  const notice = createAppNoticeController();
  assert.doesNotThrow(() => notice.set("ok"));
  assert.equal(notice.compact("x  y"), "x y");
});
