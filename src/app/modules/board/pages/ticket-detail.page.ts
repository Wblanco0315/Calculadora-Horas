import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Subscription, exhaustMap, interval } from 'rxjs';
import { ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Select } from 'primeng/select';
import { DatePicker } from 'primeng/datepicker';
import { InputText } from 'primeng/inputtext';
import { InputNumber } from 'primeng/inputnumber';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from 'primeng/tabs';
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
  tablerClockPlus,
  tablerDownload,
  tablerFolderOpen,
} from '@ng-icons/tabler-icons';
import { openUrl, revealItemInDir } from '@tauri-apps/plugin-opener';
import { BreadcrumbService } from '../../../core/services/breadcrumb.service';
import { OpenprojectService } from '../../../core/services/openproject.service';
import { ActivityService } from '../../../core/services/activity.service';
import { WorkPackageChangeService } from '../../../core/services/work-package-change.service';
import {
  BoardColumnOption,
  TicketAttachment,
  TicketComment,
  TicketContextResult,
  UpdateWorkPackagePayload,
  WorkPackageFormSchema,
} from '../../../core/interfaces/openproject.interface';
import { Activity } from '../../../core/interfaces/activity.interface';
import { formatIsoDuration, formatTimeMinutes } from '../../../shared/format/time';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { ActivityFormModalComponent } from '../../compact/modals/activity-form-modal/activity-form-modal.component';
import { RichTextEditorComponent } from '../../../shared/components/rich-text-editor/rich-text-editor.component';

const ACTIVITY_FILTERS = ['all', 'changes', 'comments'] as const;
const ACTIVITY_ORDERS = ['oldestFirst', 'newestFirst'] as const;
const ACTIVITY_FILTER_KEY = 'pocketproject.ticketDetail.activityFilter';
const ACTIVITY_ORDER_KEY = 'pocketproject.ticketDetail.activityOrder';
type ActivityFilter = (typeof ACTIVITY_FILTERS)[number];
type ActivityOrder = (typeof ACTIVITY_ORDERS)[number];

interface VisibleActivity {
  comment: TicketComment;
  showComment: boolean;
  showDetails: boolean;
}

function readStoredOption<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const stored = localStorage.getItem(key) as T | null;
    return stored && allowed.includes(stored) ? stored : fallback;
  } catch {
    return fallback;
  }
}

@Component({
  selector: 'app-ticket-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonDirective,
    ButtonIcon,
    ButtonLabel,
    Dialog,
    Select,
    DatePicker,
    InputText,
    InputNumber,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    Skeleton,
    Avatar,
    NgIcon,
    TranslatePipe,
    RichTextEditorComponent,
    ActivityFormModalComponent,
  ],
  viewProviders: [
    provideIcons({
      tablerDownload,
      tablerFolderOpen,
      tablerExternalLink,
      tablerEdit,
      tablerCheck,
      tablerX,
      tablerPaperclip,
      tablerPhoto,
      tablerSend,
      tablerAlertCircle,
      tablerArrowLeft,
      tablerClockPlus,
    }),
  ],
  templateUrl: './ticket-detail.page.html',
  styles: [
    `
      :host ::ng-deep .ticket-status-select .p-select-label,
      :host ::ng-deep .ticket-status-select .p-select-dropdown {
        color: var(--p-select-color) !important;
      }

      /* Label/value rows adapt to the main column width (not the viewport). */
      .ticket-detail-main {
        container-type: inline-size;
      }
      .ticket-field-grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 0.875rem 2rem;
      }
      .ticket-field {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 0.375rem;
        min-width: 0;
      }
      .ticket-field > * {
        min-width: 0;
      }
      @container (min-width: 26rem) {
        .ticket-field {
          grid-template-columns: minmax(7rem, 0.8fr) minmax(0, 1.3fr);
          align-items: center;
          gap: 0.75rem;
        }
        .ticket-field--wide {
          align-items: start;
        }
      }
      @container (min-width: 44rem) {
        .ticket-field-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .ticket-field--wide {
          grid-column: 1 / -1;
          grid-template-columns: minmax(7rem, 0.39fr) minmax(0, 1.61fr);
        }
      }
    `,
  ],
  host: {
    class: 'flex w-full min-w-0 flex-1 min-h-0 flex-col',
  },
})
export class TicketDetailPage {
  private readonly openprojectService = inject(OpenprojectService);
  private readonly activityService = inject(ActivityService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly workPackageChangeService = inject(WorkPackageChangeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly breadcrumbService = inject(BreadcrumbService);
  private changeCheckSubscription?: Subscription;
  private updateStreamCursor = '';
  private updateTimestampSnapshot: string | null = null;
  private readonly routeParams = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  private readonly routeQueryParams = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });

  readonly ticketId = computed(() => {
    const ticketId = Number(this.routeParams().get('ticketId'));
    return Number.isSafeInteger(ticketId) && ticketId > 0 ? ticketId : null;
  });
  readonly projectId = computed(() => this.routeParams().get('projectId') || '');
  readonly boardId = computed(() => this.routeParams().get('boardId') || '');
  readonly projectIdentifier = computed(() => this.routeQueryParams().get('identifier') || '');
  readonly boardColumns = signal<BoardColumnOption[]>([]);
  readonly selectedStatusColor = computed(() => {
    const selectedStatus = this.statusOptions().find((status) => status.id === this.selectedStatusId());
    return selectedStatus?.color || this.ticketData()?.status_color || '#3b82f6';
  });
  readonly selectedStatusTextColor = computed(() => getContrastingTextColor(this.selectedStatusColor()));

  readonly isLoading = signal<boolean>(false);
  readonly isSaving = signal<boolean>(false);
  readonly isPostingComment = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly saveError = signal<string | null>(null);
  readonly remoteChangeAvailable = signal<boolean>(false);

  readonly ticketData = signal<TicketContextResult | null>(null);
  readonly formSchema = signal<WorkPackageFormSchema>({
    statuses: [],
    priorities: [],
    assignees: [],
    responsibles: [],
    versions: [],
  });
  readonly activeTab = signal<string>('comments');

  // Inline edit state
  readonly isEditingSubject = signal<boolean>(false);
  readonly subjectDraft = signal<string>('');
  readonly isEditingDescription = signal<boolean>(false);
  readonly descriptionDraft = signal<string>('');
  readonly newComment = signal<string>('');
  readonly isComposingComment = signal<boolean>(false);
  readonly downloadingAttachmentIds = signal<ReadonlySet<TicketAttachment['id']>>(new Set());
  readonly downloadedAttachmentPaths = signal<ReadonlyMap<TicketAttachment['id'], string>>(new Map());
  readonly attachmentDownloadErrors = signal<ReadonlySet<TicketAttachment['id']>>(new Set());

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

  // Activity filters (same options as OpenProject's activity tab)
  readonly activityFilter = signal<ActivityFilter>(readStoredOption(ACTIVITY_FILTER_KEY, ACTIVITY_FILTERS, 'all'));
  readonly activityOrder = signal<ActivityOrder>(readStoredOption(ACTIVITY_ORDER_KEY, ACTIVITY_ORDERS, 'oldestFirst'));
  readonly activityFilterOptions = ACTIVITY_FILTERS.map((value) => ({ value, label: `ticketDetail.activityFilter.${value}` }));
  readonly activityOrderOptions = ACTIVITY_ORDERS.map((value) => ({ value, label: `ticketDetail.activityOrder.${value}` }));

  readonly visibleActivities = computed<VisibleActivity[]>(() => {
    const filter = this.activityFilter();
    const entries = this.comments()
      .map((comment) => {
        const hasComment = !!(comment.commentHtml || comment.comment_html || comment.commentRaw || comment.comment_raw);
        const hasDetails = (comment.details?.length ?? 0) > 0;
        return {
          comment,
          showComment: hasComment && filter !== 'changes',
          showDetails: hasDetails && filter !== 'comments',
        };
      })
      .filter((entry) => entry.showComment || entry.showDetails);
    return this.activityOrder() === 'newestFirst' ? entries.reverse() : entries;
  });

  /** People that can be mentioned with `@` in the editors. */
  readonly mentionUsers = computed(() => {
    const byId = new Map<string, { id: string; name: string }>();
    for (const user of [...this.formSchema().assignees, ...this.formSchema().responsibles]) {
      if (user.id && user.name && !byId.has(user.id)) byId.set(user.id, { id: user.id, name: user.name });
    }
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
  });
  readonly attachments = computed<TicketAttachment[]>(() => ticketDataList(this.ticketData()?.attachments));
  readonly statusOptions = computed(() => {
    const schemaStatuses = this.formSchema().statuses;
    if (schemaStatuses.length > 0) return schemaStatuses;
    return this.ticketData()?.available_statuses ?? [];
  });

  /** Description / comment HTML with OpenProject images replaced by authenticated object URLs. */
  private readonly resolvedDescriptionHtml = signal<string | null>(null);
  private readonly resolvedCommentHtml = signal<ReadonlyMap<string, string>>(new Map());
  private richContentRequest = 0;
  readonly previewImageUrl = signal<string | null>(null);

  readonly sanitizedDescription = computed<SafeHtml | null>(() => {
    const html = this.resolvedDescriptionHtml();
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

  readonly pendingLocalActivities = computed<Activity[]>(() =>
    this.localActivities().filter((a) => !a.synced)
  );

  readonly localPendingMinutes = computed<number>(() =>
    this.pendingLocalActivities().reduce((acc, a) => acc + (a.minutes || 0), 0)
  );

  constructor() {
    effect(() => {
      const id = this.ticketId();
      if (id) {
        void this.loadTicket(id);
      } else {
        this.errorMessage.set('Invalid ticket ID.');
      }
    });

    // Publish the ticket subject for the dashboard breadcrumb.
    effect(() => {
      const id = this.ticketId();
      const subject = this.ticketData()?.subject ?? '';
      this.breadcrumbService.ticket.set(id ? { id, subject } : null);
    });
    this.destroyRef.onDestroy(() => this.breadcrumbService.ticket.set(null));

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
    if (this.projectId() && this.boardId()) {
      this.router.navigate(['/dashboard/boards', this.projectId(), this.boardId()], {
        queryParamsHandling: 'preserve',
      });
      return;
    }
    // Opened directly by ID (sidebar search): go back to the ticket's project board list.
    const ticket = this.ticketData();
    if (ticket?.project_id) {
      this.router.navigate(['/dashboard/boards', ticket.project_id], {
        queryParams: { name: ticket.project_name || '' },
      });
      return;
    }
    this.router.navigate(['/dashboard/overview']);
  }

  async loadTicket(id: number): Promise<void> {
    this.changeCheckSubscription?.unsubscribe();
    this.remoteChangeAvailable.set(false);
    this.saveError.set(null);
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.isEditingSubject.set(false);
    this.isEditingDescription.set(false);

    try {
      const ticketStr = String(id);
      const [ctx, schema] = await Promise.all([
        this.openprojectService.getTicketContext(ticketStr, {
          includeDescription: true,
          includeComments: true,
          includeAttachments: true,
        }),
        this.openprojectService.getWorkPackageForm(ticketStr),
      ]);

      if (!ctx.success) {
        this.errorMessage.set(ctx.message || 'Error');
        return;
      }

      this.ticketData.set(ctx);
      void this.resolveRichContentImages(ctx);
      this.formSchema.set(schema);

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
      if (ctx.lock_version !== null && ctx.lock_version !== undefined) {
        this.startWatchingTicketChanges(id, ctx.lock_version, ctx.updated_at || ctx.updatedAt || null);
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * OpenProject returns images as `/api/v3/attachments/{id}/content`, which the webview cannot load
   * (relative to the app origin and requires the API token). Show the text right away with images
   * on hold, then swap in authenticated object URLs.
   */
  private async resolveRichContentImages(ctx: TicketContextResult): Promise<void> {
    const request = ++this.richContentRequest;
    const descriptionHtml = ctx.description?.html || ctx.description?.raw || null;
    const commentHtmlById = new Map<string, string>();
    for (const comment of ticketDataList(ctx.comments)) {
      const html = comment.commentHtml || comment.comment_html || comment.commentRaw || comment.comment_raw || '';
      if (html) commentHtmlById.set(String(comment.id), html);
    }

    this.resolvedDescriptionHtml.set(descriptionHtml ? holdInlineImages(descriptionHtml) : null);
    this.resolvedCommentHtml.set(
      new Map(Array.from(commentHtmlById, ([id, html]) => [id, holdInlineImages(html)]))
    );

    const [description, comments] = await Promise.all([
      descriptionHtml ? this.openprojectService.resolveInlineAttachmentImages(descriptionHtml) : null,
      Promise.all(
        Array.from(commentHtmlById, async ([id, html]) => {
          const resolved = await this.openprojectService.resolveInlineAttachmentImages(html);
          return [id, resolved] as const;
        })
      ),
    ]);
    if (request !== this.richContentRequest) return;
    this.resolvedDescriptionHtml.set(description);
    this.resolvedCommentHtml.set(new Map(comments));
  }

  setActivityFilter(filter: ActivityFilter): void {
    this.activityFilter.set(filter);
    localStorage.setItem(ACTIVITY_FILTER_KEY, filter);
  }

  setActivityOrder(order: ActivityOrder): void {
    this.activityOrder.set(order);
    localStorage.setItem(ACTIVITY_ORDER_KEY, order);
  }

  commentHtml(comment: TicketComment): SafeHtml | null {
    const html = this.resolvedCommentHtml().get(String(comment.id));
    return html ? this.sanitizer.bypassSecurityTrustHtml(html) : null;
  }

  onRichContentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (target instanceof HTMLImageElement && !target.hasAttribute('data-op-pending-src')) {
      event.preventDefault();
      this.previewImageUrl.set(target.currentSrc || target.src);
    }
  }

  private startWatchingTicketChanges(
    ticketId: number,
    lockVersion: number,
    updatedAt: string | null
  ): void {
    this.updateStreamCursor = new Date().toISOString();
    this.updateTimestampSnapshot = updatedAt;
    this.changeCheckSubscription?.unsubscribe();
    this.changeCheckSubscription = interval(15_000)
      .pipe(
        exhaustMap(() =>
          this.workPackageChangeService.checkForChanges(
            String(ticketId),
            lockVersion,
            this.updateStreamCursor,
            this.updateTimestampSnapshot
          )
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((result) => {
        this.updateStreamCursor = result.checkedAt;
        if (result.changed) {
          this.remoteChangeAvailable.set(true);
          this.changeCheckSubscription?.unsubscribe();
        }
      });
  }

  reloadRemoteChanges(): void {
    const id = this.ticketId();
    if (id) void this.loadTicket(id);
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
    if (this.isSaving()) return;
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

  async onStatusChange(statusId: string): Promise<void> {
    const previousStatusId = this.selectedStatusId();
    this.selectedStatusId.set(statusId);
    const saved = await this.onFieldPatch({ statusId });
    if (!saved) {
      this.selectedStatusId.set(previousStatusId);
    }
  }

  async onColumnChange(targetQueryId: string): Promise<void> {
    const id = this.ticketId();
    const sourceQueryId = this.selectedColumnQueryId();
    if (!id || !targetQueryId || targetQueryId === sourceQueryId) return;

    this.isSaving.set(true);
    try {
      const expectedLockVersion = this.ticketData()?.lock_version;
      if (expectedLockVersion !== null && expectedLockVersion !== undefined) {
        const check = await this.workPackageChangeService.checkForChanges(
          String(id),
          expectedLockVersion,
          this.updateStreamCursor,
          this.updateTimestampSnapshot
        );
        this.updateStreamCursor = check.checkedAt;
        if (!check.canVerify || check.changed) {
          this.remoteChangeAvailable.set(check.changed);
          this.saveError.set(
            check.changed ? 'ticketDetail.remoteChangesDetected' : 'ticketDetail.changeCheckUnavailable'
          );
          return;
        }
      }

      const targetCol = this.boardColumns().find((c) => c.queryId === targetQueryId);
      const res = await this.openprojectService.moveWorkPackageToBoardColumn(
        String(id),
        targetQueryId,
        sourceQueryId || undefined,
        targetCol?.statusId,
        undefined,
        this.ticketData()?.lock_version ?? undefined
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
    this.saveError.set(null);
    this.isSaving.set(true);
    try {
      const expectedLockVersion = this.ticketData()?.lock_version;
      if (expectedLockVersion !== null && expectedLockVersion !== undefined) {
        const check = await this.workPackageChangeService.checkForChanges(
          String(id),
          expectedLockVersion,
          this.updateStreamCursor,
          this.updateTimestampSnapshot
        );
        this.updateStreamCursor = check.checkedAt;
        if (!check.canVerify) {
          this.saveError.set('ticketDetail.changeCheckUnavailable');
          return false;
        }
        if (check.changed) {
          this.remoteChangeAvailable.set(true);
          this.saveError.set('ticketDetail.remoteChangesDetected');
          return false;
        }
      }

      const res = await this.openprojectService.updateWorkPackage(String(id), {
        ...payload,
        lockVersion: this.ticketData()?.lock_version ?? undefined,
      });
      if (res.ok) {
        await this.loadTicket(id);
        return true;
      }
      this.saveError.set(res.error || 'Could not save the ticket changes.');
      if (res.conflict) {
        this.remoteChangeAvailable.set(true);
      }
      return false;
    } finally {
      this.isSaving.set(false);
    }
  }

  async postComment(): Promise<void> {
    const id = this.ticketId();
    const text = this.newComment().trim();
    if (!id || !text || this.isPostingComment()) return;

    this.isPostingComment.set(true);
    try {
      const res = await this.openprojectService.addWorkPackageComment(String(id), text);
      if (res.ok) {
        this.newComment.set('');
        this.isComposingComment.set(false);
        await this.loadTicket(id);
      }
    } finally {
      this.isPostingComment.set(false);
    }
  }

  discardComment(): void {
    this.newComment.set('');
    this.isComposingComment.set(false);
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

  async downloadAttachment(att: TicketAttachment): Promise<void> {
    const url = att.downloadUrl || att.download_url;
    if (!url || this.downloadingAttachmentIds().has(att.id)) return;

    this.downloadingAttachmentIds.update((ids) => new Set(ids).add(att.id));
    this.attachmentDownloadErrors.update((ids) => {
      const next = new Set(ids);
      next.delete(att.id);
      return next;
    });
    try {
      const fileName = att.fileName || att.file_name || `attachment-${att.id}`;
      const savedPath = await this.openprojectService.downloadAttachment(url, fileName);
      if (savedPath) {
        this.downloadedAttachmentPaths.update((paths) => new Map(paths).set(att.id, savedPath));
      }
    } catch (err) {
      console.warn('Attachment download failed:', err);
      this.attachmentDownloadErrors.update((ids) => new Set(ids).add(att.id));
    } finally {
      this.downloadingAttachmentIds.update((ids) => {
        const next = new Set(ids);
        next.delete(att.id);
        return next;
      });
    }
  }

  async revealDownloadedAttachment(att: TicketAttachment): Promise<void> {
    const path = this.downloadedAttachmentPaths().get(att.id);
    if (!path) return;
    try {
      await revealItemInDir(path);
    } catch (err) {
      console.warn('Could not reveal downloaded attachment:', err);
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

  /** Opens the shared time entry modal with this ticket preloaded (OpenProject's "Log time" clock button). */
  openLogTimeModal(): void {
    const id = this.ticketId();
    const ticket = this.ticketData();
    if (!id) return;
    this.activityService.openAddModal({
      ticket: String(id),
      title: ticket?.subject || undefined,
      projectId: ticket?.project_id || undefined,
      projectName: ticket?.project_name || undefined,
      statusId: ticket?.status_id || undefined,
      statusName: ticket?.status_name || undefined,
      statusColor: ticket?.status_color || undefined,
    });
  }

  openTimeCostReport(): void {
    const id = this.ticketId();
    if (!id) return;

    void this.router.navigate([
      '/dashboard/reports',
    ], {
      queryParams: {
        ticket: String(id),
        projectId: this.ticketData()?.project_id || undefined,
        identifier: this.projectIdentifier() || undefined,
        includeDescendants: true,
        returnUrl: this.router.url,
      },
    });
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

function getContrastingTextColor(color: string): string {
  const normalizedColor = color.trim();
  const hexMatch = normalizedColor.match(/^#([\da-f]{3}|[\da-f]{6})$/i);
  const rgbMatch = normalizedColor.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
  let channels: number[] | null = null;

  if (hexMatch) {
    const hex = hexMatch[1];
    const expandedHex = hex.length === 3 ? hex.split('').map((digit) => digit + digit).join('') : hex;
    channels = [0, 2, 4].map((index) => Number.parseInt(expandedHex.slice(index, index + 2), 16));
  } else if (rgbMatch) {
    channels = rgbMatch.slice(1).map((channel) => Number(channel));
  }

  if (!channels) return '#ffffff';

  const [red, green, blue] = channels.map((channel) => {
    const value = Math.min(255, Math.max(0, channel)) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  const lightContrast = 1.05 / (luminance + 0.05);
  const darkContrast = (luminance + 0.05) / 0.058;

  return lightContrast >= darkContrast ? '#ffffff' : '#111827';
}

/** Moves image sources to a data attribute so the webview does not request unauthenticated URLs. */
function holdInlineImages(html: string): string {
  return html.replace(/<img\b([^>]*?)\ssrc=/gi, '<img$1 data-op-pending-src=');
}

function ticketDataList<T>(val: T[] | null | undefined): T[] {
  return Array.isArray(val) ? val : [];
}
