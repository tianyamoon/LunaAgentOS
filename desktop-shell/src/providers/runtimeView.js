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
    return profiles.map((profile) => ({
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
      state: typeof profile.state === "number" ? profile.state : 1,
      available: true,
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
    }));
  }
  return [];
}

export function runtimeTargets({ providers, runtimeInstances, hermesProfilesByInstance }) {
  if (!Array.isArray(runtimeInstances)) return [];
  return runtimeInstances.flatMap((instance) =>
    targetsForRuntimeInstance(instance, { providers, runtimeInstances, hermesProfilesByInstance }),
  );
}
