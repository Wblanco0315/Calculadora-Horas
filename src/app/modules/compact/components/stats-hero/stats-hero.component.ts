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
      class="px-4 py-3 sm:px-8 bg-linear-to-b from-primary-600 to-primary-700 dark:from-primary-950 dark:to-zinc-900 text-[#FAF8F5] shadow-inner shrink-0 select-none transition-colors border-b border-black/10 dark:border-zinc-800"
    >
      <div class="max-w-4xl mx-auto w-full">
        <!-- Top Row: Total Registrado + Meta del Día -->
        <div class="flex justify-between items-baseline mb-1 text-xs">
          <span class="text-[#FAF8F5]/75 font-medium uppercase tracking-wider">
            {{ 'compact.totalRegistered' | translate }}
          </span>
          <div class="h-4 flex items-baseline justify-end text-[#FAF8F5]/75 font-medium">
            @if (activityService.timeFormat() === 'decimal') {
              <span class="animate-timeSwap">
                {{ 'compact.dailyGoal' | translate: { goal: formattedGoal() } }}
              </span>
            } @else {
              <span class="animate-timeSwap">
                {{ 'compact.dailyGoal' | translate: { goal: formattedGoal() } }}
              </span>
            }
          </div>
        </div>

        <!-- Main Row: Big Hours + Reiniciar Button -->
        <div class="flex justify-between items-end gap-2 mb-1">
          <div class="h-10 flex items-baseline select-none">
            @if (activityService.timeFormat() === 'decimal') {
              <div class="flex items-baseline animate-timeSwap">
                <span class="text-4xl font-bold font-mono tracking-tight text-[#FAF8F5] leading-none tabular-nums drop-shadow-xs">
                  {{ formattedTotalNumber() }}
                </span>
                <span class="text-2xl text-[#FAF8F5]/75 ml-1 font-medium leading-none">h</span>
              </div>
            } @else {
              <div class="flex items-baseline animate-timeSwap">
                <span class="text-4xl font-bold font-mono tracking-tight text-[#FAF8F5] leading-none tabular-nums drop-shadow-xs">
                  {{ formattedTotalNumber() }}
                </span>
              </div>
            }
          </div>

          <button
            pButton
            type="button"
            (click)="activityService.openResetModal()"
            severity="danger"
            variant="outlined"
            size="small"
            class="mb-1 !px-2.5 !py-1 !text-[#FAF8F5]/90 !border-white/20 hover:!bg-white/10 hover:!text-rose-200 hover:!border-rose-300/40 text-xs cursor-pointer rounded-lg transition-colors"
            [title]="'compact.resetTitle' | translate"
          >
            <ng-icon name="tablerTrash" size="0.95rem" class="mr-1" />
            <span>{{ 'compact.reset' | translate }}</span>
          </button>
        </div>

        <!-- Format Toggle with PrimeNG SelectButton + Remaining / Overtime -->
        <div class="flex items-center justify-between gap-3 mb-3 mt-2 min-h-[30px]">
          <div class="flex items-center gap-2.5">
            <span class="text-[#FAF8F5]/80 text-xs font-medium tracking-wide uppercase">
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
              styleClass="text-xs stats-format-select"
            />
          </div>

          <!-- Overtime or Remaining status message -->
          <div class="text-xs font-medium tracking-wide text-right flex items-center justify-end h-5">
            @if (activityService.timeFormat() === 'decimal') {
              <span class="animate-timeSwap">
                @if (activityService.totalMinutes() > storageService.maxDailyMinutes()) {
                  <span class="text-amber-200 font-semibold drop-shadow-xs">
                    {{ 'compact.goalAchievedExtras' | translate: { time: formattedOvertime() } }}
                  </span>
                } @else if (activityService.totalMinutes() === storageService.maxDailyMinutes() && storageService.maxDailyMinutes() > 0) {
                  <span class="text-emerald-200 font-semibold drop-shadow-xs">
                    {{ 'compact.goalAchieved' | translate }}
                  </span>
                } @else {
                  <span class="text-[#FAF8F5]/90">
                    {{ 'compact.timeRemaining' | translate: { time: formattedRemaining() } }}
                  </span>
                }
              </span>
            } @else {
              <span class="animate-timeSwap">
                @if (activityService.totalMinutes() > storageService.maxDailyMinutes()) {
                  <span class="text-amber-200 font-semibold drop-shadow-xs">
                    {{ 'compact.goalAchievedExtras' | translate: { time: formattedOvertime() } }}
                  </span>
                } @else if (activityService.totalMinutes() === storageService.maxDailyMinutes() && storageService.maxDailyMinutes() > 0) {
                  <span class="text-emerald-200 font-semibold drop-shadow-xs">
                    {{ 'compact.goalAchieved' | translate }}
                  </span>
                } @else {
                  <span class="text-[#FAF8F5]/90">
                    {{ 'compact.timeRemaining' | translate: { time: formattedRemaining() } }}
                  </span>
                }
              </span>
            }
          </div>
        </div>

        <!-- Thin Progress Bar (faithful to original calculator.vue h-1.5) -->
        <div class="w-full bg-black/25 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
          <div
            class="bg-[#FAF8F5] rounded-full h-1.5 transition-all duration-500 shadow-xs"
            [style.width.%]="activityService.progressPercentage()"
          ></div>
        </div>
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
