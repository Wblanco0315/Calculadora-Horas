//! Ticket lookup commands.

use crate::model::ticket::{TicketContextResult, TicketInfoResult};
use crate::service::{ticket, ticket_context};

#[tauri::command]
pub(crate) async fn fetch_ticket_info(
    url: String,
    token: String,
    ticket: String,
) -> Result<TicketInfoResult, String> {
    ticket::fetch_ticket_info(url, token, ticket).await
}

#[tauri::command]
pub(crate) async fn fetch_ticket_context(
    url: String,
    token: String,
    ticket: String,
    include_description: Option<bool>,
    include_comments: Option<bool>,
    include_attachments: Option<bool>,
) -> Result<TicketContextResult, String> {
    ticket_context::fetch_ticket_context(url, token, ticket, include_description, include_comments, include_attachments).await
}
