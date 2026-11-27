//! Board and board column commands.

use crate::model::board::{BoardColumnOptionItem, BoardOptionItem, MoveColumnResult};
use crate::service::{board, board_move};

#[tauri::command]
pub(crate) async fn fetch_project_boards(
    url: String,
    token: String,
    project_id: String,
    project_identifier: Option<String>,
) -> Result<Vec<BoardOptionItem>, String> {
    board::fetch_project_boards(url, token, project_id, project_identifier).await
}

#[tauri::command]
pub(crate) async fn fetch_board_columns(
    url: String,
    token: String,
    grid_id: String,
) -> Result<Vec<BoardColumnOptionItem>, String> {
    board::fetch_board_columns(url, token, grid_id).await
}

#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub(crate) async fn move_work_package_to_board_column(
    url: String,
    token: String,
    ticket: String,
    target_query_id: String,
    source_query_id: Option<String>,
    target_status_id: Option<String>,
    target_position_index: Option<usize>,
    target_ticket_ids: Option<Vec<i64>>,
    expected_lock_version: Option<i64>,
) -> Result<MoveColumnResult, String> {
    board_move::move_work_package_to_board_column(url, token, ticket, target_query_id, source_query_id, target_status_id, target_position_index, target_ticket_ids, expected_lock_version).await
}
