import test from "node:test";
import assert from "node:assert/strict";

import {
  formatBackendError,
  formatTime,
} from "./appFormatters.js";

test("appFormatters: 后端错误码使用翻译标签", () => {
  const text = formatBackendError("[RUNTIME_FAILED] boom", (key) => (
    key === "backend.RUNTIME_FAILED" ? "运行失败" : key
  ));

  assert.equal(text, "运行失败: boom");
});

test("appFormatters: 未翻译错误码保留原 code", () => {
  assert.equal(
    formatBackendError("[NEW_CODE] detail", (key) => key),
    "NEW_CODE: detail",
  );
});

test("appFormatters: 普通错误原样字符串化", () => {
  assert.equal(formatBackendError(new Error("broken")), "Error: broken");
});

test("appFormatters: 时间格式只保留小时和分钟", () => {
  assert.match(formatTime("2026-06-04T07:08:09.000Z", "en-US"), /\d{1,2}:08/);
});
