/** Mirror of `model::statistic` (src-tauri/src/model/statistic.rs). */
export interface DailyProjectStatistic {
  date: string; // YYYY-MM-DD
  projectId: string | null;
  projectName: string | null;
  minutes: number;
  entryCount: number;
}

export interface UnsyncedStatistic {
  minutes: number;
  entryCount: number;
}

export interface TimeStatistics {
  /** OpenProject time entries of the user, summarised per day and project. */
  days: DailyProjectStatistic[];
  /** Local activities not uploaded to OpenProject yet. */
  unsynced: UnsyncedStatistic;
  /** Unix ms of the last successful refresh from OpenProject. */
  refreshedAt: number | null;
}

/** Logged time of one project over a period. */
export interface ProjectStatistic {
  projectId: string | null;
  projectName: string | null;
  minutes: number;
  entryCount: number;
}

/** Totals of one day (all projects). */
export interface DayTotal {
  date: string;
  minutes: number;
  entryCount: number;
}

/** Logged time against the schedule target for a period (today, this week, this month). */
export interface PeriodSummary {
  minutes: number;
  targetMinutes: number;
  entryCount: number;
  activeDays: number;
  /** Same span of the previous period (yesterday, last week up to the same weekday, last month up to the same day). */
  previousMinutes: number;
}

/** One bar of the daily chart. */
export interface DailyPoint {
  date: string;
  minutes: number;
  targetMinutes: number;
}

export type RankingPeriod = 'week' | 'month' | 'quarter';
export type ChartRange = 7 | 30;
