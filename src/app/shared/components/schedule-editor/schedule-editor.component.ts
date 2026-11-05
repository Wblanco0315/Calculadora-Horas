import { Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerCalendar,
  tablerEdit,
  tablerPlus,
  tablerTrash,
  tablerAlertCircle,
  tablerCoffee,
  tablerMinus,
} from '@ng-icons/tabler-icons';
import { DatePicker } from 'primeng/datepicker';
import { ButtonDirective } from 'primeng/button';
import { InputNumber } from 'primeng/inputnumber';
import { ScheduleService } from '../../../core/services/schedule.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-schedule-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NgIcon,
    DatePicker,
    InputNumber,
    ButtonDirective,
    TranslatePipe,
  ],
  viewProviders: [
    provideIcons({
      tablerCalendar,
      tablerEdit,
      tablerPlus,
      tablerTrash,
      tablerAlertCircle,
      tablerCoffee,
      tablerMinus,
    }),
  ],
  template: `
    <section class="space-y-4 sm:space-y-5">
      <!-- Section Header (Optional) -->
      @if (showTitle()) {
        <div class="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-2.5 sm:pb-3">
          <h2 class="text-sm sm:text-base font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-2">
            <ng-icon name="tablerCalendar" size="1.25rem" class="text-primary-600 dark:text-primary-400" />
            {{ 'setup.schedule.title' | translate }}
          </h2>
        </div>
      }

      <!-- Schedule Builder Card -->
      <div class="p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-800/40 space-y-3.5 sm:space-y-4">
        <!-- Day Selector -->
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2">
            {{ 'setup.schedule.daysLabel' | translate }}
          </label>

          <div class="flex items-center justify-center gap-1 sm:gap-2 flex-wrap">
            @for (item of scheduleService.weekDaysDisplay(); track item.day) {
              <button
                pButton
                type="button"
                (click)="scheduleService.toggleDraftDay(item.day)"
                [title]="item.name"
                [severity]="scheduleService.isDraftDayActive(item.day) ? 'primary' : 'secondary'"
                [variant]="scheduleService.isDraftDayActive(item.day) ? undefined : 'outlined'"
                rounded
                class="w-8 h-8 sm:w-10 sm:h-10 font-bold text-xs sm:text-sm p-0 flex items-center justify-center"
              >
                {{ item.letter }}
              </button>
            }
          </div>
        </div>

        <!-- Time Pickers + Save Rule Button -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 pt-3 border-t border-slate-200/60 dark:border-zinc-800 items-end">
          <!-- Entrada -->
          <div class="space-y-1">
            <label class="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
              {{ 'setup.schedule.entryLabel' | translate }}
            </label>
            <p-datepicker
              [timeOnly]="true"
              hourFormat="12"
              [stepMinute]="5"
              [ngModel]="draftEntryDate()"
              (ngModelChange)="onEntryDateChange($event)"
              [showIcon]="true"
              iconDisplay="input"
              appendTo="body"
              styleClass="w-full"
              inputStyleClass="w-full font-mono font-bold text-xs sm:text-sm py-2 sm:py-2.5 rounded-xl"
            />
          </div>

          <!-- Salida -->
          <div class="space-y-1">
            <label class="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
              {{ 'setup.schedule.exitLabel' | translate }}
            </label>
            <p-datepicker
              [timeOnly]="true"
              hourFormat="12"
              [stepMinute]="5"
              [ngModel]="draftExitDate()"
              (ngModelChange)="onExitDateChange($event)"
              [showIcon]="true"
              iconDisplay="input"
              appendTo="body"
              styleClass="w-full"
              inputStyleClass="w-full font-mono font-bold text-xs sm:text-sm py-2 sm:py-2.5 rounded-xl"
            />
          </div>

          <!-- Botón Guardar Regla -->
          <button
            pButton
            type="button"
            (click)="scheduleService.saveDraftRule()"
            [disabled]="scheduleService.draftDays().length === 0"
            class="w-full h-[38px] sm:h-[42px] flex items-center justify-center font-semibold"
          >
            <ng-icon name="tablerPlus" size="1rem" class="mr-1" />
            <span>{{ 'setup.schedule.saveRule' | translate }}</span>
          </button>
        </div>
      </div>

      <!-- Configured Rules List -->
      <div class="space-y-2.5">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            {{ 'setup.schedule.configuredRules' | translate }} ({{ scheduleService.scheduleGroups().length }})
          </span>
        </div>

        @if (scheduleService.scheduleGroups().length === 0) {
          <div class="p-4 sm:p-5 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 text-center space-y-1">
            <ng-icon name="tablerAlertCircle" size="1.5rem" class="text-slate-400" />
            <p class="text-xs text-slate-500 dark:text-zinc-400">
              {{ 'setup.schedule.noRulesYet' | translate }}
            </p>
          </div>
        } @else {
          <div class="space-y-2">
            @for (group of scheduleService.scheduleGroups(); track group.id) {
              <div class="p-3 sm:p-3.5 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 transition-all">
                <!-- Day Badge & Name -->
                <div class="flex items-center gap-2 sm:gap-3">
                  <div class="text-xs sm:text-sm font-bold text-slate-800 dark:text-zinc-200">
                    {{ scheduleService.getGroupDisplayName(group) }}
                  </div>
                </div>

                <!-- Hours and Actions Row -->
                <div class="flex items-center justify-between sm:justify-end gap-3 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-zinc-700/60">
                  <div class="flex flex-col sm:items-end">
                    <span class="text-xs sm:text-sm font-bold font-mono text-slate-900 dark:text-zinc-100">
                      {{ scheduleService.formatTime12h(group.entry_time) }} – {{ scheduleService.formatTime12h(group.exit_time) }}
                    </span>
                  </div>

                  <div class="flex items-center gap-1">
                    <button
                      pButton
                      type="button"
                      (click)="scheduleService.editRule(group)"
                      iconOnly
                      rounded
                      severity="secondary"
                      [title]="'setup.schedule.editButton' | translate"
                    >
                      <ng-icon name="tablerEdit" />
                    </button>

                    <button
                      pButton
                      type="button"
                      (click)="scheduleService.removeRule(group.id)"
                      iconOnly
                      rounded
                      severity="danger"
                      [title]="'setup.schedule.deleteRuleTitle' | translate"
                    >
                      <ng-icon name="tablerTrash" />
                    </button>
                  </div>
                </div>
              </div>
            }
          </div>
        }
      </div>

      
      <!-- Optional Lunch Adjustment inside Builder Card -->
        @if (showLunch()) {
          <div class="p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-800/40 space-y-3.5 sm:space-y-4">
          
            <div class="flex items-center justify-between">
              <label class="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400 flex items-center gap-1.5">
                {{ 'setup.schedule.lunchLabel' | translate }}
              </label>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-1.5">
                <button
                  pButton
                  type="button"
                  (click)="adjustLunch(-5)"
                  [disabled]="scheduleService.lunchMinutes() <= 0"
                  iconOnly
                  rounded
                  variant="outlined"
                  severity="secondary"
                  class="w-8 h-8"
                >
                  <ng-icon name="tablerMinus" />
                </button>

                <p-inputnumber
                  [ngModel]="scheduleService.lunchMinutes()"
                  (ngModelChange)="onLunchChange($event)"
                  [min]="0"
                  [max]="240"
                  [step]="5"
                  suffix=" min"
                  styleClass="w-28"
                  inputStyleClass="w-full text-center text-xs font-bold font-mono py-1.5 rounded-lg"
                />

                <button
                  pButton
                  type="button"
                  (click)="adjustLunch(5)"
                  [disabled]="scheduleService.lunchMinutes() >= 240"
                  iconOnly
                  rounded
                  variant="outlined"
                  severity="secondary"
                  class="w-8 h-8"
                >
                  <ng-icon name="tablerPlus" />
                </button>
              </div>

              <!-- Quick presets -->
              <div class="flex items-center gap-1">
                @for (preset of [0, 30, 45, 60]; track preset) {
                  <button
                    pButton
                    type="button"
                    (click)="scheduleService.setLunchMinutes(preset)"
                    [severity]="scheduleService.lunchMinutes() === preset ? 'primary' : 'secondary'"
                    [variant]="scheduleService.lunchMinutes() === preset ? undefined : 'outlined'"
                    rounded
                    class="text-[11px] px-2 py-0.5"
                  >
                    {{ preset === 0 ? ('setup.schedule.noLunch' | translate) : (preset + 'm') }}
                  </button>
                }
              </div>
            </div>
          </div>
        }
      
    </section>
  `,
})
export class ScheduleEditorComponent {
  readonly scheduleService = inject(ScheduleService);

  readonly showTitle = input<boolean>(true);
  readonly showLunch = input<boolean>(false);

  readonly draftEntryDate = computed(() => this.timeStringToDate(this.scheduleService.draftEntryTime()));
  readonly draftExitDate = computed(() => this.timeStringToDate(this.scheduleService.draftExitTime()));

  private timeStringToDate(time: string): Date {
    const [h, m] = (time || '08:00').split(':').map(Number);
    const d = new Date();
    d.setHours(isNaN(h) ? 8 : h, isNaN(m) ? 0 : m, 0, 0);
    return d;
  }

  private dateToTimeString(d: Date | null): string {
    if (!d || !(d instanceof Date) || isNaN(d.getTime())) return '08:00';
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  onEntryDateChange(d: Date | null): void {
    if (d) {
      this.scheduleService.setDraftEntryTime(this.dateToTimeString(d));
    }
  }

  onExitDateChange(d: Date | null): void {
    if (d) {
      this.scheduleService.setDraftExitTime(this.dateToTimeString(d));
    }
  }

  adjustLunch(delta: number): void {
    const current = this.scheduleService.lunchMinutes();
    this.scheduleService.setLunchMinutes(Math.max(0, Math.min(240, current + delta)));
  }

  onLunchChange(val: number | null): void {
    this.scheduleService.setLunchMinutes(val === null || isNaN(val) ? 0 : Math.max(0, Math.min(240, val)));
  }
}
