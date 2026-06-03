import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAgentBriefPrompt,
  parseAgentBriefResponse,
  sanitizeAgentBriefText,
} from "./agentBrief.js";

test("agentBrief: prompt requests bilingual strict json", () => {
  const prompt = buildAgentBriefPrompt();
  assert.match(prompt, /zh-CN/);
  assert.match(prompt, /en-US/);
  assert.match(prompt, /strict JSON/);
});

test("agentBrief: sanitize trims punctuation and enforces short labels", () => {
  assert.equal(sanitizeAgentBriefText("“股票复盘助手！”", "zh-CN"), "股票复盘助手");
  assert.equal(sanitizeAgentBriefText("Full Stack Engineering Partner Extra", "en-US"), "Full Stack Engineering Partner");
});

test("agentBrief: parses json embedded in assistant text", () => {
  const result = parseAgentBriefResponse("```json\n{\"zh-CN\":\"代码助手。\",\"en-US\":\"Code Review Partner\"}\n```");
  assert.deepEqual(result, {
    "zh-CN": "代码助手",
    "en-US": "Code Review Partner",
  });
});

test("agentBrief: accepts legacy zh/en aliases and translates empty errors", () => {
  assert.deepEqual(parseAgentBriefResponse("{\"zh\":\"私人助理\",\"en\":\"Personal Assistant\"}"), {
    "zh-CN": "私人助理",
    "en-US": "Personal Assistant",
  });
  assert.throws(
    () => parseAgentBriefResponse("", { translate: (key) => `t:${key}` }),
    /t:agentBrief.emptyResponse/,
  );
});
