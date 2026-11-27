import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCalendar, tablerRefresh } from '@ng-icons/tabler-icons';
import { ButtonDirective } from 'primeng/button';
import { StatisticService } from '../../services/statistic.service';
import { StorageService } from '../../../../core/services/storage.service';
import { ScheduleService } from '../../../../core/services/schedule.service';
import { LanguageService } from '../../../../core/services/language.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-overview-banner',
  standalone: true,
  imports: [CommonModule, ButtonDirective, NgIcon, TranslatePipe],
  viewProviders: [
    provideIcons({
      tablerCalendar,
      tablerRefresh,
    }),
  ],
  templateUrl: './overview-banner.component.html',
})
export class OverviewBannerComponent {
  private readonly storageService = inject(StorageService);
  private readonly scheduleService = inject(ScheduleService);
  private readonly languageService = inject(LanguageService);

  readonly config = this.storageService.config;
  readonly isLoggedIn = this.storageService.isLoggedIn;

  private readonly statisticService = inject(StatisticService);

  readonly isRefreshing = this.statisticService.isRefreshing;

  /** Tooltip of the refresh button: action plus the time of the last OpenProject refresh. */
  readonly refreshTitle = computed(() => {
    const refreshedAt = this.statisticService.refreshedAt();
    const action = this.languageService.t('overview.refresh');
    if (!refreshedAt) return action;
    const time = new Intl.DateTimeFormat(this.languageService.currentLang(), {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(refreshedAt));
    return `${action} · ${this.languageService.t('overview.refreshedAt', { time })}`;
  });

  refresh(): void {
    void this.statisticService.refresh();
  }

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
