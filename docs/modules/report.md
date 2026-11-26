# Report Module

## Purpose & Responsibility
Provides a full-page time and cost report for OpenProject work packages. It supports filtering by work package (including descendants), project, user ID, time-entry activity, and spent-on date range, plus client-side grouping by date, user, activity, project, or work package. The report can be opened pre-filtered from a ticket's spent-time value.

## File Structure
- `src/app/modules/report/report.routes.ts`: Lazy-loaded dashboard route for reports.
- `src/app/modules/report/pages/time-cost-report/time-cost-report.page.ts`: Filter state, API query orchestration, grouping, aggregate display, report link, and own-entry editing.
- `src/app/modules/report/pages/time-cost-report/time-cost-report.page.html`: Full-page query builder and sortable results table.
- `src/app/core/services/openproject/time-entry-api.service.ts` (`TimeEntryApiService`): Filters and paginates time-entry API queries and resolves descendant work packages.
- `src/app/core/interfaces/openproject.interface.ts`: `TimeCostReportFilter` and time-entry contracts.
- `src-tauri/src/lib.rs`: Tauri implementation of the same filtered query for the desktop app.
- MCP counterpart: `pocketproject-mcp/src/services/openproject.client.ts` and `src/tools/index.ts` expose `get_time_cost_report` using equivalent filters and grouping.

## User Flow & Key Components
- The dashboard navigation opens **Tiempo y costos**.
- Clicking a ticket's spent-time value opens the report with that work package preselected and descendants included; the page receives a `returnUrl` so its back button returns to the originating ticket, preserving the board context.
- Users may add project, user, activity, and date filters and group results by a supported dimension.
- Active filters are serialized into the URL (shareable/bookmarkable query). Browser back/forward reapplies the previous query.
- When a ticket is entered without a project, the page resolves the work package's project so the official cost report link remains available.
- Entries can be edited only when their OpenProject user ID matches the authenticated user; the OpenProject API enforces the final permission.
- OpenProject's standard time-entry API omits per-entry calculated monetary labor costs. The page shows package-level labor/material/overall totals when returned under the current permissions and links to the official descendant-inclusive cost report for its exact per-entry calculations.

## Reactive State & Services
- Signals: report filter values, activity/project options, result entries, group rows, aggregate cost summary, loading/error state, and time-entry edit form state.
- Services: `TimeEntryApiService`, `ProjectApiService`, `WorkPackageApiService`, `OpenprojectService`, `ActivatedRoute`, `Router`, and the corresponding Tauri commands for desktop API access.

## Layout
- Filters use an auto-fill grid (`.report-filter-grid`, min 14rem per column) with every field stacked as label + control; PrimeNG controls use `[fluid]="true"` so selects, date pickers and inputs share the same width and bottom edge. The descendants checkbox and run button share the last cell, aligned to the controls' height.
- The summary bar aligns label/value pairs on a common baseline (`.report-metric`).
- The inline edit row (`.report-edit-grid`) stacks on mobile, uses three columns on medium screens and a single row on wide screens.
- The entries table uses automatic column sizing: each header keeps its full name on one line and the column stretches to fit it, with the label on the left and the sort icon pinned to the right (`.report-th`). Long text cells (user, activity, work package, comment, project, group value) clip at 22rem with an ellipsis and show the full value in the `title` tooltip; hour/count columns are right-aligned. Table text uses 0.75rem.
