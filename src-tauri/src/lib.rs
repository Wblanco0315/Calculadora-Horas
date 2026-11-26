//! PocketProject Tauri backend. See `docs/backend.md` for the layer overview.

mod app;
mod command;
mod ipc;
mod model;
mod openproject;
mod repository;
mod service;

use tauri_plugin_autostart::MacosLauncher;

use crate::command::{
    activity, app as app_command, attachment, board, config, connection, favorite_ticket, mcp,
    project, report, statistic, ticket, time_entry, work_package,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .setup(app::setup::setup)
        .on_window_event(app::window::handle_window_event)
        .invoke_handler(tauri::generate_handler![
            config::get_app_config,
            config::save_app_config,
            config::check_is_configured,
            connection::test_openproject_connection,
            activity::get_activities,
            activity::save_activity,
            activity::delete_activity,
            activity::clear_activities,
            activity::purge_synced_activities,
            ticket::fetch_ticket_info,
            ticket::fetch_ticket_context,
            attachment::fetch_attachment_content,
            attachment::download_work_package_attachment,
            project::fetch_openproject_projects,
            time_entry::fetch_time_entry_activities,
            time_entry::create_time_entry,
            work_package::update_work_package_status,
            work_package::update_work_package_version,
            project::fetch_project_versions,
            project::fetch_statuses,
            board::fetch_project_boards,
            board::fetch_board_columns,
            board::move_work_package_to_board_column,
            work_package::fetch_work_package_form,
            work_package::fetch_work_package_revisions,
            work_package::search_work_packages,
            work_package::fetch_work_package_update_stream,
            work_package::update_work_package,
            work_package::add_work_package_comment,
            attachment::upload_work_package_attachment,
            work_package::fetch_work_package_cost_summary,
            connection::fetch_current_user_id,
            time_entry::update_work_package_time_entry,
            report::fetch_time_cost_report_entries,
            report::fetch_work_package_time_entries,
            config::get_database_path,
            activity::get_ai_stats,
            statistic::get_time_statistics,
            statistic::refresh_time_statistics,
            favorite_ticket::get_favorite_tickets,
            favorite_ticket::save_favorite_ticket,
            favorite_ticket::delete_favorite_ticket,
            mcp::install_mcp_to_client,
            mcp::inject_ai_rules,
            mcp::get_mcp_contract,
            mcp::get_mcp_status,
            mcp::refresh_mcp_rules,
            app_command::exit_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
