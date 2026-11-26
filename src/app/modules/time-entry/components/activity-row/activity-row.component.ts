import { Component, computed, effect, inject, input, OnDestroy, output, signal, viewChild } from '@angular/core';
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
  tablerRobot,
  tablerFileText,
} from '@ng-icons/tabler-icons';
import { Activity } from '../../../../core/interfaces/activity.interface';
import { ActivityService } from '../../../../core/services/activity.service';
import { FavoriteService } from '../../../../core/services/favorite.service';
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
      tablerRobot,
      tablerFileText,
    }),
  ],
  templateUrl: './activity-row.component.html',
})
export class ActivityRowComponent implements OnDestroy {
  readonly activityService = inject(ActivityService);
  private readonly favoriteService = inject(FavoriteService);
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

  readonly actionPopover = viewChild<Popover>('actionPopover');

  constructor() {
    effect(() => {
      const activeId = this.activityService.activeMenuId();
      if (activeId !== this.activity().id) {
        this.actionPopover()?.hide();
      }
    });

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
    if (this.activityService.activeMenuId() === this.activity().id) {
      this.activityService.closeMenu(this.activity().id);
    }
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
      const fav = this.favoriteService.favoriteTickets().find((f) => f.ticket === act.ticket);
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

  toggleMenu(event: Event): void {
    event.stopPropagation();
    const popover = this.actionPopover();
    if (!popover) return;

    if (this.activityService.activeMenuId() === this.activity().id) {
      popover.hide();
      this.activityService.closeMenu(this.activity().id);
    } else {
      this.activityService.openMenu(this.activity().id);
      popover.toggle(event);
    }
  }

  onMenuHide(): void {
    if (this.activityService.activeMenuId() === this.activity().id) {
      this.activityService.closeMenu(this.activity().id);
    }
  }

  toggleExpanded(): void {
    this.activityService.closeMenu();
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
