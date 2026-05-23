use chrono::Local;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use tauri::{AppHandle, Emitter, Manager};

mod acp_runtime;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

const HISTORY_SCHEMA_VERSION: u32 = 3;

fn history_schema_version() -> u32 {
    HISTORY_SCHEMA_VERSION
}

fn classify_backend_error(error: String) -> String {
    let lower = error.to_lowercase();
    let code = if lower.contains("session")
        && (lower.contains("not found") || lower.contains("不存在"))
    {
        "SESSION_NOT_FOUND"
    } else if lower.contains("permission") || lower.contains("denied") || lower.contains("权限") {
        "PERMISSION_DENIED"
    } else if lower.contains("missing executable") || lower.contains("no such file or directory") {
        "RUNTIME_DEPENDENCY_MISSING"
    } else if lower.contains("启动 claude acp adapter 失败")
        || lower.contains("启动 hermes acp adapter 失败")
        || lower.contains("not recognized")
        || lower.contains("not found")
        || lower.contains("cannot find")
        || lower.contains("找不到")
    {
        "RUNTIME_NOT_FOUND"
    } else if lower.contains("json") || lower.contains("parse") || lower.contains("解析") {
        "PROTOCOL_PARSE_FAILED"
    } else if lower.contains("broken pipe")
        || lower.contains("child")
        || lower.contains("进程")
        || lower.contains("已关闭 stdout")
        || lower.contains("closed stdout")
    {
        "RUNTIME_EXITED"
    } else {
        "UNKNOWN"
    };
    format!("[{code}] {error}")
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct HistoryEntry {
    #[serde(default = "history_schema_version")]
    schema_version: u32,
    id: String,
    date: String,
    #[serde(alias = "created_at")]
    created_at: String,
    #[serde(alias = "provider_id")]
    provider_id: String,
    #[serde(alias = "provider_name")]
    provider_name: String,
    #[serde(alias = "agent_id")]
    agent_id: String,
    #[serde(alias = "agent_name")]
    agent_name: String,
    #[serde(default, alias = "runtime_instance_id")]
    runtime_instance_id: Option<String>,
    #[serde(default, alias = "runtime_label")]
    runtime_label: Option<String>,
    #[serde(default, alias = "runtime_host")]
    runtime_host: Option<String>,
    #[serde(default, alias = "runtime_command")]
    runtime_command: Option<String>,
    #[serde(default, alias = "target_id")]
    target_id: Option<String>,
    #[serde(default, alias = "target_name")]
    target_name: Option<String>,
    #[serde(default, alias = "profile_executable")]
    profile_executable: Option<String>,
    #[serde(alias = "session_id")]
    session_id: Option<String>,
    #[serde(alias = "acp_session_id")]
    acp_session_id: Option<String>,
    task: String,
    status: String,
    summary: String,
    turn: Option<Value>,
    #[serde(alias = "runtime_state")]
    runtime_state: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HistoryEntryInput {
    schema_version: Option<u32>,
    provider_id: String,
    provider_name: String,
    agent_id: String,
    agent_name: String,
    runtime_instance_id: Option<String>,
    runtime_label: Option<String>,
    runtime_host: Option<String>,
    runtime_command: Option<String>,
    target_id: Option<String>,
    target_name: Option<String>,
    profile_executable: Option<String>,
    session_id: Option<String>,
    acp_session_id: Option<String>,
    task: String,
    status: String,
    summary: String,
    turn: Option<Value>,
    runtime_state: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
struct RuntimeConfigFile {
    claude_command: Option<String>,
    #[serde(default)]
    claude_args: Vec<String>,
    hermes_host: Option<String>,
    hermes_command: Option<String>,
}

impl From<RuntimeConfigFile> for acp_runtime::RuntimeConfig {
    fn from(value: RuntimeConfigFile) -> Self {
        acp_runtime::RuntimeConfig {
            claude_command: value.claude_command,
            claude_args: value.claude_args,
            hermes_host: value.hermes_host,
            hermes_command: value.hermes_command,
            runtime_host: None,
            runtime_command: None,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct HermesProfileMeta {
    id: String,
    runtime_instance_id: String,
    runtime_label: String,
    command_kind: String,
    command: String,
    profile_name: String,
    display_name: String,
    subtitle: String,
    note: String,
    state: u8,
    model: String,
    gateway: String,
    alias: Option<String>,
    path: String,
    skill_count: Option<u32>,
    has_env: bool,
    has_soul: bool,
    is_default: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeProviderProbe {
    provider_id: String,
    configured: bool,
    available: bool,
    command: String,
    summary: String,
    detail: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeProbeResult {
    providers: Vec<RuntimeProviderProbe>,
    instances: Vec<RuntimeInstanceProbe>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RuntimeInstanceProbe {
    id: String,
    provider_id: String,
    runtime_label: String,
    command_kind: String,
    command: String,
    configured: bool,
    available: bool,
    summary: String,
    detail: String,
    version: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct HistoryCompactResult {
    removed_count: usize,
    upgraded_count: usize,
    skipped_files: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct HistoryDeleteResult {
    removed_count: usize,
    skipped_files: usize,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RuntimeSessionStreamPayload {
    runtime_session_id: String,
    event: Value,
}

fn build_command(program: &str) -> Command {
    let mut command = Command::new(program);
    #[cfg(windows)]
    {
        command.creation_flags(CREATE_NO_WINDOW);
    }
    command
}

fn run_shell(shell: &str, args: &[&str]) -> Result<String, String> {
    let output = build_command(shell)
        .args(args)
        .output()
        .map_err(|error| error.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if output.status.success() {
        Ok(stdout)
    } else if !stderr.is_empty() {
        Err(stderr)
    } else {
        Err(stdout)
    }
}

fn is_configured(value: &Option<String>) -> bool {
    value.as_ref().is_some_and(|item| !item.trim().is_empty())
}

fn first_output_line(output: &str) -> Option<String> {
    output
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(ToString::to_string)
}

fn runtime_instance_probe(
    id: &str,
    provider_id: &str,
    runtime_label: &str,
    command_kind: &str,
    command: &str,
    configured: bool,
    result: Result<String, String>,
) -> RuntimeInstanceProbe {
    let (available, detail) = match result {
        Ok(output) => (true, output),
        Err(error) => (false, error),
    };
    let summary = if available {
        "available"
    } else if configured {
        "unavailable"
    } else {
        "not_configured"
    };
    let version = available.then(|| first_output_line(&detail)).flatten();
    RuntimeInstanceProbe {
        id: id.to_string(),
        provider_id: provider_id.to_string(),
        runtime_label: runtime_label.to_string(),
        command_kind: command_kind.to_string(),
        command: command.to_string(),
        configured,
        available,
        summary: summary.to_string(),
        detail,
        version,
    }
}

fn provider_probe_from_instances(
    provider_id: &str,
    configured: bool,
    command: &str,
    instances: &[RuntimeInstanceProbe],
) -> RuntimeProviderProbe {
    let available_count = instances.iter().filter(|item| item.available).count();
    let available = available_count > 0;
    let summary = if available {
        "available"
    } else if configured {
        "unavailable"
    } else {
        "not_configured"
    };
    let detail = if instances.is_empty() {
        "未检测到运行环境。".to_string()
    } else {
        format!("{} / {} runtime 可用。", available_count, instances.len())
    };
    RuntimeProviderProbe {
        provider_id: provider_id.to_string(),
        configured,
        available,
        command: command.to_string(),
        summary: summary.to_string(),
        detail,
    }
}

#[tauri::command]
fn runtime_probe(app: AppHandle) -> RuntimeProbeResult {
    let config = load_runtime_config_file(&app);
    let claude_configured = is_configured(&config.claude_command) || !config.claude_args.is_empty();
    let hermes_command = config
        .hermes_command
        .clone()
        .unwrap_or_else(|| "hermes".to_string());
    let hermes_configured =
        is_configured(&config.hermes_host) || is_configured(&config.hermes_command);

    let mut instances = Vec::new();
    if cfg!(windows) {
        instances.push(runtime_instance_probe(
            "claude-win",
            "claude",
            "Win",
            "native",
            "npx.cmd",
            claude_configured,
            run_shell("claude.cmd", &["--version"]),
        ));
        instances.push(runtime_instance_probe(
            "claude-wsl",
            "claude",
            "WSL",
            "wsl",
            "npx",
            false,
            run_shell(
                "wsl.exe",
                &["--exec", "bash", "-lc", "command -v claude >/dev/null && claude --version && command -v npx >/dev/null && npx --version"],
            ),
        ));
        instances.push(runtime_instance_probe(
            "hermes-win",
            "hermes",
            "Win",
            "native",
            &hermes_command,
            hermes_configured,
            run_shell(&hermes_command, &["--version"]),
        ));
        instances.push(runtime_instance_probe(
            "hermes-wsl",
            "hermes",
            "WSL",
            "wsl",
            &hermes_command,
            hermes_configured,
            run_shell(
                "wsl.exe",
                &[
                    "--exec",
                    "bash",
                    "-lc",
                    &format!(
                        "command -v {hermes_command} >/dev/null && {hermes_command} --version"
                    ),
                ],
            ),
        ));
    } else {
        let claude_command = config
            .claude_command
            .clone()
            .unwrap_or_else(|| "claude".to_string());
        instances.push(runtime_instance_probe(
            "claude-native",
            "claude",
            "",
            "native",
            &claude_command,
            claude_configured,
            run_shell(&claude_command, &["--version"]),
        ));
        instances.push(runtime_instance_probe(
            "hermes-native",
            "hermes",
            "",
            "native",
            &hermes_command,
            hermes_configured,
            run_shell(&hermes_command, &["--version"]),
        ));
    }

    let claude_instances: Vec<RuntimeInstanceProbe> = instances
        .iter()
        .filter(|item| item.provider_id == "claude")
        .cloned()
        .collect();
    let hermes_instances: Vec<RuntimeInstanceProbe> = instances
        .iter()
        .filter(|item| item.provider_id == "hermes")
        .cloned()
        .collect();

    RuntimeProbeResult {
        providers: vec![
            provider_probe_from_instances(
                "claude",
                claude_configured,
                "Claude Code",
                &claude_instances,
            ),
            provider_probe_from_instances("hermes", hermes_configured, "Hermes", &hermes_instances),
            RuntimeProviderProbe {
                provider_id: "trae".to_string(),
                configured: false,
                available: false,
                command: "IDE Bridge".to_string(),
                summary: "planned".to_string(),
                detail: "Trae IDE bridge is reserved for a later integration.".to_string(),
            },
        ],
        instances,
    }
}

fn clean_hermes_output(raw: &str) -> Vec<String> {
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

fn parse_hermes_profile_list(raw: &str) -> Vec<(String, String, String, Option<String>, bool)> {
    let mut rows = Vec::new();
    for line in clean_hermes_output(raw) {
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

fn parse_hermes_profile_show(raw: &str) -> std::collections::HashMap<String, String> {
    let mut details = std::collections::HashMap::new();
    for line in clean_hermes_output(raw) {
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

fn hermes_instance_parts(
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

fn run_hermes_profile_command(
    config: &RuntimeConfigFile,
    runtime_instance_id: Option<&str>,
    args: &[&str],
) -> Result<String, String> {
    let (_, _, command_kind, executable) = hermes_instance_parts(config, runtime_instance_id);
    if cfg!(windows) && command_kind == "wsl" {
        let mut command_args = vec!["--exec", executable.as_str()];
        command_args.extend_from_slice(args);
        run_shell("wsl.exe", &command_args)
    } else {
        run_shell(&executable, args)
    }
}

#[tauri::command]
fn runtime_hermes_profiles(
    app: AppHandle,
    runtime_instance_id: Option<String>,
) -> Result<Vec<HermesProfileMeta>, String> {
    let config = load_runtime_config_file(&app);
    let (instance_id, runtime_label, command_kind, command) =
        hermes_instance_parts(&config, runtime_instance_id.as_deref());
    let list_raw = run_hermes_profile_command(&config, Some(&instance_id), &["profile", "list"])?;
    let list_rows = parse_hermes_profile_list(&list_raw);
    if list_rows.is_empty() {
        return Ok(Vec::new());
    }

    let mut profiles = Vec::new();
    let mut profile_counts: HashMap<String, usize> = HashMap::new();
    for (profile_name, _, _, _, _) in &list_rows {
        *profile_counts.entry(profile_name.clone()).or_default() += 1;
    }
    let mut profile_seen: HashMap<String, usize> = HashMap::new();
    for (profile_name, model, gateway, alias, is_default) in list_rows {
        let show_raw = run_hermes_profile_command(
            &config,
            Some(&instance_id),
            &["profile", "show", &profile_name],
        )
        .unwrap_or_default();
        let details = parse_hermes_profile_show(&show_raw);
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
        profiles.push(HermesProfileMeta {
            id: profile_id,
            runtime_instance_id: instance_id.clone(),
            runtime_label: runtime_label.clone(),
            command_kind: command_kind.clone(),
            command: command.clone(),
            profile_name: profile_name.clone(),
            display_name,
            subtitle,
            note,
            state: if gateway == "running" { 1 } else { 9 },
            model,
            gateway,
            alias: alias_path,
            path,
            skill_count,
            has_env,
            has_soul,
            is_default,
        });
    }

    Ok(profiles)
}

fn history_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let base_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())?;
    let history_dir = base_dir.join("history");
    fs::create_dir_all(&history_dir).map_err(|error| error.to_string())?;
    Ok(history_dir)
}

fn history_bucket_dir(app: &AppHandle, bucket: &str) -> Result<PathBuf, String> {
    let directory = history_dir(app)?.join(bucket);
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    Ok(directory)
}

fn history_file_for_today(
    app: &AppHandle,
    bucket: &str,
) -> Result<(PathBuf, String, String), String> {
    let now = Local::now();
    let date = now.format("%Y-%m-%d").to_string();
    let timestamp = now.to_rfc3339();
    Ok((
        history_bucket_dir(app, bucket)?.join(format!("{date}.json")),
        date,
        timestamp,
    ))
}

fn history_file_for_date(app: &AppHandle, bucket: &str, date: &str) -> Result<PathBuf, String> {
    Ok(history_bucket_dir(app, bucket)?.join(format!("{date}.json")))
}

fn runtime_config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let base_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(&base_dir).map_err(|error| error.to_string())?;
    Ok(base_dir.join("runtime-config.json"))
}

fn load_runtime_config_file(app: &AppHandle) -> RuntimeConfigFile {
    let Ok(path) = runtime_config_path(app) else {
        return RuntimeConfigFile::default();
    };
    let Ok(raw) = fs::read_to_string(path) else {
        return RuntimeConfigFile::default();
    };
    serde_json::from_str::<RuntimeConfigFile>(&raw).unwrap_or_default()
}

#[tauri::command]
fn load_runtime_config(app: AppHandle) -> Result<RuntimeConfigFile, String> {
    Ok(load_runtime_config_file(&app))
}

#[tauri::command]
fn save_runtime_config(
    app: AppHandle,
    config: RuntimeConfigFile,
) -> Result<RuntimeConfigFile, String> {
    let path = runtime_config_path(&app)?;
    let json = serde_json::to_string_pretty(&config).map_err(|error| error.to_string())?;
    fs::write(path, json).map_err(|error| error.to_string())?;
    Ok(config)
}

fn load_history_file(path: &PathBuf) -> Result<Vec<HistoryEntry>, String> {
    if !path.exists() {
        return Ok(Vec::new());
    }
    let raw = fs::read_to_string(path).map_err(|error| error.to_string())?;
    if raw.trim().is_empty() {
        return Ok(Vec::new());
    }
    serde_json::from_str::<Vec<HistoryEntry>>(&raw).map_err(|error| error.to_string())
}

fn try_load_history_file(path: &PathBuf) -> Option<Vec<HistoryEntry>> {
    match load_history_file(path) {
        Ok(entries) => Some(entries),
        Err(error) => {
            eprintln!("跳过损坏的历史文件 {}：{}", path.display(), error);
            None
        }
    }
}

fn history_json_files(app: &AppHandle) -> Result<Vec<PathBuf>, String> {
    let mut files = Vec::new();
    for directory in [
        history_dir(app)?,
        history_bucket_dir(app, "live")?,
        history_bucket_dir(app, "archive")?,
    ] {
        for item in fs::read_dir(&directory).map_err(|error| error.to_string())? {
            let item = item.map_err(|error| error.to_string())?;
            let path = item.path();
            if path.extension().and_then(|value| value.to_str()) == Some("json") {
                files.push(path);
            }
        }
    }
    Ok(files)
}

fn history_entry_turn_id(entry: &HistoryEntry) -> Option<String> {
    entry
        .turn
        .as_ref()
        .and_then(|turn| turn.get("id"))
        .and_then(|id| id.as_str())
        .map(ToString::to_string)
}

fn history_entry_session_key(entry: &HistoryEntry) -> Option<String> {
    entry
        .session_id
        .as_ref()
        .or(entry.acp_session_id.as_ref())
        .map(ToString::to_string)
}

#[tauri::command]
fn load_history_entries(app: AppHandle) -> Result<Vec<HistoryEntry>, String> {
    let mut entries = Vec::new();

    for path in history_json_files(&app)? {
        if let Some(mut day_entries) = try_load_history_file(&path) {
            entries.append(&mut day_entries);
        }
    }

    entries.sort_by(|left, right| right.created_at.cmp(&left.created_at));
    Ok(entries)
}

#[tauri::command]
fn compact_history_entries(app: AppHandle) -> Result<HistoryCompactResult, String> {
    let mut removed_count = 0;
    let mut upgraded_count = 0;
    let mut skipped_files = 0;

    for path in history_json_files(&app)? {
        let Some(entries) = try_load_history_file(&path) else {
            skipped_files += 1;
            continue;
        };
        let original_len = entries.len();
        let mut seen = HashSet::new();
        let mut compacted = Vec::new();
        let mut upgraded = false;

        for mut entry in entries.into_iter().rev() {
            if entry.schema_version != HISTORY_SCHEMA_VERSION {
                entry.schema_version = HISTORY_SCHEMA_VERSION;
                upgraded = true;
                upgraded_count += 1;
            }
            let key = format!(
                "{}:{}",
                history_entry_session_key(&entry).unwrap_or_else(|| entry.id.clone()),
                history_entry_turn_id(&entry).unwrap_or_else(|| entry.id.clone())
            );
            if seen.insert(key) {
                compacted.push(entry);
            }
        }

        compacted.reverse();
        let removed_for_file = original_len.saturating_sub(compacted.len());
        removed_count += removed_for_file;
        if removed_for_file > 0 || upgraded {
            let json =
                serde_json::to_string_pretty(&compacted).map_err(|error| error.to_string())?;
            fs::write(path, json).map_err(|error| error.to_string())?;
        }
    }

    Ok(HistoryCompactResult {
        removed_count,
        upgraded_count,
        skipped_files,
    })
}

#[tauri::command]
fn delete_history_session_entries(
    app: AppHandle,
    session_id: String,
) -> Result<HistoryDeleteResult, String> {
    let session_id = session_id.trim().to_string();
    if session_id.is_empty() {
        return Err("session_id 不能为空".to_string());
    }

    let mut removed_count = 0;
    let mut skipped_files = 0;

    for path in history_json_files(&app)? {
        let Some(entries) = try_load_history_file(&path) else {
            skipped_files += 1;
            continue;
        };
        let original_len = entries.len();
        let retained: Vec<HistoryEntry> = entries
            .into_iter()
            .filter(|entry| {
                history_entry_session_key(entry).unwrap_or_else(|| entry.id.clone()) != session_id
            })
            .collect();
        let removed_for_file = original_len.saturating_sub(retained.len());
        if removed_for_file > 0 {
            removed_count += removed_for_file;
            let json =
                serde_json::to_string_pretty(&retained).map_err(|error| error.to_string())?;
            fs::write(path, json).map_err(|error| error.to_string())?;
        }
    }

    Ok(HistoryDeleteResult {
        removed_count,
        skipped_files,
    })
}

#[tauri::command]
fn archive_history_session_entries(
    app: AppHandle,
    session_id: String,
) -> Result<HistoryDeleteResult, String> {
    let session_id = session_id.trim().to_string();
    if session_id.is_empty() {
        return Err("session_id 不能为空".to_string());
    }

    let mut moved_count = 0;
    let mut skipped_files = 0;
    let live_dir = history_bucket_dir(&app, "live")?;

    for item in fs::read_dir(&live_dir).map_err(|error| error.to_string())? {
        let item = item.map_err(|error| error.to_string())?;
        let path = item.path();
        if path.extension().and_then(|value| value.to_str()) != Some("json") {
            continue;
        }
        let Some(entries) = try_load_history_file(&path) else {
            skipped_files += 1;
            continue;
        };
        let mut retained = Vec::new();
        let mut moved = Vec::new();
        for mut entry in entries {
            if history_entry_session_key(&entry).unwrap_or_else(|| entry.id.clone()) == session_id {
                entry.runtime_state = Some("archived".to_string());
                moved.push(entry);
            } else {
                retained.push(entry);
            }
        }
        if moved.is_empty() {
            continue;
        }
        moved_count += moved.len();
        let json = serde_json::to_string_pretty(&retained).map_err(|error| error.to_string())?;
        fs::write(&path, json).map_err(|error| error.to_string())?;
        for entry in moved {
            let archive_path = history_file_for_date(&app, "archive", &entry.date)?;
            let mut archive_entries = load_history_file(&archive_path)?;
            archive_entries.push(entry);
            archive_entries.sort_by(|left, right| right.created_at.cmp(&left.created_at));
            let json = serde_json::to_string_pretty(&archive_entries)
                .map_err(|error| error.to_string())?;
            fs::write(archive_path, json).map_err(|error| error.to_string())?;
        }
    }

    Ok(HistoryDeleteResult {
        removed_count: moved_count,
        skipped_files,
    })
}

#[tauri::command]
fn append_history_entry(app: AppHandle, entry: HistoryEntryInput) -> Result<HistoryEntry, String> {
    let bucket = if entry.runtime_state.as_deref() == Some("live") {
        "live"
    } else {
        "archive"
    };
    let (path, date, timestamp) = history_file_for_today(&app, bucket)?;
    let mut entries = load_history_file(&path)?;
    let saved = HistoryEntry {
        schema_version: entry.schema_version.unwrap_or(HISTORY_SCHEMA_VERSION),
        id: format!("{}-{}", date, timestamp.replace([':', '+'], "-")),
        date,
        created_at: timestamp,
        provider_id: entry.provider_id,
        provider_name: entry.provider_name,
        agent_id: entry.agent_id,
        agent_name: entry.agent_name,
        runtime_instance_id: entry.runtime_instance_id,
        runtime_label: entry.runtime_label,
        runtime_host: entry.runtime_host,
        runtime_command: entry.runtime_command,
        target_id: entry.target_id,
        target_name: entry.target_name,
        profile_executable: entry.profile_executable,
        session_id: entry.session_id,
        acp_session_id: entry.acp_session_id,
        task: entry.task,
        status: entry.status,
        summary: entry.summary,
        turn: entry.turn,
        runtime_state: entry.runtime_state,
    };
    let saved_turn_id = history_entry_turn_id(&saved);
    let saved_session_key = history_entry_session_key(&saved);
    if let Some(index) = entries.iter().position(|item| {
        history_entry_session_key(item) == saved_session_key
            && saved_turn_id.is_some()
            && history_entry_turn_id(item) == saved_turn_id
    }) {
        entries[index] = saved.clone();
    } else {
        entries.push(saved.clone());
    }
    let json = serde_json::to_string_pretty(&entries).map_err(|error| error.to_string())?;
    fs::write(path, json).map_err(|error| error.to_string())?;
    Ok(saved)
}

fn parse_claude_stream(raw: &str) -> Vec<Value> {
    raw.lines()
        .filter_map(|line| serde_json::from_str::<Value>(line).ok())
        .filter_map(map_claude_event)
        .collect()
}

fn map_claude_event(value: Value) -> Option<Value> {
    let event_type = value.get("type")?.as_str()?;
    match event_type {
        "system" => Some(serde_json::json!({
            "type": "state",
            "state": 0,
            "payload": {
                "content": "Claude Code 会话已初始化。"
            }
        })),
        "assistant" => {
            let message = value.get("message")?;
            let content = message.get("content")?.as_array()?;
            let first = content.first()?;
            let content_type = first.get("type")?.as_str()?;
            let text = first
                .get("text")
                .and_then(|item| item.as_str())
                .or_else(|| first.get("thinking").and_then(|item| item.as_str()))
                .unwrap_or("")
                .trim()
                .to_string();

            if text.is_empty() {
                return None;
            }

            match content_type {
                "thinking" => Some(serde_json::json!({
                    "type": "thought",
                    "state": 2,
                    "payload": { "content": text }
                })),
                _ => Some(serde_json::json!({
                    "type": "response",
                    "state": 4,
                    "payload": { "content": text }
                })),
            }
        }
        "result" => {
            let result_text = value
                .get("result")
                .and_then(|item| item.as_str())
                .unwrap_or("Claude Code 任务完成。");
            Some(serde_json::json!({
                "type": "state",
                "state": 5,
                "payload": { "content": result_text }
            }))
        }
        _ => None,
    }
}

#[tauri::command]
fn run_claude_stream(prompt: String) -> Result<Vec<Value>, String> {
    let mut child = build_command("cmd")
        .args([
            "/c",
            "claude -p --verbose --output-format stream-json --input-format text --tools \"\"",
        ])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| classify_backend_error(error.to_string()))?;

    if let Some(stdin) = child.stdin.as_mut() {
        stdin
            .write_all(prompt.as_bytes())
            .map_err(|error| classify_backend_error(error.to_string()))?;
    }

    let output = child
        .wait_with_output()
        .map_err(|error| classify_backend_error(error.to_string()))?;
    let raw = if output.status.success() {
        String::from_utf8_lossy(&output.stdout).to_string()
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        return Err(classify_backend_error(if !stderr.is_empty() {
            stderr
        } else {
            stdout
        }));
    };
    let events = parse_claude_stream(&raw);
    if events.is_empty() {
        return Err(classify_backend_error(
            "Claude Code 未返回可解析事件。".to_string(),
        ));
    }
    Ok(events)
}

#[tauri::command]
async fn runtime_acp_claude_prompt(
    app: AppHandle,
    runtime_session_id: String,
    prompt: String,
    cwd: Option<String>,
    runtime_host: Option<String>,
    runtime_command: Option<String>,
) -> Result<Vec<Value>, String> {
    let runtime_session_id_for_emit = runtime_session_id.clone();
    let mut config = acp_runtime::RuntimeConfig::from(load_runtime_config_file(&app));
    config.runtime_host = runtime_host;
    config.runtime_command = runtime_command;
    let result = tauri::async_runtime::spawn_blocking(move || {
        let mut emit_update = |event: Value| {
            let payload = RuntimeSessionStreamPayload {
                runtime_session_id: runtime_session_id_for_emit.clone(),
                event,
            };
            let _ = app.emit("runtime-session-update", payload);
        };
        acp_runtime::run_claude_acp_prompt(
            runtime_session_id,
            prompt,
            cwd,
            config,
            Some(&mut emit_update),
        )
    })
    .await
    .map_err(|error| classify_backend_error(error.to_string()))?;
    result.map_err(classify_backend_error)
}

#[tauri::command]
async fn runtime_acp_hermes_prompt(
    app: AppHandle,
    runtime_session_id: String,
    prompt: String,
    cwd: Option<String>,
    runtime_host: Option<String>,
    runtime_command: Option<String>,
    profile_executable: Option<String>,
) -> Result<Vec<Value>, String> {
    let runtime_session_id_for_emit = runtime_session_id.clone();
    let mut config = acp_runtime::RuntimeConfig::from(load_runtime_config_file(&app));
    config.runtime_host = runtime_host;
    config.runtime_command = runtime_command;
    let result = tauri::async_runtime::spawn_blocking(move || {
        let mut emit_update = |event: Value| {
            let payload = RuntimeSessionStreamPayload {
                runtime_session_id: runtime_session_id_for_emit.clone(),
                event,
            };
            let _ = app.emit("runtime-session-update", payload);
        };
        acp_runtime::run_hermes_acp_prompt(
            runtime_session_id,
            prompt,
            cwd,
            profile_executable,
            config,
            Some(&mut emit_update),
        )
    })
    .await
    .map_err(|error| classify_backend_error(error.to_string()))?;
    result.map_err(classify_backend_error)
}

#[tauri::command]
async fn runtime_acp_claude_resume(
    app: AppHandle,
    runtime_session_id: String,
    acp_session_id: String,
    cwd: Option<String>,
    runtime_host: Option<String>,
    runtime_command: Option<String>,
) -> Result<Vec<Value>, String> {
    let mut config = acp_runtime::RuntimeConfig::from(load_runtime_config_file(&app));
    config.runtime_host = runtime_host;
    config.runtime_command = runtime_command;
    let result = tauri::async_runtime::spawn_blocking(move || {
        acp_runtime::resume_claude_acp_session(runtime_session_id, acp_session_id, cwd, config)
    })
    .await
    .map_err(|error| classify_backend_error(error.to_string()))?;
    result.map_err(classify_backend_error)
}

#[tauri::command]
async fn runtime_acp_hermes_resume(
    app: AppHandle,
    runtime_session_id: String,
    acp_session_id: String,
    cwd: Option<String>,
    runtime_host: Option<String>,
    runtime_command: Option<String>,
    profile_executable: Option<String>,
) -> Result<Vec<Value>, String> {
    let mut config = acp_runtime::RuntimeConfig::from(load_runtime_config_file(&app));
    config.runtime_host = runtime_host;
    config.runtime_command = runtime_command;
    let result = tauri::async_runtime::spawn_blocking(move || {
        acp_runtime::resume_hermes_acp_session(
            runtime_session_id,
            acp_session_id,
            cwd,
            profile_executable,
            config,
        )
    })
    .await
    .map_err(|error| classify_backend_error(error.to_string()))?;
    result.map_err(classify_backend_error)
}

#[tauri::command]
async fn runtime_acp_claude_alive_ids() -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(|| acp_runtime::list_live_claude_acp_sessions())
        .await
        .map_err(|error| classify_backend_error(error.to_string()))?
        .map_err(classify_backend_error)
}

#[tauri::command]
async fn runtime_acp_hermes_alive_ids() -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(|| acp_runtime::list_live_hermes_acp_sessions())
        .await
        .map_err(|error| classify_backend_error(error.to_string()))?
        .map_err(classify_backend_error)
}

#[tauri::command]
async fn runtime_acp_claude_shutdown(runtime_session_id: String) -> Result<bool, String> {
    let result = tauri::async_runtime::spawn_blocking(move || {
        acp_runtime::shutdown_claude_acp_session(runtime_session_id)
    })
    .await
    .map_err(|error| classify_backend_error(error.to_string()))?;
    result.map_err(classify_backend_error)
}

#[tauri::command]
async fn runtime_acp_hermes_shutdown(runtime_session_id: String) -> Result<bool, String> {
    let result = tauri::async_runtime::spawn_blocking(move || {
        acp_runtime::shutdown_hermes_acp_session(runtime_session_id)
    })
    .await
    .map_err(|error| classify_backend_error(error.to_string()))?;
    result.map_err(classify_backend_error)
}

#[tauri::command]
async fn runtime_acp_claude_load(
    app: AppHandle,
    runtime_session_id: String,
    acp_session_id: String,
    cwd: Option<String>,
    runtime_host: Option<String>,
    runtime_command: Option<String>,
) -> Result<Vec<Value>, String> {
    let mut config = acp_runtime::RuntimeConfig::from(load_runtime_config_file(&app));
    config.runtime_host = runtime_host;
    config.runtime_command = runtime_command;
    let result = tauri::async_runtime::spawn_blocking(move || {
        acp_runtime::load_claude_acp_session(runtime_session_id, acp_session_id, cwd, config)
    })
    .await
    .map_err(|error| classify_backend_error(error.to_string()))?;
    result.map_err(classify_backend_error)
}

#[tauri::command]
async fn runtime_acp_hermes_load(
    app: AppHandle,
    runtime_session_id: String,
    acp_session_id: String,
    cwd: Option<String>,
    runtime_host: Option<String>,
    runtime_command: Option<String>,
    profile_executable: Option<String>,
) -> Result<Vec<Value>, String> {
    let mut config = acp_runtime::RuntimeConfig::from(load_runtime_config_file(&app));
    config.runtime_host = runtime_host;
    config.runtime_command = runtime_command;
    let result = tauri::async_runtime::spawn_blocking(move || {
        acp_runtime::load_hermes_acp_session(
            runtime_session_id,
            acp_session_id,
            cwd,
            profile_executable,
            config,
        )
    })
    .await
    .map_err(|error| classify_backend_error(error.to_string()))?;
    result.map_err(classify_backend_error)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            load_history_entries,
            compact_history_entries,
            delete_history_session_entries,
            archive_history_session_entries,
            append_history_entry,
            load_runtime_config,
            save_runtime_config,
            runtime_probe,
            runtime_hermes_profiles,
            run_claude_stream,
            runtime_acp_claude_prompt,
            runtime_acp_hermes_prompt,
            runtime_acp_claude_resume,
            runtime_acp_hermes_resume,
            runtime_acp_claude_load,
            runtime_acp_hermes_load,
            runtime_acp_claude_shutdown,
            runtime_acp_hermes_shutdown,
            runtime_acp_claude_alive_ids,
            runtime_acp_hermes_alive_ids
        ])
        .on_window_event(|_window, event| {
            if matches!(event, tauri::WindowEvent::Destroyed) {
                let _ = acp_runtime::shutdown_all_claude_acp_sessions();
                let _ = acp_runtime::shutdown_all_hermes_acp_sessions();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
