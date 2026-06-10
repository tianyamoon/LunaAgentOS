export function createAcpRuntimeClient({
  invoke,
  commandsForProvider,
  translate = (key) => key,
  wait = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
  probeDelaysMs = [300, 600, 900],
} = {}) {
  if (typeof invoke !== "function") throw new Error("invoke is required");
  if (typeof commandsForProvider !== "function") throw new Error("commandsForProvider is required");

  function commands(providerId) {
    return providerId ? commandsForProvider(providerId) : null;
  }

  function invokeArgs(runtimeCommands, providerId, args = {}) {
    return runtimeCommands?.requiresAdapterId ? { adapterId: providerId, ...args } : args;
  }

  function runtimeArgs(session, args = {}) {
    return {
      runtimeSessionId: session.id,
      cwd: null,
      runtimeHost: session.runtimeHost || null,
      runtimeCommand: session.runtimeCommand || null,
      profileExecutable: session.profileExecutable || null,
      defaultModel: session.defaultModel || null,
      ...args,
    };
  }

  function canHandle(providerId) {
    return Boolean(commands(providerId));
  }

  async function shutdown(session) {
    const runtimeCommands = commands(session?.providerId);
    if (!runtimeCommands || !session?.id) return false;
    return invoke(
      runtimeCommands.shutdown,
      invokeArgs(runtimeCommands, session.providerId, { runtimeSessionId: session.id }),
    );
  }

  async function load(session) {
    const runtimeCommands = commands(session?.providerId);
    if (!runtimeCommands || !session?.id) return false;
    return invoke(
      runtimeCommands.load,
      invokeArgs(runtimeCommands, session.providerId, runtimeArgs(session, {
        acpSessionId: session.acpSessionId,
      })),
    );
  }

  async function resume(session) {
    const runtimeCommands = commands(session?.providerId);
    if (!runtimeCommands || !session?.id) return false;
    return invoke(
      runtimeCommands.resume,
      invokeArgs(runtimeCommands, session.providerId, runtimeArgs(session, {
        acpSessionId: session.acpSessionId,
      })),
    );
  }

  async function prompt(session, turn, promptRunId) {
    const runtimeCommands = commands(session?.providerId);
    if (!runtimeCommands || !session?.id || !turn?.id || !promptRunId) return null;
    return invoke(
      runtimeCommands.prompt,
      invokeArgs(runtimeCommands, session.providerId, runtimeArgs(session, {
        prompt: turn.runtimePrompt || turn.prompt,
        turnId: turn.id,
        promptRunId,
      })),
    );
  }

  async function aliveIds(providerId) {
    const runtimeCommands = commands(providerId);
    if (!runtimeCommands?.aliveIds) return null;
    const result = await invoke(runtimeCommands.aliveIds, invokeArgs(runtimeCommands, providerId));
    return Array.isArray(result) ? result : [];
  }

  async function verifyAlive(providerId, sessionId) {
    const runtimeCommands = commands(providerId);
    if (!runtimeCommands?.aliveIds || !sessionId) return;
    for (const delayMs of probeDelaysMs) {
      await wait(delayMs);
      let ids;
      try {
        ids = await aliveIds(providerId);
      } catch (error) {
        throw new Error(translate("restore.aliveCheckFailed"));
      }
      if (!new Set(ids || []).has(sessionId)) {
        throw new Error(translate("restore.aliveCheckFailed"));
      }
    }
  }

  return {
    aliveIds,
    canHandle,
    load,
    prompt,
    resume,
    shutdown,
    verifyAlive,
  };
}
