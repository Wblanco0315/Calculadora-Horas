import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { Popover } from 'primeng/popover';
import { Select } from 'primeng/select';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerPlus,
  tablerStar,
  tablerSearch,
  tablerFilter,
  tablerCloudUpload,
  tablerSelect,
  tablerLayoutDashboard,
  tablerHistory,
  tablerSettings,
  tablerClock,
  tablerTrash,
  tablerCheck,
  tablerX,
  tablerChevronLeft,
  tablerChevronRight,
  tablerCalendar,
  tablerCalendarEvent,
} from '@ng-icons/tabler-icons';
import { Activity } from '../../../core/interfaces/activity.interface';
import { ActivityService } from '../../../core/services/activity.service';
import { WindowService } from '../../../core/services/window.service';
import { StorageService } from '../../../core/services/storage.service';
import { LanguageService } from '../../../core/services/language.service';
import { UpdateService } from '../../../core/services/update.service';
import { CompactHeaderComponent } from '../components/compact-header/compact-header.component';
import { StatsHeroComponent } from '../components/stats-hero/stats-hero.component';
import { ActivityRowComponent } from '../components/activity-row/activity-row.component';
import { ActivityFormModalComponent } from '../modals/activity-form-modal/activity-form-modal.component';
import { FavoritesModalComponent } from '../modals/favorites-modal/favorites-modal.component';
import { SyncConfirmModalComponent } from '../modals/sync-confirm-modal/sync-confirm-modal.component';
import { ResetConfirmModalComponent } from '../modals/reset-confirm-modal/reset-confirm-modal.component';
import { CloseConfirmModalComponent } from '../modals/close-confirm-modal/close-confirm-modal.component';
import { TicketContextModalComponent } from '../../../shared/components/ticket-context-modal/ticket-context-modal.component';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-compact-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonDirective,
    DatePicker,
    Popover,
    Select,
    NgIcon,
    CompactHeaderComponent,
    StatsHeroComponent,
    ActivityRowComponent,
    ActivityFormModalComponent,
    FavoritesModalComponent,
    SyncConfirmModalComponent,
    ResetConfirmModalComponent,
    CloseConfirmModalComponent,
    TicketContextModalComponent,
    TranslatePipe,
  ],
  viewProviders: [
    provideIcons({
      tablerPlus,
      tablerStar,
      tablerSearch,
      tablerFilter,
      tablerCloudUpload,
      tablerSelect,
      tablerLayoutDashboard,
      tablerHistory,
      tablerSettings,
      tablerClock,
      tablerTrash,
      tablerCheck,
      tablerX,
      tablerChevronLeft,
      tablerChevronRight,
      tablerCalendar,
      tablerCalendarEvent,
    }),
  ],
  templateUrl: './compact.page.html',
  styleUrl: './compact.page.css',
})
export class CompactPage implements OnInit {
  private readonly router = inject(Router);
  readonly updateService = inject(UpdateService);
  readonly activityService = inject(ActivityService);
  readonly windowService = inject(WindowService);
  readonly storageService = inject(StorageService);
  readonly languageService = inject(LanguageService);

  // Filter signals
  readonly searchQuery = signal<string>('');
  readonly filterProject = signal<string>('');
  readonly sortBy = signal<'none' | 'time-desc' | 'time-asc'>('none');
  readonly filterStatus = signal<'all' | 'synced' | 'unsynced'>('all');
  readonly isSyncingAll = computed<boolean>(() => this.activityService.isSyncing());

  readonly currentUserName = computed<string>(() => {
    return this.storageService.userName() || 'Usuario';
  });

  readonly hasToken = computed<boolean>(() => {
    return this.storageService.isLoggedIn();
  });

  readonly selectedDateObj = computed<Date>(() => {
    const raw = this.activityService.selectedDate();
    return new Date(raw + 'T00:00:00');
  });

  readonly formattedDateLabel = computed<string>(() => {
    const dateStr = this.activityService.selectedDate();
    const d = new Date(dateStr + 'T00:00:00');
    const lang = this.languageService.currentLang();
    const locale = lang === 'en' ? 'en-US' : 'es-ES';

    const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(d);
    const dayAndMonth = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(d);
    const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);

    return `${capitalizedWeekday}, ${dayAndMonth}`;
  });

  onDatePicked(val: Date | null): void {
    if (!val) return;
    const year = val.getFullYear();
    const month = String(val.getMonth() + 1).padStart(2, '0');
    const day = String(val.getDate()).padStart(2, '0');
    this.activityService.setDate(`${year}-${month}-${day}`);
  }

  readonly hasActiveFilters = computed<boolean>(() => {
    return !!this.filterProject() || this.sortBy() !== 'none' || this.filterStatus() !== 'all' || !!this.searchQuery().trim();
  });

  readonly projectFilterOptions = computed(() => {
    return [
      { label: this.languageService.t('compact.projectsAll'), value: '' },
      ...this.activityService.projects().map((p) => ({ label: p.name, value: p.id })),
    ];
  });

  readonly sortOptions = computed(() => {
    return [
      { label: this.languageService.t('compact.sortDefault'), value: 'none' },
      { label: this.languageService.t('compact.sortTimeDesc'), value: 'time-desc' },
      { label: this.languageService.t('compact.sortTimeAsc'), value: 'time-asc' },
    ];
  });

  readonly statusFilterOptions = computed(() => {
    return [
      { label: this.languageService.t('compact.statusAll'), value: 'all' },
      { label: this.languageService.t('compact.statusSynced'), value: 'synced' },
      { label: this.languageService.t('compact.statusUnsynced'), value: 'unsynced' },
    ];
  });

  readonly filteredActivities = computed<Activity[]>(() => {
    let list = this.activityService.dailyActivities();

    // 1. Search Query filter (by ticket, name or ticketTitle)
    const q = this.searchQuery().trim().toLowerCase();
    if (q) {
      list = list.filter((a) => {
        const matchesName = a.name.toLowerCase().includes(q);
        const matchesTicket = a.ticket ? a.ticket.toLowerCase().includes(q) : false;
        const matchesTitle = a.ticketTitle ? a.ticketTitle.toLowerCase().includes(q) : false;
        return matchesName || matchesTicket || matchesTitle;
      });
    }

    // 2. Project filter
    const proj = this.filterProject();
    if (proj) {
      list = list.filter((a) => a.projectId === proj);
    }

    // 3. Status filter
    const status = this.filterStatus();
    if (status === 'synced') {
      list = list.filter((a) => a.synced);
    } else if (status === 'unsynced') {
      list = list.filter((a) => !a.synced);
    }

    // 4. Sort
    const sort = this.sortBy();
    if (sort === 'time-desc') {
      list = [...list].sort((a, b) => (b.minutes || 0) - (a.minutes || 0));
    } else if (sort === 'time-asc') {
      list = [...list].sort((a, b) => (a.minutes || 0) - (b.minutes || 0));
    }

    return list;
  });

  ngOnInit(): void {
    this.activityService.loadActivities(this.activityService.selectedDate()).catch(() => {});
    if (this.storageService.isLoggedIn()) {
      if (this.activityService.projects().length === 0) {
        this.activityService.fetchProjects().catch(() => {});
      }
      if (this.activityService.timeEntryActivities().length === 0) {
        this.activityService.fetchTimeEntryActivities().catch(() => {});
      }
      if (this.activityService.statuses().length === 0) {
        this.activityService.fetchStatuses().catch(() => {});
      }
    }
  }

  clearFilters(): void {
    this.filterProject.set('');
    this.sortBy.set('none');
    this.filterStatus.set('all');
    this.searchQuery.set('');
  }

  async onDeleteActivity(id: string): Promise<void> {
    await this.activityService.deleteActivity(id);
  }

  onSingleSync(activity: Activity): void {
    if (!activity.ticket) return;
    this.activityService.openSyncModal(activity);
  }

  syncAll(): void {
    this.activityService.openSyncModal();
  }

  syncSelected(): void {
    this.activityService.openSyncModal();
  }

  openSettings(): void {
    this.router.navigate(['/setup'], { queryParams: { edit: 'true' } });
  }
}
