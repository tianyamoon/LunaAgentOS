use serde_json::Value;
use std::io::Write;
use std::process::{Command, Stdio};

fn run_shell(shell: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new(shell)
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

    let hermes = match run_shell("wsl.exe", &["-e", "bash", "-lc", "command -v hermes && hermes --version"]) {
        Ok(stdout) => {
            let version_line = stdout.lines().nth(1).unwrap_or(stdout.as_str()).trim().to_string();
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
        .filter_map(|value| map_claude_event(value))
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
fn probe_claude_session() -> Result<Vec<Value>, String> {
    run_claude_stream("请只回复一句当前运行时已就绪。".to_string())
}

#[tauri::command]
fn run_claude_stream(prompt: String) -> Result<Vec<Value>, String> {
    let mut child = Command::new("cmd")
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
            probe_runtimes,
            probe_claude_session,
            run_claude_stream
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
