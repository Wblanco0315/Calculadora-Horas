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
  template: `
    <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
      <!-- Total -->
      <article class="flex min-w-0 flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div class="flex items-center justify-between gap-2">
          <span class="summary-label">{{ 'compact.totalRegistered' | translate }}</span>
          <p-selectbutton
            [options]="formatOptions"
            [ngModel]="activityService.timeFormat()"
            (ngModelChange)="activityService.setTimeFormat($event)"
            optionLabel="label"
            optionValue="value"
            [allowEmpty]="false"
            size="small"
          />
        </div>
        <div class="flex items-center justify-between gap-2">
          <p class="summary-value text-slate-900 dark:text-zinc-50">{{ total() }}</p>
          @if (activityService.dailyActivities().length > 0) {
            <button
              pButton
              type="button"
              size="small"
              variant="text"
              severity="danger"
              class="shrink-0"
              (click)="activityService.openResetModal()"
              [title]="'compact.resetTitle' | translate"
            >
              <ng-icon pButtonIcon name="tablerTrash" size="0.95rem" />
              <span pButtonLabel>{{ 'compact.reset' | translate }}</span>
            </button>
          }
        </div>
      </article>

      <!-- Daily goal -->
      <article class="flex min-w-0 flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <span class="summary-label">{{ 'timeEntry.dailyGoal' | translate }}</span>
        @if (targetMinutes() > 0) {
          <p class="summary-value text-slate-900 dark:text-zinc-50">{{ target() }}</p>
          <div class="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
            <div
              class="h-full rounded-full transition-all duration-500"
              [class.bg-primary-500]="!goalReached()"
              [class.bg-emerald-500]="goalReached()"
              [style.width.%]="progress()"
            ></div>
          </div>
          <p class="text-xs" [class.text-emerald-600]="goalReached()" [class.dark:text-emerald-400]="goalReached()"
            [class.text-slate-500]="!goalReached()" [class.dark:text-zinc-400]="!goalReached()">
            @if (overtimeMinutes() > 0) {
              {{ 'compact.goalAchievedExtras' | translate: { time: overtime() } }}
            } @else if (goalReached()) {
              {{ 'compact.goalAchieved' | translate }}
            } @else {
              {{ 'compact.timeRemaining' | translate: { time: remaining() } }}
            }
          </p>
        } @else {
          <p class="summary-value text-slate-400 dark:text-zinc-500">—</p>
          <p class="text-xs text-slate-500 dark:text-zinc-400">{{ 'timeEntry.dayOff' | translate }}</p>
        }
      </article>

      <!-- Pending sync -->
      <article class="flex min-w-0 flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <span class="summary-label">{{ 'timeEntry.pendingSync' | translate }}</span>
        <div class="flex items-center justify-between gap-2">
          <p class="summary-value" [class.text-amber-600]="pendingCount() > 0" [class.dark:text-amber-400]="pendingCount() > 0"
            [class.text-slate-400]="pendingCount() === 0" [class.dark:text-zinc-500]="pendingCount() === 0">
            {{ pending() }}
          </p>
          @if (pendingCount() > 0 && storageService.isLoggedIn() && !activityService.isSelectionMode()) {
            <button
              pButton
              type="button"
              size="small"
              class="shrink-0"
              [loading]="activityService.isSyncing()"
              [disabled]="activityService.isSyncing()"
              (click)="activityService.openSyncModal()"
              [title]="'compact.syncAllTitle' | translate"
            >
              <ng-icon pButtonIcon name="tablerCloudUpload" size="1rem" />
              <span pButtonLabel>{{ 'timeEntry.syncAll' | translate }}</span>
            </button>
          }
        </div>
        <p class="text-xs text-slate-500 dark:text-zinc-400">
          {{ 'timeEntry.entriesCount' | translate: { count: pendingCount() } }}
        </p>
      </article>

    </div>
  `,
  styles: `
    .summary-label {
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--p-text-muted-color);
    }

    .summary-value {
      font-family: var(--font-mono, ui-monospace, monospace);
      font-size: 1.75rem;
      font-weight: 700;
      line-height: 2rem;
      font-variant-numeric: tabular-nums;
    }
  `,
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
