use std::fs;
use std::path::PathBuf;
use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppConfig {
    pub entry_time: String,
    pub exit_time: String,
    pub lunch_minutes: u32,
    pub openproject_url: String,
    pub openproject_token: String,
    pub theme_mode: String,
    pub primary_color: String,
    pub is_configured: bool,
    #[serde(default)]
    pub schedule_json: Option<String>,
    #[serde(default = "default_language")]
    pub language: Option<String>,
    #[serde(default)]
    pub user_name: Option<String>,
    #[serde(default)]
    pub user_login: Option<String>,
}

fn default_language() -> Option<String> {
    Some("es".to_string())
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            entry_time: "08:00".to_string(),
            exit_time: "17:30".to_string(),
            lunch_minutes: 60,
            openproject_url: "https://openproject.wposs.com/openproject".to_string(),
            openproject_token: String::new(),
            theme_mode: "system".to_string(),
            primary_color: "indigo".to_string(),
            is_configured: false,
            schedule_json: None,
            language: Some("es".to_string()),
            user_name: None,
            user_login: None,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ActivityRecord {
    pub id: String,
    pub name: String,
    pub minutes: i32,
    #[serde(default)]
    pub seconds: Option<i32>,
    pub date: String,
    #[serde(default)]
    pub project_id: Option<String>,
    #[serde(default)]
    pub project_name: Option<String>,
    #[serde(default)]
    pub ticket: Option<String>,
    #[serde(default)]
    pub ticket_title: Option<String>,
    #[serde(default)]
    pub status_id: Option<String>,
    #[serde(default)]
    pub status_name: Option<String>,
    #[serde(default)]
    pub status_color: Option<String>,
    #[serde(default)]
    pub version_id: Option<String>,
    #[serde(default)]
    pub version_name: Option<String>,
    #[serde(default)]
    pub board_id: Option<String>,
    #[serde(default)]
    pub board_column_id: Option<String>,
    #[serde(default)]
    pub board_column_name: Option<String>,
    #[serde(default)]
    pub synced: Option<bool>,
    #[serde(default)]
    pub timer_seconds: Option<i32>,
    #[serde(default)]
    pub timer_state: Option<String>,
    #[serde(default)]
    pub created_at: Option<String>,
}

pub fn get_db_path(app: &AppHandle) -> PathBuf {
    let app_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));

    if !app_dir.exists() {
        let _ = fs::create_dir_all(&app_dir);
    }

    app_dir.join("pocketproject.sqlite")
}

pub fn open_connection(app: &AppHandle) -> Result<Connection> {
    let db_path = get_db_path(app);
    let conn = Connection::open(db_path)?;

    // Enable foreign keys and WAL mode for better concurrency
    let _ = conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA foreign_keys = ON;",
    );

    init_tables(&conn)?;
    Ok(conn)
}

fn init_tables(conn: &Connection) -> Result<()> {
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

    Ok(())
}

pub fn load_config(conn: &Connection) -> Result<Option<AppConfig>> {
    let mut stmt = conn.prepare(
        "SELECT entry_time, exit_time, lunch_minutes, openproject_url, openproject_token,
                theme_mode, primary_color, is_configured, schedule_json, language,
                user_name, user_login
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
        }))
    } else {
        Ok(None)
    }
}

pub fn is_configured(conn: &Connection) -> Result<bool> {
    let mut stmt = conn.prepare("SELECT is_configured FROM app_config WHERE id = 1")?;
    let mut rows = stmt.query([])?;
    if let Some(row) = rows.next()? {
        let is_configured_int: i32 = row.get(0)?;
        Ok(is_configured_int == 1)
    } else {
        Ok(false)
    }
}

pub fn save_config(conn: &Connection, config: &AppConfig) -> Result<()> {
    let now = chrono_now();
    let lang = config.language.clone().unwrap_or_else(|| "es".to_string());
    conn.execute(
        "INSERT INTO app_config (
            id, entry_time, exit_time, lunch_minutes, openproject_url, openproject_token,
            theme_mode, primary_color, is_configured, schedule_json, language,
            user_name, user_login, updated_at
        ) VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
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
            now,
        ],
    )?;
    Ok(())
}

pub fn load_activities(conn: &Connection, date: Option<&str>) -> Result<Vec<ActivityRecord>> {
    let query = match date {
        Some(_) => {
            "SELECT id, name, minutes, seconds, date, project_id, project_name,
                    ticket, ticket_title, status_id, status_name, status_color,
                    version_id, version_name, board_id, board_column_id, board_column_name,
                    synced, timer_seconds, timer_state, created_at
             FROM activities WHERE date = ?1 ORDER BY created_at ASC"
        }
        None => {
            "SELECT id, name, minutes, seconds, date, project_id, project_name,
                    ticket, ticket_title, status_id, status_name, status_color,
                    version_id, version_name, board_id, board_column_id, board_column_name,
                    synced, timer_seconds, timer_state, created_at
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
        });
    }

    Ok(activities)
}

pub fn save_activity(conn: &Connection, act: &ActivityRecord) -> Result<()> {
    let now = chrono_now();
    let created = act.created_at.clone().unwrap_or(now);
    let is_synced = if act.synced.unwrap_or(false) { 1 } else { 0 };

    conn.execute(
        "INSERT INTO activities (
            id, name, minutes, seconds, date, project_id, project_name, ticket, ticket_title,
            status_id, status_name, status_color, version_id, version_name,
            board_id, board_column_id, board_column_name, synced, timer_seconds,
            timer_state, created_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21)
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
            timer_state = excluded.timer_state",
        params![
            act.id,
            act.name,
            act.minutes,
            act.seconds.unwrap_or(0),
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
            act.timer_seconds.unwrap_or(0),
            act.timer_state.as_deref().unwrap_or("idle"),
            created,
        ],
    )?;

    Ok(())
}

pub fn delete_activity(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM activities WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn clear_activities_for_date(conn: &Connection, date: &str) -> Result<()> {
    conn.execute("DELETE FROM activities WHERE date = ?1", params![date])?;
    Ok(())
}

#[allow(dead_code)]
pub fn mark_activity_synced(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("UPDATE activities SET synced = 1 WHERE id = ?1", params![id])?;
    Ok(())
}

fn chrono_now() -> String {
    use std::time::SystemTime;
    let now = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    now.to_string()
}
