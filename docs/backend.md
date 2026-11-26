# Backend architecture (Tauri / Rust)

The desktop backend lives in `src-tauri/src/`. It exposes Tauri commands to the Angular
frontend, talks to the OpenProject REST API (`/api/v3`), persists local data in SQLite and
runs a small local HTTP server (`ipc.rs`) used by the PocketProject MCP server.

The code is split into layers. Each layer only depends on the layers below it:

```
command  ──►  service  ──►  openproject (HTTP infrastructure)
   │             │
   └─────────────┴──────►  repository (SQLite)
                 all layers use  ──►  model (DTOs / records)
```

## Folder tree

```
src-tauri/src/
├── main.rs                 Binary entry point, calls pocketproject_lib::run()
├── lib.rs                  Module declarations and run(): plugins, setup, generate_handler!
├── ipc.rs                  Local HTTP server for the PocketProject MCP (/ping, /notify, /show)
├── app/                    Application bootstrap
│   ├── setup.rs            Tauri setup hook: IPC server, autostart (release builds only), --minimized, tray
│   ├── tray.rs             System tray icon and menu
│   └── window.rs           Window events (close is delegated to the frontend)
├── command/                Thin #[tauri::command] handlers, one file per domain
│   ├── activity.rs         Local activities, retention purge (purge_synced_activities), AI stats
│   ├── app.rs              exit_app
│   ├── attachment.rs       Attachment preview, download, upload
│   ├── board.rs            Boards, board columns, moving cards
│   ├── config.rs           App configuration, database path
│   ├── connection.rs       Connection test, current user id
│   ├── favorite_ticket.rs  Favorite tickets
│   ├── mcp.rs              MCP client install, AI rules injection, MCP contract/status
│   ├── project.rs          Projects, versions, statuses
│   ├── report.rs           Time-cost report entries
│   ├── statistic.rs        Overview time statistics: cached rollup and refresh from OpenProject
│   ├── ticket.rs           Ticket info and full ticket context
│   ├── time_entry.rs       Time entry activities, create/update time entries
│   └── work_package.rs     Work package form, search, revisions, updates, comments
├── service/                Business logic per domain
│   ├── attachment.rs
│   ├── board.rs            Board discovery and column/query loading
│   ├── board_move.rs       Column move + query order delta (build_query_order_delta)
│   ├── connection.rs
│   ├── mcp.rs              MCP config injection into AI clients, versioned AI rules block per project (registered and refreshed on startup), client/rules status
│   ├── mcp_contract.rs     App <-> pocketproject-mcp contract: protocol version, min MCP version, package spec, single system prompt (resources/mcp/system-prompt.md)
│   ├── project.rs
│   ├── report.rs           Paged time-cost report loading (fetch_time_cost_report_entries fails on HTTP errors; the report command keeps returning [])
│   ├── statistic.rs        Summarises the user's time entries (time-cost report query, user = me) per day/project and refreshes the cache
│   ├── ticket.rs           fetch_ticket_info
│   ├── ticket_context.rs   fetch_ticket_context (description, comments, attachments)
│   ├── time_entry.rs
│   ├── work_package.rs     Status/version updates, search, revisions, update stream, costs
│   └── work_package_edit.rs Edit form schema, field updates, comments
├── openproject/            OpenProject infrastructure (no business decisions)
│   ├── client.rs           HTTP client builder, auth header, redirect-safe attachment request
│   ├── schema.rs           allowedValues / form schema parsing and paged fetching
│   ├── time_entry.rs       Time entry resource parsing
│   ├── url.rs              Base URL sanitising, origin, href resolution
│   └── work_package.rs     Work package hierarchy (descendant ids)
├── repository/             SQLite access, one file per table or aggregate
│   ├── activity.rs         activities table (purge of synced activities older than the retention window)
│   ├── config.rs           app_config table
│   ├── connection.rs       Database path, connection setup, timestamp helper
│   ├── favorite_ticket.rs  favorite_tickets table
│   ├── migration.rs        CREATE TABLE + additive ALTER TABLE migrations
│   └── statistic.rs        time_entry_daily_statistic cache (OpenProject time entries per day/project), unsynced totals, AI counter
└── model/                  DTOs and records (serde shapes = IPC contract)
    ├── activity.rs  attachment.rs  board.rs  config.rs  connection.rs
    ├── favorite_ticket.rs  mcp.rs  project.rs  statistic.rs  ticket.rs  time_entry.rs
    └── work_package.rs
```

## Layer responsibilities

- **`command/`**: the IPC boundary. A command declares the exact argument names and return
  type the frontend (and MCP) rely on and returns `Result<T, String>`. It contains no logic:
  it forwards its arguments to a service function, or, for plain local CRUD, opens a
  connection and calls a repository function.
- **`service/`**: the behaviour of each feature: which OpenProject endpoints are called, in
  what order, fallbacks, and how results are assembled into DTOs. Services may call other
  services (e.g. ticket services fall back to `project::fetch_statuses`).
- **`openproject/`**: reusable infrastructure to talk to OpenProject: HTTP client creation
  (user agent, timeouts), the `Authorization` header (API key vs. bearer token), URL
  normalisation, and parsers for recurring HAL structures. It knows nothing about screens or
  features.
- **`repository/`**: SQLite. `connection::open_connection` opens the database and runs
  `migration::init_tables`; every other module is a set of functions taking `&Connection`.
- **`model/`**: plain data structs with `serde` derives. Field names, `rename_all`, aliases
  and `Option`-ness define the JSON contract with the frontend and the MCP server; change
  them only together with the consumers.
- **`app/`** and **`ipc.rs`**: process-level wiring (setup hook, tray, window events, MCP IPC
  server).

Visibility is `pub(crate)` everywhere; nothing besides `run()` is exported from the crate.
Modules are imported by explicit path (`crate::service::board`), no glob re-exports.

## Adding a new command

1. Add or reuse the DTOs in `model/<domain>.rs` (`#[serde(rename_all = "camelCase")]` for new
   structs, matching the TypeScript interface).
2. Implement the logic in `service/<domain>.rs` as a `pub(crate)` function. Use
   `openproject::url::sanitize_url`, `openproject::client::build_auth_header` and
   `build_http_client` for OpenProject calls; put reusable parsing in `openproject/`.
   For local data, add functions to `repository/<table>.rs` (and a migration in
   `repository/migration.rs` if the schema changes).
3. Add a thin wrapper in `command/<domain>.rs`:

   ```rust
   #[tauri::command]
   pub(crate) async fn fetch_something(url: String, token: String) -> Result<Something, String> {
       something::fetch_something(url, token).await
   }
   ```

   The parameter names are the IPC argument names (Tauri converts them to camelCase on the
   JS side), so pick them deliberately.
4. Register it in `generate_handler!` in `lib.rs` as `domain::fetch_something`.
5. Run `cargo check` (and `cargo clippy`) from `src-tauri/`.

**Rule: commands stay thin.** No HTTP calls, SQL, JSON parsing or branching in `command/`;
if a command grows beyond forwarding its arguments, move that code into a service.

## Known large functions

Some functions were moved verbatim and are still long because splitting them would mean
rewriting their logic: `service::ticket_context::fetch_ticket_context`,
`service::board::fetch_board_columns`, `service::board_move::move_work_package_to_board_column`
and `service::time_entry::fetch_time_entry_activities`. The allowed-status lookup from the work
package form is duplicated in `service::ticket` and `service::ticket_context`, so it is a good
first candidate for a shared helper.

## Resources

- `src-tauri/resources/mcp/system-prompt.md`: the only copy of the AI system prompt. Embedded with `include_str!` in `service/mcp_contract.rs`, published in `mcp-contract.json` on startup and exposed through `get_mcp_contract`. See `docs/MCP_INTEGRATION.md` (sections 4 and 5) for the compatibility contract.
