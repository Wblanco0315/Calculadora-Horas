//! Overview time statistics: OpenProject time entries summarised per day and project.

use serde::Serialize;

/// Time the user logged in OpenProject for one project on one day.
#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DailyProjectStatistic {
    pub date: String,
    pub project_id: Option<String>,
    pub project_name: Option<String>,
    pub minutes: i64,
    pub entry_count: i64,
}

/// Local activities not uploaded to OpenProject yet.
#[derive(Debug, Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UnsyncedStatistic {
    pub minutes: i64,
    pub entry_count: i64,
}

/// Everything the overview dashboard needs, in one IPC call.
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TimeStatistics {
    /// Cached OpenProject per-day, per-project totals since the requested date.
    pub days: Vec<DailyProjectStatistic>,
    pub unsynced: UnsyncedStatistic,
    /// Unix milliseconds of the last successful refresh from OpenProject.
    pub refreshed_at: Option<i64>,
}
