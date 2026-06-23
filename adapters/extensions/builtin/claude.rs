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
        let mut win = runtime_instance_probe_with_metadata(
            "claude-win",
            adapter,
            "Win",
            "native",
            "npx.cmd",
            configured,
            run_shell("claude.cmd", &["--version"]),
        );
        apply_auth_status(&mut win, run_shell("claude.cmd", &["auth", "status"]));
        instances.push(win);
        let mut wsl = runtime_instance_probe_with_metadata(
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
        );
        apply_auth_status(
            &mut wsl,
            run_shell("wsl.exe", &["--exec", "bash", "-lc", "claude auth status"]),
        );
        instances.push(wsl);
    } else {
        let command = config
            .claude_command
            .clone()
            .unwrap_or_else(|| "claude".to_string());
        let mut native = runtime_instance_probe_with_metadata(
            "claude-native",
            adapter,
            "",
            "native",
            &command,
            configured,
            run_shell(&command, &["--version"]),
        );
        apply_auth_status(&mut native, run_shell(&command, &["auth", "status"]));
        instances.push(native);
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

fn apply_auth_status(instance: &mut crate::RuntimeInstanceProbe, result: Result<String, String>) {
    match result {
        Ok(raw) => match serde_json::from_str::<Value>(&raw) {
            Ok(value) => {
                let logged_in = value.get("loggedIn").and_then(Value::as_bool);
                instance.health.logged_in = match logged_in {
                    Some(true) => "ok",
                    Some(false) => "required",
                    None => "unknown",
                }
                .to_string();
                instance.health.model_or_key_configured = match logged_in {
                    Some(false) => "missing",
                    _ => "unknown",
                }
                .to_string();
                instance
                    .health_evidence
                    .push(crate::runtime_probe::health_evidence(
                        "logged_in",
                        "claude_auth_status",
                        match logged_in {
                            Some(true) => "Claude Code reports an authenticated account",
                            Some(false) => "Claude Code reports no authenticated account",
                            None => "Claude Code did not report a recognizable login state",
                        }
                        .into(),
                    ));
                instance
                    .health_evidence
                    .push(crate::runtime_probe::health_evidence(
                        "model_or_key_configured",
                        "claude_auth_status",
                        "authentication status does not verify model access or credential validity"
                            .into(),
                    ));
                if logged_in == Some(false) {
                    instance.health.unavailable_reason = Some("auth_required".into());
                    instance.health.repair_hint = Some("run_agent_login".into());
                }
            }
            Err(_) => {
                instance.health.logged_in = "failed".into();
                instance.health.unavailable_reason = Some("login_verification_failed".into());
                instance.health.repair_hint = Some("check_runtime_login".into());
                instance
                    .health_evidence
                    .push(crate::runtime_probe::health_evidence(
                        "logged_in",
                        "claude_auth_status",
                        "authentication command returned an unrecognized response".into(),
                    ));
            }
        },
        Err(error) => {
            instance.health.logged_in = "failed".into();
            instance
                .health_evidence
                .push(crate::runtime_probe::health_evidence(
                    "logged_in",
                    "claude_auth_status",
                    crate::runtime_probe::redact_diagnostic_detail(&error),
                ));
            if instance.available {
                instance.health.unavailable_reason = Some("login_verification_failed".into());
                instance.health.repair_hint = Some("check_runtime_login".into());
            }
        }
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
