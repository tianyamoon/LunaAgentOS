//! Runtime Session Commands Module。
//! 把 Tauri command 翻译为 ACP runtime 调用，并统一处理错误分类与流式事件转发。

use crate::acp_runtime;
use crate::adapter_host::adapter_launch_spec_with_context;
use crate::runtime_config::load_runtime_config_file;
use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter};

/// 前端收到的单条 Runtime Event 推送。
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RuntimeSessionStreamPayload {
    runtime_session_id: String,
    turn_id: String,
    prompt_run_id: String,
    event: Value,
}

/// 给底层错误附加稳定分类，便于前端渲染具体的恢复建议。
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
    } else if (lower.contains("acp adapter") && lower.contains("失败"))
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

/// 启动或复用 ACP 子进程，并发送首条 prompt。
#[tauri::command]
pub(crate) async fn runtime_acp_adapter_prompt(
    app: AppHandle,
    adapter_id: String,
    runtime_session_id: String,
    turn_id: String,
    prompt_run_id: String,
    prompt: String,
    cwd: Option<String>,
    runtime_host: Option<String>,
    runtime_command: Option<String>,
    profile_executable: Option<String>,
) -> Result<Vec<Value>, String> {
    let runtime_session_id_for_emit = runtime_session_id.clone();
    let turn_id_for_emit = turn_id.clone();
    let prompt_run_id_for_emit = prompt_run_id.clone();
    let adapter = adapter_launch_spec_with_context(
        &app,
        &adapter_id,
        runtime_host,
        runtime_command,
        profile_executable,
    )?;
    let config = acp_runtime::RuntimeConfig::from(load_runtime_config_file(&app));
    let result = tauri::async_runtime::spawn_blocking(move || {
        let mut emit_update = |event: Value| {
            let payload = RuntimeSessionStreamPayload {
                runtime_session_id: runtime_session_id_for_emit.clone(),
                turn_id: turn_id_for_emit.clone(),
                prompt_run_id: prompt_run_id_for_emit.clone(),
                event,
            };
            let _ = app.emit("runtime-session-update", payload);
        };
        acp_runtime::run_adapter_acp_prompt(
            adapter,
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

/// 使用 ACP 原生 resume 能力恢复已有 runtime session。
#[tauri::command]
pub(crate) async fn runtime_acp_adapter_resume(
    app: AppHandle,
    adapter_id: String,
    runtime_session_id: String,
    acp_session_id: String,
    cwd: Option<String>,
    runtime_host: Option<String>,
    runtime_command: Option<String>,
    profile_executable: Option<String>,
) -> Result<Vec<Value>, String> {
    let adapter = adapter_launch_spec_with_context(
        &app,
        &adapter_id,
        runtime_host,
        runtime_command,
        profile_executable,
    )?;
    let config = acp_runtime::RuntimeConfig::from(load_runtime_config_file(&app));
    let result = tauri::async_runtime::spawn_blocking(move || {
        acp_runtime::resume_adapter_acp_session(
            adapter,
            runtime_session_id,
            acp_session_id,
            cwd,
            config,
        )
    })
    .await
    .map_err(|error| classify_backend_error(error.to_string()))?;
    result.map_err(classify_backend_error)
}

/// 返回指定 Adapter 当前仍存活的 LunaAgentOS runtime session ID。
#[tauri::command]
pub(crate) async fn runtime_acp_adapter_alive_ids(
    adapter_id: String,
) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        acp_runtime::list_live_adapter_acp_sessions(adapter_id)
    })
    .await
    .map_err(|error| classify_backend_error(error.to_string()))?
    .map_err(classify_backend_error)
}

/// 停止指定 runtime session 对应的 ACP 子进程。
#[tauri::command]
pub(crate) async fn runtime_acp_adapter_shutdown(
    adapter_id: String,
    runtime_session_id: String,
) -> Result<bool, String> {
    let result = tauri::async_runtime::spawn_blocking(move || {
        acp_runtime::shutdown_adapter_acp_session(adapter_id, runtime_session_id)
    })
    .await
    .map_err(|error| classify_backend_error(error.to_string()))?;
    result.map_err(classify_backend_error)
}

/// 使用 ACP load 能力加载已有 runtime session。
#[tauri::command]
pub(crate) async fn runtime_acp_adapter_load(
    app: AppHandle,
    adapter_id: String,
    runtime_session_id: String,
    acp_session_id: String,
    cwd: Option<String>,
    runtime_host: Option<String>,
    runtime_command: Option<String>,
    profile_executable: Option<String>,
) -> Result<Vec<Value>, String> {
    let adapter = adapter_launch_spec_with_context(
        &app,
        &adapter_id,
        runtime_host,
        runtime_command,
        profile_executable,
    )?;
    let config = acp_runtime::RuntimeConfig::from(load_runtime_config_file(&app));
    let result = tauri::async_runtime::spawn_blocking(move || {
        acp_runtime::load_adapter_acp_session(
            adapter,
            runtime_session_id,
            acp_session_id,
            cwd,
            config,
        )
    })
    .await
    .map_err(|error| classify_backend_error(error.to_string()))?;
    result.map_err(classify_backend_error)
}
