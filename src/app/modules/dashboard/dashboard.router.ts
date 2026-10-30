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
