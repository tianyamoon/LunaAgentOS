import test from "node:test";
import assert from "node:assert/strict";

import * as markdown from "./index.js";

test("rich text sanitizer extends image support without replacing default attributes", () => {
  assert.deepEqual(markdown.richTextSanitizeOptions, {
    ADD_ATTR: ["target", "rel"],
    ADD_TAGS: ["img"],
  });
});
