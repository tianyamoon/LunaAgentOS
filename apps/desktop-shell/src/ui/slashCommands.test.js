import test from "node:test";
import assert from "node:assert/strict";
import {
  filterComposerSlashCommands,
  matchComposerSlashQuery,
  normalizeSlashCommand,
  selectionBehaviorForSlashCommand,
  slashCommandsForProvider,
} from "./slashCommands.js";

const commands = [
  { name: "compact", providerId: "claude" },
  { name: "clear", providerId: "claude" },
  { name: "model", description: "Switch model", providerId: "claude" },
  { name: "mcp", providerId: "claude" },
  { name: "compact", providerId: "codex" },
  { name: "model", description: "Switch model", providerId: "codex" },
  { name: "mcp", providerId: "codex" },
  { name: "compress", providerId: "hermes" },
  { name: "clear", providerId: "hermes" },
  { name: "model", description: "Switch model", providerId: "hermes" },
  { name: "skills", providerId: "hermes" },
];

test("matchComposerSlashQuery opens only for a single slash command token", () => {
  assert.equal(matchComposerSlashQuery("/"), "");
  assert.equal(matchComposerSlashQuery("  /model"), "model");
  assert.equal(matchComposerSlashQuery("/MODEL"), "model");
  assert.equal(matchComposerSlashQuery("hello /model"), null);
  assert.equal(matchComposerSlashQuery("/model now"), null);
});

test("slashCommandsForProvider filters by provider and includes Hermes native commands", () => {
  assert.deepEqual(slashCommandsForProvider(commands, "codex").map((item) => item.name), ["compact", "model", "mcp"]);
  assert.deepEqual(slashCommandsForProvider(commands, "hermes").map((item) => item.name), ["compress", "clear", "model", "skills"]);
  assert.deepEqual(slashCommandsForProvider(commands, "trae").map((item) => item.name), []);
  assert.deepEqual(slashCommandsForProvider(commands, null).map((item) => item.name), commands.map((item) => item.name));
});

test("selectionBehaviorForSlashCommand follows insert-vs-execute defaults", () => {
  assert.equal(selectionBehaviorForSlashCommand({ name: "new", kind: "template" }), "insert");
  assert.equal(selectionBehaviorForSlashCommand({ name: "skill", kind: "skill" }), "insert");
  assert.equal(selectionBehaviorForSlashCommand({ name: "open", kind: "builtin" }), "execute");
  assert.equal(selectionBehaviorForSlashCommand({ name: "export", kind: "builtin", selectionBehavior: "insert" }), "insert");
});

test("normalizeSlashCommand maps adapter/runtime commands to insertable templates", () => {
  assert.deepEqual(
    normalizeSlashCommand({ name: "new" }, { providerId: "hermes", description: "Start session" }),
    {
      name: "new",
      providerId: "hermes",
      description: "Start session",
      kind: "template",
      source: "adapter",
      selectionBehavior: "insert",
    },
  );
});

test("filterComposerSlashCommands supports typed query and pinned menu", () => {
  assert.deepEqual(filterComposerSlashCommands(commands, { providerId: "claude", query: "m" }).map((item) => item.name), ["model", "mcp"]);
  assert.deepEqual(filterComposerSlashCommands(commands, { providerId: "claude", query: null }).map((item) => item.name), []);
  assert.deepEqual(filterComposerSlashCommands(commands, { providerId: "codex", query: null, pinned: true }).map((item) => item.name), ["compact", "model", "mcp"]);
});

test("filterComposerSlashCommands supports fuzzy query ordering", () => {
  assert.deepEqual(filterComposerSlashCommands(commands, { providerId: "claude", query: "md" }).map((item) => item.name), ["model"]);
  assert.deepEqual(filterComposerSlashCommands(commands, { providerId: "claude", query: "cpa" }).map((item) => item.name), ["compact"]);
  assert.deepEqual(filterComposerSlashCommands(commands, { providerId: "claude", query: "switch" }).map((item) => item.name), ["model"]);
});

test("filterComposerSlashCommands sorts empty query by per-agent usage", () => {
  assert.deepEqual(
    filterComposerSlashCommands(commands, {
      providerId: "claude",
      query: "",
      usageByName: { model: 4, compact: 2 },
    }).map((item) => item.name),
    ["model", "compact", "clear", "mcp"],
  );
  assert.deepEqual(
    filterComposerSlashCommands(commands, {
      providerId: "codex",
      query: null,
      pinned: true,
      usageByName: { mcp: 3 },
    }).map((item) => item.name),
    ["mcp", "compact", "model"],
  );
});

test("filterComposerSlashCommands supports Hermes command popup and fuzzy search", () => {
  assert.deepEqual(
    filterComposerSlashCommands(commands, {
      providerId: "hermes",
      query: null,
      pinned: true,
    }).map((item) => item.name),
    ["compress", "clear", "model", "skills"],
  );
  assert.deepEqual(
    filterComposerSlashCommands(commands, {
      providerId: "hermes",
      query: "skl",
    }).map((item) => item.name),
    ["skills"],
  );
});
