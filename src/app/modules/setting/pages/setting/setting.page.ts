import { Component, DestroyRef, OnInit, effect, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerSettings } from '@ng-icons/tabler-icons';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { SetupService } from '../../../setup/services/setup.service';
import {
  SETTINGS_TABS,
  SettingsPanelComponent,
} from '../../../setup/components/settings-panel/settings-panel.component';

/**
 * Full-mode settings: the same `SettingsPanelComponent` the compact window uses. The active tab is
 * kept in the `?tab=` query param (`appearance`, `schedule`, `lunch`, `openproject`, `update`, `mcp`).
 */
@Component({
  selector: 'app-setting-page',
  standalone: true,
  imports: [NgIcon, TranslatePipe, SettingsPanelComponent],
  viewProviders: [provideIcons({ tablerSettings })],
  templateUrl: './setting.page.html',
  styleUrl: './setting.page.css',
})
export class SettingPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly setupService = inject(SetupService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    // Reflect the active tab in the URL (breadcrumb, account menu links, reloads).
    effect(() => {
      const tab = SETTINGS_TABS.find((item) => item.step === this.setupService.activeStep());
      if (tab && this.route.snapshot.queryParamMap.get('tab') !== tab.key) {
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { tab: tab.key },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      }
    });
  }

  async ngOnInit(): Promise<void> {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const tab = SETTINGS_TABS.find((item) => item.key === params.get('tab'));
      if (tab) this.setupService.goToStep(tab.step);
    });
    await this.setupService.init();
  }
}
