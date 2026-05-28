import { beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  NEUTRAL_BRAND_COLOR,
  adapterIconUrl,
  renderProviderIcon,
  resolveBrandColor,
  setAdapterIcon,
  setAdapterIconRegistry,
} from "./providerIcon.js";

describe("providerIcon", () => {
  beforeEach(() => {
    setAdapterIconRegistry({});
  });

  test("adapterIconUrl reads icons registered by adapter id", () => {
    setAdapterIcon("claude", "data:image/svg+xml;base64,PHN2Zy8+");
    assert.equal(adapterIconUrl("claude"), "data:image/svg+xml;base64,PHN2Zy8+");
    assert.equal(adapterIconUrl("unknown"), null);
  });

  test("setAdapterIcon removes an icon when url is empty", () => {
    setAdapterIcon("claude", "data:image/svg+xml;base64,PHN2Zy8+");
    setAdapterIcon("claude", null);
    assert.equal(adapterIconUrl("claude"), null);
  });

  test("setAdapterIconRegistry replaces previous registry", () => {
    setAdapterIcon("claude", "data:image/svg+xml;base64,PHN2Zy8+");
    setAdapterIconRegistry({ trae: "data:image/png;base64,AAAA" });
    assert.equal(adapterIconUrl("claude"), null);
    assert.equal(adapterIconUrl("trae"), "data:image/png;base64,AAAA");
  });

  test("setAdapterIconRegistry accepts Map entries", () => {
    setAdapterIconRegistry(new Map([["codex", "data:image/png;base64,BBBB"]]));
    assert.equal(adapterIconUrl("codex"), "data:image/png;base64,BBBB");
  });

  test("resolveBrandColor prefers provider.brandColor", () => {
    assert.equal(resolveBrandColor({ id: "claude", brandColor: "#FF0000" }), "#FF0000");
  });

  test("resolveBrandColor reads adapterManifest brandColor", () => {
    assert.equal(resolveBrandColor({ id: "claude", adapterManifest: { brandColor: "#D4A27F" } }), "#D4A27F");
  });

  test("resolveBrandColor returns neutral color for unknown", () => {
    assert.equal(resolveBrandColor({ id: "unknown" }), NEUTRAL_BRAND_COLOR);
    assert.equal(resolveBrandColor(null), NEUTRAL_BRAND_COLOR);
  });

  test("renderProviderIcon returns img tag for registered adapter icon", () => {
    setAdapterIcon("claude", "data:image/svg+xml;base64,PHN2Zy8+");
    const html = renderProviderIcon({ id: "claude", name: "Claude Code" });
    assert.ok(html.includes("provider-icon-img"));
    assert.ok(html.includes("<img"));
    assert.ok(html.includes("data:image/svg+xml;base64,PHN2Zy8+"));
  });

  test("renderProviderIcon returns fallback when no adapter icon is registered", () => {
    const html = renderProviderIcon({ id: "foo", name: "FooAgent" });
    assert.ok(html.includes("provider-icon-fallback"));
    assert.ok(html.includes(">F<"));
  });

  test("renderProviderIcon uses adapter manifest brand color for fallback", () => {
    const html = renderProviderIcon({ id: "foo", name: "FooAgent", adapterManifest: { brandColor: "#123456" } });
    assert.ok(html.includes("--pi-color:#123456"));
  });

  test("renderProviderIcon uses custom size", () => {
    setAdapterIcon("claude", "data:image/svg+xml;base64,PHN2Zy8+");
    const html = renderProviderIcon({ id: "claude" }, { size: "20px" });
    assert.ok(html.includes("width:20px"));
    assert.ok(html.includes("height:20px"));
  });
});
