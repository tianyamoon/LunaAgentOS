import test from "node:test";
import assert from "node:assert/strict";
import {
  attachmentStatus,
  buildPromptWithAttachments,
  composerStats,
  formatAttachmentBytes,
  isLikelyTextAttachment,
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
});

test("composerStats and formatAttachmentBytes provide compact display values", () => {
  assert.deepEqual(composerStats("a\nb"), { chars: 3, lines: 2 });
  assert.equal(formatAttachmentBytes(512), "512 B");
  assert.equal(formatAttachmentBytes(1536), "1.5 KB");
});
