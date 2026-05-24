// Pure derivations from (providers, runtimeInstances, hermesProfilesByInstance)
// to runtime-aware UI rows.
//
// These functions never read globals; everything flows in by parameter so the
// fleet view can be unit-tested without bringing up the full main.js.
//
// `runtimeHostForInstance` is delegated to the identity layer to keep host
// resolution rules in a single place.

import { runtimeHostForInstance as identityRuntimeHostForInstance } from "../sessionIdentity.js";

export function runtimeInstancesForProvider(runtimeInstances, providerId) {
  if (!Array.isArray(runtimeInstances)) return [];
  return runtimeInstances.filter((instance) => instance.providerId === providerId);
}

export function availableRuntimeInstancesForProvider(runtimeInstances, providerId) {
  return runtimeInstancesForProvider(runtimeInstances, providerId)
    .filter((instance) => instance.available);
}

export function runtimeInstanceById(runtimeInstances, id) {
  if (!id || !Array.isArray(runtimeInstances)) return null;
  return runtimeInstances.find((instance) => instance.id === id) || null;
}

export function providerRuntimeLabel(provider, instance, availableCount) {
  if (!instance?.runtimeLabel) return provider?.name || "";
  return `${provider?.name || ""} · ${instance.runtimeLabel}`;
}

function isHermesProfileAvailable(profile) {
  const state = typeof profile?.state === "number" ? profile.state : 1;
  if (profile?.gateway) return profile.gateway === "running";
  return state !== 9;
}

function isUnavailableAgentListTarget(target) {
  if (!target) return true;
  if (target.gateway) return target.gateway !== "running";
  if (target.available === false) return true;
  return target.state === 9;
}

export function sortTargetsForAgentList(targets) {
  if (!Array.isArray(targets)) return [];
  return [...targets].sort((left, right) =>
    Number(isUnavailableAgentListTarget(left)) - Number(isUnavailableAgentListTarget(right)),
  );
}

export function targetsForRuntimeInstance(
  instance,
  { providers, runtimeInstances, hermesProfilesByInstance },
) {
  const provider = (providers || []).find((entry) => entry.id === instance.providerId);
  if (!provider || !instance.available) return [];
  const availableCount = availableRuntimeInstancesForProvider(runtimeInstances, instance.providerId).length;
  const runtimeHost = identityRuntimeHostForInstance(instance);
  if (instance.providerId === "claude") {
    const label = providerRuntimeLabel(provider, instance, availableCount);
    return [{
      id: instance.id,
      providerId: provider.id,
      runtimeInstanceId: instance.id,
      runtimeLabel: instance.runtimeLabel,
      runtimeHost,
      runtimeCommand: instance.command,
      kind: "runtime",
      name: label,
      subtitle: instance.runtimeLabel || "Runtime",
      state: 1,
      available: true,
    }];
  }
  if (instance.providerId === "hermes") {
    const profiles = (hermesProfilesByInstance && hermesProfilesByInstance[instance.id]) || [];
    return profiles.map((profile) => {
      const state = typeof profile.state === "number" ? profile.state : 1;
      return {
        id: profile.id,
        providerId: "hermes",
        runtimeInstanceId: instance.id,
        runtimeLabel: instance.runtimeLabel,
        runtimeHost,
        runtimeCommand: instance.command,
        kind: "profile",
        name: profile.displayName,
        subtitle: profile.subtitle || `${instance.runtimeLabel || "Runtime"} Profile`,
        note: profile.note || "Hermes profile",
        state,
        available: isHermesProfileAvailable(profile),
        profileName: profile.profileName,
        model: profile.model,
        gateway: profile.gateway,
        alias: profile.alias,
        profileAlias: profile.alias,
        profileExecutable: profile.alias || null,
        path: profile.path,
        profilePath: profile.path,
        skillCount: profile.skillCount,
        hasEnv: profile.hasEnv,
        hasSoul: profile.hasSoul,
        isDefault: Boolean(profile.isDefault),
      };
    });
  }
  return [{
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
  }];
}

export function runtimeTargets({ providers, runtimeInstances, hermesProfilesByInstance }) {
  if (!Array.isArray(runtimeInstances)) return [];
  return runtimeInstances.flatMap((instance) =>
    targetsForRuntimeInstance(instance, { providers, runtimeInstances, hermesProfilesByInstance }),
  );
}
