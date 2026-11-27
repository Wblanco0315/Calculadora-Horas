import { Component, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Stepper, StepList, Step } from 'primeng/stepper';
import { ButtonDirective } from 'primeng/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowLeft,
  tablerArrowRight,
} from '@ng-icons/tabler-icons';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { SetupService } from '../../services/setup.service';
import { StorageService } from '../../../../core/services/storage.service';
import { UpdateService } from '../../../../core/services/update.service';
import { WindowService } from '../../../../core/window/window.service';
import { AppHeaderComponent } from '../../../../shared/components/app-header/app-header.component';
import { ScheduleStepComponent } from '../../components/schedule-step/schedule-step.component';
import { LunchStepComponent } from '../../components/lunch-step/lunch-step.component';
import { AppearanceStepComponent } from '../../components/appearance-step/appearance-step.component';
import { OpenprojectStepComponent } from '../../components/openproject-step/openproject-step.component';
import { SettingsPanelComponent } from '../../components/settings-panel/settings-panel.component';
import { McpSectionComponent } from '../../components/mcp-section/mcp-section.component';

/**
 * Onboarding steps, numbered like the settings panel tabs so each number shows the same section
 * (5, updates, is settings-only). The MCP step is optional: the user can finish without it.
 */
const ONBOARDING_STEPS = [1, 2, 3, 4, 6] as const;
const LAST_STEP = ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1];

@Component({
  selector: 'app-setup-page',
  standalone: true,
  imports: [
    CommonModule,
    Stepper,
    StepList,
    Step,
    ButtonDirective,
    NgIcon,
    TranslatePipe,
    AppHeaderComponent,
    ScheduleStepComponent,
    LunchStepComponent,
    AppearanceStepComponent,
    OpenprojectStepComponent,
    SettingsPanelComponent,
    McpSectionComponent,
  ],
  viewProviders: [
    provideIcons({
      tablerArrowLeft,
      tablerArrowRight,
    }),
  ],
  templateUrl: './setup.page.html',
  styleUrl: './setup.page.css',
})
export class SetupPage implements OnInit {
  readonly setupService = inject(SetupService);
  readonly storageService = inject(StorageService);
  readonly updateService = inject(UpdateService);
  readonly windowService = inject(WindowService);
  private readonly router = inject(Router);

  readonly steps = ONBOARDING_STEPS;
  readonly lastStep = LAST_STEP;

  readonly isNextDisabled = computed(() => {
    const step = this.setupService.activeStep();
    if (step === 2) {
      return this.setupService.scheduleGroups().length === 0;
    }
    if (step === LAST_STEP) {
      return this.setupService.isSaving() || !this.setupService.isScheduleValid();
    }
    return false;
  });

  async ngOnInit(): Promise<void> {
    await this.setupService.init();
    if (!this.storageService.isConfigured()) {
      await this.windowService.maximize();
    }
  }

  nextStep(): void {
    this.moveStep(1);
  }

  prevStep(): void {
    this.moveStep(-1);
  }

  private moveStep(offset: number): void {
    const index = ONBOARDING_STEPS.indexOf(this.setupService.activeStep() as (typeof ONBOARDING_STEPS)[number]);
    const target = ONBOARDING_STEPS[Math.max(0, index) + offset];
    if (target !== undefined) {
      this.setupService.goToStep(target);
    }
  }

  async closeSettings(): Promise<void> {
    await this.windowService.returnToCompact();
  }
}
