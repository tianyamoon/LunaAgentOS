use chrono::Local;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const HISTORY_SCHEMA_VERSION: u32 = 5;

fn history_schema_version() -> u32 {
    HISTORY_SCHEMA_VERSION
}

fn schema_version_for_write(requested: Option<u32>) -> u32 {
    requested.unwrap_or(HISTORY_SCHEMA_VERSION).max(HISTORY_SCHEMA_VERSION)
}

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
    task: String,
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
    task: String,
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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct HistoryCompactResult {
    removed_count: usize,
    upgraded_count: usize,
    skipped_files: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct HistoryDeleteResult {
    removed_count: usize,
    skipped_files: usize,
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

fn deserialize_history_entries(raw: &str) -> Result<Vec<HistoryEntry>, String> {
    if raw.trim().is_empty() {
        return Ok(Vec::new());
    }
    serde_json::from_str::<Vec<HistoryEntry>>(raw).map_err(|error| error.to_string())
}

fn load_history_file(path: &PathBuf) -> Result<Vec<HistoryEntry>, String> {
    if !path.exists() {
        return Ok(Vec::new());
    }
    let raw = fs::read_to_string(path).map_err(|error| error.to_string())?;
    deserialize_history_entries(&raw)
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
            history_entry_session_key(&entry).unwrap_or_else(|| entry.id.clone()),
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

fn retain_not_session(entries: Vec<HistoryEntry>, session_id: &str) -> (Vec<HistoryEntry>, usize) {
    let original_len = entries.len();
    let retained = entries
        .into_iter()
        .filter(|entry| {
            history_entry_session_key(entry).unwrap_or_else(|| entry.id.clone()) != session_id
        })
        .collect::<Vec<_>>();
    let removed_count = original_len.saturating_sub(retained.len());
    (retained, removed_count)
}

fn archive_session_entries(
    entries: Vec<HistoryEntry>,
    session_id: &str,
) -> (Vec<HistoryEntry>, Vec<HistoryEntry>) {
    let mut retained = Vec::new();
    let mut moved = Vec::new();
    for mut entry in entries {
        if history_entry_session_key(&entry).unwrap_or_else(|| entry.id.clone()) == session_id {
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

fn upsert_entry(entries: &mut Vec<HistoryEntry>, saved: HistoryEntry) {
    let saved_turn_id = history_entry_turn_id(&saved);
    let saved_session_key = history_entry_session_key(&saved);
    if let Some(index) = entries.iter().position(|item| {
        history_entry_session_key(item) == saved_session_key
            && saved_turn_id.is_some()
            && history_entry_turn_id(item) == saved_turn_id
    }) {
        entries[index] = saved;
    } else {
        entries.push(saved);
    }
}

#[tauri::command]
pub(crate) fn load_history_entries(app: AppHandle) -> Result<Vec<HistoryEntry>, String> {
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
pub(crate) fn compact_history_entries(app: AppHandle) -> Result<HistoryCompactResult, String> {
    let mut removed_count = 0;
    let mut upgraded_count = 0;
    let mut skipped_files = 0;
    for path in history_json_files(&app)? {
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
        let (retained, removed_for_file) = retain_not_session(entries, &session_id);
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
        task: entry.task,
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
    fs::write(path, json).map_err(|error| error.to_string())?;
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
            task: "task".to_string(),
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
    fn legacy_schema_defaults_and_accepts_missing_agent_entry_snapshot() {
        let raw = r#"[{"id":"legacy","date":"2026-06-01","createdAt":"2026-06-01T00:00:00Z","providerId":"demo","providerName":"Demo","agentId":"demo-main","agentName":"Demo","task":"task","status":"completed","summary":"done"}]"#;
        let entries = deserialize_history_entries(raw).expect("legacy history should load");
        assert_eq!(entries[0].schema_version, HISTORY_SCHEMA_VERSION);
        assert!(entries[0].agent_entry_snapshot.is_none());
    }

    #[test]
    fn schema_write_never_downgrades_below_current_version() {
        assert_eq!(schema_version_for_write(None), HISTORY_SCHEMA_VERSION);
        assert_eq!(schema_version_for_write(Some(4)), HISTORY_SCHEMA_VERSION);
        assert_eq!(schema_version_for_write(Some(6)), 6);
    }

    #[test]
    fn schema_five_serializes_agent_entry_snapshot() {
        let mut item = entry("one", "turn-1", HISTORY_SCHEMA_VERSION);
        item.agent_entry_snapshot = Some(json!({ "agentId": "demo-main" }));
        let json = serde_json::to_value(item).expect("history should serialize");
        assert_eq!(json["schemaVersion"], HISTORY_SCHEMA_VERSION);
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
    fn retain_not_session_deletes_only_matching_entries() {
        let first = entry("one", "turn-1", HISTORY_SCHEMA_VERSION);
        let mut second = entry("two", "turn-2", HISTORY_SCHEMA_VERSION);
        second.session_id = Some("session-2".to_string());
        let (items, removed) = retain_not_session(vec![first, second], "session-1");
        assert_eq!(removed, 1);
        assert_eq!(items[0].session_id.as_deref(), Some("session-2"));
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
