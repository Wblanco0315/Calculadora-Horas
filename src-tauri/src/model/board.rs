//! Board, board column and column move DTOs.

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BoardOptionItem {
    pub id: String,
    pub name: String,
    /// OpenProject board kind: `free` (basic) or `action`.
    pub kind: Option<String>,
    /// Attribute an action board is based on (`status`, `assignee`, `version`, `subproject`).
    pub attribute: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BoardWorkPackageCardItem {
    pub id: i64,
    pub subject: String,
    pub type_name: Option<String>,
    pub type_color: Option<String>,
    pub status_id: Option<String>,
    pub status_name: Option<String>,
    pub status_color: Option<String>,
    pub priority_name: Option<String>,
    pub assignee_name: Option<String>,
    pub project_name: Option<String>,
    pub start_date: Option<String>,
    pub due_date: Option<String>,
    pub lock_version: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BoardColumnOptionItem {
    pub query_id: String,
    pub name: String,
    pub widget_id: i64,
    pub start_column: i64,
    pub work_package_ids: Vec<i64>,
    pub work_packages: Vec<BoardWorkPackageCardItem>,
    pub status_id: Option<String>,
    pub status_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MoveColumnResult {
    pub ok: bool,
    pub status_id: Option<String>,
    pub error: Option<String>,
}
