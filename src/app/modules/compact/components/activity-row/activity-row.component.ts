import { Component, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonDirective } from 'primeng/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerCheck,
  tablerRefresh,
  tablerTrash,
  tablerPencil,
  tablerCopy,
  tablerCloudUpload,
  tablerClock,
  tablerFolder,
  tablerX,
} from '@ng-icons/tabler-icons';
import { Activity } from '../../../../core/interfaces/activity.interface';
import { ActivityService } from '../../../../core/services/activity.service';
import { StorageService } from '../../../../core/services/storage.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

function padZero(val: number): string {
  return String(val).padStart(2, '0');
}

@Component({
  selector: 'app-activity-row',
  standalone: true,
  imports: [CommonModule, ButtonDirective, NgIcon, TranslatePipe],
  viewProviders: [
    provideIcons({
      tablerCheck,
      tablerRefresh,
      tablerTrash,
      tablerPencil,
      tablerCopy,
      tablerCloudUpload,
      tablerClock,
      tablerFolder,
      tablerX,
    }),
  ],
  template: `
    <div
      class="relative transition-all duration-200 group flex items-center gap-2.5 py-2.5 px-3 bg-white dark:bg-zinc-900 hover:bg-slate-50/70 dark:hover:bg-zinc-800/50 border-b border-slate-100 dark:border-zinc-800/80"
      [class.bg-primary-50/30]="activity().selected"
    >
      <!-- Checkbox (Only in selection mode for unsynced activities with ticket) -->
      @if (activityService.isSelectionMode() && !activity().synced && activity().ticket && hasToken()) {
        <div class="shrink-0 flex items-center pr-1">
          <button
            type="button"
            (click)="toggleSelected()"
            class="size-4.5 rounded flex items-center justify-center transition-colors cursor-pointer border"
            [class.bg-primary-500]="activity().selected"
            [class.border-primary-500]="activity().selected"
            [class.text-white]="activity().selected"
            [class.bg-white]="!activity().selected"
            [class.dark:bg-zinc-800]="!activity().selected"
            [class.border-slate-300]="!activity().selected"
            [class.dark:border-zinc-600]="!activity().selected"
          >
            @if (activity().selected) {
              <ng-icon name="tablerCheck" size="0.75rem" />
            }
          </button>
        </div>
      }

      <!-- Accent bar -->
      <div
        class="shrink-0 w-[3px] h-9 rounded-full transition-colors duration-300"
        [class.bg-rose-500]="isConfirmingDelete()"
        [class.dark:bg-rose-400]="isConfirmingDelete()"
        [class.bg-emerald-500]="!isConfirmingDelete() && activity().synced"
        [class.dark:bg-emerald-400]="!isConfirmingDelete() && activity().synced"
        [class.bg-primary-500]="!isConfirmingDelete() && !activity().synced"
        [class.dark:bg-primary-400]="!isConfirmingDelete() && !activity().synced"
      ></div>

      <!-- Main Body -->
      <div class="grow min-w-0 pr-1">
        <!-- Ticket line + Title -->
        <div class="flex items-center gap-1.5 mb-0.5">
          @if (activity().ticket) {
            <span
              class="shrink-0 text-[10px] font-mono text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-zinc-700 font-semibold"
            >
              #{{ activity().ticket }}
            </span>
          }
          <h3
            class="text-xs font-bold uppercase tracking-wide truncate text-primary-600 dark:text-primary-400"
            [title]="activity().name"
          >
            {{ activity().name || ('compact.noDescription' | translate) }}
          </h3>
        </div>

        <!-- Project line -->
        @if (activity().projectName) {
          <div class="flex items-center gap-1">
            <ng-icon name="tablerFolder" size="0.75rem" class="text-primary-500/70 shrink-0" />
            <span
              class="text-[10px] text-slate-400 dark:text-zinc-500 font-medium truncate uppercase tracking-wider"
            >
              {{ activity().projectName }}
            </span>
          </div>
        }
      </div>

      <!-- Right Side: Inline Delete Confirmation OR Normal Time + Actions -->
      @if (isConfirmingDelete()) {
        <!-- Confirm Delete state -->
        <div class="flex flex-col items-end gap-1.5 shrink-0 select-none pr-1">
          <span class="text-[11px] font-medium text-slate-700 dark:text-zinc-300">
            {{ 'compact.deleteQuestion' | translate }}
          </span>
          <div class="flex items-center gap-1.5">
            <button
              pButton
              type="button"
              severity="danger"
              size="small"
              (click)="onConfirmDelete()"
              class="!px-2 !py-0.5 text-[11px] font-bold"
            >
              <ng-icon name="tablerCheck" size="0.8rem" class="mr-0.5" />
              <span>{{ 'compact.accept' | translate }}</span>
            </button>
            <button
              pButton
              type="button"
              severity="secondary"
              variant="outlined"
              size="small"
              (click)="isConfirmingDelete.set(false)"
              class="!px-2 !py-0.5 text-[11px] font-semibold"
            >
              <ng-icon name="tablerX" size="0.8rem" class="mr-0.5" />
              <span>{{ 'compact.cancel' | translate }}</span>
            </button>
          </div>
        </div>
      } @else {
        <!-- Normal Right Side (Time + Action Buttons) -->
        <div class="flex items-center gap-2.5 shrink-0">
          <!-- Time Display -->
          <div
            class="flex items-center gap-1 font-mono font-bold text-xs text-slate-700 dark:text-zinc-200"
          >
            <ng-icon name="tablerClock" size="0.85rem" class="text-slate-400 dark:text-zinc-500" />
            <span>{{ formattedDuration() }}</span>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-0.5 shrink-0">
            <!-- Copy description button -->
            <button
              type="button"
              (click)="copyTaskName()"
              class="cursor-pointer p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              [title]="isCopied() ? ('compact.copied' | translate) : ('compact.copy' | translate)"
            >
              <ng-icon
                [name]="isCopied() ? 'tablerCheck' : 'tablerCopy'"
                [class.text-emerald-500]="isCopied()"
                size="0.95rem"
              />
            </button>

            <!-- Edit button -->
            <button
              type="button"
              (click)="editClicked.emit(activity())"
              class="cursor-pointer p-1.5 rounded-lg text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              [title]="'compact.edit' | translate"
            >
              <ng-icon name="tablerPencil" size="0.95rem" />
            </button>

            <!-- Delete button -->
            <button
              type="button"
              (click)="isConfirmingDelete.set(true)"
              class="cursor-pointer p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
              [title]="'compact.delete' | translate"
            >
              <ng-icon name="tablerTrash" size="0.95rem" />
            </button>

            <!-- Sync button / Synced pill -->
            @if (activity().ticket && hasToken()) {
              @if (activity().synced && !activity().isSyncing) {
                <!-- Synced badge -->
                <button
                  type="button"
                  (click)="syncClicked.emit(activity())"
                  class="cursor-pointer flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors"
                  [title]="'compact.syncedClickResend' | translate"
                >
                  <ng-icon name="tablerCheck" size="0.75rem" strokeWidth="2.5" />
                </button>
              } @else {
                <!-- Unsynced upload button -->
                <button
                  type="button"
                  (click)="syncClicked.emit(activity())"
                  [disabled]="activity().isSyncing"
                  class="cursor-pointer p-1.5 rounded-lg text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                  [title]="activity().isSyncing ? ('compact.syncing' | translate) : ('compact.syncToOpenProject' | translate)"
                >
                  <ng-icon
                    [name]="activity().isSyncing ? 'tablerRefresh' : 'tablerCloudUpload'"
                    [class.animate-spin]="activity().isSyncing"
                    [class.text-primary-500]="activity().isSyncing"
                    size="0.95rem"
                  />
                </button>
              }
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class ActivityRowComponent {
  readonly activityService = inject(ActivityService);
  readonly storageService = inject(StorageService);

  readonly activity = input.required<Activity>();
  readonly editClicked = output<Activity>();
  readonly deleteClicked = output<string>();
  readonly syncClicked = output<Activity>();

  readonly isConfirmingDelete = signal<boolean>(false);
  readonly isCopied = signal<boolean>(false);

  readonly formattedDuration = computed<string>(() => {
    const totalMinutes = this.activity().minutes || 0;
    if (this.activityService.timeFormat() === 'decimal') {
      return `${(totalMinutes / 60).toFixed(2)}h`;
    }
    const h = Math.floor(totalMinutes / 60);
    const m = Math.floor(totalMinutes % 60);
    return `${padZero(h)}h:${padZero(m)}m`;
  });

  readonly hasToken = computed<boolean>(() => {
    return this.storageService.isLoggedIn();
  });

  toggleSelected(): void {
    const act = this.activity();
    this.activityService.updateActivity(act.id, { selected: !act.selected });
  }

  async copyTaskName(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.activity().name);
      this.isCopied.set(true);
      setTimeout(() => {
        this.isCopied.set(false);
      }, 2000);
    } catch (err) {
      console.warn('Copy failed:', err);
    }
  }

  onConfirmDelete(): void {
    this.isConfirmingDelete.set(false);
    this.deleteClicked.emit(this.activity().id);
  }
}
