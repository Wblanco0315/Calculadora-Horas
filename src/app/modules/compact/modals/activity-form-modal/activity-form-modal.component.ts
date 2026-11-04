import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Dialog } from 'primeng/dialog';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { InputNumber } from 'primeng/inputnumber';
import { DatePicker } from 'primeng/datepicker';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerClock,
  tablerStar,
  tablerRefresh,
  tablerCheck,
  tablerFolder,
  tablerCalendar,
  tablerPlus,
  tablerMinus,
  tablerEdit,
  tablerClockPlay,
} from '@ng-icons/tabler-icons';
import { ActivityService, getTodayDateString } from '../../../../core/services/activity.service';
import { StorageService } from '../../../../core/services/storage.service';
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
    Textarea,
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
      tablerEdit,
      tablerClockPlay,
      tablerPlus,
      tablerMinus,
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
          @if(isEditing()){
            <ng-icon name="tablerEdit" size="1.15rem" />
          }@else{
            <ng-icon name="tablerPlus" size="1.15rem" />
          }
          
          <h3 class="text-sm sm:text-base font-bold text-slate-900 dark:text-zinc-100">
            {{ (isEditing() ? 'compact.modal.editActivity' : 'compact.modal.newActivity') | translate }}
          </h3>
        </div>
      </ng-template>

      <div class="space-y-3 py-1">

              <!-- Ticket Title (Editable input, auto-locked when found in OpenProject) -->
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="text-xs font-semibold text-slate-700 dark:text-zinc-300">
              {{ 'compact.modal.ticketTitleLabel' | translate }}
            </label>
            @if (isTicketFound()) {
              <span class="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <ng-icon name="tablerCheck" size="0.8rem" />
                {{ 'compact.modal.ticketFoundAuto' | translate }}
              </span>
            }
          </div>
          <input
            pInputText
            [(ngModel)]="ticketTitle"
            [disabled]="isTicketFound()"
            [placeholder]="'compact.modal.ticketTitlePlaceholder' | translate"
            class="w-full text-xs font-medium"
            [class.opacity-70]="isTicketFound()"
          />
        </div>

        <!-- Project Select -->
        <div class="w-full block">
          <label class="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
            {{ 'compact.modal.projectLabel' | translate }}
          </label>
          <p-select
            [(ngModel)]="selectedProjectId"
            [options]="projectOptions()"
            optionLabel="label"
            optionValue="value"
            [placeholder]="'compact.modal.projectLabel' | translate"
            class="w-full text-xs"
            appendTo="body"
            [disabled]="isTicketFound()"
          />
        </div>

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
                (ngModelChange)="onTicketNumberChange($event)"
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
                class="cursor-pointer size-8 rounded-lg border border-slate-200 dark:border-zinc-700 flex items-center justify-center transition-colors shrink-0"
                [class.text-amber-500]="isTicketFavorite()"
                [class.text-slate-400]="!isTicketFavorite()"
                [title]="'compact.modal.favoriteMark' | translate"
              >
                <ng-icon name="tablerStar" size="1rem" />
              </button>
            }
          </div>
        </div>

        <!-- OpenProject Activity Type (Tipo de Actividad OpenProject) -->
        @if (hasToken() || activityTypeOptions().length > 0) {
          <div class="w-full block">
            <div class="flex items-center justify-between mb-1">
              <label class="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                {{ 'compact.syncModal.activityTypeLabel' | translate }}
                <span class="text-rose-500">*</span>
              </label>
              @if (isLoadingTypes()) {
                <span class="text-[10px] text-slate-400 flex items-center gap-1">
                  <ng-icon name="tablerRefresh" class="animate-spin" size="0.75rem" />
                  {{ 'setup.testingConnection' | translate }}
                </span>
              }
            </div>
            <p-select
              [(ngModel)]="selectedActivityTypeId"
              [options]="activityTypeOptions()"
              optionLabel="label"
              optionValue="value"
              [placeholder]="'compact.syncModal.selectTypePlaceholder' | translate"
              class="w-full text-xs"
              appendTo="body"
              [loading]="isLoadingTypes()"
            />
          </div>
        }

        <!-- Hours & Minutes Inputs with PrimeNG InputNumber & DatePicker -->
        <div class="grid grid-cols-3 gap-2">
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
              {{ 'compact.modal.hours' | translate }}
            </label>
            <p-inputnumber
              [(ngModel)]="hours"
              [min]="0"
              [max]="24"
              [showButtons]="true"
              [inputStyle]="{ width: '100%', textAlign: 'center' }"
              buttonLayout="horizontal"
              size="small"
              class="w-full"
            >
              <ng-template #incrementbuttonicon>
                <ng-icon name="tablerPlus" />
              </ng-template>
              <ng-template #decrementbuttonicon>
                <ng-icon name="tablerMinus" />
              </ng-template>
            </p-inputnumber>
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
              [inputStyle]="{ width: '100%', textAlign: 'center' }"
              buttonLayout="horizontal"
              size="small"
              class="w-full"
            >
              <ng-template #incrementbuttonicon>
                <ng-icon name="tablerPlus" />
              </ng-template>
              <ng-template #decrementbuttonicon>
                <ng-icon name="tablerMinus" />
              </ng-template>
            </p-inputnumber>
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

        <!-- Description Textarea at the end (optional) -->
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
            {{ 'compact.modal.descriptionLabel' | translate }}
          </label>
          <textarea
            pTextarea
            [(ngModel)]="activityName"
            [placeholder]="'compact.modal.descriptionPlaceholder' | translate"
            rows="4"
            class="w-full text-xs resize-none"
          ></textarea>
        </div>

      </div>

      <ng-template #footer>
        <div class="flex items-center justify-between gap-2 pt-2 w-full">
          <!-- Left: Direct Start Stopwatch Button (Only in create mode) -->
          <div>
            @if (!isEditing()) {
              <button
                pButton
                type="button"
                severity="secondary"
                variant="outlined"
                size="small"
                (click)="startWithStopwatch()"
                [disabled]="!canSave()"
                class="text-xs font-semibold"
                [title]="'compact.modal.startWithStopwatch' | translate"
              >
                <ng-icon name="tablerClockPlay" size="0.95rem" class="mr-1 text-primary-500" />
                <span>{{ 'compact.modal.stopwatch' | translate }}</span>
              </button>
            }
          </div>

          <!-- Right: Cancel & Save Buttons -->
          <div class="flex items-center gap-2">
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
              [disabled]="!canSave()"
              class="text-xs font-semibold"
            >
              {{ (isEditing() ? 'compact.modal.update' : 'compact.modal.save') | translate }}
            </button>
          </div>
        </div>
      </ng-template>
    </p-dialog>

    <!-- Stopwatch Confirmation Dialog when submitting with 0h 0m -->
    <p-dialog
      [visible]="showStopwatchConfirm()"
      (visibleChange)="showStopwatchConfirm.set($event)"
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      [style]="{ width: '90vw', maxWidth: '380px' }"
      styleClass="p-dialog-rounded"
    >
      <ng-template #header>
        <div class="flex items-center gap-2">
          <div class="size-8 rounded-xl bg-primary-100 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 flex items-center justify-center">
            <ng-icon name="tablerClockPlay" size="1.1rem" />
          </div>
          <h3 class="text-sm font-bold text-slate-900 dark:text-zinc-100">
            {{ 'compact.modal.stopwatchPromptTitle' | translate }}
          </h3>
        </div>
      </ng-template>

      <p class="text-xs text-slate-600 dark:text-zinc-300 py-2 leading-relaxed">
        {{ 'compact.modal.stopwatchPromptMessage' | translate }}
      </p>

      <ng-template #footer>
        <div class="flex items-center justify-end gap-2 pt-2">
          <button
            pButton
            type="button"
            severity="secondary"
            variant="text"
            size="small"
            (click)="onCancelStopwatchPrompt()"
            class="text-xs"
          >
            {{ 'compact.modal.fillManually' | translate }}
          </button>
          <button
            pButton
            type="button"
            severity="primary"
            size="small"
            (click)="confirmStopwatchMode()"
            class="text-xs font-semibold"
          >
            <ng-icon name="tablerClockPlay" size="0.95rem" class="mr-1" />
            {{ 'compact.modal.useStopwatch' | translate }}
          </button>
        </div>
      </ng-template>
    </p-dialog>
  `,
})
export class ActivityFormModalComponent {
  readonly activityService = inject(ActivityService);
  readonly storageService = inject(StorageService);
  readonly languageService = inject(LanguageService);

  readonly isEditing = signal<boolean>(false);
  readonly showStopwatchConfirm = signal<boolean>(false);
  readonly isTicketFound = signal<boolean>(false);
  readonly isLoadingTypes = signal<boolean>(false);

  readonly hasToken = computed<boolean>(() => this.storageService.isLoggedIn());

  // Form fields
  ticketNumber = '';
  ticketTitle = '';
  activityName = '';
  hours: number = 0;
  minutes: number = 30;
  selectedProjectId: string = '';
  selectedActivityTypeId: string = '';
  activityDate = getTodayDateString();
  dateValue: Date = new Date();

  isSearchingTicket = signal<boolean>(false);

  constructor() {
    if (this.storageService.isLoggedIn() && this.activityService.timeEntryActivities().length === 0) {
      this.isLoadingTypes.set(true);
      this.activityService.fetchTimeEntryActivities()
        .catch(() => {})
        .finally(() => {
          this.isLoadingTypes.set(false);
          const opts = this.activityTypeOptions();
          if (opts.length > 0 && !this.selectedActivityTypeId) {
            this.selectedActivityTypeId = opts[0].value;
          }
        });
    }

    effect(() => {
      const opts = this.activityTypeOptions();
      if (opts.length > 0 && !this.selectedActivityTypeId) {
        this.selectedActivityTypeId = opts[0].value;
      }
    });

    effect(() => {
      const editing = this.activityService.editingActivity();
      const preset = this.activityService.presetActivity();

      if (editing) {
        this.isEditing.set(true);
        this.ticketNumber = editing.ticket || '';
        this.ticketTitle = editing.ticketTitle || '';
        this.isTicketFound.set(!!editing.ticket && !!editing.ticketTitle);
        const opts = this.activityTypeOptions();
        this.selectedActivityTypeId =
          editing.activityTypeId || editing.activity_type_id || (opts.length > 0 ? opts[0].value : '');
        this.activityName = editing.name || '';
        this.hours = Math.floor(editing.minutes / 60);
        this.minutes = editing.minutes % 60;
        this.selectedProjectId = editing.projectId || '';
        this.activityDate = editing.date;
        this.dateValue = new Date(editing.date + 'T00:00:00');
      } else if (preset) {
        this.isEditing.set(false);
        this.resetForm();
        this.ticketNumber = preset.ticket || '';
        this.ticketTitle = preset.title || '';
        this.isTicketFound.set(!!preset.ticket && !!preset.title);
        this.activityName = '';
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

  readonly activityTypeOptions = computed(() => {
    return this.activityService.timeEntryActivities().map((t) => ({
      label: t.name,
      value: String(t.id),
    }));
  });

  readonly isTicketFavorite = computed<boolean>(() => {
    return this.activityService.isFavorite(this.ticketNumber);
  });

  resetForm(): void {
    this.ticketNumber = '';
    this.ticketTitle = '';
    this.isTicketFound.set(false);
    const opts = this.activityTypeOptions();
    this.selectedActivityTypeId = opts.length > 0 ? opts[0].value : '';
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

  onTicketNumberChange(val: string): void {
    this.isTicketFound.set(false);
    if (!val.trim()) {
      this.ticketTitle = '';
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
        this.ticketTitle = res.subject;
        this.isTicketFound.set(true);
        if (res.project_id && !this.selectedProjectId) {
          this.selectedProjectId = res.project_id;
        }
      } else {
        this.isTicketFound.set(false);
      }

      // Also ensure activities for this ticket's project are retrieved
      await this.activityService.fetchTimeEntryActivities(raw).catch(() => {});
      const opts = this.activityTypeOptions();
      if (opts.length > 0 && !this.selectedActivityTypeId) {
        this.selectedActivityTypeId = opts[0].value;
      }
    } finally {
      this.isSearchingTicket.set(false);
    }
  }

  toggleFavorite(): void {
    const raw = this.ticketNumber.trim().replace(/^#/, '');
    if (!raw) return;
    const proj = this.activityService.projects().find((p) => p.id === this.selectedProjectId);
    this.activityService.toggleFavorite(raw, this.ticketTitle || this.activityName || `Ticket #${raw}`, this.selectedProjectId, proj?.name);
  }

  canSave(): boolean {
    const hasDesc = !!this.activityName.trim();
    const hasTicket = !!this.ticketNumber.trim();
    const hasTitle = !!this.ticketTitle.trim();
    if (!hasDesc && !hasTicket && !hasTitle) return false;

    // If connected to OpenProject and options exist, require activity type
    if (this.hasToken() && this.activityTypeOptions().length > 0 && !this.selectedActivityTypeId) {
      return false;
    }

    return true;
  }

  isValid(): boolean {
    const hasTime = (this.hours || 0) > 0 || (this.minutes || 0) > 0;
    return hasTime && this.canSave();
  }

  async saveActivity(): Promise<void> {
    if (!this.canSave()) return;

    const totalMinutes = (this.hours || 0) * 60 + (this.minutes || 0);

    // If 0 hours and 0 minutes are entered in create mode, ask if they want to start the stopwatch
    if (totalMinutes === 0 && !this.isEditing()) {
      this.showStopwatchConfirm.set(true);
      return;
    }

    await this.proceedSubmit(totalMinutes, false);
  }

  async startWithStopwatch(): Promise<void> {
    if (!this.canSave()) return;
    await this.proceedSubmit(0, true);
  }

  async confirmStopwatchMode(): Promise<void> {
    this.showStopwatchConfirm.set(false);
    await this.proceedSubmit(0, true);
  }

  onCancelStopwatchPrompt(): void {
    this.showStopwatchConfirm.set(false);
    if ((this.hours || 0) === 0 && (this.minutes || 0) === 0) {
      this.minutes = 15;
    }
  }

  private async proceedSubmit(minutesLogged: number, useStopwatch: boolean = false): Promise<void> {
    const proj = this.activityService.projects().find((p) => p.id === this.selectedProjectId);
    if (!this.selectedActivityTypeId && this.activityTypeOptions().length > 0) {
      this.selectedActivityTypeId = this.activityTypeOptions()[0].value;
    }
    const typeObj = this.activityService.timeEntryActivities().find((t) => String(t.id) === String(this.selectedActivityTypeId));
    const cleanTicket = this.ticketNumber.trim().replace(/^#/, '');
    const title = this.ticketTitle.trim();
    // User requirement: "si no hay descripcion no se pone nada"
    const description = this.activityName.trim();

    const editing = this.activityService.editingActivity();
    if (editing) {
      await this.activityService.updateActivity(editing.id, {
        name: description,
        minutes: minutesLogged,
        seconds: minutesLogged * 60,
        date: this.activityDate,
        ticket: cleanTicket || undefined,
        ticketTitle: title || undefined,
        projectId: this.selectedProjectId || undefined,
        projectName: proj?.name || undefined,
        activityTypeId: this.selectedActivityTypeId || undefined,
        activityTypeName: typeObj?.name || undefined,
        timerSeconds: 0,
        timerState: 'idle',
        timerLastStarted: undefined,
      });
    } else {
      await this.activityService.addActivity({
        name: description,
        minutes: minutesLogged,
        seconds: minutesLogged * 60,
        date: this.activityDate,
        ticket: cleanTicket || undefined,
        ticketTitle: title || undefined,
        projectId: this.selectedProjectId || undefined,
        projectName: proj?.name || undefined,
        activityTypeId: this.selectedActivityTypeId || undefined,
        activityTypeName: typeObj?.name || undefined,
        timerSeconds: 0,
        timerState: useStopwatch ? 'running' : 'idle',
        timerLastStarted: useStopwatch ? Date.now() : undefined,
      });
    }

    this.showStopwatchConfirm.set(false);
    this.activityService.closeActivityModal();
  }
}
