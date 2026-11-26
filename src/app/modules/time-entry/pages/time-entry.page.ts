import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerCalendarEvent,
  tablerChevronLeft,
  tablerChevronRight,
  tablerClock,
  tablerClockHour4,
  tablerCloudUpload,
  tablerFilterOff,
  tablerPlus,
  tablerSearch,
  tablerSelect,
  tablerStar,
} from '@ng-icons/tabler-icons';
import { Activity } from '../../../core/interfaces/activity.interface';
import { ActivityService } from '../../../core/services/activity.service';
import { LanguageService } from '../../../core/services/language.service';
import { StorageService } from '../../../core/services/storage.service';
import {
  ActivitySort,
  ActivityStatusFilter,
  filterActivities,
  hasActiveActivityFilters,
} from '../../../core/utils/activity-filter.util';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { Drawer } from 'primeng/drawer';
import { TicketDetailPage } from '../../board/pages/ticket-detail.page';
import { TimeEntrySummaryComponent } from '../components/time-entry-summary/time-entry-summary.component';
import { ActivityRowComponent } from '../../compact/components/activity-row/activity-row.component';
import { ActivityFormModalComponent } from '../../compact/modals/activity-form-modal/activity-form-modal.component';
import { FavoritesModalComponent } from '../../compact/modals/favorites-modal/favorites-modal.component';
import { SyncConfirmModalComponent } from '../../compact/modals/sync-confirm-modal/sync-confirm-modal.component';
import { ResetConfirmModalComponent } from '../../compact/modals/reset-confirm-modal/reset-confirm-modal.component';

/** Full-view counterpart of the compact time calculator: daily local time entries with the same actions. */
@Component({
  selector: 'app-time-entry-page',
  standalone: true,
  imports: [
    FormsModule,
    ButtonDirective,
    ButtonIcon,
    ButtonLabel,
    DatePicker,
    IconField,
    InputIcon,
    InputText,
    Select,
    NgIcon,
    TranslatePipe,
    TimeEntrySummaryComponent,
    ActivityRowComponent,
    ActivityFormModalComponent,
    FavoritesModalComponent,
    SyncConfirmModalComponent,
    ResetConfirmModalComponent,
    Drawer,
    TicketDetailPage,
  ],
  viewProviders: [
    provideIcons({
      tablerCalendarEvent,
      tablerChevronLeft,
      tablerChevronRight,
      tablerClock,
      tablerClockHour4,
      tablerCloudUpload,
      tablerFilterOff,
      tablerPlus,
      tablerSearch,
      tablerSelect,
      tablerStar,
    }),
  ],
  templateUrl: './time-entry.page.html',
  host: {
    class: 'flex w-full min-h-0 min-w-0 flex-1 flex-col',
  },
})
export class TimeEntryPage implements OnInit {
  readonly activityService = inject(ActivityService);
  private readonly storageService = inject(StorageService);
  private readonly languageService = inject(LanguageService);

  readonly searchQuery = signal<string>('');
  readonly filterProject = signal<string>('');
  readonly sortBy = signal<ActivitySort>('none');
  readonly filterStatus = signal<ActivityStatusFilter>('all');

  readonly isSyncing = computed<boolean>(() => this.activityService.isSyncing());

  /** Ticket opened from a row's "ticket context" action, shown in the ticket detail drawer. */
  readonly contextTicketId = computed<number | null>(() => {
    const id = Number((this.activityService.contextTicket() ?? '').replace(/^#/, ''));
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  });
  readonly hasToken = computed<boolean>(() => this.storageService.isLoggedIn());

  readonly selectedDateObj = computed<Date>(() => new Date(`${this.activityService.selectedDate()}T00:00:00`));

  readonly formattedDateLabel = computed<string>(() => {
    const locale = this.languageService.currentLang() === 'en' ? 'en-US' : 'es-ES';
    const label = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(
      this.selectedDateObj()
    );
    return label.charAt(0).toUpperCase() + label.slice(1);
  });

  private readonly filterCriteria = computed(() => ({
    query: this.searchQuery(),
    projectId: this.filterProject(),
    status: this.filterStatus(),
    sort: this.sortBy(),
  }));

  readonly hasActiveFilters = computed<boolean>(() => hasActiveActivityFilters(this.filterCriteria()));

  readonly filteredActivities = computed<Activity[]>(() =>
    filterActivities(this.activityService.dailyActivities(), this.filterCriteria())
  );

  readonly projectFilterOptions = computed(() => [
    { label: this.languageService.t('compact.projectsAll'), value: '' },
    ...this.activityService.projects().map((project) => ({ label: project.name, value: project.id })),
  ]);

  readonly sortOptions = computed(() => [
    { label: this.languageService.t('compact.sortDefault'), value: 'none' },
    { label: this.languageService.t('compact.sortTimeDesc'), value: 'time-desc' },
    { label: this.languageService.t('compact.sortTimeAsc'), value: 'time-asc' },
  ]);

  readonly statusFilterOptions = computed(() => [
    { label: this.languageService.t('compact.statusAll'), value: 'all' },
    { label: this.languageService.t('compact.statusSynced'), value: 'synced' },
    { label: this.languageService.t('compact.statusUnsynced'), value: 'unsynced' },
  ]);

  ngOnInit(): void {
    this.activityService.loadActivities(this.activityService.selectedDate()).catch(() => {});
    if (!this.storageService.isLoggedIn()) return;
    if (this.activityService.projects().length === 0) this.activityService.fetchProjects().catch(() => {});
    if (this.activityService.timeEntryActivities().length === 0) {
      this.activityService.fetchTimeEntryActivities().catch(() => {});
    }
    if (this.activityService.statuses().length === 0) this.activityService.fetchStatuses().catch(() => {});
  }

  onDatePicked(value: Date | null): void {
    if (!value) return;
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    this.activityService.setDate(`${value.getFullYear()}-${month}-${day}`);
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.filterProject.set('');
    this.sortBy.set('none');
    this.filterStatus.set('all');
  }

  async onDeleteActivity(id: string): Promise<void> {
    await this.activityService.deleteActivity(id);
  }

  onSingleSync(activity: Activity): void {
    if (activity.ticket) this.activityService.openSyncModal(activity);
  }

  syncPending(): void {
    this.activityService.openSyncModal();
  }
}
