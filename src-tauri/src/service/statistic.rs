//! Overview time statistics from OpenProject.
//!
//! The user's time entries are read with the same query as the time-cost report (user = `me`,
//! `spent_on` range), summarised per (date, project) and cached in SQLite
//! (`time_entry_daily_statistic`). The overview reads the cache first and refreshes it in the
//! background, so only the small rollup crosses the IPC boundary.

use std::collections::BTreeMap;
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::AppHandle;

use crate::model::statistic::{DailyProjectStatistic, TimeStatistics};
use crate::model::time_entry::{PlatformTimeEntryItem, TimeCostReportFilter};
use crate::openproject::time_entry::iso_duration_to_minutes;
use crate::repository::connection::open_connection;
use crate::repository::statistic;
use crate::service::report;

/// Cached statistics since `from` plus the local unsynced totals. No network access.
pub(crate) fn load_cached(app: &AppHandle, from: &str) -> Result<TimeStatistics, String> {
    let conn = open_connection(app).map_err(|e| e.to_string())?;
    let read = || -> rusqlite::Result<TimeStatistics> {
        Ok(TimeStatistics {
            days: statistic::load_time_entry_statistics(&conn, from)?,
            unsynced: statistic::load_unsynced(&conn)?,
            refreshed_at: statistic::load_refreshed_at(&conn)?,
        })
    };
    read().map_err(|e| e.to_string())
}

/// Reads the user's OpenProject time entries between `from` and `to`, replaces the cache and
/// returns the fresh statistics. On any OpenProject error the cache is left untouched.
pub(crate) async fn refresh(
    app: &AppHandle,
    url: String,
    token: String,
    from: String,
    to: String,
) -> Result<TimeStatistics, String> {
    let filter = TimeCostReportFilter {
        user_id: Some("me".to_string()),
        spent_on_from: Some(from.clone()),
        spent_on_to: Some(to.clone()),
        ..TimeCostReportFilter::default()
    };
    let entries = report::fetch_time_cost_report_entries(&url, &token, &filter).await?;
    let rows = summarize(&entries);

    let refreshed_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);
    let mut conn = open_connection(app).map_err(|e| e.to_string())?;
    statistic::replace_time_entry_statistics(&mut conn, &from, &to, &rows, refreshed_at)
        .map_err(|e| e.to_string())?;
    drop(conn);

    load_cached(app, &from)
}

/// Sums time entries per (date, project).
pub(crate) fn summarize(entries: &[PlatformTimeEntryItem]) -> Vec<DailyProjectStatistic> {
    let mut rows: BTreeMap<(String, String), DailyProjectStatistic> = BTreeMap::new();
    for entry in entries.iter().filter(|e| !e.spent_on.is_empty()) {
        let key = (entry.spent_on.clone(), entry.project_id.clone().unwrap_or_default());
        let row = rows.entry(key).or_insert_with(|| DailyProjectStatistic {
            date: entry.spent_on.clone(),
            project_id: entry.project_id.clone(),
            project_name: entry.project_name.clone(),
            minutes: 0,
            entry_count: 0,
        });
        row.minutes += iso_duration_to_minutes(&entry.hours);
        row.entry_count += 1;
        if row.project_name.is_none() {
            row.project_name = entry.project_name.clone();
        }
    }
    rows.into_values().collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(spent_on: &str, project: Option<&str>, hours: &str) -> PlatformTimeEntryItem {
        PlatformTimeEntryItem {
            id: "1".into(),
            hours: hours.into(),
            spent_on: spent_on.into(),
            start_time: None,
            comment: String::new(),
            user_id: None,
            user_name: String::new(),
            activity_name: String::new(),
            activity_id: None,
            project_id: project.map(Into::into),
            project_name: project.map(|p| format!("Project {p}")),
            work_package_id: None,
            work_package_name: None,
            registered_by_name: None,
            costs: None,
            created_at: None,
            updated_at: None,
        }
    }

    #[test]
    fn summarizes_per_day_and_project() {
        let rows = summarize(&[
            entry("2026-11-02", Some("1"), "PT1H"),
            entry("2026-11-02", Some("1"), "PT30M"),
            entry("2026-11-02", None, "PT0.5H"),
            entry("2026-11-03", Some("1"), "PT2H"),
        ]);
        assert_eq!(rows.len(), 3);
        assert_eq!(rows[0].project_id, None);
        assert_eq!(rows[0].minutes, 30);
        assert_eq!(rows[1].minutes, 90);
        assert_eq!(rows[1].entry_count, 2);
        assert_eq!(rows[2].date, "2026-11-03");
    }
}
