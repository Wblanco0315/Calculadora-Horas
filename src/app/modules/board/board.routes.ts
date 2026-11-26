import { Routes } from '@angular/router';
import { BoardListPage } from './pages/board-list/board-list.page';
import { BoardPage } from './pages/board/board.page';
import { TicketDetailPage } from './pages/ticket-detail/ticket-detail.page';

export const boardRoutes: Routes = [
  {
    path: ':projectId/:boardId/tickets/:ticketId',
    component: TicketDetailPage,
  },
  {
    path: ':projectId',
    component: BoardListPage,
  },
  {
    path: ':projectId/:boardId',
    component: BoardPage,
  },
];

/** Direct ticket access (`/dashboard/tickets/:ticketId`), e.g. from the sidebar search, without a board context. */
export const ticketRoutes: Routes = [
  {
    path: ':ticketId',
    component: TicketDetailPage,
  },
];
