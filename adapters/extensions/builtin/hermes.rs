use super::{runtime_instance_probe_with_metadata, AdapterLaunchContext, AdapterProbeResult};
use crate::adapter_registry::{AdapterDefinition, SlashCommandCapability};
use crate::{is_configured, provider_probe_from_instances, run_shell, RuntimeConfigFile};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::Path;

pub(super) fn probe(adapter: &AdapterDefinition, config: &RuntimeConfigFile) -> AdapterProbeResult {
    let command = config
        .hermes_command
        .clone()
        .unwrap_or_else(|| "hermes".to_string());
    let configured = is_configured(&config.hermes_host) || is_configured(&config.hermes_command);
    let mut instances = Vec::new();
    if cfg!(windows) {
        instances.push(runtime_instance_probe_with_metadata(
            "hermes-win",
            adapter,
            "Win",
            "native",
            &command,
            configured,
            run_shell(&command, &["--version"]),
        ));
        instances.push(runtime_instance_probe_with_metadata(
            "hermes-wsl",
            adapter,
            "WSL",
            "wsl",
            &command,
            configured,
            run_shell(
                "wsl.exe",
                &[
                    "--exec",
                    "bash",
                    "-lc",
                    &format!("command -v {command} >/dev/null && {command} --version"),
                ],
            ),
        ));
    } else {
        instances.push(runtime_instance_probe_with_metadata(
            "hermes-native",
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
    let executable = context
        .profile_executable
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .or(context.runtime_command.as_deref())
        .or(config.hermes_command.as_deref())
        .unwrap_or("hermes");
    if cfg!(windows)
        && (runtime_host == Some("wsl")
            || (runtime_host.is_none() && config.hermes_host.as_deref() != Some("native")))
    {
        crate::acp_runtime::AdapterLaunchSpec {
            id: adapter.id.clone(),
            name: adapter.name.clone(),
            command: "wsl.exe".to_string(),
            args: vec![
                "--".to_string(),
                executable.to_string(),
                "acp".to_string(),
                "--accept-hooks".to_string(),
            ],
            env: HashMap::new(),
            cwd: None,
        }
    } else {
        crate::acp_runtime::AdapterLaunchSpec {
            id: adapter.id.clone(),
            name: adapter.name.clone(),
            command: executable.to_string(),
            args: vec!["acp".to_string(), "--accept-hooks".to_string()],
            env: HashMap::new(),
            cwd: None,
        }
    }
}

fn clean_output(raw: &str) -> Vec<String> {
    raw.lines()
        .map(|line| line.replace('\u{0000}', "").trim().to_string())
        .filter(|line| {
            !line.is_empty()
                && !line.starts_with("wsl:")
                && !line.contains("localhost")
                && !line.contains("WSL")
                && !line
                    .chars()
                    .all(|ch| matches!(ch, 'в' | '”' | 'Ђ' | '—' | '†' | ' '))
        })
        .collect()
}

fn parse_profile_list(raw: &str) -> Vec<(String, String, String, Option<String>, bool)> {
    let mut rows = Vec::new();
    for line in clean_output(raw) {
        if line.starts_with("Profile") {
            continue;
        }
        if !line.contains("running") && !line.contains("stopped") {
            continue;
        }
        let gateway = if line.contains("running") {
            "running"
        } else {
            "stopped"
        };
        let parts: Vec<&str> = line.split_whitespace().collect();
        let Some(gateway_index) = parts.iter().position(|part| *part == gateway) else {
            continue;
        };
        if gateway_index < 2 {
            continue;
        }

        let raw_profile = parts[0];
        let is_default = raw_profile.contains("default");
        let profile_name = if is_default { "default" } else { raw_profile }.to_string();
        let model = parts[1..gateway_index].join(" ");
        let alias_raw = parts.get(gateway_index + 1).copied().unwrap_or("");
        let alias = if alias_raw.is_empty() || alias_raw.contains('в') || alias_raw == "—" {
            None
        } else {
            Some(alias_raw.to_string())
        };
        rows.push((profile_name, model, gateway.to_string(), alias, is_default));
    }
    rows
}

fn parse_profile_show(raw: &str) -> HashMap<String, String> {
    let mut details = HashMap::new();
    for line in clean_output(raw) {
        if let Some((key, value)) = line.split_once(':') {
            details.insert(key.trim().to_lowercase(), value.trim().to_string());
        }
    }
    details
}

fn sanitize_id_fragment(value: &str) -> String {
    value
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
                ch
            } else {
                '-'
            }
        })
        .collect()
}

fn skill_name_from_path(path: &Path) -> Option<String> {
    path.file_stem()
        .or_else(|| path.file_name())
        .and_then(|value| value.to_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

fn skill_command(name: String) -> SlashCommandCapability {
    SlashCommandCapability {
        name,
        description_key: None,
        description: Some("Hermes skill".to_string()),
        kind: Some("skill".to_string()),
        source: Some("runtime".to_string()),
    }
}

fn discover_skills_from_profile_path(profile_path: &str, command_kind: &str) -> Vec<SlashCommandCapability> {
    let names = if cfg!(windows) && command_kind == "wsl" {
        let skills_dir = format!("{}/skills", profile_path.trim_end_matches('/'));
        let quoted = shell_quote(&skills_dir);
        let script = format!("if [ -d {quoted} ]; then find {quoted} -mindepth 1 -maxdepth 1 -printf '%f\\n'; fi");
        run_shell("wsl.exe", &["--exec", "bash", "-lc", &script])
            .map(|raw| {
                raw.lines()
                    .map(str::trim)
                    .filter(|line| !line.is_empty())
                    .map(ToString::to_string)
                    .collect::<Vec<String>>()
            })
            .unwrap_or_default()
    } else {
        let skills_dir = Path::new(profile_path).join("skills");
        let Ok(entries) = fs::read_dir(skills_dir) else {
            return Vec::new();
        };
        entries
            .flatten()
            .filter_map(|entry| skill_name_from_path(&entry.path()))
            .collect::<Vec<String>>()
    };

    let mut commands = names
        .into_iter()
        .map(|name| {
            let name = Path::new(&name)
                .file_stem()
                .or_else(|| Path::new(&name).file_name())
                .and_then(|value| value.to_str())
                .unwrap_or(&name)
                .to_string();
            skill_command(name)
        })
        .filter(|command| !command.name.trim().is_empty())
        .collect::<Vec<SlashCommandCapability>>();
    commands.sort_by(|left, right| left.name.cmp(&right.name));
    commands.dedup_by(|left, right| left.name == right.name);
    commands
}

fn instance_parts(
    config: &RuntimeConfigFile,
    runtime_instance_id: Option<&str>,
) -> (String, String, String, String) {
    let default_id = if cfg!(windows) && config.hermes_host.as_deref() != Some("native") {
        "hermes-wsl"
    } else if cfg!(windows) {
        "hermes-win"
    } else {
        "hermes-native"
    };
    let instance_id = runtime_instance_id.unwrap_or(default_id);
    let command = config
        .hermes_command
        .clone()
        .unwrap_or_else(|| "hermes".to_string());
    match instance_id {
        "hermes-win" => (
            "hermes-win".to_string(),
            "Win".to_string(),
            "native".to_string(),
            command,
        ),
        "hermes-wsl" => (
            "hermes-wsl".to_string(),
            "WSL".to_string(),
            "wsl".to_string(),
            command,
        ),
        "hermes-native" => (
            "hermes-native".to_string(),
            "".to_string(),
            "native".to_string(),
            command,
        ),
        value => (
            value.to_string(),
            "".to_string(),
            config
                .hermes_host
                .clone()
                .unwrap_or_else(|| "native".to_string()),
            command,
        ),
    }
}

fn run_profile_command(
    config: &RuntimeConfigFile,
    runtime_instance_id: Option<&str>,
    args: &[&str],
) -> Result<String, String> {
    let (_, _, command_kind, executable) = instance_parts(config, runtime_instance_id);
    if cfg!(windows) && command_kind == "wsl" {
        let mut command_args = vec!["--exec", executable.as_str()];
        command_args.extend_from_slice(args);
        run_shell("wsl.exe", &command_args)
    } else {
        run_shell(&executable, args)
    }
}

pub(super) fn targets(
    adapter: &AdapterDefinition,
    config: &RuntimeConfigFile,
    runtime_instance_id: Option<&str>,
) -> Result<Vec<Value>, String> {
    let (instance_id, runtime_label, command_kind, command) =
        instance_parts(config, runtime_instance_id);
    let list_raw = run_profile_command(config, Some(&instance_id), &["profile", "list"])?;
    let list_rows = parse_profile_list(&list_raw);
    if list_rows.is_empty() {
        return Ok(Vec::new());
    }

    let mut targets = Vec::new();
    let mut profile_counts: HashMap<String, usize> = HashMap::new();
    for (profile_name, _, _, _, _) in &list_rows {
        *profile_counts.entry(profile_name.clone()).or_default() += 1;
    }
    let mut profile_seen: HashMap<String, usize> = HashMap::new();
    for (profile_name, model, gateway, alias, is_default) in list_rows {
        let show_raw = run_profile_command(
            config,
            Some(&instance_id),
            &["profile", "show", &profile_name],
        )
        .unwrap_or_default();
        let details = parse_profile_show(&show_raw);
        let path = details.get("path").cloned().unwrap_or_default();
        let skill_count = details
            .get("skills")
            .and_then(|value| value.parse::<u32>().ok());
        let has_env = details
            .get(".env")
            .map(|value| value.eq_ignore_ascii_case("exists"))
            .unwrap_or(false);
        let has_soul = details
            .get("soul.md")
            .map(|value| value.eq_ignore_ascii_case("exists"))
            .unwrap_or(false);
        let alias_path = details.get("alias").cloned().or(alias.clone());
        let environment = if runtime_label.is_empty() {
            "Profile"
        } else if runtime_label == "Win" {
            "Win Profile"
        } else {
            "WSL Profile"
        };
        let subtitle = format!(
            "{} · {}",
            environment,
            if gateway == "running" {
                "Gateway 运行中"
            } else {
                "Gateway 已停止"
            }
        );
        let note = format!(
            "模型：{} · Skills：{}{}{}",
            if model.is_empty() {
                "未配置"
            } else {
                &model
            },
            skill_count
                .map(|count| count.to_string())
                .unwrap_or_else(|| "未知".to_string()),
            if has_env { " · .env" } else { "" },
            if has_soul { " · SOUL.md" } else { "" }
        );
        let profile_index = profile_seen.entry(profile_name.clone()).or_default();
        *profile_index += 1;
        let has_duplicate_name = profile_counts.get(&profile_name).copied().unwrap_or(0) > 1;
        let profile_id = if has_duplicate_name {
            format!(
                "{}:profile:{}-{}",
                instance_id,
                sanitize_id_fragment(&profile_name),
                profile_index
            )
        } else {
            format!(
                "{}:profile:{}",
                instance_id,
                sanitize_id_fragment(&profile_name)
            )
        };
        let display_name = if has_duplicate_name {
            format!("{} #{}", profile_name, profile_index)
        } else if is_default {
            "default".to_string()
        } else {
            profile_name.clone()
        };
        let state = if gateway == "running" { 1 } else { 9 };
        let model_or_key = if !model.is_empty() || has_env { "unknown" } else { "unknown" };
        targets.push(serde_json::json!({
            "id": profile_id,
            "providerId": adapter.id,
            "runtimeInstanceId": instance_id,
            "runtimeLabel": runtime_label,
            "runtimeHost": command_kind,
            "runtimeCommand": command,
            "kind": "profile",
            "name": display_name,
            "displayName": display_name,
            "subtitle": subtitle,
            "note": note,
            "state": state,
            "available": gateway == "running",
            "profileName": profile_name,
            "model": model,
            "profileModel": model,
            "gateway": gateway,
            "alias": alias_path,
            "profileAlias": alias_path,
            "profileExecutable": alias_path,
            "path": path,
            "profilePath": path,
            "skillCount": skill_count,
            "hasEnv": has_env,
            "hasSoul": has_soul,
            "isDefault": is_default,
            "modelControl": adapter.model_control.clone(),
            "health": {
                "installed": "ok",
                "loggedIn": "unknown",
                "cliCallable": "ok",
                "profileConfigured": "ok",
                "wslOrBridgeAvailable": if command_kind == "wsl" { "ok" } else { "unknown" },
                "modelOrKeyConfigured": model_or_key,
                "versionStatus": "unknown",
                "unavailableReason": if gateway == "running" { Value::Null } else { Value::String("runtime_stopped".into()) },
                "repairHint": if gateway == "running" { Value::Null } else { Value::String("send_to_connect".into()) }
            },
            "healthEvidence": [
                { "field": "profile_configured", "source": "hermes_profile_show", "detail": if path.is_empty() { "profile discovered" } else { "profile path discovered" } },
                { "field": "model_or_key_configured", "source": "hermes_profile_show", "detail": "configuration presence observed; validity was not verified" }
            ]
        }));
    }

    Ok(targets)
}

pub(super) fn slash_commands(
    _adapter: &AdapterDefinition,
    config: &RuntimeConfigFile,
    runtime_instance_id: Option<&str>,
) -> Result<Vec<SlashCommandCapability>, String> {
    let (instance_id, _, command_kind, _) = instance_parts(config, runtime_instance_id);
    let list_raw = run_profile_command(config, Some(&instance_id), &["profile", "list"])?;
    let mut commands = Vec::new();
    for (profile_name, _, gateway, _, _) in parse_profile_list(&list_raw) {
        if gateway != "running" {
            continue;
        }
        let show_raw = run_profile_command(
            config,
            Some(&instance_id),
            &["profile", "show", &profile_name],
        )
        .unwrap_or_default();
        let details = parse_profile_show(&show_raw);
        let Some(path) = details.get("path") else {
            continue;
        };
        commands.extend(discover_skills_from_profile_path(path, &command_kind));
    }
    commands.sort_by(|left, right| left.name.cmp(&right.name));
    commands.dedup_by(|left, right| left.name == right.name);
    Ok(commands)
}
