import {
  runtimeInstancesForProvider as runtimeInstancesForProviderRaw,
  runtimeTargets as runtimeTargetsRaw,
  sortTargetsForAgentList,
  targetsForRuntimeInstance as targetsForRuntimeInstanceRaw,
} from "./runtimeView.js";
import { providerSupportsLaunch } from "./providerCatalog.js";

function providerById(providers, providerId) {
  return (providers || []).find((provider) => provider.id === providerId) || null;
}

export function projectRuntimeTargets({ providers = [], runtimeInstances = [], runtimeTargetsByInstance = {} } = {}) {
  return runtimeTargetsRaw({ providers, runtimeInstances, runtimeTargetsByInstance });
}

export function projectAllAgentEntries({ providers = [], runtimeInstances = [], runtimeTargets = [] } = {}) {
  return runtimeInstances.length ? runtimeTargets : providers.flatMap((provider) => provider.agents || []);
}

export function projectTargetsForProvider(providerId, {
  providers = [],
  runtimeInstances = [],
  runtimeTargetsByInstance = {},
} = {}) {
  const provider = providerById(providers, providerId);
  if (!providerSupportsLaunch(provider)) return [];
  const instances = runtimeInstancesForProviderRaw(runtimeInstances, providerId);
  if (!instances.length) {
    return provider.agents || [];
  }
  return sortTargetsForAgentList(instances.flatMap((instance) =>
    targetsForRuntimeInstanceRaw(instance, { providers, runtimeInstances, runtimeTargetsByInstance }),
  ));
}

export function findAgentEntry(agentId, {
  providers = [],
  runtimeInstances = [],
  runtimeTargets = [],
} = {}) {
  if (!agentId) return null;
  const runtimeTarget = runtimeTargets.find((agent) => agent.id === agentId);
  if (runtimeTarget) return runtimeTarget;
  const staticAgent = providers.flatMap((provider) => provider.agents || []).find((agent) => agent.id === agentId);
  if (!staticAgent) return null;
  const managedByRuntimeProbe = runtimeInstancesForProviderRaw(runtimeInstances, staticAgent.providerId).length > 0;
  if (managedByRuntimeProbe && !staticAgent.isArchivedAgent) return null;
  return staticAgent;
}

export function findProviderForAgent(agentId, {
  providers = [],
  runtimeInstances = [],
  runtimeTargets = [],
} = {}) {
  const agent = findAgentEntry(agentId, { providers, runtimeInstances, runtimeTargets });
  return agent ? providerById(providers, agent.providerId) : null;
}

export function chooseCurrentTargetAgentId(currentTargetAgentId, {
  agents = [],
  isSelectable,
  isSendable,
  isActivatable,
} = {}) {
  const currentTarget = agents.find((agent) => agent.id === currentTargetAgentId) || null;
  if (currentTarget && isSelectable?.(currentTarget)) return currentTargetAgentId;
  const sendableAgent = agents.find((agent) => isSendable?.(agent));
  if (sendableAgent) return sendableAgent.id;
  const activatableAgent = agents.find((agent) => isActivatable?.(agent));
  return activatableAgent?.id || null;
}

export function projectProviderState(provider, {
  runtimeInstances = [],
  runtimeAvailability = null,
  availabilityState,
} = {}) {
  const instances = runtimeInstancesForProviderRaw(runtimeInstances, provider.id);
  if (instances.length) {
    const verifiedAvailableCount = instances.filter((instance) =>
      (instance.verificationStatus || (instance.available ? "verified_available" : "verified_unavailable")) === "verified_available"
    ).length;
    const availableCount = instances.filter((instance) => instance.available).length;
    if (verifiedAvailableCount > 0) return 1;
    if (availableCount > 0) return 2;
    return 9;
  }
  if (runtimeAvailability) {
    return availabilityState?.(runtimeAvailability.summary) ?? 1;
  }
  const states = (provider.agents || []).map((agent) => agent.state);
  return states.includes(3)
    ? 3
    : states.includes(2)
      ? 2
      : states.includes(4)
        ? 4
        : states.includes(5)
          ? 5
          : states.includes(9)
            ? 9
            : states[0] ?? 1;
}

export function projectProviderAvailability(providerId, {
  runtimeInstances = [],
  runtimeAvailability = null,
} = {}) {
  const instances = runtimeInstancesForProviderRaw(runtimeInstances, providerId);
  if (instances.length) {
    const availableCount = instances.filter((instance) => instance.available).length;
    const verifiedAvailableCount = instances.filter((instance) =>
      (instance.verificationStatus || (instance.available ? "verified_available" : "verified_unavailable")) === "verified_available"
    ).length;
    const summary = verifiedAvailableCount > 0
      ? "available"
      : availableCount > 0
        ? "unknown"
        : "not_connected";
    return {
      summary,
      configured: instances.some((instance) => instance.configured),
      available: availableCount > 0,
      command: `${availableCount}/${instances.length}`,
      detail: "",
    };
  }
  return runtimeAvailability || { summary: "available", configured: true, available: true, command: "" };
}

export function canSendToProviderRuntime(providerId, {
  provider,
  runtimeInstances = [],
  runtimeTargets = [],
  availability,
  canStartSession,
} = {}) {
  if (!providerSupportsLaunch(provider)) return false;
  if (runtimeInstancesForProviderRaw(runtimeInstances, providerId).length) {
    return runtimeTargets.some((target) => target.providerId === providerId && canStartSession?.(target));
  }
  return availability?.available === true;
}

export function compactTargetSubtitle(target, { translate } = {}) {
  const t = typeof translate === "function" ? translate : (key) => key;
  if (!target) return "";
  const parts = [];
  if (target.gateway === "running") parts.push(t("availability.gatewayRunning"));
  else if (target.gateway) parts.push(t("availability.gatewayStopped"));
  else if (target.model) parts.push(target.model);
  return parts.filter(Boolean).join(" · ");
}

export function providerMetaLabel(provider, targets, instances, { translate } = {}) {
  const t = typeof translate === "function" ? translate : (key, params) => `${key}:${params?.count ?? ""}`;
  if (targets.length) {
    return t(provider.targetCountKey || "provider.targetCount", { count: targets.length });
  }
  if (instances.length) {
    return t("provider.instanceCount", { count: instances.length });
  }
  return t("provider.targetCount", { count: 0 });
}

export function providerRuntimeMiniLabel(instances) {
  const labels = [...new Set(instances.map((instance) => instance.runtimeLabel).filter(Boolean))];
  return labels.join(" / ");
}
