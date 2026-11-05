import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonDirective } from 'primeng/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCalendar } from '@ng-icons/tabler-icons';
import { StorageService } from '../../../../core/services/storage.service';
import { ScheduleService } from '../../../../core/services/schedule.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { calculateWorkMinutes, formatWorkMinutes, DayOfWeek } from '../../../../core/interfaces/config.interface';
import { ScheduleModalComponent } from '../../modals/schedule-modal/schedule-modal.component';

@Component({
  selector: 'app-overview-schedule',
  standalone: true,
  imports: [
    CommonModule,
    ButtonDirective,
    NgIcon,
    TranslatePipe,
    ScheduleModalComponent,
  ],
  viewProviders: [
    provideIcons({
      tablerCalendar,
    }),
  ],
  template: `
    <div
      id="weekly"
      class="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs space-y-4 transition-all"
    >
      <div class="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
        <div>
          <h3 class="text-sm font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
            <ng-icon name="tablerCalendar" size="1.15rem" class="text-primary-500" />
            {{ 'dashboard.weeklyBreakdownTitle' | translate }}
          </h3>
          <p class="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            {{ 'dashboard.weeklyGoalMeta' | translate: { hours: formattedWeeklyHours() } }}
          </p>
        </div>
        <button pButton (click)="openScheduleModal()" variant="text">
          {{ 'dashboard.editScheduleBtn' | translate }}
        </button>
      </div>

      <!-- 7 Days Grid -->
      <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        @for (day of scheduleDays(); track day.day) {
        <div
          class="p-3.5 rounded-2xl border text-center transition-all flex flex-col justify-between"
          [class.border-primary-500]="day.day === todaySchedule()?.day && day.enabled"
          [class.ring-2]="day.day === todaySchedule()?.day && day.enabled"
          [class.ring-primary-500/20]="day.day === todaySchedule()?.day && day.enabled"
          [class.dark:border-primary-500]="day.day === todaySchedule()?.day && day.enabled"
          [class.bg-primary-50/50]="day.day === todaySchedule()?.day && day.enabled"
          [class.dark:bg-primary-950/30]="day.day === todaySchedule()?.day && day.enabled"
          [class.border-slate-200]="day.day !== todaySchedule()?.day && day.enabled"
          [class.dark:border-zinc-800]="day.day !== todaySchedule()?.day && day.enabled"
          [class.bg-slate-50/60]="day.day !== todaySchedule()?.day && day.enabled"
          [class.dark:bg-zinc-800/60]="day.day !== todaySchedule()?.day && day.enabled"
          [class.border-slate-100]="!day.enabled"
          [class.dark:border-zinc-800/40]="!day.enabled"
          [class.bg-slate-100/30]="!day.enabled"
          [class.dark:bg-zinc-900/40]="!day.enabled"
          [class.opacity-60]="!day.enabled"
        >
          <div>
            <div class="flex items-center justify-between gap-1 mb-1">
              <span class="text-xs font-bold text-slate-800 dark:text-zinc-200">
                {{ (getDayKey(day.day) | translate) || day.name }}
              </span>
            </div>

            @if (day.enabled) {
            <div class="text-sm font-extrabold text-primary-600 dark:text-primary-400 my-1">
              {{ formatMinutes(calcDayMinutes(day.entry_time, day.exit_time, day.lunch_minutes)) }}
            </div>
            <div class="text-[10px] text-slate-500 dark:text-zinc-400 font-mono">
              {{ day.entry_time }} – {{ day.exit_time }}
            </div>
            <div class="text-[9px] text-slate-400 mt-0.5">
              {{ 'dashboard.lunchBreak' | translate: { mins: day.lunch_minutes } }}
            </div>
            } @else {
            <div class="text-xs text-slate-400 italic my-2">
              {{ 'dashboard.restDay' | translate }}
            </div>
            }
          </div>
        </div>
        }
      </div>
    </div>

    <!-- Edit Schedule Modal -->
    <app-schedule-modal [(visible)]="isScheduleModalVisible" />
  `,
})
export class OverviewScheduleComponent {
  private readonly storageService = inject(StorageService);
  private readonly scheduleService = inject(ScheduleService);

  readonly isScheduleModalVisible = signal<boolean>(false);

  readonly config = this.storageService.config;
  readonly todaySchedule = this.storageService.todaySchedule;
  readonly weeklyTotalMinutes = this.storageService.weeklyTotalMinutes;

  readonly schedule = computed(() => this.config().schedule);
  readonly scheduleDays = computed(() => this.schedule()?.days || []);

  readonly formattedWeeklyHours = computed(() => {
    return formatWorkMinutes(this.weeklyTotalMinutes());
  });

  getDayKey(day: DayOfWeek): string {
    return this.scheduleService.getDayKey(day);
  }

  formatMinutes(mins: number): string {
    return formatWorkMinutes(mins);
  }

  calcDayMinutes(entry: string, exit: string, lunch: number): number {
    return calculateWorkMinutes(entry, exit, lunch);
  }

  openScheduleModal(): void {
    this.scheduleService.resetFromCurrentConfig();
    this.isScheduleModalVisible.set(true);
  }
}
