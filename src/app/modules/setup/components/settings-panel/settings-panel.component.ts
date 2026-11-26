import { Component, inject, input, output } from '@angular/core';
import { Tabs, TabList, Tab } from 'primeng/tabs';
import { ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerPalette,
  tablerCalendar,
  tablerCoffee,
  tablerLink,
  tablerCheck,
  tablerDownload,
  tablerRobot,
} from '@ng-icons/tabler-icons';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { NotificationService } from '../../../../core/services/notification.service';
import { SetupService } from '../../services/setup.service';
import { AppearanceStepComponent } from '../appearance-step/appearance-step.component';
import { ScheduleStepComponent } from '../schedule-step/schedule-step.component';
import { LunchStepComponent } from '../lunch-step/lunch-step.component';
import { OpenprojectStepComponent } from '../openproject-step/openproject-step.component';
import { McpSectionComponent } from '../mcp-section/mcp-section.component';
import { UpdateSectionComponent } from '../../../../shared/components/update-section/update-section.component';

/** Settings tabs in display order; `step` is the `SetupService.activeStep` value of each one. */
export const SETTINGS_TABS = [
  { step: 1, key: 'appearance', label: 'setup.step1', icon: 'tablerPalette' },
  { step: 2, key: 'schedule', label: 'setup.step2', icon: 'tablerCalendar' },
  { step: 3, key: 'lunch', label: 'setup.step3', icon: 'tablerCoffee' },
  { step: 4, key: 'openproject', label: 'setup.step4', icon: 'tablerLink' },
  { step: 5, key: 'update', label: 'setup.step5', icon: 'tablerDownload' },
  { step: 6, key: 'mcp', label: 'setup.step6', icon: 'tablerRobot' },
] as const;

export type SettingsTabKey = (typeof SETTINGS_TABS)[number]['key'];

/**
 * The app settings (appearance, schedule, lunch, OpenProject, updates, MCP) shared by the compact
 * window (`/setup` in edit mode) and the full dashboard (`/dashboard/settings`). State lives in
 * `SetupService`; the host calls `SetupService.init()` before showing it.
 *
 * - `compact`: fills the small window, shows a Close button and returns to compact mode on save.
 * - `full`: sits inside the dashboard, wider content, saves in place with a toast.
 */
@Component({
  selector: 'app-settings-panel',
  standalone: true,
  imports: [
    Tabs,
    TabList,
    Tab,
    ButtonDirective,
    ButtonIcon,
    ButtonLabel,
    NgIcon,
    TranslatePipe,
    AppearanceStepComponent,
    ScheduleStepComponent,
    LunchStepComponent,
    OpenprojectStepComponent,
    UpdateSectionComponent,
    McpSectionComponent,
  ],
  viewProviders: [
    provideIcons({ tablerPalette, tablerCalendar, tablerCoffee, tablerLink, tablerCheck, tablerDownload, tablerRobot }),
  ],
  templateUrl: './settings-panel.component.html',
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class SettingsPanelComponent {
  readonly setupService = inject(SetupService);
  private readonly notificationService = inject(NotificationService);

  readonly layout = input<'compact' | 'full'>('compact');
  readonly closed = output<void>();

  readonly tabs = SETTINGS_TABS;

  async save(): Promise<void> {
    if (this.layout() === 'compact') {
      await this.setupService.completeSetup();
      return;
    }
    if (await this.setupService.saveSettings()) {
      this.notificationService.success('toast.settingsSaved');
    }
  }
}
