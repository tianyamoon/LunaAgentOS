//! History Repository Module。
//! 集中管理 History Entry 的 schema、磁盘布局、归档、删除与压缩规则。

use chrono::Local;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// 当前写入的历史 schema。旧 task 字段格式不再读取或迁移。
const HISTORY_SCHEMA_VERSION: u32 = 6;

/// Serde 在旧数据缺少 schemaVersion 时使用当前版本。
fn history_schema_version() -> u32 {
    HISTORY_SCHEMA_VERSION
}

/// 新写入不得低于当前 schema，避免旧前端把新数据降级。
fn schema_version_for_write(requested: Option<u32>) -> u32 {
    requested
        .unwrap_or(HISTORY_SCHEMA_VERSION)
        .max(HISTORY_SCHEMA_VERSION)
}

/// 单个 Turn 的本地持久化记录。
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct HistoryEntry {
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
    #[serde(default, alias = "agent_entry_snapshot")]
    agent_entry_snapshot: Option<Value>,
    #[serde(alias = "session_id")]
    session_id: Option<String>,
    #[serde(alias = "acp_session_id")]
    acp_session_id: Option<String>,
    session_title: String,
    prompt: String,
    status: String,
    summary: String,
    turn: Option<Value>,
    #[serde(alias = "runtime_state")]
    runtime_state: Option<String>,
    #[serde(default, rename = "record_state")]
    record_state: Option<String>,
    #[serde(default, rename = "access_mode")]
    access_mode: Option<String>,
    #[serde(default, rename = "runtime_binding")]
    runtime_binding: Option<Value>,
}

/// 前端追加 History Entry 时提交的输入。
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct HistoryEntryInput {
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
    agent_entry_snapshot: Option<Value>,
    session_id: Option<String>,
    acp_session_id: Option<String>,
    session_title: String,
    prompt: String,
    status: String,
    summary: String,
    turn: Option<Value>,
    runtime_state: Option<String>,
    #[serde(default, rename = "record_state")]
    record_state: Option<String>,
    #[serde(default, rename = "access_mode")]
    access_mode: Option<String>,
    #[serde(default, rename = "runtime_binding")]
    runtime_binding: Option<Value>,
}

/// 历史压缩的统计结果。
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct HistoryCompactResult {
    removed_count: usize,
    upgraded_count: usize,
    skipped_files: usize,
}

/// 删除或归档操作的统计结果。
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct HistoryDeleteResult {
    removed_count: usize,
    skipped_files: usize,
}

/// 返回历史根目录，并确保目录存在。
fn history_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let base_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())?;
    let history_dir = base_dir.join("history");
    fs::create_dir_all(&history_dir).map_err(|error| error.to_string())?;
    Ok(history_dir)
}

/// 返回 live 或 archive 分桶目录。
fn history_bucket_dir(app: &AppHandle, bucket: &str) -> Result<PathBuf, String> {
    let directory = history_dir(app)?.join(bucket);
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    Ok(directory)
}

/// 返回 History 写盘前的安全备份目录，避免删除、归档或压缩把旧文件不可逆清空。
fn history_safety_backup_dir(app: &AppHandle, operation: &str) -> Result<PathBuf, String> {
    let directory = history_dir(app)?.join("_safety_backups").join(operation);
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    Ok(directory)
}

/// 判断旧文件内容是否值得保留副本，避免空历史文件制造噪声。
fn should_backup_history_payload(raw: &[u8]) -> bool {
    let trimmed = String::from_utf8_lossy(raw).trim().to_string();
    !trimmed.is_empty() && trimmed != "[]"
}

/// 写入 history JSON 前保存旧文件副本；空文件和空数组不备份，减少无意义噪声。
fn backup_history_file_before_write(
    app: &AppHandle,
    path: &PathBuf,
    operation: &str,
) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }
    let raw = fs::read(path).map_err(|error| error.to_string())?;
    if !should_backup_history_payload(&raw) {
        return Ok(());
    }
    let bucket = path
        .parent()
        .and_then(|parent| parent.file_name())
        .and_then(|name| name.to_str())
        .unwrap_or("history");
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("history.json");
    let timestamp = Local::now().to_rfc3339().replace([':', '+'], "-");
    let backup_path = history_safety_backup_dir(app, operation)?
        .join(format!("{timestamp}-{bucket}-{file_name}"));
    fs::write(backup_path, raw).map_err(|error| error.to_string())
}

/// 所有 History 覆盖写入都走这里，集中保留写盘前副本。
fn write_history_file(
    app: &AppHandle,
    path: &PathBuf,
    json: String,
    operation: &str,
) -> Result<(), String> {
    backup_history_file_before_write(app, path, operation)?;
    atomic_write_history_file(path, json)
}

fn atomic_write_history_file(path: &PathBuf, json: String) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| format!("history path has no parent: {}", path.display()))?;
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("history.json");
    let timestamp = Local::now().timestamp_nanos_opt().unwrap_or_default();
    let temp_path = parent.join(format!(".{file_name}.{timestamp}.tmp"));
    let write_result = (|| -> Result<(), String> {
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temp_path)
            .map_err(|error| error.to_string())?;
        file.write_all(json.as_bytes())
            .map_err(|error| error.to_string())?;
        file.sync_all().map_err(|error| error.to_string())?;
        drop(file);
        fs::rename(&temp_path, path).map_err(|error| error.to_string())
    })();
    if write_result.is_err() {
        let _ = fs::remove_file(&temp_path);
    }
    write_result
}

/// 返回当天分桶文件路径、日期和写入时间。
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

/// 返回指定日期的分桶文件路径。
fn history_file_for_date(app: &AppHandle, bucket: &str, date: &str) -> Result<PathBuf, String> {
    Ok(history_bucket_dir(app, bucket)?.join(format!("{date}.json")))
}

/// 从 JSON 文本解析历史记录；空文件视为没有记录。
fn deserialize_history_entries(raw: &str) -> Result<Vec<HistoryEntry>, String> {
    if raw.trim().is_empty() {
        return Ok(Vec::new());
    }
    serde_json::from_str::<Vec<HistoryEntry>>(raw).map_err(|error| error.to_string())
}

/// 从磁盘读取单个历史文件。
fn load_history_file(path: &PathBuf) -> Result<Vec<HistoryEntry>, String> {
    if !path.exists() {
        return Ok(Vec::new());
    }
    let raw = fs::read_to_string(path).map_err(|error| error.to_string())?;
    deserialize_history_entries(&raw)
}

/// 容错读取历史文件。损坏文件会被跳过并记录日志。
fn try_load_history_file(path: &PathBuf) -> Option<Vec<HistoryEntry>> {
    match load_history_file(path) {
        Ok(entries) => Some(entries),
        Err(error) => {
            eprintln!("跳过损坏的历史文件 {}：{}", path.display(), error);
            None
        }
    }
}

/// 枚举兼容旧布局与新分桶布局中的所有历史 JSON 文件。
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

/// 提取 Turn 身份，用于同一 Session 内的去重。
fn history_entry_turn_id(entry: &HistoryEntry) -> Option<String> {
    entry
        .turn
        .as_ref()
        .and_then(|turn| turn.get("id"))
        .and_then(|id| id.as_str())
        .map(ToString::to_string)
}

/// 提取 Session 身份，兼容只有 ACP session ID 的旧记录。
fn history_entry_session_key(entry: &HistoryEntry) -> Option<String> {
    entry.session_id.as_ref().map(ToString::to_string)
}

/// 旧记录缺失 Luna session_id 时，只能回退到 entry.id，避免把共享 ACP runtime 的记录误合并。
fn history_entry_match_key(entry: &HistoryEntry) -> String {
    history_entry_session_key(entry).unwrap_or_else(|| entry.id.clone())
}

/// 升级 schema 并按 Session + Turn 去重，保留最后写入的副本。
fn compact_entries(entries: Vec<HistoryEntry>) -> (Vec<HistoryEntry>, usize, usize) {
    let original_len = entries.len();
    let mut seen = HashSet::new();
    let mut compacted = Vec::new();
    let mut upgraded_count = 0;
    for mut entry in entries.into_iter().rev() {
        if entry.schema_version != HISTORY_SCHEMA_VERSION {
            entry.schema_version = HISTORY_SCHEMA_VERSION;
            upgraded_count += 1;
        }
        let key = format!(
            "{}:{}",
            history_entry_match_key(&entry),
            history_entry_turn_id(&entry).unwrap_or_else(|| entry.id.clone())
        );
        if seen.insert(key) {
            compacted.push(entry);
        }
    }
    compacted.reverse();
    let removed_count = original_len.saturating_sub(compacted.len());
    (compacted, removed_count, upgraded_count)
}

/// 删除指定 Session 的全部 History Entry。
fn mark_session_deleted_entries(
    entries: Vec<HistoryEntry>,
    session_id: &str,
) -> (Vec<HistoryEntry>, usize) {
    let mut marked_count = 0;
    let marked = entries
        .into_iter()
        .map(|mut entry| {
            // 删除只做可审计墓碑标记，不物理移除历史正文，避免误触发时把 JSON 写成空数组。
            if history_entry_match_key(&entry) == session_id {
                entry.runtime_state = Some("deleted".to_string());
                entry.record_state = Some("deleted".to_string());
                entry.access_mode = Some("read_only".to_string());
                marked_count += 1;
            }
            entry
        })
        .collect::<Vec<_>>();
    (marked, marked_count)
}

/// 把指定 Session 的记录标记为只读归档，并与剩余 live 记录分离。
fn archive_session_entries(
    entries: Vec<HistoryEntry>,
    session_id: &str,
) -> (Vec<HistoryEntry>, Vec<HistoryEntry>) {
    let mut retained = Vec::new();
    let mut moved = Vec::new();
    for mut entry in entries {
        if history_entry_match_key(&entry) == session_id {
            entry.runtime_state = Some("archived".to_string());
            entry.record_state = Some("archived".to_string());
            entry.access_mode = Some("read_only".to_string());
            moved.push(entry);
        } else {
            retained.push(entry);
        }
    }
    (retained, moved)
}

/// 按 Session + Turn 覆盖已有记录，否则追加新记录。
fn upsert_entry(entries: &mut Vec<HistoryEntry>, saved: HistoryEntry) {
    let saved_turn_id = history_entry_turn_id(&saved);
    let saved_session_key = history_entry_match_key(&saved);
    if let Some(index) = entries.iter().position(|item| {
        history_entry_match_key(item) == saved_session_key
            && saved_turn_id.is_some()
            && history_entry_turn_id(item) == saved_turn_id
    }) {
        entries[index] = saved;
    } else {
        entries.push(saved);
    }
}

/// 读取全部历史记录，并按时间倒序返回。
fn load_history_entries_blocking(app: &AppHandle) -> Result<Vec<HistoryEntry>, String> {
    let mut entries = Vec::new();
    for path in history_json_files(app)? {
        if let Some(mut day_entries) = try_load_history_file(&path) {
            entries.append(&mut day_entries);
        }
    }
    entries.sort_by(|left, right| right.created_at.cmp(&left.created_at));
    Ok(entries)
}

#[tauri::command]
pub(crate) async fn load_history_entries(app: AppHandle) -> Result<Vec<HistoryEntry>, String> {
    tauri::async_runtime::spawn_blocking(move || load_history_entries_blocking(&app))
        .await
        .map_err(|error| error.to_string())?
}

/// 扫描全部历史文件，执行 schema 升级与重复记录压缩。
fn compact_history_entries_blocking(app: &AppHandle) -> Result<HistoryCompactResult, String> {
    let mut removed_count = 0;
    let mut upgraded_count = 0;
    let mut skipped_files = 0;
    for path in history_json_files(app)? {
        let Some(entries) = try_load_history_file(&path) else {
            skipped_files += 1;
            continue;
        };
        let (compacted, removed_for_file, upgraded_for_file) = compact_entries(entries);
        removed_count += removed_for_file;
        upgraded_count += upgraded_for_file;
        if removed_for_file > 0 || upgraded_for_file > 0 {
            let json =
                serde_json::to_string_pretty(&compacted).map_err(|error| error.to_string())?;
            write_history_file(&app, &path, json, "compact")?;
        }
    }
    Ok(HistoryCompactResult {
        removed_count,
        upgraded_count,
        skipped_files,
    })
}

#[tauri::command]
pub(crate) async fn compact_history_entries(
    app: AppHandle,
) -> Result<HistoryCompactResult, String> {
    tauri::async_runtime::spawn_blocking(move || compact_history_entries_blocking(&app))
        .await
        .map_err(|error| error.to_string())?
}

/// 从所有分桶中删除指定 Session。
#[tauri::command]
pub(crate) fn delete_history_session_entries(
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
        let (retained, removed_for_file) = mark_session_deleted_entries(entries, &session_id);
        if removed_for_file > 0 {
            removed_count += removed_for_file;
            let json =
                serde_json::to_string_pretty(&retained).map_err(|error| error.to_string())?;
            write_history_file(&app, &path, json, "delete-mark")?;
        }
    }
    Ok(HistoryDeleteResult {
        removed_count,
        skipped_files,
    })
}

/// 把 live 分桶中的指定 Session 移入 archive 分桶。
#[tauri::command]
pub(crate) fn archive_history_session_entries(
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
        let (retained, moved) = archive_session_entries(entries, &session_id);
        if moved.is_empty() {
            continue;
        }
        moved_count += moved.len();
        let json = serde_json::to_string_pretty(&retained).map_err(|error| error.to_string())?;
        write_history_file(&app, &path, json, "archive-live")?;
        for entry in moved {
            let archive_path = history_file_for_date(&app, "archive", &entry.date)?;
            let mut archive_entries = load_history_file(&archive_path)?;
            archive_entries.push(entry);
            archive_entries.sort_by(|left, right| right.created_at.cmp(&left.created_at));
            let json = serde_json::to_string_pretty(&archive_entries)
                .map_err(|error| error.to_string())?;
            write_history_file(&app, &archive_path, json, "archive-target")?;
        }
    }
    Ok(HistoryDeleteResult {
        removed_count: moved_count,
        skipped_files,
    })
}

/// 追加或覆盖单个 Turn 对应的 History Entry。
#[tauri::command]
pub(crate) fn append_history_entry(
    app: AppHandle,
    entry: HistoryEntryInput,
) -> Result<HistoryEntry, String> {
    let bucket = if entry.record_state.as_deref() == Some("active")
        && entry.access_mode.as_deref() != Some("read_only")
    {
        "live"
    } else {
        "archive"
    };
    let (path, date, timestamp) = history_file_for_today(&app, bucket)?;
    let mut entries = load_history_file(&path)?;
    let saved = HistoryEntry {
        schema_version: schema_version_for_write(entry.schema_version),
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
        agent_entry_snapshot: entry.agent_entry_snapshot,
        session_id: entry.session_id,
        acp_session_id: entry.acp_session_id,
        session_title: entry.session_title,
        prompt: entry.prompt,
        status: entry.status,
        summary: entry.summary,
        turn: entry.turn,
        runtime_state: entry.runtime_state,
        record_state: entry.record_state,
        access_mode: entry.access_mode,
        runtime_binding: entry.runtime_binding,
    };
    upsert_entry(&mut entries, saved.clone());
    let json = serde_json::to_string_pretty(&entries).map_err(|error| error.to_string())?;
    write_history_file(&app, &path, json, "append")?;
    Ok(saved)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn entry(id: &str, turn_id: &str, schema_version: u32) -> HistoryEntry {
        HistoryEntry {
            schema_version,
            id: id.to_string(),
            date: "2026-06-01".to_string(),
            created_at: format!("2026-06-01T00:00:0{}Z", id.len()),
            provider_id: "demo".to_string(),
            provider_name: "Demo".to_string(),
            agent_id: "demo-main".to_string(),
            agent_name: "Demo".to_string(),
            runtime_instance_id: None,
            runtime_label: None,
            runtime_host: None,
            runtime_command: None,
            target_id: None,
            target_name: None,
            profile_executable: None,
            agent_entry_snapshot: None,
            session_id: Some("session-1".to_string()),
            acp_session_id: None,
            session_title: "Session title".to_string(),
            prompt: "task".to_string(),
            status: "completed".to_string(),
            summary: "done".to_string(),
            turn: Some(json!({ "id": turn_id })),
            runtime_state: Some("live".to_string()),
            record_state: Some("active".to_string()),
            access_mode: Some("interactive".to_string()),
            runtime_binding: None,
        }
    }

    #[test]
    fn legacy_task_schema_is_rejected() {
        let raw = r#"[{"id":"legacy","date":"2026-06-01","createdAt":"2026-06-01T00:00:00Z","providerId":"demo","providerName":"Demo","agentId":"demo-main","agentName":"Demo","task":"task","status":"completed","summary":"done"}]"#;
        assert!(deserialize_history_entries(raw).is_err());
    }

    #[test]
    fn schema_write_never_downgrades_below_current_version() {
        assert_eq!(schema_version_for_write(None), HISTORY_SCHEMA_VERSION);
        assert_eq!(schema_version_for_write(Some(4)), HISTORY_SCHEMA_VERSION);
        assert_eq!(schema_version_for_write(Some(7)), 7);
    }

    #[test]
    fn should_backup_history_payload_skips_empty_history_files() {
        assert!(!should_backup_history_payload(b""));
        assert!(!should_backup_history_payload(b"   []   "));
        assert!(should_backup_history_payload(
            br#"[{"id":"history-entry"}]"#
        ));
    }

    #[test]
    fn atomic_write_history_file_replaces_existing_json_and_removes_temp() {
        let dir = std::env::temp_dir().join(format!(
            "luna-history-test-{}",
            Local::now().timestamp_nanos_opt().unwrap_or_default()
        ));
        fs::create_dir_all(&dir).expect("temp dir");
        let path = dir.join("2026-06-01.json");
        fs::write(&path, r#"[{"id":"old"}]"#).expect("old file");

        atomic_write_history_file(&path, r#"[{"id":"new"}]"#.to_string())
            .expect("atomic write should replace file");

        let raw = fs::read_to_string(&path).expect("new file");
        assert_eq!(raw, r#"[{"id":"new"}]"#);
        let temp_count = fs::read_dir(&dir)
            .expect("read dir")
            .filter(|item| {
                item.as_ref()
                    .ok()
                    .and_then(|entry| entry.file_name().to_str().map(|name| name.contains(".tmp")))
                    .unwrap_or(false)
            })
            .count();
        assert_eq!(temp_count, 0);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn schema_six_serializes_session_title_prompt_and_agent_entry_snapshot() {
        let mut item = entry("one", "turn-1", HISTORY_SCHEMA_VERSION);
        item.agent_entry_snapshot = Some(json!({ "agentId": "demo-main" }));
        let json = serde_json::to_value(item).expect("history should serialize");
        assert_eq!(json["schemaVersion"], HISTORY_SCHEMA_VERSION);
        assert_eq!(json["sessionTitle"], "Session title");
        assert_eq!(json["prompt"], "task");
        assert_eq!(json["agentEntrySnapshot"]["agentId"], "demo-main");
    }

    #[test]
    fn compact_entries_upgrades_and_keeps_latest_duplicate() {
        let old = entry("old", "turn-1", 4);
        let latest = entry("latest", "turn-1", HISTORY_SCHEMA_VERSION);
        let (items, removed, upgraded) = compact_entries(vec![old, latest]);
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].id, "latest");
        assert_eq!(removed, 1);
        assert_eq!(upgraded, 1);
    }

    #[test]
    fn compact_entries_preserves_legacy_acp_only_entries() {
        let mut first = entry("legacy-a", "turn-1", 4);
        let mut second = entry("legacy-b", "turn-1", 4);
        first.session_id = None;
        second.session_id = None;
        first.acp_session_id = Some("shared-runtime".to_string());
        second.acp_session_id = Some("shared-runtime".to_string());

        let (items, removed, upgraded) = compact_entries(vec![first, second]);

        assert_eq!(items.len(), 2);
        assert_eq!(removed, 0);
        assert_eq!(upgraded, 2);
        assert_eq!(items[0].id, "legacy-a");
        assert_eq!(items[1].id, "legacy-b");
    }

    #[test]
    fn compact_entries_preserves_missing_record_state_as_normal_history() {
        let mut legacy = entry("legacy", "turn-1", 4);
        legacy.record_state = None;
        legacy.access_mode = None;

        let (items, removed, upgraded) = compact_entries(vec![legacy]);

        assert_eq!(items.len(), 1);
        assert_eq!(removed, 0);
        assert_eq!(upgraded, 1);
        assert!(items[0].record_state.is_none());
        assert!(items[0].access_mode.is_none());
    }

    #[test]
    fn mark_session_deleted_entries_keeps_payload_and_marks_only_matching_entries() {
        let first = entry("one", "turn-1", HISTORY_SCHEMA_VERSION);
        let mut second = entry("two", "turn-2", HISTORY_SCHEMA_VERSION);
        second.session_id = Some("session-2".to_string());
        let (items, removed) = mark_session_deleted_entries(vec![first, second], "session-1");
        assert_eq!(removed, 1);
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].session_id.as_deref(), Some("session-1"));
        assert_eq!(items[0].runtime_state.as_deref(), Some("deleted"));
        assert_eq!(items[0].record_state.as_deref(), Some("deleted"));
        assert_eq!(items[0].access_mode.as_deref(), Some("read_only"));
        assert_eq!(items[1].session_id.as_deref(), Some("session-2"));
        assert_ne!(items[1].record_state.as_deref(), Some("deleted"));
    }

    #[test]
    fn mark_session_deleted_entries_does_not_mark_legacy_siblings_by_acp_id() {
        let mut first = entry("legacy-a", "turn-1", HISTORY_SCHEMA_VERSION);
        let mut second = entry("legacy-b", "turn-2", HISTORY_SCHEMA_VERSION);
        first.session_id = None;
        second.session_id = None;
        first.acp_session_id = Some("shared-runtime".to_string());
        second.acp_session_id = Some("shared-runtime".to_string());

        let (items, removed) = mark_session_deleted_entries(vec![first, second], "legacy-a");

        assert_eq!(removed, 1);
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].id, "legacy-a");
        assert_eq!(items[0].record_state.as_deref(), Some("deleted"));
        assert_eq!(items[1].id, "legacy-b");
        assert_ne!(items[1].record_state.as_deref(), Some("deleted"));
    }

    #[test]
    fn archive_session_entries_marks_matching_entries_read_only() {
        let first = entry("one", "turn-1", HISTORY_SCHEMA_VERSION);
        let mut second = entry("two", "turn-2", HISTORY_SCHEMA_VERSION);
        second.session_id = Some("session-2".to_string());
        let (retained, moved) = archive_session_entries(vec![first, second], "session-1");
        assert_eq!(retained.len(), 1);
        assert_eq!(moved.len(), 1);
        assert_eq!(moved[0].runtime_state.as_deref(), Some("archived"));
        assert_eq!(moved[0].record_state.as_deref(), Some("archived"));
        assert_eq!(moved[0].access_mode.as_deref(), Some("read_only"));
    }
}
