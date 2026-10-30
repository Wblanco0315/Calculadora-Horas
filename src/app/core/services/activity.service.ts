import { Injectable, signal, computed, inject } from '@angular/core';
import { invoke, isTauri } from '@tauri-apps/api/core';
import {
  Activity,
  Project,
  TimeEntryActivityType,
  FavoriteTicket,
  TicketInfoResult,
} from '../interfaces/activity.interface';
import { StorageService } from './storage.service';

const FAVORITES_STORAGE_KEY = 'pocketproject_favorite_tickets';
const TIME_FORMAT_KEY = 'pocketproject_time_format';
const LOCAL_ACTIVITIES_KEY = 'pocketproject_local_activities';

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

  readonly activities = signal<Activity[]>([]);
  readonly selectedDate = signal<string>(getTodayDateString());
  readonly projects = signal<Project[]>([]);
  readonly timeEntryActivities = signal<TimeEntryActivityType[]>([]);
  readonly favoriteTickets = signal<FavoriteTicket[]>(this.loadStoredFavorites());
  readonly timeFormat = signal<'HH:MM' | 'decimal'>(this.loadStoredTimeFormat());

  readonly isLoading = signal<boolean>(false);
  readonly isSyncing = signal<boolean>(false);
  readonly isSelectionMode = signal<boolean>(false);

  // Modals state
  readonly showActivityForm = signal<boolean>(false);
  readonly showFavoritesModal = signal<boolean>(false);
  readonly showResetModal = signal<boolean>(false);
  readonly editingActivity = signal<Activity | null>(null);
  readonly presetActivity = signal<{ ticket?: string; title?: string; projectId?: string; projectName?: string } | null>(null);
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

    // Also fetch projects and time entry activities if configured
    if (this.storageService.isLoggedIn()) {
      this.fetchProjects().catch(() => {});
      this.fetchTimeEntryActivities().catch(() => {});
    }
  }

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
        if (raw) return JSON.parse(raw);
      } catch {}
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
  // CRUD Operations
  // ──────────────────────────────────────────────

  async loadActivities(date?: string): Promise<void> {
    this.isLoading.set(true);
    try {
      if (isTauri()) {
        const loaded = await invoke<Activity[]>('get_activities', { date: date || null });
        this.activities.set(loaded || []);
      } else {
        // LocalStorage fallback
        const raw = localStorage.getItem(LOCAL_ACTIVITIES_KEY);
        const list: Activity[] = raw ? JSON.parse(raw) : [];
        this.activities.set(list);
      }
    } catch (err) {
      console.error('Error loading activities:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  async addActivity(data: Omit<Activity, 'id' | 'createdAt'>): Promise<Activity> {
    const newActivity: Activity = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      synced: false,
      selected: false,
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
  // OpenProject API Integration
  // ──────────────────────────────────────────────

  async fetchTicketSubject(ticket: string): Promise<TicketInfoResult> {
    const cleanTicket = ticket.trim().replace(/^#/, '');
    if (!cleanTicket) {
      return { success: false, message: 'Ticket vacío' };
    }

    const cfg = this.storageService.config();
    if (isTauri()) {
      return await invoke<TicketInfoResult>('fetch_ticket_info', {
        url: cfg.openproject_url || '',
        token: cfg.openproject_token || '',
        ticket: cleanTicket,
      });
    }

    return {
      success: true,
      subject: `Ticket #${cleanTicket} (Simulado)`,
      project_name: 'Proyecto Principal',
      message: 'OK',
    };
  }

  async fetchProjects(): Promise<void> {
    const cfg = this.storageService.config();
    if (!cfg.openproject_token?.trim()) return;

    try {
      if (isTauri()) {
        const res = await invoke<Project[]>('fetch_openproject_projects', {
          url: cfg.openproject_url || '',
          token: cfg.openproject_token || '',
        });
        if (res && res.length) {
          this.projects.set(res);
        }
      }
    } catch (err) {
      console.warn('Could not fetch OpenProject projects:', err);
    }
  }

  async fetchTimeEntryActivities(): Promise<void> {
    const cfg = this.storageService.config();
    if (!cfg.openproject_token?.trim()) return;

    try {
      if (isTauri()) {
        const res = await invoke<TimeEntryActivityType[]>('fetch_time_entry_activities', {
          url: cfg.openproject_url || '',
          token: cfg.openproject_token || '',
        });
        if (res && res.length) {
          this.timeEntryActivities.set(res);
        }
      }
    } catch (err) {
      console.warn('Could not fetch time entry activities:', err);
    }
  }

  async syncActivity(
    id: string,
    activityTypeId?: string
  ): Promise<{ ok: boolean; error?: string }> {
    const act = this.activities().find((a) => a.id === id);
    if (!act || !act.ticket) {
      return { ok: false, error: 'No ticket specified' };
    }

    const cfg = this.storageService.config();
    if (!cfg.openproject_token?.trim()) {
      return { ok: false, error: 'Token de OpenProject no configurado' };
    }

    await this.updateActivity(id, { isSyncing: true, syncError: false, syncSuccess: false });

    try {
      if (isTauri()) {
        await invoke('create_time_entry', {
          url: cfg.openproject_url || '',
          token: cfg.openproject_token || '',
          ticket: act.ticket,
          minutes: act.minutes,
          date: act.date,
          comment: act.name || 'Registro de tiempo',
          activityTypeId: activityTypeId || null,
          projectId: act.projectId || null,
        });
      }

      await this.updateActivity(id, {
        isSyncing: false,
        synced: true,
        syncSuccess: true,
        selected: false,
      });

      setTimeout(() => {
        this.updateActivity(id, { syncSuccess: false });
      }, 3000);

      return { ok: true };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('Sync failed:', err);
      await this.updateActivity(id, {
        isSyncing: false,
        syncError: true,
      });

      setTimeout(() => {
        this.updateActivity(id, { syncError: false });
      }, 3500);

      return { ok: false, error: errMsg };
    }
  }

  async syncAllUnsynced(activityTypeId?: string): Promise<{ successCount: number; failCount: number }> {
    const list = this.isSelectionMode() && this.selectedActivities().length > 0
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

  // ──────────────────────────────────────────────
  // Modals helpers
  // ──────────────────────────────────────────────

  openAddModal(preset?: { ticket?: string; title?: string; projectId?: string; projectName?: string }): void {
    this.editingActivity.set(null);
    this.presetActivity.set(preset || null);
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
