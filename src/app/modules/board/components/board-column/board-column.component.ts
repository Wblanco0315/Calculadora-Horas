import { Component, computed, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import {
  BoardColumnDropPosition,
  BoardColumnOption,
  BoardWorkPackageCard,
  StatusOption,
} from '../../../../core/interfaces/openproject.interface';
import { BoardCardComponent } from '../board-card/board-card.component';

export interface BoardCardDropEvent {
  ticketId: number;
  lockVersion?: number;
  sourceQueryId: string;
  targetQueryId: string;
  targetStatusId?: string;
  position: BoardColumnDropPosition;
}

@Component({
  selector: 'app-board-column',
  standalone: true,
  imports: [CommonModule, CdkDrag, CdkDropList, BoardCardComponent],
  host: {
    class: 'flex flex-col h-full max-h-full min-h-0 shrink-0',
  },
  styles: [
    `
      /* Drawn inside the border box so the horizontal scroll container never clips it
         (a ring/box-shadow is painted outside and gets cut by overflow). */
      .board-column--drag-over {
        outline: 2px solid var(--p-primary-500);
        outline-offset: -2px;
        background-color: color-mix(in srgb, var(--p-primary-500) 6%, transparent);
      }
    `,
  ],
  template: `
    <div
      cdkDropList
      [id]="dropListId()"
      [cdkDropListData]="column()"
      [cdkDropListConnectedTo]="otherDropListIds()"
      (cdkDropListEntered)="onDragEnter()"
      (cdkDropListExited)="onDragLeave()"
      (cdkDropListDropped)="onDrop($event)"
      [class.board-column--drag-over]="isDragOver()"
      class="board-column w-[82vw] sm:w-76 lg:w-80 shrink-0 flex flex-col h-full max-h-full min-h-0 rounded-2xl bg-slate-100/80 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 transition-colors"
    >
      <div class="px-3.5 py-3 flex items-center justify-between gap-2 border-b border-slate-200/80 dark:border-zinc-800 shrink-0">
        <h2 class="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-zinc-100 truncate">
          {{ column().name }}
        </h2>
        <span class="font-mono text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
          {{ cards().length }}
        </span>
      </div>

      <div class="flex-1 min-h-0 overflow-y-auto p-2.5 flex flex-col gap-2.5">
        @for (card of cards(); track card.id) {
          <app-board-card
            cdkDrag
            [cdkDragData]="card"
            [card]="card"
            [statuses]="statuses()"
            [fallbackProjectName]="projectName()"
            (cardClick)="cardClick.emit($event)"
            (statusChange)="statusChange.emit($event)"
          />
        } @empty {
          <div class="h-24 flex items-center justify-center rounded-xl border border-dashed border-slate-300/80 dark:border-zinc-700/80 text-xs text-slate-400 dark:text-zinc-500">
            —
          </div>
        }
      </div>
    </div>
  `,
})
export class BoardColumnComponent {
  readonly column = input.required<BoardColumnOption>();
  readonly cards = input.required<BoardWorkPackageCard[]>();
  readonly statuses = input<StatusOption[]>([]);
  readonly projectName = input<string>('');
  readonly connectedColumnIds = input<string[]>([]);

  readonly cardClick = output<BoardWorkPackageCard>();
  readonly cardDrop = output<BoardCardDropEvent>();
  readonly statusChange = output<{ card: BoardWorkPackageCard; statusId: string }>();

  readonly dropListId = computed(() => `board-column-${encodeURIComponent(this.column().queryId)}`);
  readonly otherDropListIds = computed(() =>
    this.connectedColumnIds().filter((id) => id !== this.dropListId())
  );
  readonly isDragOver = signal<boolean>(false);

  onDragEnter(): void {
    this.isDragOver.set(true);
  }

  onDragLeave(): void {
    this.isDragOver.set(false);
  }

  onDrop(event: CdkDragDrop<BoardColumnOption, BoardColumnOption, BoardWorkPackageCard>): void {
    this.isDragOver.set(false);
    const card = event.item.data;
    const sourceColumn = event.previousContainer.data;
    const targetColumn = event.container.data;
    if (!card?.id || !sourceColumn?.queryId || !targetColumn?.queryId) return;

    const targetTicketIds = this.cards()
      .filter((targetCard) => targetCard.id !== card.id)
      .map((targetCard) => targetCard.id);
    const targetIndex = Math.max(0, Math.min(event.currentIndex, targetTicketIds.length));

    this.cardDrop.emit({
      ticketId: card.id,
      lockVersion: card.lockVersion,
      sourceQueryId: sourceColumn.queryId,
      targetQueryId: targetColumn.queryId,
      targetStatusId: targetColumn.statusId,
      position: { targetIndex, targetTicketIds },
    });
  }
}
