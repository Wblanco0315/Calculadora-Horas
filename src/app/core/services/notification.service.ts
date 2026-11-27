import { Injectable, inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { LanguageService } from './language.service';

type TranslationParams = Record<string, string | number>;

/**
 * Translated toast notifications for user actions. Toasts render wherever a `<p-toast>` is mounted
 * (the dashboard shell); views without one, like the compact window, simply show nothing.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly messageService = inject(MessageService);
  private readonly languageService = inject(LanguageService);

  success(key: string, params?: TranslationParams): void {
    this.show('success', key, params, 3000);
  }

  info(key: string, params?: TranslationParams): void {
    this.show('info', key, params, 3000);
  }

  warn(key: string, params?: TranslationParams): void {
    this.show('warn', key, params, 5000);
  }

  /** Error toast; `detail` (e.g. the API message) is shown untranslated under the summary. */
  error(key: string, detail?: string, params?: TranslationParams): void {
    this.messageService.add({
      severity: 'error',
      summary: this.languageService.t(key, params),
      detail: detail || undefined,
      life: 6000,
    });
  }

  private show(severity: 'success' | 'info' | 'warn', key: string, params: TranslationParams | undefined, life: number): void {
    this.messageService.add({ severity, summary: this.languageService.t(key, params), life });
  }
}
