export function shouldRestoreActiveHistoryItem(existing, canSendToSession) {
  // 活跃区点击只负责导航回工作区；能不能发送不等于需要恢复 runtime。
  void existing;
  void canSendToSession;
  return false;
}

export function resolveHistoryItemStatusSource(item, getSession) {
  // 历史列表只负责导航；同 id 的 live session 存在时，状态必须以 live session 为准。
  return getSession?.(item?.id) || item;
}

export function projectHistoryListItemState(item, {
  getSession,
  ensureSessionStatusShape,
  resolveSessionCanonicalState,
  resolveSessionCardStatusView,
  canSendToSession,
  canRestoreSession,
  isArchivedSessionListItem,
  translate,
} = {}) {
  const t = typeof translate === "function" ? translate : (key) => key;
  const statusSource = resolveHistoryItemStatusSource(item, getSession);
  ensureSessionStatusShape?.(statusSource);
  const canonical = typeof resolveSessionCanonicalState === "function"
    ? resolveSessionCanonicalState(statusSource, { translate: t, canSendToSession, canRestoreSession })
    : null;
  const statusView = canonical?.statusView || resolveSessionCardStatusView(statusSource, { translate: t });
  const isArchived = canonical?.isArchived ?? Boolean(isArchivedSessionListItem?.(item));
  const isFailedOrBlocked = canonical?.listSignal === "failed" || statusView.status === "blocked" || statusView.status === "failed";
  const isSendable = canonical?.canSend ?? Boolean(canSendToSession?.(statusSource));
  let signalClass;
  let signalLabel;
  if (isFailedOrBlocked) {
    signalClass = "signal-failed";
    signalLabel = statusView.label;
  } else if (isSendable) {
    signalClass = "signal-active";
    signalLabel = t("history.signal.live");
  } else {
    signalClass = "signal-archive";
    signalLabel = statusView.label;
  }
  return {
    statusSource,
    statusView,
    isArchived,
    isFailedOrBlocked,
    isSendable,
    signalClass,
    signalLabel,
    listStateClass: isArchived ? "is-archive" : "is-active-history",
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
  resolveSessionCardStatusView,
  resolveSessionCanonicalState,
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
      resolveSessionCanonicalState,
      resolveSessionCardStatusView,
      canSendToSession,
      canRestoreSession,
      isArchivedSessionListItem,
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
        if (!existing || shouldRestoreActiveHistoryItem(existing, canSendToSession)) {
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
