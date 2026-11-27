import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideAppInitializer,
  inject,
} from "@angular/core";
import { provideRouter } from "@angular/router";

import { routes } from "./app.routes";
import { providePrimeNG } from 'primeng/config';
import { MessageService } from 'primeng/api';
import Aura from '@primeuix/themes/aura';
import { definePreset, palette } from '@primeuix/themes';
import { StorageService } from './core/services/storage.service';
import { getInitialStoredColor, resolvePrimaryHex } from './core/services/theme.service';
import { PRIMENG_ES } from './shared/lang/primeng-locale';

const initialPrimaryHex = resolvePrimaryHex(getInitialStoredColor());

const DesignSystemPreset = definePreset(Aura, {
  semantic: {
    primary: palette(initialPrimaryHex),
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
    MessageService,
    providePrimeNG({
      theme: {
        preset: DesignSystemPreset,
        options: {
          darkModeSelector: '.dark',
        },
      },
      overlayAppendTo: 'body',
      translation: PRIMENG_ES,
    }),
  ],
};
