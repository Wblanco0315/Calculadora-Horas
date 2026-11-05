import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { invoke, isTauri } from '@tauri-apps/api/core';
import {
  Activity,
  Project,
  StatusOption,
  TimeEntryActivityType,
  FavoriteTicket,
  TicketInfoResult,
} from '../interfaces/activity.interface';
import { StorageService } from './storage.service';
import { OpenprojectService } from './openproject.service';

const FAVORITES_STORAGE_KEY = 'pocketproject_favorite_tickets';
const TIME_FORMAT_KEY = 'pocketproject_time_format';
const LOCAL_ACTIVITIES_KEY = 'pocketproject_local_activities';
const LEGACY_STORAGE_KEY = 'calculadora_horas_data';
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
  private readonly openprojectService = inject(OpenprojectService);

  readonly activities = signal<Activity[]>([]);
  readonly selectedDate = signal<string>(getTodayDateString());
  readonly projects = signal<Project[]>([]);
  readonly timeEntryActivities = signal<TimeEntryActivityType[]>([]);
  readonly statuses = signal<StatusOption[]>([]);
  readonly favoriteTickets = signal<FavoriteTicket[]>(this.loadStoredFavorites());
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
  } | null>(null);
  readonly showSyncModal = signal<boolean>(false);
  readonly singleSyncActivity = signal<Activity | null>(null);

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
    this.loadActivities(this.selectedDate()).catch((err) => {
      console.warn('Initial activities load failed:', err);
    });

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

  private loadStoredFavorites(): FavoriteTicket[] {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }

        // Migrate legacy favorite tickets from V1 if available
        const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacyRaw) {
          const legacy = JSON.parse(legacyRaw);
          if (Array.isArray(legacy.favoriteTickets) && legacy.favoriteTickets.length > 0) {
            const mapped: FavoriteTicket[] = legacy.favoriteTickets
              .map((f: any) => ({
                ticket: String(f.ticket || '').replace(/^#/, '').trim(),
                title: String(f.title || '').trim(),
                projectId: f.projectId ? String(f.projectId) : undefined,
                projectName: f.projectName ? String(f.projectName) : undefined,
              }))
              .filter((f: FavoriteTicket) => !!f.ticket);

            if (mapped.length > 0) {
              localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(mapped));
              return mapped;
            }
          }
        }
      } catch (e) {
        console.warn('Error loading or migrating stored favorites:', e);
      }
    }
    return [];
  }

  private persistFavorites(favs: FavoriteTicket[]): void {
    this.favoriteTickets.set(favs);
    if (typeof window !== 'undefined') {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favs));
    }
  }

  toggleFavorite(ticket: string, title: string, projectId?: string, projectName?: string): void {
    const cleanTicket = ticket.trim().replace(/^#/, '');
    if (!cleanTicket) return;

    const list = [...this.favoriteTickets()];
    const index = list.findIndex((f) => f.ticket === cleanTicket);
    if (index >= 0) {
      list.splice(index, 1);
    } else {
      list.push({ ticket: cleanTicket, title: title.trim(), projectId, projectName });
    }
    this.persistFavorites(list);
  }

  isFavorite(ticket: string): boolean {
    const cleanTicket = ticket.trim().replace(/^#/, '');
    return this.favoriteTickets().some((f) => f.ticket === cleanTicket);
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

      this.activities.set(resultList);
      this.backfillMissingTitles(resultList).catch(() => {});
    } catch (err) {
      console.error('Error loading activities:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  private normalizeActivity(raw: any): Activity {
    const ticket = raw.ticket ? String(raw.ticket).replace(/^#/, '').trim() : undefined;
    const fav = ticket ? this.favoriteTickets().find((f) => f.ticket === ticket) : undefined;
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
      createdAt: raw.createdAt || raw.created_at || new Date().toISOString(),
    };
  }

  private async backfillMissingTitles(activities: Activity[]): Promise<void> {
    if (!this.storageService.isLoggedIn()) return;
    const toBackfill = activities.filter((a) => a.ticket && !a.ticketTitle);
    if (toBackfill.length === 0) return;

    for (const act of toBackfill) {
      if (!act.ticket) continue;
      try {
        const info = await this.fetchTicketSubject(act.ticket);
        if (info.success && info.subject) {
          await this.updateActivity(act.id, {
            ticketTitle: info.subject,
            projectId: act.projectId || info.project_id || undefined,
            projectName: act.projectName || info.project_name || undefined,
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
  }

  // ──────────────────────────────────────────────
  // OpenProject Integration: Ticket Info & Subir Tiempos
  // ──────────────────────────────────────────────

  /**
   * Fetches ticket subject and details using the dedicated OpenprojectService
   */
  async fetchTicketSubject(ticket: string): Promise<TicketInfoResult> {
    const res = await this.openprojectService.getTicketInfo(ticket);

    // If ticket belongs to a project not yet in our projects list, refresh projects
    if (res.success && res.project_id) {
      const existing = this.projects().find((p) => p.id === res.project_id);
      if (!existing && res.project_name) {
        this.projects.update((current) => [
          ...current,
          { id: res.project_id!, name: res.project_name! },
        ]);
      }
    }

    return res;
  }

  async fetchProjects(): Promise<void> {
    const list = await this.openprojectService.getProjects();
    if (list.length > 0) {
      this.projects.set(list);
    }
  }

  async fetchTimeEntryActivities(ticket?: string): Promise<void> {
    const list = await this.openprojectService.getTimeEntryActivities(ticket);
    if (list.length > 0) {
      this.timeEntryActivities.set(list);
    }
  }

  async fetchStatuses(): Promise<void> {
    const list = await this.openprojectService.getStatuses();
    if (list.length > 0) {
      this.statuses.set(list);
    }
  }

  /**
   * Subir los tiempos: Logs a single activity to OpenProject via OpenprojectService
   */
  async syncActivity(
    id: string,
    activityTypeId?: string
  ): Promise<{ ok: boolean; error?: string }> {
    const act = this.activities().find((a) => a.id === id);
    if (!act || !act.ticket) {
      return { ok: false, error: 'No ticket specified' };
    }

    if (!this.storageService.isLoggedIn()) {
      return { ok: false, error: 'Token de OpenProject no configurado' };
    }

    await this.updateActivity(id, { isSyncing: true, syncError: false, syncSuccess: false });

    const effectiveTypeId = activityTypeId || act.activityTypeId || act.activity_type_id;

    const result = await this.openprojectService.createTimeEntry({
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
      const res = await this.syncActivity(act.id, activityTypeId);
      if (res.ok) {
        successCount++;
      } else {
        failCount++;
      }
    }

    this.isSyncing.set(false);
    this.isSelectionMode.set(false);
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
    const res = await this.openprojectService.updateWorkPackageStatus(act.ticket, newStatusId);

    if (res.ok) {
      await this.updateActivity(activityId, {
        statusId: newStatusId,
        statusName: statusObj?.name || act.statusName,
        statusColor: statusObj?.color || act.statusColor,
      });
      return { ok: true };
    }
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

    const res = await this.openprojectService.updateWorkPackageVersion(act.ticket, newVersionId);
    if (res.ok) {
      await this.updateActivity(activityId, {
        versionId: newVersionId || undefined,
      });
      return { ok: true };
    }
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

    const res = await this.openprojectService.moveWorkPackageToBoardColumn(
      act.ticket,
      targetQueryId,
      act.boardColumnId
    );

    if (res.ok) {
      await this.updateActivity(activityId, {
        boardColumnId: targetQueryId,
      });
      return { ok: true };
    }
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

  closeSyncModal(): void {
    this.showSyncModal.set(false);
    this.singleSyncActivity.set(null);
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
