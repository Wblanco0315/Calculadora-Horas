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
  template: `
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <!-- 1. Today's Schedule Card -->
      <div
        id="today"
        class="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs space-y-3 transition-all hover:border-primary-300 dark:hover:border-primary-800"
      >
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-950 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
            <ng-icon name="tablerClock" size="1.25rem" />
          </div>
          <h3 class="text-sm font-bold text-slate-800 dark:text-zinc-200 tracking-wide">
            {{ 'dashboard.todayGoal' | translate }}
          </h3>
        </div>

        <div>
          <div class="text-xl font-extrabold text-slate-900 dark:text-zinc-100 mt-0.5 font-mono">
            {{ formattedTodayHours() }}
          </div>

          @if (todaySchedule()?.enabled) {
            <div class="mt-3 space-y-1">
              <div class="flex justify-between text-[11px] text-slate-500 dark:text-zinc-400">
                <span>{{ 'dashboard.todayProgress' | translate }}</span>
                <span class="font-bold text-primary-600 dark:text-primary-400">100%</span>
              </div>
              <p-progressbar [value]="100" [showValue]="false" styleClass="h-1.5 rounded-full" />
            </div>
          } @else {
            <div class="text-xs text-amber-600 dark:text-amber-400 mt-2">
              {{ 'dashboard.restDay' | translate }}
            </div>
          }
        </div>
      </div>

      <!-- 2. Weekly Goal Card -->
      <div
        class="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs space-y-3 transition-all hover:border-primary-300 dark:hover:border-primary-800"
      >
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <ng-icon name="tablerCalendar" size="1.25rem" />
          </div>
          <h3 class="text-sm font-bold text-slate-800 dark:text-zinc-200 tracking-wide">
            {{ 'dashboard.weeklySchedule' | translate }}
          </h3>
        </div>

        <div>
          <div class="text-xl font-extrabold text-slate-900 dark:text-zinc-100 mt-0.5 font-mono">
            {{ formattedWeeklyHours() }}
          </div>
          <div class="text-xs text-slate-500 dark:text-zinc-400 mt-2">
            {{ 'dashboard.workingDays' | translate: { days: workingDaysCount() } }}
          </div>
        </div>
      </div>

      <!-- 3. Lunch / Break Card -->
      <div
        class="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs space-y-3 transition-all hover:border-primary-300 dark:hover:border-primary-800"
      >
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <ng-icon name="tablerCoffee" size="1.25rem" />
          </div>
          <h3 class="text-sm font-bold text-slate-800 dark:text-zinc-200 tracking-wide">
            {{ 'setup.schedule.lunchLabel' | translate }}
          </h3>
        </div>

        <div>
          <div class="text-xl font-extrabold text-slate-900 dark:text-zinc-100 mt-0.5 font-mono">
            {{ config().lunch_minutes }} min
          </div>
          <div class="text-xs text-slate-500 dark:text-zinc-400 mt-2">
            {{ 'dashboard.lunchBreak' | translate: { mins: config().lunch_minutes } }}
          </div>
        </div>
      </div>
    </div>
  `,
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
