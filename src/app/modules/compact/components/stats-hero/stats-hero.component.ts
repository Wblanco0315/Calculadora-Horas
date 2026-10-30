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
  template: `
    <div
      class="p-4 bg-linear-to-b from-primary-500 to-primary-600 dark:from-primary-950 dark:to-zinc-900 text-white shadow-inner shrink-0"
    >
      <!-- Top Row: Total Registrado + Meta del Día -->
      <div class="flex justify-between items-baseline mb-1">
        <span class="text-white/80 text-xs font-medium uppercase tracking-wider">
          {{ 'compact.totalRegistered' | translate }}
        </span>
        <span class="text-white/80 text-xs">
          {{ 'compact.dailyGoal' | translate: { goal: formattedGoal() } }}
        </span>
      </div>

      <!-- Main Row: Big Hours + Reiniciar Button -->
      <div class="flex justify-between items-end gap-2 mb-1">
        <span class="text-4xl font-bold font-mono tracking-tight flex items-baseline min-w-[120px] text-white">
          {{ formattedTotalNumber() }}@if (activityService.timeFormat() === 'decimal') {<span class="text-2xl text-white/80 ml-1 font-medium">h</span>}
        </span>

        <button
          pButton
          type="button"
          (click)="activityService.openResetModal()"
          severity="danger"
          variant="outlined"
          size="small"
          class="mb-1 !px-2.5 !py-1 !text-white !border-white/30 hover:!bg-red-500/80 hover:!border-red-500 text-xs cursor-pointer"
          [title]="'compact.resetTitle' | translate"
        >
          <ng-icon name="tablerTrash" size="0.95rem" class="mr-1" />
          <span>{{ 'compact.reset' | translate }}</span>
        </button>
      </div>

      <!-- Format Toggle with PrimeNG SelectButton + Remaining / Overtime -->
      <div class="flex items-center justify-between gap-3 mb-3 mt-2">
        <div class="flex items-center gap-2.5">
          <span class="text-white/90 text-xs font-medium tracking-wide uppercase">
            {{ 'compact.format' | translate }}
          </span>
          <p-selectbutton
            [options]="formatOptions"
            [ngModel]="activityService.timeFormat()"
            (ngModelChange)="activityService.setTimeFormat($event)"
            optionLabel="label"
            optionValue="value"
            [allowEmpty]="false"
            size="small"
            styleClass="text-xs"
          />
        </div>

        <!-- Overtime or Remaining status message -->
        <div class="text-xs text-white/90 font-medium tracking-wide">
          @if (activityService.totalMinutes() > storageService.maxDailyMinutes()) {
            <span>{{ 'compact.goalAchievedExtras' | translate: { time: formattedOvertime() } }}</span>
          } @else if (activityService.totalMinutes() === storageService.maxDailyMinutes() && storageService.maxDailyMinutes() > 0) {
            <span>{{ 'compact.goalAchieved' | translate }}</span>
          } @else {
            <span>{{ 'compact.timeRemaining' | translate: { time: formattedRemaining() } }}</span>
          }
        </div>
      </div>

      <!-- Thin Progress Bar (faithful to original calculator.vue h-1.5) -->
      <div class="w-full bg-black/20 rounded-full h-1.5 overflow-hidden">
        <div
          class="bg-white rounded-full h-1.5 transition-all duration-500"
          [style.width.%]="activityService.progressPercentage()"
        ></div>
      </div>
    </div>
  `,
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
