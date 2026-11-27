import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerCoffee,
  tablerPlus,
  tablerMinus,
} from '@ng-icons/tabler-icons';
import { ButtonDirective } from 'primeng/button';
import { InputNumber } from 'primeng/inputnumber';
import { SetupService } from '../../services/setup.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-lunch-step',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIcon, InputNumber, TranslatePipe, ButtonDirective],
  viewProviders: [
    provideIcons({
      tablerCoffee,
      tablerPlus,
      tablerMinus,
    }),
  ],
  templateUrl: './lunch-step.component.html',
})
export class LunchStepComponent {
  readonly setupService = inject(SetupService);

  onLunchChange(val: number | null): void {
    this.setupService.setLunchMinutes(val === null || isNaN(val) ? 0 : Math.max(0, Math.min(240, val)));
  }

  incrementLunch(amount: number): void {
    const current = this.setupService.lunchMinutes();
    this.setupService.setLunchMinutes(Math.min(240, current + amount));
  }

  decrementLunch(amount: number): void {
    const current = this.setupService.lunchMinutes();
    this.setupService.setLunchMinutes(Math.max(0, current - amount));
  }

  formatLunchDisplay(mins: number): string {
    if (mins <= 0) return `${this.setupService.languageService.t('setup.schedule.noLunch')} (0 min)`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m (${mins} min)`;
    if (h > 0) return `${h}h (${mins} min)`;
    return `${mins} min`;
  }
}
