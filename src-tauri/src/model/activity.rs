//! Locally tracked activity record.

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ActivityRecord {
    pub id: String,
    pub name: String,
    pub minutes: i32,
    #[serde(default)]
    pub seconds: Option<i32>,
    pub date: String,
    #[serde(default, alias = "project_id")]
    pub project_id: Option<String>,
    #[serde(default, alias = "project_name")]
    pub project_name: Option<String>,
    #[serde(default)]
    pub ticket: Option<String>,
    #[serde(default, alias = "ticket_title")]
    pub ticket_title: Option<String>,
    #[serde(default, alias = "status_id")]
    pub status_id: Option<String>,
    #[serde(default, alias = "status_name")]
    pub status_name: Option<String>,
    #[serde(default, alias = "status_color")]
    pub status_color: Option<String>,
    #[serde(default, alias = "version_id")]
    pub version_id: Option<String>,
    #[serde(default, alias = "version_name")]
    pub version_name: Option<String>,
    #[serde(default, alias = "board_id")]
    pub board_id: Option<String>,
    #[serde(default, alias = "board_column_id")]
    pub board_column_id: Option<String>,
    #[serde(default, alias = "board_column_name")]
    pub board_column_name: Option<String>,
    #[serde(default)]
    pub synced: Option<bool>,
    #[serde(default, alias = "timer_seconds")]
    pub timer_seconds: Option<i32>,
    #[serde(default, alias = "timer_state")]
    pub timer_state: Option<String>,
    #[serde(default, alias = "timer_last_started")]
    pub timer_last_started: Option<i64>,
    #[serde(default, alias = "activity_type_id")]
    pub activity_type_id: Option<String>,
    #[serde(default, alias = "activity_type_name")]
    pub activity_type_name: Option<String>,
    #[serde(default, alias = "created_at")]
    pub created_at: Option<String>,
    #[serde(default, alias = "created_by_ai")]
    pub created_by_ai: Option<bool>,
}
