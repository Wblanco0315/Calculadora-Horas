//! Schema creation and additive column migrations.

use rusqlite::{Connection, Result};

pub(crate) fn init_tables(conn: &Connection) -> Result<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS app_config (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            entry_time TEXT NOT NULL,
            exit_time TEXT NOT NULL,
            lunch_minutes INTEGER NOT NULL,
            openproject_url TEXT NOT NULL,
            openproject_token TEXT NOT NULL,
            theme_mode TEXT NOT NULL DEFAULT 'system',
            primary_color TEXT NOT NULL DEFAULT 'indigo',
            is_configured INTEGER NOT NULL DEFAULT 0,
            schedule_json TEXT,
            language TEXT NOT NULL DEFAULT 'es',
            user_name TEXT,
            user_login TEXT,
            updated_at TEXT NOT NULL
        )",
        [],
    )?;

    // Migrations for app_config
    let _ = conn.execute("ALTER TABLE app_config ADD COLUMN schedule_json TEXT", []);
    let _ = conn.execute("ALTER TABLE app_config ADD COLUMN language TEXT DEFAULT 'es'", []);
    let _ = conn.execute("ALTER TABLE app_config ADD COLUMN is_configured INTEGER NOT NULL DEFAULT 0", []);
    let _ = conn.execute("ALTER TABLE app_config ADD COLUMN user_name TEXT", []);
    let _ = conn.execute("ALTER TABLE app_config ADD COLUMN user_login TEXT", []);
    let _ = conn.execute("ALTER TABLE app_config ADD COLUMN min_daily_minutes INTEGER DEFAULT 510", []);

    conn.execute(
        "CREATE TABLE IF NOT EXISTS activities (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            minutes INTEGER NOT NULL,
            seconds INTEGER DEFAULT 0,
            date TEXT NOT NULL,
            project_id TEXT,
            project_name TEXT,
            ticket TEXT,
            ticket_title TEXT,
            status_id TEXT,
            status_name TEXT,
            status_color TEXT,
            version_id TEXT,
            version_name TEXT,
            board_id TEXT,
            board_column_id TEXT,
            board_column_name TEXT,
            synced INTEGER DEFAULT 0,
            timer_seconds INTEGER DEFAULT 0,
            timer_state TEXT DEFAULT 'idle',
            created_at TEXT NOT NULL
        )",
        [],
    )?;

    let _ = conn.execute("ALTER TABLE activities ADD COLUMN project_name TEXT", []);
    let _ = conn.execute("ALTER TABLE activities ADD COLUMN activity_type_id TEXT", []);
    let _ = conn.execute("ALTER TABLE activities ADD COLUMN activity_type_name TEXT", []);
    let _ = conn.execute("ALTER TABLE activities ADD COLUMN timer_last_started INTEGER", []);
    let _ = conn.execute("ALTER TABLE activities ADD COLUMN created_by_ai INTEGER DEFAULT 0", []);

    crate::repository::statistic::init_tables(conn)?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS favorite_tickets (
            ticket TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            project_id TEXT,
            project_name TEXT,
            created_at TEXT NOT NULL
        )",
        [],
    )?;

    Ok(())
}
