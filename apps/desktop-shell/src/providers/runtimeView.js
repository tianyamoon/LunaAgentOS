// Pure derivations from (providers, runtimeInstances, runtimeTargetsByInstance)
// to runtime-aware UI rows.
//
// These functions never read globals; everything flows in by parameter so the
// fleet view can be unit-tested without bringing up the full main.js.
//
// `runtimeHostForInstance` is delegated to the identity layer to keep host
// resolution rules in a single place.

import { runtimeHostForInstance as identityRuntimeHostForInstance } from "../sessionIdentity.js";
import {
  isTargetUnavailableForFleet,
  targetStatusForFleet,
} from "./agentMetadata.js";
import { providerSupportsLaunch } from "./providerCatalog.js";

export function runtimeInstancesForProvider(runtimeInstances, providerId) {
  if (!Array.isArray(runtimeInstances)) return [];
  return runtimeInstances.filter((instance) => instance.providerId === providerId);
}

export function availableRuntimeInstancesForProvider(runtimeInstances, providerId) {
  return runtimeInstancesForProvider(runtimeInstances, providerId)
    .filter((instance) => instance.available);
}

function runtimeVerificationStatus(instance) {
  if (instance?.verificationStatus) return instance.verificationStatus;
  return instance?.available ? "verified_available" : "verified_unavailable";
}

export function runtimeInstanceById(runtimeInstances, id) {
  if (!id || !Array.isArray(runtimeInstances)) return null;
  return runtimeInstances.find((instance) => instance.id === id) || null;
}

export function providerRuntimeLabel(provider, instance, availableCount) {
  if (!instance?.runtimeLabel) return provider?.name || "";
  return `${provider?.name || ""} · ${instance.runtimeLabel}`;
}

function isUnavailableAgentListTarget(target) {
  return isTargetUnavailableForFleet(target);
}

export function sortTargetsForAgentList(targets) {
  if (!Array.isArray(targets)) return [];
  return [...targets].sort((left, right) =>
    Number(isUnavailableAgentListTarget(left)) - Number(isUnavailableAgentListTarget(right)),
  );
}

export function targetsForRuntimeInstance(
  instance,
  { providers, runtimeInstances, runtimeTargetsByInstance },
) {
  const provider = (providers || []).find((entry) => entry.id === instance.providerId);
  // identityOnly Provider 保留目录身份，但不会生成可启动 Runtime Target。
  if (!providerSupportsLaunch(provider) || instance.available === false) return [];
  const availableCount = availableRuntimeInstancesForProvider(runtimeInstances, instance.providerId).length;
  const runtimeHost = identityRuntimeHostForInstance(instance);
  const extensionTargets = (runtimeTargetsByInstance && runtimeTargetsByInstance[instance.id]) || [];
  if (extensionTargets.length) {
    return extensionTargets.map((target) => {
      const normalized = {
        ...target,
        id: target.id || `${instance.id}:target`,
        providerId: target.providerId || provider.id,
        runtimeInstanceId: target.runtimeInstanceId || instance.id,
        runtimeLabel: target.runtimeLabel || instance.runtimeLabel,
        runtimeHost: target.runtimeHost || runtimeHost,
        runtimeCommand: target.runtimeCommand ?? instance.command ?? null,
        name: target.name || target.displayName || providerRuntimeLabel(provider, instance, availableCount),
        kind: target.kind || (target.profileName || target.alias || target.gateway ? "profile" : "runtime"),
        state: typeof target.state === "number" ? target.state : 1,
        available: target.available !== false && (!target.gateway || target.gateway === "running") && target.state !== 9,
        verificationStatus: target.verificationStatus || instance.verificationStatus || null,
        profileAlias: target.profileAlias || target.alias || null,
        profileExecutable: target.profileExecutable || target.alias || null,
        profilePath: target.profilePath || target.path || null,
        health: target.health || instance.health || null,
        healthEvidence: target.healthEvidence || instance.healthEvidence || [],
        modelControl: target.modelControl || instance.modelControl || provider.modelControl || provider.adapterManifest?.modelControl || null,
      };
      return {
        ...normalized,
        status: targetStatusForFleet(normalized),
      };
    });
  }
  const target = {
    id: instance.id,
    providerId: provider.id,
    runtimeInstanceId: instance.id,
    runtimeLabel: instance.runtimeLabel,
    runtimeHost,
    runtimeCommand: instance.commandKind === "manifest" ? null : instance.command,
    kind: "runtime",
    name: providerRuntimeLabel(provider, instance, availableCount),
    subtitle: instance.transport || instance.runtimeLabel || "Manifest Runtime",
    state: 1,
    available: true,
    verificationStatus: instance.verificationStatus || null,
    health: instance.health || null,
    healthEvidence: instance.healthEvidence || [],
    modelControl: instance.modelControl || provider.modelControl || provider.adapterManifest?.modelControl || null,
  };
  if (runtimeVerificationStatus(instance) === "unknown") {
    target.status = { state: "unknown", labelKey: "availability.unverified" };
  }
  return [{
    ...target,
    status: targetStatusForFleet(target),
  }];
}

export function runtimeTargets({ providers, runtimeInstances, runtimeTargetsByInstance }) {
  if (!Array.isArray(runtimeInstances)) return [];
  return runtimeInstances.flatMap((instance) =>
    targetsForRuntimeInstance(instance, {
      providers,
      runtimeInstances,
      runtimeTargetsByInstance,
    }),
  );
}
