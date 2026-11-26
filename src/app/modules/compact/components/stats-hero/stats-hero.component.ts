import { Component, computed, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { SelectButton } from 'primeng/selectbutton';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerTrash } from '@ng-icons/tabler-icons';
import { ActivityService } from '../../../../core/services/activity.service';
import { StorageService } from '../../../../core/services/storage.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

function padZero(val: number): string {
  return String(val).padStart(2, '0');
}

@Component({
  selector: 'app-stats-hero',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonDirective, SelectButton, NgIcon, TranslatePipe],
  viewProviders: [
    provideIcons({
      tablerTrash,
    }),
  ],
  templateUrl: './stats-hero.component.html',
})
export class StatsHeroComponent {
  readonly activityService = inject(ActivityService);
  readonly storageService = inject(StorageService);

  readonly formatOptions = [
    { label: 'HH:MM', value: 'HH:MM' },
    { label: 'DECIMAL', value: 'decimal' },
  ];

  private formatMinutes(totalMins: number): string {
    if (this.activityService.timeFormat() === 'decimal') {
      return (totalMins / 60).toFixed(2);
    }
    const h = Math.floor(totalMins / 60);
    const m = Math.floor(totalMins % 60);
    return `${padZero(h)}h:${padZero(m)}m`;
  }

  readonly formattedTotalNumber = computed<string>(() => {
    return this.formatMinutes(this.activityService.totalMinutes());
  });

  readonly formattedGoal = computed<string>(() => {
    const target = this.storageService.maxDailyMinutes();
    if (this.activityService.timeFormat() === 'decimal') {
      return `${(target / 60).toFixed(2)}h`;
    }
    return this.formatMinutes(target);
  });

  readonly formattedRemaining = computed<string>(() => {
    const diff = Math.max(0, this.storageService.maxDailyMinutes() - this.activityService.totalMinutes());
    if (this.activityService.timeFormat() === 'decimal') {
      return `${(diff / 60).toFixed(2)}h`;
    }
    return this.formatMinutes(diff);
  });

  readonly formattedOvertime = computed<string>(() => {
    const diff = Math.max(0, this.activityService.totalMinutes() - this.storageService.maxDailyMinutes());
    if (this.activityService.timeFormat() === 'decimal') {
      return `${(diff / 60).toFixed(2)}h`;
    }
    return this.formatMinutes(diff);
  });
}
