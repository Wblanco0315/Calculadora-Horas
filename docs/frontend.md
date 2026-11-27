# Frontend Architecture

Angular 22 standalone app under `src/app/`, split into `core/`, `modules/` and `shared/` (see `.claude/RULES.md`). This page records where each kind of file belongs and how the OpenProject API layer is organised.

## Placement rules

| What | Where |
|---|---|
| Singleton services, global interfaces, guards, pure utilities | `core/` |
| A component used by one module | `modules/<module>/components/` (or `modals/` for dialogs) |
| A business component used by several modules | the module that owns its domain; the others import it from there |
| A component without business state used by several modules | `shared/components/` |
| Any component or page | its own folder named after it |
| Component layers | separate `.ts` (logic), `.html` (template) and `.css` only when it has its own styles. Exception: a very small component (template of ~20 lines or less, no own styles, little logic) may stay in a single `.ts` with an inline `template`. Pages are always split |
| Module routes | `<module>.routes.ts` at the module root |

Current owners of components shared between modules:

- `modules/time-entry/components/activity-row` and `modules/time-entry/modals/{activity-form,favorites,reset-confirm,sync-confirm}-modal`: activity UI, used by `compact`, `time-entry` and the `board` ticket detail.
- `modules/board/pages/ticket-detail/ticket-detail.page`: also embedded in the time log drawer.
- `core/services/mcp-action.service.ts`: runs the MCP interface actions (`mcp-action` event: open app, mode, views, tickets, comment drafts, upload requests). `core/services/ticket-intent.service.ts` holds the comment drafts and upload requests the ticket detail picks up (the user sends or uploads), and the `ticket_updated` signal that reloads an open ticket. See `docs/MCP_INTEGRATION.md` §6.
- `core/services/mcp-compatibility.service.ts`: app <-> MCP compatibility status (`get_mcp_status`, refreshed on start and on `mcp_hello`), shared by the setup MCP panel and `shared/components/mcp-update-dialog`, which asks the user to update pocketproject-mcp when this app version requires a newer one. Contract types in `core/interfaces/mcp.interface.ts`. See `docs/MCP_INTEGRATION.md` §5.
- `shared/components/window-transition`: cover shown while the window switches between compact and full mode (`WindowService.isTransitioning`).
- `index.html` `#app-loader`: static startup loader (logo + progress bar). An inline script applies the saved theme (`pocketproject_theme`) and accent (`pocketproject_color`) before the first paint; `hideAppLoader()` (`core/utils/app-loader.util.ts`) fades it out once `AppComponent.ngOnInit` has loaded the config and placed the window (also on bootstrap errors).

- `modules/setup/components/settings-panel`: the settings tabs shown by the compact window (`/setup` in edit mode) and the full dashboard (`/dashboard/settings`).

Components used by a single module live in it: `compact/modals/ticket-context-modal`, `setup/components/mcp-section`.

## Core services

```
core/services/
├── openproject/                    # OpenProject API layer (Tauri commands on desktop, fetch on the web)
│   ├── openproject.service.ts      # OpenprojectService: base URL, token, auth headers, runtime detection, href resolution, duration converters, current user
│   ├── work-package-api.service.ts # WorkPackageApiService: ticket info/context, search, revisions, update stream, status/version updates, cost summary
│   ├── work-package-form-api.service.ts # WorkPackageFormApiService: form schema + allowed values, field updates, comments
│   ├── attachment-api.service.ts   # AttachmentApiService: download, content, inline images, uploads
│   ├── project-api.service.ts      # ProjectApiService: projects, statuses, project versions (cached)
│   ├── board-api.service.ts        # BoardApiService: boards, columns, column moves, board containing a ticket (cached)
│   └── time-entry-api.service.ts   # TimeEntryApiService: activities, create/update time entries, cost report, ticket time entries
├── activity.service.ts             # Local activities (SQLite), day navigation, sync to OpenProject, activity modal state
├── favorite.service.ts             # Favorite tickets (SQLite + localStorage mirror, legacy migration)
├── notification.service.ts         # Translated toasts
├── breadcrumb.service.ts           # Ticket label for the dashboard breadcrumb
└── storage, theme, language, schedule, update, window, work-package-change services
```

Dependency direction inside `openproject/`: every domain service depends on `OpenprojectService`; `WorkPackageApiService` also uses `ProjectApiService`, and `BoardApiService` uses `WorkPackageApiService`. Do not add the reverse edges (Angular would fail with a circular DI error).

Inject only the services a component needs (`workPackageApi`, `boardApi`, …) instead of a single catch-all client.

Module-specific services stay in their module: `modules/setup/services/mcp.service.ts` (MCP install, AI rules, local database info, compatibility contract and status; the system prompt is never copied in the frontend) and `modules/setup/services/setup.service.ts`.

The Rust side is described in [`backend.md`](backend.md).

## Window

All main-window behaviour lives in `core/window/` (backend counterpart: `command/window.rs` + `service/window.rs`).

- `window.service.ts` (`WindowService`, the only entry point for components): view mode (`viewMode`, persisted in `pocketproject_view_mode`), `setCompactMode` / `setFullMode` / `returnToCompact`, startup placement (`restoreWindow`), the transition cover (`isTransitioning` → `shared/components/window-transition`), close confirmation, tray, maximize and dragging.
- `window-bounds.service.ts` (`WindowBoundsService`): native geometry. `resize(width, height, { center })` calls the Rust command `resize_window`, which computes the final rectangle and applies it in **one** `SetWindowPos` (keeps the window center, or centers it in the work area, and clamps it to the current monitor). `restorePlacement()` uses `set_window_bounds` + `resize_window`; `setRestoreSize()` uses `set_window_restore_size`. Every move/resize (debounced 400 ms) stores the last normal bounds and maximized state in `pocketproject_window_bounds` (logical px); app-made changes are not tracked while they run.
- `window.constants.ts`: content size per mode (compact 525x800, full 1150x780), storage keys, timings.

Rules:
- **One default size per mode**: un-maximizing (drag, double-click, restore button) always returns to the current mode's size, never to the other mode's. While maximized, `setRestoreSize` (Rust `set_window_restore_size`, `SetWindowPlacement` on Windows) changes the restore rectangle without un-maximizing; `rcNormalPosition` is converted between screen and workspace coordinates with the monitor's work-area offset.
- **Compact → full while maximized**: it stays maximized (only the route changes behind the cover); its restore size becomes the full size.
- **Full → compact while maximized**: un-maximized straight to the compact size, centered in the monitor work area.
- **Mode switch with a normal window**: one native resize to the mode size around the window's own center, on the same monitor. No hide/show and no separate move + resize, so the window does not jump.
- **"Full mode" button** (compact view): resizes to the full size first and then maximizes, so un-maximizing later gives the full size.
- **Compact settings** (`/setup?edit=true`): saving or closing only navigates back to `/compact` (`returnToCompact`).
- **End of onboarding** (`setCompactMode({ reset: true })`): un-maximizes and centers the default compact size.
- **Minimize / close**: the minimize button minimizes to the taskbar (`minimize`). The close button hides the window into the tray (hidden icons, `hideToTray`) and the app keeps running; Rust does the same for Alt+F4 / taskbar close (`app/window.rs`). The app exits only from the tray menu ("Salir"). There is no close confirmation dialog.
- **Single instance**: `tauri-plugin-single-instance` (first plugin in `lib.rs`). Opening the app again (shortcut, autostart) does not start a second process: the running instance's window is restored, shown and focused (`app::window::show_main_window`, also used by the tray).
- **Startup and webview reloads** (Ctrl+Shift+R, behind the `index.html` loader): `restorePlacement` always gives the current mode's default size; only the last place (around the saved center, if it is on a connected monitor) and the maximized state are restored. A reload of a maximized window keeps it maximized (only its restore size is set). Without usable saved bounds the default size is centered. Full mode then opens `/dashboard/overview`.
- **Never resize a maximized window in place**: the Rust `resize_window` / `set_window_bounds` un-maximize first (a `SetWindowPos` on a maximized window leaves the webview offset inside it), and undecorated windows count no frame around the content.
