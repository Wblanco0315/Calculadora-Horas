import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonDirective, ButtonIcon } from 'primeng/button';
import { SortIcon, SortableColumn, Table } from 'primeng/table';
import { Skeleton } from 'primeng/skeleton';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerLayoutKanban, tablerRefresh } from '@ng-icons/tabler-icons';
import { BoardApiService } from '../../../core/services/openproject/board-api.service';
import { LanguageService } from '../../../core/services/language.service';
import { BoardOption } from '../../../core/interfaces/openproject.interface';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

interface BoardRow extends BoardOption {
  typeLabel: string;
  createdAtSort: string;
}

/** Attributes OpenProject action boards can be based on. */
const ACTION_ATTRIBUTES = ['status', 'assignee', 'version', 'subproject', 'subtasks'] as const;

/** Lists a project's boards (OpenProject `/projects/:id/boards` equivalent) with sorting and pagination. */
@Component({
  selector: 'app-board-list-page',
  standalone: true,
  imports: [ButtonDirective, ButtonIcon, Table, SortIcon, SortableColumn, Skeleton, RouterLink, NgIcon, TranslatePipe],
  viewProviders: [provideIcons({ tablerLayoutKanban, tablerRefresh })],
  templateUrl: './board-list.page.html',
  host: {
    class: 'flex flex-col flex-1 min-h-0 min-w-0 w-full',
  },
  styles: `
    th,
    td {
      white-space: nowrap;
      font-size: 0.75rem;
      line-height: 1rem;
    }

    .board-list-th {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }
  `,
})
export class BoardListPage {
  private readonly route = inject(ActivatedRoute);
  private readonly boardApi = inject(BoardApiService);
  private readonly languageService = inject(LanguageService);

  readonly projectId = signal<string>('');
  readonly projectName = signal<string>('');
  readonly projectIdentifier = signal<string>('');
  readonly boards = signal<BoardOption[]>([]);
  readonly isLoading = signal<boolean>(true);

  readonly rows = computed<BoardRow[]>(() => {
    this.languageService.currentLang();
    return this.boards().map((board) => ({
      ...board,
      typeLabel: this.typeLabel(board),
      createdAtSort: board.createdAt ?? '',
    }));
  });

  readonly boardQueryParams = computed(() => ({
    name: this.projectName(),
    identifier: this.projectIdentifier(),
  }));

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      void this.load(params.get('projectId') || '');
    });
  }

  async load(projectId: string, forceRefresh = false): Promise<void> {
    const queryParams = this.route.snapshot.queryParamMap;
    this.projectId.set(projectId);
    this.projectName.set(queryParams.get('name') || projectId);
    this.projectIdentifier.set(queryParams.get('identifier') || '');
    this.isLoading.set(true);
    try {
      if (forceRefresh) this.boardApi.invalidateBoardCache(projectId);
      const boards = await this.boardApi.getProjectBoards(projectId, this.projectIdentifier() || undefined);
      if (projectId === this.projectId()) this.boards.set(boards);
    } finally {
      if (projectId === this.projectId()) this.isLoading.set(false);
    }
  }

  refresh(): void {
    void this.load(this.projectId(), true);
  }

  formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    const pad = (value: number) => String(value).padStart(2, '0');
    const hours = date.getHours() % 12 || 12;
    const suffix = date.getHours() < 12 ? 'AM' : 'PM';
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(hours)}:${pad(date.getMinutes())} ${suffix}`;
  }

  private typeLabel(board: BoardOption): string {
    if (board.kind !== 'action') return this.languageService.t('board.type.basic');
    const attribute = ACTION_ATTRIBUTES.find((item) => item === board.attribute);
    if (!attribute) return this.languageService.t('board.type.action');
    return this.languageService.t('board.type.actionWith', {
      attribute: this.languageService.t(`board.type.${attribute}`),
    });
  }
}
