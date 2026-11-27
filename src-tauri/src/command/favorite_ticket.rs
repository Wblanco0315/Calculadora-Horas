//! Favorite ticket commands (local SQLite).

use tauri::AppHandle;

use crate::model::favorite_ticket::FavoriteTicketRecord;
use crate::repository::connection::open_connection;
use crate::repository::favorite_ticket;

#[tauri::command]
pub(crate) fn get_favorite_tickets(app: AppHandle) -> Result<Vec<FavoriteTicketRecord>, String> {
    let conn = open_connection(&app).map_err(|e| e.to_string())?;
    favorite_ticket::load_favorite_tickets(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub(crate) fn save_favorite_ticket(app: AppHandle, ticket: FavoriteTicketRecord) -> Result<(), String> {
    let conn = open_connection(&app).map_err(|e| e.to_string())?;
    favorite_ticket::save_favorite_ticket(&conn, &ticket).map_err(|e| e.to_string())
}

#[tauri::command]
pub(crate) fn delete_favorite_ticket(app: AppHandle, ticket: String) -> Result<(), String> {
    let conn = open_connection(&app).map_err(|e| e.to_string())?;
    favorite_ticket::delete_favorite_ticket(&conn, &ticket).map_err(|e| e.to_string())
}
