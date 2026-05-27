export function turnResponseText(turn) {
  return turn?.finalResponse || (Array.isArray(turn?.outputs) ? turn.outputs.join("\n\n") : "");
}

export function sessionCardCounts(session) {
  const turns = Array.isArray(session?.turns) ? session.turns : [];
  return turns.reduce((counts, turn) => ({
    thoughts: counts.thoughts + (Array.isArray(turn?.thoughts) ? turn.thoughts.length : 0),
    logs: counts.logs + (Array.isArray(turn?.logs) ? turn.logs.length : 0),
    responses: counts.responses + (turnResponseText(turn) ? 1 : 0),
  }), { thoughts: 0, logs: 0, responses: 0 });
}

export function sessionCardStats(session, translate) {
  const counts = sessionCardCounts(session);
  return [
    counts.thoughts ? { key: "thoughts", label: translate("session.thoughts", { count: counts.thoughts }) } : null,
    counts.logs ? { key: "logs", label: translate("session.logs", { count: counts.logs }) } : null,
    counts.responses ? { key: "responses", label: translate("session.responses", { count: counts.responses }) } : null,
  ].filter(Boolean);
}

export function sessionTurnVisibility(session, latestOnly = false) {
  const turns = Array.isArray(session?.turns) ? session.turns : [];
  const turnEntries = turns.map((turn, index) => ({ turn, index }));
  const visibleTurnEntries = latestOnly && turnEntries.length > 1 ? turnEntries.slice(-1) : turnEntries;
  return {
    turnEntries,
    visibleTurnEntries,
    hiddenTurnCount: turnEntries.length - visibleTurnEntries.length,
  };
}
