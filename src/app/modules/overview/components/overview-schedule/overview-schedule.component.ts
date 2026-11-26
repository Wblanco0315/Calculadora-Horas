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
  templateUrl: './overview-schedule.component.html',
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
