use chrono::Local;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use tauri::{AppHandle, Manager};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Serialize, Deserialize, Clone)]
struct HistoryEntry {
    id: String,
    date: String,
    created_at: String,
    provider_id: String,
    provider_name: String,
    agent_id: String,
    agent_name: String,
    task: String,
    status: String,
    summary: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HistoryEntryInput {
    provider_id: String,
    provider_name: String,
    agent_id: String,
    agent_name: String,
    task: String,
    status: String,
    summary: String,
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
        let mut day_entries = load_history_file(&path)?;
        entries.append(&mut day_entries);
    }

    entries.sort_by(|left, right| right.created_at.cmp(&left.created_at));
    Ok(entries)
}

#[tauri::command]
fn append_history_entry(app: AppHandle, entry: HistoryEntryInput) -> Result<HistoryEntry, String> {
    let (path, date, timestamp) = history_file_for_today(&app)?;
    let mut entries = load_history_file(&path)?;
    let saved = HistoryEntry {
        id: format!("{}-{}", date, timestamp.replace([':', '+'], "-")),
        date,
        created_at: timestamp,
        provider_id: entry.provider_id,
        provider_name: entry.provider_name,
        agent_id: entry.agent_id,
        agent_name: entry.agent_name,
        task: entry.task,
        status: entry.status,
        summary: entry.summary,
    };
    entries.push(saved.clone());
    let json = serde_json::to_string_pretty(&entries).map_err(|error| error.to_string())?;
    fs::write(path, json).map_err(|error| error.to_string())?;
    Ok(saved)
}

#[tauri::command]
fn probe_runtimes() -> serde_json::Value {
    let claude = match run_shell("cmd", &["/c", "claude --version"]) {
        Ok(stdout) => serde_json::json!({
            "available": true,
            "version": stdout,
            "detail": "Windows CLI 已可调用"
        }),
        Err(error) => serde_json::json!({
            "available": false,
            "version": "",
            "detail": error
        }),
    };

    let hermes = match run_shell(
        "wsl.exe",
        &["-e", "bash", "-lc", "command -v hermes && hermes --version"],
    ) {
        Ok(stdout) => {
            let version_line = stdout
                .lines()
                .last()
                .unwrap_or(stdout.as_str())
                .trim()
                .to_string();
            serde_json::json!({
                "available": true,
                "version": version_line,
                "detail": "WSL 运行时已可见"
            })
        }
        Err(error) => serde_json::json!({
            "available": false,
            "version": "",
            "detail": error
        }),
    };

    let trae = serde_json::json!({
        "available": false,
        "version": "",
        "detail": "等待 IDE Bridge"
    });

    serde_json::json!({
        "claude": claude,
        "hermes": hermes,
        "trae": trae
    })
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            load_history_entries,
            append_history_entry,
            probe_runtimes,
            run_claude_stream
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
