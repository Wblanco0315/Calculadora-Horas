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
  tablerClock,
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
      tablerClock,
    }),
  ],
  templateUrl: './schedule-editor.component.html',
})
export class ScheduleEditorComponent {
  readonly scheduleService = inject(ScheduleService);

  readonly showTitle = input<boolean>(true);
  readonly showLunch = input<boolean>(false);
  readonly showMinHours = input<boolean>(true);

  readonly formattedMinHoursEquiv = computed(() => {
    const totalMins = Math.round(this.scheduleService.minDailyHours() * 60);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return `${h}h ${m.toString().padStart(2, '0')}m`;
  });

  adjustMinHours(delta: number): void {
    const current = this.scheduleService.minDailyHours();
    this.scheduleService.setMinDailyHours(current + delta);
  }

  onMinHoursChange(val: number | null): void {
    if (val !== null && !isNaN(val)) {
      this.scheduleService.setMinDailyHours(val);
    }
  }

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
