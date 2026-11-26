import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ButtonDirective } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { DatePicker } from 'primeng/datepicker';
import { InputText } from 'primeng/inputtext';
import { InputNumber } from 'primeng/inputnumber';
import { Select } from 'primeng/select';
import { Table, SortIcon, SortableColumn } from 'primeng/table';
import { Textarea } from 'primeng/textarea';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerArrowLeft, tablerExternalLink, tablerRefresh, tablerReportAnalytics, tablerSearch } from '@ng-icons/tabler-icons';
import { openUrl } from '@tauri-apps/plugin-opener';
import { TimeCostReportFilter, TimeEntryActivityType, PlatformTimeEntry, Project, WorkPackageCostSummary } from '../../../core/interfaces/openproject.interface';
import { OpenprojectService } from '../../../core/services/openproject/openproject.service';
import { WorkPackageApiService } from '../../../core/services/openproject/work-package-api.service';
import { ProjectApiService } from '../../../core/services/openproject/project-api.service';
import { TimeEntryApiService } from '../../../core/services/openproject/time-entry-api.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { formatIsoDuration, formatTimeMinutes } from '../../../shared/format/time';

type GroupBy = 'none' | 'spentOn' | 'user' | 'activity' | 'project' | 'workPackage';

interface TimeCostReportRow extends PlatformTimeEntry {
  hoursSort: number;
  startTimeSort: string;
}

interface TimeCostGroupRow {
  key: string;
  label: string;
  entryCount: number;
  totalMinutes: number;
}

@Component({
  selector: 'app-time-cost-report-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonDirective,
    Checkbox,
    DatePicker,
    InputText,
    InputNumber,
    Select,
    Table,
    SortIcon,
    SortableColumn,
    Textarea,
    NgIcon,
    TranslatePipe,
  ],
  viewProviders: [
    provideIcons({ tablerArrowLeft, tablerExternalLink, tablerRefresh, tablerReportAnalytics, tablerSearch }),
  ],
  templateUrl: './time-cost-report.page.html',
  styles: `
    .report-filter-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 14rem), 1fr));
      align-items: end;
      gap: 0.875rem 1rem;
    }

    .report-field {
      display: flex;
      min-width: 0;
      flex-direction: column;
      gap: 0.375rem;
    }

    .report-label {
      display: block;
      line-height: 1rem;
    }

    .report-field--action {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      min-height: 2.5rem;
    }

    .report-edit-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      align-items: end;
      gap: 0.75rem;
    }

    @media (min-width: 48rem) {
      .report-edit-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .report-edit-grid > :nth-child(4) {
        grid-column: 1 / 3;
      }
    }

    @media (min-width: 80rem) {
      .report-edit-grid {
        grid-template-columns: minmax(9rem, 0.8fr) minmax(7rem, 0.55fr) minmax(9rem, 0.8fr) minmax(14rem, 1.8fr) auto;
      }

      .report-edit-grid > :nth-child(4) {
        grid-column: auto;
      }
    }

    th,
    td {
      white-space: nowrap;
      font-size: 0.75rem;
      line-height: 1rem;
    }

    .report-th {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }

    .report-cell-text {
      display: block;
      max-width: 22rem;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .report-metric {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
      font-size: 0.75rem;
      line-height: 1rem;
    }
  `,
  host: {
    class: 'flex w-full min-h-0 min-w-0 flex-1 flex-col',
  },
})
export class TimeCostReportPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly openprojectService = inject(OpenprojectService);
  private readonly workPackageApi = inject(WorkPackageApiService);
  private readonly projectApi = inject(ProjectApiService);
  private readonly timeEntryApi = inject(TimeEntryApiService);
  private readonly routeQueryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  private lastQuerySignature = '';

  readonly projectOption = signal<Project[]>([]);
  readonly activityOption = signal<TimeEntryActivityType[]>([]);
  readonly ticketId = signal<string>('');
  readonly projectId = signal<string | null>(null);
  readonly projectIdentifier = signal<string>('');
  readonly returnUrl = signal<string>('');
  readonly cameFromTicket = computed(() => this.returnUrl().includes('/tickets/'));
  readonly userId = signal<string>('');
  readonly activityId = signal<string | null>(null);
  readonly spentOnFrom = signal<Date | null>(null);
  readonly spentOnTo = signal<Date | null>(null);
  readonly includeDescendants = signal<boolean>(true);
  readonly groupBy = signal<GroupBy>('none');
  readonly timeEntry = signal<PlatformTimeEntry[]>([]);
  readonly costSummary = signal<WorkPackageCostSummary | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly currentUserId = signal<string | null>(null);
  readonly editingTimeEntryId = signal<string | null>(null);
  readonly editingHours = signal<number | null>(null);
  readonly editingDate = signal<Date | null>(null);
  readonly editingComment = signal<string>('');
  readonly editingActivityId = signal<string | null>(null);
  readonly isSavingEntry = signal<boolean>(false);
  readonly editError = signal<string | null>(null);

  readonly groupOption = [
    { label: 'report.groupNone', value: 'none' as GroupBy },
    { label: 'report.groupDate', value: 'spentOn' as GroupBy },
    { label: 'report.groupUser', value: 'user' as GroupBy },
    { label: 'report.groupActivity', value: 'activity' as GroupBy },
    { label: 'report.groupProject', value: 'project' as GroupBy },
    { label: 'report.groupWorkPackage', value: 'workPackage' as GroupBy },
  ];

  readonly reportRow = computed<TimeCostReportRow[]>(() =>
    this.timeEntry().map((entry) => ({
      ...entry,
      hoursSort: this.openprojectService.isoDurationToMinutes(entry.hours),
      startTimeSort: entry.startTime || '',
    }))
  );

  readonly groupRow = computed<TimeCostGroupRow[]>(() => {
    const group = this.groupBy();
    if (group === 'none') return [];

    const groups = new Map<string, TimeCostGroupRow>();
    for (const entry of this.timeEntry()) {
      const label = this.getGroupLabel(entry, group);
      const key = label || '—';
      const row = groups.get(key) || {
        key,
        label: key,
        entryCount: 0,
        totalMinutes: 0,
      };
      row.entryCount += 1;
      row.totalMinutes += this.openprojectService.isoDurationToMinutes(entry.hours);
      groups.set(key, row);
    }

    return [...groups.values()].sort((first, second) => first.label.localeCompare(second.label));
  });

  readonly totalMinutes = computed(() =>
    this.timeEntry().reduce((total, entry) => total + this.openprojectService.isoDurationToMinutes(entry.hours), 0)
  );
  readonly totalHoursLabel = computed(() => formatTimeMinutes(this.totalMinutes(), 'HH:MM'));
  readonly hasCostSummary = computed(() => {
    const summary = this.costSummary();
    return !!(summary?.laborCosts || summary?.materialCosts || summary?.overallCosts);
  });

  constructor() {
    effect(() => {
      const params = this.routeQueryParams();
      const signature = params.toString();
      if (signature === this.lastQuerySignature) return;
      this.lastQuerySignature = signature;
      this.applyQueryParams(params);
      void this.loadReportOptions().then(() => this.runQuery());
    });

    this.lastQuerySignature = this.route.snapshot.queryParamMap.toString();
    this.applyQueryParams(this.route.snapshot.queryParamMap);
    void this.openprojectService.getCurrentUserId().then((id) => this.currentUserId.set(id));
    void this.loadReportOptions().then(() => {
      if (this.ticketId().trim() || this.projectId()) void this.runQuery();
    });
  }

  private async resolveTicketProject(ticketId: string): Promise<void> {
    try {
      const context = await this.workPackageApi.getTicketContext(ticketId, {
        includeDescription: false,
        includeComments: false,
        includeAttachments: false,
      });
      const projectId = context.project_id;
      if (!projectId) return;
      this.projectId.set(projectId);
      if (!this.projectIdentifier()) {
        this.projectIdentifier.set(
          this.projectOption().find((project) => project.id === projectId)?.identifier || ''
        );
      }
    } catch {
      // Project resolution is best-effort; the ticket filter still returns entries.
    }
  }

  private applyQueryParams(params: { get(name: string): string | null }): void {
    this.ticketId.set((params.get('ticket') || '').replace(/^#/, ''));
    this.projectId.set(params.get('projectId'));
    this.projectIdentifier.set(params.get('identifier') || '');
    this.returnUrl.set(this.parseReturnUrl(params.get('returnUrl')));
    this.includeDescendants.set(params.get('includeDescendants') !== 'false');
    this.userId.set(params.get('userId') || '');
    this.activityId.set(params.get('activityId'));
    this.spentOnFrom.set(this.parseQueryDate(params.get('spentOnFrom')));
    this.spentOnTo.set(this.parseQueryDate(params.get('spentOnTo')));

    const group = params.get('groupBy');
    const groupValues: GroupBy[] = ['none', 'spentOn', 'user', 'activity', 'project', 'workPackage'];
    this.groupBy.set(
      group && groupValues.includes(group as GroupBy) ? (group as GroupBy) : 'none'
    );
  }

  private parseQueryDate(value: string | null): Date | null {
    if (!value) return null;
    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private parseReturnUrl(value: string | null): string {
    if (!value || !value.startsWith('/dashboard')) return '';
    return value;
  }

  private syncQueryParams(filter: TimeCostReportFilter): void {
    const params: Record<string, string> = {};
    const assign = (key: string, value?: string | boolean | null): void => {
      if (value === undefined || value === null || value === '' || value === false) return;
      params[key] = String(value);
    };

    assign('ticket', filter.ticketId);
    assign('projectId', filter.projectId);
    assign('identifier', this.projectIdentifier());
    assign('userId', filter.userId);
    assign('activityId', filter.activityId);
    assign('spentOnFrom', filter.spentOnFrom);
    assign('spentOnTo', filter.spentOnTo);
    if (this.groupBy() !== 'none') assign('groupBy', this.groupBy());
    assign('returnUrl', this.returnUrl());
    if (filter.ticketId) params['includeDescendants'] = String(filter.includeDescendants !== false);

    const serialized = new URLSearchParams(params).toString();
    if (serialized === this.lastQuerySignature) return;
    this.lastQuerySignature = serialized;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      replaceUrl: true,
    });
  }

  goBack(): void {
    const returnUrl = this.returnUrl();
    if (returnUrl) void this.router.navigateByUrl(returnUrl);
  }

  async loadReportOptions(): Promise<void> {
    const [projectOption, activityOption] = await Promise.all([
      this.projectApi.getProjects(),
      this.timeEntryApi.getTimeEntryActivities(this.ticketId() || undefined),
    ]);
    this.projectOption.set(projectOption);
    this.activityOption.set(activityOption);

    if (this.projectId() && !this.projectIdentifier()) {
      this.projectIdentifier.set(projectOption.find((project) => project.id === this.projectId())?.identifier || '');
    }
  }

  onProjectChange(projectId: string | null): void {
    this.projectId.set(projectId);
    this.projectIdentifier.set(
      this.projectOption().find((project) => project.id === projectId)?.identifier || ''
    );
  }

  async runQuery(): Promise<void> {
    this.errorMessage.set(null);
    const ticketId = this.ticketId().trim();
    const projectId = this.projectId();
    if (!ticketId && !projectId) {
      this.errorMessage.set('report.filterRequired');
      this.timeEntry.set([]);
      this.costSummary.set(null);
      return;
    }

    this.isLoading.set(true);
    try {
      if (ticketId && !this.projectId()) {
        await this.resolveTicketProject(ticketId);
      }

      const filter: TimeCostReportFilter = {
        ticketId: ticketId || undefined,
        projectId: this.projectId() || undefined,
        userId: this.userId().trim() || undefined,
        activityId: this.activityId() || undefined,
        spentOnFrom: this.spentOnFrom() ? this.toIsoDate(this.spentOnFrom()!) : undefined,
        spentOnTo: this.spentOnTo() ? this.toIsoDate(this.spentOnTo()!) : undefined,
        includeDescendants: ticketId ? this.includeDescendants() : false,
      };
      const entries = await this.timeEntryApi.getTimeCostReportEntries(filter);
      this.timeEntry.set(entries);
      this.syncQueryParams(filter);

      const canShowWholePackageCosts = !!ticketId && !filter.userId && !filter.activityId && !filter.spentOnFrom && !filter.spentOnTo;
      this.costSummary.set(
        canShowWholePackageCosts
          ? await this.workPackageApi.getWorkPackageCostSummary(ticketId)
          : null
      );
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : String(error));
      this.timeEntry.set([]);
      this.costSummary.set(null);
    } finally {
      this.isLoading.set(false);
    }
  }

  canEditTimeEntry(entry: PlatformTimeEntry): boolean {
    return !!this.currentUserId() && entry.userId === this.currentUserId();
  }

  startEditingTimeEntry(entry: PlatformTimeEntry): void {
    if (!this.canEditTimeEntry(entry)) return;
    this.editingTimeEntryId.set(entry.id);
    this.editingHours.set(Number((this.openprojectService.isoDurationToMinutes(entry.hours) / 60).toFixed(2)));
    this.editingDate.set(entry.spentOn ? new Date(`${entry.spentOn}T00:00:00`) : null);
    this.editingComment.set(entry.comment || '');
    this.editingActivityId.set(entry.activityId || null);
    this.editError.set(null);
  }

  cancelEditing(): void {
    this.editingTimeEntryId.set(null);
    this.editingHours.set(null);
    this.editingDate.set(null);
    this.editingComment.set('');
    this.editingActivityId.set(null);
    this.editError.set(null);
  }

  async saveTimeEntry(): Promise<void> {
    const entry = this.timeEntry().find((item) => item.id === this.editingTimeEntryId());
    const hours = this.editingHours();
    const spentOn = this.editingDate();
    if (!entry || !this.canEditTimeEntry(entry) || !hours || hours <= 0 || !spentOn) {
      this.editError.set('ticketDetail.invalidTimeEntry');
      return;
    }

    this.isSavingEntry.set(true);
    this.editError.set(null);
    try {
      const result = await this.timeEntryApi.updateTimeEntry(entry.id, {
        hours: `PT${Number(hours.toFixed(2))}H`,
        spentOn: this.toIsoDate(spentOn),
        comment: this.editingComment().trim(),
        activityId: this.editingActivityId(),
      });
      if (!result.ok) {
        this.editError.set(result.error || 'Could not update this time entry.');
        return;
      }
      this.cancelEditing();
      await this.runQuery();
    } finally {
      this.isSavingEntry.set(false);
    }
  }

  async openCostReport(): Promise<void> {
    const ticketId = this.ticketId().trim();
    const project = this.projectOption().find((item) => item.id === this.projectId());
    const identifier = this.projectIdentifier() || project?.identifier || '';
    if (!ticketId || !identifier) return;
    const url = this.timeEntryApi.getCostReportUrl(ticketId, identifier);
    try {
      await openUrl(url);
    } catch {
      window.open(url, '_blank');
    }
  }

  formatDuration(iso?: string | null): string {
    return formatIsoDuration(iso) || '—';
  }

  formatMinutesLabel(minutes: number): string {
    return formatTimeMinutes(minutes, 'HH:MM');
  }

  formatDate(isoDate: string): string {
    if (!isoDate) return '—';
    return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: '2-digit' })
      .format(new Date(`${isoDate}T00:00:00`));
  }

  formatTime(startTime?: string | null): string {
    if (!startTime) return '—';
    return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(startTime));
  }

  private getGroupLabel(entry: PlatformTimeEntry, group: GroupBy): string {
    switch (group) {
      case 'spentOn': return this.formatDate(entry.spentOn);
      case 'user': return entry.userName || '—';
      case 'activity': return entry.activityName || '—';
      case 'project': return entry.projectName || '—';
      case 'workPackage': return entry.workPackageName || '—';
      default: return '—';
    }
  }

  private toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
