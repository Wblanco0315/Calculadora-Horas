import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideAppInitializer,
  inject,
} from "@angular/core";
import { provideRouter } from "@angular/router";

import { routes } from "./app.routes";
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';
import { definePreset, palette } from '@primeuix/themes';
import { StorageService } from './core/services/storage.service';

const DesignSystemPreset = definePreset(Aura, {
  semantic: {
    primary: palette('#5E4DA2'),
  },
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAppInitializer(() => {
      const storageService = inject(StorageService);
      return storageService.loadConfig();
    }),
    provideRouter(routes),
    providePrimeNG({
      theme: {
        preset: DesignSystemPreset,
        options: {
          darkModeSelector: '.dark',
        },
      },
      overlayAppendTo: 'body',
    }),
  ],
};
