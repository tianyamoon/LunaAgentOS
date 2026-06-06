export function createRuntimeProbeController({
  runtimeAdapterCatalog,
  providersStore,
  setAdapterIconRegistry,
  getProvidersSnapshot,
  getRuntimeInstancesSnapshot,
  getCurrentTargetAgent,
  getAvailabilityStore,
  providerById,
  availableRuntimeInstancesForProvider,
  runtimeInstanceById,
  ensureCurrentTargetAgentExists,
  shellSurface,
  refreshComposerCommands,
  setAppNotice,
  formatBackendError,
  t,
  logger = console,
}) {
  function applyRuntimeTargetsForInstance(providerId, runtimeInstanceId, targets) {
    providersStore.batch(() => {
      providersStore.setRuntimeTargetsForInstance(runtimeInstanceId, targets);
      const count = providersStore.totalRuntimeTargetCount();
      const provider = providerById(providerId);
      if (provider?.loadedTargetsNoteKey && count > 0) {
        providersStore.setProviderNote(providerId, {
          note: null,
          noteKey: provider.loadedTargetsNoteKey,
          noteParams: { count },
        });
      }
    });
  }

  function availableInstancesForLoad(providerId, runtimeInstanceIds = null) {
    return (runtimeInstanceIds || availableRuntimeInstancesForProvider(providerId).map((instance) => instance.id))
      .map(runtimeInstanceById)
      .filter(Boolean)
      .filter((instance) => instance.available);
  }

  async function loadRuntimeSlashCommandsForProvider(providerId, runtimeInstanceIds = null) {
    const instances = availableInstancesForLoad(providerId, runtimeInstanceIds);
    if (!instances.length) return;
    try {
      const commands = await runtimeAdapterCatalog.loadSlashCommands({
        providerId,
        runtimeInstances: instances,
      });
      providersStore.setSlashCommandsForProvider(providerId, commands);
      refreshComposerCommands?.();
    } catch (error) {
      logger.error(error);
    }
  }

  async function loadRuntimeTargetsForProvider(providerId, runtimeInstanceIds = null) {
    const instances = availableInstancesForLoad(providerId, runtimeInstanceIds);
    if (!instances.length) return;
    try {
      const { targetsByInstanceId, loadedCount } = await runtimeAdapterCatalog.loadTargets({
        providerId,
        runtimeInstances: instances,
      });
      Object.entries(targetsByInstanceId).forEach(([runtimeInstanceId, targets]) => {
        applyRuntimeTargetsForInstance(providerId, runtimeInstanceId, targets);
      });
      ensureCurrentTargetAgentExists();
      shellSurface.refresh({ providers: true, workspace: true });
      const emptyNoticeKey = providerById(providerId)?.emptyTargetsNoticeKey;
      if (!loadedCount && emptyNoticeKey) setAppNotice(t(emptyNoticeKey));
    } catch (error) {
      logger.error(error);
      setAppNotice(t("provider.runtimeTargetLoadFailed", { error: formatBackendError(error) }), "error");
    }
  }

  async function refreshRuntimeProbe() {
    try {
      const result = await runtimeAdapterCatalog.probeRuntime();
      const adapters = result.adapters || [];
      setAdapterIconRegistry(result.iconEntries || {});
      providersStore.batch(() => {
        providersStore.syncAdapterProviders(adapters);
        providersStore.patchRuntimeAvailability(
          Object.fromEntries((result?.providers || []).map((item) => [item.providerId, item])),
        );
        providersStore.replaceRuntimeInstances(Array.isArray(result?.instances) ? result.instances : []);
        const probedInstances = getRuntimeInstancesSnapshot();
        providersStore.pruneRuntimeTargetsByInstanceIds(
          probedInstances.filter((instance) => instance.available).map((instance) => instance.id),
        );
      });
      ensureCurrentTargetAgentExists();
      shellSurface.refresh({
        providers: true,
        workspace: true,
        history: true,
        workspaceStatus: true,
      });
      const probedInstances = getRuntimeInstancesSnapshot();
      getAvailabilityStore().refresh(
        getProvidersSnapshot(),
        probedInstances,
        getCurrentTargetAgent(),
        providersStore.getRuntimeAvailabilitySnapshot(),
      );
      [...new Set(probedInstances.filter((instance) => instance.available).map((instance) => instance.providerId))]
        .forEach((providerId) => {
          loadRuntimeSlashCommandsForProvider(providerId);
        });
      return result.raw;
    } catch (error) {
      logger.error(error);
      setAppNotice(t("runtime.probeFailed", { error: formatBackendError(error) }), "error");
      return null;
    }
  }

  async function refreshProviderConnections(providerId) {
    await refreshRuntimeProbe();
    await loadRuntimeTargetsForProvider(providerId);
  }

  return {
    refreshRuntimeProbe,
    refreshProviderConnections,
    loadRuntimeSlashCommandsForProvider,
    loadRuntimeTargetsForProvider,
  };
}
