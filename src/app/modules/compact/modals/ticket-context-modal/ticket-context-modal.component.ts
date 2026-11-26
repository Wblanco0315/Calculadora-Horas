import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Dialog } from 'primeng/dialog';
import { ButtonDirective } from 'primeng/button';
import { Skeleton } from 'primeng/skeleton';
import { Select } from 'primeng/select';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from 'primeng/tabs';
import { Badge } from 'primeng/badge';
import { Avatar } from 'primeng/avatar';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerFileText,
  tablerMessages,
  tablerPaperclip,
  tablerPhoto,
  tablerCopy,
  tablerCheck,
  tablerTag,
  tablerRefresh,
  tablerExternalLink,
  tablerAlertCircle,
  tablerPlus,
  tablerArrowsSort,
} from '@ng-icons/tabler-icons';
import { openUrl } from '@tauri-apps/plugin-opener';
import { ActivityService } from '../../../../core/services/activity.service';
import { OpenprojectService } from '../../../../core/services/openproject/openproject.service';
import { WorkPackageApiService } from '../../../../core/services/openproject/work-package-api.service';
import { AttachmentApiService } from '../../../../core/services/openproject/attachment-api.service';
import { ProjectApiService } from '../../../../core/services/openproject/project-api.service';
import { BoardApiService } from '../../../../core/services/openproject/board-api.service';
import { NotificationService } from '../../../../core/services/notification.service';
import {
  BoardColumnOption,
  BoardLocation,
  BoardOption,
  StatusOption,
  TicketAttachment,
  TicketComment,
  TicketContextResult,
} from '../../../../core/interfaces/openproject.interface';
import { formatIsoDuration } from '../../../../shared/format/time';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-ticket-context-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Dialog,
    ButtonDirective,
    Skeleton,
    Select,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    Badge,
    Avatar,
    NgIcon,
    TranslatePipe,
  ],
  viewProviders: [
    provideIcons({
      tablerFileText,
      tablerMessages,
      tablerPaperclip,
      tablerPhoto,
      tablerCopy,
      tablerCheck,
      tablerTag,
      tablerRefresh,
      tablerExternalLink,
      tablerAlertCircle,
      tablerPlus,
      tablerArrowsSort,
    }),
  ],
  styles: [
    `
      :host ::ng-deep {
        .op-comment-body,
        .op-description-content {
          .op-uc-p {
            margin-top: 0.25rem;
            margin-bottom: 0.25rem;
            line-height: 1.5;
          }
          .op-uc-p:first-child {
            margin-top: 0;
          }
          .op-uc-p:last-child {
            margin-bottom: 0;
          }
          .user-mention {
            font-weight: 600;
            color: var(--p-primary-600, #2563eb);
            background-color: var(--p-primary-50, #eff6ff);
            padding: 0.05rem 0.35rem;
            border-radius: 0.375rem;
            text-decoration: none;
            display: inline-block;
            font-size: 0.75rem;
          }
          figure.op-uc-figure {
            margin: 0.5rem 0;
          }
          img,
          img.op-uc-image,
          figure.op-uc-figure img {
            border-radius: 0.5rem;
            max-width: 100%;
            max-height: 360px;
            object-fit: contain;
            border: 1px solid rgba(148, 163, 184, 0.3);
            cursor: pointer;
            transition: transform 0.15s ease, border-color 0.15s ease;
            background-color: rgba(248, 250, 252, 0.8);
            display: block;
            margin: 0.5rem 0;
          }
          img:hover,
          img.op-uc-image:hover,
          figure.op-uc-figure img:hover {
            transform: scale(1.01);
            border-color: var(--p-primary-500, #3b82f6);
          }
          .op-uc-list {
            list-style-type: disc;
            padding-left: 1.25rem;
            margin: 0.35rem 0;
          }
          .op-uc-list--item {
            margin-bottom: 0.2rem;
          }
          a.op-uc-link {
            color: var(--p-primary-600, #2563eb);
            text-decoration: underline;
          }
        }
        .op-detail-content {
          strong {
            font-weight: 600;
            color: inherit;
          }
          i {
            font-style: normal;
            font-weight: 500;
            color: var(--p-primary-600, #2563eb);
          }
          a.diff-details {
            color: var(--p-primary-600, #2563eb);
            text-decoration: underline;
            margin-left: 0.25rem;
          }
        }
        /* Dynamic Theme Scrollbar for Modal Panels */
        .overflow-y-auto {
          scrollbar-width: thin;
          scrollbar-color: color-mix(in srgb, var(--p-primary-500, #3b82f6) 40%, rgba(148, 163, 184, 0.35)) transparent;
        }
        .overflow-y-auto::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .overflow-y-auto::-webkit-scrollbar-track {
          background: transparent;
        }
        .overflow-y-auto::-webkit-scrollbar-thumb {
          background-color: color-mix(in srgb, var(--p-primary-500, #3b82f6) 35%, rgba(148, 163, 184, 0.4));
          border-radius: 9999px;
          transition: background-color 0.2s ease;
        }
        .overflow-y-auto::-webkit-scrollbar-thumb:hover {
          background-color: var(--p-primary-500, #3b82f6);
        }
        .dark .overflow-y-auto::-webkit-scrollbar-thumb {
          background-color: color-mix(in srgb, var(--p-primary-400, #60a5fa) 30%, rgba(100, 116, 139, 0.4));
        }
        .dark .overflow-y-auto::-webkit-scrollbar-thumb:hover {
          background-color: var(--p-primary-400, #60a5fa);
        }
      }
    `,
  ],
  templateUrl: './ticket-context-modal.component.html',
})
export class TicketContextModalComponent {

  readonly activityService = inject(ActivityService);
  private readonly openprojectService = inject(OpenprojectService);
  private readonly workPackageApi = inject(WorkPackageApiService);
  private readonly attachmentApi = inject(AttachmentApiService);
  private readonly projectApi = inject(ProjectApiService);
  private readonly boardApi = inject(BoardApiService);
  private readonly notificationService = inject(NotificationService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly activeTab = signal<string>('details');
  readonly ticketData = signal<TicketContextResult | null>(null);
  readonly processedComments = signal<TicketComment[]>([]);
  readonly commentFilter = signal<'all' | 'comments' | 'changes'>('all');
  readonly commentSort = signal<'desc' | 'asc'>('desc');
  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly copiedDesc = signal<boolean>(false);

  readonly previewImage = signal<string | null>(null);
  readonly selectedAttachmentName = signal<string>('');
  readonly selectedAttachment = signal<TicketAttachment | null>(null);
  readonly isImageLoading = signal<boolean>(false);
  readonly imageCache = signal<Map<string, string>>(new Map());

  // Board & Column signals
  readonly availableBoards = signal<BoardOption[]>([]);
  readonly currentBoardId = signal<string | null>(null);
  readonly currentBoardName = signal<string | null>(null);
  readonly columns = signal<BoardColumnOption[]>([]);
  readonly selectedColumnId = signal<string | null>(null);
  readonly currentLocation = signal<BoardLocation | null>(null);
  readonly isLoadingBoards = signal<boolean>(false);
  readonly isLoadingColumns = signal<boolean>(false);
  readonly isMovingColumn = signal<boolean>(false);
  readonly moveSuccessMessage = signal<string | null>(null);
  readonly moveErrorMessage = signal<string | null>(null);

  // Status signals
  readonly availableStatuses = signal<StatusOption[]>([]);
  readonly isUpdatingStatus = signal<boolean>(false);
  readonly statusUpdateSuccess = signal<boolean>(false);
  readonly statusUpdateError = signal<string | null>(null);

  readonly currentStatusId = computed<string | null>(() => {
    return this.ticketData()?.status_id || null;
  });

  readonly boardDisplayName = computed<string>(() => {
    if (this.isLoadingBoards()) return 'Cargando tablero...';
    return this.currentBoardName() || 'Sin tablero asignado';
  });

  readonly canMoveColumn = computed<boolean>(() => {
    const colId = this.selectedColumnId();
    const currColId = this.currentLocation()?.boardColumnQueryId;
    return !!colId && colId !== currColId && !this.isMovingColumn();
  });

  readonly currentTicket = computed<string>(() => {
    return this.activityService.contextTicket() || '';
  });

  readonly processedDescription = signal<string>('');

  readonly sanitizedDescription = computed<SafeHtml | null>(() => {
    const html = this.processedDescription();
    if (html) {
      return this.sanitizer.bypassSecurityTrustHtml(html);
    }
    return null;
  });

  readonly commentsCount = computed<number>(() => {
    return this.processedComments().length;
  });

  readonly onlyCommentsCount = computed<number>(() => {
    return this.processedComments().filter((c) => !!this.getCommentHtml(c).trim()).length;
  });

  readonly onlyChangesCount = computed<number>(() => {
    return this.processedComments().filter((c) => this.getCommentDetails(c).length > 0).length;
  });

  readonly filteredComments = computed<TicketComment[]>(() => {
    const list = this.processedComments();
    const filter = this.commentFilter();
    let res = list;
    if (filter === 'comments') {
      res = list.filter((c) => !!this.getCommentHtml(c).trim());
    } else if (filter === 'changes') {
      res = list.filter((c) => this.getCommentDetails(c).length > 0);
    }

    const sort = this.commentSort();
    return [...res].sort((a, b) => {
      const dateA = new Date(this.getCommentDate(a)).getTime() || 0;
      const dateB = new Date(this.getCommentDate(b)).getTime() || 0;
      return sort === 'desc' ? dateB - dateA : dateA - dateB;
    });
  });

  readonly allAttachments = computed<TicketAttachment[]>(() => {
    const cache = this.imageCache();
    return (this.ticketData()?.attachments || []).map((a) => ({
      ...a,
      fileName: a.fileName || a.file_name || 'archivo',
      downloadUrl: a.downloadUrl || a.download_url || '',
      isImage: a.isImage ?? a.is_image ?? false,
      fileSize: a.fileSize ?? a.file_size ?? 0,
      authorName: a.authorName || a.author_name || undefined,
      createdAt: a.createdAt || a.created_at || undefined,
      dataUrl: cache.get(a.id) || a.dataUrl,
    }));
  });

  readonly imageAttachments = computed<TicketAttachment[]>(() => {
    return this.allAttachments().filter((a) => a.isImage);
  });

  readonly fileAttachments = computed<TicketAttachment[]>(() => {
    return this.allAttachments().filter((a) => !a.isImage);
  });

  readonly attachmentsCount = computed<number>(() => {
    return this.allAttachments().length;
  });

  constructor() {
    effect(() => {
      const isVisible = this.activityService.showTicketContextModal();
      const ticket = this.activityService.contextTicket();

      if (isVisible && ticket) {
        this.loadTicketContext(ticket);
      } else {
        this.resetState();
      }
    });
  }

  onTabChange(tab: string | number | undefined): void {
    if (typeof tab === 'string') {
      this.activeTab.set(tab);
    }
  }

  toggleCommentSort(): void {
    this.commentSort.update((s) => (s === 'desc' ? 'asc' : 'desc'));
  }

  getCommentUserName(comment: TicketComment): string {
    return (comment.userName || comment.user_name || '').trim() || 'Desconocido';
  }

  getCommentDate(comment: TicketComment): string {
    return comment.createdAt || comment.created_at || '';
  }

  getCommentHtml(comment: TicketComment): string {
    return comment.commentHtml || comment.comment_html || comment.commentRaw || comment.comment_raw || '';
  }

  getCommentDetails(comment: TicketComment) {
    return comment.details || [];
  }

  getUserInitials(name?: string | null): string {
    if (!name || name === 'Desconocido' || name === '-') return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  formatDuration(iso?: string | null): string {
    return formatIsoDuration(iso);
  }

  async openInOpenProject(): Promise<void> {
    const ticket = this.currentTicket();
    if (!ticket) return;
    const url = this.openprojectService.getWorkPackageUrl(ticket);
    try {
      await openUrl(url);
    } catch {
      window.open(url, '_blank');
    }
  }

  private resetState(): void {
    this.ticketData.set(null);
    this.processedComments.set([]);
    this.commentFilter.set('all');
    this.commentSort.set('desc');
    this.errorMessage.set(null);
    this.activeTab.set('details');
    this.copiedDesc.set(false);
    this.processedDescription.set('');
    this.previewImage.set(null);
    this.selectedAttachmentName.set('');
    this.selectedAttachment.set(null);
    this.isImageLoading.set(false);
    this.imageCache.set(new Map());
    this.availableBoards.set([]);
    this.currentBoardId.set(null);
    this.currentBoardName.set(null);
    this.columns.set([]);
    this.selectedColumnId.set(null);
    this.currentLocation.set(null);
    this.isLoadingBoards.set(false);
    this.isLoadingColumns.set(false);
    this.isMovingColumn.set(false);
    this.moveSuccessMessage.set(null);
    this.moveErrorMessage.set(null);
    this.availableStatuses.set([]);
    this.isUpdatingStatus.set(false);
    this.statusUpdateSuccess.set(false);
    this.statusUpdateError.set(null);
  }

  private async loadTicketContext(ticket: string): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    // Immediately pre-populate available statuses from cache so selector is never empty
    if (this.activityService.statuses().length > 0) {
      this.availableStatuses.set(this.activityService.statuses());
    } else {
      void this.projectApi.getStatuses().then((st) => {
        if (this.availableStatuses().length === 0 && st.length > 0) {
          this.availableStatuses.set(st);
        }
      });
    }

    try {
      const res = await this.workPackageApi.getTicketContext(ticket, {
        includeDescription: true,
        includeComments: true,
        includeAttachments: true,
      });

      if (res.success) {
        this.ticketData.set(res);

        const descHtml = res.description?.html || (res.description?.raw ? `<p class="whitespace-pre-wrap">${res.description.raw}</p>` : '');
        this.processedDescription.set(descHtml);
        if (descHtml) {
          void this.preloadDescriptionInlineImages(descHtml);
        }

        const commentsList: TicketComment[] = (res.comments || []).map((c) => ({
          ...c,
          userName: c.userName || c.user_name || 'Desconocido',
          commentHtml: c.commentHtml || c.comment_html || c.commentRaw || c.comment_raw || '',
          commentRaw: c.commentRaw || c.comment_raw || '',
          createdAt: c.createdAt || c.created_at || '',
          details: c.details || [],
        }));
        this.processedComments.set(commentsList);
        this.preloadInlineImages(commentsList);

        // Populate available statuses: prioritize transition options, fallback to all project statuses
        let statuses = res.available_statuses && res.available_statuses.length > 1
          ? res.available_statuses
          : (this.activityService.statuses().length > 0 ? this.activityService.statuses() : (res.available_statuses || []));

        if (statuses.length <= 1) {
          const fetched = await this.projectApi.getStatuses();
          if (fetched.length > 0) {
            statuses = fetched;
          }
        }

        if (res.status_id && res.status_name && !statuses.some((s) => s.id === res.status_id)) {
          statuses = [{ id: res.status_id, name: res.status_name, color: res.status_color || undefined }, ...statuses];
        }

        if (statuses.length > 0) {
          this.availableStatuses.set(statuses);
        }

        // Pre-load images for gallery preview
        if (res.attachments && res.attachments.length > 0) {
          this.preloadImages(res.attachments);
        }

        // Load project board and find ticket column
        if (res.project_id) {
          void this.loadBoardsForTicket(res.project_id, ticket);
        }
      } else {
        this.errorMessage.set(res.message || 'Error cargando información del ticket');
      }
    } catch (e: any) {
      this.errorMessage.set(e?.message || 'Error de conexión');
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadBoardsForTicket(projectId: string, ticket: string, projectIdentifier?: string): Promise<void> {
    this.isLoadingBoards.set(true);
    this.moveSuccessMessage.set(null);
    this.moveErrorMessage.set(null);

    try {
      const boards = await this.boardApi.getProjectBoards(projectId, projectIdentifier);
      this.availableBoards.set(boards);

      // 1. First attempt to find existing location on any board for this ticket
      const location = await this.boardApi.findTicketBoardColumn(projectId, ticket, projectIdentifier);
      if (location) {
        this.currentLocation.set(location);
        this.currentBoardId.set(location.boardId);
        this.currentBoardName.set(location.boardName);
        this.selectedColumnId.set(location.boardColumnQueryId);

        this.isLoadingColumns.set(true);
        const cols = await this.boardApi.getBoardColumns(location.boardId);
        this.columns.set(cols);
        this.isLoadingColumns.set(false);
      } else if (boards.length > 0) {
        // 2. Fallback: inspect project boards to select the main/default board
        const defaultBoard = boards[0];
        this.currentBoardId.set(defaultBoard.id);
        this.currentBoardName.set(defaultBoard.name);

        this.isLoadingColumns.set(true);
        const cols = await this.boardApi.getBoardColumns(defaultBoard.id);
        this.columns.set(cols);
        this.isLoadingColumns.set(false);

        // Attempt to match column by current ticket status
        const currentStatusId = this.ticketData()?.status_id;
        const matchedCol = currentStatusId ? cols.find((c) => c.statusId === currentStatusId) : null;
        this.selectedColumnId.set(matchedCol ? matchedCol.queryId : (cols[0]?.queryId || null));
      } else {
        this.currentBoardId.set(null);
        this.currentBoardName.set(null);
        this.columns.set([]);
        this.selectedColumnId.set(null);
      }
    } catch (e) {
      console.warn('Error loading board for ticket:', e);
    } finally {
      this.isLoadingBoards.set(false);
    }
  }

  async onStatusChange(newStatusId: string | null): Promise<void> {
    if (!newStatusId || this.isUpdatingStatus()) return;
    const currentStatusId = this.ticketData()?.status_id;
    if (newStatusId === currentStatusId) return;

    const found = this.availableStatuses().find((s) => s.id === newStatusId);
    if (!found) return;

    this.isUpdatingStatus.set(true);
    this.statusUpdateSuccess.set(false);
    this.statusUpdateError.set(null);

    const ticket = this.currentTicket();
    const lockVersion = this.ticketData()?.lock_version ?? undefined;

    try {
      const res = await this.workPackageApi.updateWorkPackageStatus(ticket, newStatusId, lockVersion);
      if (res.ok) {
        this.ticketData.update((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            status_id: found.id,
            status_name: found.name,
            status_color: found.color || prev.status_color,
            lock_version: prev.lock_version !== undefined && prev.lock_version !== null ? prev.lock_version + 1 : prev.lock_version,
          };
        });

        // Auto-sync with related local activities that match this ticket
        const rawTicket = ticket.trim().replace(/^#/, '');
        const relatedActs = this.activityService.activities().filter(
          (a) => a.ticket && a.ticket.trim().replace(/^#/, '') === rawTicket
        );
        for (const act of relatedActs) {
          await this.activityService.updateActivity(act.id, {
            statusId: found.id,
            statusName: found.name,
            statusColor: found.color ?? act.statusColor,
          });
        }

        // If the board column corresponds to this status, align the selected column
        const matchingCol = this.columns().find((c) => c.statusId === found.id);
        if (matchingCol) {
          this.selectedColumnId.set(matchingCol.queryId);
          this.currentLocation.update((loc) => {
            if (!loc) return loc;
            return {
              ...loc,
              boardColumnQueryId: matchingCol.queryId,
              boardColumnName: matchingCol.name,
              statusId: found.id,
              statusName: found.name,
            };
          });
        }

        this.statusUpdateSuccess.set(true);
        setTimeout(() => this.statusUpdateSuccess.set(false), 2500);
        this.notificationService.success('toast.statusUpdated', { ticket: rawTicket });
      } else {
        this.notificationService.error('toast.statusUpdateFailed', res.error);
        this.statusUpdateError.set(res.error || 'Error al actualizar estado');
        setTimeout(() => this.statusUpdateError.set(null), 3500);
      }
    } catch (e: any) {
      this.statusUpdateError.set(e?.message || 'Error de conexión');
      setTimeout(() => this.statusUpdateError.set(null), 3500);
    } finally {
      this.isUpdatingStatus.set(false);
    }
  }

  async onColumnChange(targetColId: string | null): Promise<void> {
    if (!targetColId || this.isMovingColumn()) return;
    const currentQueryId = this.currentLocation()?.boardColumnQueryId;
    if (targetColId === currentQueryId) return;

    this.selectedColumnId.set(targetColId);
    await this.moveTicketToSelectedColumn();
  }

  async moveTicketToSelectedColumn(): Promise<void> {
    const targetColId = this.selectedColumnId();
    const boardId = this.currentBoardId();
    const ticket = this.currentTicket();
    if (!targetColId || !ticket) return;

    const targetCol = this.columns().find((c) => c.queryId === targetColId);
    if (!targetCol) return;

    this.isMovingColumn.set(true);
    this.moveSuccessMessage.set(null);
    this.moveErrorMessage.set(null);

    try {
      const res = await this.boardApi.moveWorkPackageToBoardColumn(
        ticket,
        targetColId,
        this.currentLocation()?.boardColumnQueryId,
        targetCol.statusId
      );

      if (res.ok) {
        // Update local ticketData status badge if status changed
        if (targetCol.statusName) {
          this.ticketData.update((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              status_id: res.statusId || targetCol.statusId || prev.status_id,
              status_name: targetCol.statusName || prev.status_name,
            };
          });
        }

        // Update current location
        this.currentLocation.set({
          boardId: boardId || '',
          boardName: this.currentBoardName() || '',
          boardColumnQueryId: targetCol.queryId,
          boardColumnName: targetCol.name,
          statusId: targetCol.statusId,
          statusName: targetCol.statusName,
        });

        // Auto-sync with local activities that match this ticket
        const rawTicket = ticket.trim().replace(/^#/, '');
        const relatedActs = this.activityService.activities().filter(
          (a) => a.ticket && a.ticket.trim().replace(/^#/, '') === rawTicket
        );
        for (const act of relatedActs) {
          await this.activityService.updateActivity(act.id, {
            boardId: boardId || act.boardId,
            boardColumnId: targetCol.queryId,
            boardColumnName: targetCol.name,
            statusId: targetCol.statusId || act.statusId,
            statusName: targetCol.statusName || act.statusName,
          });
        }

        this.moveSuccessMessage.set('¡Ticket movido de columna con éxito!');
        setTimeout(() => this.moveSuccessMessage.set(null), 3500);
        this.notificationService.success('toast.columnUpdated', { ticket: rawTicket });
      } else {
        this.notificationService.error('toast.columnUpdateFailed', res.error);
        this.moveErrorMessage.set(res.error || 'Error al mover el ticket de columna');
      }
    } catch (e: any) {
      this.moveErrorMessage.set(e?.message || 'Error de conexión al mover de columna');
    } finally {
      this.isMovingColumn.set(false);
    }
  }

  private async preloadInlineImages(comments: TicketComment[]): Promise<void> {
    const regex = /(?:src=["'])([^"']*(?:\/api\/v3)?\/attachments\/(\d+)[^"']*)(?:["'])/gi;
    const urlsToFetch = new Set<string>();

    for (const c of comments) {
      const html = c.commentHtml || c.comment_html || '';
      let match: RegExpExecArray | null;
      while ((match = regex.exec(html)) !== null) {
        urlsToFetch.add(match[1]);
      }
    }

    if (urlsToFetch.size === 0) return;

    const urlToDataUrl = new Map<string, string>();
    for (const url of urlsToFetch) {
      let dataUrl: string | undefined;
      for (const [id, cachedData] of this.imageCache().entries()) {
        if (url.includes(`/attachments/${id}`)) {
          dataUrl = cachedData;
          break;
        }
      }

      if (!dataUrl) {
        try {
          dataUrl = await this.attachmentApi.fetchAttachmentContent(url);
          const idMatch = /\/attachments\/(\d+)/i.exec(url);
          if (idMatch) {
            this.imageCache.update((m) => new Map(m).set(idMatch[1], dataUrl!));
          }
        } catch (e) {
          console.warn('Could not load inline image:', url, e);
        }
      }

      if (dataUrl) {
        urlToDataUrl.set(url, dataUrl);
      }
    }

    if (urlToDataUrl.size > 0) {
      const updated = this.processedComments().map((c) => {
        let html = c.commentHtml || c.comment_html || '';
        for (const [url, dataUrl] of urlToDataUrl.entries()) {
          html = html.split(url).join(dataUrl);
        }
        return {
          ...c,
          commentHtml: html,
          comment_html: html,
        };
      });
      this.processedComments.set(updated);
    }
  }

  private async preloadDescriptionInlineImages(rawHtml: string): Promise<void> {
    const regex = /(?:src=["'])([^"']*(?:\/api\/v3)?\/attachments\/(\d+)[^"']*)(?:["'])/gi;
    const urlsToFetch = new Set<string>();
    let match: RegExpExecArray | null;

    while ((match = regex.exec(rawHtml)) !== null) {
      urlsToFetch.add(match[1]);
    }

    if (urlsToFetch.size === 0) return;

    let currentHtml = rawHtml;
    let hasChanges = false;

    for (const url of urlsToFetch) {
      let dataUrl: string | undefined;
      for (const [id, cachedData] of this.imageCache().entries()) {
        if (url.includes(`/attachments/${id}`)) {
          dataUrl = cachedData;
          break;
        }
      }

      if (!dataUrl) {
        try {
          dataUrl = await this.attachmentApi.fetchAttachmentContent(url);
          const idMatch = /\/attachments\/(\d+)/i.exec(url);
          if (idMatch) {
            this.imageCache.update((m) => new Map(m).set(idMatch[1], dataUrl!));
          }
        } catch (e) {
          console.warn('Could not load description inline image:', url, e);
        }
      }

      if (dataUrl) {
        currentHtml = currentHtml.split(url).join(dataUrl);
        hasChanges = true;
      }
    }

    if (hasChanges) {
      this.processedDescription.set(currentHtml);
    }
  }

  private preloadImages(attachments: TicketAttachment[]): void {
    const images = attachments.filter(
      (a) => (a.isImage ?? a.is_image) && (a.downloadUrl || a.download_url) && !this.imageCache().has(a.id)
    );
    for (const img of images) {
      img.isLoading = true;
      const downloadUrl = img.downloadUrl || img.download_url || '';
      this.attachmentApi
        .fetchAttachmentContent(downloadUrl)
        .then((dataUrl) => {
          img.isLoading = false;
          this.imageCache.update((m) => new Map(m).set(img.id, dataUrl));
          // If description contains this attachment ID, replace its src with dataUrl
          const desc = this.processedDescription();
          if (desc && (desc.includes(`/attachments/${img.id}/content`) || desc.includes(`/attachments/${img.id}`))) {
            const regex = new RegExp(`(["'])([^"']*(?:\\/api\\/v3)?\\/attachments\\/${img.id}[^"']*)(["'])`, 'gi');
            const updatedDesc = desc.replace(regex, `$1${dataUrl}$3`);
            this.processedDescription.set(updatedDesc);
          }
        })
        .catch((err) => {
          console.warn('Could not preload image:', img.fileName, err);
          img.isLoading = false;
        });
    }
  }

  onDescriptionContentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target && target.tagName === 'IMG') {
      const img = target as HTMLImageElement;
      if (img.src) {
        this.selectedAttachmentName.set(img.alt || 'Imagen en descripción');
        this.previewImage.set(img.src);
      }
    }
  }

  onCommentContentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target && target.tagName === 'IMG') {
      const img = target as HTMLImageElement;
      if (img.src) {
        this.selectedAttachmentName.set(img.alt || 'Imagen adjunta');
        this.previewImage.set(img.src);
      }
    }
  }

  sanitizeHtml(content: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(content);
  }

  formatDate(isoString: string): string {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  }

  formatFileSize(bytes: number): string {
    if (!bytes || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  }

  async copyDescription(): Promise<void> {
    const data = this.ticketData();
    const text = data?.description?.raw || data?.description?.html || '';
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      this.copiedDesc.set(true);
      setTimeout(() => this.copiedDesc.set(false), 2000);
    } catch {}
  }

  async openImagePreview(att: TicketAttachment): Promise<void> {
    const fileName = att.fileName || att.file_name || 'imagen';
    const downloadUrl = att.downloadUrl || att.download_url || '';
    this.selectedAttachmentName.set(fileName);
    this.selectedAttachment.set(att);

    const cached = this.imageCache().get(att.id) || att.dataUrl;
    if (cached) {
      this.previewImage.set(cached);
      return;
    }

    try {
      this.isImageLoading.set(true);
      const dataUrl = await this.attachmentApi.fetchAttachmentContent(downloadUrl);
      this.imageCache.update((m) => new Map(m).set(att.id, dataUrl));
      this.previewImage.set(dataUrl);
    } catch (e) {
      console.warn('Could not load image preview, opening in browser:', e);
      void this.openAttachment(att);
    } finally {
      this.isImageLoading.set(false);
    }
  }

  async openAttachment(att: TicketAttachment): Promise<void> {
    const rawUrl = att.downloadUrl || att.download_url || '';
    if (!rawUrl) return;
    const baseUrl = this.openprojectService.sanitizeUrl();
    const fullUrl = rawUrl.startsWith('http')
      ? rawUrl
      : `${baseUrl}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
    try {
      await openUrl(fullUrl);
    } catch {
      window.open(fullUrl, '_blank');
    }
  }

  logTimeForTicket(): void {
    const data = this.ticketData();
    if (!data) return;

    const ticketNumber = this.currentTicket();
    const title = data.subject || undefined;
    const projectId = data.project_id || undefined;
    const projectName = data.project_name || undefined;

    this.activityService.closeTicketContextModal();
    this.activityService.openAddModal({
      ticket: ticketNumber,
      title,
      projectId,
      projectName,
    });
  }

  onVisibleChange(visible: boolean): void {
    if (!visible) {
      this.activityService.closeTicketContextModal();
    }
  }

  onPreviewVisibleChange(visible: boolean): void {
    if (!visible) {
      this.previewImage.set(null);
    }
  }
}
