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
  template: `
    <section class="space-y-4 sm:space-y-6 animate-fadeIn">
      <!-- Section Header -->
      <div class="border-b border-slate-100 dark:border-zinc-800 pb-2.5 sm:pb-3">
        <h2 class="text-sm sm:text-base font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-2">
          <ng-icon name="tablerCoffee" size="1.25rem" class="text-primary-600 dark:text-primary-400" />
          {{ 'setup.schedule.lunchLabel' | translate }}
        </h2>
      </div>

      <!-- Lunch Setting Card -->
      <div class="p-4 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-800/40 space-y-4 sm:space-y-5">
        <!-- Input & Steppers Row -->
        <div class="flex items-center justify-center">
          <!-- Stepper Counter -->
          <div class="flex items-center gap-2">
            <button
              pButton
              (click)="decrementLunch(5)"
              [disabled]="setupService.lunchMinutes() <= 0"
              iconOnly 
              rounded 
              raised
              variant="outlined"
              severity="secondary"
            >
              <ng-icon name="tablerMinus" />
            </button>

            <p-inputnumber
              [ngModel]="setupService.lunchMinutes()"
              (ngModelChange)="onLunchChange($event)"
              [min]="0"
              [max]="240"
              [step]="5"
              suffix=" min"
              styleClass="w-32 sm:w-36"
              inputStyleClass="w-full text-center text-lg sm:text-xl font-bold font-mono text-primary-600 dark:text-primary-400 rounded-xl py-2"
            />

            <button
              pButton
              (click)="incrementLunch(5)"
              iconOnly 
              rounded 
              raised
              variant="outlined"
              severity="secondary"
            >
              <ng-icon name="tablerPlus" />
            </button>
          </div>
        </div>

        <!-- Quick Presets -->
        <div class="pt-3.5 sm:pt-4 border-t border-slate-200/60 dark:border-zinc-800 flex flex-wrap items-center justify-center sm:justify-start gap-1.5 sm:gap-2">
          <span class="w-full sm:w-auto text-center sm:text-left text-[11px] font-semibold text-slate-400 mb-1 sm:mb-0 mr-1">
            {{ 'setup.schedule.presets' | translate }}
          </span>
          @for (preset of [0, 30, 45, 60, 90]; track preset) {
            <button
              pButton
              (click)="setupService.setLunchMinutes(preset)"
              [severity]="setupService.lunchMinutes() === preset ? 'primary' : 'secondary'"
              [variant]="setupService.lunchMinutes() === preset ? undefined : 'outlined'"
              rounded
              class="text-xs px-2.5 py-1 sm:px-3 sm:py-1.5"
            >
              {{ preset === 0 ? ('setup.schedule.noLunch' | translate) : (preset + ' min' + (preset === 60 ? ' (1h)' : '')) }}
            </button>
          }
        </div>
      </div>
    </section>
  `,
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
