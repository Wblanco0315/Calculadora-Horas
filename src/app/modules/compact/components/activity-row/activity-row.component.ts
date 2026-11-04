import { Component, computed, effect, inject, input, OnDestroy, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonDirective } from 'primeng/button';
import { Popover } from 'primeng/popover';
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
  tablerChevronDown,
  tablerCalendar,
  tablerTag,
  tablerPlayerPlay,
  tablerPlayerPause,
  tablerDotsVertical,
  tablerCategory,
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
  imports: [CommonModule, ButtonDirective, Popover, NgIcon, TranslatePipe],
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
      tablerChevronDown,
      tablerCalendar,
      tablerTag,
      tablerPlayerPlay,
      tablerPlayerPause,
      tablerDotsVertical,
      tablerCategory,
    }),
  ],
  template: `
    <div
      class="relative transition-all duration-200 group bg-white dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800/80"
      [class.bg-primary-50/20]="activity().selected"
    >
      <!-- Main Row Summary (Clickable toggle) -->
      <div
        class="flex items-center gap-2.5 py-2.5 px-3 hover:bg-slate-50/70 dark:hover:bg-zinc-800/50 cursor-pointer select-none transition-colors"
        (click)="toggleExpanded()"
      >
        <!-- Checkbox (Only in selection mode for unsynced activities with ticket) -->
        @if (activityService.isSelectionMode() && !activity().synced && activity().ticket && hasToken()) {
          <div class="shrink-0 flex items-center pr-1">
            <button
              type="button"
              (click)="$event.stopPropagation(); toggleSelected()"
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
          <!-- Project line (Above ticket title) -->
          @if (activity().projectName) {
            <div class="flex items-center gap-1 mb-0.5">
              <ng-icon name="tablerFolder" size="0.75rem" class="text-primary-500/70 shrink-0" />
              <span
                class="text-[10px] text-slate-400 dark:text-zinc-500 font-semibold truncate uppercase tracking-wider"
              >
                {{ activity().projectName }}
              </span>
            </div>
          }

          <!-- Ticket line + Title -->
          <div class="flex items-center gap-1.5">
            @if (activity().ticket) {
              <span
                class="shrink-0 text-[10px] font-mono text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-zinc-700 font-semibold"
              >
                #{{ activity().ticket }}
              </span>
            }
            <h3
              class="text-xs font-bold uppercase tracking-wide truncate text-primary-600 dark:text-primary-400"
              [title]="displayTitle()"
            >
              {{ displayTitle() || ('compact.noDescription' | translate) }}
            </h3>
          </div>
        </div>

        <!-- Right Side: Inline Delete Confirmation OR Stopwatch Controls OR Normal Time + Single Action Menu -->
        @if (isConfirmingDelete()) {
          <!-- Confirm Delete state -->
          <div
            class="flex flex-col items-end gap-1.5 shrink-0 select-none pr-1"
            (click)="$event.stopPropagation()"
          >
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
        } @else if (showStopwatchControls()) {
          <!-- Stopwatch Controls State -->
          <div
            class="flex flex-col items-end gap-1.5 shrink-0 select-none pr-1"
            (click)="$event.stopPropagation()"
          >
            <!-- Running Time Display & Stopwatch Title -->
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                {{ 'compact.stopwatch' | translate }}
              </span>
              <span
                class="font-mono font-bold text-sm text-primary-600 dark:text-primary-400"
                [class.animate-pulse]="activity().timerState === 'running'"
              >
                {{ formattedStopwatchTime() }}
              </span>
            </div>

            <!-- Stopwatch Action Buttons -->
            <div class="flex items-center gap-1.5">
              <!-- Play/Pause Toggle -->
              <button
                pButton
                type="button"
                [severity]="activity().timerState === 'running' ? 'secondary' : 'primary'"
                size="small"
                (click)="toggleTimer()"
                class="!px-2 !py-0.5 text-[11px] font-semibold"
              >
                <ng-icon
                  [name]="activity().timerState === 'running' ? 'tablerPlayerPause' : 'tablerPlayerPlay'"
                  size="0.8rem"
                  class="mr-0.5"
                />
                <span>{{ (activity().timerState === 'running' ? 'compact.pauseTimer' : 'compact.startTimer') | translate }}</span>
              </button>

              <!-- Finish Timer Button -->
              <button
                pButton
                type="button"
                severity="success"
                size="small"
                (click)="finishTimer()"
                class="!px-2 !py-0.5 text-[11px] font-semibold"
              >
                <ng-icon name="tablerCheck" size="0.8rem" class="mr-0.5" />
                <span>{{ 'compact.finishTimer' | translate }}</span>
              </button>

              <!-- Minimize / Back to normal view (continues running in background) -->
              <button
                pButton
                type="button"
                severity="secondary"
                variant="outlined"
                size="small"
                (click)="showStopwatchControls.set(false)"
                class="!px-2 !py-0.5 text-[11px] font-semibold"
                [title]="'compact.backTimer' | translate"
              >
                <span>{{ 'compact.backTimer' | translate }}</span>
              </button>

              <!-- Discard Timer Button -->
              <button
                pButton
                type="button"
                severity="danger"
                variant="text"
                size="small"
                (click)="cancelTimer()"
                class="!px-1.5 !py-0.5 text-[11px]"
                [title]="'compact.cancelTimer' | translate"
              >
                <ng-icon name="tablerTrash" size="0.85rem" />
              </button>
            </div>
          </div>
        } @else {
          <!-- Normal Right Side (Time + Active Stopwatch Pill + Synced Icon + Single Popover Button) -->
          <div class="flex items-center gap-1.5 shrink-0" (click)="$event.stopPropagation()">
            <!-- Active Stopwatch Mini Pill (If running or paused) -->
            @if (activity().timerState === 'running' || activity().timerState === 'paused') {
              <button
                type="button"
                (click)="openStopwatchControls()"
                class="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-colors cursor-pointer border"
                [class.bg-emerald-50]="activity().timerState === 'running'"
                [class.dark:bg-emerald-950/40]="activity().timerState === 'running'"
                [class.text-emerald-600]="activity().timerState === 'running'"
                [class.dark:text-emerald-400]="activity().timerState === 'running'"
                [class.border-emerald-500/30]="activity().timerState === 'running'"
                [class.animate-pulse]="activity().timerState === 'running'"
                [class.bg-amber-50]="activity().timerState === 'paused'"
                [class.dark:bg-amber-950/40]="activity().timerState === 'paused'"
                [class.text-amber-600]="activity().timerState === 'paused'"
                [class.dark:text-amber-400]="activity().timerState === 'paused'"
                [class.border-amber-500/30]="activity().timerState === 'paused'"
                [title]="'compact.stopwatch' | translate"
              >
                <ng-icon
                  [name]="activity().timerState === 'running' ? 'tablerPlayerPlay' : 'tablerPlayerPause'"
                  size="0.75rem"
                />
                <span>{{ formattedStopwatchTime() }}</span>
              </button>
            }

            <!-- Duration Display -->
            <div
              class="flex items-center gap-1 font-mono font-bold text-xs text-slate-700 dark:text-zinc-200"
            >
              <ng-icon name="tablerClock" size="0.85rem" class="text-slate-400 dark:text-zinc-500" />
              <span>{{ formattedDuration() }}</span>
            </div>

            <!-- Compact Synced Check Badge -->
            @if (activity().synced) {
              <span
                class="flex items-center justify-center size-5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                [title]="'compact.syncedClickResend' | translate"
              >
                <ng-icon name="tablerCheck" size="0.75rem" strokeWidth="2.5" />
              </span>
            }

            <!-- Single Action Button (Opens Popover Menu) -->
            <button
              type="button"
              (click)="actionPopover.toggle($event)"
              class="cursor-pointer p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center"
              [title]="'compact.actions' | translate"
            >
              <ng-icon name="tablerDotsVertical" size="1.05rem" />
            </button>

            <!-- PrimeNG Actions Popover -->
            <p-popover #actionPopover [dismissable]="true" appendTo="body" styleClass="p-popover-sm shadow-xl">
              <div class="flex flex-col min-w-[170px] p-1 gap-0.5 text-xs select-none">
                <!-- Cronómetro -->
                @if (!activity().synced) {
                  <button
                    type="button"
                    (click)="actionPopover.hide(); openStopwatchControls()"
                    class="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-left text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer font-medium"
                  >
                    <ng-icon
                      [name]="activity().timerState === 'running' ? 'tablerPlayerPause' : 'tablerPlayerPlay'"
                      size="1rem"
                      class="text-emerald-500 shrink-0"
                    />
                    <span>{{ (activity().timerState === 'running' ? 'compact.pauseTimer' : 'compact.stopwatch') | translate }}</span>
                  </button>
                }

                <!-- Sincronizar a OpenProject -->
                @if (activity().ticket && hasToken()) {
                  <button
                    type="button"
                    (click)="actionPopover.hide(); syncClicked.emit(activity())"
                    [disabled]="activity().isSyncing"
                    class="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-left text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer font-medium disabled:opacity-50"
                  >
                    <ng-icon
                      [name]="activity().isSyncing ? 'tablerRefresh' : (activity().synced ? 'tablerCheck' : 'tablerCloudUpload')"
                      size="1rem"
                      [class.animate-spin]="activity().isSyncing"
                      [class.text-emerald-500]="activity().synced"
                      [class.text-primary-500]="!activity().synced"
                      class="shrink-0"
                    />
                    <span>{{ (activity().synced ? 'compact.syncedClickResend' : 'compact.syncToOpenProject') | translate }}</span>
                  </button>
                }

                <!-- Copiar descripción -->
                @if (activity().name && activity().name.trim()) {
                  <button
                    type="button"
                    (click)="actionPopover.hide(); copyTaskName()"
                    class="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-left text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer font-medium"
                  >
                    <ng-icon name="tablerCopy" size="1rem" class="text-slate-400 shrink-0" />
                    <span>{{ 'compact.copyDescription' | translate }}</span>
                  </button>
                }

                <!-- Ver / Ocultar detalles -->
                <button
                  type="button"
                  (click)="actionPopover.hide(); toggleExpanded()"
                  class="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-left text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer font-medium"
                >
                  <ng-icon
                    name="tablerChevronDown"
                    size="1rem"
                    class="text-slate-400 shrink-0 transition-transform duration-200"
                    [class.rotate-180]="isExpanded()"
                  />
                  <span>{{ (isExpanded() ? 'compact.hideDetails' : 'compact.viewDetails') | translate }}</span>
                </button>

                <!-- Editar actividad -->
                <button
                  type="button"
                  (click)="actionPopover.hide(); editClicked.emit(activity())"
                  class="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-left text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer font-medium"
                >
                  <ng-icon name="tablerPencil" size="1rem" class="text-primary-500 shrink-0" />
                  <span>{{ 'compact.edit' | translate }}</span>
                </button>

                <div class="my-0.5 border-t border-slate-100 dark:border-zinc-800"></div>

                <!-- Eliminar actividad -->
                <button
                  type="button"
                  (click)="actionPopover.hide(); isConfirmingDelete.set(true)"
                  class="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-left text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer font-medium"
                >
                  <ng-icon name="tablerTrash" size="1rem" class="shrink-0" />
                  <span>{{ 'compact.delete' | translate }}</span>
                </button>
              </div>
            </p-popover>
          </div>
        }
      </div>

      <!-- Detail view (Toggle) -->
      @if (isExpanded()) {
        <div
          class="px-3 pb-3 pt-1 border-t border-slate-100/90 dark:border-zinc-800/60"
          (click)="$event.stopPropagation()"
        >
          <div
            class="rounded-xl bg-slate-50/80 dark:bg-zinc-800/40 p-3 border border-slate-200/70 dark:border-zinc-800/80 space-y-2.5"
          >
            <!-- Structured Metadata: Fecha, Estado, Tipo de actividad -->
            <div class="grid grid-cols-3 gap-2 text-[11px]">
              <!-- 1. Fecha -->
              <div class="flex flex-col gap-0.5 min-w-0">
                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 flex items-center gap-1">
                  <ng-icon name="tablerCalendar" size="0.75rem" />
                  {{ 'compact.modal.dateLabel' | translate }}
                </span>
                <span class="font-medium text-slate-700 dark:text-zinc-200 truncate">
                  {{ activity().date || '-' }}
                </span>
              </div>

              <!-- 2. Estado -->
              <div class="flex flex-col gap-0.5 min-w-0">
                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 flex items-center gap-1">
                  <ng-icon name="tablerTag" size="0.75rem" />
                  {{ 'compact.status' | translate }}
                </span>
                <div class="flex items-center gap-1 flex-wrap">
                  @if (activity().statusName) {
                    <span class="font-medium text-slate-700 dark:text-zinc-200 truncate">
                      {{ activity().statusName }}
                    </span>
                  }
                  <span
                    class="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-semibold border"
                    [class.bg-emerald-50]="activity().synced"
                    [class.dark:bg-emerald-950/40]="activity().synced"
                    [class.border-emerald-200]="activity().synced"
                    [class.dark:border-emerald-800/40]="activity().synced"
                    [class.text-emerald-700]="activity().synced"
                    [class.dark:text-emerald-300]="activity().synced"
                    [class.bg-amber-50]="!activity().synced"
                    [class.dark:bg-amber-950/40]="!activity().synced"
                    [class.border-amber-200]="!activity().synced"
                    [class.dark:border-amber-800/40]="!activity().synced"
                    [class.text-amber-700]="!activity().synced"
                    [class.dark:text-amber-300]="!activity().synced"
                  >
                    {{ (activity().synced ? 'compact.statusSynced' : 'compact.statusUnsynced') | translate }}
                  </span>
                </div>
              </div>

              <!-- 3. Tipo de actividad -->
              <div class="flex flex-col gap-0.5 min-w-0">
                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 flex items-center gap-1">
                  <ng-icon name="tablerCategory" size="0.75rem" />
                  {{ 'compact.activityType' | translate }}
                </span>
                <span
                  class="font-medium text-slate-700 dark:text-zinc-200 truncate"
                  [title]="activityTypeOrProject()"
                >
                  {{ activityTypeOrProject() || '-' }}
                </span>
              </div>
            </div>

            <!-- Description (Only rendered if non-empty!) -->
            @if (activity().name && activity().name.trim()) {
              <div class="pt-2 border-t border-slate-200/60 dark:border-zinc-800/60">
                <span class="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-0.5">
                  {{ 'compact.modal.descriptionLabel' | translate }}
                </span>
                <p class="text-xs text-slate-700 dark:text-zinc-200 whitespace-pre-wrap break-words leading-relaxed select-text font-normal">
                  {{ activity().name }}
                </p>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class ActivityRowComponent implements OnDestroy {
  readonly activityService = inject(ActivityService);
  readonly storageService = inject(StorageService);

  readonly activity = input.required<Activity>();
  readonly editClicked = output<Activity>();
  readonly deleteClicked = output<string>();
  readonly syncClicked = output<Activity>();

  readonly isConfirmingDelete = signal<boolean>(false);
  readonly isCopied = signal<boolean>(false);
  readonly isExpanded = signal<boolean>(false);

  // Stopwatch state
  readonly showStopwatchControls = signal<boolean>(false);
  readonly currentTimeTick = signal<number>(Date.now());
  private tickInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    effect(() => {
      const state = this.activity().timerState;
      if (state === 'running') {
        this.startTicking();
        this.showStopwatchControls.set(true);
      } else if (state === 'paused') {
        this.stopTicking();
        this.showStopwatchControls.set(true);
      } else {
        this.stopTicking();
      }
    });
  }

  ngOnDestroy(): void {
    this.stopTicking();
  }

  private startTicking(): void {
    if (this.tickInterval) return;
    this.currentTimeTick.set(Date.now());
    this.tickInterval = setInterval(() => {
      this.currentTimeTick.set(Date.now());
    }, 1000);
  }

  private stopTicking(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  readonly elapsedSeconds = computed<number>(() => {
    const act = this.activity();
    const state = act.timerState;
    const baseSecs = act.timerSeconds || 0;
    if (state === 'running') {
      const now = this.currentTimeTick();
      const started = act.timerLastStarted || now;
      const diff = Math.max(0, Math.floor((now - started) / 1000));
      return baseSecs + diff;
    }
    return baseSecs;
  });

  readonly formattedStopwatchTime = computed<string>(() => {
    const total = this.elapsedSeconds();
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${padZero(h)}:${padZero(m)}:${padZero(s)}`;
  });

  readonly displayTitle = computed<string>(() => {
    const act = this.activity();
    const title = (act.ticketTitle || act.ticket_title || '').trim();
    if (title) return title;

    if (act.ticket) {
      const fav = this.activityService.favoriteTickets().find((f) => f.ticket === act.ticket);
      if (fav?.title?.trim()) return fav.title.trim();
    }

    return act.name?.trim() || '';
  });

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

  readonly activityTypeOrProject = computed<string>(() => {
    const act = this.activity();
    if (act.activityTypeName?.trim()) return act.activityTypeName.trim();
    if (act.activity_type_name?.trim()) return act.activity_type_name.trim();
    const typeId = act.activityTypeId || act.activity_type_id;
    if (typeId) {
      const found = this.activityService.timeEntryActivities().find((t) => String(t.id) === String(typeId));
      if (found) return found.name;
    }
    return act.projectName?.trim() || '';
  });

  openStopwatchControls(): void {
    this.showStopwatchControls.set(true);
    if (this.activity().timerState === 'idle' || !this.activity().timerState) {
      this.toggleTimer();
    }
  }

  async toggleTimer(): Promise<void> {
    const act = this.activity();
    if (act.timerState === 'running') {
      const currentElapsed = this.elapsedSeconds();
      await this.activityService.updateActivity(act.id, {
        timerSeconds: currentElapsed,
        timerState: 'paused',
        timerLastStarted: undefined,
      });
    } else {
      // Pause any other running activity
      const runningAct = this.activityService.activities().find((a) => a.id !== act.id && a.timerState === 'running');
      if (runningAct) {
        const baseSecs = runningAct.timerSeconds || 0;
        const diff = runningAct.timerLastStarted
          ? Math.max(0, Math.floor((Date.now() - runningAct.timerLastStarted) / 1000))
          : 0;
        await this.activityService.updateActivity(runningAct.id, {
          timerState: 'paused',
          timerSeconds: baseSecs + diff,
          timerLastStarted: undefined,
        });
      }

      await this.activityService.updateActivity(act.id, {
        timerState: 'running',
        timerLastStarted: Date.now(),
      });
    }
  }

  async finishTimer(): Promise<void> {
    const act = this.activity();
    const totalSecs = this.elapsedSeconds();
    const currentSeconds = act.seconds !== undefined ? act.seconds : (act.minutes || 0) * 60;
    const finalSeconds = currentSeconds + totalSecs;
    const finalMinutes = Math.max(1, Math.ceil(finalSeconds / 60));

    await this.activityService.updateActivity(act.id, {
      minutes: finalMinutes,
      seconds: finalSeconds,
      timerSeconds: 0,
      timerState: 'idle',
      timerLastStarted: undefined,
    });
    this.showStopwatchControls.set(false);
  }

  async cancelTimer(): Promise<void> {
    const act = this.activity();
    await this.activityService.updateActivity(act.id, {
      timerSeconds: 0,
      timerState: 'idle',
      timerLastStarted: undefined,
    });
    this.showStopwatchControls.set(false);
  }

  toggleExpanded(): void {
    if (this.isConfirmingDelete() || this.showStopwatchControls()) return;
    this.isExpanded.update((v) => !v);
  }

  toggleSelected(): void {
    const act = this.activity();
    this.activityService.updateActivity(act.id, { selected: !act.selected });
  }

  async copyTaskName(): Promise<void> {
    try {
      const textToCopy = this.activity().name?.trim() || this.displayTitle();
      await navigator.clipboard.writeText(textToCopy);
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
