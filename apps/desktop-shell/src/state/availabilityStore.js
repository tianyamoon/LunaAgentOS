// Availability store: aggregates provider/runtime/target health status
import {
  isTargetActivatable,
  isTargetSelectable,
  isTargetSendable,
} from "./targetActivation.js";
import {
  deriveProviderHealth,
  deriveRuntimeHealth,
  deriveTargetHealth,
} from "./agentHealth.js";

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

  const displayAgentName = (agent) => agent?.nameKey || agent?.name || "";

  const compactTargetSubtitle = (target) => {
    if (!target) return { text: "", key: "" };
    if (target.subtitle) return { text: target.subtitle, key: "" };
    if (target.gateway === "running") return { text: "", key: "availability.gatewayRunning" };
    if (target.gateway) return { text: "", key: "availability.gatewayStopped" };
    if (target.model) return { text: target.model, key: "" };
    return { text: "", key: "" };
  };

  const refresh = (providersInput, runtimeInstancesInput, currentTargetAgent, runtimeAvailabilityInput = {}) => {
    const providerList = providersInput || [];
    const allInstances = runtimeInstancesInput || [];
    const currentTarget = currentTargetAgent || null;
    const runtimeAvailability = runtimeAvailabilityInput || {};

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
      const verifiedAvailableCount = instancesForProvider.filter((instance) =>
        (instance.verificationStatus || (instance.available ? "verified_available" : "verified_unavailable")) === "verified_available"
      ).length;
      const isAvailable = verifiedAvailableCount > 0;
      const availabilitySummary = isAvailable
        ? "available"
        : availableCount > 0
          ? "unknown"
          : "not_connected";
      const availability = runtimeAvailability[provider.id] || {
        configured: instancesForProvider.length ? instancesForProvider.some((instance) => instance.configured) : undefined,
        available: isAvailable,
        summary: availabilitySummary,
        detail: provider.note || "",
      };

      if (isAvailable) summary.providers.available++;

      // Get targets from provider's agents
      const targets = provider.agents || [];
      summary.targets.total += targets.length;
      summary.targets.sendable += targets.filter(isTargetSendable).length;

      const providerHealth = deriveProviderHealth({
        ...provider,
        health: availability.health || provider.health,
        healthEvidence: availability.healthEvidence || provider.healthEvidence,
      }, availability, instancesForProvider);
      return {
        id: provider.id,
        name: provider.name,
        available: isAvailable,
        availabilitySummary,
        health: providerHealth,
        instances: instancesForProvider.map((instance) => {
          const health = deriveRuntimeHealth(instance);
          return {
            id: instance.id,
            runtimeLabel: instance.runtimeLabel,
            available: instance.available,
            summary: instance.summary || "",
            detail: instance.detail || "",
            version: instance.version || "",
            commandKind: instance.commandKind,
            command: instance.command,
            health,
            healthEvidence: instance.healthEvidence || [],
          };
        }),
        targets: targets.map((target) => {
          const subtitle = compactTargetSubtitle(target);
          const sendable = isTargetSendable(target);
          const activatable = isTargetActivatable(target);
          const health = deriveTargetHealth(target, { sendable, activatable });
          return {
            id: target.id,
            name: displayAgentName(target),
            displayName: target.name || provider.name,
            subtitle: subtitle.text,
            subtitleKey: subtitle.key,
            sendable,
            activatable,
            selectable: sendable || activatable,
            state: target.state,
            runtimeInstanceId: target.runtimeInstanceId,
            isCurrent: currentTarget && target.id === currentTarget.id,
            health,
            healthEvidence: target.healthEvidence || [],
          };
        }),
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
            providerId: p.id,
            target: t.name,
            reason: t.health?.unavailable_reason,
            reasonParams: t.health?.unavailable_reason_params,
            repairHint: t.health?.repair_hint,
            repairHintParams: t.health?.repair_hint_params,
          });
        }
      });
      p.instances.forEach((i) => {
        if (!i.available) {
          problems.push({
            type: "runtime",
            provider: p.name,
            providerId: p.id,
            runtime: i.runtimeLabel,
            commandKind: i.commandKind,
            command: i.command,
            reason: i.health?.unavailable_reason,
            reasonParams: i.health?.unavailable_reason_params,
            repairHint: i.health?.repair_hint,
            repairHintParams: i.health?.repair_hint_params,
          });
        }
      });
    });

    // Format current target data
    const currentTargetData = currentTarget
      ? {
          subtitleInfo: compactTargetSubtitle(currentTarget),
          id: currentTarget.id,
          name: displayAgentName(currentTarget),
          displayName: currentTarget.name || currentTarget.providerName,
          providerId: currentTarget.providerId,
          providerName: providerList.find((p) => p.id === currentTarget.providerId)?.name,
          sendable: isTargetSendable(currentTarget),
          activatable: isTargetActivatable(currentTarget),
          selectable: isTargetSelectable(currentTarget),
          state: currentTarget.state,
          health: deriveTargetHealth(currentTarget, {
            sendable: isTargetSendable(currentTarget),
            activatable: isTargetActivatable(currentTarget),
          }),
        }
      : null;
    if (currentTargetData) {
      currentTargetData.subtitle = currentTargetData.subtitleInfo.text;
      currentTargetData.subtitleKey = currentTargetData.subtitleInfo.key;
      delete currentTargetData.subtitleInfo;
    }

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
