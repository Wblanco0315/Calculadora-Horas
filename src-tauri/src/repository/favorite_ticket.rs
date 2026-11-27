//! `favorite_tickets` table access.

use rusqlite::{params, Connection, Result};

use crate::model::favorite_ticket::FavoriteTicketRecord;
use crate::repository::connection::chrono_now;

pub(crate) fn load_favorite_tickets(conn: &Connection) -> Result<Vec<FavoriteTicketRecord>> {
    let mut stmt = conn.prepare("SELECT ticket, title, project_id, project_name FROM favorite_tickets ORDER BY title ASC")?;
    let rows = stmt.query_map([], |row| {
        Ok(FavoriteTicketRecord {
            ticket: row.get(0)?,
            title: row.get(1)?,
            project_id: row.get(2).ok(),
            project_name: row.get(3).ok(),
        })
    })?;
    let mut list = Vec::new();
    for r in rows {
        list.push(r?);
    }
    Ok(list)
}

pub(crate) fn save_favorite_ticket(conn: &Connection, fav: &FavoriteTicketRecord) -> Result<()> {
    let now = chrono_now();
    conn.execute(
        "INSERT INTO favorite_tickets (ticket, title, project_id, project_name, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(ticket) DO UPDATE SET
            title = excluded.title,
            project_id = excluded.project_id,
            project_name = excluded.project_name",
        params![fav.ticket, fav.title, fav.project_id, fav.project_name, now],
    )?;
    Ok(())
}

pub(crate) fn delete_favorite_ticket(conn: &Connection, ticket: &str) -> Result<()> {
    conn.execute("DELETE FROM favorite_tickets WHERE ticket = ?1", params![ticket])?;
    Ok(())
}
