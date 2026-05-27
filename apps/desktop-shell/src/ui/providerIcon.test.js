import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { resolveIconSlug, resolveBrandColor, renderProviderIcon, iconPathForSlug } from "./providerIcon.js";

describe("providerIcon", () => {
  test("resolveIconSlug returns builtin slug for known providers", () => {
    assert.equal(resolveIconSlug({ id: "claude" }), "anthropic");
    assert.equal(resolveIconSlug({ id: "codex" }), "openai");
    assert.equal(resolveIconSlug({ id: "trae" }), "bytedance");
    assert.equal(resolveIconSlug({ id: "hermes" }), null);
  });

  test("resolveIconSlug prefers provider.iconSlug over builtin", () => {
    assert.equal(resolveIconSlug({ id: "claude", iconSlug: "custom" }), "custom");
  });

  test("resolveIconSlug reads adapterManifest.iconSlug", () => {
    assert.equal(resolveIconSlug({ id: "foo", adapterManifest: { iconSlug: "openai" } }), "openai");
  });

  test("resolveIconSlug returns null for unknown provider without iconSlug", () => {
    assert.equal(resolveIconSlug({ id: "unknown" }), null);
    assert.equal(resolveIconSlug(null), null);
  });

  test("resolveBrandColor returns builtin color for known providers", () => {
    assert.equal(resolveBrandColor({ id: "claude" }), "#D4A27F");
    assert.equal(resolveBrandColor({ id: "hermes" }), "#40B4A6");
  });

  test("resolveBrandColor prefers provider.brandColor", () => {
    assert.equal(resolveBrandColor({ id: "claude", brandColor: "#FF0000" }), "#FF0000");
  });

  test("resolveBrandColor returns #666 for unknown", () => {
    assert.equal(resolveBrandColor({ id: "unknown" }), "#666");
    assert.equal(resolveBrandColor(null), "#666");
  });

  test("iconPathForSlug returns path for registered slugs", () => {
    const path = iconPathForSlug("anthropic");
    assert.ok(path);
    assert.ok(path.includes("anthropic.svg"));
  });

  test("iconPathForSlug returns null for unregistered slugs", () => {
    assert.equal(iconPathForSlug("nonexistent"), null);
  });

  test("renderProviderIcon returns img tag for claude", () => {
    const html = renderProviderIcon({ id: "claude", name: "Claude Code" });
    assert.ok(html.includes("provider-icon-img"));
    assert.ok(html.includes("<img"));
    assert.ok(html.includes("anthropic.svg"));
  });

  test("renderProviderIcon returns fallback icon for hermes", () => {
    const html = renderProviderIcon({ id: "hermes", name: "Hermes" });
    assert.ok(html.includes("provider-icon-fallback"));
    assert.ok(html.includes(">H<"));
  });

  test("renderProviderIcon returns fallback for unknown provider", () => {
    const html = renderProviderIcon({ id: "foo", name: "FooAgent" });
    assert.ok(html.includes("provider-icon-fallback"));
    assert.ok(html.includes(">F<"));
  });

  test("renderProviderIcon uses custom size", () => {
    const html = renderProviderIcon({ id: "claude" }, { size: "20px" });
    assert.ok(html.includes("width:20px"));
    assert.ok(html.includes("height:20px"));
  });
});
