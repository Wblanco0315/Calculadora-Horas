//! Time-cost report commands.

use crate::model::time_entry::{PlatformTimeEntryItem, TimeCostReportFilter};
use crate::service::report;

#[tauri::command]
pub(crate) async fn fetch_time_cost_report_entries(
    url: String,
    token: String,
    filter: TimeCostReportFilter,
) -> Result<Vec<PlatformTimeEntryItem>, String> {
    report::load_time_cost_report_entries(url, token, filter).await
}

#[tauri::command]
pub(crate) async fn fetch_work_package_time_entries(
    url: String,
    token: String,
    ticket: String,
) -> Result<Vec<PlatformTimeEntryItem>, String> {
    report::load_work_package_time_entries(url, token, ticket).await
}
