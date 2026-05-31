import test from "node:test";
import assert from "node:assert/strict";
import { isIdentityOnlyProvider, providerSupportsLaunch } from "./providerCatalog.js";

// 验证 manifest 与 Store 投影使用同一套 Provider 运行身份语义。
test("providerCatalog: identityOnly providers remain visible but cannot launch", () => {
  assert.equal(isIdentityOnlyProvider({ id: "trae", identityOnly: true }), true);
  assert.equal(isIdentityOnlyProvider({ id: "trae", adapterManifest: { identityOnly: true } }), true);
  assert.equal(providerSupportsLaunch({ id: "trae", identityOnly: true }), false);
  assert.equal(providerSupportsLaunch({ id: "codex", identityOnly: false }), true);
  assert.equal(providerSupportsLaunch(null), false);
});
