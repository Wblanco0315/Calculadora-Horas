//! Aggregate statistics over local data.

use rusqlite::{Connection, Result};

pub(crate) fn count_ai_activities(conn: &Connection) -> Result<i32> {
    let mut stmt = conn.prepare("SELECT COUNT(*) FROM activities WHERE created_by_ai = 1")?;
    let count: i32 = stmt.query_row([], |r| r.get(0))?;
    Ok(count)
}
