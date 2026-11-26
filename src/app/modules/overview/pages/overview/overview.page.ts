import { Component, inject } from '@angular/core';
import { Skeleton } from 'primeng/skeleton';
import { StorageService } from '../../../../core/services/storage.service';
import { StatisticService } from '../../services/statistic.service';
import { OverviewBannerComponent } from '../../components/overview-banner/overview-banner.component';
import { OverviewSummaryComponent } from '../../components/overview-summary/overview-summary.component';
import { OverviewTimeChartComponent } from '../../components/overview-time-chart/overview-time-chart.component';
import { OverviewProjectRankingComponent } from '../../components/overview-project-ranking/overview-project-ranking.component';
import { OverviewScheduleComponent } from '../../components/overview-schedule/overview-schedule.component';

@Component({
  selector: 'app-overview-page',
  standalone: true,
  imports: [
    Skeleton,
    OverviewBannerComponent,
    OverviewSummaryComponent,
    OverviewTimeChartComponent,
    OverviewProjectRankingComponent,
    OverviewScheduleComponent,
  ],
  templateUrl: './overview.page.html',
  styleUrl: './overview.page.css',
})
export class OverviewPage {
  private readonly storageService = inject(StorageService);

  readonly isLoaded = this.storageService.isLoaded;

  constructor() {
    inject(StatisticService).init();
  }
}
