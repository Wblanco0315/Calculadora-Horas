//! `app_config` table access.

use rusqlite::{params, Connection, Result};

use crate::model::config::AppConfig;
use crate::repository::connection::chrono_now;

pub(crate) fn load_config(conn: &Connection) -> Result<Option<AppConfig>> {
    let mut stmt = conn.prepare(
        "SELECT entry_time, exit_time, lunch_minutes, openproject_url, openproject_token,
                theme_mode, primary_color, is_configured, schedule_json, language,
                user_name, user_login, min_daily_minutes
         FROM app_config WHERE id = 1",
    )?;

    let mut rows = stmt.query([])?;
    if let Some(row) = rows.next()? {
        let is_configured_int: i32 = row.get(7)?;
        Ok(Some(AppConfig {
            entry_time: row.get(0)?,
            exit_time: row.get(1)?,
            lunch_minutes: row.get(2)?,
            openproject_url: row.get(3)?,
            openproject_token: row.get(4)?,
            theme_mode: row.get(5)?,
            primary_color: row.get(6)?,
            is_configured: is_configured_int == 1,
            schedule_json: row.get(8).ok(),
            language: row.get(9).ok().or_else(|| Some("es".to_string())),
            user_name: row.get(10).ok(),
            user_login: row.get(11).ok(),
            min_daily_minutes: row.get(12).ok().or(Some(510)),
        }))
    } else {
        Ok(None)
    }
}

pub(crate) fn is_configured(conn: &Connection) -> Result<bool> {
    let mut stmt = conn.prepare("SELECT is_configured FROM app_config WHERE id = 1")?;
    let mut rows = stmt.query([])?;
    if let Some(row) = rows.next()? {
        let is_configured_int: i32 = row.get(0)?;
        Ok(is_configured_int == 1)
    } else {
        Ok(false)
    }
}

pub(crate) fn save_config(conn: &Connection, config: &AppConfig) -> Result<()> {
    let now = chrono_now();
    let lang = config.language.clone().unwrap_or_else(|| "es".to_string());
    let min_daily = config.min_daily_minutes.unwrap_or(510);
    conn.execute(
        "INSERT INTO app_config (
            id, entry_time, exit_time, lunch_minutes, openproject_url, openproject_token,
            theme_mode, primary_color, is_configured, schedule_json, language,
            user_name, user_login, min_daily_minutes, updated_at
        ) VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
        ON CONFLICT(id) DO UPDATE SET
            entry_time = excluded.entry_time,
            exit_time = excluded.exit_time,
            lunch_minutes = excluded.lunch_minutes,
            openproject_url = excluded.openproject_url,
            openproject_token = excluded.openproject_token,
            theme_mode = excluded.theme_mode,
            primary_color = excluded.primary_color,
            is_configured = excluded.is_configured,
            schedule_json = excluded.schedule_json,
            language = excluded.language,
            user_name = excluded.user_name,
            user_login = excluded.user_login,
            min_daily_minutes = excluded.min_daily_minutes,
            updated_at = excluded.updated_at",
        params![
            config.entry_time,
            config.exit_time,
            config.lunch_minutes,
            config.openproject_url,
            config.openproject_token,
            config.theme_mode,
            config.primary_color,
            if config.is_configured { 1 } else { 0 },
            config.schedule_json,
            lang,
            config.user_name,
            config.user_login,
            min_daily,
            now,
        ],
    )?;
    Ok(())
}
