import test from "node:test";
import assert from "node:assert/strict";

import {
  sessionTranscriptText,
  turnTranscriptText,
} from "./sessionTranscript.js";

const translate = (key, params = {}) => {
  if (key === "turn.transcriptTitle") return `第 ${params.index} 轮`;
  if (key === "turn.thoughtStreamLabel") return "思考";
  if (key === "turn.runtimeStreamLabel") return "运行";
  return key;
};

test("sessionTranscript: 单轮文本包含用户、思考、响应和运行日志", () => {
  const text = turnTranscriptText({
    prompt: "检查日志",
    thoughts: ["先定位入口"],
    finalResponse: "已经完成",
    logs: ["读取文件"],
  }, 0, {
    translate,
    turnResponseText: (turn) => turn.finalResponse,
  });

  assert.match(text, /# 第 1 轮/);
  assert.match(text, /user:\n检查日志/);
  assert.match(text, /思考:\n先定位入口/);
  assert.match(text, /assistant:\n已经完成/);
  assert.match(text, /运行:\n读取文件/);
});

test("sessionTranscript: 多轮会话使用稳定分隔符", () => {
  const text = sessionTranscriptText({
    turns: [
      { prompt: "A", thoughts: [], outputs: ["答 A"], logs: [] },
      { prompt: "B", thoughts: [], outputs: ["答 B"], logs: [] },
    ],
  }, {
    translate,
    turnResponseText: (turn) => turn.outputs.at(-1),
  });

  assert.equal(text.includes("\n\n---\n\n"), true);
  assert.match(text, /# 第 1 轮/);
  assert.match(text, /# 第 2 轮/);
});

test("sessionTranscript: 空会话返回空文本", () => {
  assert.equal(sessionTranscriptText(null, { translate }), "");
});
