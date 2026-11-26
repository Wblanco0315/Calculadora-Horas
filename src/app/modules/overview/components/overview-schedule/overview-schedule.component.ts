import { Component, computed, inject, signal } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCalendar } from '@ng-icons/tabler-icons';
import { StorageService } from '../../../../core/services/storage.service';
import { ScheduleService } from '../../../../core/services/schedule.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { calculateWorkMinutes, formatWorkMinutes, DayOfWeek } from '../../../../core/interfaces/config.interface';
import { ScheduleModalComponent } from '../../modals/schedule-modal/schedule-modal.component';
import { StatisticService } from '../../services/statistic.service';

const SHORT_DAY_KEYS: Record<DayOfWeek, string> = {
  1: 'days.mon',
  2: 'days.tue',
  3: 'days.wed',
  4: 'days.thu',
  5: 'days.fri',
  6: 'days.sat',
  7: 'days.sun',
};

/** Current week at a glance: logged time against each day's target, plus the schedule editor. */
@Component({
  selector: 'app-overview-schedule',
  standalone: true,
  imports: [ButtonDirective, NgIcon, TranslatePipe, ScheduleModalComponent],
  viewProviders: [provideIcons({ tablerCalendar })],
  templateUrl: './overview-schedule.component.html',
})
export class OverviewScheduleComponent {
  private readonly storageService = inject(StorageService);
  private readonly scheduleService = inject(ScheduleService);
  private readonly statisticService = inject(StatisticService);

  readonly isScheduleModalVisible = signal<boolean>(false);

  readonly weeklyTarget = computed(() => formatWorkMinutes(this.storageService.weeklyTotalMinutes()));

  readonly days = computed(() => {
    const logged = this.statisticService.currentWeekMinutes();
    const today = this.storageService.currentDayOfWeek();
    return (this.storageService.config().schedule?.days ?? []).map((day) => {
      const target = day.enabled ? calculateWorkMinutes(day.entry_time, day.exit_time, day.lunch_minutes) : 0;
      const minutes = logged.get(day.day) ?? 0;
      return {
        day: day.day,
        label: SHORT_DAY_KEYS[day.day],
        enabled: day.enabled,
        isToday: day.day === today,
        hours: `${day.entry_time} – ${day.exit_time}`,
        logged: formatWorkMinutes(minutes),
        target: formatWorkMinutes(target),
        progress: target ? Math.min(100, Math.round((minutes / target) * 100)) : 0,
      };
    });
  });

  openScheduleModal(): void {
    this.scheduleService.resetFromCurrentConfig();
    this.isScheduleModalVisible.set(true);
  }
}
