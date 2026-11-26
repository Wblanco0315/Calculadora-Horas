//! Time entry and time-cost report DTOs.

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PlatformTimeEntryItem {
    pub id: String,
    pub hours: String,
    pub spent_on: String,
    pub start_time: Option<String>,
    pub comment: String,
    pub user_id: Option<String>,
    pub user_name: String,
    pub activity_name: String,
    pub activity_id: Option<String>,
    #[serde(default)]
    pub project_id: Option<String>,
    pub project_name: Option<String>,
    #[serde(default)]
    pub work_package_id: Option<String>,
    pub work_package_name: Option<String>,
    pub registered_by_name: Option<String>,
    pub costs: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UpdateTimeEntryPayload {
    pub hours: String,
    pub spent_on: String,
    pub comment: String,
    pub activity_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TimeCostReportFilter {
    pub ticket_id: Option<String>,
    pub project_id: Option<String>,
    pub user_id: Option<String>,
    pub activity_id: Option<String>,
    pub spent_on_from: Option<String>,
    pub spent_on_to: Option<String>,
    pub include_descendants: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub(crate) struct TimeEntryActivityItem {
    pub id: String,
    pub name: String,
}
