import { Routes } from '@angular/router';
import { DashboardPage } from './pages/dashboard.page';

export const dashboardRoutes: Routes = [
  {
    path: '',
    component: DashboardPage,
    children: [
      {
        path: '',
        redirectTo: 'overview',
        pathMatch: 'full',
      },
      {
        path: 'overview',
        loadChildren: () =>
          import('../overview/overview.router').then((m) => m.overviewRoutes),
      },
      {
        path: 'projects',
        loadChildren: () =>
          import('../project/project.router').then((m) => m.projectRoutes),
      },
      {
        path: 'boards',
        loadChildren: () =>
          import('../board/board.router').then((m) => m.boardRoutes),
      },
      {
        path: 'tickets',
        loadChildren: () =>
          import('../board/board.router').then((m) => m.ticketRoutes),
      },
      {
        path: 'reports',
        loadChildren: () =>
          import('../report/report.router').then((m) => m.reportRoutes),
      },
      {
        path: 'settings',
        loadChildren: () =>
          import('../setting/setting.router').then((m) => m.settingRoutes),
      },
      {
        path: 'setting',
        redirectTo: 'settings',
        pathMatch: 'full',
      },
    ],
  },
];
