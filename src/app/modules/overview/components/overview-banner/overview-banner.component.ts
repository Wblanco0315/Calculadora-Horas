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
  templateUrl: './overview-banner.component.html',
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
