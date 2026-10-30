import { Component, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Stepper, StepList, Step } from 'primeng/stepper';
import { ButtonDirective } from 'primeng/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerArrowLeft, tablerArrowRight } from '@ng-icons/tabler-icons';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { SetupService } from '../services/setup.service';
import { SetupHeaderComponent } from '../components/setup-header/setup-header.component';
import { ScheduleStepComponent } from '../components/schedule-step/schedule-step.component';
import { LunchStepComponent } from '../components/lunch-step/lunch-step.component';
import { AppearanceStepComponent } from '../components/appearance-step/appearance-step.component';
import { OpenprojectStepComponent } from '../components/openproject-step/openproject-step.component';

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
    SetupHeaderComponent,
    ScheduleStepComponent,
    LunchStepComponent,
    AppearanceStepComponent,
    OpenprojectStepComponent,
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

  readonly isNextDisabled = computed(() => {
    const step = this.setupService.activeStep();
    if (step === 2) {
      return this.setupService.scheduleGroups().length === 0;
    }
    if (step === 4) {
      return this.setupService.isSaving() || !this.setupService.isScheduleValid();
    }
    return false;
  });

  async ngOnInit(): Promise<void> {
    await this.setupService.init();
  }

  nextStep(): void {
    const current = this.setupService.activeStep();
    if (current < 4) {
      this.setupService.goToStep(current + 1);
    }
  }

  prevStep(): void {
    const current = this.setupService.activeStep();
    if (current > 1) {
      this.setupService.goToStep(current - 1);
    }
  }
}
