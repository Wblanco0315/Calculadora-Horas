//! Work package DTOs (form schema, revisions, search, update payload).

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkPackageOptionItem {
    pub id: String,
    pub name: String,
    pub color: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkPackageFormSchemaResult {
    pub statuses: Vec<WorkPackageOptionItem>,
    pub priorities: Vec<WorkPackageOptionItem>,
    pub assignees: Vec<WorkPackageOptionItem>,
    pub responsibles: Vec<WorkPackageOptionItem>,
    pub versions: Vec<WorkPackageOptionItem>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkPackageUpdateStreamResult {
    pub available: bool,
    pub has_updates: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkPackageRevisionItem {
    pub id: String,
    pub lock_version: i64,
    pub updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkPackageCostSummaryItem {
    pub labor_costs: Option<String>,
    pub material_costs: Option<String>,
    pub overall_costs: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UpdateWorkPackagePayload {
    pub lock_version: Option<i64>,
    pub subject: Option<String>,
    pub description_raw: Option<String>,
    pub start_date: Option<String>,
    pub clear_start_date: Option<bool>,
    pub due_date: Option<String>,
    pub clear_due_date: Option<bool>,
    pub estimated_time: Option<String>,
    pub status_id: Option<String>,
    pub priority_id: Option<String>,
    pub assignee_id: Option<String>,
    pub clear_assignee: Option<bool>,
    pub responsible_id: Option<String>,
    pub clear_responsible: Option<bool>,
    pub version_id: Option<String>,
    pub clear_version: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkPackageSearchItem {
    pub id: i64,
    pub subject: String,
    pub project_id: Option<String>,
    pub project_name: Option<String>,
    pub type_name: Option<String>,
    pub status_name: Option<String>,
}

/// Filter of `my_tickets`: work packages of the connected user by status and project.
#[derive(Debug, Deserialize, Clone, Default)]
pub(crate) struct MyTicketFilter {
    /// Status names or IDs (names are matched without case or accents). Empty: open statuses,
    /// or every status with `include_closed`.
    #[serde(default)]
    pub statuses: Vec<String>,
    /// Numeric OpenProject project ID; `None` covers every project.
    #[serde(default)]
    pub project_id: Option<String>,
    /// `assignee` (default), `responsible` or `any` (assignee or responsible).
    #[serde(default)]
    pub role: Option<String>,
    /// With no `statuses`, also return closed tickets.
    #[serde(default)]
    pub include_closed: bool,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MyTicketItem {
    pub id: i64,
    pub subject: String,
    pub type_name: Option<String>,
    pub status_id: Option<String>,
    pub status_name: Option<String>,
    pub priority_name: Option<String>,
    pub assignee_name: Option<String>,
    pub responsible_name: Option<String>,
    pub version_name: Option<String>,
    pub due_date: Option<String>,
    pub updated_at: Option<String>,
    /// Needed by `update_status` / `move_column` when the user asks to move the ticket.
    pub lock_version: Option<i64>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MyTicketStatusCount {
    pub status: String,
    pub count: usize,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MyTicketProjectGroup {
    pub project_id: Option<String>,
    pub project_name: String,
    pub total: usize,
    pub by_status: Vec<MyTicketStatusCount>,
    pub tickets: Vec<MyTicketItem>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MyTicketResult {
    pub role: String,
    /// Statuses actually filtered (OpenProject names), or `open` / `all`.
    pub statuses: Vec<String>,
    /// Requested statuses that do not exist in OpenProject.
    pub unknown_statuses: Vec<String>,
    pub project_id: Option<String>,
    pub total: usize,
    /// More tickets matched than the app returns in one call.
    pub truncated: bool,
    pub projects: Vec<MyTicketProjectGroup>,
}
