import test from "node:test";
import assert from "node:assert/strict";
import { createUserThemeCatalog } from "./userThemeCatalog.js";

function makeCatalog({ response, warn = () => {} } = {}) {
  const calls = [];
  const registered = [];
  const invoke = async (command) => {
    calls.push(command);
    if (response instanceof Error) throw response;
    return response;
  };
  const catalog = createUserThemeCatalog({
    invoke,
    warn,
    registerUserThemes: (themes) => registered.push(themes),
  });
  return { catalog, calls, registered };
}

test("userThemeCatalog: loads and registers user themes", async () => {
  const themes = [{ id: "custom", vars: { "--bg": "#000" } }];
  const { catalog, calls, registered } = makeCatalog({ response: themes });
  const result = await catalog.loadUserThemes();
  assert.deepEqual(result, { themes, registeredCount: 1 });
  assert.deepEqual(calls, ["load_user_themes"]);
  assert.deepEqual(registered, [themes]);
});

test("userThemeCatalog: ignores non-array backend results", async () => {
  const { catalog, registered } = makeCatalog({ response: { themes: [] } });
  const result = await catalog.loadUserThemes();
  assert.deepEqual(result, { themes: [], registeredCount: 0 });
  assert.deepEqual(registered, []);
});

test("userThemeCatalog: load failure is non-fatal", async () => {
  const warnings = [];
  const error = new Error("boom");
  const { catalog } = makeCatalog({ response: error, warn: (...args) => warnings.push(args) });
  const result = await catalog.loadUserThemes();
  assert.equal(result.registeredCount, 0);
  assert.equal(result.error, error);
  assert.equal(warnings.length, 1);
});

test("userThemeCatalog: missing invoke becomes an empty result", async () => {
  const catalog = createUserThemeCatalog();
  assert.deepEqual(await catalog.loadUserThemes(), { themes: [], registeredCount: 0 });
});
