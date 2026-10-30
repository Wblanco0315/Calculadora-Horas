import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Skeleton } from 'primeng/skeleton';
import { StorageService } from '../../../core/services/storage.service';
import { OverviewBannerComponent } from '../components/overview-banner/overview-banner.component';
import { OverviewSummaryComponent } from '../components/overview-summary/overview-summary.component';
import { OverviewScheduleComponent } from '../components/overview-schedule/overview-schedule.component';

@Component({
  selector: 'app-overview-page',
  standalone: true,
  imports: [
    CommonModule,
    Skeleton,
    OverviewBannerComponent,
    OverviewSummaryComponent,
    OverviewScheduleComponent,
  ],
  templateUrl: './overview.page.html',
  styleUrl: './overview.page.css',
})
export class OverviewPage {
  private readonly storageService = inject(StorageService);

  readonly isLoaded = this.storageService.isLoaded;
  readonly isLoading = this.storageService.isLoading;
}
