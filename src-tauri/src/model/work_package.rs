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
