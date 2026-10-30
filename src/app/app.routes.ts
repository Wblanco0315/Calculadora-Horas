import { Routes } from '@angular/router';
import { configGuard, setupGuard } from './core/guards/config.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'compact',
    pathMatch: 'full',
  },
  {
    path: 'compact',
    canActivate: [configGuard],
    loadChildren: () =>
      import('./modules/compact/compact.router').then((m) => m.compactRoutes),
  },
  {
    path: 'setup',
    canActivate: [setupGuard],
    loadChildren: () =>
      import('./modules/setup/setup.router').then((m) => m.setupRoutes),
  },
  {
    path: 'dashboard',
    canActivate: [configGuard],
    loadChildren: () =>
      import('./modules/dashboard/dashboard.router').then((m) => m.dashboardRoutes),
  },
  {
    path: '**',
    redirectTo: 'compact',
  },
];
