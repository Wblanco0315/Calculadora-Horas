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
import { ActivityService } from '../../../core/services/activity.service';
import { OpenprojectService } from '../../../core/services/openproject.service';
import {
  BoardColumnOption,
  BoardLocation,
  BoardOption,
  StatusOption,
  TicketAttachment,
  TicketComment,
  TicketContextResult,
} from '../../../core/interfaces/openproject.interface';
import { formatIsoDuration } from '../../format/time';
import { TranslatePipe } from '../../pipes/translate.pipe';

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
  template: `
    <p-dialog
      [visible]="activityService.showTicketContextModal()"
      (visibleChange)="onVisibleChange($event)"
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      [style]="{ width: '94vw', maxWidth: '640px', minWidth: 'min(94vw, 540px)', minHeight: 'min(75vh, 480px)', maxHeight: 'calc(100dvh - 3.5rem)' }"
      styleClass="p-dialog-rounded"
    >
      <!-- Clean Minimal Header: Icon + Ticket Number & Subject -->
      <ng-template #header>
        <div class="flex items-center gap-2 min-w-0 pr-2">
          <ng-icon name="tablerFileText" size="1.25rem" class="text-primary-600 dark:text-primary-400 shrink-0" />
          <div class="min-w-0">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="font-mono font-bold text-xs text-primary-600 dark:text-primary-400">
                #{{ currentTicket() }}
              </span>
              @if (ticketData()?.status_name) {
                <span
                  class="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.2 rounded border"
                  [style.borderColor]="ticketData()?.status_color || '#3b82f6'"
                  [style.color]="ticketData()?.status_color || '#3b82f6'"
                >
                  <span class="size-1.5 rounded-full shrink-0" [style.backgroundColor]="ticketData()?.status_color || '#3b82f6'"></span>
                  <span>{{ ticketData()?.status_name }}</span>
                </span>
              }
              @if (ticketData()?.project_name) {
                <span class="text-[10px] text-slate-400 dark:text-zinc-500 font-semibold truncate">
                  {{ ticketData()?.project_name }}
                </span>
              }
            </div>
            <h3 class="text-xs sm:text-sm font-bold text-slate-900 dark:text-zinc-100 truncate mt-0.5" [title]="ticketData()?.subject || ''">
              {{ ticketData()?.subject || ('ticketContext.title' | translate) }}
            </h3>
          </div>
        </div>
      </ng-template>

      <!-- Body Content -->
      <div class="space-y-3 pt-1 pb-2 min-h-[380px]">
        @if (isLoading()) {
          <!-- Skeleton Loading State -->
          <div class="space-y-3 py-4 animate-pulse">
            <div class="flex gap-2">
              <p-skeleton width="6rem" height="1.75rem" borderRadius="0.5rem" />
              <p-skeleton width="6rem" height="1.75rem" borderRadius="0.5rem" />
              <p-skeleton width="6rem" height="1.75rem" borderRadius="0.5rem" />
            </div>
            <p-skeleton width="100%" height="8rem" borderRadius="0.75rem" />
            <p-skeleton width="70%" height="1rem" borderRadius="0.5rem" />
          </div>
        } @else if (errorMessage()) {
          <!-- Error State -->
          <div class="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
            <ng-icon name="tablerAlertCircle" size="1.25rem" class="shrink-0 text-rose-500" />
            <div class="space-y-1">
              <p class="font-bold">{{ 'common.error' | translate }}</p>
              <p>{{ errorMessage() }}</p>
            </div>
          </div>
        } @else if (ticketData()) {
          <!-- PrimeNG Official p-tabs Component -->
          <p-tabs [value]="activeTab()" (valueChange)="onTabChange($event)" class="w-full">
            <p-tablist>
              <!-- 1. Details Tab (First) -->
              <p-tab value="details">
                <div class="flex items-center gap-1.5 text-xs font-semibold py-0.5">
                  <ng-icon name="tablerTag" size="0.95rem" />
                  <span>{{ 'ticketContext.detailsTab' | translate }}</span>
                </div>
              </p-tab>

              <!-- 2. Description Tab -->
              <p-tab value="description">
                <div class="flex items-center gap-1.5 text-xs font-semibold py-0.5">
                  <ng-icon name="tablerFileText" size="0.95rem" />
                  <span>{{ 'ticketContext.descriptionTab' | translate }}</span>
                </div>
              </p-tab>

              <!-- 3. Comments Tab -->
              <p-tab value="comments">
                <div class="flex items-center gap-1.5 text-xs font-semibold py-0.5">
                  <ng-icon name="tablerMessages" size="0.95rem" />
                  <span>{{ 'ticketContext.commentsTab' | translate }}</span>
                  @if (commentsCount() > 0) {
                    <p-badge [value]="commentsCount()" severity="secondary" size="small" />
                  }
                </div>
              </p-tab>

              <!-- 4. Attachments & Images Tab -->
              <p-tab value="attachments">
                <div class="flex items-center gap-1.5 text-xs font-semibold py-0.5">
                  <ng-icon name="tablerPaperclip" size="0.95rem" />
                  <span>{{ 'ticketContext.attachmentsTab' | translate }}</span>
                  @if (attachmentsCount() > 0) {
                    <p-badge [value]="attachmentsCount()" severity="secondary" size="small" />
                  }
                </div>
              </p-tab>
            </p-tablist>

            <p-tabpanels class="!p-0 !pt-3">
              <!-- Tab 1: Details Panel (First) -->
              <p-tabpanel value="details">
                <div class="space-y-2">
                  <div class="flex justify-end">
                    <button
                      pButton
                      type="button"
                      variant="text"
                      severity="secondary"
                      size="small"
                      (click)="openInOpenProject()"
                      class="!py-0.5 !px-2 text-xs"
                      [title]="'ticketContext.openInBrowser' | translate"
                    >
                      <ng-icon name="tablerExternalLink" size="0.85rem" class="mr-1" />
                      <span>{{ 'ticketContext.openInBrowser' | translate }}</span>
                    </button>
                  </div>

                  <!-- Uniform Metadata Grid (All 12 fields presented consistently) -->
                  <div class="grid grid-cols-2 gap-3 text-xs p-3.5 rounded-xl bg-slate-50/80 dark:bg-zinc-900/60 border border-slate-200/70 dark:border-zinc-800">
                    <!-- 1. Proyecto -->
                    <div class="space-y-0.5 min-w-0">
                      <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                        {{ 'ticketContext.project' | translate }}
                      </span>
                      <p class="font-medium text-slate-800 dark:text-zinc-200 truncate py-1">
                        {{ ticketData()?.project_name || '-' }}
                      </p>
                    </div>

                    <!-- 2. Tablero (No se puede cambiar, uniforme con Proyecto) -->
                    <div class="space-y-0.5 min-w-0">
                      <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                        {{ 'ticketContext.board' | translate }}
                      </span>
                      <p class="font-medium text-slate-800 dark:text-zinc-200 truncate py-1">
                        {{ boardDisplayName() }}
                      </p>
                    </div>

                    <!-- 3. Estado (Selector interactivo para cambiar estado) -->
                    <div class="space-y-1 min-w-0">
                      <div class="flex items-center justify-between">
                        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                          {{ 'compact.status' | translate }}
                        </span>
                        @if (isUpdatingStatus()) {
                          <ng-icon name="tablerRefresh" class="animate-spin text-primary-500" size="0.75rem" />
                        } @else if (statusUpdateSuccess()) {
                          <span class="text-[10px] text-emerald-500 font-semibold flex items-center gap-0.5">
                            <ng-icon name="tablerCheck" size="0.75rem" />
                          </span>
                        }
                      </div>
                      <p-select
                        [options]="availableStatuses()"
                        [ngModel]="currentStatusId()"
                        (ngModelChange)="onStatusChange($event)"
                        optionLabel="name"
                        optionValue="id"
                        [loading]="isUpdatingStatus()"
                        [disabled]="isUpdatingStatus()"
                        class="w-full !text-xs"
                        styleClass="w-full !text-xs !py-0.5"
                        appendTo="body"
                      >
                        <ng-template #selectedItem let-selected>
                          @if (selected) {
                            <div class="flex items-center gap-1.5 truncate text-xs">
                              <span class="size-2 rounded-full shrink-0" [style.backgroundColor]="selected.color || '#3b82f6'"></span>
                              <span class="truncate">{{ selected.name }}</span>
                            </div>
                          }
                        </ng-template>
                        <ng-template #item let-item>
                          <div class="flex items-center gap-1.5 text-xs py-0.5">
                            <span class="size-2 rounded-full shrink-0" [style.backgroundColor]="item.color || '#3b82f6'"></span>
                            <span>{{ item.name }}</span>
                          </div>
                        </ng-template>
                      </p-select>
                    </div>

                    <!-- 4. Columna (Selector interactivo para mover en el tablero) -->
                    <div class="space-y-1 min-w-0">
                      <div class="flex items-center justify-between">
                        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                          {{ 'ticketContext.column' | translate }}
                        </span>
                        @if (isMovingColumn()) {
                          <ng-icon name="tablerRefresh" class="animate-spin text-primary-500" size="0.75rem" />
                        } @else if (moveSuccessMessage()) {
                          <span class="text-[10px] text-emerald-500 font-semibold flex items-center gap-0.5">
                            <ng-icon name="tablerCheck" size="0.75rem" />
                          </span>
                        }
                      </div>
                      <p-select
                        [options]="columns()"
                        [ngModel]="selectedColumnId()"
                        (ngModelChange)="onColumnChange($event)"
                        optionLabel="name"
                        optionValue="queryId"
                        [placeholder]="'ticketContext.selectColumn' | translate"
                        [loading]="isLoadingColumns() || isLoadingBoards()"
                        [disabled]="isMovingColumn() || !currentBoardId() || columns().length === 0"
                        class="w-full !text-xs"
                        styleClass="w-full !text-xs !py-0.5"
                        appendTo="body"
                      />
                    </div>

                    <!-- 5. Prioridad -->
                    <div class="space-y-0.5 min-w-0">
                      <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                        {{ 'ticketContext.priority' | translate }}
                      </span>
                      <p class="font-medium text-slate-800 dark:text-zinc-200 truncate py-1">
                        {{ ticketData()?.priority_name || '-' }}
                      </p>
                    </div>

                    <!-- 6. Versión -->
                    <div class="space-y-0.5 min-w-0">
                      <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                        {{ 'ticketContext.version' | translate }}
                      </span>
                      <p class="font-medium text-slate-800 dark:text-zinc-200 truncate py-1">
                        {{ ticketData()?.version_name || '-' }}
                      </p>
                    </div>

                    <!-- 7. Asignado a -->
                    <div class="space-y-0.5 min-w-0">
                      <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                        {{ 'ticketContext.assignedTo' | translate }}
                      </span>
                      <p class="font-medium text-slate-800 dark:text-zinc-200 truncate py-1">
                        {{ ticketData()?.assignee_name || '-' }}
                      </p>
                    </div>

                    <!-- 8. Responsable -->
                    <div class="space-y-0.5 min-w-0">
                      <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                        {{ 'ticketContext.responsible' | translate }}
                      </span>
                      <p class="font-medium text-slate-800 dark:text-zinc-200 truncate py-1">
                        {{ ticketData()?.responsible_name || '-' }}
                      </p>
                    </div>

                    <!-- 9. Fecha Inicio -->
                    <div class="space-y-0.5 min-w-0">
                      <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                        {{ 'ticketContext.startDate' | translate }}
                      </span>
                      <p class="font-medium text-slate-800 dark:text-zinc-200 py-1 font-mono text-[11px]">
                        {{ ticketData()?.start_date || '-' }}
                      </p>
                    </div>

                    <!-- 10. Fecha Vencimiento -->
                    <div class="space-y-0.5 min-w-0">
                      <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                        {{ 'ticketContext.dueDate' | translate }}
                      </span>
                      <p class="font-medium text-slate-800 dark:text-zinc-200 py-1 font-mono text-[11px]">
                        {{ ticketData()?.due_date || '-' }}
                      </p>
                    </div>

                    <!-- 11. Estimado -->
                    <div class="space-y-0.5 min-w-0">
                      <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                        {{ 'ticketContext.estimatedTime' | translate }}
                      </span>
                      <p class="font-medium text-slate-800 dark:text-zinc-200 py-1 font-mono text-[11px]">
                        {{ formatDuration(ticketData()?.estimated_time) }}
                      </p>
                    </div>

                    <!-- 12. Invertido -->
                    <div class="space-y-0.5 min-w-0">
                      <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                        {{ 'ticketContext.spentTime' | translate }}
                      </span>
                      <p class="font-medium text-slate-800 dark:text-zinc-200 py-1 font-mono text-[11px]">
                        {{ formatDuration(ticketData()?.spent_time) }}
                      </p>
                    </div>
                  </div>
                </div>
              </p-tabpanel>

              <!-- Tab 2: Description Panel -->
              <p-tabpanel value="description">
                <div class="space-y-2">
                  @if (sanitizedDescription()) {
                    <div class="flex justify-end">
                      <button
                        pButton
                        type="button"
                        variant="text"
                        severity="secondary"
                        size="small"
                        (click)="copyDescription()"
                        class="!py-0.5 !px-2 text-xs"
                      >
                        @if (copiedDesc()) {
                          <ng-icon name="tablerCheck" size="0.85rem" class="text-emerald-500 mr-1" />
                          <span class="text-emerald-500">{{ 'ticketContext.descriptionCopied' | translate }}</span>
                        } @else {
                          <ng-icon name="tablerCopy" size="0.85rem" class="mr-1" />
                          <span>{{ 'ticketContext.copyDescription' | translate }}</span>
                        }
                      </button>
                    </div>
                  }

                  @if (sanitizedDescription()) {
                    <div
                      class="op-description-content p-3.5 rounded-xl bg-slate-50/80 dark:bg-zinc-950/60 border border-slate-200/70 dark:border-zinc-800 text-xs text-slate-800 dark:text-zinc-200 leading-relaxed max-h-72 overflow-y-auto select-text prose prose-sm dark:prose-invert max-w-none font-sans"
                      (click)="onDescriptionContentClick($event)"
                      [innerHTML]="sanitizedDescription()"
                    ></div>
                  } @else {
                    <div class="py-8 text-center text-slate-400 dark:text-zinc-500 text-xs">
                      <ng-icon name="tablerFileText" size="1.75rem" class="mx-auto mb-1.5 opacity-40" />
                      <p>{{ 'ticketContext.noDescription' | translate }}</p>
                    </div>
                  }
                </div>
              </p-tabpanel>

              <!-- Tab 3: Comments Panel -->
              <p-tabpanel value="comments">
                <div class="space-y-2.5">
                  @if (processedComments().length === 0) {
                    <div class="py-8 text-center text-slate-400 dark:text-zinc-500 text-xs">
                      <ng-icon name="tablerMessages" size="1.75rem" class="mx-auto mb-1.5 opacity-40" />
                      <p>{{ 'ticketContext.noComments' | translate }}</p>
                    </div>
                  } @else {
                    <!-- Filter and Sort Controls (Fixed at the top, outside scrollbar) -->
                    <div class="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-zinc-800/80 flex-wrap">
                      <div class="flex items-center gap-1 flex-wrap">
                        <!-- All -->
                        <button
                          pButton
                          type="button"
                          size="small"
                          [severity]="commentFilter() === 'all' ? 'primary' : 'secondary'"
                          [variant]="commentFilter() === 'all' ? undefined : 'text'"
                          (click)="commentFilter.set('all')"
                          class="!py-0.5 !px-2 text-xs"
                        >
                          <span>{{ 'ticketContext.filterAll' | translate }}</span>
                          <p-badge [value]="processedComments().length" [severity]="commentFilter() === 'all' ? 'contrast' : 'secondary'" size="small" class="ml-1" />
                        </button>
                        <!-- Only Comments -->
                        @if (onlyCommentsCount() > 0) {
                          <button
                            pButton
                            type="button"
                            size="small"
                            [severity]="commentFilter() === 'comments' ? 'primary' : 'secondary'"
                            [variant]="commentFilter() === 'comments' ? undefined : 'text'"
                            (click)="commentFilter.set('comments')"
                            class="!py-0.5 !px-2 text-xs"
                          >
                            <span>{{ 'ticketContext.filterComments' | translate }}</span>
                            <p-badge [value]="onlyCommentsCount()" [severity]="commentFilter() === 'comments' ? 'contrast' : 'secondary'" size="small" class="ml-1" />
                          </button>
                        }
                        <!-- Only Changes -->
                        @if (onlyChangesCount() > 0) {
                          <button
                            pButton
                            type="button"
                            size="small"
                            [severity]="commentFilter() === 'changes' ? 'primary' : 'secondary'"
                            [variant]="commentFilter() === 'changes' ? undefined : 'text'"
                            (click)="commentFilter.set('changes')"
                            class="!py-0.5 !px-2 text-xs"
                          >
                            <span>{{ 'ticketContext.filterChanges' | translate }}</span>
                            <p-badge [value]="onlyChangesCount()" [severity]="commentFilter() === 'changes' ? 'contrast' : 'secondary'" size="small" class="ml-1" />
                          </button>
                        }
                      </div>

                      <!-- Sort order toggle -->
                      <button
                        pButton
                        type="button"
                        size="small"
                        variant="text"
                        severity="secondary"
                        (click)="toggleCommentSort()"
                        class="!py-0.5 !px-2 text-xs shrink-0"
                        [title]="(commentSort() === 'desc' ? 'ticketContext.sortNewest' : 'ticketContext.sortOldest') | translate"
                      >
                        <ng-icon name="tablerArrowsSort" size="0.85rem" class="mr-1" />
                        <span>{{ (commentSort() === 'desc' ? 'ticketContext.sortNewest' : 'ticketContext.sortOldest') | translate }}</span>
                      </button>
                    </div>

                    <!-- Items list (Only this scrolls!) -->
                    <div class="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                      @if (filteredComments().length === 0) {
                        <div class="py-6 text-center text-slate-400 dark:text-zinc-500 text-xs">
                          <p>{{ 'ticketContext.noComments' | translate }}</p>
                        </div>
                      } @else {
                        @for (comment of filteredComments(); track comment.id) {
                          <div
                            class="p-3 rounded-xl bg-slate-50/80 dark:bg-zinc-900/60 border border-slate-200/70 dark:border-zinc-800 space-y-2"
                          >
                            <!-- User & Time Header -->
                            <div class="flex items-center justify-between text-[11px] gap-2">
                              <div class="flex items-center gap-1.5 font-bold text-slate-800 dark:text-zinc-200 truncate">
                                <p-avatar
                                  [label]="getUserInitials(getCommentUserName(comment))"
                                  shape="circle"
                                  class="!size-5 !text-[9px] font-bold shrink-0 bg-primary-100 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300"
                                />
                                <span class="truncate">{{ getCommentUserName(comment) }}</span>
                              </div>
                              @if (getCommentDate(comment)) {
                                <span class="text-[10px] text-slate-400 dark:text-zinc-500 shrink-0 font-medium">
                                  {{ formatDate(getCommentDate(comment)) }}
                                </span>
                              }
                            </div>

                            <!-- Comment Note Text (Rich formatting, handles inline images) -->
                            @if (getCommentHtml(comment).trim()) {
                              <div
                                class="op-comment-body prose prose-sm dark:prose-invert max-w-none text-xs text-slate-700 dark:text-zinc-300 leading-relaxed break-words select-text font-normal font-sans"
                                (click)="onCommentContentClick($event)"
                                [innerHTML]="sanitizeHtml(getCommentHtml(comment))"
                              ></div>
                            }

                            <!-- Detail changes list (if any) -->
                            @if (getCommentDetails(comment).length > 0) {
                              <div
                                class="rounded-lg bg-slate-100/70 dark:bg-zinc-950/40 p-2 space-y-1 border border-slate-200/50 dark:border-zinc-800/50"
                              >
                                @for (detail of getCommentDetails(comment); track $index) {
                                  <div class="text-[11px] text-slate-600 dark:text-zinc-400 flex items-start gap-1.5 leading-snug">
                                    <span class="text-primary-500 shrink-0 mt-0.5">•</span>
                                    <span class="op-detail-content" [innerHTML]="sanitizeHtml(detail.html || detail.raw)"></span>
                                  </div>
                                }
                              </div>
                            }
                          </div>
                        }
                      }
                    </div>
                  }
                </div>
              </p-tabpanel>

              <!-- Tab 4: Attachments Panel -->
              <p-tabpanel value="attachments">
                <div class="space-y-3 max-h-80 overflow-y-auto pr-1">
                  @if (allAttachments().length === 0) {
                    <div class="py-8 text-center text-slate-400 dark:text-zinc-500 text-xs">
                      <ng-icon name="tablerPaperclip" size="1.75rem" class="mx-auto mb-1.5 opacity-40" />
                      <p>{{ 'ticketContext.noAttachments' | translate }}</p>
                    </div>
                  } @else {
                    <!-- Image Attachments Grid -->
                    @if (imageAttachments().length > 0) {
                      <div class="space-y-1.5">
                        <div class="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                          <ng-icon name="tablerPhoto" size="0.8rem" />
                          <span>{{ 'ticketContext.images' | translate }} ({{ imageAttachments().length }})</span>
                        </div>
                        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          @for (img of imageAttachments(); track img.id) {
                            <div
                              class="group relative rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 overflow-hidden cursor-pointer aspect-video flex flex-col justify-end"
                              (click)="openImagePreview(img)"
                            >
                              @if (img.dataUrl) {
                                <img
                                  [src]="img.dataUrl"
                                  [alt]="img.fileName"
                                  class="absolute inset-0 size-full object-cover transition-transform duration-200 group-hover:scale-105"
                                />
                              } @else {
                                <div class="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-1 bg-slate-100/50 dark:bg-zinc-900/50">
                                  @if (img.isLoading) {
                                    <ng-icon name="tablerRefresh" class="animate-spin text-primary-500" size="1.25rem" />
                                    <span class="text-[9px] text-slate-400">Cargando...</span>
                                  } @else {
                                    <ng-icon name="tablerPhoto" size="1.5rem" />
                                  }
                                </div>
                              }

                              <div class="relative z-10 p-1.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white text-[10px] truncate font-medium flex items-center justify-between">
                                <span class="truncate">{{ img.fileName }}</span>
                                <button
                                  type="button"
                                  (click)="$event.stopPropagation(); openAttachment(img)"
                                  class="text-white/80 hover:text-white shrink-0 ml-1 cursor-pointer"
                                  [title]="'ticketContext.openInBrowser' | translate"
                                >
                                  <ng-icon name="tablerExternalLink" size="0.75rem" />
                                </button>
                              </div>
                            </div>
                          }
                        </div>
                      </div>
                    }

                    <!-- Other File Attachments List (Direct web-like redirection links) -->
                    @if (fileAttachments().length > 0) {
                      <div class="space-y-1.5">
                        <div class="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                          <ng-icon name="tablerPaperclip" size="0.8rem" />
                          <span>{{ 'ticketContext.files' | translate }} ({{ fileAttachments().length }})</span>
                        </div>
                        <div class="divide-y divide-slate-100 dark:divide-zinc-800/80 rounded-xl border border-slate-200/70 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/40 overflow-hidden">
                          @for (file of fileAttachments(); track file.id) {
                            <div
                              class="p-2.5 flex items-center justify-between gap-2 hover:bg-slate-100/70 dark:hover:bg-zinc-800/50 transition-colors group"
                            >
                              <a
                                href="javascript:void(0)"
                                (click)="openAttachment(file)"
                                class="flex items-center gap-2 min-w-0 flex-1 text-slate-700 dark:text-zinc-200 hover:text-primary-600 dark:hover:text-primary-400 no-underline cursor-pointer group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors"
                              >
                                <ng-icon name="tablerPaperclip" size="1.05rem" class="text-primary-500 shrink-0" />
                                <span class="text-xs font-medium truncate underline underline-offset-2 decoration-slate-300 dark:decoration-zinc-700 group-hover:decoration-primary-500">
                                  {{ file.fileName }}
                                </span>
                                <span class="text-[10px] text-slate-400 dark:text-zinc-500 font-mono shrink-0 ml-1">
                                  ({{ formatFileSize(file.fileSize) }})
                                </span>
                              </a>

                              <button
                                pButton
                                type="button"
                                variant="text"
                                severity="secondary"
                                size="small"
                                (click)="openAttachment(file)"
                                class="!py-0.5 !px-1.5 text-xs text-slate-400 hover:text-primary-600 shrink-0"
                                [title]="'ticketContext.openInBrowser' | translate"
                              >
                                <ng-icon name="tablerExternalLink" size="0.9rem" />
                              </button>
                            </div>
                          }
                        </div>
                      </div>
                    }
                  }
                </div>
              </p-tabpanel>
            </p-tabpanels>
          </p-tabs>
        }
      </div>

      <!-- Footer Buttons -->
      <ng-template #footer>
        <div class="flex items-center justify-between gap-2 pt-2">
          @if (ticketData()) {
            <button
              pButton
              type="button"
              severity="primary"
              size="small"
              (click)="logTimeForTicket()"
              class="!py-1.5 !px-3 text-xs font-semibold"
            >
              <ng-icon name="tablerPlus" size="0.9rem" class="mr-1" />
              <span>{{ 'ticketContext.logTimeForTicket' | translate }}</span>
            </button>
          } @else {
            <div></div>
          }

          <button
            pButton
            type="button"
            severity="secondary"
            variant="text"
            size="small"
            (click)="activityService.closeTicketContextModal()"
            class="text-xs"
          >
            {{ 'common.close' | translate }}
          </button>
        </div>
      </ng-template>
    </p-dialog>

    <!-- Expanded Image Lightbox Dialog -->
    <p-dialog
      [visible]="!!previewImage()"
      (visibleChange)="onPreviewVisibleChange($event)"
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      [style]="{ width: '92vw', maxWidth: '800px', minWidth: 'min(92vw, 380px)' }"
      styleClass="p-dialog-rounded"
    >
      <ng-template #header>
        <div class="flex items-center justify-between w-full pr-4">
          <div class="flex items-center gap-2 min-w-0">
            <ng-icon name="tablerPhoto" size="1.1rem" class="text-primary-500 shrink-0" />
            <h4 class="text-sm font-bold text-slate-900 dark:text-zinc-100 truncate">
              {{ selectedAttachmentName() }}
            </h4>
          </div>
          @if (selectedAttachment()) {
            <button
              pButton
              type="button"
              variant="text"
              severity="secondary"
              size="small"
              (click)="openAttachment(selectedAttachment()!)"
              class="!py-0.5 !px-2 text-xs shrink-0"
              [title]="'ticketContext.openInBrowser' | translate"
            >
              <ng-icon name="tablerExternalLink" size="0.85rem" class="mr-1" />
              <span>{{ 'ticketContext.openInBrowser' | translate }}</span>
            </button>
          }
        </div>
      </ng-template>
      <div class="flex items-center justify-center p-2 bg-slate-950 rounded-xl overflow-hidden min-h-[200px]">
        @if (previewImage()) {
          <img [src]="previewImage()" [alt]="selectedAttachmentName()" class="max-h-[70vh] object-contain rounded" />
        } @else {
          <ng-icon name="tablerRefresh" class="animate-spin text-white" size="2rem" />
        }
      </div>
    </p-dialog>
  `,
})
export class TicketContextModalComponent {
  readonly activityService = inject(ActivityService);
  private readonly openprojectService = inject(OpenprojectService);
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
      void this.openprojectService.getStatuses().then((st) => {
        if (this.availableStatuses().length === 0 && st.length > 0) {
          this.availableStatuses.set(st);
        }
      });
    }

    try {
      const res = await this.openprojectService.getTicketContext(ticket, {
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
          const fetched = await this.openprojectService.getStatuses();
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
      const boards = await this.openprojectService.getProjectBoards(projectId, projectIdentifier);
      this.availableBoards.set(boards);

      // 1. First attempt to find existing location on any board for this ticket
      const location = await this.openprojectService.findTicketBoardColumn(projectId, ticket, projectIdentifier);
      if (location) {
        this.currentLocation.set(location);
        this.currentBoardId.set(location.boardId);
        this.currentBoardName.set(location.boardName);
        this.selectedColumnId.set(location.boardColumnQueryId);

        this.isLoadingColumns.set(true);
        const cols = await this.openprojectService.getBoardColumns(location.boardId);
        this.columns.set(cols);
        this.isLoadingColumns.set(false);
      } else if (boards.length > 0) {
        // 2. Fallback: inspect project boards to select the main/default board
        const defaultBoard = boards[0];
        this.currentBoardId.set(defaultBoard.id);
        this.currentBoardName.set(defaultBoard.name);

        this.isLoadingColumns.set(true);
        const cols = await this.openprojectService.getBoardColumns(defaultBoard.id);
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
      const res = await this.openprojectService.updateWorkPackageStatus(ticket, newStatusId, lockVersion);
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
      } else {
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
      const res = await this.openprojectService.moveWorkPackageToBoardColumn(
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
      } else {
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
          dataUrl = await this.openprojectService.fetchAttachmentContent(url);
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
          dataUrl = await this.openprojectService.fetchAttachmentContent(url);
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
      this.openprojectService
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
      const dataUrl = await this.openprojectService.fetchAttachmentContent(downloadUrl);
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
