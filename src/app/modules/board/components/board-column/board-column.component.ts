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
  styleUrl: './board-column.component.css',
  templateUrl: './board-column.component.html',
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
