// Runtime Session Card Controller 负责卡片事件绑定、局部刷新和滚动粘连。
// 领域动作全部通过回调注入，控制器不自行修改 Session 生命周期。
import { patchSessionCardFromViewModel, patchSessionCardShell } from "./runtimeSessionCardPatch.js";
import { createRuntimeSessionVirtualList } from "./runtimeSessionVirtualList.js";

export function createRuntimeSessionCardController({
  sessionDeck,
  sessionStickRegistry,
  getSession,
  renderSessionCard,
  buildSessionCardViewModel,
  projectRuntimeSessionMessageList,
  runtimeSessionMessageListView,
  isSessionLatestOnly,
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
  const delegatedCards = new WeakSet();
  const delegatedBodies = new WeakSet();
  const lastScrollTargetRows = new Map();
  const virtualListRegistry = new Map();
  const virtualListCache = new Map();
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
      if (delegatedCards.has(card)) return;
      delegatedCards.add(card);
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
    actionRoot.querySelectorAll(".session-scroll-latest-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const sessionId = button.dataset.sessionId;
        const body = sessionDeck.querySelector(`.session-card[data-session-id="${sessionId}"] .session-card-body`);
        if (!body) return;
        ensureMessageListStickController(sessionId, body, true)?.resumeFollowing();
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
  }

  // 重绘前记录用户是否仍停留在底部，避免流式输出强抢滚动位置。
  function sampleSessionStickyIntent() {
    const map = new Map();
    sessionDeck.querySelectorAll(".session-card-body").forEach((body) => {
      const sessionId = body.closest(".session-card")?.dataset.sessionId;
      if (!sessionId) return;
      const controller = sessionStickRegistry.get(sessionId);
      const scroller = messageListElements(body).scroller || body;
      map.set(sessionId, controller ? controller.isFollowing : isAtBottom(scroller));
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

  // 流式路径：从 viewModel 直接 patch Card 外壳，不生成完整 HTML。
  // 首次创建、Session 增删、Workspace Focus 切换时仍允许完整渲染。
  function renderSessionCardInPlace(sessionId) {
    const session = getSession(sessionId);
    if (!session) return;
    const card = sessionDeck.querySelector(`.session-card[data-session-id="${sessionId}"]`);
    if (!card) return scheduleWorkspaceRender({ preserveDeckScroll: true });
    const previousBody = card.querySelector(".session-card-body");
    const previousController = sessionStickRegistry.get(sessionId);
    const previousScroller = messageListElements(previousBody).scroller || previousBody;
    const previousFollowing = previousController ? previousController.isFollowing : previousScroller ? isAtBottom(previousScroller) : true;

    // 流式路径：从 viewModel 直接 patch，不生成完整 HTML
    const viewModel = buildSessionCardViewModel(session);
    const newBody = patchSessionCardFromViewModel(card, viewModel);

    // 对账 MessageList 正文（通过虚拟列表）
    const projection = projectRuntimeSessionMessageList(session, { latestOnly: isSessionLatestOnly(session) });
    if (newBody) {
      const elements = messageListElements(newBody);
      if (elements.scroller && elements.contentElement) {
        let virtualList = virtualListRegistry.get(sessionId);
        if (!virtualList) {
          virtualList = createRuntimeSessionVirtualList({
            scroller: elements.scroller,
            content: elements.contentElement,
            estimateRowSize: 80,
            overscan: 6,
            getActiveRowId: () => session.activePromptRunId
              ? projection.rows.find((r) => r.promptRunId === session.activePromptRunId && r.kind === "assistant")?.id || null
              : null,
          });
          if (virtualList) {
            const cached = virtualListCache.get(sessionId);
            if (cached) virtualList.restoreCache(cached);
            virtualListRegistry.set(sessionId, virtualList);
          }
        }
        if (virtualList) {
          virtualList.reconcile(projection.rows, {
            renderRow: (row) => runtimeSessionMessageListView.renderMessageRow(row),
            renderRowBody: (row) => runtimeSessionMessageListView.renderMessageRowBody(row),
          });
        }
      }
    }

    // 动作委托已在首次绑定时设置，流式路径不需要重复绑定
    bindMessageListDelegation(sessionId, newBody);
    renderMermaidDiagrams(card).catch((error) => console.error(error));
    syncMessageListScroll(sessionId, newBody, projection, previousFollowing);
  }

  // 全量工作区重绘后只保留可见 Session 的 sticky 控制器。
  function syncSessionStickControllers(visibleSessions, stickyIntent) {
    const ids = [];
    visibleSessions.forEach((session) => {
      const body = sessionDeck.querySelector(`.session-card[data-session-id="${session.id}"]`)?.querySelector(".session-card-body");
      if (!body) return;
      const previousFollowing = stickyIntent.has(session.id) ? stickyIntent.get(session.id) : true;
      const projection = projectRuntimeSessionMessageList(session, { latestOnly: isSessionLatestOnly(session) });
      runtimeSessionMessageListView.syncMessageList(body, projection);
      bindMessageListDelegation(session.id, body);
      syncMessageListScroll(session.id, body, projection, previousFollowing);
      ids.push(session.id);
    });
    sessionStickRegistry.sweep(ids);
  }

  // MessageList 事件只绑定在稳定 body 上，局部更新不会重复监听。
  function bindMessageListDelegation(sessionId, body) {
    if (!body?.addEventListener || delegatedBodies.has(body)) return;
    delegatedBodies.add(body);
    body.addEventListener("click", (event) => {
      if (event.target.closest?.("[data-runtime-scroll-latest]")) {
        ensureMessageListStickController(sessionId, body, true)?.resumeFollowing();
        return;
      }
      const copyButton = event.target.closest?.(".md-code-copy-btn");
      if (!copyButton) return;
      const code = copyButton.closest(".md-code-block, .md-diagram-block")?.querySelector("code")?.textContent || "";
      if (!code) return setAppNotice(t("markdown.emptyCode"), "busy");
      copyTextToClipboard(code).then((copied) => {
        setAppNotice(copied ? t("markdown.copiedCode") : t("markdown.copyCodeFailed"), copied ? "muted" : "error");
      });
    });
    body.addEventListener("toggle", (event) => {
      const detail = event.target.closest?.(".terminal-detail[data-detail-key]");
      if (detail) setFlowDetailOpen(detail.dataset.detailKey, detail.open);
    }, true);
  }

  function messageListElements(body) {
    return {
      scroller: body?.querySelector?.("[data-runtime-message-scroller]") || null,
      contentElement: body?.querySelector?.("[data-runtime-message-content]") || null,
      scrollLatestButton: body?.querySelector?.("[data-runtime-scroll-latest]") || null,
    };
  }

  // 滚动状态属于稳定 scroller；浮动按钮只反映状态机，不自行推断位置。
  function ensureMessageListStickController(sessionId, body, initialFollowing) {
    const elements = messageListElements(body);
    const scroller = elements.scroller || body;
    if (!scroller) return null;
    const controller = sessionStickRegistry.ensure(sessionId, scroller, {
      initialFollowing,
      contentElement: elements.contentElement,
      onStateChange: ({ showScrollButton }) => {
        if (elements.scrollLatestButton) elements.scrollLatestButton.hidden = !showScrollButton;
      },
    });
    controller?.setContentElement?.(elements.contentElement);
    if (elements.scrollLatestButton && controller) {
      elements.scrollLatestButton.hidden = !controller.showScrollButton;
    }
    return controller;
  }

  // 新 Prompt 显式定位到 user row；普通 delta 仅在 following 状态下跟随底部。
  function syncMessageListScroll(sessionId, body, projection, previousFollowing) {
    if (!body) return;
    const controller = ensureMessageListStickController(sessionId, body, previousFollowing);
    if (!controller) return;
    const nextTarget = projection.scrollTargetRowId || null;
    const elements = messageListElements(body);
    const targetRow = nextTarget
      ? elements.contentElement?.querySelector?.(`[data-message-id="${nextTarget}"]`) || null
      : null;
    if (projection.activePromptRunId && targetRow && lastScrollTargetRows.get(sessionId) !== nextTarget) {
      lastScrollTargetRows.set(sessionId, nextTarget);
      controller.scrollElementIntoView(targetRow, { behavior: "auto", block: "start" });
      return;
    }
    controller.notifyContentChanged();
  }

  // 释放指定 Session 的虚拟列表
  function disposeVirtualList(sessionId) {
    const virtualList = virtualListRegistry.get(sessionId);
    if (virtualList) {
      virtualListCache.set(sessionId, virtualList.snapshotCache());
      virtualList.dispose();
      virtualListRegistry.delete(sessionId);
    }
  }

  return {
    bindSessionActions,
    sampleSessionStickyIntent,
    scheduleSessionCardRender,
    syncSessionStickControllers,
    disposeVirtualList,
  };
}

// 兼容旧测试入口：新实现不再替换外围 Card，只 patch 稳定外壳与正文 seam。
export function patchSessionCardPreservingBody(previousCard, nextArticle, { reconcileBody } = {}) {
  return patchSessionCardShell(previousCard, nextArticle, { reconcileBody });
}
