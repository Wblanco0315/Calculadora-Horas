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
    redirectTo: 'compact',
  },
  {
    path: '**',
    redirectTo: 'compact',
  },
];
