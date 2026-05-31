const DEFAULT_PROVIDERS = [
  {
    id: "claude",
    name: "Claude Code",
    lane: "",
    noteKey: "provider.claude.note",
    agentDetail: {
      summaryKey: "agentDetail.claude.summary",
      runtimeEnvironmentKey: "agentDetail.runtime.windowsWsl",
      defaultWorkingDirectoryKey: "agentDetail.cwd.currentProject",
      models: {
        available: ["agentDetail.model.nativeRuntime"],
        default: "agentDetail.model.nativeRuntime",
        recommended: ["agentDetail.model.claudeRecommended"],
      },
      capabilities: {
        files: { state: "enabled", noteKey: "agentDetail.capabilityNote.filesRepo" },
        commands: { state: "limited", noteKey: "agentDetail.capabilityNote.commandsApproval" },
        network: { state: "depends", noteKey: "agentDetail.capabilityNote.runtimePolicy" },
        images: { state: "depends", noteKey: "agentDetail.capabilityNote.modelSupport" },
        browser: { state: "limited", noteKey: "agentDetail.capabilityNote.viaTools" },
        localRepo: { state: "enabled", noteKey: "agentDetail.capabilityNote.localRepo" },
      },
      safetyBoundaries: [
        "agentDetail.claude.safety.permissions",
        "agentDetail.safety.destructive",
      ],
      bestPractices: [
        "agentDetail.claude.practice.scope",
        "agentDetail.practice.repoContext",
      ],
    },
    agents: [
      {
        id: "claude-main",
        providerId: "claude",
        nameKey: "agent.main",
        subtitle: "Windows CLI",
        noteKey: "agent.claude.note",
        state: 1,
      },
    ],
  },
  {
    id: "hermes",
    name: "Hermes",
    lane: "",
    noteKey: "provider.hermes.note",
    agentDetail: {
      summaryKey: "agentDetail.hermes.summary",
      runtimeEnvironmentKey: "agentDetail.runtime.windowsWsl",
      defaultWorkingDirectoryKey: "agentDetail.cwd.profileRuntime",
      models: {
        available: ["agentDetail.model.profileConfigured"],
        default: "agentDetail.model.profileDefault",
        recommended: ["agentDetail.model.profileRecommended"],
      },
      capabilities: {
        files: { state: "depends", noteKey: "agentDetail.capabilityNote.profileTools" },
        commands: { state: "depends", noteKey: "agentDetail.capabilityNote.profileTools" },
        network: { state: "depends", noteKey: "agentDetail.capabilityNote.profileTools" },
        images: { state: "depends", noteKey: "agentDetail.capabilityNote.modelSupport" },
        browser: { state: "depends", noteKey: "agentDetail.capabilityNote.profileTools" },
        localRepo: { state: "depends", noteKey: "agentDetail.capabilityNote.cwd" },
      },
      safetyBoundaries: [
        "agentDetail.hermes.safety.profile",
        "agentDetail.safety.destructive",
      ],
      bestPractices: [
        "agentDetail.hermes.practice.profile",
        "agentDetail.practice.handoffContext",
      ],
    },
    agents: [
      {
        id: "hermes-main",
        providerId: "hermes",
        nameKey: "agent.main",
        subtitle: "WSL Runtime",
        noteKey: "agent.hermes.note",
        state: 1,
      },
    ],
  },
  {
    id: "trae",
    name: "Trae IDE",
    lane: "",
    noteKey: "provider.trae.note",
    agentDetail: {
      summaryKey: "agentDetail.trae.summary",
      runtimeEnvironmentKey: "agentDetail.runtime.ideBridge",
      defaultWorkingDirectoryKey: "agentDetail.cwd.ideWorkspace",
      models: {
        available: ["agentDetail.model.ideManaged"],
        default: "agentDetail.model.ideManaged",
        recommended: ["agentDetail.model.ideManaged"],
      },
      capabilities: {
        files: { state: "depends", noteKey: "agentDetail.capabilityNote.ideBridge" },
        commands: { state: "depends", noteKey: "agentDetail.capabilityNote.ideBridge" },
        network: { state: "unknown", noteKey: "agentDetail.capabilityNote.ideManaged" },
        images: { state: "unknown", noteKey: "agentDetail.capabilityNote.ideManaged" },
        browser: { state: "depends", noteKey: "agentDetail.capabilityNote.ideBridge" },
        localRepo: { state: "depends", noteKey: "agentDetail.capabilityNote.ideWorkspace" },
      },
      safetyBoundaries: [
        "agentDetail.trae.safety.bridge",
      ],
      bestPractices: [
        "agentDetail.trae.practice.useIde",
      ],
    },
    agents: [
      {
        id: "trae-main",
        providerId: "trae",
        nameKey: "agent.main",
        subtitle: "IDE Bridge",
        noteKey: "agent.trae.note",
        state: 1,
      },
    ],
  },
];
const BUILTIN_PROVIDER_IDS = new Set(DEFAULT_PROVIDERS.map((provider) => provider.id));

const DEFAULT_RUNTIME_AVAILABILITY = {
  claude: { summary: "probing", configured: false, available: false, command: "" },
  hermes: { summary: "probing", configured: false, available: false, command: "" },
  trae: { summary: "planned", configured: false, available: false, command: "IDE Bridge" },
};

function cloneProvider(entry) {
  return {
    ...entry,
    agents: Array.isArray(entry.agents) ? entry.agents.map((agent) => ({ ...agent })) : [],
  };
}

function providerFromAdapter(adapter) {
  const id = adapter?.id;
  if (!id) return null;
  return {
    id,
    name: adapter.name || id,
    lane: "",
    dynamicAdapter: true,
    adapterManifest: adapter,
    agents: [
      {
        id: `${id}-main`,
        providerId: id,
        name: "Main",
        subtitle: adapter.transport || "Manifest Adapter",
        state: 1,
        dynamicAdapter: true,
      },
    ],
  };
}

export function createProvidersStore(initial = {}) {
  const providers = (Array.isArray(initial.providers) ? initial.providers : DEFAULT_PROVIDERS).map(cloneProvider);
  const runtimeAvailability = { ...DEFAULT_RUNTIME_AVAILABILITY, ...(initial.runtimeAvailability || {}) };
  const runtimeInstances = Array.isArray(initial.runtimeInstances) ? [...initial.runtimeInstances] : [];
  const runtimeTargetsByInstance = {
    ...(initial.runtimeTargetsByInstance || initial.hermesProfilesByInstance || {}),
  };
  const slashCommandsByProvider = { ...(initial.slashCommandsByProvider || {}) };

  const listeners = new Set();
  let suppressNotify = 0;
  let pendingNotify = false;

  function notify() {
    if (suppressNotify > 0) {
      pendingNotify = true;
      return;
    }
    listeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.error("providersStore listener threw:", error);
      }
    });
  }

  function batch(fn) {
    suppressNotify += 1;
    try {
      fn();
    } finally {
      suppressNotify -= 1;
      if (suppressNotify === 0 && pendingNotify) {
        pendingNotify = false;
        notify();
      }
    }
  }

  return {
    getProvidersRef() {
      return providers;
    },
    providerById(id) {
      if (!id) return null;
      return providers.find((provider) => provider.id === id) || null;
    },
    setProviderNote(id, { note = null, noteKey = null, noteParams = null } = {}) {
      const provider = providers.find((item) => item.id === id);
      if (!provider) return;
      provider.note = note;
      provider.noteKey = noteKey;
      provider.noteParams = noteParams;
      notify();
    },
    setProviderAgents(id, agents) {
      const provider = providers.find((item) => item.id === id);
      if (!provider) return;
      provider.agents = Array.isArray(agents) ? agents : [];
      notify();
    },
    appendProviderAgent(id, agent) {
      const provider = providers.find((item) => item.id === id);
      if (!provider || !agent) return;
      if (!Array.isArray(provider.agents)) provider.agents = [];
      provider.agents.push(agent);
      notify();
    },
    syncAdapterProviders(adapters) {
      const adapterProviders = (Array.isArray(adapters) ? adapters : [])
        .map(providerFromAdapter)
        .filter(Boolean);
      const adapterIds = new Set(adapterProviders.map((provider) => provider.id));
      let changed = false;
      for (const provider of adapterProviders) {
        const existing = providers.find((item) => item.id === provider.id);
        if (existing) {
          existing.name = provider.name;
          existing.dynamicAdapter = true;
          existing.adapterManifest = provider.adapterManifest;
          if (!Array.isArray(existing.agents) || existing.agents.length === 0) {
            existing.agents = provider.agents;
          }
        } else {
          providers.push(provider);
        }
        if (!runtimeAvailability[provider.id]) {
          runtimeAvailability[provider.id] = {
            summary: "probing",
            configured: true,
            available: false,
            command: provider.name,
          };
        }
        changed = true;
      }
      for (let index = providers.length - 1; index >= 0; index -= 1) {
        const provider = providers[index];
        if (provider.dynamicAdapter && BUILTIN_PROVIDER_IDS.has(provider.id) && !adapterIds.has(provider.id)) {
          delete provider.dynamicAdapter;
          delete provider.adapterManifest;
          changed = true;
        } else if (provider.dynamicAdapter && !BUILTIN_PROVIDER_IDS.has(provider.id) && !adapterIds.has(provider.id)) {
          providers.splice(index, 1);
          delete runtimeAvailability[provider.id];
          changed = true;
        }
      }
      if (changed) notify();
    },
    removeProviderAgent(id, agentId) {
      const provider = providers.find((item) => item.id === id);
      if (!provider || !Array.isArray(provider.agents)) return;
      const next = provider.agents.filter((agent) => agent.id !== agentId);
      if (next.length === provider.agents.length) return;
      provider.agents = next;
      notify();
    },

    getRuntimeAvailabilityRef() {
      return runtimeAvailability;
    },
    getRuntimeAvailabilityFor(providerId) {
      return runtimeAvailability[providerId] || null;
    },
    setRuntimeAvailabilityFor(providerId, value) {
      if (!providerId) return;
      runtimeAvailability[providerId] = value;
      notify();
    },
    patchRuntimeAvailability(byProvider) {
      if (!byProvider || typeof byProvider !== "object") return;
      let changed = false;
      for (const [id, value] of Object.entries(byProvider)) {
        runtimeAvailability[id] = value;
        changed = true;
      }
      if (changed) notify();
    },

    getRuntimeInstancesRef() {
      return runtimeInstances;
    },
    replaceRuntimeInstances(next) {
      runtimeInstances.length = 0;
      if (Array.isArray(next)) runtimeInstances.push(...next);
      notify();
    },

    getRuntimeTargetsByInstanceRef() {
      return runtimeTargetsByInstance;
    },
    getSlashCommandsForProvider(providerId) {
      return providerId ? slashCommandsByProvider[providerId] || [] : [];
    },
    setSlashCommandsForProvider(providerId, commands) {
      if (!providerId) return;
      slashCommandsByProvider[providerId] = Array.isArray(commands) ? commands : [];
      notify();
    },
    setRuntimeTargetsForInstance(instanceId, targets) {
      if (!instanceId) return;
      runtimeTargetsByInstance[instanceId] = Array.isArray(targets) ? targets : [];
      notify();
    },
    pruneRuntimeTargetsByInstanceIds(validIds) {
      const valid = new Set(validIds || []);
      let changed = false;
      for (const key of Object.keys(runtimeTargetsByInstance)) {
        if (!valid.has(key)) {
          delete runtimeTargetsByInstance[key];
          changed = true;
        }
      }
      if (changed) notify();
    },
    totalRuntimeTargetCount() {
      return Object.values(runtimeTargetsByInstance).reduce(
        (sum, items) => sum + (Array.isArray(items) ? items.length : 0),
        0,
      );
    },
    setHermesProfilesForInstance(instanceId, profiles) {
      this.setRuntimeTargetsForInstance(instanceId, profiles);
    },
    pruneHermesProfilesByInstanceIds(validIds) {
      this.pruneRuntimeTargetsByInstanceIds(validIds);
    },
    totalHermesProfileCount() {
      return this.totalRuntimeTargetCount();
    },

    subscribe(listener) {
      if (typeof listener !== "function") return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    batch,

    reset() {
      providers.length = 0;
      providers.push(...DEFAULT_PROVIDERS.map(cloneProvider));
      for (const key of Object.keys(runtimeAvailability)) delete runtimeAvailability[key];
      Object.assign(runtimeAvailability, DEFAULT_RUNTIME_AVAILABILITY);
      runtimeInstances.length = 0;
      for (const key of Object.keys(runtimeTargetsByInstance)) delete runtimeTargetsByInstance[key];
      for (const key of Object.keys(slashCommandsByProvider)) delete slashCommandsByProvider[key];
      notify();
    },
  };
}
