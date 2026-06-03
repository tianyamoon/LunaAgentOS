export function mergeSlashCommands(commands) {
  const byKey = new Map();
  for (const command of Array.isArray(commands) ? commands : []) {
    if (!command?.name) continue;
    if (!byKey.has(command.name)) byKey.set(command.name, command);
  }
  return [...byKey.values()];
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function iconDataUrl(payload) {
  return payload?.mime && payload?.base64 ? `data:${payload.mime};base64,${payload.base64}` : null;
}

// Runtime Adapter Catalog 是前端访问 Adapter Host 的唯一 IO Seam。
export function createRuntimeAdapterCatalog({
  invoke,
  warn = (...args) => console.warn(...args),
} = {}) {
  async function loadAdapters() {
    if (typeof invoke !== "function") return [];
    const adapterResult = await invoke("load_adapters");
    return normalizeArray(adapterResult?.adapters);
  }

  async function loadAdapterIcons(adapters) {
    if (typeof invoke !== "function") return {};
    const iconEntries = {};
    await Promise.all(
      normalizeArray(adapters).map(async (adapter) => {
        if (!adapter?.id || !adapter?.iconPath) return;
        try {
          const payload = await invoke("read_adapter_icon", { adapterId: adapter.id });
          const url = iconDataUrl(payload);
          if (url) iconEntries[adapter.id] = url;
        } catch (error) {
          warn("read_adapter_icon failed", adapter.id, error);
        }
      }),
    );
    return iconEntries;
  }

  async function probeRuntime() {
    const adapters = await loadAdapters();
    const [iconEntries, result] = await Promise.all([
      loadAdapterIcons(adapters),
      typeof invoke === "function" ? invoke("runtime_probe") : null,
    ]);
    return {
      adapters,
      iconEntries,
      providers: normalizeArray(result?.providers),
      instances: normalizeArray(result?.instances),
      raw: result,
    };
  }

  async function loadSlashCommands({ providerId, runtimeInstances }) {
    if (typeof invoke !== "function" || !providerId) return [];
    const discovered = [];
    for (const instance of normalizeArray(runtimeInstances)) {
      if (!instance?.id || instance.available === false) continue;
      const commands = await invoke("runtime_adapter_slash_commands", {
        adapterId: providerId,
        runtimeInstanceId: instance.id,
      });
      discovered.push(...normalizeArray(commands));
    }
    return mergeSlashCommands(discovered);
  }

  async function loadTargets({ providerId, runtimeInstances }) {
    if (typeof invoke !== "function" || !providerId) {
      return { targetsByInstanceId: {}, loadedCount: 0 };
    }
    const targetsByInstanceId = {};
    let loadedCount = 0;
    for (const instance of normalizeArray(runtimeInstances)) {
      if (!instance?.id || instance.available === false) continue;
      const targets = normalizeArray(await invoke("runtime_adapter_targets", {
        adapterId: providerId,
        runtimeInstanceId: instance.id,
      }));
      targetsByInstanceId[instance.id] = targets;
      loadedCount += targets.length;
    }
    return { targetsByInstanceId, loadedCount };
  }

  return {
    loadAdapters,
    loadAdapterIcons,
    probeRuntime,
    loadSlashCommands,
    loadTargets,
  };
}
