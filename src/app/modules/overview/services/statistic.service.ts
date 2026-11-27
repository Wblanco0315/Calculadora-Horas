import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { ActivityService } from '../../../core/services/activity.service';
import { StorageService } from '../../../core/services/storage.service';
import { OpenprojectService } from '../../../core/services/openproject/openproject.service';
import { TimeEntryApiService } from '../../../core/services/openproject/time-entry-api.service';
import { Activity, PlatformTimeEntry } from '../../../core/interfaces/activity.interface';
import { localRetentionStart, toDateKey } from '../../../core/utils/retention.util';
import {
  DailyPoint,
  DailyProjectStatistic,
  DayTotal,
  PeriodSummary,
  ProjectStatistic,
  RankingPeriod,
  TimeStatistics,
} from '../interfaces/statistic.interface';

const LOCAL_ACTIVITIES_KEY = 'pocketproject_local_activities';
const LOCAL_RELOAD_DEBOUNCE_MS = 300;
const REMOTE_REFRESH_DEBOUNCE_MS = 2000;
/** A cache younger than this is not refreshed again when the overview is reopened. */
const REMOTE_MAX_AGE_MS = 5 * 60 * 1000;
export const RANKING_LIMIT = 5;
const EMPTY: TimeStatistics = { days: [], unsynced: { minutes: 0, entryCount: 0 }, refreshedAt: null };

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** Monday of the week that contains `date`. */
function startOfWeek(date: Date): Date {
  const jsDay = date.getDay();
  return addDays(date, -(jsDay === 0 ? 6 : jsDay - 1));
}

/**
 * Time statistics of the overview dashboard, taken from the user's OpenProject time entries.
 *
 * - The entries of the last 3 months (`LOCAL_RETENTION_MONTHS`) are read with the time-cost report
 *   query (user = me) and summarised per day and project in Rust; only that small rollup is cached
 *   in SQLite (`time_entry_daily_statistic`).
 * - The overview shows the cache immediately (works offline) and refreshes it from OpenProject when
 *   it is older than 5 minutes, when the user syncs activities, or on demand.
 * - Every summary, series and ranking is a memoized `computed` over the rollup, so switching tabs or
 *   ranges never queries again. "To sync" is the only local figure (activities not uploaded yet).
 */
@Injectable({ providedIn: 'root' })
export class StatisticService {
  private readonly activityService = inject(ActivityService);
  private readonly storageService = inject(StorageService);
  private readonly openprojectService = inject(OpenprojectService);
  private readonly timeEntryApi = inject(TimeEntryApiService);

  private readonly statistics = signal<TimeStatistics>(EMPTY);
  readonly isLoaded = signal(false);
  readonly isRefreshing = signal(false);
  readonly refreshedAt = computed(() => this.statistics().refreshedAt);
  readonly today = signal(new Date());

  private localTimer: ReturnType<typeof setTimeout> | null = null;
  private remoteTimer: ReturnType<typeof setTimeout> | null = null;
  private started = false;

  /** Changes when an activity of the loaded day is uploaded to OpenProject (or a synced one changes). */
  private readonly syncedSignature = computed(() =>
    this.activityService
      .activities()
      .filter((a) => a.synced && !a.readOnly)
      .map((a) => `${a.id}:${a.minutes}:${a.date}`)
      .join('|'),
  );

  constructor() {
    effect(() => {
      this.activityService.activities();
      if (untracked(() => this.started)) this.debounceLocal();
    });
    let previousSignature: string | null = null;
    effect(() => {
      const signature = this.syncedSignature();
      if (previousSignature !== null && signature !== previousSignature && untracked(() => this.started)) {
        this.debounceRemote();
      }
      previousSignature = signature;
    });
  }

  /**
   * Called on every overview visit: shows the cache at once and refreshes it from OpenProject
   * when it is stale.
   */
  init(): void {
    this.started = true;
    void this.loadCache().then(() => {
      const refreshedAt = this.statistics().refreshedAt;
      if (!refreshedAt || Date.now() - refreshedAt > REMOTE_MAX_AGE_MS) void this.refresh();
    });
  }

  /** Reads the cached rollup and the local unsynced totals (no network). */
  async loadCache(): Promise<void> {
    const today = new Date();
    this.today.set(today);
    const from = toDateKey(localRetentionStart(today));
    try {
      const result = isTauri()
        ? await invoke<TimeStatistics>('get_time_statistics', { from })
        : { ...this.statistics(), unsynced: this.localUnsynced() };
      this.statistics.set(result ?? EMPTY);
    } catch (err) {
      console.error('Error loading cached time statistics:', err);
    } finally {
      this.isLoaded.set(true);
    }
  }

  /** Re-reads the user's time entries from OpenProject and updates the cache. */
  async refresh(): Promise<void> {
    if (!this.storageService.isLoggedIn() || this.isRefreshing()) return;
    const today = new Date();
    this.today.set(today);
    const from = toDateKey(localRetentionStart(today));
    const to = toDateKey(today);
    this.isRefreshing.set(true);
    try {
      if (isTauri()) {
        const result = await invoke<TimeStatistics>('refresh_time_statistics', {
          url: this.openprojectService.sanitizeUrl(),
          token: this.openprojectService.getToken(),
          from,
          to,
        });
        this.statistics.set(result ?? EMPTY);
      } else {
        const entries = await this.timeEntryApi.getTimeCostReportEntries({ userId: 'me', spentOnFrom: from, spentOnTo: to });
        this.statistics.set({ days: this.summarize(entries), unsynced: this.localUnsynced(), refreshedAt: Date.now() });
      }
    } catch (err) {
      // Keep the cached statistics: OpenProject may be unreachable.
      console.warn('Could not refresh time statistics from OpenProject:', err);
    } finally {
      this.isRefreshing.set(false);
      this.isLoaded.set(true);
    }
  }

  // ──────────────────────────────────────────────
  // Derived data (memoized)
  // ──────────────────────────────────────────────

  readonly unsynced = computed(() => this.statistics().unsynced);

  /** Day totals indexed by date. */
  private readonly dayTotals = computed(() => {
    const totals = new Map<string, DayTotal>();
    for (const row of this.statistics().days) {
      const total = totals.get(row.date) ?? { date: row.date, minutes: 0, entryCount: 0 };
      total.minutes += row.minutes;
      total.entryCount += row.entryCount;
      totals.set(row.date, total);
    }
    return totals;
  });

  readonly todaySummary = computed<PeriodSummary>(() => {
    const today = this.today();
    return this.summarizePeriod(today, today, addDays(today, -1), addDays(today, -1));
  });

  readonly weekSummary = computed<PeriodSummary>(() => {
    const today = this.today();
    const start = startOfWeek(today);
    return this.summarizePeriod(start, today, addDays(start, -7), addDays(today, -7), addDays(start, 6));
  });

  readonly monthSummary = computed<PeriodSummary>(() => {
    const today = this.today();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const previousStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const previousMonthLastDay = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
    const previousEnd = new Date(
      previousStart.getFullYear(),
      previousStart.getMonth(),
      Math.min(today.getDate(), previousMonthLastDay),
    );
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return this.summarizePeriod(start, today, previousStart, previousEnd, monthEnd);
  });

  /** Logged minutes per day of the current week (1 = Monday), for the weekly schedule. */
  readonly currentWeekMinutes = computed<Map<number, number>>(() => {
    const start = startOfWeek(this.today());
    const totals = this.dayTotals();
    const result = new Map<number, number>();
    for (let i = 0; i < 7; i++) {
      result.set(i + 1, totals.get(toDateKey(addDays(start, i)))?.minutes ?? 0);
    }
    return result;
  });

  /** Last 30 days (oldest first) with the schedule target of each day. */
  readonly last30Days = computed<DailyPoint[]>(() => {
    const today = this.today();
    const totals = this.dayTotals();
    const points: DailyPoint[] = [];
    for (let i = 29; i >= 0; i--) {
      const date = addDays(today, -i);
      const key = toDateKey(date);
      points.push({
        date: key,
        minutes: totals.get(key)?.minutes ?? 0,
        targetMinutes: this.storageService.targetMinutesFor(date),
      });
    }
    return points;
  });

  /**
   * Consecutive working days (back from today, within the 3-month window) where the target was
   * reached. Today only counts once reached.
   */
  readonly streak = computed(() => {
    const today = this.today();
    const totals = this.dayTotals();
    const windowStart = localRetentionStart(today);
    let streak = 0;
    for (let date = today, i = 0; date >= windowStart; date = addDays(date, -1), i++) {
      const target = this.storageService.targetMinutesFor(date);
      if (target <= 0) continue;
      const reached = (totals.get(toDateKey(date))?.minutes ?? 0) >= target;
      if (reached) streak++;
      else if (i > 0) break;
    }
    return streak;
  });

  private readonly rankings = computed(() => {
    const today = this.today();
    const to = toDateKey(today);
    return {
      week: this.rankProjects(toDateKey(startOfWeek(today)), to),
      month: this.rankProjects(toDateKey(new Date(today.getFullYear(), today.getMonth(), 1)), to),
      quarter: this.rankProjects(toDateKey(localRetentionStart(today)), to),
    };
  });

  /** Top `RANKING_LIMIT` projects of a period and the period's total minutes (all projects). */
  ranking(period: RankingPeriod): { projects: ProjectStatistic[]; totalMinutes: number } {
    return this.rankings()[period];
  }

  // ──────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────

  private summarizePeriod(
    start: Date,
    end: Date,
    previousStart: Date,
    previousEnd: Date,
    targetEnd: Date = end,
  ): PeriodSummary {
    const totals = this.dayTotals();
    const summary: PeriodSummary = { minutes: 0, targetMinutes: 0, entryCount: 0, activeDays: 0, previousMinutes: 0 };
    for (let date = start; date <= targetEnd; date = addDays(date, 1)) {
      summary.targetMinutes += this.storageService.targetMinutesFor(date);
      if (date > end) continue;
      const total = totals.get(toDateKey(date));
      if (!total) continue;
      summary.minutes += total.minutes;
      summary.entryCount += total.entryCount;
      if (total.minutes > 0) summary.activeDays++;
    }
    for (let date = previousStart; date <= previousEnd; date = addDays(date, 1)) {
      summary.previousMinutes += totals.get(toDateKey(date))?.minutes ?? 0;
    }
    return summary;
  }

  private rankProjects(from: string, to: string): { projects: ProjectStatistic[]; totalMinutes: number } {
    const projects = new Map<string, ProjectStatistic>();
    for (const row of this.statistics().days) {
      if (row.date < from || row.date > to) continue;
      const key = row.projectId ?? '';
      const project = projects.get(key) ?? {
        projectId: row.projectId,
        projectName: row.projectName,
        minutes: 0,
        entryCount: 0,
      };
      project.minutes += row.minutes;
      project.entryCount += row.entryCount;
      project.projectName ??= row.projectName;
      projects.set(key, project);
    }
    const all = [...projects.values()].sort((a, b) => b.minutes - a.minutes);
    return {
      projects: all.slice(0, RANKING_LIMIT),
      totalMinutes: all.reduce((sum, p) => sum + p.minutes, 0),
    };
  }

  private debounceLocal(): void {
    if (this.localTimer) clearTimeout(this.localTimer);
    this.localTimer = setTimeout(() => {
      this.localTimer = null;
      void this.loadCache();
    }, LOCAL_RELOAD_DEBOUNCE_MS);
  }

  private debounceRemote(): void {
    if (this.remoteTimer) clearTimeout(this.remoteTimer);
    this.remoteTimer = setTimeout(() => {
      this.remoteTimer = null;
      void this.refresh();
    }, REMOTE_REFRESH_DEBOUNCE_MS);
  }

  /** Browser (non-Tauri) fallback of the Rust `summarize`. */
  private summarize(entries: PlatformTimeEntry[]): DailyProjectStatistic[] {
    const rows = new Map<string, DailyProjectStatistic>();
    for (const entry of entries) {
      if (!entry.spentOn) continue;
      const key = `${entry.spentOn}|${entry.projectId ?? ''}`;
      const row = rows.get(key) ?? {
        date: entry.spentOn,
        projectId: entry.projectId ?? null,
        projectName: entry.projectName ?? null,
        minutes: 0,
        entryCount: 0,
      };
      row.minutes += this.openprojectService.isoDurationToMinutes(entry.hours);
      row.entryCount++;
      rows.set(key, row);
    }
    return [...rows.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  /** Browser (non-Tauri) fallback: unsynced totals from the activities in localStorage. */
  private localUnsynced(): TimeStatistics['unsynced'] {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(LOCAL_ACTIVITIES_KEY) : null;
    const activities: Activity[] = raw ? JSON.parse(raw) : [];
    const pending = activities.filter((a) => !a.synced);
    return { minutes: pending.reduce((sum, a) => sum + (Number(a.minutes) || 0), 0), entryCount: pending.length };
  }
}
