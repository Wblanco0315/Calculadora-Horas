//! App <-> `pocketproject-mcp` compatibility contract and the single AI system prompt.
//!
//! - The system prompt lives only in `resources/mcp/system-prompt.md` and is embedded in the binary.
//! - At startup the app writes `mcp-contract.json` (next to `ipc.json`); the MCP server reads it to
//!   serve the same prompt and to check that it implements the app's protocol version.
//! - Each MCP server writes `mcp-runtime.json` there when it starts, so the app can show which
//!   version is in use and whether it is compatible.
//!
//! Bump `MCP_PROTOCOL_VERSION` whenever the SQLite schema, IPC endpoints or tool semantics change in
//! a way an older MCP cannot handle, and raise `MIN_MCP_VERSION` to the first MCP release that
//! supports it. Prompt changes need no bump: `rules_version` is a hash of the prompt.

use std::path::PathBuf;

use tauri::{AppHandle, Manager};

use crate::model::mcp::{McpConnectionStatus, McpContract, McpRuntime};

pub(crate) const MCP_PROTOCOL_VERSION: u32 = 1;
pub(crate) const MIN_MCP_VERSION: &str = "1.1.0";
/// Major-version spec: `npx` picks the newest compatible release on every client start.
pub(crate) const MCP_PACKAGE_SPEC: &str = "pocketproject-mcp@1";

const SYSTEM_PROMPT: &str = include_str!("../../resources/mcp/system-prompt.md");

pub(crate) const CONTRACT_FILE: &str = "mcp-contract.json";
pub(crate) const RUNTIME_FILE: &str = "mcp-runtime.json";
/// Files the app injected the AI rules block into; refreshed on every start.
pub(crate) const RULES_TARGETS_FILE: &str = "mcp-rules-targets.json";

/// The system prompt with normalized line endings (a Windows checkout may store CRLF).
pub(crate) fn system_prompt() -> String {
    SYSTEM_PROMPT.replace("\r\n", "\n").trim().to_string()
}

/// FNV-1a 64-bit hash of the prompt, as 12 hex chars.
pub(crate) fn rules_version() -> String {
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in system_prompt().bytes() {
        hash ^= u64::from(byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{:016x}", hash)[..12].to_string()
}

pub(crate) fn contract(app: &AppHandle) -> McpContract {
    McpContract {
        app_version: app.package_info().version.to_string(),
        protocol_version: MCP_PROTOCOL_VERSION,
        min_mcp_version: MIN_MCP_VERSION.to_string(),
        package_spec: MCP_PACKAGE_SPEC.to_string(),
        rules_version: rules_version(),
        rules: system_prompt(),
    }
}

pub(crate) fn app_data_file(app: &AppHandle, name: &str) -> PathBuf {
    let dir = app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."));
    let _ = std::fs::create_dir_all(&dir);
    dir.join(name)
}

/// Writes `mcp-contract.json` for the MCP server. Called on every app start.
pub(crate) fn write_contract_file(app: &AppHandle) -> Result<(), String> {
    let json = serde_json::to_string_pretty(&contract(app)).map_err(|e| e.to_string())?;
    std::fs::write(app_data_file(app, CONTRACT_FILE), json).map_err(|e| e.to_string())
}

/// Reads what the last MCP server reported and checks it against the contract.
pub(crate) fn connection_status(app: &AppHandle) -> Option<McpConnectionStatus> {
    let raw = std::fs::read_to_string(app_data_file(app, RUNTIME_FILE)).ok()?;
    let runtime: McpRuntime = serde_json::from_str(&raw).ok()?;
    let reason = if runtime.protocol_version != MCP_PROTOCOL_VERSION {
        Some("protocol_mismatch".to_string())
    } else if !is_version_at_least(&runtime.mcp_version, MIN_MCP_VERSION) {
        Some("mcp_outdated".to_string())
    } else {
        None
    };
    Some(McpConnectionStatus {
        runtime,
        compatible: reason.is_none(),
        reason,
    })
}

/// Compares dotted numeric versions (`1.10.0` >= `1.9.2`); pre-release suffixes are ignored.
pub(crate) fn is_version_at_least(version: &str, minimum: &str) -> bool {
    let parse = |v: &str| -> Vec<u64> {
        v.trim()
            .trim_start_matches('v')
            .split(['-', '+'])
            .next()
            .unwrap_or_default()
            .split('.')
            .map(|part| part.parse().unwrap_or(0))
            .collect()
    };
    let (a, b) = (parse(version), parse(minimum));
    for i in 0..a.len().max(b.len()) {
        let (x, y) = (a.get(i).copied().unwrap_or(0), b.get(i).copied().unwrap_or(0));
        if x != y {
            return x > y;
        }
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compares_versions() {
        assert!(is_version_at_least("1.1.0", "1.1.0"));
        assert!(is_version_at_least("1.10.0", "1.9.9"));
        assert!(is_version_at_least("v2.0.0-beta.1", "1.1.0"));
        assert!(!is_version_at_least("1.0.5", "1.1.0"));
    }

    #[test]
    fn rules_version_is_stable_across_line_endings() {
        assert_eq!(rules_version().len(), 12);
        assert!(!system_prompt().contains('\r'));
    }
}
