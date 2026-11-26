import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProgressBar } from 'primeng/progressbar';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerClock, tablerCalendar, tablerCoffee } from '@ng-icons/tabler-icons';
import { StorageService } from '../../../../core/services/storage.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ScheduleService } from '../../../../core/services/schedule.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { formatWorkMinutes } from '../../../../core/interfaces/config.interface';

@Component({
  selector: 'app-overview-summary',
  standalone: true,
  imports: [CommonModule, ProgressBar, NgIcon, TranslatePipe],
  viewProviders: [
    provideIcons({
      tablerClock,
      tablerCalendar,
      tablerCoffee,
    }),
  ],
  templateUrl: './overview-summary.component.html',
})
export class OverviewSummaryComponent {
  private readonly storageService = inject(StorageService);
  private readonly languageService = inject(LanguageService);
  private readonly scheduleService = inject(ScheduleService);

  readonly config = this.storageService.config;
  readonly todaySchedule = this.storageService.todaySchedule;
  readonly maxDailyMinutes = this.storageService.maxDailyMinutes;
  readonly weeklyTotalMinutes = this.storageService.weeklyTotalMinutes;
  readonly workingDaysCount = this.storageService.workingDaysCount;

  readonly todayDayName = computed(() => {
    const today = this.todaySchedule();
    if (!today) return '';
    return this.scheduleService.getDayName(today.day);
  });

  readonly formattedTodayHours = computed(() => {
    const today = this.todaySchedule();
    if (!today || !today.enabled) {
      return this.languageService.t('dashboard.restDay');
    }
    return formatWorkMinutes(this.maxDailyMinutes());
  });

  readonly formattedWeeklyHours = computed(() => {
    return formatWorkMinutes(this.weeklyTotalMinutes());
  });
}
