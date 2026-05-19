use chrono::Local;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use tauri::{AppHandle, Manager};

mod acp_runtime;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

const HISTORY_SCHEMA_VERSION: u32 = 2;

fn history_schema_version() -> u32 {
    HISTORY_SCHEMA_VERSION
}

fn classify_backend_error(error: String) -> String {
    let lower = error.to_lowercase();
    let code = if lower.contains("启动 claude acp adapter 失败")
        || lower.contains("not recognized")
        || lower.contains("not found")
        || lower.contains("找不到")
    {
        "RUNTIME_NOT_FOUND"
    } else if lower.contains("permission") || lower.contains("denied") || lower.contains("权限") {
        "PERMISSION_DENIED"
    } else if lower.contains("session") && (lower.contains("not found") || lower.contains("不存在")) {
        "SESSION_NOT_FOUND"
    } else if lower.contains("json") || lower.contains("parse") || lower.contains("解析") {
        "PROTOCOL_PARSE_FAILED"
    } else if lower.contains("broken pipe") || lower.contains("child") || lower.contains("进程") {
        "RUNTIME_EXITED"
    } else {
        "UNKNOWN"
    };
    format!("[{code}] {error}")
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct HistoryEntry {
    #[serde(default = "history_schema_version")]
    schema_version: u32,
    id: String,
    date: String,
    created_at: String,
    provider_id: String,
    provider_name: String,
    agent_id: String,
    agent_name: String,
    session_id: Option<String>,
    acp_session_id: Option<String>,
    task: String,
    status: String,
    summary: String,
    turn: Option<Value>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HistoryEntryInput {
    schema_version: Option<u32>,
    provider_id: String,
    provider_name: String,
    agent_id: String,
    agent_name: String,
    session_id: Option<String>,
    acp_session_id: Option<String>,
    task: String,
    status: String,
    summary: String,
    turn: Option<Value>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct HermesProfileMeta {
    id: String,
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
struct HistoryCompactResult {
    removed_count: usize,
    upgraded_count: usize,
    skipped_files: usize,
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

fn clean_hermes_output(raw: &str) -> Vec<String> {
    raw.lines()
        .map(|line| line.replace('\u{0000}', "").trim().to_string())
        .filter(|line| {
            !line.is_empty()
                && !line.starts_with("wsl:")
                && !line.contains("localhost")
                && !line.contains("WSL")
                && !line.chars().all(|ch| matches!(ch, 'в' | '”' | 'Ђ' | '—' | '†' | ' '))
        })
        .collect()
}

fn parse_hermes_profile_list(raw: &str) -> Vec<(String, String, String, Option<String>, bool)> {
    let mut rows: std::collections::HashMap<String, (String, String, Option<String>, bool)> =
        std::collections::HashMap::new();
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
        let should_replace = match rows.get(&profile_name) {
            Some((_, existing_gateway, _, _)) => existing_gateway != "running" && gateway == "running",
            None => true,
        };
        if should_replace {
            rows.insert(
                profile_name,
                (model, gateway.to_string(), alias, is_default),
            );
        }
    }
    rows.into_iter()
        .map(|(profile_name, (model, gateway, alias, is_default))| {
            (profile_name, model, gateway, alias, is_default)
        })
        .collect()
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

#[tauri::command]
fn runtime_hermes_profiles() -> Result<Vec<HermesProfileMeta>, String> {
    let list_raw = run_shell("wsl.exe", &["-e", "bash", "-lc", "hermes profile list"])?;
    let list_rows = parse_hermes_profile_list(&list_raw);
    if list_rows.is_empty() {
        return Ok(Vec::new());
    }

    let mut profiles = Vec::new();
    for (profile_name, model, gateway, alias, is_default) in list_rows {
        let show_cmd = format!("hermes profile show {}", profile_name);
        let show_raw = run_shell("wsl.exe", &["-e", "bash", "-lc", &show_cmd]).unwrap_or_default();
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
        let subtitle = format!("WSL Profile · {}", if gateway == "running" { "Gateway 运行中" } else { "Gateway 已停止" });
        let note = format!(
            "模型：{} · Skills：{}{}{}",
            if model.is_empty() { "未配置" } else { &model },
            skill_count.map(|count| count.to_string()).unwrap_or_else(|| "未知".to_string()),
            if has_env { " · .env" } else { "" },
            if has_soul { " · SOUL.md" } else { "" }
        );
        profiles.push(HermesProfileMeta {
            id: format!("hermes-profile-{}", profile_name),
            profile_name: profile_name.clone(),
            display_name: if is_default {
                "default".to_string()
            } else {
                profile_name.clone()
            },
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

fn history_file_for_today(app: &AppHandle) -> Result<(PathBuf, String, String), String> {
    let now = Local::now();
    let date = now.format("%Y-%m-%d").to_string();
    let timestamp = now.to_rfc3339();
    Ok((history_dir(app)?.join(format!("{date}.json")), date, timestamp))
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
    let directory = history_dir(&app)?;
    let mut entries = Vec::new();

    for item in fs::read_dir(&directory).map_err(|error| error.to_string())? {
        let item = item.map_err(|error| error.to_string())?;
        let path = item.path();
        if path.extension().and_then(|value| value.to_str()) != Some("json") {
            continue;
        }
        if let Some(mut day_entries) = try_load_history_file(&path) {
            entries.append(&mut day_entries);
        }
    }

    entries.sort_by(|left, right| right.created_at.cmp(&left.created_at));
    Ok(entries)
}

#[tauri::command]
fn compact_history_entries(app: AppHandle) -> Result<HistoryCompactResult, String> {
    let directory = history_dir(&app)?;
    let mut removed_count = 0;
    let mut upgraded_count = 0;
    let mut skipped_files = 0;

    for item in fs::read_dir(&directory).map_err(|error| error.to_string())? {
        let item = item.map_err(|error| error.to_string())?;
        let path = item.path();
        if path.extension().and_then(|value| value.to_str()) != Some("json") {
            continue;
        }
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
            let json = serde_json::to_string_pretty(&compacted).map_err(|error| error.to_string())?;
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
fn append_history_entry(app: AppHandle, entry: HistoryEntryInput) -> Result<HistoryEntry, String> {
    let (path, date, timestamp) = history_file_for_today(&app)?;
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
        session_id: entry.session_id,
        acp_session_id: entry.acp_session_id,
        task: entry.task,
        status: entry.status,
        summary: entry.summary,
        turn: entry.turn,
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
        return Err(classify_backend_error(if !stderr.is_empty() { stderr } else { stdout }));
    };
    let events = parse_claude_stream(&raw);
    if events.is_empty() {
        return Err(classify_backend_error("Claude Code 未返回可解析事件。".to_string()));
    }
    Ok(events)
}

#[tauri::command]
async fn runtime_acp_claude_prompt(
    runtime_session_id: String,
    prompt: String,
    cwd: Option<String>,
) -> Result<Vec<Value>, String> {
    let result = tauri::async_runtime::spawn_blocking(move || {
        acp_runtime::run_claude_acp_prompt(runtime_session_id, prompt, cwd)
    })
    .await
    .map_err(|error| classify_backend_error(error.to_string()))?;
    result.map_err(classify_backend_error)
}

#[tauri::command]
async fn runtime_acp_hermes_prompt(
    runtime_session_id: String,
    prompt: String,
    cwd: Option<String>,
    profile_command: Option<String>,
) -> Result<Vec<Value>, String> {
    let result = tauri::async_runtime::spawn_blocking(move || {
        acp_runtime::run_hermes_acp_prompt(runtime_session_id, prompt, cwd, profile_command)
    })
    .await
    .map_err(|error| classify_backend_error(error.to_string()))?;
    result.map_err(classify_backend_error)
}

#[tauri::command]
async fn runtime_acp_claude_resume(
    runtime_session_id: String,
    acp_session_id: String,
    cwd: Option<String>,
) -> Result<Vec<Value>, String> {
    let result = tauri::async_runtime::spawn_blocking(move || {
        acp_runtime::resume_claude_acp_session(runtime_session_id, acp_session_id, cwd)
    })
    .await
    .map_err(|error| classify_backend_error(error.to_string()))?;
    result.map_err(classify_backend_error)
}

#[tauri::command]
async fn runtime_acp_hermes_resume(
    runtime_session_id: String,
    acp_session_id: String,
    cwd: Option<String>,
    profile_command: Option<String>,
) -> Result<Vec<Value>, String> {
    let result = tauri::async_runtime::spawn_blocking(move || {
        acp_runtime::resume_hermes_acp_session(
            runtime_session_id,
            acp_session_id,
            cwd,
            profile_command,
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
    runtime_session_id: String,
    acp_session_id: String,
    cwd: Option<String>,
) -> Result<Vec<Value>, String> {
    let result = tauri::async_runtime::spawn_blocking(move || {
        acp_runtime::load_claude_acp_session(runtime_session_id, acp_session_id, cwd)
    })
    .await
    .map_err(|error| classify_backend_error(error.to_string()))?;
    result.map_err(classify_backend_error)
}

#[tauri::command]
async fn runtime_acp_hermes_load(
    runtime_session_id: String,
    acp_session_id: String,
    cwd: Option<String>,
    profile_command: Option<String>,
) -> Result<Vec<Value>, String> {
    let result = tauri::async_runtime::spawn_blocking(move || {
        acp_runtime::load_hermes_acp_session(
            runtime_session_id,
            acp_session_id,
            cwd,
            profile_command,
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
            append_history_entry,
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
