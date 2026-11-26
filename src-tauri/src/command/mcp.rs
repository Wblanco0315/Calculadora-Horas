//! MCP client installation commands.

use crate::model::mcp::McpInstallResult;
use crate::service::mcp;

#[tauri::command]
pub(crate) fn install_mcp_to_client(client: String) -> Result<McpInstallResult, String> {
    mcp::install_mcp_to_client(client)
}

#[tauri::command]
pub(crate) fn inject_ai_rules() -> Result<McpInstallResult, String> {
    mcp::inject_ai_rules()
}
