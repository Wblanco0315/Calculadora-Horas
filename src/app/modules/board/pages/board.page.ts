import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Select } from 'primeng/select';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { ButtonDirective } from 'primeng/button';
import { Skeleton } from 'primeng/skeleton';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerLayoutKanban,
  tablerSearch,
  tablerRefresh,
  tablerArrowLeft,
  tablerFilterOff,
} from '@ng-icons/tabler-icons';
import { OpenprojectService } from '../../../core/services/openproject.service';
import {
  BoardColumnOption,
  BoardOption,
  BoardWorkPackageCard,
  StatusOption,
} from '../../../core/interfaces/openproject.interface';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import {
  BoardColumnComponent,
  BoardCardDropEvent,
} from '../components/board-column/board-column.component';

@Component({
  selector: 'app-board-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Select,
    IconField,
    InputIcon,
    InputText,
    ButtonDirective,
    Skeleton,
    NgIcon,
    TranslatePipe,
    BoardColumnComponent,
  ],
  viewProviders: [
    provideIcons({
      tablerLayoutKanban,
      tablerSearch,
      tablerRefresh,
      tablerArrowLeft,
      tablerFilterOff,
    }),
  ],
  templateUrl: './board.page.html',
  host: {
    class: 'flex flex-col flex-1 min-h-0 min-w-0 w-full',
  },
})
export class BoardPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly openprojectService = inject(OpenprojectService);

  readonly projectId = signal<string>('');
  readonly projectName = signal<string>('');
  readonly projectIdentifier = signal<string>('');

  readonly boards = signal<BoardOption[]>([]);
  readonly selectedBoardId = signal<string | null>(null);
  readonly columns = signal<BoardColumnOption[]>([]);
  readonly statuses = signal<StatusOption[]>([]);

  readonly searchQuery = signal<string>('');
  readonly selectedAssigneeFilter = signal<string | null>(null);

  readonly isLoaded = signal<boolean>(false);
  readonly isRefreshing = signal<boolean>(false);
  readonly isMovingTicket = signal<boolean>(false);
  readonly moveError = signal<string | null>(null);

  readonly assigneeOptions = computed(() => {
    const names = new Set<string>();
    for (const col of this.columns()) {
      for (const wp of col.workPackages ?? []) {
        if (wp.assigneeName) names.add(wp.assigneeName);
      }
    }
    return Array.from(names)
      .sort()
      .map((name) => ({ label: name, value: name }));
  });

  readonly dropListIds = computed(() =>
    this.columns().map((column) => `board-column-${encodeURIComponent(column.queryId)}`)
  );

  readonly filteredColumns = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const assignee = this.selectedAssigneeFilter();

    return this.columns().map((col) => {
      const cards = (col.workPackages ?? []).filter((wp) => {
        const matchesQuery =
          !q ||
          wp.subject.toLowerCase().includes(q) ||
          String(wp.id).includes(q) ||
          (wp.typeName || '').toLowerCase().includes(q);
        const matchesAssignee = !assignee || wp.assigneeName === assignee;
        return matchesQuery && matchesAssignee;
      });
      return { column: col, cards };
    });
  });

  async ngOnInit(): Promise<void> {
    const params = this.route.snapshot.paramMap;
    const qParams = this.route.snapshot.queryParamMap;

    const pid = params.get('projectId') || '';
    const bid = params.get('boardId');
    this.projectId.set(pid);
    this.projectName.set(qParams.get('name') || pid);
    this.projectIdentifier.set(qParams.get('identifier') || '');

    const [statuses, boards] = await Promise.all([
      this.openprojectService.getStatuses(),
      this.openprojectService.getProjectBoards(pid, this.projectIdentifier() || undefined),
    ]);

    this.statuses.set(statuses);
    this.boards.set(boards);

    if (boards.length > 0) {
      const targetBoardId =
        bid && boards.some((b) => b.id === bid) ? bid : boards[0].id;
      this.selectedBoardId.set(targetBoardId);
      await this.loadColumns(targetBoardId);
    } else {
      this.isLoaded.set(true);
    }
  }

  async onBoardChange(boardId: string): Promise<void> {
    if (!boardId || boardId === this.selectedBoardId()) return;
    this.selectedBoardId.set(boardId);
    await this.loadColumns(boardId);
  }

  async loadColumns(boardId: string, forceRefresh = false): Promise<void> {
    this.isRefreshing.set(true);
    try {
      const cols = await this.openprojectService.getBoardColumns(boardId, forceRefresh);
      this.columns.set(cols);
    } finally {
      this.isLoaded.set(true);
      this.isRefreshing.set(false);
    }
  }

  async refreshBoard(): Promise<void> {
    const boardId = this.selectedBoardId();
    if (!boardId) return;
    await this.loadColumns(boardId, true);
  }

  goBackToProjects(): void {
    this.router.navigate(['/dashboard/projects']);
  }

  openTicketDetail(card: BoardWorkPackageCard, columnQueryId: string): void {
    const boardId = this.selectedBoardId();
    if (!boardId) return;

    this.router.navigate(['/dashboard/boards', this.projectId(), boardId, 'tickets', card.id], {
      queryParams: {
        name: this.projectName(),
        identifier: this.projectIdentifier(),
        column: columnQueryId,
      },
    });
  }

  async onCardDrop(event: BoardCardDropEvent): Promise<void> {
    const boardId = this.selectedBoardId();
    if (!boardId || this.isMovingTicket()) return;

    this.moveError.set(null);
    const previousColumns = this.columns();
    let movedCard: BoardWorkPackageCard | undefined;
    const remainingColumns = previousColumns.map((column) => {
      if (column.queryId !== event.sourceQueryId) return column;
      const workPackages = column.workPackages ?? [];
      movedCard = workPackages.find((card) => card.id === event.ticketId);
      return {
        ...column,
        workPackages: workPackages.filter((card) => card.id !== event.ticketId),
      };
    });

    if (!movedCard) return;

    const targetStatus = event.targetStatusId
      ? this.statuses().find((status) => status.id === event.targetStatusId)
      : undefined;
    const targetTicketIds = event.position.targetTicketIds;
    const nextTicketId = targetTicketIds[event.position.targetIndex];
    const previousTicketId = targetTicketIds[event.position.targetIndex - 1];
    const optimisticColumns = remainingColumns.map((column) => {
      if (column.queryId !== event.targetQueryId || !movedCard) return column;
      const updatedCard: BoardWorkPackageCard = targetStatus
        ? {
            ...movedCard,
            statusId: targetStatus.id,
            statusName: targetStatus.name,
            statusColor: targetStatus.color,
          }
        : movedCard;
      const workPackages = (column.workPackages ?? []).filter((card) => card.id !== event.ticketId);
      const nextIndex = nextTicketId
        ? workPackages.findIndex((card) => card.id === nextTicketId)
        : -1;
      const previousIndex = previousTicketId
        ? workPackages.findIndex((card) => card.id === previousTicketId)
        : -1;
      const targetIndex = nextIndex >= 0
        ? nextIndex
        : previousIndex >= 0
          ? previousIndex + 1
          : Math.min(event.position.targetIndex, workPackages.length);
      workPackages.splice(targetIndex, 0, updatedCard);
      return { ...column, workPackages };
    });

    this.columns.set(optimisticColumns);
    this.isMovingTicket.set(true);
    try {
      const result = await this.openprojectService.moveWorkPackageToBoardColumn(
        String(event.ticketId),
        event.targetQueryId,
        event.sourceQueryId,
        event.targetStatusId,
        event.position
      );
      if (!result.ok) {
        this.columns.set(previousColumns);
        this.moveError.set(result.error || 'Could not move the ticket to that column.');
        return;
      }
      await this.loadColumns(boardId, true);
    } catch (error) {
      this.columns.set(previousColumns);
      this.moveError.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.isMovingTicket.set(false);
    }
  }

  async onCardStatusChange(event: { card: BoardWorkPackageCard; statusId: string }): Promise<void> {
    const boardId = this.selectedBoardId();
    const res = await this.openprojectService.updateWorkPackageStatus(
      String(event.card.id),
      event.statusId,
      event.card.lockVersion
    );
    if (res.ok && boardId) {
      await this.loadColumns(boardId, true);
    }
  }

}
