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
  templateUrl: './board-card.component.html',
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
        color: var(--p-select-color) !important;
        display: flex !important;
        align-items: center !important;
      }
      :host ::ng-deep .op-card-status-select .p-select-dropdown {
        width: 1.1rem !important;
        color: var(--p-select-color) !important;
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

  readonly resolvedStatusTextColor = computed(() => getContrastingTextColor(this.resolvedStatusColor()));

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
