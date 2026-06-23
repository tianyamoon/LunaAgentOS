import test from "node:test";
import assert from "node:assert/strict";
import {
  attachmentStatus,
  buildPromptWithAttachments,
  composerStats,
  formatAttachmentBytes,
  isLikelyImageAttachment,
  isLikelyTextAttachment,
  toPromptImageBlocks,
} from "./composerAttachments.js";

test("isLikelyTextAttachment accepts text mime types and common code extensions", () => {
  assert.equal(isLikelyTextAttachment({ name: "notes.md", type: "" }), true);
  assert.equal(isLikelyTextAttachment({ name: "script.ts", type: "" }), true);
  assert.equal(isLikelyTextAttachment({ name: "payload", type: "application/json" }), true);
  assert.equal(isLikelyTextAttachment({ name: "photo.png", type: "image/png" }), false);
});

test("buildPromptWithAttachments appends only readable attachment content", () => {
  const prompt = buildPromptWithAttachments("Review this.", [
    { name: "a.md", type: "text/markdown", size: 12, content: "hello" },
    { name: "b.png", type: "image/png", size: 20, content: "", error: "unsupported" },
  ], {
    title: "附加上下文",
    truncated: "已截断",
  });

  assert.match(prompt, /Review this\./);
  assert.match(prompt, /附加上下文/);
  assert.match(prompt, /### a\.md/);
  assert.match(prompt, /hello/);
  assert.doesNotMatch(prompt, /b\.png/);
});

test("attachmentStatus distinguishes ready, metadata, and error attachments", () => {
  assert.equal(attachmentStatus({ content: "x" }), "ready");
  assert.equal(attachmentStatus({ content: "" }), "metadata");
  assert.equal(attachmentStatus({ error: "too large" }), "error");
  // 图片以 base64 是否就绪判定，而非 content。
  assert.equal(attachmentStatus({ kind: "image", base64: "AAAA" }), "ready");
  assert.equal(attachmentStatus({ kind: "image", base64: "" }), "metadata");
  assert.equal(attachmentStatus({ kind: "image", error: "too large" }), "error");
});

test("isLikelyImageAttachment accepts whitelisted image types and rejects svg", () => {
  assert.equal(isLikelyImageAttachment({ name: "a.png", type: "image/png" }), true);
  assert.equal(isLikelyImageAttachment({ name: "a.jpg", type: "image/jpeg" }), true);
  // 剪贴板图片 type 可能为空，回退扩展名。
  assert.equal(isLikelyImageAttachment({ name: "shot.webp", type: "" }), true);
  // svg 含脚本风险，明确排除。
  assert.equal(isLikelyImageAttachment({ name: "icon.svg", type: "image/svg+xml" }), false);
  assert.equal(isLikelyImageAttachment({ name: "notes.md", type: "text/markdown" }), false);
});

test("toPromptImageBlocks collects ready images as ACP image blocks with raw base64", () => {
  const blocks = toPromptImageBlocks([
    { kind: "image", base64: "AAAA", mime: "image/png" },
    { kind: "image", base64: "", error: "too large" },
    { name: "a.md", content: "hello" },
  ]);
  assert.deepEqual(blocks, [{ type: "image", data: "AAAA", mimeType: "image/png" }]);
});

test("buildPromptWithAttachments never inlines image attachments", () => {
  const prompt = buildPromptWithAttachments("Look at this.", [
    { name: "a.md", type: "text/markdown", size: 12, content: "hello" },
    { kind: "image", name: "shot.png", base64: "AAAA", mime: "image/png" },
  ], { title: "附加上下文", truncated: "已截断" });
  assert.match(prompt, /hello/);
  assert.doesNotMatch(prompt, /shot\.png/);
  assert.doesNotMatch(prompt, /AAAA/);
});

test("composerStats and formatAttachmentBytes provide compact display values", () => {
  assert.deepEqual(composerStats("a\nb"), { chars: 3, lines: 2 });
  assert.equal(formatAttachmentBytes(512), "512 B");
  assert.equal(formatAttachmentBytes(1536), "1.5 KB");
});
