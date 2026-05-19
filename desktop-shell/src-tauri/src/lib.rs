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
        .map_err(|error| error.to_string())?;

    if let Some(stdin) = child.stdin.as_mut() {
        stdin
            .write_all(prompt.as_bytes())
            .map_err(|error| error.to_string())?;
    }

    let output = child.wait_with_output().map_err(|error| error.to_string())?;
    let raw = if output.status.success() {
        String::from_utf8_lossy(&output.stdout).to_string()
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        return Err(if !stderr.is_empty() { stderr } else { stdout });
    };
    let events = parse_claude_stream(&raw);
    if events.is_empty() {
        return Err("Claude Code 未返回可解析事件。".to_string());
    }
    Ok(events)
}

#[tauri::command]
async fn runtime_acp_claude_prompt(
    runtime_session_id: String,
    prompt: String,
    cwd: Option<String>,
) -> Result<Vec<Value>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        acp_runtime::run_claude_acp_prompt(runtime_session_id, prompt, cwd)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn runtime_acp_claude_resume(
    runtime_session_id: String,
    acp_session_id: String,
    cwd: Option<String>,
) -> Result<Vec<Value>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        acp_runtime::resume_claude_acp_session(runtime_session_id, acp_session_id, cwd)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn runtime_acp_claude_alive_ids() -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(|| acp_runtime::list_live_claude_acp_sessions())
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn runtime_acp_claude_shutdown(runtime_session_id: String) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        acp_runtime::shutdown_claude_acp_session(runtime_session_id)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn runtime_acp_claude_load(
    runtime_session_id: String,
    acp_session_id: String,
    cwd: Option<String>,
) -> Result<Vec<Value>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        acp_runtime::load_claude_acp_session(runtime_session_id, acp_session_id, cwd)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            load_history_entries,
            compact_history_entries,
            append_history_entry,
            run_claude_stream,
            runtime_acp_claude_prompt,
            runtime_acp_claude_resume,
            runtime_acp_claude_load,
            runtime_acp_claude_shutdown,
            runtime_acp_claude_alive_ids
        ])
        .on_window_event(|_window, event| {
            if matches!(event, tauri::WindowEvent::Destroyed) {
                let _ = acp_runtime::shutdown_all_claude_acp_sessions();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
