import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from 'primeng/tabs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerUser, tablerSettings } from '@ng-icons/tabler-icons';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { ScheduleService } from '../../../core/services/schedule.service';
import { UserSectionComponent } from '../components/user-section/user-section.component';
import { SystemSectionComponent } from '../components/system-section/system-section.component';

@Component({
  selector: 'app-setting-page',
  standalone: true,
  imports: [
    CommonModule,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    NgIcon,
    TranslatePipe,
    UserSectionComponent,
    SystemSectionComponent,
  ],
  viewProviders: [
    provideIcons({
      tablerUser,
      tablerSettings,
    }),
  ],
  templateUrl: './setting.page.html',
  styleUrl: './setting.page.css',
})
export class SettingPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly scheduleService = inject(ScheduleService);

  activeTab = 'user';

  ngOnInit(): void {
    // Check if a specific tab was requested via query params (?tab=user or ?tab=system)
    const tabParam = this.route.snapshot.queryParamMap.get('tab');
    if (tabParam === 'user' || tabParam === 'system') {
      this.activeTab = tabParam;
    }

    // React to queryParam changes dynamically
    this.route.queryParamMap.subscribe((params) => {
      const tab = params.get('tab');
      if (tab === 'user' || tab === 'system') {
        this.activeTab = tab;
      }
    });

    // Initialize schedule editor state with saved config
    this.scheduleService.resetFromCurrentConfig();
  }

  onTabChange(tabValue: string | number | undefined): void {
    const tab = String(tabValue || 'user');
    this.activeTab = tab;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
