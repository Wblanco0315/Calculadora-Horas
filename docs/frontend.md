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
- `shared/components/close-confirm-modal`: window close confirmation (compact, dashboard, setup).

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
