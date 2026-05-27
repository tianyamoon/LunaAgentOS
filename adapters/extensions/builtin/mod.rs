use crate::adapter_registry::{AdapterDefinition, SlashCommandCapability};
use crate::{
    adapter_instance_probe, adapter_provider_probe, RuntimeConfigFile, RuntimeInstanceProbe,
    RuntimeProviderProbe,
};
use serde_json::Value;

mod claude;
mod hermes;

pub struct AdapterProbeResult {
    pub provider: RuntimeProviderProbe,
    pub instances: Vec<RuntimeInstanceProbe>,
}

pub struct AdapterLaunchContext {
    pub runtime_host: Option<String>,
    pub runtime_command: Option<String>,
    pub profile_executable: Option<String>,
}

pub fn probe_adapter(
    adapter: &AdapterDefinition,
    config: &RuntimeConfigFile,
) -> AdapterProbeResult {
    match adapter.extension.as_deref() {
        Some("builtin.claude") => claude::probe(adapter, config),
        Some("builtin.hermes") => hermes::probe(adapter, config),
        _ => {
            let instance = adapter_instance_probe(adapter);
            AdapterProbeResult {
                provider: adapter_provider_probe(adapter, &instance),
                instances: vec![instance],
            }
        }
    }
}

pub fn build_launch_spec(
    adapter: &AdapterDefinition,
    config: &RuntimeConfigFile,
    context: AdapterLaunchContext,
) -> Option<Result<crate::acp_runtime::AdapterLaunchSpec, String>> {
    match adapter.extension.as_deref() {
        Some("builtin.claude") => Some(Ok(claude::launch_spec(adapter, config, context))),
        Some("builtin.hermes") => Some(Ok(hermes::launch_spec(adapter, config, context))),
        _ => None,
    }
}

pub fn adapter_targets(
    adapter: &AdapterDefinition,
    config: &RuntimeConfigFile,
    runtime_instance_id: Option<&str>,
) -> Option<Result<Vec<Value>, String>> {
    match adapter.extension.as_deref() {
        Some("builtin.hermes") => Some(hermes::targets(adapter, config, runtime_instance_id)),
        _ => None,
    }
}

pub fn slash_commands(
    adapter: &AdapterDefinition,
    config: &RuntimeConfigFile,
    runtime_instance_id: Option<&str>,
) -> Option<Result<Vec<SlashCommandCapability>, String>> {
    match adapter.extension.as_deref() {
        Some("builtin.hermes") => Some(hermes::slash_commands(adapter, config, runtime_instance_id)),
        _ => None,
    }
}

pub(super) fn attach_adapter_metadata(
    mut instance: RuntimeInstanceProbe,
    adapter: &AdapterDefinition,
) -> RuntimeInstanceProbe {
    instance.transport = Some(adapter.transport.clone());
    instance.adapter_source_path = Some(adapter.source_path.clone());
    instance.capabilities = Some(adapter.capabilities.clone());
    instance
}

pub(super) fn runtime_instance_probe_with_metadata(
    id: &str,
    adapter: &AdapterDefinition,
    runtime_label: &str,
    command_kind: &str,
    command: &str,
    configured: bool,
    result: Result<String, String>,
) -> RuntimeInstanceProbe {
    attach_adapter_metadata(
        crate::runtime_instance_probe(
            id,
            adapter.id.as_str(),
            runtime_label,
            command_kind,
            command,
            configured,
            result,
        ),
        adapter,
    )
}

pub fn generic_launch_spec(
    adapter: AdapterDefinition,
    runtime_command: Option<String>,
) -> Result<crate::acp_runtime::AdapterLaunchSpec, String> {
    let mut adapter = adapter;
    if let Some(command) = runtime_command.filter(|value| !value.trim().is_empty()) {
        let rendered_command = format!("{} {}", adapter.command, adapter.args.join(" "))
            .trim()
            .to_string();
        if command.trim() != rendered_command {
            adapter.command = command;
        }
    }
    crate::adapter_registry::allow_process_exec(&adapter, &adapter.command, &adapter.args)?;
    Ok(crate::acp_runtime::AdapterLaunchSpec {
        id: adapter.id,
        name: adapter.name,
        command: adapter.command,
        args: adapter.args,
        env: adapter.env,
        cwd: adapter.cwd,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::adapter_registry::{AdapterCapabilities, AdapterPermissions, ProcessExecPermission};
    use std::collections::HashMap;

    #[test]
    fn generic_launch_spec_ignores_manifest_display_command_override() {
        let command = r"C:\Program Files\nodejs\npx.CMD".to_string();
        let adapter = AdapterDefinition {
            id: "codex".to_string(),
            name: "OpenAI Codex".to_string(),
            extension: None,
            version: None,
            description: None,
            transport: "stdio_json".to_string(),
            command: command.clone(),
            args: vec!["-y".to_string(), "@openai/codex".to_string()],
            env: HashMap::new(),
            cwd: None,
            requires_pty: false,
            health_check: None,
            capabilities: AdapterCapabilities::default(),
            permissions: AdapterPermissions {
                process_exec: vec![ProcessExecPermission {
                    command: command.clone(),
                    args: vec![
                        "-y".to_string(),
                        "@openai/codex".to_string(),
                        "**".to_string(),
                    ],
                }],
            },
            source_path: "".to_string(),
            manifest_id: "codex".to_string(),
        };

        let spec = generic_launch_spec(
            adapter,
            Some(r"C:\Program Files\nodejs\npx.CMD -y @openai/codex".to_string()),
        )
        .expect("launch spec should ignore display command override");

        assert_eq!(spec.command, command);
        assert_eq!(spec.args, ["-y", "@openai/codex"]);
    }
}
