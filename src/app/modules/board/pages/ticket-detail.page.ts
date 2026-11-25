import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ButtonDirective } from 'primeng/button';
import { Select } from 'primeng/select';
import { DatePicker } from 'primeng/datepicker';
import { InputText } from 'primeng/inputtext';
import { InputNumber } from 'primeng/inputnumber';
import { Textarea } from 'primeng/textarea';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from 'primeng/tabs';
import { Tag } from 'primeng/tag';
import { Skeleton } from 'primeng/skeleton';
import { Avatar } from 'primeng/avatar';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerExternalLink,
  tablerEdit,
  tablerCheck,
  tablerX,
  tablerPaperclip,
  tablerPhoto,
  tablerSend,
  tablerAlertCircle,
  tablerArrowLeft,
} from '@ng-icons/tabler-icons';
import { openUrl } from '@tauri-apps/plugin-opener';
import { OpenprojectService } from '../../../core/services/openproject.service';
import { ActivityService } from '../../../core/services/activity.service';
import {
  BoardColumnOption,
  PlatformTimeEntry,
  TicketAttachment,
  TicketComment,
  TicketContextResult,
  UpdateWorkPackagePayload,
  WorkPackageFormSchema,
} from '../../../core/interfaces/openproject.interface';
import { Activity } from '../../../core/interfaces/activity.interface';
import { formatIsoDuration, formatTimeMinutes } from '../../../shared/format/time';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-ticket-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonDirective,
    Select,
    DatePicker,
    InputText,
    InputNumber,
    Textarea,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    Tag,
    Skeleton,
    Avatar,
    NgIcon,
    TranslatePipe,
  ],
  viewProviders: [
    provideIcons({
      tablerExternalLink,
      tablerEdit,
      tablerCheck,
      tablerX,
      tablerPaperclip,
      tablerPhoto,
      tablerSend,
      tablerAlertCircle,
      tablerArrowLeft,
    }),
  ],
  templateUrl: './ticket-detail.page.html',
})
export class TicketDetailPage {
  private readonly openprojectService = inject(OpenprojectService);
  private readonly activityService = inject(ActivityService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly routeParams = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  private readonly routeQueryParams = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });

  readonly ticketId = computed(() => {
    const ticketId = Number(this.routeParams().get('ticketId'));
    return Number.isSafeInteger(ticketId) && ticketId > 0 ? ticketId : null;
  });
  readonly projectId = computed(() => this.routeParams().get('projectId') || '');
  readonly boardId = computed(() => this.routeParams().get('boardId') || '');
  readonly boardColumns = signal<BoardColumnOption[]>([]);

  readonly isLoading = signal<boolean>(false);
  readonly isSaving = signal<boolean>(false);
  readonly isPostingComment = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  readonly ticketData = signal<TicketContextResult | null>(null);
  readonly formSchema = signal<WorkPackageFormSchema>({
    statuses: [],
    priorities: [],
    assignees: [],
    responsibles: [],
    versions: [],
  });
  readonly platformTimeEntries = signal<PlatformTimeEntry[]>([]);
  readonly activeTab = signal<string>('comments');

  // Inline edit state
  readonly isEditingSubject = signal<boolean>(false);
  readonly subjectDraft = signal<string>('');
  readonly isEditingDescription = signal<boolean>(false);
  readonly descriptionDraft = signal<string>('');
  readonly newComment = signal<string>('');

  // Editable attribute signals
  readonly selectedStatusId = signal<string | null>(null);
  readonly selectedColumnQueryId = signal<string | null>(null);
  readonly selectedAssigneeId = signal<string | null>(null);
  readonly selectedResponsibleId = signal<string | null>(null);
  readonly selectedPriorityId = signal<string | null>(null);
  readonly selectedVersionId = signal<string | null>(null);
  readonly startDateValue = signal<Date | null>(null);
  readonly dueDateValue = signal<Date | null>(null);
  readonly estimatedHours = signal<number | null>(null);

  readonly comments = computed<TicketComment[]>(() => ticketDataList(this.ticketData()?.comments));
  readonly attachments = computed<TicketAttachment[]>(() => ticketDataList(this.ticketData()?.attachments));

  readonly statusOptions = computed(() => {
    const schemaStatuses = this.formSchema().statuses;
    if (schemaStatuses.length > 0) return schemaStatuses;
    return this.ticketData()?.available_statuses ?? [];
  });

  readonly sanitizedDescription = computed<SafeHtml | null>(() => {
    const desc = this.ticketData()?.description;
    const html = desc?.html || desc?.raw;
    return html ? this.sanitizer.bypassSecurityTrustHtml(html) : null;
  });

  readonly localActivities = computed<Activity[]>(() => {
    const id = this.ticketId();
    if (!id) return [];
    const target = String(id);
    return this.activityService
      .activities()
      .filter((a) => (a.ticket || '').replace(/^#/, '') === target);
  });

  readonly platformTotalMinutes = computed<number>(() => {
    const entries = this.platformTimeEntries();
    if (entries.length > 0) {
      return entries.reduce((acc, e) => acc + this.openprojectService.isoDurationToMinutes(e.hours), 0);
    }
    return this.openprojectService.isoDurationToMinutes(this.ticketData()?.spent_time);
  });

  readonly localPendingMinutes = computed<number>(() => {
    return this.localActivities()
      .filter((a) => !a.synced)
      .reduce((acc, a) => acc + (a.minutes || 0), 0);
  });

  constructor() {
    effect(() => {
      const id = this.ticketId();
      if (id) {
        void this.loadTicket(id);
      } else {
        this.errorMessage.set('Invalid ticket ID.');
      }
    });

    effect(() => {
      const boardId = this.boardId();
      const ticketId = this.ticketId();
      if (boardId) {
        void this.loadBoardColumns(boardId, ticketId);
      }
    });
  }

  async loadBoardColumns(boardId: string, ticketId: number | null): Promise<void> {
    try {
      const columns = await this.openprojectService.getBoardColumns(boardId, true);
      this.boardColumns.set(columns);
      const queryId = this.routeQueryParams().get('column');
      const requestedColumn = columns.find((column) => column.queryId === queryId);
      const ticketColumn = columns.find(
        (column) =>
          column.workPackageIds.includes(ticketId ?? -1) ||
          column.workPackages?.some((workPackage) => workPackage.id === ticketId)
      );
      this.selectedColumnQueryId.set(requestedColumn?.queryId ?? ticketColumn?.queryId ?? null);
    } catch {
      this.boardColumns.set([]);
      this.selectedColumnQueryId.set(null);
    }
  }

  goBackToBoard(): void {
    this.router.navigate(['/dashboard/boards', this.projectId(), this.boardId()], {
      queryParamsHandling: 'preserve',
    });
  }

  async loadTicket(id: number): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.isEditingSubject.set(false);
    this.isEditingDescription.set(false);

    try {
      const ticketStr = String(id);
      const [ctx, schema, timeEntries] = await Promise.all([
        this.openprojectService.getTicketContext(ticketStr, {
          includeDescription: true,
          includeComments: true,
          includeAttachments: true,
        }),
        this.openprojectService.getWorkPackageForm(ticketStr),
        this.openprojectService.getWorkPackageTimeEntries(ticketStr),
      ]);

      if (!ctx.success) {
        this.errorMessage.set(ctx.message || 'Error');
        return;
      }

      this.ticketData.set(ctx);
      this.formSchema.set(schema);
      this.platformTimeEntries.set(timeEntries);

      this.selectedStatusId.set(ctx.status_id ?? null);
      this.selectedVersionId.set(
        ctx.version_id ?? schema.versions.find((v) => v.name === ctx.version_name)?.id ?? null
      );
      this.selectedAssigneeId.set(
        schema.assignees.find((a) => a.name === ctx.assignee_name)?.id ?? null
      );
      this.selectedResponsibleId.set(
        schema.responsibles.find((r) => r.name === ctx.responsible_name)?.id ?? null
      );
      this.selectedPriorityId.set(
        schema.priorities.find((p) => p.name === ctx.priority_name)?.id ?? null
      );
      this.startDateValue.set(ctx.start_date ? new Date(`${ctx.start_date}T00:00:00`) : null);
      this.dueDateValue.set(ctx.due_date ? new Date(`${ctx.due_date}T00:00:00`) : null);

      const estMins = this.openprojectService.isoDurationToMinutes(ctx.estimated_time);
      this.estimatedHours.set(estMins > 0 ? parseFloat((estMins / 60).toFixed(2)) : null);
    } finally {
      this.isLoading.set(false);
    }
  }

  startEditSubject(): void {
    this.subjectDraft.set(this.ticketData()?.subject || '');
    this.isEditingSubject.set(true);
  }

  async saveSubject(): Promise<void> {
    const trimmed = this.subjectDraft().trim();
    if (!trimmed) return;
    const ok = await this.onFieldPatch({ subject: trimmed });
    if (ok) {
      this.isEditingSubject.set(false);
    }
  }

  startEditDescription(): void {
    this.descriptionDraft.set(this.ticketData()?.description?.raw || '');
    this.isEditingDescription.set(true);
  }

  async saveDescription(): Promise<void> {
    const ok = await this.onFieldPatch({ descriptionRaw: this.descriptionDraft() });
    if (ok) {
      this.isEditingDescription.set(false);
    }
  }

  async onAssigneeChange(assigneeId: string | null): Promise<void> {
    this.selectedAssigneeId.set(assigneeId);
    if (assigneeId) {
      await this.onFieldPatch({ assigneeId });
    } else {
      await this.onFieldPatch({ clearAssignee: true });
    }
  }

  async onResponsibleChange(responsibleId: string | null): Promise<void> {
    this.selectedResponsibleId.set(responsibleId);
    if (responsibleId) {
      await this.onFieldPatch({ responsibleId });
    } else {
      await this.onFieldPatch({ clearResponsible: true });
    }
  }

  async onVersionChange(versionId: string | null): Promise<void> {
    this.selectedVersionId.set(versionId);
    if (versionId) {
      await this.onFieldPatch({ versionId });
    } else {
      await this.onFieldPatch({ clearVersion: true });
    }
  }

  async onDateChange(field: 'startDate' | 'dueDate', date: Date | null): Promise<void> {
    if (field === 'startDate') {
      this.startDateValue.set(date);
      if (date) {
        await this.onFieldPatch({ startDate: this.toIsoDate(date) });
      } else {
        await this.onFieldPatch({ clearStartDate: true });
      }
    } else {
      this.dueDateValue.set(date);
      if (date) {
        await this.onFieldPatch({ dueDate: this.toIsoDate(date) });
      } else {
        await this.onFieldPatch({ clearDueDate: true });
      }
    }
  }

  async saveEstimatedTime(): Promise<void> {
    const hrs = this.estimatedHours();
    if (hrs === null || hrs === undefined) return;
    await this.onFieldPatch({ estimatedTime: `PT${hrs}H` });
  }

  async onColumnChange(targetQueryId: string): Promise<void> {
    const id = this.ticketId();
    const sourceQueryId = this.selectedColumnQueryId();
    if (!id || !targetQueryId || targetQueryId === sourceQueryId) return;

    this.isSaving.set(true);
    try {
      const targetCol = this.boardColumns().find((c) => c.queryId === targetQueryId);
      const res = await this.openprojectService.moveWorkPackageToBoardColumn(
        String(id),
        targetQueryId,
        sourceQueryId || undefined,
        targetCol?.statusId
      );
      if (res.ok) {
        this.selectedColumnQueryId.set(targetQueryId);
        await this.loadTicket(id);
      }
    } finally {
      this.isSaving.set(false);
    }
  }

  async onFieldPatch(payload: UpdateWorkPackagePayload): Promise<boolean> {
    const id = this.ticketId();
    if (!id) return false;
    this.isSaving.set(true);
    try {
      const res = await this.openprojectService.updateWorkPackage(String(id), {
        ...payload,
        lockVersion: this.ticketData()?.lock_version ?? undefined,
      });
      if (res.ok) {
        await this.loadTicket(id);
        return true;
      }
      return false;
    } finally {
      this.isSaving.set(false);
    }
  }

  async postComment(): Promise<void> {
    const id = this.ticketId();
    const text = this.newComment().trim();
    if (!id || !text) return;

    this.isPostingComment.set(true);
    try {
      const res = await this.openprojectService.addWorkPackageComment(String(id), text);
      if (res.ok) {
        this.newComment.set('');
        await this.loadTicket(id);
      }
    } finally {
      this.isPostingComment.set(false);
    }
  }

  async openInBrowser(): Promise<void> {
    const id = this.ticketId();
    if (!id) return;
    const url = this.openprojectService.getWorkPackageUrl(String(id));
    try {
      await openUrl(url);
    } catch {
      window.open(url, '_blank');
    }
  }

  async openAttachment(att: TicketAttachment): Promise<void> {
    const url = att.downloadUrl || att.download_url;
    if (!url) return;
    try {
      const dataUrl = await this.openprojectService.fetchAttachmentContent(url);
      window.open(dataUrl, '_blank');
    } catch {
      // Ignore error
    }
  }

  sanitizeHtml(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  }

  formatDateTime(iso: string): string {
    if (!iso) return '';
    return iso.slice(0, 16).replace('T', ' ');
  }

  formatDuration(iso?: string | null): string {
    return formatIsoDuration(iso) || '—';
  }

  formatMinutesLabel(minutes: number): string {
    return formatTimeMinutes(minutes, 'HH:MM');
  }

  getSelectedColumnName(): string {
    return this.boardColumns().find((column) => column.queryId === this.selectedColumnQueryId())?.name || '—';
  }

  private toIsoDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

function ticketDataList<T>(val: T[] | null | undefined): T[] {
  return Array.isArray(val) ? val : [];
}
