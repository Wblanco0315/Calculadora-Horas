import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Dialog } from 'primeng/dialog';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { InputNumber } from 'primeng/inputnumber';
import { DatePicker } from 'primeng/datepicker';
import { Select } from 'primeng/select';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerClock,
  tablerStar,
  tablerRefresh,
  tablerCheck,
  tablerFolder,
  tablerCalendar,
} from '@ng-icons/tabler-icons';
import { ActivityService, getTodayDateString } from '../../../../core/services/activity.service';
import { LanguageService } from '../../../../core/services/language.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-activity-form-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Dialog,
    ButtonDirective,
    InputText,
    InputNumber,
    DatePicker,
    Select,
    NgIcon,
    TranslatePipe,
  ],
  viewProviders: [
    provideIcons({
      tablerClock,
      tablerStar,
      tablerRefresh,
      tablerCheck,
      tablerFolder,
      tablerCalendar,
    }),
  ],
  template: `
    <p-dialog
      [visible]="activityService.showActivityForm()"
      (visibleChange)="onVisibleChange($event)"
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      [style]="{ width: '92vw', maxWidth: '440px' }"
      styleClass="p-dialog-rounded"
    >
      <ng-template #header>
        <div class="flex items-center gap-2.5">
          <div
            class="size-8 rounded-xl bg-primary-100 dark:bg-primary-950 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold"
          >
            <ng-icon name="tablerClock" size="1.15rem" />
          </div>
          <div>
            <h3 class="text-sm sm:text-base font-bold text-slate-900 dark:text-zinc-100">
              {{ (isEditing() ? 'compact.modal.editActivity' : 'compact.modal.newActivity') | translate }}
            </h3>
            <p class="text-[11px] text-slate-500 dark:text-zinc-400">
              {{ 'compact.modal.subtitle' | translate }}
            </p>
          </div>
        </div>
      </ng-template>

      <div class="space-y-3.5 py-1">
        <!-- Ticket # Input with auto-lookup and favorite toggle -->
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
            {{ 'compact.modal.ticketLabel' | translate }}
          </label>
          <div class="flex gap-2 items-center">
            <div class="relative flex-1">
              <input
                pInputText
                [(ngModel)]="ticketNumber"
                (blur)="onTicketBlur()"
                (keyup.enter)="onTicketBlur()"
                [placeholder]="'compact.modal.ticketPlaceholder' | translate"
                class="w-full text-xs font-mono font-bold"
              />
              @if (isSearchingTicket()) {
                <div class="absolute right-2.5 top-2 text-primary-500 animate-spin">
                  <ng-icon name="tablerRefresh" size="0.95rem" />
                </div>
              }
            </div>

            <!-- Toggle Favorite Button -->
            @if (ticketNumber.trim()) {
              <button
                type="button"
                (click)="toggleFavorite()"
                class="cursor-pointer size-8 rounded-lg border border-slate-200 dark:border-zinc-700 flex items-center justify-center transition-colors"
                [class.text-amber-500]="isTicketFavorite()"
                [class.text-slate-400]="!isTicketFavorite()"
                [title]="'compact.modal.favoriteMark' | translate"
              >
                <ng-icon name="tablerStar" size="1rem" />
              </button>
            }
          </div>
          @if (ticketSubject()) {
            <p class="text-[11px] text-primary-600 dark:text-primary-400 mt-1 truncate font-medium">
              {{ ticketSubject() }}
            </p>
          }
        </div>

        <!-- Description / Name Input -->
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
            {{ 'compact.modal.descriptionLabel' | translate }} <span class="text-red-500">*</span>
          </label>
          <input
            pInputText
            [(ngModel)]="activityName"
            [placeholder]="'compact.modal.descriptionPlaceholder' | translate"
            class="w-full text-xs"
          />
        </div>

        <!-- Hours & Minutes Inputs with PrimeNG InputNumber -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
              {{ 'compact.modal.hours' | translate }}
            </label>
            <p-inputnumber
              [(ngModel)]="hours"
              [min]="0"
              [max]="24"
              [showButtons]="true"
              styleClass="w-full text-xs"
              buttonLayout="horizontal"
              incrementButtonClass="p-button-secondary"
              decrementButtonClass="p-button-secondary"
            />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
              {{ 'compact.modal.minutes' | translate }}
            </label>
            <p-inputnumber
              [(ngModel)]="minutes"
              [min]="0"
              [max]="59"
              [step]="5"
              [showButtons]="true"
              styleClass="w-full text-xs"
              buttonLayout="horizontal"
              incrementButtonClass="p-button-secondary"
              decrementButtonClass="p-button-secondary"
            />
          </div>
        </div>

        <!-- Project Select & DatePicker -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
              {{ 'compact.modal.projectLabel' | translate }}
            </label>
            <p-select
              [(ngModel)]="selectedProjectId"
              [options]="projectOptions()"
              optionLabel="label"
              optionValue="value"
              [placeholder]="'compact.modal.projectLabel' | translate"
              styleClass="w-full text-xs"
              appendTo="body"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
              {{ 'compact.modal.dateLabel' | translate }}
            </label>
            <p-datepicker
              [(ngModel)]="dateValue"
              (ngModelChange)="onDateChange($event)"
              [showIcon]="true"
              dateFormat="yy-mm-dd"
              styleClass="w-full text-xs"
              appendTo="body"
              size="small"
            />
          </div>
        </div>
      </div>

      <ng-template #footer>
        <div class="flex items-center justify-end gap-2 pt-2">
          <button
            pButton
            type="button"
            severity="secondary"
            variant="text"
            size="small"
            (click)="activityService.closeActivityModal()"
            class="text-xs"
          >
            {{ 'compact.modal.cancel' | translate }}
          </button>
          <button
            pButton
            type="button"
            severity="primary"
            size="small"
            (click)="saveActivity()"
            [disabled]="!isValid()"
            class="text-xs font-semibold"
          >
            {{ (isEditing() ? 'compact.modal.update' : 'compact.modal.save') | translate }}
          </button>
        </div>
      </ng-template>
    </p-dialog>
  `,
})
export class ActivityFormModalComponent {
  readonly activityService = inject(ActivityService);
  readonly languageService = inject(LanguageService);

  readonly isEditing = signal<boolean>(false);

  // Form fields
  ticketNumber = '';
  ticketSubject = signal<string>('');
  activityName = '';
  hours: number = 0;
  minutes: number = 30;
  selectedProjectId: string = '';
  activityDate = getTodayDateString();
  dateValue: Date = new Date();

  isSearchingTicket = signal<boolean>(false);

  constructor() {
    effect(() => {
      const editing = this.activityService.editingActivity();
      const preset = this.activityService.presetActivity();

      if (editing) {
        this.isEditing.set(true);
        this.ticketNumber = editing.ticket || '';
        this.ticketSubject.set(editing.ticketTitle || '');
        this.activityName = editing.name;
        this.hours = Math.floor(editing.minutes / 60);
        this.minutes = editing.minutes % 60;
        this.selectedProjectId = editing.projectId || '';
        this.activityDate = editing.date;
        this.dateValue = new Date(editing.date + 'T00:00:00');
      } else if (preset) {
        this.isEditing.set(false);
        this.resetForm();
        this.ticketNumber = preset.ticket || '';
        this.ticketSubject.set(preset.title || '');
        this.activityName = preset.title || '';
        this.selectedProjectId = preset.projectId || '';
      } else {
        this.isEditing.set(false);
        this.resetForm();
      }
    });
  }

  readonly projectOptions = computed(() => {
    return [
      { label: this.languageService.t('compact.modal.noProject'), value: '' },
      ...this.activityService.projects().map((p) => ({ label: p.name, value: p.id })),
    ];
  });

  readonly isTicketFavorite = computed<boolean>(() => {
    return this.activityService.isFavorite(this.ticketNumber);
  });

  resetForm(): void {
    this.ticketNumber = '';
    this.ticketSubject.set('');
    this.activityName = '';
    this.hours = 0;
    this.minutes = 30;
    this.selectedProjectId = '';
    this.activityDate = this.activityService.selectedDate();
    this.dateValue = new Date(this.activityDate + 'T00:00:00');
  }

  onVisibleChange(visible: boolean): void {
    if (!visible) {
      this.activityService.closeActivityModal();
    }
  }

  onDateChange(val: Date | null): void {
    if (val) {
      const year = val.getFullYear();
      const month = String(val.getMonth() + 1).padStart(2, '0');
      const day = String(val.getDate()).padStart(2, '0');
      this.activityDate = `${year}-${month}-${day}`;
    }
  }

  async onTicketBlur(): Promise<void> {
    const raw = this.ticketNumber.trim().replace(/^#/, '');
    if (!raw) return;

    this.isSearchingTicket.set(true);
    try {
      const res = await this.activityService.fetchTicketSubject(raw);
      if (res.success && res.subject) {
        this.ticketSubject.set(res.subject);
        if (!this.activityName.trim()) {
          this.activityName = res.subject;
        }
        if (res.project_id) {
          this.selectedProjectId = res.project_id;
        }
      }
    } finally {
      this.isSearchingTicket.set(false);
    }
  }

  toggleFavorite(): void {
    const raw = this.ticketNumber.trim().replace(/^#/, '');
    if (!raw) return;
    const proj = this.activityService.projects().find((p) => p.id === this.selectedProjectId);
    this.activityService.toggleFavorite(raw, this.ticketSubject() || this.activityName, this.selectedProjectId, proj?.name);
  }

  isValid(): boolean {
    if (!this.activityName.trim()) return false;
    return (this.hours || 0) > 0 || (this.minutes || 0) > 0;
  }

  async saveActivity(): Promise<void> {
    if (!this.isValid()) return;

    const totalMinutes = (this.hours || 0) * 60 + (this.minutes || 0);
    const proj = this.activityService.projects().find((p) => p.id === this.selectedProjectId);
    const cleanTicket = this.ticketNumber.trim().replace(/^#/, '');

    const editing = this.activityService.editingActivity();
    if (editing) {
      await this.activityService.updateActivity(editing.id, {
        name: this.activityName.trim(),
        minutes: totalMinutes,
        date: this.activityDate,
        ticket: cleanTicket || undefined,
        ticketTitle: this.ticketSubject().trim() || undefined,
        projectId: this.selectedProjectId || undefined,
        projectName: proj?.name || undefined,
      });
    } else {
      await this.activityService.addActivity({
        name: this.activityName.trim(),
        minutes: totalMinutes,
        date: this.activityDate,
        ticket: cleanTicket || undefined,
        ticketTitle: this.ticketSubject().trim() || undefined,
        projectId: this.selectedProjectId || undefined,
        projectName: proj?.name || undefined,
      });
    }

    this.activityService.closeActivityModal();
  }
}
