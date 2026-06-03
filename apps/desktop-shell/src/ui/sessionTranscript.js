function defaultTranslate(key, params = {}) {
  if (key === "turn.transcriptTitle") return `Turn ${params.index}`;
  return key;
}

function defaultTurnResponseText(turn) {
  return turn?.finalResponse || turn?.outputs?.at?.(-1) || "";
}

// 复制会话全文时使用稳定文本投影，不依赖卡片当前展开状态。
export function turnTranscriptText(turn, index, {
  translate = defaultTranslate,
  turnResponseText = defaultTurnResponseText,
} = {}) {
  const thoughts = Array.isArray(turn?.thoughts) ? turn.thoughts : [];
  const logs = Array.isArray(turn?.logs) ? turn.logs : [];
  const parts = [
    `# ${translate("turn.transcriptTitle", { index: index + 1 })}`,
    `user:\n${turn?.task || ""}`,
  ];
  if (thoughts.length) parts.push(`${translate("turn.thoughtStreamLabel")}:\n${thoughts.join("\n\n")}`);
  const response = turnResponseText(turn);
  if (response) parts.push(`assistant:\n${response}`);
  if (logs.length) parts.push(`${translate("turn.runtimeStreamLabel")}:\n${logs.join("\n")}`);
  return parts.join("\n\n");
}

export function sessionTranscriptText(session, options = {}) {
  const turns = Array.isArray(session?.turns) ? session.turns : [];
  return turns.map((turn, index) => turnTranscriptText(turn, index, options)).join("\n\n---\n\n");
}
