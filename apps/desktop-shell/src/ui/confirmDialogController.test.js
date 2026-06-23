import test from "node:test";
import assert from "node:assert/strict";
import { createConfirmDialogController } from "./confirmDialogController.js";

function createFakeDialog() {
  const listeners = new Map();
  return {
    hidden: true,
    innerHTML: "",
    querySelector(selector) {
      return {
        addEventListener(event, handler) {
          listeners.set(`${selector}:${event}`, handler);
        },
      };
    },
    async click(selector) {
      await listeners.get(`${selector}:click`)?.();
    },
  };
}

test("confirmDialogController: opens escaped confirm markup and closes on cancel", async () => {
  const dialog = createFakeDialog();
  const controller = createConfirmDialogController({
    element: dialog,
    translate: (key) => `t:${key}`,
  });
  controller.open({
    title: "<delete>",
    message: "remove <session>",
    confirmLabel: "<yes>",
  });
  assert.equal(dialog.hidden, false);
  assert.match(dialog.innerHTML, /&lt;delete&gt;/);
  assert.match(dialog.innerHTML, /&lt;session&gt;/);
  assert.match(dialog.innerHTML, /&lt;yes&gt;/);

  await dialog.click(".confirm-dialog-cancel");
  assert.equal(dialog.hidden, true);
  assert.equal(dialog.innerHTML, "");
});

test("confirmDialogController: confirm runs pending action once after closing", async () => {
  const dialog = createFakeDialog();
  const calls = [];
  const controller = createConfirmDialogController({ element: dialog });
  controller.open({
    title: "delete",
    message: "sure",
    onConfirm: async () => calls.push(dialog.hidden ? "closed-first" : "still-open"),
  });
  await dialog.click(".confirm-dialog-confirm");
  assert.deepEqual(calls, ["closed-first"]);

  await dialog.click(".confirm-dialog-confirm");
  assert.deepEqual(calls, ["closed-first"]);
});

test("confirmDialogController: missing element is safe", () => {
  const controller = createConfirmDialogController({ element: null });
  assert.doesNotThrow(() => controller.open({ title: "x" }));
  assert.doesNotThrow(() => controller.close());
});
