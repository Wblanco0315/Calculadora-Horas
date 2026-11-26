//! MCP DTOs: client install result, compatibility contract and status.

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub(crate) struct McpInstallResult {
    pub success: bool,
    pub path: String,
    pub message: String,
}

/// Compatibility contract published by the app (also written to `mcp-contract.json` next to
/// `ipc.json`, where the `pocketproject-mcp` server reads it).
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct McpContract {
    /// Installed PocketProject version.
    pub app_version: String,
    /// Version of the app <-> MCP contract (SQLite schema, IPC endpoints, tool semantics).
    /// The MCP must implement exactly this protocol version.
    pub protocol_version: u32,
    /// Lowest `pocketproject-mcp` package version that implements this protocol.
    pub min_mcp_version: String,
    /// npm spec written into AI client configs (`npx -y <spec>`), e.g. `pocketproject-mcp@1`.
    pub package_spec: String,
    /// Content hash of the system prompt; changes whenever the prompt changes.
    pub rules_version: String,
    /// The single source of the AI system prompt (`resources/mcp/system-prompt.md`).
    pub rules: String,
}

/// What a `pocketproject-mcp` process reported about itself (`mcp-runtime.json`).
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct McpRuntime {
    pub mcp_version: String,
    pub protocol_version: u32,
    #[serde(default)]
    pub rules_version: Option<String>,
    #[serde(default)]
    pub started_at: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct McpConnectionStatus {
    pub runtime: McpRuntime,
    pub compatible: bool,
    /// Why it is not compatible (`protocol_mismatch`, `mcp_outdated`), if it is not.
    pub reason: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct McpClientStatus {
    pub client: String,
    pub path: String,
    /// The client config has a `pocketproject` server entry.
    pub configured: bool,
    /// The configured npm spec (e.g. `pocketproject-mcp@latest`).
    pub package_spec: Option<String>,
    /// The configured spec matches the contract's `package_spec`.
    pub up_to_date: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct McpRulesStatus {
    pub path: String,
    /// The file contains a PocketProject rules block.
    pub present: bool,
    /// The block's rules version matches the current prompt.
    pub up_to_date: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct McpStatus {
    pub contract: McpContract,
    /// Last MCP server that started on this machine, if any.
    pub connection: Option<McpConnectionStatus>,
    pub clients: Vec<McpClientStatus>,
    /// Every project rules file the app injected the AI rules into.
    pub rules: Vec<McpRulesStatus>,
}
