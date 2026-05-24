const genericAcpRuntimeCommands = {
  prompt: "runtime_acp_adapter_prompt",
  load: "runtime_acp_adapter_load",
  resume: "runtime_acp_adapter_resume",
  shutdown: "runtime_acp_adapter_shutdown",
  aliveIds: "runtime_acp_adapter_alive_ids",
  requiresAdapterId: true,
};

export function acpCommandsForProvider(provider) {
  return provider?.dynamicAdapter ? genericAcpRuntimeCommands : null;
}
