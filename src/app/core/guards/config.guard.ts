import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { StorageService } from '../services/storage.service';

export const configGuard: CanActivateFn = async () => {
  const storageService = inject(StorageService);
  const router = inject(Router);

  let currentConfig = storageService.config();
  if (!storageService.isLoaded()) {
    currentConfig = await storageService.loadConfig();
  }

  if (currentConfig.is_configured) {
    return true;
  }

  return router.createUrlTree(['/setup']);
};

export const setupGuard: CanActivateFn = async (route) => {
  const storageService = inject(StorageService);
  const router = inject(Router);

  let currentConfig = storageService.config();
  if (!storageService.isLoaded()) {
    currentConfig = await storageService.loadConfig();
  }

  const isEditMode = route.queryParamMap.get('edit') === 'true';

  if (!currentConfig.is_configured || isEditMode) {
    return true;
  }

  return router.createUrlTree(['/compact']);
};
