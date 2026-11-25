import { Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Select } from 'primeng/select';
import { Avatar } from 'primeng/avatar';
import { BoardWorkPackageCard, StatusOption } from '../../../../core/interfaces/openproject.interface';

@Component({
  selector: 'app-board-card',
  standalone: true,
  imports: [CommonModule, FormsModule, Select, Avatar],
  host: {
    class: 'block',
  },
  template: `
    <div
      (click)="cardClick.emit(card())"
      class="group p-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-primary-400 dark:hover:border-primary-500 transition-all cursor-grab active:cursor-grabbing shadow-xs hover:shadow-md space-y-2.5 select-none"
    >
      <!-- Top Row: Status Pill Dropdown + #ID - PROJECT -->
      <div class="flex items-center justify-between gap-2 min-w-0">
        <div (click)="$event.stopPropagation()" class="shrink-0 max-w-[56%]">
          <p-select
            [options]="statuses()"
            [ngModel]="card().statusId"
            (ngModelChange)="onStatusSelected($event)"
            optionLabel="name"
            optionValue="id"
            appendTo="body"
            [style]="{
              '--p-select-background': resolvedStatusColor(),
              '--p-select-border-color': 'transparent',
              '--p-select-hover-border-color': 'transparent',
              '--p-select-focus-border-color': 'transparent',
              '--p-select-color': '#ffffff',
              '--p-select-dropdown-color': '#ffffff',
              backgroundColor: resolvedStatusColor()
            }"
            styleClass="!rounded-md !py-0 !px-1.5 !h-5 !min-h-5 !text-[11px] !font-semibold !leading-none !border-0 op-card-status-select"
          >
            <ng-template #selectedItem let-selected>
              <span class="text-[11px] font-semibold text-white truncate">
                {{ selected?.name || card().statusName || '—' }}
              </span>
            </ng-template>
            <ng-template #item let-item>
              <div class="flex items-center gap-1.5 text-xs py-0.5">
                <span
                  class="size-2 rounded-full shrink-0"
                  [style.backgroundColor]="item.color || '#3b82f6'"
                ></span>
                <span>{{ item.name }}</span>
              </div>
            </ng-template>
          </p-select>
        </div>

        <span class="font-mono text-[11px] text-slate-400 dark:text-zinc-500 truncate text-right">
          #{{ card().id }}@if (projectLabel()) { - {{ projectLabel() }}}
        </span>
      </div>

      <!-- Middle: Type Label + Subject -->
      <div class="text-xs sm:text-[13px] leading-snug text-slate-800 dark:text-zinc-100 break-words">
        @if (card().typeName) {
          <span
            class="font-bold uppercase tracking-wide mr-1.5"
            [style.color]="resolvedTypeColor()"
          >
            {{ card().typeName }}
          </span>
        }
        <span class="font-medium">{{ card().subject }}</span>
      </div>

      <!-- Bottom Row: Assignee Avatar + Date Range -->
      @if (card().assigneeName || card().startDate || card().dueDate) {
        <div class="flex items-center justify-between gap-2 pt-1">
          <div class="flex items-center min-w-0">
            @if (card().assigneeName) {
              <p-avatar
                [label]="assigneeInitials()"
                shape="circle"
                [title]="card().assigneeName!"
                [style]="{ backgroundColor: avatarBgColor(), color: '#ffffff' }"
                styleClass="!size-6 !text-[10px] !font-bold shrink-0"
              />
            }
          </div>

          @if (card().startDate || card().dueDate) {
            <div class="font-mono text-[11px] flex items-center gap-1 shrink-0">
              @if (card().startDate) {
                <span class="text-slate-500 dark:text-zinc-400">
                  {{ formatShortDate(card().startDate!) }}
                </span>
              }
              @if (card().startDate && card().dueDate) {
                <span class="text-slate-400 dark:text-zinc-500">-</span>
              }
              @if (card().dueDate) {
                <span
                  [class]="isOverdue() ? 'text-rose-500 font-semibold' : 'text-slate-500 dark:text-zinc-400'"
                >
                  {{ formatShortDate(card().dueDate!) }}
                </span>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host ::ng-deep .op-card-status-select {
        height: 1.25rem !important;
        min-height: 1.25rem !important;
        align-items: center !important;
        box-shadow: none !important;
      }
      :host ::ng-deep .op-card-status-select .p-select-label {
        padding: 0 0.25rem !important;
        line-height: 1.25rem !important;
        color: #ffffff !important;
        display: flex !important;
        align-items: center !important;
      }
      :host ::ng-deep .op-card-status-select .p-select-dropdown {
        width: 1.1rem !important;
        color: #ffffff !important;
      }
      :host ::ng-deep .op-card-status-select .p-select-dropdown svg {
        width: 0.6rem !important;
        height: 0.6rem !important;
      }
    `,
  ],
})
export class BoardCardComponent {
  readonly card = input.required<BoardWorkPackageCard>();
  readonly statuses = input<StatusOption[]>([]);
  readonly fallbackProjectName = input<string>('');

  readonly cardClick = output<BoardWorkPackageCard>();
  readonly statusChange = output<{ card: BoardWorkPackageCard; statusId: string }>();

  readonly projectLabel = computed(() => {
    return (this.card().projectName || this.fallbackProjectName() || '').toUpperCase();
  });

  readonly resolvedStatusColor = computed(() => {
    const direct = this.card().statusColor;
    if (direct) return direct;
    const statusId = this.card().statusId;
    if (statusId) {
      const matched = this.statuses().find((s) => s.id === statusId);
      if (matched?.color) return matched.color;
    }
    return 'var(--p-primary-500)';
  });

  readonly resolvedTypeColor = computed(() => {
    if (this.card().typeColor) return this.card().typeColor!;
    const type = (this.card().typeName || '').toLowerCase();
    if (type.includes('bug') || type.includes('error') || type.includes('incidencia')) {
      return '#f43f5e';
    }
    return '#38bdf8';
  });

  readonly assigneeInitials = computed(() => {
    const name = (this.card().assigneeName || '').trim();
    if (!name) return '';
    const parts = name.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  });

  readonly avatarBgColor = computed(() => {
    const name = this.card().assigneeName || '';
    const palette = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return palette[Math.abs(hash) % palette.length];
  });

  readonly isOverdue = computed(() => {
    const due = this.card().dueDate;
    if (!due) return false;
    const today = new Date().toISOString().slice(0, 10);
    return due < today;
  });

  formatShortDate(isoDate: string): string {
    const parts = isoDate.split('-');
    if (parts.length !== 3) return isoDate;
    const months = ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sep.', 'oct.', 'nov.', 'dic.'];
    const monthIdx = parseInt(parts[1], 10) - 1;
    const monthLabel = months[monthIdx] ?? parts[1];
    return `${monthLabel} ${parts[2]}, ${parts[0]}`;
  }

  onStatusSelected(statusId: string): void {
    if (!statusId || statusId === this.card().statusId) return;
    this.statusChange.emit({ card: this.card(), statusId });
  }
}
