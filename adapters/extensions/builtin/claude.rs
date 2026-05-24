use super::{runtime_instance_probe_with_metadata, AdapterLaunchContext, AdapterProbeResult};
use crate::adapter_registry::AdapterDefinition;
use crate::{is_configured, provider_probe_from_instances, run_shell, RuntimeConfigFile};
use serde_json::Value;
use std::collections::HashMap;
use std::env;
use std::fs;
use std::path::PathBuf;

pub(super) fn probe(adapter: &AdapterDefinition, config: &RuntimeConfigFile) -> AdapterProbeResult {
    let configured = is_configured(&config.claude_command) || !config.claude_args.is_empty();
    let mut instances = Vec::new();
    if cfg!(windows) {
        instances.push(runtime_instance_probe_with_metadata(
            "claude-win",
            adapter,
            "Win",
            "native",
            "npx.cmd",
            configured,
            run_shell("claude.cmd", &["--version"]),
        ));
        instances.push(runtime_instance_probe_with_metadata(
            "claude-wsl",
            adapter,
            "WSL",
            "wsl",
            "npx",
            false,
            run_shell(
                "wsl.exe",
                &["--exec", "bash", "-lc", "command -v claude >/dev/null && claude --version && command -v npx >/dev/null && npx --version"],
            ),
        ));
    } else {
        let command = config
            .claude_command
            .clone()
            .unwrap_or_else(|| "claude".to_string());
        instances.push(runtime_instance_probe_with_metadata(
            "claude-native",
            adapter,
            "",
            "native",
            &command,
            configured,
            run_shell(&command, &["--version"]),
        ));
    }
    AdapterProbeResult {
        provider: provider_probe_from_instances(
            adapter.id.as_str(),
            configured,
            &adapter.name,
            &instances,
        ),
        instances,
    }
}

pub(super) fn launch_spec(
    adapter: &AdapterDefinition,
    config: &RuntimeConfigFile,
    context: AdapterLaunchContext,
) -> crate::acp_runtime::AdapterLaunchSpec {
    let runtime_host = context.runtime_host.as_deref();
    let default_command = if cfg!(windows) { "npx.cmd" } else { "npx" };
    let executable = context
        .runtime_command
        .as_deref()
        .or(config.claude_command.as_deref())
        .unwrap_or(default_command);
    let args = if config.claude_args.is_empty() {
        vec![
            "-y".to_string(),
            "@agentclientprotocol/claude-agent-acp".to_string(),
        ]
    } else {
        config.claude_args.clone()
    };
    if cfg!(windows) && runtime_host == Some("wsl") {
        let mut wsl_args = vec!["--exec".to_string(), executable.to_string()];
        wsl_args.extend(args);
        crate::acp_runtime::AdapterLaunchSpec {
            id: adapter.id.clone(),
            name: adapter.name.clone(),
            command: "wsl.exe".to_string(),
            args: wsl_args,
            env: HashMap::new(),
            cwd: None,
        }
    } else {
        crate::acp_runtime::AdapterLaunchSpec {
            id: adapter.id.clone(),
            name: adapter.name.clone(),
            command: executable.to_string(),
            args,
            env: load_user_env(),
            cwd: None,
        }
    }
}

fn load_user_env() -> HashMap<String, String> {
    let mut envs = HashMap::new();
    let Some(home) = home_dir() else {
        return envs;
    };
    let settings_path = home.join(".claude").join("settings.json");
    let Ok(raw) = fs::read_to_string(settings_path) else {
        return envs;
    };
    let Ok(settings) = serde_json::from_str::<Value>(&raw) else {
        return envs;
    };
    let Some(object) = settings.get("env").and_then(|value| value.as_object()) else {
        return envs;
    };

    for (key, value) in object {
        match value {
            Value::String(text) => {
                envs.insert(key.clone(), text.clone());
            }
            Value::Number(number) => {
                envs.insert(key.clone(), number.to_string());
            }
            Value::Bool(boolean) => {
                envs.insert(key.clone(), boolean.to_string());
            }
            _ => {}
        }
    }

    envs
}

fn home_dir() -> Option<PathBuf> {
    env::var_os("USERPROFILE")
        .map(PathBuf::from)
        .or_else(|| env::var_os("HOME").map(PathBuf::from))
}
