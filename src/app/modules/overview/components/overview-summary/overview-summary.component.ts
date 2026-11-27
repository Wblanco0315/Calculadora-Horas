import { Component, computed, inject } from '@angular/core';
import { ProgressBar } from 'primeng/progressbar';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowDownRight,
  tablerArrowUpRight,
  tablerCalendarMonth,
  tablerCalendarWeek,
  tablerClock,
  tablerCloudUpload,
} from '@ng-icons/tabler-icons';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { formatWorkMinutes } from '../../../../core/interfaces/config.interface';
import { StatisticService } from '../../services/statistic.service';
import { PeriodSummary } from '../../interfaces/statistic.interface';

interface SummaryTile {
  key: string;
  label: string;
  icon: string;
  summary: PeriodSummary;
  comparisonLabel: string;
  detail: { key: string; params: Record<string, string | number> };
}

/** Day, week and month totals against the schedule target, plus time still to sync. */
@Component({
  selector: 'app-overview-summary',
  standalone: true,
  imports: [ProgressBar, NgIcon, TranslatePipe],
  viewProviders: [
    provideIcons({
      tablerClock,
      tablerCalendarWeek,
      tablerCalendarMonth,
      tablerCloudUpload,
      tablerArrowUpRight,
      tablerArrowDownRight,
    }),
  ],
  templateUrl: './overview-summary.component.html',
})
export class OverviewSummaryComponent {
  private readonly statisticService = inject(StatisticService);

  readonly streak = this.statisticService.streak;
  readonly unsynced = this.statisticService.unsynced;

  readonly tiles = computed<SummaryTile[]>(() => {
    const today = this.statisticService.todaySummary();
    const week = this.statisticService.weekSummary();
    const month = this.statisticService.monthSummary();
    const tiles: SummaryTile[] = [
      {
        key: 'today',
        label: 'overview.today',
        icon: 'tablerClock',
        summary: today,
        comparisonLabel: 'overview.vsYesterday',
        detail: { key: 'overview.entries', params: { count: today.entryCount } },
      },
      {
        key: 'week',
        label: 'overview.week',
        icon: 'tablerCalendarWeek',
        summary: week,
        comparisonLabel: 'overview.vsLastWeek',
        detail: { key: 'overview.activeDays', params: { days: week.activeDays } },
      },
      {
        key: 'month',
        label: 'overview.month',
        icon: 'tablerCalendarMonth',
        summary: month,
        comparisonLabel: 'overview.vsLastMonth',
        detail: {
          key: 'overview.averagePerDay',
          params: { time: formatWorkMinutes(month.activeDays ? Math.round(month.minutes / month.activeDays) : 0) },
        },
      },
    ];
    return tiles;
  });

  format(minutes: number): string {
    return formatWorkMinutes(minutes);
  }

  progress(summary: PeriodSummary): number {
    if (summary.targetMinutes <= 0) return 0;
    return Math.min(100, Math.round((summary.minutes / summary.targetMinutes) * 100));
  }

  /** Percentage change against the previous period, or null when there is nothing to compare. */
  trend(summary: PeriodSummary): number | null {
    if (summary.previousMinutes <= 0) return null;
    return Math.round(((summary.minutes - summary.previousMinutes) / summary.previousMinutes) * 100);
  }
}
