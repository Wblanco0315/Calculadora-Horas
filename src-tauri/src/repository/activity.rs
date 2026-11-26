//! `activities` table access.

use rusqlite::{params, Connection, Result};

use crate::model::activity::ActivityRecord;
use crate::repository::connection::chrono_now;

pub(crate) fn load_activities(conn: &Connection, date: Option<&str>) -> Result<Vec<ActivityRecord>> {
    let query = match date {
        Some(_) => {
            "SELECT id, name, minutes, seconds, date, project_id, project_name,
                    ticket, ticket_title, status_id, status_name, status_color,
                    version_id, version_name, board_id, board_column_id, board_column_name,
                    synced, timer_seconds, timer_state, created_at, activity_type_id, activity_type_name,
                    timer_last_started, created_by_ai
             FROM activities WHERE date = ?1 ORDER BY created_at ASC"
        }
        None => {
            "SELECT id, name, minutes, seconds, date, project_id, project_name,
                    ticket, ticket_title, status_id, status_name, status_color,
                    version_id, version_name, board_id, board_column_id, board_column_name,
                    synced, timer_seconds, timer_state, created_at, activity_type_id, activity_type_name,
                    timer_last_started, created_by_ai
             FROM activities ORDER BY date DESC, created_at ASC"
        }
    };

    let mut stmt = conn.prepare(query)?;
    let mut rows = match date {
        Some(d) => stmt.query(params![d])?,
        None => stmt.query([])?,
    };

    let mut activities = Vec::new();
    while let Some(row) = rows.next()? {
        let synced_int: i32 = row.get(17).unwrap_or(0);
        let created_by_ai_int: i32 = row.get(24).unwrap_or(0);
        activities.push(ActivityRecord {
            id: row.get(0)?,
            name: row.get(1)?,
            minutes: row.get(2)?,
            seconds: row.get(3).ok(),
            date: row.get(4)?,
            project_id: row.get(5).ok(),
            project_name: row.get(6).ok(),
            ticket: row.get(7).ok(),
            ticket_title: row.get(8).ok(),
            status_id: row.get(9).ok(),
            status_name: row.get(10).ok(),
            status_color: row.get(11).ok(),
            version_id: row.get(12).ok(),
            version_name: row.get(13).ok(),
            board_id: row.get(14).ok(),
            board_column_id: row.get(15).ok(),
            board_column_name: row.get(16).ok(),
            synced: Some(synced_int == 1),
            timer_seconds: row.get(18).ok(),
            timer_state: row.get(19).ok(),
            created_at: row.get(20).ok(),
            activity_type_id: row.get(21).ok(),
            activity_type_name: row.get(22).ok(),
            timer_last_started: row.get(23).ok(),
            created_by_ai: Some(created_by_ai_int == 1),
        });
    }

    Ok(activities)
}

pub(crate) fn save_activity(conn: &Connection, act: &ActivityRecord) -> Result<()> {
    let now = chrono_now();
    let created = act.created_at.clone().unwrap_or(now);
    let is_synced = if act.synced.unwrap_or(false) { 1 } else { 0 };
    let is_created_by_ai = if act.created_by_ai.unwrap_or(false) { 1 } else { 0 };

    conn.execute(
        "INSERT INTO activities (
            id, name, minutes, seconds, date, project_id, project_name, ticket, ticket_title,
            status_id, status_name, status_color, version_id, version_name,
            board_id, board_column_id, board_column_name, synced, timer_seconds,
            timer_state, created_at, activity_type_id, activity_type_name, timer_last_started, created_by_ai
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25)
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            minutes = excluded.minutes,
            seconds = excluded.seconds,
            date = excluded.date,
            project_id = excluded.project_id,
            project_name = excluded.project_name,
            ticket = excluded.ticket,
            ticket_title = excluded.ticket_title,
            status_id = excluded.status_id,
            status_name = excluded.status_name,
            status_color = excluded.status_color,
            version_id = excluded.version_id,
            version_name = excluded.version_name,
            board_id = excluded.board_id,
            board_column_id = excluded.board_column_id,
            board_column_name = excluded.board_column_name,
            synced = excluded.synced,
            timer_seconds = excluded.timer_seconds,
            timer_state = excluded.timer_state,
            activity_type_id = excluded.activity_type_id,
            activity_type_name = excluded.activity_type_name,
            timer_last_started = excluded.timer_last_started,
            created_by_ai = excluded.created_by_ai",
        params![
            act.id,
            act.name,
            act.minutes,
            act.seconds,
            act.date,
            act.project_id,
            act.project_name,
            act.ticket,
            act.ticket_title,
            act.status_id,
            act.status_name,
            act.status_color,
            act.version_id,
            act.version_name,
            act.board_id,
            act.board_column_id,
            act.board_column_name,
            is_synced,
            act.timer_seconds,
            act.timer_state,
            created,
            act.activity_type_id,
            act.activity_type_name,
            act.timer_last_started,
            is_created_by_ai,
        ],
    )?;
    Ok(())
}

pub(crate) fn delete_activity(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM activities WHERE id = ?1", params![id])?;
    Ok(())
}

pub(crate) fn clear_activities_for_date(conn: &Connection, date: &str) -> Result<()> {
    conn.execute("DELETE FROM activities WHERE date = ?1", params![date])?;
    Ok(())
}

#[allow(dead_code)]
pub(crate) fn mark_activity_synced(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("UPDATE activities SET synced = 1 WHERE id = ?1", params![id])?;
    Ok(())
}
