import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  Activity,
  PlatformTimeEntry,
  Project,
  StatusOption,
  TimeEntryActivityType,
  TicketInfoResult,
} from '../interfaces/activity.interface';
import { StorageService } from './storage.service';
import { NotificationService } from './notification.service';
import { FavoriteService } from './favorite.service';
import { LEGACY_STORAGE_KEY } from '../utils/storage-key.util';
import { isBeforeLocalRetention, localRetentionStart, toDateKey } from '../utils/retention.util';
import { WorkPackageApiService } from './openproject/work-package-api.service';
import { ProjectApiService } from './openproject/project-api.service';
import { BoardApiService } from './openproject/board-api.service';
import { TimeEntryApiService } from './openproject/time-entry-api.service';
import { OpenprojectService } from './openproject/openproject.service';

const TIME_FORMAT_KEY = 'pocketproject_time_format';
const LOCAL_ACTIVITIES_KEY = 'pocketproject_local_activities';
const MIGRATION_ACTIVITIES_KEY = 'pocketproject_activities_migrated';

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

@Injectable({
  providedIn: 'root',
})
export class ActivityService {
  private readonly storageService = inject(StorageService);
  private readonly workPackageApi = inject(WorkPackageApiService);
  private readonly projectApi = inject(ProjectApiService);
  private readonly boardApi = inject(BoardApiService);
  private readonly timeEntryApi = inject(TimeEntryApiService);
  private readonly openprojectService = inject(OpenprojectService);
  private readonly notificationService = inject(NotificationService);
  private readonly favoriteService = inject(FavoriteService);

  readonly activities = signal<Activity[]>([]);
  readonly selectedDate = signal<string>(getTodayDateString());
  readonly projects = signal<Project[]>([]);
  readonly timeEntryActivities = signal<TimeEntryActivityType[]>([]);
  readonly statuses = signal<StatusOption[]>([]);
  readonly timeFormat = signal<'HH:MM' | 'decimal'>(this.loadStoredTimeFormat());

  readonly isLoading = signal<boolean>(false);
  readonly isSyncing = signal<boolean>(false);
  readonly isSelectionMode = signal<boolean>(false);

  // Modals UI state
  readonly showActivityForm = signal<boolean>(false);
  readonly showFavoritesModal = signal<boolean>(false);
  readonly showResetModal = signal<boolean>(false);
  readonly editingActivity = signal<Activity | null>(null);
  readonly presetActivity = signal<{
    ticket?: string;
    title?: string;
    projectId?: string;
    projectName?: string;
    statusId?: string;
    statusName?: string;
    statusColor?: string;
  } | null>(null);
  readonly showSyncModal = signal<boolean>(false);
  readonly singleSyncActivity = signal<Activity | null>(null);
  readonly showTicketContextModal = signal<boolean>(false);
  readonly contextTicket = signal<string | null>(null);
  readonly activeMenuId = signal<string | null>(null);

  openMenu(id: string): void {
    this.activeMenuId.set(id);
  }

  closeMenu(id?: string): void {
    if (!id || this.activeMenuId() === id) {
      this.activeMenuId.set(null);
    }
  }

  /**
   * Whether the currently selected date is today
   */
  readonly isToday = computed<boolean>(() => {
    return this.selectedDate() === getTodayDateString();
  });

  /**
   * Filtered activities for the currently selected date
   */
  readonly dailyActivities = computed<Activity[]>(() => {
    const curDate = this.selectedDate();
    return this.activities().filter((a) => a.date === curDate);
  });

  /**
   * Total minutes recorded today / selected date
   */
  readonly totalMinutes = computed<number>(() => {
    return this.dailyActivities().reduce((acc, act) => acc + (act.minutes || 0), 0);
  });

  /**
   * Progress percentage against today's target
   */
  readonly progressPercentage = computed<number>(() => {
    const target = this.storageService.maxDailyMinutes();
    if (target <= 0) return 0;
    const pct = (this.totalMinutes() / target) * 100;
    return Math.min(100, Math.round(pct));
  });

  /**
   * Activities on selected date that are not yet synced to OpenProject and have a ticket #
   */
  readonly unsyncedActivities = computed<Activity[]>(() => {
    return this.dailyActivities().filter((a) => !a.synced && !!a.ticket);
  });

  /**
   * Manually selected activities for multi-action
   */
  readonly selectedActivities = computed<Activity[]>(() => {
    return this.dailyActivities().filter((a) => a.selected);
  });

  constructor() {
    this.favoriteService.loadFavorites().catch(() => {});
    this.purgeOldActivities()
      .catch((err) => console.warn('Local activity retention cleanup failed:', err))
      .finally(() => {
        this.loadActivities(this.selectedDate()).catch((err) => {
          console.warn('Initial activities load failed:', err);
        });
      });

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => {
        this.loadActivities(this.selectedDate()).catch(() => {});
        this.favoriteService.loadFavorites().catch(() => {});
      });

      // Realtime IPC sync: listen for events emitted from local IPC server when PocketProject MCP makes changes
      if (isTauri()) {
        listen('db-changed', () => {
          this.loadActivities(this.selectedDate()).catch(() => {});
          this.favoriteService.loadFavorites().catch(() => {});
        }).catch((err) => {
          console.warn('Failed to register db-changed listener:', err);
        });
      }
    }

    effect(() => {
      if (this.storageService.isLoggedIn()) {
        if (this.projects().length === 0) {
          this.fetchProjects().catch(() => {});
        }
        if (this.timeEntryActivities().length === 0) {
          this.fetchTimeEntryActivities().catch(() => {});
        }
        if (this.statuses().length === 0) {
          this.fetchStatuses().catch(() => {});
        }
      }
    });
  }

  // ──────────────────────────────────────────────
  // Date Navigation
  // ──────────────────────────────────────────────

  setDate(date: string): void {
    this.selectedDate.set(date);
    this.loadActivities(date).catch(() => {});
  }

  setPreviousDay(): void {
    const d = new Date(this.selectedDate() + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    this.setDate(`${yr}-${mo}-${day}`);
  }

  setNextDay(): void {
    const d = new Date(this.selectedDate() + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    this.setDate(`${yr}-${mo}-${day}`);
  }

  setToday(): void {
    this.setDate(getTodayDateString());
  }

  setTimeFormat(format: 'HH:MM' | 'decimal'): void {
    this.timeFormat.set(format);
    if (typeof window !== 'undefined') {
      localStorage.setItem(TIME_FORMAT_KEY, format);
    }
  }

  private loadStoredTimeFormat(): 'HH:MM' | 'decimal' {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(TIME_FORMAT_KEY);
      if (saved === 'HH:MM' || saved === 'decimal') return saved;
    }
    return 'HH:MM';
  }

  // ──────────────────────────────────────────────
  // CRUD Operations & Persistence
  // ──────────────────────────────────────────────

  async loadActivities(date?: string): Promise<void> {
    this.isLoading.set(true);
    try {
      let resultList: Activity[] = [];
      if (isTauri()) {
        let loaded = await invoke<Activity[]>('get_activities', { date: date || null });

        // If SQLite activities are empty, check if legacy activities need migration
        if ((!loaded || loaded.length === 0) && typeof window !== 'undefined') {
          const migratedFlag = localStorage.getItem(MIGRATION_ACTIVITIES_KEY);
          if (!migratedFlag) {
            await this.migrateLegacyActivities();
            localStorage.setItem(MIGRATION_ACTIVITIES_KEY, 'true');
            loaded = await invoke<Activity[]>('get_activities', { date: date || null });
          }
        }

        resultList = (loaded || []).map((a) => this.normalizeActivity(a));
      } else {
        const raw = localStorage.getItem(LOCAL_ACTIVITIES_KEY);
        let list: Activity[] = raw ? JSON.parse(raw) : [];

        if (list.length === 0 && typeof window !== 'undefined') {
          const migratedFlag = localStorage.getItem(MIGRATION_ACTIVITIES_KEY);
          if (!migratedFlag) {
            list = await this.migrateLegacyActivities();
            localStorage.setItem(MIGRATION_ACTIVITIES_KEY, 'true');
          }
        }

        resultList = list.map((a) => this.normalizeActivity(a));
      }

      // Dates older than the local retention window: show the OpenProject time entries.
      if (date && isBeforeLocalRetention(date)) {
        const platformEntries = await this.loadPlatformEntries(date);
        if (this.selectedDate() !== date) return;
        resultList = [...resultList, ...platformEntries];
      }

      this.activities.set(resultList);
      this.backfillMissingTitles(resultList.filter((a) => !a.readOnly)).catch(() => {});
    } catch (err) {
      console.error('Error loading activities:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Local retention: activities older than `LOCAL_RETENTION_MONTHS` that are already in OpenProject
   * are deleted from this device (their time entries stay in OpenProject). Unsynced activities and
   * running timers are kept.
   */
  private async purgeOldActivities(): Promise<void> {
    const before = toDateKey(localRetentionStart());
    if (isTauri()) {
      await invoke<number>('purge_synced_activities', { before });
      return;
    }
    const raw = typeof window !== 'undefined' ? localStorage.getItem(LOCAL_ACTIVITIES_KEY) : null;
    if (!raw) return;
    const list: Activity[] = JSON.parse(raw);
    const kept = list.filter((a) => !(a.date < before && a.synced && a.timerState !== 'running'));
    if (kept.length !== list.length) localStorage.setItem(LOCAL_ACTIVITIES_KEY, JSON.stringify(kept));
  }

  /** The user's OpenProject time entries of one day, as read-only activities. */
  private async loadPlatformEntries(date: string): Promise<Activity[]> {
    if (!this.storageService.isLoggedIn()) return [];
    const entries = await this.timeEntryApi.getTimeCostReportEntries({
      userId: 'me',
      spentOnFrom: date,
      spentOnTo: date,
    });
    return entries.map((entry) => this.platformEntryToActivity(entry, date));
  }

  private platformEntryToActivity(entry: PlatformTimeEntry, date: string): Activity {
    const minutes = this.openprojectService.isoDurationToMinutes(entry.hours);
    return {
      id: `openproject-${entry.id}`,
      name: entry.comment || entry.workPackageName || entry.activityName || '',
      minutes,
      seconds: minutes * 60,
      date: entry.spentOn || date,
      projectId: entry.projectId || undefined,
      projectName: entry.projectName || undefined,
      ticket: entry.workPackageId || undefined,
      ticketTitle: entry.workPackageName || undefined,
      activityTypeId: entry.activityId || undefined,
      activityTypeName: entry.activityName || undefined,
      synced: true,
      timerSeconds: 0,
      timerState: 'idle',
      createdAt: entry.createdAt,
      readOnly: true,
    };
  }

  private normalizeActivity(raw: any): Activity {
    const ticket = raw.ticket ? String(raw.ticket).replace(/^#/, '').trim() : undefined;
    const fav = ticket ? this.favoriteService.favoriteTickets().find((f) => f.ticket === ticket) : undefined;
    const title = (raw.ticketTitle || raw.ticket_title || fav?.title || '').trim();
    const timerState = (raw.timerState || raw.timer_state || 'idle') as 'idle' | 'running' | 'paused';
    let timerLastStarted = raw.timerLastStarted !== undefined && raw.timerLastStarted !== null
      ? Number(raw.timerLastStarted)
      : (raw.timer_last_started !== undefined && raw.timer_last_started !== null
        ? Number(raw.timer_last_started)
        : undefined);

    if (timerState === 'running' && (!timerLastStarted || isNaN(timerLastStarted))) {
      timerLastStarted = Date.now();
    }

    return {
      id: raw.id,
      name: raw.name || '',
      minutes: Number(raw.minutes) || 0,
      seconds: raw.seconds !== undefined ? Number(raw.seconds) : (Number(raw.minutes) || 0) * 60,
      date: raw.date || getTodayDateString(),
      projectId: raw.projectId || raw.project_id || fav?.projectId || undefined,
      projectName: raw.projectName || raw.project_name || fav?.projectName || undefined,
      ticket: ticket || undefined,
      ticketTitle: title || undefined,
      statusId: raw.statusId || raw.status_id || undefined,
      statusName: raw.statusName || raw.status_name || undefined,
      statusColor: raw.statusColor || raw.status_color || undefined,
      versionId: raw.versionId || raw.version_id || undefined,
      versionName: raw.versionName || raw.version_name || undefined,
      boardId: raw.boardId || raw.board_id || undefined,
      boardColumnId: raw.boardColumnId || raw.board_column_id || undefined,
      boardColumnName: raw.boardColumnName || raw.board_column_name || undefined,
      synced: Boolean(raw.synced),
      selected: Boolean(raw.selected),
      timerSeconds: Number(raw.timerSeconds ?? raw.timer_seconds) || 0,
      timerState,
      timerLastStarted,
      activityTypeId: raw.activityTypeId || raw.activity_type_id || undefined,
      activityTypeName: raw.activityTypeName || raw.activity_type_name || undefined,
      createdByAi: Boolean(raw.createdByAi ?? raw.created_by_ai),
      createdAt: raw.createdAt || raw.created_at || new Date().toISOString(),
    };
  }

  private async backfillMissingTitles(activities: Activity[]): Promise<void> {
    if (!this.storageService.isLoggedIn()) return;
    const toBackfill = activities.filter((a) => a.ticket && (!a.ticketTitle || !a.statusName));
    if (toBackfill.length === 0) return;

    for (const act of toBackfill) {
      if (!act.ticket) continue;
      try {
        const info = await this.fetchTicketSubject(act.ticket);
        if (info.success) {
          await this.updateActivity(act.id, {
            ticketTitle: info.subject || act.ticketTitle,
            projectId: act.projectId || info.project_id || undefined,
            projectName: act.projectName || info.project_name || undefined,
            statusId: act.statusId || info.status_id || undefined,
            statusName: act.statusName || info.status_name || undefined,
            statusColor: act.statusColor || info.status_color || undefined,
          });
        }
      } catch {
        // Silently continue
      }
    }
  }

  private async migrateLegacyActivities(): Promise<Activity[]> {
    if (typeof window === 'undefined') return [];

    try {
      const rawLegacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!rawLegacy) return [];

      const legacy = JSON.parse(rawLegacy);
      if (!Array.isArray(legacy.activities) || legacy.activities.length === 0) return [];

      console.info(`Migrating ${legacy.activities.length} activities from legacy storage...`);
      const migratedList: Activity[] = [];

      for (const item of legacy.activities) {
        const activity: Activity = {
          id: item.id || crypto.randomUUID(),
          name: item.name || '',
          minutes: Number(item.minutes) || 0,
          seconds: item.seconds !== undefined ? Number(item.seconds) : (Number(item.minutes) || 0) * 60,
          date: item.date || getTodayDateString(),
          projectId: item.projectId ? String(item.projectId) : undefined,
          projectName: item.projectName || undefined,
          ticket: item.ticket ? String(item.ticket).replace(/^#/, '').trim() : undefined,
          ticketTitle: item.ticketTitle || undefined,
          statusId: item.statusId ? String(item.statusId) : undefined,
          statusName: item.statusName || undefined,
          statusColor: item.statusColor || undefined,
          versionId: item.versionId ? String(item.versionId) : undefined,
          versionName: item.versionName || undefined,
          synced: Boolean(item.synced),
          selected: false,
          timerSeconds: Number(item.timerSeconds) || 0,
          timerState: item.timerState || 'idle',
          createdAt: item.createdAt || new Date().toISOString(),
        };

        if (isTauri()) {
          try {
            await invoke('save_activity', { activity });
          } catch (e) {
            console.warn('Could not persist migrated legacy activity into SQLite:', e);
          }
        }

        migratedList.push(activity);
      }

      if (!isTauri()) {
        localStorage.setItem(LOCAL_ACTIVITIES_KEY, JSON.stringify(migratedList));
      }

      return migratedList;
    } catch (err) {
      console.warn('Error during legacy activities migration:', err);
      return [];
    }
  }

  async addActivity(data: Omit<Activity, 'id' | 'createdAt'>): Promise<Activity> {
    const isRunning = data.timerState === 'running';
    if (isRunning) {
      const runningAct = this.activities().find((a) => a.timerState === 'running');
      if (runningAct) {
        const baseSecs = runningAct.timerSeconds || 0;
        const diff = runningAct.timerLastStarted
          ? Math.max(0, Math.floor((Date.now() - runningAct.timerLastStarted) / 1000))
          : 0;
        await this.updateActivity(runningAct.id, {
          timerState: 'paused',
          timerSeconds: baseSecs + diff,
          timerLastStarted: undefined,
        });
      }
    }

    const timerLastStarted = isRunning ? (data.timerLastStarted || Date.now()) : undefined;

    const newActivity: Activity = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      synced: false,
      selected: false,
      createdByAi: data.createdByAi ?? false,
      timerState: data.timerState || 'idle',
      timerLastStarted,
    };

    if (isTauri()) {
      await invoke('save_activity', { activity: newActivity });
    } else {
      const current = [...this.activities(), newActivity];
      this.activities.set(current);
      localStorage.setItem(LOCAL_ACTIVITIES_KEY, JSON.stringify(current));
    }

    await this.loadActivities(this.selectedDate());
    return newActivity;
  }

  async updateActivity(id: string, updates: Partial<Activity>): Promise<void> {
    const list = [...this.activities()];
    const index = list.findIndex((a) => a.id === id);
    if (index === -1) return;

    const updated = { ...list[index], ...updates };
    list[index] = updated;

    if (isTauri()) {
      await invoke('save_activity', { activity: updated });
    } else {
      this.activities.set(list);
      localStorage.setItem(LOCAL_ACTIVITIES_KEY, JSON.stringify(list));
    }

    this.activities.set(list);
  }

  async deleteActivity(id: string): Promise<void> {
    if (isTauri()) {
      await invoke('delete_activity', { id });
    } else {
      const list = this.activities().filter((a) => a.id !== id);
      this.activities.set(list);
      localStorage.setItem(LOCAL_ACTIVITIES_KEY, JSON.stringify(list));
    }

    await this.loadActivities(this.selectedDate());
    this.notificationService.success('toast.activityDeleted');
  }

  async clearDay(date: string): Promise<void> {
    if (isTauri()) {
      await invoke('clear_activities', { date });
    } else {
      const list = this.activities().filter((a) => a.date !== date);
      this.activities.set(list);
      localStorage.setItem(LOCAL_ACTIVITIES_KEY, JSON.stringify(list));
    }

    await this.loadActivities(this.selectedDate());
    this.notificationService.success('toast.dayCleared');
  }

  // ──────────────────────────────────────────────
  // OpenProject Integration: Ticket Info & Subir Tiempos
  // ──────────────────────────────────────────────

  /**
   * Fetches ticket subject and details using the dedicated OpenprojectService
   */
  async fetchTicketSubject(ticket: string): Promise<TicketInfoResult> {
    const clean = ticket.trim().replace(/^#/, '');
    if (!clean) {
      return { success: false, message: 'Ticket vacío' };
    }

    // 1. Check local favorite tickets
    const fav = this.favoriteService.favoriteTickets().find((f) => f.ticket.replace(/^#/, '') === clean);
    if (fav && fav.title && fav.projectId) {
      const existing = this.projects().find((p) => p.id === fav.projectId);
      if (!existing) {
        this.projects.update((current) => [
          ...current,
          { id: fav.projectId!, name: fav.projectName || `Proyecto #${fav.projectId}` },
        ]);
      }
    }

    // 2. Query live OpenProject API
    const res = await this.workPackageApi.getTicketInfo(clean);

    if (res.success && res.subject) {
      if (res.project_id) {
        const existing = this.projects().find((p) => p.id === res.project_id);
        if (!existing) {
          this.projects.update((current) => [
            ...current,
            { id: res.project_id!, name: res.project_name || `Proyecto #${res.project_id}` },
          ]);
        }
      }
      return res;
    }

    // 3. Fallback to favorite ticket if OpenProject call did not return a subject
    if (fav && fav.title) {
      return {
        success: true,
        subject: fav.title,
        project_id: fav.projectId,
        project_name: fav.projectName,
        message: 'From favorites',
      };
    }

    // 4. Fallback to past activities history
    const past = this.activities().find(
      (a) => a.ticket && a.ticket.replace(/^#/, '') === clean && a.ticketTitle
    );
    if (past && past.ticketTitle) {
      if (past.projectId) {
        const existing = this.projects().find((p) => p.id === past.projectId);
        if (!existing) {
          this.projects.update((current) => [
            ...current,
            { id: past.projectId!, name: past.projectName || `Proyecto #${past.projectId}` },
          ]);
        }
      }
      return {
        success: true,
        subject: past.ticketTitle,
        project_id: past.projectId,
        project_name: past.projectName,
        message: 'From history',
      };
    }

    return res;
  }

  async fetchProjects(): Promise<void> {
    const list = await this.projectApi.getProjects();
    if (list.length > 0) {
      this.projects.set(list);
    }
  }

  async fetchTimeEntryActivities(ticket?: string): Promise<void> {
    const list = await this.timeEntryApi.getTimeEntryActivities(ticket);
    if (list.length > 0) {
      this.timeEntryActivities.set(list);
    }
  }

  async fetchStatuses(): Promise<void> {
    const list = await this.projectApi.getStatuses();
    if (list.length > 0) {
      this.statuses.set(list);
    }
  }

  /**
   * Subir los tiempos: Logs a single activity to OpenProject via OpenprojectService
   */
  async syncActivity(
    id: string,
    activityTypeId?: string,
    options: { silent?: boolean } = {}
  ): Promise<{ ok: boolean; error?: string }> {
    const act = this.activities().find((a) => a.id === id);
    if (!act || !act.ticket) {
      return { ok: false, error: 'No ticket specified' };
    }

    if (!this.storageService.isLoggedIn()) {
      return { ok: false, error: 'Token de OpenProject no configurado' };
    }

    await this.updateActivity(id, { isSyncing: true, syncError: false, syncSuccess: false });

    // Effective activity type: activity's own assigned type -> passed arg -> fallback to available type
    let effectiveTypeId = act.activityTypeId || act.activity_type_id || activityTypeId;
    if (!effectiveTypeId && this.timeEntryActivities().length > 0) {
      const devType = this.timeEntryActivities().find((t) => t.name.toLowerCase().includes('dev')) || this.timeEntryActivities()[0];
      effectiveTypeId = devType.id;
    }

    const result = await this.timeEntryApi.createTimeEntry({
      ticket: act.ticket,
      minutes: act.minutes,
      date: act.date,
      comment: act.name || 'Registro de tiempo',
      activityTypeId: effectiveTypeId ? String(effectiveTypeId) : undefined,
      projectId: act.projectId || undefined,
    });

    if (result.ok) {
      const typeObj = effectiveTypeId
        ? this.timeEntryActivities().find((t) => String(t.id) === String(effectiveTypeId))
        : undefined;
      await this.updateActivity(id, {
        isSyncing: false,
        synced: true,
        syncSuccess: true,
        selected: false,
        activityTypeId: effectiveTypeId ? String(effectiveTypeId) : undefined,
        activityTypeName: typeObj?.name || act.activityTypeName || undefined,
      });

      setTimeout(() => {
        this.updateActivity(id, { syncSuccess: false });
      }, 3000);

      if (!options.silent) this.notificationService.success('toast.activitySynced', { ticket: act.ticket });
      return { ok: true };
    } else {
      console.error('Sync failed:', result.error);
      await this.updateActivity(id, {
        isSyncing: false,
        syncError: true,
      });

      setTimeout(() => {
        this.updateActivity(id, { syncError: false });
      }, 3500);

      if (!options.silent) this.notificationService.error('toast.activitySyncFailed', result.error, { ticket: act.ticket });

      return { ok: false, error: result.error || 'Error subiendo tiempo a OpenProject' };
    }
  }

  /**
   * Subir los tiempos en bloque: Logs all unsynced (or selected) activities
   */
  async syncAllUnsynced(
    activityTypeId?: string
  ): Promise<{ successCount: number; failCount: number }> {
    const list =
      this.isSelectionMode() && this.selectedActivities().length > 0
        ? this.selectedActivities()
        : this.unsyncedActivities();

    if (list.length === 0) return { successCount: 0, failCount: 0 };

    this.isSyncing.set(true);
    let successCount = 0;
    let failCount = 0;

    for (const act of list) {
      const res = await this.syncActivity(act.id, activityTypeId, { silent: true });
      if (res.ok) {
        successCount++;
      } else {
        failCount++;
      }
    }

    this.isSyncing.set(false);
    this.isSelectionMode.set(false);
    if (failCount === 0) {
      this.notificationService.success('toast.syncAllSuccess', { count: successCount });
    } else {
      this.notificationService.warn('toast.syncAllPartial', { success: successCount, failed: failCount });
    }
    return { successCount, failCount };
  }

  /**
   * Updates work package status on OpenProject and synchronizes local activity
   */
  async updateActivityStatus(
    activityId: string,
    newStatusId: string
  ): Promise<{ ok: boolean; error?: string }> {
    const act = this.activities().find((a) => a.id === activityId);
    if (!act?.ticket) return { ok: false, error: 'No ticket associated' };

    const statusObj = this.statuses().find((s) => s.id === newStatusId);
    const res = await this.workPackageApi.updateWorkPackageStatus(act.ticket, newStatusId);

    if (res.ok) {
      await this.updateActivity(activityId, {
        statusId: newStatusId,
        statusName: statusObj?.name || act.statusName,
        statusColor: statusObj?.color || act.statusColor,
      });
      this.notificationService.success('toast.statusUpdated', { ticket: act.ticket });
      return { ok: true };
    }
    this.notificationService.error('toast.statusUpdateFailed', res.error);
    return res;
  }

  /**
   * Updates work package version on OpenProject and synchronizes local activity
   */
  async updateActivityVersion(
    activityId: string,
    newVersionId: string | null
  ): Promise<{ ok: boolean; error?: string }> {
    const act = this.activities().find((a) => a.id === activityId);
    if (!act?.ticket) return { ok: false, error: 'No ticket associated' };

    const res = await this.workPackageApi.updateWorkPackageVersion(act.ticket, newVersionId);
    if (res.ok) {
      await this.updateActivity(activityId, {
        versionId: newVersionId || undefined,
      });
      this.notificationService.success('toast.versionUpdated', { ticket: act.ticket });
      return { ok: true };
    }
    this.notificationService.error('toast.versionUpdateFailed', res.error);
    return res;
  }

  /**
   * Moves a work package to a board column in OpenProject and updates local activity
   */
  async moveActivityToBoardColumn(
    activityId: string,
    targetQueryId: string
  ): Promise<{ ok: boolean; error?: string }> {
    const act = this.activities().find((a) => a.id === activityId);
    if (!act?.ticket) return { ok: false, error: 'No ticket associated' };

    const res = await this.boardApi.moveWorkPackageToBoardColumn(
      act.ticket,
      targetQueryId,
      act.boardColumnId
    );

    if (res.ok) {
      await this.updateActivity(activityId, {
        boardColumnId: targetQueryId,
      });
      this.notificationService.success('toast.columnUpdated', { ticket: act.ticket });
      return { ok: true };
    }
    this.notificationService.error('toast.columnUpdateFailed', res.error);
    return res;
  }

  // ──────────────────────────────────────────────
  // Modals & UI Helpers
  // ──────────────────────────────────────────────

  openAddModal(preset?: {
    ticket?: string;
    title?: string;
    projectId?: string;
    projectName?: string;
    statusId?: string;
    statusName?: string;
    statusColor?: string;
  }): void {
    this.editingActivity.set(null);
    this.presetActivity.set(preset || null);
    if (this.storageService.isLoggedIn()) {
      this.fetchTimeEntryActivities(preset?.ticket).catch(() => {});
    }
    this.showActivityForm.set(true);
  }

  openFavoritesModal(): void {
    this.showFavoritesModal.set(true);
  }

  closeFavoritesModal(): void {
    this.showFavoritesModal.set(false);
  }

  openEditModal(act: Activity): void {
    this.presetActivity.set(null);
    this.editingActivity.set(act);
    if (this.storageService.isLoggedIn()) {
      this.fetchTimeEntryActivities(act.ticket).catch(() => {});
    }
    this.showActivityForm.set(true);
  }

  closeActivityModal(): void {
    this.showActivityForm.set(false);
    this.editingActivity.set(null);
    this.presetActivity.set(null);
  }

  openResetModal(): void {
    this.showResetModal.set(true);
  }

  closeResetModal(): void {
    this.showResetModal.set(false);
  }

  openSyncModal(singleAct?: Activity): void {
    this.singleSyncActivity.set(singleAct || null);
    if (this.storageService.isLoggedIn()) {
      this.fetchTimeEntryActivities(singleAct?.ticket).catch(() => {});
    }
    this.showSyncModal.set(true);
  }

  /**
   * Opens the send confirmation for activities of one date (MCP `sync_time_entries`): one activity
   * shows its detail; several are selected so the bulk send covers exactly them. Nothing is sent
   * until the user presses Send in the modal.
   */
  async openSyncConfirmation(date: string, ids: string[]): Promise<void> {
    this.selectedDate.set(date);
    await this.loadActivities(date);
    const wanted = this.dailyActivities().filter((a) => ids.includes(a.id) && !a.synced && !!a.ticket);
    if (wanted.length === 0) return;
    if (wanted.length === 1) {
      this.openSyncModal(wanted[0]);
      return;
    }
    for (const act of this.activities()) {
      const selected = wanted.some((w) => w.id === act.id);
      if (Boolean(act.selected) !== selected) await this.updateActivity(act.id, { selected });
    }
    this.isSelectionMode.set(true);
    this.openSyncModal();
  }

  closeSyncModal(): void {
    this.showSyncModal.set(false);
    this.singleSyncActivity.set(null);
  }

  openTicketContextModal(ticket: string): void {
    const clean = ticket.trim().replace(/^#/, '');
    if (!clean) return;
    this.contextTicket.set(clean);
    this.showTicketContextModal.set(true);
  }

  closeTicketContextModal(): void {
    this.showTicketContextModal.set(false);
    this.contextTicket.set(null);
  }

  toggleSelectionMode(): void {
    const next = !this.isSelectionMode();
    this.isSelectionMode.set(next);
    if (!next) {
      this.cancelSelection();
    }
  }

  cancelSelection(): void {
    this.isSelectionMode.set(false);
    this.activities().forEach((a) => {
      if (a.selected) this.updateActivity(a.id, { selected: false });
    });
  }
}
