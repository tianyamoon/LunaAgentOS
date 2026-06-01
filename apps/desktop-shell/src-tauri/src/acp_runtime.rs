use serde_json::{json, Value};
use std::collections::HashMap;
use std::env;
use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError};
use std::sync::OnceLock;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

static ADAPTER_SESSIONS: OnceLock<Mutex<HashMap<String, AcpSession>>> = OnceLock::new();

#[derive(Clone)]
enum AcpRuntime {
    Adapter { id: String, name: String },
}

impl AcpRuntime {
    fn display(&self) -> String {
        match self {
            AcpRuntime::Adapter { name, .. } => format!("{name} ACP"),
        }
    }

    fn adapter_id(&self) -> &str {
        match self {
            AcpRuntime::Adapter { id, .. } => id,
        }
    }
}

#[derive(Clone, Default)]
pub struct RuntimeConfig;

#[derive(Clone, Debug)]
pub struct AdapterLaunchSpec {
    pub id: String,
    pub name: String,
    pub command: String,
    pub args: Vec<String>,
    pub env: HashMap<String, String>,
    pub cwd: Option<String>,
}

enum SessionStartMode {
    New,
    Resume(String),
    Load(String),
}

struct AcpSession {
    child: Child,
    stdin: ChildStdin,
    inbox: Receiver<Value>,
    stderr_log: Arc<Mutex<String>>,
    next_id: i64,
    session_id: String,
}

pub fn run_adapter_acp_prompt(
    adapter: AdapterLaunchSpec,
    runtime_session_id: String,
    prompt: String,
    cwd: Option<String>,
    _config: RuntimeConfig,
    on_event: Option<&mut dyn FnMut(Value)>,
) -> Result<Vec<Value>, String> {
    run_acp_prompt(
        AcpRuntime::Adapter {
            id: adapter.id.clone(),
            name: adapter.name.clone(),
        },
        runtime_session_id,
        prompt,
        cwd,
        Some(adapter),
        on_event,
    )
}

fn run_acp_prompt(
    runtime: AcpRuntime,
    runtime_session_id: String,
    prompt: String,
    cwd: Option<String>,
    adapter: Option<AdapterLaunchSpec>,
    mut on_event: Option<&mut dyn FnMut(Value)>,
) -> Result<Vec<Value>, String> {
    let cwd = match cwd {
        Some(value) if !value.trim().is_empty() => PathBuf::from(value),
        _ => isolated_runtime_cwd(&runtime_session_id)?,
    };
    let mut events = Vec::new();
    let session_key = runtime_session_key(&runtime, &runtime_session_id);
    let sessions = session_store(&runtime);
    let mut sessions = sessions.lock().map_err(|error| error.to_string())?;
    let session = match sessions.get_mut(&session_key) {
        Some(session) => session,
        None => {
            let session = start_acp_session(
                &runtime,
                &cwd,
                &mut events,
                SessionStartMode::New,
                adapter.as_ref(),
                &mut on_event,
            )?;
            sessions.insert(session_key.clone(), session);
            sessions
                .get_mut(&session_key)
                .ok_or_else(|| format!("{} 会话缓存失败。", runtime.display()))?
        }
    };

    match send_prompt(&runtime, session, prompt, &mut events, &mut on_event) {
        Ok(()) => Ok(events),
        Err(error) => {
            if let Some(mut broken) = sessions.remove(&session_key) {
                let _ = broken.child.kill();
                let _ = broken.child.wait();
            }
            Err(error)
        }
    }
}

pub fn resume_adapter_acp_session(
    adapter: AdapterLaunchSpec,
    runtime_session_id: String,
    acp_session_id: String,
    cwd: Option<String>,
    _config: RuntimeConfig,
) -> Result<Vec<Value>, String> {
    resume_acp_session(
        AcpRuntime::Adapter {
            id: adapter.id.clone(),
            name: adapter.name.clone(),
        },
        runtime_session_id,
        acp_session_id,
        cwd,
        Some(adapter),
    )
}

fn resume_acp_session(
    runtime: AcpRuntime,
    runtime_session_id: String,
    acp_session_id: String,
    cwd: Option<String>,
    adapter: Option<AdapterLaunchSpec>,
) -> Result<Vec<Value>, String> {
    let cwd = match cwd {
        Some(value) if !value.trim().is_empty() => PathBuf::from(value),
        _ => isolated_runtime_cwd(&runtime_session_id)?,
    };
    let mut events = Vec::new();
    let session_key = runtime_session_key(&runtime, &runtime_session_id);
    let sessions = session_store(&runtime);
    let mut sessions = sessions.lock().map_err(|error| error.to_string())?;
    if sessions.contains_key(&session_key) {
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
        &runtime,
        &cwd,
        &mut events,
        SessionStartMode::Resume(acp_session_id.clone()),
        adapter.as_ref(),
        &mut on_event,
    )?;
    sessions.insert(session_key, session);
    Ok(events)
}

pub fn load_adapter_acp_session(
    adapter: AdapterLaunchSpec,
    runtime_session_id: String,
    acp_session_id: String,
    cwd: Option<String>,
    _config: RuntimeConfig,
) -> Result<Vec<Value>, String> {
    load_acp_session(
        AcpRuntime::Adapter {
            id: adapter.id.clone(),
            name: adapter.name.clone(),
        },
        runtime_session_id,
        acp_session_id,
        cwd,
        Some(adapter),
    )
}

fn load_acp_session(
    runtime: AcpRuntime,
    runtime_session_id: String,
    acp_session_id: String,
    cwd: Option<String>,
    adapter: Option<AdapterLaunchSpec>,
) -> Result<Vec<Value>, String> {
    let cwd = match cwd {
        Some(value) if !value.trim().is_empty() => PathBuf::from(value),
        _ => isolated_runtime_cwd(&runtime_session_id)?,
    };
    let mut events = Vec::new();
    let session_key = runtime_session_key(&runtime, &runtime_session_id);
    let sessions = session_store(&runtime);
    let mut sessions = sessions.lock().map_err(|error| error.to_string())?;
    if sessions.contains_key(&session_key) {
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
        &runtime,
        &cwd,
        &mut events,
        SessionStartMode::Load(acp_session_id.clone()),
        adapter.as_ref(),
        &mut on_event,
    )?;
    sessions.insert(session_key, session);
    Ok(events)
}

pub fn list_live_adapter_acp_sessions(adapter_id: String) -> Result<Vec<String>, String> {
    list_live_acp_sessions(AcpRuntime::Adapter {
        id: adapter_id,
        name: "Adapter".to_string(),
    })
}

fn list_live_acp_sessions(runtime: AcpRuntime) -> Result<Vec<String>, String> {
    let sessions = session_store(&runtime);
    let mut sessions = sessions.lock().map_err(|error| error.to_string())?;
    let mut alive = Vec::new();
    let mut dead = Vec::new();
    for (id, session) in sessions.iter_mut() {
        match session.child.try_wait() {
            Ok(None) => alive.push(runtime_session_id_from_key(&runtime, id)),
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

pub fn shutdown_adapter_acp_session(
    adapter_id: String,
    runtime_session_id: String,
) -> Result<bool, String> {
    shutdown_acp_session(
        AcpRuntime::Adapter {
            id: adapter_id,
            name: "Adapter".to_string(),
        },
        runtime_session_id,
    )
}

fn shutdown_acp_session(runtime: AcpRuntime, runtime_session_id: String) -> Result<bool, String> {
    let session_key = runtime_session_key(&runtime, &runtime_session_id);
    let sessions = session_store(&runtime);
    let mut sessions = sessions.lock().map_err(|error| error.to_string())?;
    let Some(mut session) = sessions.remove(&session_key) else {
        return Ok(false);
    };
    let _ = session.stdin.flush();
    drop(session.stdin);
    let _ = session.child.kill();
    let _ = session.child.wait();
    Ok(true)
}

pub fn shutdown_all_adapter_acp_sessions() -> Result<usize, String> {
    let sessions = ADAPTER_SESSIONS.get_or_init(|| Mutex::new(HashMap::new()));
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

fn session_store(runtime: &AcpRuntime) -> &'static Mutex<HashMap<String, AcpSession>> {
    match runtime {
        AcpRuntime::Adapter { .. } => ADAPTER_SESSIONS.get_or_init(|| Mutex::new(HashMap::new())),
    }
}

fn runtime_session_key(runtime: &AcpRuntime, runtime_session_id: &str) -> String {
    format!("{}:{runtime_session_id}", runtime.adapter_id())
}

fn runtime_session_id_from_key(runtime: &AcpRuntime, key: &str) -> String {
    key.strip_prefix(&format!("{}:", runtime.adapter_id()))
        .unwrap_or(key)
        .to_string()
}

fn start_acp_session(
    runtime: &AcpRuntime,
    cwd: &PathBuf,
    mut events: &mut Vec<Value>,
    mode: SessionStartMode,
    adapter: Option<&AdapterLaunchSpec>,
    on_event: &mut Option<&mut dyn FnMut(Value)>,
) -> Result<AcpSession, String> {
    let mut child = build_acp_command(cwd, adapter)
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

    let mut stdin = child.stdin.take().ok_or_else(|| {
        abort_started_child(
            &mut child,
            format!("{} adapter stdin 不可用。", runtime.display()),
        )
    })?;
    let stdout = child.stdout.take().ok_or_else(|| {
        abort_started_child(
            &mut child,
            format!("{} adapter stdout 不可用。", runtime.display()),
        )
    })?;
    let inbox = spawn_stdout_reader(stdout);
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
    if let Err(error) = write_message(&mut stdin, &init) {
        return Err(abort_started_child(&mut child, error));
    }
    let init_result = match read_response(
        runtime,
        &inbox,
        &mut stdin,
        init["id"].as_i64().unwrap(),
        Some(&stderr_log),
        &mut events,
        on_event,
    ) {
        Ok(result) => result,
        Err(error) => return Err(abort_started_child(&mut child, error)),
    };
    push_event(
        &mut events,
        json!({
            "type": "state",
            "state": 0,
            "payload": {
                "content": format!("{} 已初始化。", runtime.display()),
                "protocolVersion": init_result.get("protocolVersion").cloned().unwrap_or(Value::Null),
                "agent": init_result.get("agentInfo").cloned().unwrap_or(Value::Null),
                "capabilities": init_result.get("agentCapabilities").cloned().unwrap_or(Value::Null)
            }
        }),
        on_event,
    );

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
    if let Err(error) = write_message(&mut stdin, &session_request) {
        return Err(abort_started_child(&mut child, error));
    }
    let session_result = match read_response(
        runtime,
        &inbox,
        &mut stdin,
        session_request["id"].as_i64().unwrap(),
        Some(&stderr_log),
        &mut events,
        on_event,
    ) {
        Ok(result) => result,
        Err(error) => return Err(abort_started_child(&mut child, error)),
    };
    let session_id = session_request["params"]["sessionId"]
        .as_str()
        .map(ToString::to_string)
        .or_else(|| {
            session_result
                .get("sessionId")
                .and_then(|value| value.as_str())
                .map(ToString::to_string)
        })
        .ok_or_else(|| {
            abort_started_child(
                &mut child,
                format!("{} 未返回 sessionId。", runtime.display()),
            )
        })?;

    let content = match method {
        "session/resume" => format!("{} 会话已恢复。", runtime.display()),
        "session/load" => format!("{} 会话已加载。", runtime.display()),
        _ => format!("{} 会话已创建。", runtime.display()),
    };

    push_event(
        &mut events,
        json!({
            "type": "state",
            "state": 1,
            "payload": {
                "content": content,
                "sessionId": session_id
            }
        }),
        on_event,
    );

    Ok(AcpSession {
        child,
        stdin,
        inbox,
        stderr_log,
        next_id,
        session_id,
    })
}

fn abort_started_child(child: &mut Child, error: String) -> String {
    let _ = child.kill();
    let _ = child.wait();
    error
}

fn send_prompt(
    runtime: &AcpRuntime,
    session: &mut AcpSession,
    prompt: String,
    events: &mut Vec<Value>,
    on_event: &mut Option<&mut dyn FnMut(Value)>,
) -> Result<(), String> {
    // 上一轮 response 后才进入缓冲区的 update 已失去可靠归属，发送新 prompt 前必须隔离。
    let discarded_updates = quarantine_idle_messages(&session.inbox, &mut session.stdin)?;
    if discarded_updates > 0 {
        eprintln!(
            "{} 隔离了 {discarded_updates} 条失去轮次归属的空闲 update。",
            runtime.display()
        );
    }
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
        &session.inbox,
        &mut session.stdin,
        prompt_request["id"].as_i64().unwrap(),
        Some(&session.stderr_log),
        events,
        on_event,
    )?;

    push_event(
        events,
        json!({
            "type": "state",
            "state": 5,
            "payload": {
                "content": format!("{} 回合完成。", runtime.display()),
                "sessionId": session.session_id,
                "stopReason": prompt_result.get("stopReason").cloned().unwrap_or(Value::Null)
            }
        }),
        on_event,
    );

    if events.is_empty() {
        return Err(format!("{} 未返回可解析事件。", runtime.display()));
    }

    let _ = session.child.id();
    Ok(())
}

fn spawn_stdout_reader(stdout: ChildStdout) -> Receiver<Value> {
    let (sender, receiver) = mpsc::channel();
    thread::spawn(move || {
        let mut reader = BufReader::new(stdout);
        let mut line = String::new();
        while reader.read_line(&mut line).unwrap_or(0) > 0 {
            if let Ok(message) = serde_json::from_str::<Value>(line.trim()) {
                if sender.send(message).is_err() {
                    break;
                }
            }
            line.clear();
        }
    });
    receiver
}

fn quarantine_idle_messages(
    inbox: &Receiver<Value>,
    stdin: &mut impl Write,
) -> Result<usize, String> {
    let mut discarded_updates = 0;
    let started_at = Instant::now();
    let quiet_window = Duration::from_millis(20);
    let max_wait = Duration::from_millis(200);
    loop {
        // 新 prompt 前等待一个很短的安静窗口，覆盖刚离开 OS pipe 的迟到 update。
        let remaining = max_wait.saturating_sub(started_at.elapsed());
        if remaining.is_zero() {
            return Ok(discarded_updates);
        }
        let message = match inbox.recv_timeout(quiet_window.min(remaining)) {
            Ok(message) => message,
            Err(RecvTimeoutError::Timeout) => return Ok(discarded_updates),
            Err(RecvTimeoutError::Disconnected) => return Err("ACP adapter stdout 已关闭。".to_string()),
        };

        if let Some(id) = message.get("id").and_then(|value| value.as_i64()) {
            if message.get("method").is_some() {
                respond_to_client_request(stdin, id, &message)?;
                continue;
            }
        }

        if message.get("method").and_then(|value| value.as_str()) == Some("session/update") {
            discarded_updates += 1;
        }
    }
}

fn build_acp_command(cwd: &PathBuf, adapter: Option<&AdapterLaunchSpec>) -> Command {
    let adapter = adapter.expect("adapter launch spec is required for adapter runtime");
    let mut command = Command::new(&adapter.command);

    #[cfg(windows)]
    {
        command.creation_flags(CREATE_NO_WINDOW);
    }

    command.args(&adapter.args);
    command.current_dir(
        adapter
            .cwd
            .as_deref()
            .map(PathBuf::from)
            .unwrap_or_else(|| cwd.clone()),
    );
    command.envs(&adapter.env);

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
    runtime: &AcpRuntime,
    inbox: &Receiver<Value>,
    stdin: &mut impl Write,
    target_id: i64,
    stderr_log: Option<&Arc<Mutex<String>>>,
    events: &mut Vec<Value>,
    on_event: &mut Option<&mut dyn FnMut(Value)>,
) -> Result<Value, String> {
    loop {
        let message = inbox
            .recv()
            .map_err(|_| format_adapter_stdout_closed(runtime, stderr_log))?;

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

fn format_adapter_stdout_closed(
    runtime: &AcpRuntime,
    stderr_log: Option<&Arc<Mutex<String>>>,
) -> String {
    let stderr = stderr_log
        .and_then(|log| log.lock().ok().map(|value| value.trim().to_string()))
        .filter(|value| !value.is_empty());
    match stderr {
        Some(stderr) => format!(
            "{} adapter 已关闭 stdout。adapter stderr：{}",
            runtime.display(),
            stderr
        ),
        None => format!("{} adapter 已关闭 stdout。", runtime.display()),
    }
}

fn push_event(events: &mut Vec<Value>, event: Value, on_event: &mut Option<&mut dyn FnMut(Value)>) {
    if let Some(callback) = on_event.as_deref_mut() {
        callback(event.clone());
    }
    events.push(event);
}

fn respond_to_client_request(
    stdin: &mut impl Write,
    id: i64,
    message: &Value,
) -> Result<(), String> {
    let method = message
        .get("method")
        .and_then(|value| value.as_str())
        .unwrap_or("");
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn late_update_after_response_is_quarantined_before_next_prompt() {
        let runtime = AcpRuntime::Adapter {
            id: "test".to_string(),
            name: "Test".to_string(),
        };
        let (sender, inbox) = mpsc::channel();
        sender
            .send(json!({"jsonrpc":"2.0","id":1,"result":{"stopReason":"end_turn"}}))
            .unwrap();
        sender
            .send(json!({"jsonrpc":"2.0","method":"session/update","params":{"sessionId":"session-1","update":{"sessionUpdate":"agent_message_chunk","content":{"type":"text","text":"上一轮迟到正文"}}}}))
            .unwrap();
        let mut stdin = Vec::new();
        let mut first_events = Vec::new();
        let mut first_callback = None;
        read_response(
            &runtime,
            &inbox,
            &mut stdin,
            1,
            None,
            &mut first_events,
            &mut first_callback,
        )
        .unwrap();

        let discarded = quarantine_idle_messages(&inbox, &mut stdin).unwrap();
        assert_eq!(discarded, 1);
    }

    #[test]
    fn idle_quarantine_waits_for_update_still_leaving_os_pipe() {
        let (sender, inbox) = mpsc::channel();
        let delayed_sender = sender.clone();
        thread::spawn(move || {
            thread::sleep(Duration::from_millis(5));
            delayed_sender
                .send(json!({"jsonrpc":"2.0","method":"session/update","params":{"sessionId":"session-1","update":{"sessionUpdate":"agent_message_chunk","content":{"type":"text","text":"稍后抵达的旧正文"}}}}))
                .unwrap();
        });
        let mut stdin = Vec::new();

        let discarded = quarantine_idle_messages(&inbox, &mut stdin).unwrap();

        assert_eq!(discarded, 1);
    }

    #[test]
    fn current_prompt_update_is_still_collected_before_response() {
        let runtime = AcpRuntime::Adapter {
            id: "test".to_string(),
            name: "Test".to_string(),
        };
        let (sender, inbox) = mpsc::channel();
        sender
            .send(json!({"jsonrpc":"2.0","method":"session/update","params":{"sessionId":"session-1","update":{"sessionUpdate":"agent_message_chunk","content":{"type":"text","text":"当前轮正文"}}}}))
            .unwrap();
        sender
            .send(json!({"jsonrpc":"2.0","id":2,"result":{"stopReason":"end_turn"}}))
            .unwrap();
        let mut stdin = Vec::new();
        let mut second_events = Vec::new();
        let mut second_callback = None;
        read_response(
            &runtime,
            &inbox,
            &mut stdin,
            2,
            None,
            &mut second_events,
            &mut second_callback,
        )
        .unwrap();

        assert_eq!(second_events.len(), 1);
    }
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
        "agent_message_chunk" => content_text(update.get("content")).map(|text| {
            json!({
                "type": "response",
                "state": 4,
                "payload": { "content": text }
            })
        }),
        "agent_thought_chunk" => content_text(update.get("content")).map(|text| {
            json!({
                "type": "thought",
                "state": 2,
                "payload": { "content": text }
            })
        }),
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
