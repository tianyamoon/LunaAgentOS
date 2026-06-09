import { isAuthoritativeMemorySession } from "../state/sessionStatusSource.js";

export function shouldRestoreActiveHistoryItem(
  existing,
  canSendToSession,
  canRestoreSession,
) {
  // 已打开的历史记录如果具备恢复身份，再次点击时应进入恢复流程。
  return Boolean(existing)
    && !canSendToSession(existing)
    && canRestoreSession(existing);
}

export function resolveHistoryItemStatusSource(item, getSession, isSessionActive) {
  const existing = getSession?.(item?.id);
  return isAuthoritativeMemorySession(existing, {
    hasPersistedHistory: Boolean(item),
    isSessionActive,
  })
    ? existing
    : item;
}

export function projectHistoryListItemState(item, {
  getSession,
  ensureSessionStatusShape,
  resolveSessionListPresentationState,
  canSendToSession,
  canRestoreSession,
  isSessionActive,
  translate,
} = {}) {
  const t = typeof translate === "function" ? translate : (key) => key;
  const statusSource = resolveHistoryItemStatusSource(item, getSession, isSessionActive);
  ensureSessionStatusShape?.(statusSource);
  const presentation = resolveSessionListPresentationState(statusSource, {
    translate: t,
    canSendToSession,
    canRestoreSession,
  });

  return {
    statusSource,
    ...presentation,
  };
}

export function createHistoryView({
  historyList,
  sessionListSectionOpenState,
  sessionListItems,
  isHistoryLoading,
  isActiveSessionListItem,
  isArchivedSessionListItem,
  compareActiveSessionListItems,
  compareArchivedSessionListItems,
  ensureSessionStatusShape,
  resolveSessionListPresentationState,
  canSendToSession,
  canRestoreSession,
  sessionsStore,
  t,
  escapeHtml,
  renderProviderIcon,
  providerById,
  renderSessionActionIcon,
  formatTime,
  getSession,
  setWorkspaceVisibility,
  requestDeleteConfirmation,
  restoreArchivedSession,
  activateWorkspaceSession,
  openArchivedTranscript,
}) {
  function renderSessionListSection(sectionId, title, note, items, emptyText) {
    return `
      <details class="history-section" data-history-section="${sectionId}" ${sessionListSectionOpenState[sectionId] ? "open" : ""}>
        <summary class="history-section-summary">
          <span class="history-section-label">
            <span class="history-section-caret">▸</span>
            <span>
              <strong>${title}</strong>
              <span class="history-section-note">${note}</span>
            </span>
          </span>
          <span class="history-section-count">${items.length}</span>
        </summary>
        ${items.length
          ? `<div class="history-group-list">${items.map(renderSessionListItem).join("")}</div>`
          : `<p class="history-section-empty">${emptyText}</p>`}
      </details>
    `;
  }

  function renderSessionListItem(item) {
    const {
      statusView,
      signalClass,
      signalLabel,
      listStateClass,
    } = projectHistoryListItemState(item, {
      getSession,
      ensureSessionStatusShape,
      resolveSessionListPresentationState,
      canSendToSession,
      canRestoreSession,
      isSessionActive: (sessionId) => sessionsStore.isSessionActive(sessionId),
      translate: t,
    });
    const isActiveHistoryItem = sessionsStore.getCurrentSessionId() === item.id;
    return `
      <article class="history-item ${listStateClass} ${isActiveHistoryItem ? "is-active-session" : ""}" data-session-id="${item.id}" data-agent-id="${item.agentId || ""}" ${isActiveHistoryItem ? "aria-current=\"true\"" : ""}>
        <div class="history-item-top">
          <strong class="history-tool-name"><span class="history-signal ${signalClass}" title="${escapeHtml(signalLabel)}" aria-label="${escapeHtml(signalLabel)}"></span>${renderProviderIcon(providerById(item.providerId) || { id: item.providerId, name: item.providerName })}${escapeHtml(item.providerName)}</strong>
          <div class="history-item-actions">
            <span class="history-state-pill session-status-${escapeHtml(statusView.tone)} session-status-${escapeHtml(statusView.status)}">${escapeHtml(statusView.label)}</span>
            <button type="button" class="history-delete-btn" data-session-id="${item.id}" title="${t("history.delete")}" aria-label="${t("history.delete")}">${renderSessionActionIcon("delete")}</button>
          </div>
        </div>
        <div class="history-item-meta">
          <span>${escapeHtml(item.agentName)}</span>
          <time>${escapeHtml(item.updatedAt.slice(5, 10))} ${formatTime(item.updatedAt)}</time>
        </div>
        <p class="history-task-title">${escapeHtml(item.title)}</p>
      </article>
    `;
  }

  function bindSessionListActions() {
    historyList.querySelectorAll(".history-section").forEach((section) => {
      section.addEventListener("toggle", () => {
        sessionListSectionOpenState[section.dataset.historySection] = section.open;
      });
    });
    historyList.querySelectorAll(".history-delete-btn").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        requestDeleteConfirmation(button.dataset.sessionId);
      });
    });
    historyList.querySelectorAll(".history-item.is-active-history").forEach((item) => {
      item.addEventListener("click", () => {
        const sessionId = item.dataset.sessionId;
        const existing = getSession(sessionId);
        if (!existing || shouldRestoreActiveHistoryItem(
          existing,
          canSendToSession,
          canRestoreSession,
        )) {
          restoreArchivedSession(sessionId);
          return;
        }
        setWorkspaceVisibility(existing.id, true);
        activateWorkspaceSession(sessionId, { focusWorkspace: true });
      });
    });
    historyList.querySelectorAll(".history-item.is-archive").forEach((item) => {
      item.addEventListener("click", () => {
        openArchivedTranscript(item.dataset.sessionId);
      });
    });
  }

  function renderHistory(options = {}) {
    const scrollSessionId = options.scrollSessionId || null;
    if (isHistoryLoading()) {
      historyList.innerHTML = `
        <div class="history-empty">
          <strong>${t("history.loadingTitle")}</strong>
          <p>${t("history.loadingText")}</p>
        </div>
      `;
      return;
    }

    const items = sessionListItems();
    const activeItems = items.filter(isActiveSessionListItem).sort(compareActiveSessionListItems);
    const archivedItems = items.filter(isArchivedSessionListItem).sort(compareArchivedSessionListItems);
    if (!items.length) {
      historyList.innerHTML = `
        <div class="history-empty">
          <strong>${t("history.emptyTitle")}</strong>
          <p>${t("history.emptyText")}</p>
        </div>
      `;
      return;
    }

    historyList.innerHTML = `
      ${renderSessionListSection("active", t("history.activeTitle"), t("history.activeNote"), activeItems, t("history.activeEmpty"))}
      ${renderSessionListSection("archive", t("history.archiveTitle"), t("history.archiveNote"), archivedItems, t("history.archiveEmpty"))}
    `;
    bindSessionListActions();
    if (scrollSessionId) {
      requestAnimationFrame(() => {
        const activeItem = historyList.querySelector(`.history-item[data-session-id="${scrollSessionId}"]`);
        activeItem?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    }
  }

  return { renderHistory };
}
