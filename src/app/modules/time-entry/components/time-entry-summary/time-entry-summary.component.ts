import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { SelectButton } from 'primeng/selectbutton';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCloudUpload, tablerTrash } from '@ng-icons/tabler-icons';
import { ActivityService } from '../../../../core/services/activity.service';
import { StorageService } from '../../../../core/services/storage.service';
import { formatTimeMinutes } from '../../../../shared/format/time';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

/** KPI row for the selected day: total, daily goal progress, pending sync and entry count. */
@Component({
  selector: 'app-time-entry-summary',
  standalone: true,
  imports: [FormsModule, ButtonDirective, ButtonIcon, ButtonLabel, SelectButton, NgIcon, TranslatePipe],
  viewProviders: [provideIcons({ tablerCloudUpload, tablerTrash })],
  templateUrl: './time-entry-summary.component.html',
  styleUrl: './time-entry-summary.component.css',
})
export class TimeEntrySummaryComponent {
  readonly activityService = inject(ActivityService);
  readonly storageService = inject(StorageService);

  readonly formatOptions = [
    { label: 'HH:MM', value: 'HH:MM' },
    { label: 'DEC', value: 'decimal' },
  ];

  private readonly selectedDate = computed(() => new Date(`${this.activityService.selectedDate()}T00:00:00`));

  readonly targetMinutes = computed(() => {
    this.storageService.config();
    return this.storageService.targetMinutesFor(this.selectedDate());
  });

  private readonly pendingActivities = computed(() => this.activityService.unsyncedActivities());

  readonly pendingCount = computed(() => this.activityService.unsyncedActivities().length);
  readonly goalReached = computed(() => this.activityService.totalMinutes() >= this.targetMinutes());
  readonly overtimeMinutes = computed(() => Math.max(0, this.activityService.totalMinutes() - this.targetMinutes()));
  readonly progress = computed(() =>
    this.targetMinutes() > 0 ? Math.min(100, Math.round((this.activityService.totalMinutes() / this.targetMinutes()) * 100)) : 0
  );

  readonly total = computed(() => this.format(this.activityService.totalMinutes()));
  readonly target = computed(() => this.format(this.targetMinutes()));
  readonly remaining = computed(() => this.format(Math.max(0, this.targetMinutes() - this.activityService.totalMinutes())));
  readonly overtime = computed(() => this.format(this.overtimeMinutes()));
  readonly pending = computed(() =>
    this.format(this.pendingActivities().reduce((sum, activity) => sum + (activity.minutes || 0), 0))
  );

  private format(minutes: number): string {
    return formatTimeMinutes(minutes, this.activityService.timeFormat());
  }
}
