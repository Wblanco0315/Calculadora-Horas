import { Routes } from '@angular/router';
import { BoardPage } from './pages/board.page';
import { TicketDetailPage } from './pages/ticket-detail.page';

export const boardRoutes: Routes = [
  {
    path: ':projectId/:boardId/tickets/:ticketId',
    component: TicketDetailPage,
  },
  {
    path: ':projectId',
    component: BoardPage,
  },
  {
    path: ':projectId/:boardId',
    component: BoardPage,
  },
];
