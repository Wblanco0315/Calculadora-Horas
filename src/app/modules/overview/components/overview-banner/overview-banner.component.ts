import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCalendar, tablerUserCheck } from '@ng-icons/tabler-icons';
import { StorageService } from '../../../../core/services/storage.service';
import { ScheduleService } from '../../../../core/services/schedule.service';
import { LanguageService } from '../../../../core/services/language.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-overview-banner',
  standalone: true,
  imports: [CommonModule, NgIcon, TranslatePipe],
  viewProviders: [
    provideIcons({
      tablerCalendar,
      tablerUserCheck,
    }),
  ],
  template: `
    <div
      id="home"
      class="p-6 rounded-3xl bg-linear-to-br from-primary-500/10 to-slate-100 dark:from-primary-950/40 dark:to-zinc-900 border border-primary-200/50 dark:border-primary-900/40 shadow-xs transition-all"
    >
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <!-- Columna Izquierda: Saludo y Usuario -->
        <div class="space-y-1">
          @if (isLoggedIn()) {
            <h2 class="text-xl sm:text-2xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
              <span>{{ 'dashboard.welcomeUser' | translate: { user: displayUserName() } }}</span>
            </h2>
            <p class="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
              {{ 'dashboard.readyBanner' | translate }}
            </p>
          } @else {
            <h2 class="text-xl sm:text-2xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
              {{ 'dashboard.readyBanner' | translate }}
            </h2>
            <p class="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
              {{ 'dashboard.noTokenHint' | translate }}
            </p>
          }
        </div>

        <!-- Columna Derecha: Día de la semana y Estado -->
        <div class="flex flex-wrap sm:flex-nowrap items-center sm:justify-end gap-2.5">
          <!-- Widget Día de la semana: THU / Jueves -->
          <div
            class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-white/80 dark:bg-zinc-800/80 border border-slate-200/80 dark:border-zinc-700/80 shadow-xs backdrop-blur-xs"
            [title]="currentDayName()"
          >
            <ng-icon name="tablerCalendar" size="1.05rem" class="text-primary-500" />
            <span class="font-mono font-bold text-xs sm:text-sm tracking-wider uppercase text-primary-600 dark:text-primary-400">
              {{ currentDayName() }}
            </span>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class OverviewBannerComponent {
  private readonly storageService = inject(StorageService);
  private readonly scheduleService = inject(ScheduleService);
  private readonly languageService = inject(LanguageService);

  readonly config = this.storageService.config;
  readonly isLoggedIn = this.storageService.isLoggedIn;

  readonly displayUserName = computed(() => {
    return this.storageService.userName() || this.languageService.t('common.userFallback');
  });

  /**
   * Localized name for the current day of the week (e.g. Jueves, Friday)
   */
  readonly currentDayName = computed(() => {
    const currentDay = this.storageService.currentDayOfWeek();
    return this.scheduleService.getDayName(currentDay);
  });
}
