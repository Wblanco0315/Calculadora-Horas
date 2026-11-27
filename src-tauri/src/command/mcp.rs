//! MCP commands: client installation, AI rules and compatibility contract/status.

use tauri::AppHandle;

use crate::model::mcp::{McpContract, McpInstallResult, McpStatus};
use crate::service::{mcp, mcp_contract};

#[tauri::command]
pub(crate) fn install_mcp_to_client(client: String) -> Result<McpInstallResult, String> {
    mcp::install_mcp_to_client(client)
}

/// Injects the AI rules into `project_dir` (the app's working directory when omitted) and registers
/// the file for automatic updates.
#[tauri::command]
pub(crate) fn inject_ai_rules(app: AppHandle, project_dir: Option<String>) -> Result<McpInstallResult, String> {
    mcp::inject_ai_rules(&app, project_dir)
}

/// Rewrites outdated rules blocks in every registered project; returns how many files changed.
#[tauri::command]
pub(crate) fn refresh_mcp_rules(app: AppHandle) -> usize {
    mcp::refresh_registered_rules(&app)
}

/// Compatibility contract, including the single AI system prompt.
#[tauri::command]
pub(crate) fn get_mcp_contract(app: AppHandle) -> McpContract {
    mcp_contract::contract(&app)
}

/// Contract plus the last MCP server seen, each client's config and the injected rules.
#[tauri::command]
pub(crate) fn get_mcp_status(app: AppHandle) -> McpStatus {
    mcp::status(&app)
}
