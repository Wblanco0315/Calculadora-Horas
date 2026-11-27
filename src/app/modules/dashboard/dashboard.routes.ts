import { Routes } from '@angular/router';
import { DashboardPage } from './pages/dashboard/dashboard.page';

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
          import('../overview/overview.routes').then((m) => m.overviewRoutes),
      },
      {
        path: 'time-entries',
        loadChildren: () =>
          import('../time-entry/time-entry.routes').then((m) => m.timeEntryRoutes),
      },
      {
        path: 'projects',
        loadChildren: () =>
          import('../project/project.routes').then((m) => m.projectRoutes),
      },
      {
        path: 'boards',
        loadChildren: () =>
          import('../board/board.routes').then((m) => m.boardRoutes),
      },
      {
        path: 'tickets',
        loadChildren: () =>
          import('../board/board.routes').then((m) => m.ticketRoutes),
      },
      {
        path: 'reports',
        loadChildren: () =>
          import('../report/report.routes').then((m) => m.reportRoutes),
      },
      {
        path: 'settings',
        loadChildren: () =>
          import('../setting/setting.routes').then((m) => m.settingRoutes),
      },
      {
        path: 'setting',
        redirectTo: 'settings',
        pathMatch: 'full',
      },
    ],
  },
];
