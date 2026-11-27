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
      import('./modules/compact/compact.routes').then((m) => m.compactRoutes),
  },
  {
    path: 'setup',
    canActivate: [setupGuard],
    loadChildren: () =>
      import('./modules/setup/setup.routes').then((m) => m.setupRoutes),
  },
  {
    path: 'dashboard',
    canActivate: [configGuard],
    loadChildren: () =>
      import('./modules/dashboard/dashboard.routes').then((m) => m.dashboardRoutes),
  },
  {
    path: '**',
    redirectTo: 'compact',
  },
];
