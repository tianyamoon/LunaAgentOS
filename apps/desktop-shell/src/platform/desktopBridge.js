const WEB_PREVIEW_RESULTS = Object.freeze({
  compact_history_entries: { removedCount: 0, upgradedCount: 0, skippedFiles: 0 },
  load_adapters: { adapters: [], warnings: [] },
  load_history_entries: [],
  load_runtime_config: {},
  load_user_themes: [],
  runtime_probe: { providers: [], instances: [] },
});

export function createDesktopBridge(tauriApi) {
  const invoke = tauriApi?.core?.invoke;
  const listen = tauriApi?.event?.listen;
  if (typeof invoke === "function") {
    return {
      invoke: invoke.bind(tauriApi.core),
      listenRuntimeEvent: typeof listen === "function" ? listen.bind(tauriApi.event) : null,
      isWebPreview: false,
    };
  }
  return {
    invoke: async (command) => {
      if (Object.hasOwn(WEB_PREVIEW_RESULTS, command)) return structuredClone(WEB_PREVIEW_RESULTS[command]);
      throw new Error(`Desktop command unavailable in web preview: ${command}`);
    },
    listenRuntimeEvent: null,
    isWebPreview: true,
  };
}
