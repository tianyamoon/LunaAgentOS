// Availability store: aggregates provider/runtime/target health status
// Self-contained: no external imports, receives all data via refresh()

let store = null;

export function createAvailabilityStore() {
  if (store) return store;

  let listeners = [];
  let data = {
    currentTarget: null,
    summary: {
      providers: { total: 0, available: 0 },
      runtimes: { total: 0, available: 0 },
      targets: { total: 0, sendable: 0 },
    },
    providers: [],
    problems: [],
    lastCheck: null,
  };

  const notify = () => {
    listeners.forEach((fn) => {
      try {
        fn(data);
      } catch (e) {
        console.error("[availabilityStore] listener error:", e);
      }
    });
  };

  // Helper functions for display logic
  const displayAgentName = (agent) => agent?.nameKey || agent?.name || "";
  
  const isTargetSendable = (target) => {
    if (!target) return false;
    if (target.providerId === "hermes" && target.gateway && target.gateway !== "running") return false;
    return target.available !== false;
  };

  const compactTargetSubtitle = (target) => {
    if (!target) return "";
    const parts = [];
    if (target.providerId === "hermes") {
      if (target.gateway === "running") parts.push("Gateway 运行中");
      else if (target.gateway) parts.push("Gateway 已停止");
      else if (target.model) parts.push(target.model);
    }
    return parts.filter(Boolean).join(" · ");
  };

  const refresh = (providersInput, runtimeInstancesInput, currentTargetAgent) => {
    const providerList = providersInput || [];
    const allInstances = runtimeInstancesInput || [];
    const currentTarget = currentTargetAgent || null;

    // Calculate summary stats
    const summary = {
      providers: {
        total: providerList.length,
        available: 0,
      },
      runtimes: {
        total: allInstances.length,
        available: allInstances.filter((i) => i.available).length,
      },
      targets: {
        total: 0,
        sendable: 0,
      },
    };

    // Build provider data
    const providerData = providerList.map((provider) => {
      // Filter instances for this provider
      const instancesForProvider = allInstances.filter(
        (i) => i.providerId === provider.id
      );

      // Check provider availability
      const availableCount = instancesForProvider.filter((i) => i.available).length;
      const isAvailable = instancesForProvider.length > 0 && availableCount > 0;
      const availabilitySummary = isAvailable
        ? availableCount === instancesForProvider.length
          ? "available"
          : "partial"
        : "not_connected";

      if (isAvailable) summary.providers.available++;

      // Get targets from provider's agents
      const targets = provider.agents || [];
      summary.targets.total += targets.length;
      summary.targets.sendable += targets.filter(isTargetSendable).length;

      return {
        id: provider.id,
        name: provider.name,
        available: isAvailable,
        availabilitySummary,
        instances: instancesForProvider.map((instance) => ({
          id: instance.id,
          runtimeLabel: instance.runtimeLabel,
          available: instance.available,
          summary: instance.summary || "",
          detail: instance.detail || "",
          version: instance.version || "",
          commandKind: instance.commandKind,
          command: instance.command,
        })),
        targets: targets.map((target) => ({
          id: target.id,
          name: displayAgentName(target),
          displayName: target.name || provider.name,
          subtitle: compactTargetSubtitle(target),
          sendable: isTargetSendable(target),
          state: target.state,
          runtimeInstanceId: target.runtimeInstanceId,
          isCurrent: currentTarget && target.id === currentTarget.id,
        })),
      };
    });

    // Collect problems
    const problems = [];
    providerData.forEach((p) => {
      p.targets.forEach((t) => {
        if (!t.sendable) {
          problems.push({
            type: "target",
            provider: p.name,
            target: t.name,
            reason: t.state === 9 ? "不可用" : "Gateway 已停止",
          });
        }
      });
      p.instances.forEach((i) => {
        if (!i.available && i.detail?.includes("update")) {
          problems.push({
            type: "runtime",
            provider: p.name,
            runtime: i.runtimeLabel,
            reason: "有更新可用",
          });
        }
      });
    });

    // Format current target data
    const currentTargetData = currentTarget
      ? {
          id: currentTarget.id,
          name: displayAgentName(currentTarget),
          displayName: currentTarget.name || currentTarget.providerName,
          providerId: currentTarget.providerId,
          providerName: providerList.find((p) => p.id === currentTarget.providerId)?.name,
          sendable: isTargetSendable(currentTarget),
          state: currentTarget.state,
          subtitle: compactTargetSubtitle(currentTarget),
        }
      : null;

    data = {
      currentTarget: currentTargetData,
      summary,
      providers: providerData,
      problems,
      lastCheck: new Date().toISOString(),
    };

    notify();
    return data;
  };

  const subscribe = (fn) => {
    listeners.push(fn);
    return () => {
      listeners = listeners.filter((l) => l !== fn);
    };
  };

  const getData = () => data;

  store = {
    refresh,
    subscribe,
    getData,
  };

  return store;
}

export function getAvailabilityStore() {
  return store || createAvailabilityStore();
}
