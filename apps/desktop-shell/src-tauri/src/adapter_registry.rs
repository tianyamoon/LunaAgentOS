use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdapterLoadResult {
    pub adapters: Vec<AdapterDefinition>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdapterDefinition {
    pub id: String,
    pub name: String,
    pub extension: Option<String>,
    pub version: Option<String>,
    pub description: Option<String>,
    pub transport: String,
    pub command: String,
    pub args: Vec<String>,
    #[serde(skip_serializing, default)]
    pub env: HashMap<String, String>,
    pub cwd: Option<String>,
    pub requires_pty: bool,
    pub health_check: Option<AdapterHealthCheck>,
    pub capabilities: AdapterCapabilities,
    pub permissions: AdapterPermissions,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub agent_detail: Option<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub model_control: Option<AdapterModelControl>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub version_policy: Option<AdapterVersionPolicy>,
    pub source_path: String,
    pub manifest_id: String,
    /// Absolute filesystem path to the icon asset declared by the manifest's
    /// `icon` field (resolved against the manifest directory). `None` means
    /// the manifest declares no icon and the shell should fall back to a
    /// first-letter badge. The path is kept absolute so the
    /// `read_adapter_icon` Tauri command can read it without re-resolving.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon_path: Option<String>,
    /// Brand color (e.g. `"#D4A27F"`) declared by the manifest. `None` means
    /// the manifest is silent and the shell should pick a neutral default.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub brand_color: Option<String>,
    /// `true` when the manifest is identity-only (no `transport` / `command`).
    /// Such adapters appear in the registry for iconography but are never
    /// selected by the launch path. See `load_manifest_file` for how the
    /// loader synthesises a stub command/health-check pair to keep the rest
    /// of the pipeline happy.
    #[serde(default, skip_serializing_if = "is_false")]
    pub identity_only: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdapterModelControl {
    #[serde(default = "native_runtime_mode")]
    pub mode: String,
    #[serde(default)]
    pub available_models: Vec<String>,
    pub default_model: Option<String>,
}

fn native_runtime_mode() -> String {
    "native_runtime".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdapterVersionPolicy {
    pub minimum_version: Option<String>,
}

#[allow(clippy::trivially_copy_pass_by_ref)]
fn is_false(value: &bool) -> bool {
    !*value
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdapterHealthCheck {
    pub command: String,
    pub args: Vec<String>,
    pub timeout_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AdapterCapabilities {
    #[serde(default)]
    pub streaming: bool,
    #[serde(default)]
    pub resume: bool,
    #[serde(default)]
    pub profiles: bool,
    #[serde(default)]
    pub slash_commands: Vec<SlashCommandCapability>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SlashCommandCapability {
    pub name: String,
    pub description_key: Option<String>,
    pub description: Option<String>,
    pub kind: Option<String>,
    pub source: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AdapterPermissions {
    #[serde(default)]
    pub process_exec: Vec<ProcessExecPermission>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessExecPermission {
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawManifest {
    id: String,
    name: String,
    extension: Option<String>,
    version: Option<String>,
    #[serde(default, alias = "schema_version")]
    schema_version: Option<u32>,
    description: Option<String>,
    contributes: Option<RawContributes>,
    transport: Option<String>,
    command: Option<CommandSpec>,
    #[serde(default)]
    args: Vec<String>,
    #[serde(default)]
    env: HashMap<String, String>,
    cwd: Option<String>,
    #[serde(default, alias = "requires_pty")]
    requires_pty: bool,
    health_check: Option<RawHealthCheck>,
    #[serde(default)]
    capabilities: AdapterCapabilities,
    #[serde(default)]
    permissions: AdapterPermissions,
    agent_detail: Option<serde_json::Value>,
    model_control: Option<AdapterModelControl>,
    version_policy: Option<AdapterVersionPolicy>,
    /// Identity fields. Read by `load_manifest_file` and forwarded to
    /// `AdapterDefinition`. Per-contribution overrides live on
    /// `RawAdapterContribution`.
    icon: Option<String>,
    brand_color: Option<String>,
    #[serde(default)]
    identity_only: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawContributes {
    #[serde(default)]
    acp_adapters: Vec<RawAdapterContribution>,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RawAdapterContribution {
    id: String,
    name: String,
    extension: Option<String>,
    description: Option<String>,
    transport: String,
    command: CommandSpec,
    #[serde(default)]
    args: Vec<String>,
    #[serde(default)]
    env: HashMap<String, String>,
    cwd: Option<String>,
    #[serde(default, alias = "requires_pty")]
    requires_pty: bool,
    health_check: Option<RawHealthCheck>,
    #[serde(default)]
    capabilities: AdapterCapabilities,
    #[serde(default)]
    permissions: AdapterPermissions,
    agent_detail: Option<serde_json::Value>,
    model_control: Option<AdapterModelControl>,
    version_policy: Option<AdapterVersionPolicy>,
    /// Per-contribution identity overrides. When `None`, the loader falls
    /// back to the parent manifest's `icon` / `brand_color` (which is the
    /// common case: one logo per manifest, shared by all contributions).
    icon: Option<String>,
    brand_color: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RawHealthCheck {
    command: CommandSpec,
    #[serde(default)]
    args: Vec<String>,
    timeout_ms: Option<u64>,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(untagged)]
enum CommandSpec {
    Program(String),
    ProgramAndArgs(Vec<String>),
}

impl CommandSpec {
    fn into_parts(self, extra_args: Vec<String>) -> Result<(String, Vec<String>), String> {
        match self {
            CommandSpec::Program(program) => Ok((program, extra_args)),
            CommandSpec::ProgramAndArgs(items) => {
                let Some((program, args)) = items.split_first() else {
                    return Err("command must not be empty".to_string());
                };
                let mut args = args.to_vec();
                args.extend(extra_args);
                Ok((program.clone(), args))
            }
        }
    }
}

pub fn default_plugin_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
        .join("..")
        .join("adapters")
        .join("registry")
}

pub fn load_adapters(configured_paths: &[String]) -> AdapterLoadResult {
    let mut paths = vec![default_plugin_path()];
    paths.extend(
        configured_paths
            .iter()
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
            .map(PathBuf::from),
    );

    let mut seen_paths = HashSet::new();
    let mut seen_ids = HashSet::new();
    let mut adapters = Vec::new();
    let mut warnings = Vec::new();

    for path in paths {
        let path_key = path.to_string_lossy().to_string();
        if !seen_paths.insert(path_key.clone()) {
            continue;
        }
        let Ok(entries) = fs::read_dir(&path) else {
            warnings.push(format!(
                "adapter plugin path not readable: {}",
                path.display()
            ));
            continue;
        };
        for entry in entries.flatten() {
            let manifest_path = entry.path().join("manifest.json");
            if !manifest_path.is_file() {
                continue;
            }
            match load_manifest_file(&manifest_path) {
                Ok(items) => {
                    for adapter in items {
                        if seen_ids.insert(adapter.id.clone()) {
                            adapters.push(adapter);
                        } else {
                            warnings.push(format!("duplicate adapter id skipped: {}", adapter.id));
                        }
                    }
                }
                Err(error) => warnings.push(format!("{}: {}", manifest_path.display(), error)),
            }
        }
    }

    adapters.sort_by(|left, right| left.name.cmp(&right.name).then(left.id.cmp(&right.id)));
    AdapterLoadResult { adapters, warnings }
}

fn load_manifest_file(path: &Path) -> Result<Vec<AdapterDefinition>, String> {
    let raw = fs::read_to_string(path).map_err(|error| error.to_string())?;
    let manifest: RawManifest = serde_json::from_str(&raw).map_err(|error| error.to_string())?;
    if manifest.schema_version.is_some_and(|version| version > 1) {
        return Err("unsupported adapter manifest schemaVersion".to_string());
    }
    let manifest_dir = path.parent().unwrap_or_else(|| Path::new("."));
    let source_path = path.to_string_lossy().to_string();

    if let Some(contributes) = manifest.contributes.as_ref() {
        return contributes
            .acp_adapters
            .iter()
            .cloned()
            .map(|adapter| {
                adapter_from_contribution(adapter, &manifest, manifest_dir, &source_path)
            })
            .collect();
    }

    // Identity-only manifests are allowed to omit transport and command.
    // They appear in the registry purely so the shell can pick up the icon
    // + brand color; the launch path filters them out via the `identity_only`
    // flag, and the synthesised "stub" command/health-check below keeps
    // downstream code that always expects a non-empty command string from
    // panicking.
    let is_identity_only =
        manifest.identity_only && manifest.transport.is_none() && manifest.command.is_none();

    let (transport, command, args, health_check, permissions) = if is_identity_only {
        (
            "none".to_string(),
            String::new(),
            Vec::<String>::new(),
            None,
            AdapterPermissions::default(),
        )
    } else {
        let Some(transport) = manifest.transport else {
            return Err(
                "manifest must define contributes.acpAdapters or transport (or set \"identityOnly\": true)"
                    .to_string(),
            );
        };
        let Some(command_spec) = manifest.command else {
            return Err("manifest must define command (or set \"identityOnly\": true)".to_string());
        };
        let (command, args) = command_spec.into_parts(manifest.args)?;
        (
            transport,
            command,
            args,
            raw_health_check(manifest.health_check)?,
            manifest.permissions,
        )
    };

    let icon_path = resolve_icon_path(manifest.icon.as_deref(), manifest_dir);
    let definition = AdapterDefinition {
        id: manifest.id.clone(),
        name: manifest.name.clone(),
        extension: manifest.extension.clone(),
        version: manifest.version.clone(),
        description: manifest.description.clone(),
        transport,
        command,
        args,
        env: manifest.env,
        cwd: resolve_cwd(manifest.cwd, manifest_dir),
        requires_pty: manifest.requires_pty,
        health_check,
        capabilities: manifest.capabilities,
        permissions,
        agent_detail: manifest.agent_detail,
        model_control: manifest.model_control,
        version_policy: manifest.version_policy,
        source_path,
        manifest_id: manifest.id,
        icon_path,
        brand_color: manifest.brand_color,
        identity_only: is_identity_only,
    };

    if is_identity_only {
        // Skip command-permission / health-check synthesis; identity-only
        // adapters have no command to defend.
        Ok(vec![definition])
    } else {
        Ok(vec![finalize_adapter(definition)])
    }
}

fn adapter_from_contribution(
    adapter: RawAdapterContribution,
    manifest: &RawManifest,
    manifest_dir: &Path,
    source_path: &str,
) -> Result<AdapterDefinition, String> {
    let (command, args) = adapter.command.into_parts(adapter.args)?;
    let icon_path = resolve_icon_path(
        adapter.icon.as_deref().or(manifest.icon.as_deref()),
        manifest_dir,
    );
    let brand_color = adapter
        .brand_color
        .or_else(|| manifest.brand_color.clone());
    Ok(finalize_adapter(AdapterDefinition {
        id: adapter.id,
        name: adapter.name,
        extension: adapter.extension.or_else(|| manifest.extension.clone()),
        version: manifest.version.clone(),
        description: adapter.description.or_else(|| manifest.description.clone()),
        transport: adapter.transport,
        command,
        args,
        env: adapter.env,
        cwd: resolve_cwd(adapter.cwd, manifest_dir),
        requires_pty: adapter.requires_pty,
        health_check: raw_health_check(adapter.health_check)?,
        capabilities: adapter.capabilities,
        permissions: adapter.permissions,
        agent_detail: adapter.agent_detail.or_else(|| manifest.agent_detail.clone()),
        model_control: adapter.model_control.or_else(|| manifest.model_control.clone()),
        version_policy: adapter.version_policy.or_else(|| manifest.version_policy.clone()),
        source_path: source_path.to_string(),
        manifest_id: manifest.id.clone(),
        icon_path,
        brand_color,
        identity_only: false,
    }))
}

/// Resolve an `icon` field from a manifest into an absolute filesystem path.
///
/// `None` and empty strings yield `None`. Relative paths are joined onto the
/// directory containing the manifest, exactly like `cwd` resolution. Absolute
/// paths are passed through unchanged. The result is the actual location the
/// `read_adapter_icon` Tauri command will read from later, so we keep it
/// absolute to avoid re-resolving against an unknown cwd at command time.
fn resolve_icon_path(icon: Option<&str>, manifest_dir: &Path) -> Option<String> {
    let trimmed = icon?.trim();
    if trimmed.is_empty() {
        return None;
    }
    let path = PathBuf::from(trimmed);
    let resolved = if path.is_absolute() {
        path
    } else {
        manifest_dir.join(path)
    };
    Some(resolved.to_string_lossy().to_string())
}

fn raw_health_check(value: Option<RawHealthCheck>) -> Result<Option<AdapterHealthCheck>, String> {
    value
        .map(|health| {
            let (command, args) = health.command.into_parts(health.args)?;
            Ok(AdapterHealthCheck {
                command,
                args,
                timeout_ms: health.timeout_ms,
            })
        })
        .transpose()
}

fn resolve_cwd(cwd: Option<String>, manifest_dir: &Path) -> Option<String> {
    match cwd {
        Some(value) if !value.trim().is_empty() => {
            let path = PathBuf::from(value.trim());
            let resolved = if path.is_absolute() {
                path
            } else {
                manifest_dir.join(path)
            };
            Some(resolved.to_string_lossy().to_string())
        }
        _ => Some(manifest_dir.to_string_lossy().to_string()),
    }
}

fn finalize_adapter(mut adapter: AdapterDefinition) -> AdapterDefinition {
    adapter.command = normalize_command_for_platform(adapter.command);
    if let Some(health) = adapter.health_check.as_mut() {
        health.command = normalize_command_for_platform(health.command.clone());
    }
    for permission in adapter.permissions.process_exec.iter_mut() {
        permission.command = normalize_command_for_platform(permission.command.clone());
    }
    if adapter.health_check.is_none() {
        adapter.health_check = Some(AdapterHealthCheck {
            command: adapter.command.clone(),
            args: vec!["--version".to_string()],
            timeout_ms: Some(8000),
        });
    }
    if adapter.permissions.process_exec.is_empty() {
        adapter
            .permissions
            .process_exec
            .push(ProcessExecPermission {
                command: adapter.command.clone(),
                args: wildcard_tail(adapter.args.clone()),
            });
        if let Some(health) = &adapter.health_check {
            adapter
                .permissions
                .process_exec
                .push(ProcessExecPermission {
                    command: health.command.clone(),
                    args: wildcard_tail(health.args.clone()),
                });
        }
    }
    adapter
}

fn normalize_command_for_platform(command: String) -> String {
    if !cfg!(windows) {
        return command;
    }
    let trimmed = command.trim();
    if trimmed.is_empty()
        || trimmed.contains('\\')
        || trimmed.contains('/')
        || Path::new(trimmed).extension().is_some()
    {
        return command;
    }
    let Some(paths) = env::var_os("PATH") else {
        return command;
    };
    let pathext = env::var_os("PATHEXT")
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| ".COM;.EXE;.BAT;.CMD".to_string());
    for dir in env::split_paths(&paths) {
        for ext in pathext.split(';').filter(|item| !item.trim().is_empty()) {
            let candidate = dir.join(format!("{trimmed}{}", ext.trim()));
            if candidate.is_file() {
                return candidate.to_string_lossy().to_string();
            }
        }
        let direct = dir.join(trimmed);
        if direct.is_file() {
            return direct.to_string_lossy().to_string();
        }
    }
    command
}

fn wildcard_tail(mut args: Vec<String>) -> Vec<String> {
    args.push("**".to_string());
    args
}

pub fn allow_process_exec(
    adapter: &AdapterDefinition,
    command: &str,
    args: &[String],
) -> Result<(), String> {
    if adapter
        .permissions
        .process_exec
        .iter()
        .any(|permission| permission.command == command && args_match(&permission.args, args))
    {
        return Ok(());
    }
    Err(format!(
        "adapter {} does not declare processExec permission for {} {:?}",
        adapter.id, command, args
    ))
}

fn args_match(pattern: &[String], args: &[String]) -> bool {
    let mut pattern_index = 0;
    let mut arg_index = 0;
    while pattern_index < pattern.len() {
        match pattern[pattern_index].as_str() {
            "**" => return true,
            "*" => {
                if arg_index >= args.len() {
                    return false;
                }
                pattern_index += 1;
                arg_index += 1;
            }
            expected => {
                if args.get(arg_index).map(String::as_str) != Some(expected) {
                    return false;
                }
                pattern_index += 1;
                arg_index += 1;
            }
        }
    }
    arg_index == args.len()
}

pub fn find_adapter(
    configured_paths: &[String],
    adapter_id: &str,
) -> Result<AdapterDefinition, String> {
    load_adapters(configured_paths)
        .adapters
        .into_iter()
        .find(|adapter| adapter.id == adapter_id)
        .ok_or_else(|| format!("adapter not found: {adapter_id}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn process_exec_supports_double_star_tail() {
        let adapter = AdapterDefinition {
            id: "codex".to_string(),
            name: "Codex".to_string(),
            extension: None,
            version: None,
            description: None,
            transport: "stdio_json".to_string(),
            command: "npx".to_string(),
            args: vec!["-y".to_string(), "@openai/codex".to_string()],
            env: HashMap::new(),
            cwd: None,
            requires_pty: false,
            health_check: None,
            capabilities: AdapterCapabilities::default(),
            permissions: AdapterPermissions {
                process_exec: vec![ProcessExecPermission {
                    command: "npx".to_string(),
                    args: vec![
                        "-y".to_string(),
                        "@openai/codex".to_string(),
                        "**".to_string(),
                    ],
                }],
            },
            agent_detail: None,
            model_control: None,
            version_policy: None,
            source_path: "".to_string(),
            manifest_id: "codex".to_string(),
            icon_path: None,
            brand_color: None,
            identity_only: false,
        };
        assert!(
            allow_process_exec(&adapter, "npx", &["-y".into(), "@openai/codex".into()]).is_ok()
        );
        assert!(allow_process_exec(
            &adapter,
            "npx",
            &["-y".into(), "@openai/codex".into(), "--version".into()]
        )
        .is_ok());
        assert!(allow_process_exec(&adapter, "node", &[]).is_err());
    }

    #[test]
    fn load_manifest_file_reads_icon_and_brand_color() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock before unix epoch")
            .as_nanos();
        let dir = env::temp_dir().join(format!("lunaagentos-manifest-icon-{nonce}"));
        let assets = dir.join("assets");
        fs::create_dir_all(&assets).expect("create temp manifest dir");
        fs::write(assets.join("icon.svg"), b"<svg/>").expect("write icon");
        fs::write(
            dir.join("manifest.json"),
            r##"{
                "id": "demo",
                "name": "Demo",
                "icon": "assets/icon.svg",
                "brandColor": "#abcdef",
                "transport": "stdio_json",
                "command": ["demo"]
            }"##,
        )
        .expect("write manifest");

        let result = load_manifest_file(&dir.join("manifest.json")).expect("load manifest");
        let adapter = result.into_iter().next().expect("one adapter expected");
        assert_eq!(adapter.brand_color.as_deref(), Some("#abcdef"));
        assert!(!adapter.identity_only);
        let icon = adapter.icon_path.as_deref().expect("icon path resolved");
        assert!(icon.ends_with("icon.svg"), "icon = {icon}");
        assert!(
            std::path::Path::new(icon).is_file(),
            "icon path should be readable: {icon}"
        );

        fs::remove_dir_all(&dir).expect("remove temp manifest dir");
    }

    #[test]
    fn load_manifest_file_accepts_identity_only_without_command() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock before unix epoch")
            .as_nanos();
        let dir = env::temp_dir().join(format!("lunaagentos-manifest-identity-only-{nonce}"));
        fs::create_dir_all(&dir).expect("create temp manifest dir");
        fs::write(
            dir.join("manifest.json"),
            r##"{
                "id": "stub",
                "name": "Stub",
                "brandColor": "#123456",
                "identityOnly": true
            }"##,
        )
        .expect("write manifest");

        let adapter = load_manifest_file(&dir.join("manifest.json"))
            .expect("identity-only manifest must load")
            .into_iter()
            .next()
            .expect("one adapter expected");
        assert!(adapter.identity_only);
        assert_eq!(adapter.transport, "none");
        assert!(adapter.command.is_empty());
        assert!(adapter.health_check.is_none());
        assert!(adapter.permissions.process_exec.is_empty());
        assert_eq!(adapter.brand_color.as_deref(), Some("#123456"));

        fs::remove_dir_all(&dir).expect("remove temp manifest dir");
    }

    #[test]
    fn serialized_adapter_never_exposes_manifest_environment_values() {
        let mut env = HashMap::new();
        env.insert("OPENAI_API_KEY".to_string(), "<configured>".to_string());
        let adapter = AdapterDefinition {
            id: "demo".into(), name: "Demo".into(), extension: None, version: None,
            description: None, transport: "stdio_json".into(), command: "demo".into(), args: vec![],
            env, cwd: None, requires_pty: false, health_check: None,
            capabilities: AdapterCapabilities::default(), permissions: AdapterPermissions::default(),
            agent_detail: None, model_control: None, version_policy: None,
            source_path: "".into(), manifest_id: "demo".into(), icon_path: None,
            brand_color: None, identity_only: false,
        };
        let json = serde_json::to_string(&adapter).expect("serialize adapter");
        assert!(!json.contains("<configured>"));
        assert!(!json.contains("OPENAI_API_KEY"));
    }

    #[test]
    fn windows_command_normalization_prefers_pathext_candidate() {
        if !cfg!(windows) {
            return;
        }

        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock before unix epoch")
            .as_nanos();
        let dir = env::temp_dir().join(format!("lunaagentos-command-normalize-{nonce}"));
        fs::create_dir_all(&dir).expect("create temp command dir");
        fs::write(dir.join("npx"), "").expect("write extensionless command");
        fs::write(dir.join("npx.cmd"), "").expect("write cmd command");

        let original_path = env::var_os("PATH");
        let original_pathext = env::var_os("PATHEXT");
        env::set_var("PATH", dir.as_os_str());
        env::set_var("PATHEXT", ".CMD;.EXE");

        let normalized = normalize_command_for_platform("npx".to_string());

        if let Some(value) = original_path {
            env::set_var("PATH", value);
        } else {
            env::remove_var("PATH");
        }
        if let Some(value) = original_pathext {
            env::set_var("PATHEXT", value);
        } else {
            env::remove_var("PATHEXT");
        }
        fs::remove_dir_all(&dir).expect("remove temp command dir");

        assert!(normalized.eq_ignore_ascii_case(&dir.join("npx.cmd").to_string_lossy()));
    }
}
