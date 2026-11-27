//! Aggregate statistics.
//!
//! `time_entry_daily_statistic` caches the user's OpenProject time entries already summarised per
//! (date, project), so the overview opens instantly (and offline) and only the small rollup is
//! stored. It is replaced on every refresh from OpenProject and never holds more than the
//! statistics window (rows before the window start are deleted on each refresh).

use rusqlite::{params, Connection, Result};

use crate::model::statistic::{DailyProjectStatistic, UnsyncedStatistic};

/// Project key used for time entries without a project.
const NO_PROJECT_KEY: &str = "";

pub(crate) fn init_tables(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(date);

         DROP TRIGGER IF EXISTS trg_activity_statistic_insert_v1;
         DROP TRIGGER IF EXISTS trg_activity_statistic_delete_v1;
         DROP TRIGGER IF EXISTS trg_activity_statistic_update_v1;
         DROP TABLE IF EXISTS activity_daily_statistic;

         CREATE TABLE IF NOT EXISTS time_entry_daily_statistic (
             date TEXT NOT NULL,
             project_key TEXT NOT NULL,
             project_name TEXT,
             minutes INTEGER NOT NULL DEFAULT 0,
             entry_count INTEGER NOT NULL DEFAULT 0,
             PRIMARY KEY (date, project_key)
         );

         CREATE TABLE IF NOT EXISTS statistic_meta (
             key TEXT PRIMARY KEY,
             value TEXT NOT NULL
         );",
    )
}

/// Replaces the cached rows between `from` and `to` (inclusive) with `rows`, drops anything older
/// than `from` and records the refresh time.
pub(crate) fn replace_time_entry_statistics(
    conn: &mut Connection,
    from: &str,
    to: &str,
    rows: &[DailyProjectStatistic],
    refreshed_at: i64,
) -> Result<()> {
    let tx = conn.transaction()?;
    tx.execute(
        "DELETE FROM time_entry_daily_statistic WHERE date < ?1 OR date BETWEEN ?1 AND ?2",
        params![from, to],
    )?;
    {
        let mut insert = tx.prepare(
            "INSERT INTO time_entry_daily_statistic (date, project_key, project_name, minutes, entry_count)
             VALUES (?1, ?2, ?3, ?4, ?5)",
        )?;
        for row in rows {
            insert.execute(params![
                row.date,
                row.project_id.as_deref().unwrap_or(NO_PROJECT_KEY),
                row.project_name,
                row.minutes,
                row.entry_count,
            ])?;
        }
    }
    tx.execute(
        "INSERT INTO statistic_meta (key, value) VALUES ('time_entry_refreshed_at', ?1)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![refreshed_at.to_string()],
    )?;
    tx.commit()
}

/// Cached per-day, per-project rows from `from` (inclusive, `YYYY-MM-DD`) onwards.
pub(crate) fn load_time_entry_statistics(conn: &Connection, from: &str) -> Result<Vec<DailyProjectStatistic>> {
    let mut stmt = conn.prepare(
        "SELECT date, project_key, project_name, minutes, entry_count
         FROM time_entry_daily_statistic WHERE date >= ?1 ORDER BY date ASC, project_key ASC",
    )?;
    let rows = stmt.query_map(params![from], |r| {
        let key: String = r.get(1)?;
        Ok(DailyProjectStatistic {
            date: r.get(0)?,
            project_id: if key == NO_PROJECT_KEY { None } else { Some(key) },
            project_name: r.get(2)?,
            minutes: r.get(3)?,
            entry_count: r.get(4)?,
        })
    })?;
    rows.collect()
}

pub(crate) fn load_refreshed_at(conn: &Connection) -> Result<Option<i64>> {
    let value: Option<String> = conn
        .query_row(
            "SELECT value FROM statistic_meta WHERE key = 'time_entry_refreshed_at'",
            [],
            |r| r.get(0),
        )
        .map(Some)
        .or_else(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => Ok(None),
            other => Err(other),
        })?;
    Ok(value.and_then(|v| v.parse().ok()))
}

/// Local activities not uploaded to OpenProject yet (any date).
pub(crate) fn load_unsynced(conn: &Connection) -> Result<UnsyncedStatistic> {
    conn.query_row(
        "SELECT COALESCE(SUM(minutes), 0), COUNT(*) FROM activities WHERE COALESCE(synced, 0) = 0",
        [],
        |r| {
            Ok(UnsyncedStatistic {
                minutes: r.get(0)?,
                entry_count: r.get(1)?,
            })
        },
    )
}

pub(crate) fn count_ai_activities(conn: &Connection) -> Result<i32> {
    let mut stmt = conn.prepare("SELECT COUNT(*) FROM activities WHERE created_by_ai = 1")?;
    let count: i32 = stmt.query_row([], |r| r.get(0))?;
    Ok(count)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        crate::repository::migration::init_tables(&conn).unwrap();
        conn
    }

    fn row(date: &str, project: Option<&str>, minutes: i64) -> DailyProjectStatistic {
        DailyProjectStatistic {
            date: date.into(),
            project_id: project.map(Into::into),
            project_name: project.map(Into::into),
            minutes,
            entry_count: 1,
        }
    }

    #[test]
    fn refresh_replaces_the_window_and_drops_older_rows() {
        let mut conn = setup();
        replace_time_entry_statistics(
            &mut conn,
            "2026-08-01",
            "2026-08-31",
            &[row("2026-08-05", Some("1"), 60), row("2026-08-06", None, 30)],
            1,
        )
        .unwrap();
        assert_eq!(load_time_entry_statistics(&conn, "2026-01-01").unwrap().len(), 2);

        // Next refresh starts later: 2026-08-05 falls out of the window, 2026-08-06 is replaced.
        replace_time_entry_statistics(&mut conn, "2026-08-06", "2026-09-06", &[row("2026-09-01", Some("2"), 45)], 2)
            .unwrap();
        let rows = load_time_entry_statistics(&conn, "2026-01-01").unwrap();
        assert_eq!(rows, vec![row("2026-09-01", Some("2"), 45)]);
        assert_eq!(load_refreshed_at(&conn).unwrap(), Some(2));
    }

    #[test]
    fn unsynced_counts_only_local_pending_activities() {
        let conn = setup();
        conn.execute_batch(
            "INSERT INTO activities (id, name, minutes, date, synced, created_at) VALUES
                ('a', 'x', 30, '2026-11-01', 0, 'now'),
                ('b', 'x', 45, '2026-11-01', 1, 'now'),
                ('c', 'x', 15, '2026-11-02', 0, 'now');",
        )
        .unwrap();
        let unsynced = load_unsynced(&conn).unwrap();
        assert_eq!(unsynced.minutes, 45);
        assert_eq!(unsynced.entry_count, 2);
    }
}
