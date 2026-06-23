import { providerSupportsLaunch } from "../providers/providerCatalog.js";

const genericAcpRuntimeCommands = {
  prompt: "runtime_acp_adapter_prompt",
  load: "runtime_acp_adapter_load",
  resume: "runtime_acp_adapter_resume",
  shutdown: "runtime_acp_adapter_shutdown",
  aliveIds: "runtime_acp_adapter_alive_ids",
  requiresAdapterId: true,
};

export function acpCommandsForProvider(provider) {
  // identityOnly Adapter 不进入通用 ACP Host。
  return provider?.dynamicAdapter && providerSupportsLaunch(provider) ? genericAcpRuntimeCommands : null;
}
