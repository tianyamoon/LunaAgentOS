import {
  TURN_STATUS,
  RUNTIME_BINDING_STAGE,
  RUNTIME_BINDING_STATE,
  statusFromRuntimeStateCode,
} from "./sessionStatus.js";
import {
  applyEventsToTurn,
  applyStreamEventToTurn,
} from "../runtime/streamEvents.js";
import {
  appendTurnTimelineEvent,
  ensureTurnTimeline,
  finalizeTurnTimeline,
} from "../runtime/turnTimeline.js";

export function createSessionTurnState({
  sessionsStore,
  sessionRuntimeState,
  translate = (key) => key,
  buildTurnMeta = () => ({}),
  now = () => Date.now(),
} = {}) {
  if (!sessionsStore) throw new Error("sessionsStore is required");
  if (!sessionRuntimeState) throw new Error("sessionRuntimeState is required");

  let turnSeq = 0;

  function findSessionTurn(sessionId, turnId) {
    const session = sessionsStore.getSession(sessionId);
    if (!session) return null;
    const turn = session.turns?.find((item) => item.id === turnId);
    return turn ? { session, turn } : null;
  }

  function activeOrLatestTurn(session) {
    return session?.turns?.find((item) => item.id === session.activeTurnId)
      || session?.turns?.at(-1)
      || null;
  }

  function createTurn(session, task, options = {}) {
    if (!session) return null;
    turnSeq += 1;
    const turnMeta = buildTurnMeta(session, options);
    const turn = {
      id: `turn-${now()}-${turnSeq}`,
      task,
      runtimePrompt: options.runtimePrompt || task,
      state: 0,
      status: TURN_STATUS.running,
      thoughts: [],
      outputs: [],
      finalResponse: translate("turn.initialResponse"),
      logs: [translate("turn.initialLog")],
      createdAt: new Date(now()).toISOString(),
      meta: {
        ...(turnMeta || {}),
        ...(options.attachments?.length ? { attachments: options.attachments } : {}),
      },
    };
    // 新 Turn 从创建时就拥有 Timeline，保证启动提示和早期错误也能进入同一条过程流。
    ensureTurnTimeline(turn, { now });
    session.task = task;
    session.state = 2;
    session.activeTurnId = turn.id;
    sessionRuntimeState.clearRuntimeBindingError(session, {
      state: RUNTIME_BINDING_STATE.connected,
      stage: RUNTIME_BINDING_STAGE.prompt,
    });
    if (!Array.isArray(session.turns)) session.turns = [];
    session.turns.push(turn);
    return turn;
  }

  function updateTurnFromEvents(sessionId, turnId, events) {
    const found = findSessionTurn(sessionId, turnId);
    if (!found) return null;
    applyEventsToTurn(found.session, found.turn, events, { now });
    return found.turn;
  }

  function appendStreamEvent(sessionId, event) {
    if (
      sessionRuntimeState.isSessionDeletedTombstone(sessionId)
      || sessionRuntimeState.isSessionStoppedTombstone(sessionId)
    ) {
      return null;
    }
    const session = sessionsStore.getSession(sessionId);
    const turn = activeOrLatestTurn(session);
    if (!session || !turn) return null;
    applyStreamEventToTurn(session, turn, event, { now });
    return { session, turn };
  }

  function markPromptError(session, turn, message) {
    if (!session || !turn) return null;
    turn.state = 9;
    turn.status = TURN_STATUS.failed;
    turn.logs = [message, ...(turn.logs || [])];
    appendTurnTimelineEvent(turn, { type: "error", state: 9, payload: { content: message } }, { now });
    finalizeTurnTimeline(turn, { now });
    session.state = 9;
    sessionRuntimeState.setRuntimeBinding(session, {
      state: RUNTIME_BINDING_STATE.failed,
      stage: RUNTIME_BINDING_STAGE.prompt,
      error_title: translate("runtime.promptFailedTitle", { agent: session.agentName }),
      error_detail: message,
      error_suggestion: translate("runtime.promptFailedSuggestion"),
    });
    return turn;
  }

  function appendRuntimeLog(session, message, state = null) {
    const turn = session?.turns?.at(-1);
    if (!turn || !message) return null;
    if (!turn.logs.includes(message)) {
      turn.logs = [message, ...turn.logs];
      appendTurnTimelineEvent(turn, { type: "runtime", state, payload: { content: message } }, { now });
    }
    if (typeof state === "number") {
      turn.state = state;
      turn.status = statusFromRuntimeStateCode(state, Boolean(turn.finalResponse));
      session.state = state;
    }
    sessionsStore.setFlowDetailOpen(`${turn.id}:logs`, true);
    return turn;
  }

  function markStopped(session) {
    if (!session) return null;
    const turn = session.turns?.find((item) => item.id === session.activeTurnId)
      || [...(session.turns || [])].reverse().find((item) => [0, 2, 3, 4].includes(item.state))
      || session.turns?.at(-1);
    if (!turn) {
      session.state = 6;
      return null;
    }
    turn.state = 6;
    if (!turn.finalResponse || turn.finalResponse === translate("turn.initialResponse")) {
      turn.finalResponse = translate("turn.stoppedResponse");
    }
    turn.logs = [translate("turn.stoppedLog"), ...(turn.logs || [])];
    appendTurnTimelineEvent(turn, {
      type: "runtime",
      payload: { content: translate("turn.stoppedLog"), status: "completed" },
    }, { now });
    finalizeTurnTimeline(turn, { now });
    session.state = 6;
    return turn;
  }

  return {
    appendRuntimeLog,
    appendStreamEvent,
    createTurn,
    findSessionTurn,
    markPromptError,
    markStopped,
    updateTurnFromEvents,
  };
}
