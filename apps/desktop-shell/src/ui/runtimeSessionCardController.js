// Runtime Session Card Controller 负责卡片事件绑定、局部刷新和滚动粘连。
// 领域动作全部通过回调注入，控制器不自行修改 Session 生命周期。
export function createRuntimeSessionCardController({
  sessionDeck,
  sessionStickRegistry,
  getSession,
  renderSessionCard,
  renderMermaidDiagrams,
  scheduleWorkspaceRender,
  focusSessionInWorkspace,
  activateWorkspaceSession,
  toggleSessionFocus,
  dismissWorkspaceSession,
  archiveLiveSession,
  stopSession,
  requestDeleteConfirmation,
  restoreArchivedSession,
  setFlowDetailOpen,
  sessionTranscriptText,
  copyTextToClipboard,
  toggleSessionLatestOnly,
  toggleSessionTurnsCollapsed,
  areSessionFlowDetailsOpen,
  setSessionFlowDetails,
  toggleTurnCollapsed,
  findTurnById,
  turnResponseText,
  turnTranscriptText,
  setAppNotice,
  isAtBottom,
  t,
  streamRenderIntervalMs,
  requestFrame = (callback) => requestAnimationFrame(callback),
  setTimer = (callback, delay) => window.setTimeout(callback, delay),
  createTemplate = () => document.createElement("template"),
  isElement = (node) => node instanceof HTMLElement,
}) {
  const pendingCardRenders = new Set();
  let pendingCardRenderFrame = 0;
  let pendingCardRenderTimer = 0;
  let lastCardRenderAt = 0;

  // 所有 Card、mini card 与 Turn 操作统一在重绘后重新绑定。
  function bindSessionActions(root = sessionDeck) {
    const actionRoot = root || sessionDeck;
    const cards = actionRoot.matches?.(".session-card")
      ? [actionRoot]
      : [...actionRoot.querySelectorAll(".session-card")];
    cards.forEach((card) => {
      card.addEventListener("click", (event) => {
        if (event.target.closest("button, a, summary, details, input, textarea, select")) return;
        if (window.getSelection()?.toString()) return;
        activateWorkspaceSession(card.dataset.sessionId);
      });
      card.addEventListener("keydown", (event) => {
        if (event.target !== card || !["Enter", " "].includes(event.key)) return;
        event.preventDefault();
        activateWorkspaceSession(card.dataset.sessionId);
      });
    });
    actionRoot.querySelectorAll(".session-fullscreen-btn").forEach((button) => {
      button.addEventListener("click", () => toggleSessionFocus(button.dataset.sessionId));
    });
    actionRoot.querySelectorAll(".session-mini-card").forEach((button) => {
      button.addEventListener("click", () => {
        focusSessionInWorkspace(button.dataset.sessionId);
        activateWorkspaceSession(button.dataset.sessionId);
      });
    });
    actionRoot.querySelectorAll(".session-dismiss-btn").forEach((button) => {
      button.addEventListener("click", () => dismissWorkspaceSession(button.dataset.sessionId));
    });
    actionRoot.querySelectorAll(".session-archive-btn").forEach((button) => {
      button.addEventListener("click", () => archiveLiveSession(button.dataset.sessionId));
    });
    actionRoot.querySelectorAll(".session-stop-btn").forEach((button) => {
      button.addEventListener("click", () => stopSession(button.dataset.sessionId));
    });
    actionRoot.querySelectorAll(".session-delete-btn").forEach((button) => {
      button.addEventListener("click", () => requestDeleteConfirmation(button.dataset.sessionId));
    });
    actionRoot.querySelectorAll(".session-retry-btn").forEach((button) => {
      button.addEventListener("click", () => restoreArchivedSession(button.dataset.sessionId));
    });
    actionRoot
      .querySelectorAll(".terminal-detail[data-detail-key], .turn-event-thinking-shell[data-detail-key]")
      .forEach((detail) => {
        detail.addEventListener("toggle", () => setFlowDetailOpen(detail.dataset.detailKey, detail.open));
      });
    actionRoot.querySelectorAll(".session-scroll-latest-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const sessionId = button.dataset.sessionId;
        const body = sessionDeck.querySelector(`.session-card[data-session-id="${sessionId}"] .session-card-body`);
        if (!body) return;
        sessionStickRegistry.ensure(sessionId, body, { initialFollowing: true }).resumeFollowing();
      });
    });
    actionRoot.querySelectorAll(".session-copy-btn").forEach((button) => {
      button.addEventListener("click", async () => {
        const session = getSession(button.dataset.sessionId);
        const text = session ? sessionTranscriptText(session) : "";
        if (!text) return setAppNotice(t("session.noTranscript"), "busy");
        const copied = await copyTextToClipboard(text);
        setAppNotice(copied ? t("session.copiedTranscript") : t("copy.selectManually"), copied ? "muted" : "error");
      });
    });
    actionRoot.querySelectorAll(".session-latest-only-btn").forEach((button) => {
      button.addEventListener("click", () => toggleSessionLatestOnly(button.dataset.sessionId));
    });
    actionRoot.querySelectorAll(".session-turns-toggle-btn").forEach((button) => {
      button.addEventListener("click", () => toggleSessionTurnsCollapsed(button.dataset.sessionId));
    });
    actionRoot.querySelectorAll(".session-toggle-flows-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const session = getSession(button.dataset.sessionId);
        if (!session) return;
        const shouldOpen = !areSessionFlowDetailsOpen(session);
        setSessionFlowDetails(session.id, shouldOpen);
        setAppNotice(shouldOpen ? t("session.flowsExpanded") : t("session.flowsCollapsed"));
      });
    });
    actionRoot.querySelectorAll(".turn-collapse-btn").forEach((button) => {
      button.addEventListener("click", () => toggleTurnCollapsed(button.dataset.turnId));
    });
    actionRoot.querySelectorAll(".turn-copy-response-btn").forEach((button) => {
      button.addEventListener("click", async () => {
        const result = findTurnById(button.dataset.turnId);
        const text = result ? turnResponseText(result.turn) : "";
        if (!text) return setAppNotice(t("turn.noResponseCopy"), "busy");
        const copied = await copyTextToClipboard(text);
        setAppNotice(copied ? t("turn.copiedResponse") : t("copy.selectManually"), copied ? "muted" : "error");
      });
    });
    actionRoot.querySelectorAll(".turn-copy-btn").forEach((button) => {
      button.addEventListener("click", async () => {
        const result = findTurnById(button.dataset.turnId);
        const text = result ? turnTranscriptText(result.turn, result.turnIndex) : "";
        if (!text) return setAppNotice(t("turn.noTranscript"), "busy");
        const copied = await copyTextToClipboard(text);
        setAppNotice(copied ? t("turn.copiedTranscript") : t("copy.selectManually"), copied ? "muted" : "error");
      });
    });
    actionRoot.querySelectorAll(".md-code-copy-btn").forEach((button) => {
      button.addEventListener("click", async () => {
        const code = button.closest(".md-code-block, .md-diagram-block")?.querySelector("code")?.textContent || "";
        if (!code) return setAppNotice(t("markdown.emptyCode"), "busy");
        const copied = await copyTextToClipboard(code);
        setAppNotice(copied ? t("markdown.copiedCode") : t("markdown.copyCodeFailed"), copied ? "muted" : "error");
      });
    });
  }

  // 重绘前记录用户是否仍停留在底部，避免流式输出强抢滚动位置。
  function sampleSessionStickyIntent() {
    const map = new Map();
    sessionDeck.querySelectorAll(".session-card-body").forEach((body) => {
      const sessionId = body.closest(".session-card")?.dataset.sessionId;
      if (!sessionId) return;
      const controller = sessionStickRegistry.get(sessionId);
      map.set(sessionId, controller ? controller.isFollowing : isAtBottom(body));
    });
    return map;
  }

  // 高频流式事件合并到固定刷新间隔，减少整个 Card 的重复替换。
  function scheduleSessionCardRender(sessionId) {
    if (!sessionId) return;
    pendingCardRenders.add(sessionId);
    if (pendingCardRenderFrame || pendingCardRenderTimer) return;
    const elapsed = Date.now() - lastCardRenderAt;
    const delayMs = Math.max(0, streamRenderIntervalMs - elapsed);
    const requestCardRender = () => {
      pendingCardRenderTimer = 0;
      pendingCardRenderFrame = requestFrame(() => {
        lastCardRenderAt = Date.now();
        pendingCardRenderFrame = 0;
        flushPendingSessionCardRenders();
      });
    };
    if (delayMs > 0) {
      pendingCardRenderTimer = setTimer(requestCardRender, delayMs);
      return;
    }
    requestCardRender();
  }

  function flushPendingSessionCardRenders() {
    if (!pendingCardRenders.size) return;
    const targets = [...pendingCardRenders];
    pendingCardRenders.clear();
    targets.forEach(renderSessionCardInPlace);
  }

  // 局部替换 Card 时重新绑定动作并恢复原有 sticky 意图。
  function renderSessionCardInPlace(sessionId) {
    const session = getSession(sessionId);
    if (!session) return;
    const card = sessionDeck.querySelector(`.session-card[data-session-id="${sessionId}"]`);
    if (!card) return scheduleWorkspaceRender({ preserveDeckScroll: true });
    const previousBody = card.querySelector(".session-card-body");
    const previousController = sessionStickRegistry.get(sessionId);
    const previousFollowing = previousController ? previousController.isFollowing : previousBody ? isAtBottom(previousBody) : true;
    const template = createTemplate();
    template.innerHTML = renderSessionCard(session).trim();
    const newArticle = template.content.firstElementChild;
    if (!isElement(newArticle)) return;
    card.replaceWith(newArticle);
    bindSessionActions(newArticle);
    renderMermaidDiagrams(newArticle).catch((error) => console.error(error));
    const newBody = newArticle.querySelector(".session-card-body");
    if (newBody) sessionStickRegistry.ensure(sessionId, newBody, { initialFollowing: previousFollowing }).notifyContentChanged();
  }

  // 全量工作区重绘后只保留可见 Session 的 sticky 控制器。
  function syncSessionStickControllers(visibleSessions, stickyIntent) {
    const ids = [];
    visibleSessions.forEach((session) => {
      const body = sessionDeck.querySelector(`.session-card[data-session-id="${session.id}"]`)?.querySelector(".session-card-body");
      if (!body) return;
      const previousFollowing = stickyIntent.has(session.id) ? stickyIntent.get(session.id) : true;
      sessionStickRegistry.ensure(session.id, body, { initialFollowing: previousFollowing }).notifyContentChanged();
      ids.push(session.id);
    });
    sessionStickRegistry.sweep(ids);
  }

  return {
    bindSessionActions,
    sampleSessionStickyIntent,
    scheduleSessionCardRender,
    syncSessionStickControllers,
  };
}
