//! MCP client install result DTO.

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub(crate) struct McpInstallResult {
    pub success: bool,
    pub path: String,
    pub message: String,
}
