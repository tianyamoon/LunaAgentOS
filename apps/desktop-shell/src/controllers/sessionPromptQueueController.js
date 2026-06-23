// Session Prompt Queue Controller 模块。
// 运行中的 follow-up 先进入 FIFO 队列，当前 Prompt Run 成功结束后再创建下一轮 Turn。

function cloneAttachments(attachments = []) {
  return attachments.map((attachment) => ({ ...attachment }));
}

// 创建后续输入队列控制器。Shell 只注入 Turn 创建与执行路由，不参与队列状态细节。
export function createSessionPromptQueueController({
  createSessionTurn,
  dispatchPromptRun,
  persistTurnSnapshot = () => null,
  shellSurface,
  setAppNotice,
  t,
  now = () => Date.now(),
}) {
  let submissionSeq = 0;

  function ensureQueue(session) {
    if (!Array.isArray(session.queuedSubmissions)) session.queuedSubmissions = [];
    return session.queuedSubmissions;
  }

  // 队列项保存发送瞬间的输入快照，避免 Composer 后续变化污染排队内容。
  function createSubmission(prompt, options = {}) {
    submissionSeq += 1;
    return {
      id: `submission-${now()}-${submissionSeq}`,
      prompt,
      runtimePrompt: options.runtimePrompt || prompt,
      // 图片块（ACP image content）随队列项快照保存，发送时旁路透传给 runtime。
      images: Array.isArray(options.images) ? options.images.map((block) => ({ ...block })) : [],
      attachments: cloneAttachments(options.attachments),
      createdAt: new Date(now()).toISOString(),
    };
  }

  function refreshViews() {
    shellSurface.refresh({ workspace: true, history: true });
  }

  // Turn 进入可见工作台时先落一份历史快照，避免桌面关闭后只剩内存态。
  function persistAcceptedTurn(session, turn) {
    try {
      const result = persistTurnSnapshot(session, turn);
      if (result && typeof result.catch === "function") {
        result.catch((error) => {
          setAppNotice(t("history.saveFailed", { message: error?.message || String(error) }), "error");
        });
      }
    } catch (error) {
      setAppNotice(t("history.saveFailed", { message: error?.message || String(error) }), "error");
    }
  }

  // 真正开始执行时才创建 Turn，使一个用户输入严格对应一个 Runtime Prompt Run。
  function startSubmission(session, submission) {
    const turn = createSessionTurn(session, submission.prompt, {
      runtimePrompt: submission.runtimePrompt,
      images: Array.isArray(submission.images) ? submission.images.map((block) => ({ ...block })) : [],
      attachments: cloneAttachments(submission.attachments),
    });
    persistAcceptedTurn(session, turn);
    refreshViews();
    dispatchPromptRun(session, turn);
    return { queued: false, submission, turn };
  }

  function submit(session, prompt, options = {}) {
    if (!session || !prompt) return null;
    const submission = createSubmission(prompt, options);
    if (!session.activePromptRunId) return startSubmission(session, submission);

    const queue = ensureQueue(session);
    queue.push(submission);
    refreshViews();
    setAppNotice(t("session.followUpQueued", { count: queue.length }), "busy");
    return { queued: true, submission, turn: null };
  }

  // 仅由成功终态触发 pump；失败、取消和停止不会静默发送后续输入。
  function pump(session) {
    if (!session || session.activePromptRunId) return null;
    const queue = ensureQueue(session);
    const submission = queue.shift();
    if (!submission) return null;
    return startSubmission(session, submission);
  }

  function clear(session, reason = "") {
    if (!session) return 0;
    const queue = ensureQueue(session);
    const removedCount = queue.length;
    session.queuedSubmissions = [];
    if (removedCount) {
      session.discardedQueuedSubmissions = [
        ...(session.discardedQueuedSubmissions || []),
        { count: removedCount, reason, clearedAt: new Date(now()).toISOString() },
      ];
    }
    return removedCount;
  }

  function queuedCount(session) {
    return ensureQueue(session).length;
  }

  return {
    clear,
    pump,
    queuedCount,
    submit,
  };
}
