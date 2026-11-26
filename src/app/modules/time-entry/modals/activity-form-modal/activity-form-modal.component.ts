import { ChangeDetectorRef, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
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
  tablerFileText,
} from '@ng-icons/tabler-icons';
import { ActivityService, getTodayDateString } from '../../../../core/services/activity.service';
import { FavoriteService } from '../../../../core/services/favorite.service';
import { StorageService } from '../../../../core/services/storage.service';
import { LanguageService } from '../../../../core/services/language.service';
import { NotificationService } from '../../../../core/services/notification.service';
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
      tablerFileText,
    }),
  ],
  templateUrl: './activity-form-modal.component.html',
})
export class ActivityFormModalComponent {
  readonly activityService = inject(ActivityService);
  private readonly favoriteService = inject(FavoriteService);
  /** Hide the ticket context shortcut where the ticket is already on screen (e.g. ticket detail). */
  readonly showTicketContextButton = input<boolean>(true);
  readonly storageService = inject(StorageService);
  readonly languageService = inject(LanguageService);
  private readonly notificationService = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);

  private ticketSearchTimer: ReturnType<typeof setTimeout> | null = null;

  readonly isEditing = signal<boolean>(false);
  readonly showStopwatchConfirm = signal<boolean>(false);
  readonly isTicketFound = signal<boolean>(false);
  readonly isLoadingTypes = signal<boolean>(false);

  readonly hasToken = computed<boolean>(() => this.storageService.isLoggedIn());

  // Form fields
  ticketNumber = '';
  ticketTitle = '';
  ticketStatusId = signal<string | undefined>(undefined);
  ticketStatusName = signal<string | undefined>(undefined);
  ticketStatusColor = signal<string | undefined>(undefined);
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
      const isVisible = this.activityService.showActivityForm();
      const editing = this.activityService.editingActivity();
      const preset = this.activityService.presetActivity();

      untracked(() => {
        if (!isVisible) {
          return;
        }

        if (editing) {
          this.isEditing.set(true);
          this.ticketNumber = editing.ticket || '';
          this.ticketTitle = editing.ticketTitle || '';
          this.ticketStatusId.set(editing.statusId || undefined);
          this.ticketStatusName.set(editing.statusName || undefined);
          this.ticketStatusColor.set(editing.statusColor || undefined);
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
          this.cdr.markForCheck();
        } else if (preset) {
          this.isEditing.set(false);
          this.resetForm();
          this.ticketNumber = preset.ticket || '';
          this.ticketTitle = preset.title || '';
          this.isTicketFound.set(!!preset.ticket && !!preset.title);
          this.ticketStatusId.set(preset.statusId || undefined);
          this.ticketStatusName.set(preset.statusName || undefined);
          this.ticketStatusColor.set(preset.statusColor || undefined);
          this.activityName = '';
          this.selectedProjectId = preset.projectId || '';
          this.cdr.markForCheck();
        } else {
          this.isEditing.set(false);
          this.resetForm();
          this.cdr.markForCheck();
        }
      });
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
    return this.favoriteService.isFavorite(this.ticketNumber);
  });

  resetForm(): void {
    this.ticketNumber = '';
    this.ticketTitle = '';
    this.ticketStatusId.set(undefined);
    this.ticketStatusName.set(undefined);
    this.ticketStatusColor.set(undefined);
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
    if (this.ticketSearchTimer) {
      clearTimeout(this.ticketSearchTimer);
      this.ticketSearchTimer = null;
    }

    const clean = (val || '').trim().replace(/^#/, '');
    if (!clean) {
      this.isTicketFound.set(false);
      this.ticketTitle = '';
      this.cdr.markForCheck();
      return;
    }

    this.isTicketFound.set(false);

    // Auto-fetch ticket after 450ms when at least 3 digits/characters are entered
    if (clean.length >= 3) {
      this.ticketSearchTimer = setTimeout(() => {
        this.onTicketBlur();
      }, 450);
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
    if (this.ticketSearchTimer) {
      clearTimeout(this.ticketSearchTimer);
      this.ticketSearchTimer = null;
    }

    const raw = this.ticketNumber.trim().replace(/^#/, '');
    if (!raw) return;

    this.isSearchingTicket.set(true);
    this.cdr.markForCheck();

    try {
      const res = await this.activityService.fetchTicketSubject(raw);
      if (res.success && res.subject) {
        this.ticketTitle = res.subject;
        this.ticketStatusId.set(res.status_id || undefined);
        this.ticketStatusName.set(res.status_name || undefined);
        this.ticketStatusColor.set(res.status_color || undefined);
        this.isTicketFound.set(true);
        if (res.project_id) {
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
      this.cdr.markForCheck();
    }
  }

  toggleFavorite(): void {
    const raw = this.ticketNumber.trim().replace(/^#/, '');
    if (!raw) return;
    const proj = this.activityService.projects().find((p) => p.id === this.selectedProjectId);
    this.favoriteService.toggleFavorite(raw, this.ticketTitle || this.activityName || `Ticket #${raw}`, this.selectedProjectId, proj?.name);
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
        statusId: this.ticketStatusId() || editing.statusId,
        statusName: this.ticketStatusName() || editing.statusName,
        statusColor: this.ticketStatusColor() || editing.statusColor,
        timerSeconds: 0,
        timerState: 'idle',
        timerLastStarted: undefined,
      });
      this.notificationService.success('toast.activityUpdated');
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
        statusId: this.ticketStatusId(),
        statusName: this.ticketStatusName(),
        statusColor: this.ticketStatusColor(),
        timerSeconds: 0,
        timerState: useStopwatch ? 'running' : 'idle',
        timerLastStarted: useStopwatch ? Date.now() : undefined,
      });
      this.notificationService.success('toast.activityCreated');
    }

    this.showStopwatchConfirm.set(false);
    this.activityService.closeActivityModal();
  }
}
