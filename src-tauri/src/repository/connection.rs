//! SQLite database location, connection setup and shared helpers.

use rusqlite::{Connection, Result};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

use crate::repository::migration::init_tables;

pub(crate) fn get_db_path(app: &AppHandle) -> PathBuf {
    let app_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));

    if !app_dir.exists() {
        let _ = fs::create_dir_all(&app_dir);
    }

    app_dir.join("pocketproject.sqlite")
}

pub(crate) fn open_connection(app: &AppHandle) -> Result<Connection> {
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

pub(crate) fn chrono_now() -> String {
    use std::time::SystemTime;
    let now = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    now.to_string()
}
