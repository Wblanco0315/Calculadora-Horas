//! Overview time statistics commands (OpenProject time entries, cached rollup in SQLite).

use tauri::AppHandle;

use crate::model::statistic::TimeStatistics;
use crate::service::statistic;

/// Cached OpenProject statistics since `from` (`YYYY-MM-DD`) plus local unsynced totals. Offline.
#[tauri::command]
pub(crate) fn get_time_statistics(app: AppHandle, from: String) -> Result<TimeStatistics, String> {
    statistic::load_cached(&app, &from)
}

/// Refreshes the cache from the user's OpenProject time entries between `from` and `to`.
#[tauri::command]
pub(crate) async fn refresh_time_statistics(
    app: AppHandle,
    url: String,
    token: String,
    from: String,
    to: String,
) -> Result<TimeStatistics, String> {
    statistic::refresh(&app, url, token, from, to).await
}
