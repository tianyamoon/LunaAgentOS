export const COMPOSER_SLASH_QUERY_RE = /^\/([a-zA-Z0-9_-]*)$/;

export function matchComposerSlashQuery(input) {
  const match = String(input || "").trimStart().match(COMPOSER_SLASH_QUERY_RE);
  return match ? match[1].toLowerCase() : null;
}

export function slashCommandsForProvider(commands, providerId) {
  return commands.filter((command) => (
    command?.name && (!providerId || !command.providerId || command.providerId === providerId)
  ));
}

export function selectionBehaviorForSlashCommand(command) {
  if (command?.selectionBehavior) return command.selectionBehavior;
  return command?.kind === "builtin" ? "execute" : "insert";
}

export function normalizeSlashCommand(command, { providerId = null, description = "" } = {}) {
  if (!command?.name) return null;
  const kind = command.kind || "template";
  return {
    ...command,
    providerId,
    description,
    kind,
    source: command.source || (kind === "builtin" ? "builtin" : "adapter"),
    selectionBehavior: selectionBehaviorForSlashCommand({ ...command, kind }),
  };
}

function fuzzyTextScore(text, query) {
  const target = String(text || "").toLowerCase();
  const keyword = String(query || "").toLowerCase();
  if (!keyword) return 0;
  if (target === keyword) return 1000;
  if (target.startsWith(keyword)) return 800;
  if (keyword.length < 2) return -1;
  const containsIndex = target.indexOf(keyword);
  if (containsIndex >= 0) return 600 - containsIndex;
  let cursor = 0;
  let score = 300;
  for (const char of keyword) {
    const next = target.indexOf(char, cursor);
    if (next < 0) return -1;
    score -= next - cursor;
    cursor = next + 1;
  }
  return score - (target.length - keyword.length);
}

export function fuzzySlashCommandScore(command, query) {
  const name = typeof command === "string" ? command : command?.name;
  const description = typeof command === "string" ? "" : command?.description;
  const nameScore = fuzzyTextScore(name, query);
  const descriptionScore = fuzzyTextScore(description, query);
  return Math.max(nameScore, descriptionScore >= 0 ? descriptionScore - 120 : -1);
}

export function filterComposerSlashCommands(commands, {
  providerId = null,
  query = null,
  pinned = false,
  usageByName = {},
} = {}) {
  const available = slashCommandsForProvider(commands, providerId);
  const keyword = pinned ? "" : query;
  if (keyword === null) return pinned ? available : [];
  return available
    .map((command, index) => ({
      command,
      index,
      usage: Number(usageByName[command.name] || 0),
      score: keyword ? fuzzySlashCommandScore(command, keyword) : 0,
    }))
    .filter((item) => item.score >= 0)
    .sort((a, b) => (
      b.score - a.score ||
      b.usage - a.usage ||
      a.index - b.index
    ))
    .map((item) => item.command);
}
