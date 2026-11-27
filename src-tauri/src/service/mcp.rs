//! PocketProject MCP server installation into AI clients, AI rules injection and status.

use std::path::{Path, PathBuf};

use tauri::AppHandle;

use crate::model::mcp::{McpClientStatus, McpInstallResult, McpRulesStatus, McpStatus};
use crate::service::mcp_contract::{self, MCP_PACKAGE_SPEC};

/// AI clients PocketProject can configure.
pub(crate) const SUPPORTED_CLIENTS: [&str; 6] = [
    "antigravity",
    "antigravity_workspace",
    "cursor",
    "claude_code",
    "claude_desktop",
    "opencode",
];

const RULES_START: &str = "<!-- POCKETPROJECT MCP RULES START";
const RULES_END: &str = "<!-- POCKETPROJECT MCP RULES END -->";
const PACKAGE_NAME: &str = "pocketproject-mcp";

fn home_path() -> PathBuf {
    PathBuf::from(
        std::env::var("USERPROFILE")
            .or_else(|_| std::env::var("HOME"))
            .unwrap_or_else(|_| ".".to_string()),
    )
}

/// Config file of an AI client.
fn client_config_path(client: &str) -> Result<PathBuf, String> {
    let home = home_path();
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    Ok(match client {
        "antigravity" => home.join(".gemini").join("config").join("mcp_config.json"),
        "antigravity_workspace" => cwd.join(".gemini").join("mcp_config.json"),
        "cursor" => cwd.join(".cursor").join("mcp.json"),
        "claude_code" => home.join(".claude.json"),
        "claude_desktop" => {
            let app_data = std::env::var("APPDATA").map(PathBuf::from).unwrap_or(home);
            app_data.join("Claude").join("claude_desktop_config.json")
        }
        "opencode" => home.join(".config").join("opencode").join("opencode.json"),
        _ => return Err(format!("Cliente no soportado: {}", client)),
    })
}

fn read_json(path: &PathBuf) -> serde_json::Value {
    std::fs::read_to_string(path)
        .ok()
        .and_then(|content| serde_json::from_str(&content).ok())
        .filter(serde_json::Value::is_object)
        .unwrap_or_else(|| serde_json::json!({}))
}

pub(crate) fn install_mcp_to_client(client: String) -> Result<McpInstallResult, String> {
    let target_file = client_config_path(&client)?;
    let is_opencode = client == "opencode";

    if let Some(parent) = target_file.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let mut root_val = read_json(&target_file);
    let (section, pocketproject_config) = if is_opencode {
        (
            "mcp",
            serde_json::json!({
                "type": "local",
                "command": ["npx", "-y", MCP_PACKAGE_SPEC],
                "enabled": true
            }),
        )
    } else {
        (
            "mcpServers",
            serde_json::json!({
                "command": "npx",
                "args": ["-y", MCP_PACKAGE_SPEC]
            }),
        )
    };

    let servers = root_val
        .as_object_mut()
        .unwrap()
        .entry(section)
        .or_insert_with(|| serde_json::json!({}));
    if !servers.is_object() {
        *servers = serde_json::json!({});
    }
    servers
        .as_object_mut()
        .unwrap()
        .insert("pocketproject".to_string(), pocketproject_config);

    let formatted = serde_json::to_string_pretty(&root_val).map_err(|e| e.to_string())?;
    std::fs::write(&target_file, formatted).map_err(|e| e.to_string())?;

    Ok(McpInstallResult {
        success: true,
        path: target_file.to_string_lossy().to_string(),
        message: format!("Configuración inyectada con éxito en {}", target_file.to_string_lossy()),
    })
}

/// npm spec configured for PocketProject in a client config, if any.
fn configured_package_spec(client: &str, config: &serde_json::Value) -> Option<Option<String>> {
    let entry = if client == "opencode" {
        config.get("mcp")?.get("pocketproject")?
    } else {
        config.get("mcpServers")?.get("pocketproject")?
    };
    let parts = if client == "opencode" { entry.get("command") } else { entry.get("args") };
    let spec = parts
        .and_then(serde_json::Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(serde_json::Value::as_str)
        .find(|part| part.starts_with(PACKAGE_NAME))
        .map(str::to_string);
    Some(spec)
}

fn client_status(client: &str) -> Option<McpClientStatus> {
    let path = client_config_path(client).ok()?;
    let configured = configured_package_spec(client, &read_json(&path));
    let package_spec = configured.clone().flatten();
    Some(McpClientStatus {
        client: client.to_string(),
        path: path.to_string_lossy().to_string(),
        configured: configured.is_some(),
        up_to_date: package_spec.as_deref() == Some(MCP_PACKAGE_SPEC),
        package_spec,
    })
}

/// File the AI rules are injected into inside `dir`: `.agents/RULES.md`, else `.cursorrules`, else `AGENTS.md`.
fn rules_target_file(dir: &Path) -> PathBuf {
    let agents_rules = dir.join(".agents").join("RULES.md");
    let cursor_rules = dir.join(".cursorrules");
    if agents_rules.exists() {
        agents_rules
    } else if cursor_rules.exists() {
        cursor_rules
    } else {
        dir.join("AGENTS.md")
    }
}

/// Byte range of the PocketProject rules block (start marker to end of the end marker).
fn rules_block_range(content: &str) -> Option<(usize, usize)> {
    let start = content.find(RULES_START)?;
    let end = content[start..].find(RULES_END)? + start + RULES_END.len();
    Some((start, end))
}

fn rules_block() -> String {
    format!(
        "{} rules-version: {} -->\n## Directrices Obligatorias de PocketProject Time Tracker (MCP)\n\n{}\n{}",
        RULES_START,
        mcp_contract::rules_version(),
        mcp_contract::system_prompt(),
        RULES_END
    )
}

fn is_block_current(block: &str) -> bool {
    block.contains(&format!("rules-version: {} -->", mcp_contract::rules_version()))
}

/// Writes the current rules block into `file`, replacing an older one instead of appending a
/// duplicate. Returns whether the file changed.
fn write_rules_block(file: &Path) -> Result<bool, String> {
    let existing = std::fs::read_to_string(file).unwrap_or_default();
    let new_content = match rules_block_range(&existing) {
        Some((start, end)) => format!("{}{}{}", &existing[..start], rules_block(), &existing[end..]),
        None => format!("{}\n\n{}\n", existing.trim_end(), rules_block()).trim_start().to_string(),
    };
    if new_content == existing {
        return Ok(false);
    }
    if let Some(parent) = file.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    std::fs::write(file, new_content).map_err(|e| e.to_string())?;
    Ok(true)
}

fn read_rules_targets(app: &AppHandle) -> Vec<PathBuf> {
    std::fs::read_to_string(mcp_contract::app_data_file(app, mcp_contract::RULES_TARGETS_FILE))
        .ok()
        .and_then(|raw| serde_json::from_str::<Vec<String>>(&raw).ok())
        .unwrap_or_default()
        .into_iter()
        .map(PathBuf::from)
        .collect()
}

fn save_rules_targets(app: &AppHandle, targets: &[PathBuf]) {
    let list: Vec<String> = targets.iter().map(|p| p.to_string_lossy().to_string()).collect();
    if let Ok(json) = serde_json::to_string_pretty(&list) {
        let _ = std::fs::write(mcp_contract::app_data_file(app, mcp_contract::RULES_TARGETS_FILE), json);
    }
}

/// Injects the rules into `project_dir` (or the app's working directory, the legacy behaviour)
/// and registers the file so later prompt changes are applied to it automatically.
pub(crate) fn inject_ai_rules(app: &AppHandle, project_dir: Option<String>) -> Result<McpInstallResult, String> {
    let dir = match project_dir.filter(|dir| !dir.trim().is_empty()) {
        Some(dir) => PathBuf::from(dir),
        None => std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")),
    };
    if !dir.is_dir() {
        return Err(format!("La carpeta no existe: {}", dir.to_string_lossy()));
    }
    let target_file = rules_target_file(&dir);
    write_rules_block(&target_file)?;

    let mut targets = read_rules_targets(app);
    if !targets.contains(&target_file) {
        targets.push(target_file.clone());
        save_rules_targets(app, &targets);
    }

    Ok(McpInstallResult {
        success: true,
        path: target_file.to_string_lossy().to_string(),
        message: format!("Reglas inyectadas en {}", target_file.to_string_lossy()),
    })
}

/// Rewrites every registered rules block that is outdated. Files that no longer exist or no longer
/// contain a block (the user removed it) are dropped from the registry. Returns how many changed.
pub(crate) fn refresh_registered_rules(app: &AppHandle) -> usize {
    let mut targets = read_rules_targets(app);
    // Legacy: rules injected before the registry existed, in the app's working directory.
    if let Ok(cwd) = std::env::current_dir() {
        let legacy = rules_target_file(&cwd);
        let has_block = std::fs::read_to_string(&legacy).is_ok_and(|c| rules_block_range(&c).is_some());
        if has_block && !targets.contains(&legacy) {
            targets.push(legacy);
        }
    }

    let mut updated = 0;
    targets.retain(|file| {
        let Ok(content) = std::fs::read_to_string(file) else { return false };
        let Some((start, end)) = rules_block_range(&content) else { return false };
        if !is_block_current(&content[start..end]) && write_rules_block(file).unwrap_or(false) {
            updated += 1;
        }
        true
    });
    save_rules_targets(app, &targets);
    updated
}

fn rules_status(app: &AppHandle) -> Vec<McpRulesStatus> {
    read_rules_targets(app)
        .into_iter()
        .map(|path| {
            let content = std::fs::read_to_string(&path).unwrap_or_default();
            let block = rules_block_range(&content).map(|(start, end)| &content[start..end]);
            McpRulesStatus {
                path: path.to_string_lossy().to_string(),
                present: block.is_some(),
                up_to_date: block.is_some_and(is_block_current),
            }
        })
        .collect()
}

pub(crate) fn status(app: &AppHandle) -> McpStatus {
    McpStatus {
        contract: mcp_contract::contract(app),
        connection: mcp_contract::connection_status(app),
        clients: SUPPORTED_CLIENTS.iter().filter_map(|client| client_status(client)).collect(),
        rules: rules_status(app),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn replaces_an_outdated_rules_block_instead_of_duplicating_it() {
        let dir = std::env::temp_dir().join(format!("pp-rules-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("AGENTS.md");
        std::fs::write(
            &file,
            "# Project\n\n<!-- POCKETPROJECT MCP RULES START -->\nold rules\n<!-- POCKETPROJECT MCP RULES END -->\n\nfooter\n",
        )
        .unwrap();

        assert!(write_rules_block(&file).unwrap());
        let content = std::fs::read_to_string(&file).unwrap();
        assert_eq!(content.matches(RULES_START).count(), 1);
        assert!(!content.contains("old rules"));
        assert!(content.starts_with("# Project") && content.ends_with("footer\n"));
        let (start, end) = rules_block_range(&content).unwrap();
        assert!(is_block_current(&content[start..end]));

        // Already current: nothing to write.
        assert!(!write_rules_block(&file).unwrap());
        let _ = std::fs::remove_dir_all(&dir);
    }
}
