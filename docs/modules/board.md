# Board Module

## Purpose & Responsibility
Recreates OpenProject's Kanban board and ticket detail experience in Full Mode, including editable ticket fields, local vs. platform time entry details, and drag-and-drop moves/reordering between board columns.

## File Structure
- `src/app/modules/board/board.router.ts`: Routes for `/dashboard/boards/:projectId`, `/dashboard/boards/:projectId/:boardId`, and `/dashboard/boards/:projectId/:boardId/tickets/:ticketId`.
- `src/app/modules/board/pages/board.page.ts`: Board page managing board selection, column loading, search/assignee filters, ticket navigation, and optimistic drag-and-drop moves.
- `src/app/modules/board/pages/board.page.html`: Horizontal Kanban board layout with `@defer` + `<p-skeleton>` columns.
- `src/app/modules/board/pages/ticket-detail.page.ts` and `.html`: Full-width responsive subpage for ticket details, editing, activity, attachments, relations, and platform/local time entry details. It uses a full-bleed dashboard content area, a scrollable single-column layout on smaller screens, and independently scrollable detail/activity columns on large screens.
- `src/app/modules/board/components/board-column/board-column.component.ts`: Angular CDK drop list with explicit connections to every board column and ticket move handling.
- `src/app/modules/board/components/board-card/board-card.component.ts`: Angular CDK draggable card with inline status transitions, ticket navigation, and card metadata.
- Board drag positions are persisted through OpenProject's query order endpoint. GUI drops pass the destination index; callers that omit it retain the default first position.

## Reactive State & Services
- Local Signals: `boards`, `selectedBoardId`, `columns`, `statuses`, `searchQuery`, `selectedAssigneeFilter`, `filteredColumns`, `isMovingTicket`, and `moveError`. Ticket route state is derived from route parameters in `TicketDetailPage`.
- Services: `OpenprojectService`, `ActivityService`, `ActivatedRoute`, `Router`.
- Clicking spent time opens the full-page report module pre-filtered to the ticket and its descendants. The report table is sortable; only entries whose user ID matches the authenticated OpenProject user can be edited. OpenProject enforces the final edit permission.
- Ticket edit selectors load eligible assignees and responsibles from the work package's `available_assignees` / `available_responsibles` endpoints, with paginated form `allowedValues` as a fallback. If no responsible-specific options are exposed, the responsible selector reuses the work package's available assignees in both web and Tauri runtimes.
- `src/app/core/services/work-package-change.service.ts` reads batched work-package snapshots by ID (`lockVersion` and `updatedAt`) and watches the optional Rails activity update stream. The ticket detail page blocks writes when remote changes are detected and requires an explicit discard-and-refresh action; OpenProject's PATCH `lockVersion` remains the final concurrency guard.

## Rich Text (Description & Comments)
- OpenProject renders images as `/api/v3/attachments/{id}/content`. The webview cannot load those URLs directly: they are relative to the OpenProject base URL and require the API token. `TicketDetailPage.resolveRichContentImages()` first renders the HTML with image sources held in `data-op-pending-src`, then swaps them for authenticated object URLs from `OpenprojectService.resolveInlineAttachmentImages()` (cached per attachment ID). Clicking an image opens it in a `p-dialog` preview.
- `OpenprojectService.resolveHref()` and the Rust `resolve_openproject_href()` resolve root-relative hrefs without duplicating the relative root (e.g. `/openproject`). On redirects to external storage, `fetch_attachment_content` does not forward the `Authorization` header.
- Description and comment editing uses `shared/components/rich-text-editor` (CKEditor 5, same editor as OpenProject's `commonmark-ckeditor-build`) with the GFM `Markdown` data processor, so `description.raw` and comment `raw` values stay CommonMark/GFM. CKEditor is lazy-loaded (`import('ckeditor5')`) and its stylesheet is emitted as the non-injected `ckeditor5.css` bundle (see `angular.json`). It uses `licenseKey: 'GPL'`.
- Pasted, dropped or picked images are uploaded with `POST /api/v3/work_packages/{id}/attachments` (Tauri command `upload_work_package_attachment`, multipart). The editor shows a local object URL and writes the OpenProject `downloadLocation` href back into the markdown before saving.
- Attachments tab: each file has a **Download** button. On desktop, the Tauri command `download_work_package_attachment` fetches the content (shared `request_attachment` helper: authenticated, redirect-safe) and writes it to the OS Downloads folder, sanitizing the name and adding ` (n)` instead of overwriting; a **Show in folder** button then reveals it with the opener plugin's `revealItemInDir`. On the web, `OpenprojectService.downloadAttachment()` triggers a browser download from an object URL.
- Shortcuts: `Ctrl/Cmd + Enter` saves the description or posts the comment; `Esc` cancels description editing.
- The comment composer follows OpenProject: it starts collapsed as a single-line field ("Add a comment. Type @ to notify people"); clicking it opens the editor (`isComposingComment`) with **Discard** (clears the draft) and **Comment** buttons. `Esc` collapses it while keeping the draft, and the collapsed field then reads "Continue your unsent comment".
- Dark theme: CKEditor 49 resolves its derived tokens (`--ck-color-surface-*`, `--ck-color-text-*`, `--ck-color-interactive-*`) on `:root`, so the app overrides the base tokens on `html:root` / `html.dark:root` in `src/styles.css` (element-level overrides would leave the editor white). Content text uses `--ck-content-font-color`, mapped to the base text token so it follows the theme. The comment editor opens at 8rem tall (up to 20rem).
- Icons inside PrimeNG buttons use `pButtonIcon` / `pButtonLabel`; a global `.p-button > ng-icon` rule centers every `ng-icon` placed in a button.
- Mentions: typing `@` in the editor lists the work package's available assignees and responsibles (`TicketDetailPage.mentionUsers`). They are stored with the same markup as OpenProject's editor, `<mention class="mention" data-id="{id}" data-type="user" data-text="@Name">@Name</mention>`, kept as raw HTML by the GFM processor (`keepHtml('mention')`), so OpenProject links the user and sends the mention notification.

## Activity Filters
- The activity tab mirrors OpenProject's options: `activityFilter` (`all`, `changes`, `comments`) and `activityOrder` (`oldestFirst` = newest at the bottom, `newestFirst`). `visibleActivities` hides the comment body or the change details of each journal entry depending on the filter. Both choices persist in `localStorage`.

## Log Time
- Like OpenProject's clock button next to *Spent time*, the ticket detail shows a `tablerClockPlus` button that opens the shared `ActivityFormModalComponent` (from `modules/compact/modals/activity-form-modal`) through `ActivityService.openAddModal()`, preloaded with the ticket ID, subject, project and status. The modal is mounted in `ticket-detail.page.html` with `[showTicketContextButton]="false"`. Saved entries are local activities (pending sync) and appear immediately in the *Local Pending* totals.

## PocketProject Utils
- The last section of the ticket detail main column, `PocketProject Utils`, groups app-specific features that do not exist in OpenProject. It only shows local PocketProject time not yet synced to OpenProject (`pendingLocalActivities`): the pending total plus each pending entry (date, name, duration). OpenProject's own spent time is not repeated there: it lives in the `Spent time` field, which links to the time & cost report, so the page no longer fetches the ticket's platform time entries. The activity tab only shows the OpenProject journal (comments and changes).

## Responsive Field Layout
- Ticket sections use `.ticket-field-grid` / `.ticket-field` (component styles in `ticket-detail.page.ts`) driven by a container query on `.ticket-detail-main`, so the layout follows the main column width instead of the viewport: label above value below 26rem, label and value side by side from 26rem, and two field columns from 44rem. `.ticket-field--wide` spans both columns for list values.

## Route Reuse
- `BoardPage` subscribes to `ActivatedRoute.paramMap` (`applyRoute`) instead of reading the snapshot once, because the component is reused when navigating between boards or projects from the sidebar tree. Changing the board in the page selector updates the URL (`replaceUrl`) so the sidebar highlights the selected board.
- Drop target highlight: `BoardColumnComponent` applies `.board-column--drag-over` (inset `outline` with `outline-offset: -2px` plus a light primary tint) instead of a Tailwind `ring`, because a ring is a `box-shadow` painted outside the column and gets clipped by the board's horizontal scroll container.
