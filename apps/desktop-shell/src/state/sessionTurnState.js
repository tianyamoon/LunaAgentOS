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
      // 等待提示属于视图状态，不得冒充 Runtime 已返回的正文。
      finalResponse: "",
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

  // Prompt Run 是流事件的写入租约；只有精确匹配的执行才能修改对应 Turn。
  function beginPromptRun(session, turn, promptRunId) {
    if (!session || !turn || !promptRunId) return false;
    session.activePromptRunId = promptRunId;
    turn.promptRunId = promptRunId;
    return true;
  }

  function acceptsPromptRun(session, turn, promptRunId) {
    return Boolean(
      session
      && turn
      && promptRunId
      && session.activePromptRunId === promptRunId
      && turn.promptRunId === promptRunId
      && [TURN_STATUS.running, TURN_STATUS.waiting_confirmation].includes(turn.status),
    );
  }

  function acceptsPromptRunCompletion(session, turn, promptRunId) {
    return Boolean(
      session
      && turn
      && promptRunId
      && session.activePromptRunId === promptRunId
      && turn.promptRunId === promptRunId
      // 流式 state=5 可能已经把 Turn 标为 completed；最终批量事件仍要允许同一 Prompt Run 结算落盘。
      && [TURN_STATUS.running, TURN_STATUS.waiting_confirmation, TURN_STATUS.completed].includes(turn.status),
    );
  }

  function endPromptRun(session, turn, promptRunId) {
    if (!session || !turn || !promptRunId) return false;
    if (session.activePromptRunId !== promptRunId || turn.promptRunId !== promptRunId) return false;
    session.activePromptRunId = null;
    return true;
  }

  function isTerminalTurn(turn) {
    return [TURN_STATUS.completed, TURN_STATUS.failed, TURN_STATUS.cancelled].includes(turn?.status);
  }

  function normalizeReturnedPromptRun(session, turn) {
    if (!session || !turn) return null;
    // ACP/fallback prompt 返回后代表本次 Prompt Run 已结束；这里集中提交终态，避免 UI 和 history 从不同字段各自猜。
    if (!isTerminalTurn(turn) && turn.status !== TURN_STATUS.waiting_confirmation) {
      turn.status = TURN_STATUS.completed;
    }
    if (turn.status === TURN_STATUS.completed) turn.state = 5;
    if (turn.status === TURN_STATUS.failed) turn.state = 9;
    session.state = turn.state;
    session.activeTurnId = turn.id;
    if (isTerminalTurn(turn)) finalizeTurnTimeline(turn, { now });
    return turn;
  }

  function updateTurnFromEvents(sessionId, turnId, promptRunId, events) {
    const found = findSessionTurn(sessionId, turnId);
    if (!found || !acceptsPromptRun(found.session, found.turn, promptRunId)) return null;
    applyEventsToTurn(found.session, found.turn, events, { now });
    return found.turn;
  }

  function completePromptRunFromEvents(sessionId, turnId, promptRunId, events) {
    const found = findSessionTurn(sessionId, turnId);
    if (!found || !acceptsPromptRunCompletion(found.session, found.turn, promptRunId)) return null;
    applyEventsToTurn(found.session, found.turn, events, { now });
    normalizeReturnedPromptRun(found.session, found.turn);
    endPromptRun(found.session, found.turn, promptRunId);
    return { session: found.session, turn: found.turn };
  }

  function failPromptRun(session, turn, promptRunId, message) {
    if (!acceptsPromptRun(session, turn, promptRunId)) return null;
    markPromptError(session, turn, message);
    endPromptRun(session, turn, promptRunId);
    return { session, turn };
  }

  function appendStreamEvent(sessionId, turnId, promptRunId, event) {
    if (
      sessionRuntimeState.isSessionDeletedTombstone(sessionId)
      || sessionRuntimeState.isSessionStoppedTombstone(sessionId)
    ) {
      return null;
    }
    const found = findSessionTurn(sessionId, turnId);
    const session = found?.session;
    const turn = found?.turn;
    if (!acceptsPromptRun(session, turn, promptRunId)) return null;
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
    const turn = activeOrLatestTurn(session);
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
    // 运行日志只写入数据，不替用户展开调试区；完成态是否展开交给视图投影决定。
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
    beginPromptRun,
    completePromptRunFromEvents,
    createTurn,
    endPromptRun,
    failPromptRun,
    findSessionTurn,
    markPromptError,
    markStopped,
    updateTurnFromEvents,
  };
}
