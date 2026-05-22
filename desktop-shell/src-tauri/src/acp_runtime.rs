use serde_json::{json, Value};
use std::collections::HashMap;
use std::env;
use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::sync::OnceLock;
use std::thread;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

static CLAUDE_SESSIONS: OnceLock<Mutex<HashMap<String, AcpSession>>> = OnceLock::new();
static HERMES_SESSIONS: OnceLock<Mutex<HashMap<String, AcpSession>>> = OnceLock::new();

#[derive(Clone, Copy)]
enum AcpRuntime {
    Claude,
    Hermes,
}

impl AcpRuntime {
    fn display(self) -> &'static str {
        match self {
            AcpRuntime::Claude => "Claude ACP",
            AcpRuntime::Hermes => "Hermes ACP",
        }
    }
}

#[derive(Clone, Default)]
pub struct RuntimeConfig {
    pub claude_command: Option<String>,
    pub claude_args: Vec<String>,
    pub hermes_host: Option<String>,
    pub hermes_command: Option<String>,
    pub runtime_host: Option<String>,
    pub runtime_command: Option<String>,
}

enum SessionStartMode {
    New,
    Resume(String),
    Load(String),
}

struct AcpSession {
    child: Child,
    stdin: ChildStdin,
    reader: BufReader<ChildStdout>,
    next_id: i64,
    session_id: String,
}

pub fn run_claude_acp_prompt(
    runtime_session_id: String,
    prompt: String,
    cwd: Option<String>,
    config: RuntimeConfig,
    on_event: Option<&mut dyn FnMut(Value)>,
) -> Result<Vec<Value>, String> {
    run_acp_prompt(
        AcpRuntime::Claude,
        runtime_session_id,
        prompt,
        cwd,
        None,
        config,
        on_event,
    )
}

pub fn run_hermes_acp_prompt(
    runtime_session_id: String,
    prompt: String,
    cwd: Option<String>,
    profile_executable: Option<String>,
    config: RuntimeConfig,
    on_event: Option<&mut dyn FnMut(Value)>,
) -> Result<Vec<Value>, String> {
    run_acp_prompt(
        AcpRuntime::Hermes,
        runtime_session_id,
        prompt,
        cwd,
        profile_executable,
        config,
        on_event,
    )
}

fn run_acp_prompt(
    runtime: AcpRuntime,
    runtime_session_id: String,
    prompt: String,
    cwd: Option<String>,
    profile_executable: Option<String>,
    config: RuntimeConfig,
    mut on_event: Option<&mut dyn FnMut(Value)>,
) -> Result<Vec<Value>, String> {
    let cwd = match cwd {
        Some(value) if !value.trim().is_empty() => PathBuf::from(value),
        _ => isolated_runtime_cwd(&runtime_session_id)?,
    };
    let mut events = Vec::new();
    let sessions = session_store(runtime);
    let mut sessions = sessions.lock().map_err(|error| error.to_string())?;
    let session = match sessions.get_mut(&runtime_session_id) {
        Some(session) => session,
        None => {
            let session = start_acp_session(
                runtime,
                &cwd,
                &mut events,
                SessionStartMode::New,
                profile_executable.as_deref(),
                &config,
                &mut on_event,
            )?;
            sessions.insert(runtime_session_id.clone(), session);
            sessions
                .get_mut(&runtime_session_id)
                .ok_or_else(|| format!("{} 会话缓存失败。", runtime.display()))?
        }
    };

    match send_prompt(runtime, session, prompt, &mut events, &mut on_event) {
        Ok(()) => Ok(events),
        Err(error) => {
            if let Some(mut broken) = sessions.remove(&runtime_session_id) {
                let _ = broken.child.kill();
                let _ = broken.child.wait();
            }
            Err(error)
        }
    }
}

pub fn resume_claude_acp_session(
    runtime_session_id: String,
    acp_session_id: String,
    cwd: Option<String>,
    config: RuntimeConfig,
) -> Result<Vec<Value>, String> {
    resume_acp_session(AcpRuntime::Claude, runtime_session_id, acp_session_id, cwd, None, config)
}

pub fn resume_hermes_acp_session(
    runtime_session_id: String,
    acp_session_id: String,
    cwd: Option<String>,
    profile_executable: Option<String>,
    config: RuntimeConfig,
) -> Result<Vec<Value>, String> {
    resume_acp_session(AcpRuntime::Hermes, runtime_session_id, acp_session_id, cwd, profile_executable, config)
}

fn resume_acp_session(
    runtime: AcpRuntime,
    runtime_session_id: String,
    acp_session_id: String,
    cwd: Option<String>,
    profile_executable: Option<String>,
    config: RuntimeConfig,
) -> Result<Vec<Value>, String> {
    let cwd = match cwd {
        Some(value) if !value.trim().is_empty() => PathBuf::from(value),
        _ => isolated_runtime_cwd(&runtime_session_id)?,
    };
    let mut events = Vec::new();
    let sessions = session_store(runtime);
    let mut sessions = sessions.lock().map_err(|error| error.to_string())?;
    if sessions.contains_key(&runtime_session_id) {
        events.push(json!({
            "type": "state",
            "state": 1,
            "payload": {
                "content": format!("{} runtime 已在内存中。", runtime.display()),
                "sessionId": acp_session_id
            }
        }));
        return Ok(events);
    }
    let mut on_event = None;
    let session = start_acp_session(
        runtime,
        &cwd,
        &mut events,
        SessionStartMode::Resume(acp_session_id.clone()),
        profile_executable.as_deref(),
        &config,
        &mut on_event,
    )?;
    sessions.insert(runtime_session_id, session);
    Ok(events)
}

pub fn load_claude_acp_session(
    runtime_session_id: String,
    acp_session_id: String,
    cwd: Option<String>,
    config: RuntimeConfig,
) -> Result<Vec<Value>, String> {
    load_acp_session(AcpRuntime::Claude, runtime_session_id, acp_session_id, cwd, None, config)
}

pub fn load_hermes_acp_session(
    runtime_session_id: String,
    acp_session_id: String,
    cwd: Option<String>,
    profile_executable: Option<String>,
    config: RuntimeConfig,
) -> Result<Vec<Value>, String> {
    load_acp_session(AcpRuntime::Hermes, runtime_session_id, acp_session_id, cwd, profile_executable, config)
}

fn load_acp_session(
    runtime: AcpRuntime,
    runtime_session_id: String,
    acp_session_id: String,
    cwd: Option<String>,
    profile_executable: Option<String>,
    config: RuntimeConfig,
) -> Result<Vec<Value>, String> {
    let cwd = match cwd {
        Some(value) if !value.trim().is_empty() => PathBuf::from(value),
        _ => isolated_runtime_cwd(&runtime_session_id)?,
    };
    let mut events = Vec::new();
    let sessions = session_store(runtime);
    let mut sessions = sessions.lock().map_err(|error| error.to_string())?;
    if sessions.contains_key(&runtime_session_id) {
        events.push(json!({
            "type": "state",
            "state": 1,
            "payload": {
                "content": format!("{} runtime 已在内存中。", runtime.display()),
                "sessionId": acp_session_id
            }
        }));
        return Ok(events);
    }
    let mut on_event = None;
    let session = start_acp_session(
        runtime,
        &cwd,
        &mut events,
        SessionStartMode::Load(acp_session_id.clone()),
        profile_executable.as_deref(),
        &config,
        &mut on_event,
    )?;
    sessions.insert(runtime_session_id, session);
    Ok(events)
}

pub fn list_live_claude_acp_sessions() -> Result<Vec<String>, String> {
    list_live_acp_sessions(AcpRuntime::Claude)
}

pub fn list_live_hermes_acp_sessions() -> Result<Vec<String>, String> {
    list_live_acp_sessions(AcpRuntime::Hermes)
}

fn list_live_acp_sessions(runtime: AcpRuntime) -> Result<Vec<String>, String> {
    let sessions = session_store(runtime);
    let mut sessions = sessions.lock().map_err(|error| error.to_string())?;
    let mut alive = Vec::new();
    let mut dead = Vec::new();
    for (id, session) in sessions.iter_mut() {
        match session.child.try_wait() {
            Ok(None) => alive.push(id.clone()),
            _ => dead.push(id.clone()),
        }
    }
    for id in dead {
        if let Some(mut session) = sessions.remove(&id) {
            let _ = session.child.wait();
        }
    }
    Ok(alive)
}

pub fn shutdown_claude_acp_session(runtime_session_id: String) -> Result<bool, String> {
    shutdown_acp_session(AcpRuntime::Claude, runtime_session_id)
}

pub fn shutdown_hermes_acp_session(runtime_session_id: String) -> Result<bool, String> {
    shutdown_acp_session(AcpRuntime::Hermes, runtime_session_id)
}

fn shutdown_acp_session(runtime: AcpRuntime, runtime_session_id: String) -> Result<bool, String> {
    let sessions = session_store(runtime);
    let mut sessions = sessions.lock().map_err(|error| error.to_string())?;
    let Some(mut session) = sessions.remove(&runtime_session_id) else {
        return Ok(false);
    };
    let _ = session.stdin.flush();
    drop(session.stdin);
    let _ = session.child.kill();
    let _ = session.child.wait();
    Ok(true)
}

pub fn shutdown_all_claude_acp_sessions() -> Result<usize, String> {
    shutdown_all_acp_sessions(AcpRuntime::Claude)
}

pub fn shutdown_all_hermes_acp_sessions() -> Result<usize, String> {
    shutdown_all_acp_sessions(AcpRuntime::Hermes)
}

fn shutdown_all_acp_sessions(runtime: AcpRuntime) -> Result<usize, String> {
    let sessions = session_store(runtime);
    let mut sessions = sessions.lock().map_err(|error| error.to_string())?;
    let count = sessions.len();
    for (_id, mut session) in sessions.drain() {
        let _ = session.stdin.flush();
        drop(session.stdin);
        let _ = session.child.kill();
        let _ = session.child.wait();
    }
    Ok(count)
}

fn session_store(runtime: AcpRuntime) -> &'static Mutex<HashMap<String, AcpSession>> {
    match runtime {
        AcpRuntime::Claude => CLAUDE_SESSIONS.get_or_init(|| Mutex::new(HashMap::new())),
        AcpRuntime::Hermes => HERMES_SESSIONS.get_or_init(|| Mutex::new(HashMap::new())),
    }
}

fn start_acp_session(
    runtime: AcpRuntime,
    cwd: &PathBuf,
    mut events: &mut Vec<Value>,
    mode: SessionStartMode,
    profile_executable: Option<&str>,
    config: &RuntimeConfig,
    on_event: &mut Option<&mut dyn FnMut(Value)>,
) -> Result<AcpSession, String> {
    let mut child = build_acp_command(runtime, cwd, profile_executable, config)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("启动 {} adapter 失败：{error}", runtime.display()))?;

    let stderr = child.stderr.take();
    let stderr_log = Arc::new(Mutex::new(String::new()));
    if let Some(stderr) = stderr {
        let stderr_log = Arc::clone(&stderr_log);
        thread::spawn(move || {
            let mut reader = BufReader::new(stderr);
            let mut line = String::new();
            while reader.read_line(&mut line).unwrap_or(0) > 0 {
                if let Ok(mut log) = stderr_log.lock() {
                    log.push_str(&line);
                }
                line.clear();
            }
        });
    }

    let mut stdin = child
        .stdin
        .take()
        .ok_or_else(|| format!("{} adapter stdin 不可用。", runtime.display()))?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| format!("{} adapter stdout 不可用。", runtime.display()))?;
    let mut reader = BufReader::new(stdout);
    let mut next_id: i64 = 0;

    let init = json!({
        "jsonrpc": "2.0",
        "id": next_request_id(&mut next_id),
        "method": "initialize",
        "params": {
            "protocolVersion": 1,
            "clientCapabilities": {
                "fs": {
                    "readTextFile": true,
                    "writeTextFile": true
                }
            },
            "clientInfo": {
                "name": "lunaagentos",
                "title": "LunaAgentOS",
                "version": "0.1.0"
            }
        }
    });
    write_message(&mut stdin, &init)?;
    let init_result = read_response(
        runtime,
        &mut reader,
        &mut stdin,
        init["id"].as_i64().unwrap(),
        &mut events,
        on_event,
    )?;
    push_event(&mut events, json!({
        "type": "state",
        "state": 0,
        "payload": {
            "content": format!("{} 已初始化。", runtime.display()),
            "protocolVersion": init_result.get("protocolVersion").cloned().unwrap_or(Value::Null),
            "agent": init_result.get("agentInfo").cloned().unwrap_or(Value::Null),
            "capabilities": init_result.get("agentCapabilities").cloned().unwrap_or(Value::Null)
        }
    }), on_event);

    let session_request = match mode {
        SessionStartMode::Resume(session_id) => json!({
            "jsonrpc": "2.0",
            "id": next_request_id(&mut next_id),
            "method": "session/resume",
            "params": {
                "sessionId": session_id,
                "cwd": cwd.to_string_lossy().to_string(),
                "mcpServers": []
            }
        }),
        SessionStartMode::Load(session_id) => json!({
            "jsonrpc": "2.0",
            "id": next_request_id(&mut next_id),
            "method": "session/load",
            "params": {
                "sessionId": session_id,
                "cwd": cwd.to_string_lossy().to_string(),
                "mcpServers": []
            }
        }),
        SessionStartMode::New => json!({
            "jsonrpc": "2.0",
            "id": next_request_id(&mut next_id),
            "method": "session/new",
            "params": {
                "cwd": cwd.to_string_lossy().to_string(),
                "mcpServers": []
            }
        }),
    };
    let method = session_request["method"].as_str().unwrap_or("session/new");
    write_message(&mut stdin, &session_request)?;
    let session_result = read_response(
        runtime,
        &mut reader,
        &mut stdin,
        session_request["id"].as_i64().unwrap(),
        &mut events,
        on_event,
    )?;
    let session_id = session_request["params"]["sessionId"]
        .as_str()
        .map(ToString::to_string)
        .or_else(|| session_result
        .get("sessionId")
        .and_then(|value| value.as_str())
        .map(ToString::to_string))
        .ok_or_else(|| format!("{} 未返回 sessionId。", runtime.display()))?;

    let content = match method {
        "session/resume" => format!("{} 会话已恢复。", runtime.display()),
        "session/load" => format!("{} 会话已加载。", runtime.display()),
        _ => format!("{} 会话已创建。", runtime.display()),
    };

    push_event(&mut events, json!({
        "type": "state",
        "state": 1,
        "payload": {
            "content": content,
            "sessionId": session_id
        }
    }), on_event);

    Ok(AcpSession {
        child,
        stdin,
        reader,
        next_id,
        session_id,
    })
}

fn send_prompt(
    runtime: AcpRuntime,
    session: &mut AcpSession,
    prompt: String,
    events: &mut Vec<Value>,
    on_event: &mut Option<&mut dyn FnMut(Value)>,
) -> Result<(), String> {
    let prompt_request = json!({
        "jsonrpc": "2.0",
        "id": next_request_id(&mut session.next_id),
        "method": "session/prompt",
        "params": {
            "sessionId": session.session_id,
            "prompt": [{
                "type": "text",
                "text": prompt
            }]
        }
    });
    write_message(&mut session.stdin, &prompt_request)?;
    let prompt_result = read_response(
        runtime,
        &mut session.reader,
        &mut session.stdin,
        prompt_request["id"].as_i64().unwrap(),
        events,
        on_event,
    )?;

    push_event(events, json!({
        "type": "state",
        "state": 5,
        "payload": {
            "content": format!("{} 回合完成。", runtime.display()),
            "sessionId": session.session_id,
            "stopReason": prompt_result.get("stopReason").cloned().unwrap_or(Value::Null)
        }
    }), on_event);

    if events.is_empty() {
        return Err(format!("{} 未返回可解析事件。", runtime.display()));
    }

    let _ = session.child.id();
    Ok(())
}

fn build_acp_command(runtime: AcpRuntime, cwd: &PathBuf, profile_executable: Option<&str>, config: &RuntimeConfig) -> Command {
    let runtime_host = config.runtime_host.as_deref();
    let mut command = match runtime {
        AcpRuntime::Claude if cfg!(windows) && runtime_host == Some("wsl") => Command::new("wsl.exe"),
        AcpRuntime::Claude if cfg!(windows) => Command::new(
            config
                .runtime_command
                .as_deref()
                .or(config.claude_command.as_deref())
                .unwrap_or("npx.cmd"),
        ),
        AcpRuntime::Claude => Command::new(
            config
                .runtime_command
                .as_deref()
                .or(config.claude_command.as_deref())
                .unwrap_or("npx"),
        ),
        AcpRuntime::Hermes if cfg!(windows) && runtime_host == Some("wsl") => Command::new("wsl.exe"),
        AcpRuntime::Hermes if cfg!(windows) && runtime_host.is_none() && config.hermes_host.as_deref() != Some("native") => Command::new("wsl.exe"),
        AcpRuntime::Hermes => Command::new(
            profile_executable
                .filter(|value| !value.trim().is_empty())
                .or(config.runtime_command.as_deref())
                .or(config.hermes_command.as_deref())
                .unwrap_or("hermes"),
        ),
    };

    #[cfg(windows)]
    {
        command.creation_flags(CREATE_NO_WINDOW);
    }

    match runtime {
        AcpRuntime::Claude => {
            let executable = config
                .runtime_command
                .as_deref()
                .or(config.claude_command.as_deref())
                .unwrap_or(if cfg!(windows) { "npx.cmd" } else { "npx" });
            let args: Vec<String> = if config.claude_args.is_empty() {
                vec!["-y".to_string(), "@agentclientprotocol/claude-agent-acp".to_string()]
            } else {
                config.claude_args.clone()
            };
            if cfg!(windows) && runtime_host == Some("wsl") {
                command.args(["--exec", executable]).args(args).current_dir(cwd);
            } else {
                command
                    .args(args)
                    .current_dir(cwd)
                    .envs(load_claude_user_env());
            }
        }
        AcpRuntime::Hermes => {
            let executable = profile_executable
                .filter(|value| !value.trim().is_empty())
                .or(config.runtime_command.as_deref())
                .or(config.hermes_command.as_deref())
                .unwrap_or("hermes");
            if cfg!(windows) && (runtime_host == Some("wsl") || (runtime_host.is_none() && config.hermes_host.as_deref() != Some("native"))) {
                command.args(["--", executable, "acp", "--accept-hooks"]);
            } else {
                command.args(["acp", "--accept-hooks"]);
            }
            command.current_dir(cwd);
        }
    }

    command
}

fn isolated_runtime_cwd(runtime_session_id: &str) -> Result<PathBuf, String> {
    let base = env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .or_else(|| env::var_os("TEMP").map(PathBuf::from))
        .unwrap_or_else(env::temp_dir)
        .join("LunaAgentOS")
        .join("runtime-sessions");
    let safe_id: String = runtime_session_id
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
                ch
            } else {
                '_'
            }
        })
        .collect();
    let cwd = base.join(safe_id);
    fs::create_dir_all(&cwd).map_err(|error| error.to_string())?;
    Ok(cwd)
}

fn load_claude_user_env() -> HashMap<String, String> {
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

fn next_request_id(next_id: &mut i64) -> i64 {
    let id = *next_id;
    *next_id += 1;
    id
}

fn write_message(stdin: &mut impl Write, message: &Value) -> Result<(), String> {
    let line = serde_json::to_string(message).map_err(|error| error.to_string())?;
    stdin
        .write_all(line.as_bytes())
        .and_then(|_| stdin.write_all(b"\n"))
        .and_then(|_| stdin.flush())
        .map_err(|error| error.to_string())
}

fn read_response(
    runtime: AcpRuntime,
    reader: &mut impl BufRead,
    stdin: &mut impl Write,
    target_id: i64,
    events: &mut Vec<Value>,
    on_event: &mut Option<&mut dyn FnMut(Value)>,
) -> Result<Value, String> {
    let mut line = String::new();
    loop {
        line.clear();
        let bytes = reader.read_line(&mut line).map_err(|error| error.to_string())?;
        if bytes == 0 {
            return Err(format!("{} adapter 已关闭 stdout。", runtime.display()));
        }

        let Ok(message) = serde_json::from_str::<Value>(line.trim()) else {
            continue;
        };

        if let Some(id) = message.get("id").and_then(|value| value.as_i64()) {
            if message.get("method").is_some() {
                respond_to_client_request(stdin, id, &message)?;
                continue;
            }

            if id == target_id {
                if let Some(error) = message.get("error") {
                    return Err(format_acp_error(error));
                }
                return Ok(message.get("result").cloned().unwrap_or(Value::Null));
            }
        }

        if message.get("method").and_then(|value| value.as_str()) == Some("session/update") {
            if let Some(event) = map_session_update(&message) {
                push_event(events, event, on_event);
            }
        }
    }
}

fn push_event(
    events: &mut Vec<Value>,
    event: Value,
    on_event: &mut Option<&mut dyn FnMut(Value)>,
) {
    if let Some(callback) = on_event.as_deref_mut() {
        callback(event.clone());
    }
    events.push(event);
}

fn respond_to_client_request(stdin: &mut impl Write, id: i64, message: &Value) -> Result<(), String> {
    let method = message.get("method").and_then(|value| value.as_str()).unwrap_or("");
    let result = match method {
        "session/request_permission" => select_permission(message),
        "fs/read_text_file" => json!({ "content": "" }),
        "fs/write_text_file" => json!({}),
        _ => json!({}),
    };

    write_message(
        stdin,
        &json!({
            "jsonrpc": "2.0",
            "id": id,
            "result": result
        }),
    )
}

fn select_permission(message: &Value) -> Value {
    let options = message
        .get("params")
        .and_then(|params| params.get("options"))
        .and_then(|options| options.as_array());

    let option_id = options.and_then(|items| {
        items
            .iter()
            .find(|item| {
                matches!(
                    item.get("kind").and_then(|value| value.as_str()),
                    Some("allow_once") | Some("allow_always")
                )
            })
            .or_else(|| items.first())
            .and_then(|item| item.get("optionId"))
            .and_then(|value| value.as_str())
    });

    match option_id {
        Some(option_id) => json!({
            "outcome": {
                "outcome": "selected",
                "optionId": option_id
            }
        }),
        None => json!({
            "outcome": {
                "outcome": "cancelled"
            }
        }),
    }
}

fn map_session_update(message: &Value) -> Option<Value> {
    let Some(update) = message
        .get("params")
        .and_then(|params| params.get("update"))
    else {
        return None;
    };
    let Some(update_type) = update.get("sessionUpdate").and_then(|value| value.as_str()) else {
        return None;
    };

    match update_type {
        "agent_message_chunk" => {
            content_text(update.get("content")).map(|text| {
                json!({
                    "type": "response",
                    "state": 4,
                    "payload": { "content": text }
                })
            })
        }
        "agent_thought_chunk" => {
            content_text(update.get("content")).map(|text| {
                json!({
                    "type": "thought",
                    "state": 2,
                    "payload": { "content": text }
                })
            })
        }
        "tool_call" => Some(json!({
                "type": "tool",
                "state": 3,
                "payload": {
                    "id": update.get("toolCallId").cloned().unwrap_or(Value::Null),
                    "title": update.get("title").cloned().unwrap_or(Value::Null),
                    "kind": update.get("kind").cloned().unwrap_or(Value::Null),
                    "status": update.get("status").cloned().unwrap_or(Value::Null)
                }
            })),
        "tool_call_update" => Some(json!({
                "type": "tool",
                "state": 3,
                "payload": {
                    "id": update.get("toolCallId").cloned().unwrap_or(Value::Null),
                    "status": update.get("status").cloned().unwrap_or(Value::Null),
                    "content": update.get("content").cloned().unwrap_or(Value::Null)
                }
            })),
        "plan" => Some(json!({
                "type": "plan",
                "state": 2,
                "payload": {
                    "entries": update.get("entries").cloned().unwrap_or(Value::Null)
                }
            })),
        "usage_update" => Some(json!({
                "type": "usage",
                "state": 2,
                "payload": update.clone()
            })),
        _ => None,
    }
}

fn content_text(content: Option<&Value>) -> Option<String> {
    let content = content?;
    let text = content_part_text(content);
    if text.trim().is_empty() {
        None
    } else {
        Some(text.trim().to_string())
    }
}

fn content_part_text(content: &Value) -> String {
    match content {
        Value::String(text) => text.clone(),
        Value::Array(items) => items
            .iter()
            .map(content_part_text)
            .filter(|text| !text.trim().is_empty())
            .collect::<Vec<_>>()
            .join("\n"),
        Value::Object(object) => {
            if let Some(text) = object.get("text").and_then(|value| value.as_str()) {
                return text.to_string();
            }
            if let Some(content) = object.get("content") {
                return content_part_text(content);
            }
            if let Some(input) = object.get("input").and_then(|value| value.as_str()) {
                return input.to_string();
            }
            if let Some(output) = object.get("output").and_then(|value| value.as_str()) {
                return output.to_string();
            }
            String::new()
        }
        _ => String::new(),
    }
}

fn format_acp_error(error: &Value) -> String {
    error
        .get("message")
        .and_then(|value| value.as_str())
        .map(|message| message.to_string())
        .unwrap_or_else(|| error.to_string())
}
