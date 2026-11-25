# Board Module

## Purpose & Responsibility
Recreates OpenProject's Kanban board and ticket detail experience in Full Mode, including editable ticket fields, local vs. platform time entry details, and drag-and-drop moves/reordering between board columns.

## File Structure
- `src/app/modules/board/board.router.ts`: Routes for `/dashboard/boards/:projectId`, `/dashboard/boards/:projectId/:boardId`, and `/dashboard/boards/:projectId/:boardId/tickets/:ticketId`.
- `src/app/modules/board/pages/board.page.ts`: Board page managing board selection, column loading, search/assignee filters, ticket navigation, and optimistic drag-and-drop moves.
- `src/app/modules/board/pages/board.page.html`: Horizontal Kanban board layout with `@defer` + `<p-skeleton>` columns.
- `src/app/modules/board/pages/ticket-detail.page.ts` and `.html`: Full subpage for ticket details, editing, activity, attachments, relations, and platform/local time entry details.
- `src/app/modules/board/components/board-column/board-column.component.ts`: Angular CDK drop list with explicit connections to every board column and ticket move handling.
- `src/app/modules/board/components/board-card/board-card.component.ts`: Angular CDK draggable card with inline status transitions, ticket navigation, and card metadata.
- Board drag positions are persisted through OpenProject's query order endpoint. GUI drops pass the destination index; callers that omit it retain the default first position.

## Reactive State & Services
- Local Signals: `boards`, `selectedBoardId`, `columns`, `statuses`, `searchQuery`, `selectedAssigneeFilter`, `filteredColumns`, `isMovingTicket`, and `moveError`. Ticket route state is derived from route parameters in `TicketDetailPage`.
- Services: `OpenprojectService`, `ActivityService`, `ActivatedRoute`, `Router`.
