export function createWorkspaceView({
  sessionDeck,
  workspaceEmpty,
  getSessionsSnapshot,
  workspaceViewStore,
  updatePromptPlaceholder,
  renderWorkspaceStatus,
  updateWorkspaceEmptyCopy,
  renderSessionCard,
  renderSessionMiniCard,
  bindSessionActions,
  renderMermaidDiagrams,
  sampleSessionStickyIntent,
  syncSessionStickControllers,
  getCurrentSessionId,
  t,
  escapeHtml,
}) {
  function renderWorkspace(options = {}) {
    const focusSessionId = options.focusSessionId || null;
    const preserveDeckScroll = options.preserveDeckScroll === true;
    const deckScrollLeft = sessionDeck.scrollLeft;
    const deckScrollTop = sessionDeck.scrollTop;
    const stickyIntent = sampleSessionStickyIntent();
    // 每次渲染读取快照，View 不长期持有 Store 内部容器。
    const workspaceSessions = getSessionsSnapshot().filter((session) => session.inWorkspace !== false);
    const visibleSessions = [...workspaceSessions].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    updatePromptPlaceholder();
    renderWorkspaceStatus();
    workspaceEmpty.style.display = visibleSessions.length ? "none" : "flex";
    if (!visibleSessions.length) updateWorkspaceEmptyCopy();
    sessionDeck.classList.toggle("is-single-session", visibleSessions.length === 1);
    sessionDeck.classList.toggle("is-two-sessions", visibleSessions.length === 2);
    sessionDeck.classList.toggle("is-many-sessions", visibleSessions.length > 2);

    const explicitFocusSessionId = workspaceViewStore.getFocusedSessionId();
    const explicitFocusSession = visibleSessions.find((session) => session.id === explicitFocusSessionId);
    if (explicitFocusSessionId && !explicitFocusSession) workspaceViewStore.clearIfSessionRemoved(explicitFocusSessionId);
    const focusedSession = explicitFocusSession || (visibleSessions.length === 1 ? visibleSessions[0] : null);
    sessionDeck.classList.toggle("is-focused", Boolean(focusedSession));
    sessionDeck.classList.toggle("is-implicit-focused", Boolean(focusedSession && !explicitFocusSession));
    if (focusedSession) {
      sessionDeck.innerHTML = `
        ${renderSessionCard(focusedSession)}
        ${visibleSessions.length > 1
          ? `<div class="session-mini-bar" role="region" aria-label="${escapeHtml(t("session.miniBarAria"))}">
              ${visibleSessions.map((session) => renderSessionMiniCard(session)).join("")}
            </div>`
          : ""}
      `;
    } else {
      sessionDeck.innerHTML = visibleSessions.map(renderSessionCard).join("");
    }
    bindSessionActions();
    renderMermaidDiagrams(sessionDeck).catch((error) => console.error(error));
    requestAnimationFrame(() => {
      const focusedCurrentSessionId = getCurrentSessionId();
      const activeCard = focusedCurrentSessionId
        ? sessionDeck.querySelector(`.session-card[data-session-id="${focusedCurrentSessionId}"]`)
        : null;
      if (!preserveDeckScroll) {
        activeCard?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      } else {
        sessionDeck.scrollLeft = deckScrollLeft;
        sessionDeck.scrollTop = deckScrollTop;
      }
      const focusCard = focusSessionId
        ? sessionDeck.querySelector(`.session-card[data-session-id="${focusSessionId}"]`)
        : null;
      focusCard?.focus({ preventScroll: true });
      syncSessionStickControllers(visibleSessions, stickyIntent);
      if (preserveDeckScroll) {
        sessionDeck.scrollLeft = deckScrollLeft;
        sessionDeck.scrollTop = deckScrollTop;
      }
    });
  }

  return { renderWorkspace };
}
