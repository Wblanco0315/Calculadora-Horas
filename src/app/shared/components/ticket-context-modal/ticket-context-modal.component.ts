import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Dialog } from 'primeng/dialog';
import { ButtonDirective } from 'primeng/button';
import { Skeleton } from 'primeng/skeleton';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from 'primeng/tabs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerFileText,
  tablerMessages,
  tablerPaperclip,
  tablerPhoto,
  tablerDownload,
  tablerCopy,
  tablerCheck,
  tablerClock,
  tablerCalendar,
  tablerUser,
  tablerTag,
  tablerFolder,
  tablerRefresh,
  tablerExternalLink,
  tablerEye,
  tablerX,
  tablerAlertCircle,
  tablerPlus,
  tablerFilter,
  tablerArrowsSort,
  tablerHistory,
} from '@ng-icons/tabler-icons';
import { ActivityService } from '../../../core/services/activity.service';
import { OpenprojectService } from '../../../core/services/openproject.service';
import {
  TicketAttachment,
  TicketComment,
  TicketContextResult,
} from '../../../core/interfaces/openproject.interface';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-ticket-context-modal',
  standalone: true,
  imports: [
    CommonModule,
    Dialog,
    ButtonDirective,
    Skeleton,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    NgIcon,
    TranslatePipe,
  ],
  viewProviders: [
    provideIcons({
      tablerFileText,
      tablerMessages,
      tablerPaperclip,
      tablerPhoto,
      tablerDownload,
      tablerCopy,
      tablerCheck,
      tablerClock,
      tablerCalendar,
      tablerUser,
      tablerTag,
      tablerFolder,
      tablerRefresh,
      tablerExternalLink,
      tablerEye,
      tablerX,
      tablerAlertCircle,
      tablerPlus,
      tablerFilter,
      tablerArrowsSort,
      tablerHistory,
    }),
  ],
  styles: [
    `
      :host ::ng-deep {
        .op-comment-body {
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
          img.op-uc-image,
          figure.op-uc-figure img {
            border-radius: 0.5rem;
            max-width: 100%;
            max-height: 220px;
            object-fit: contain;
            border: 1px solid rgba(148, 163, 184, 0.3);
            cursor: pointer;
            transition: transform 0.15s ease;
            background-color: rgba(248, 250, 252, 0.8);
          }
          img.op-uc-image:hover,
          figure.op-uc-figure img:hover {
            transform: scale(1.02);
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
      [style]="{ width: '94vw', maxWidth: '640px' }"
      styleClass="p-dialog-rounded"
    >
      <!-- Clean Minimal Header: Icon + Ticket Number & Subject -->
      <ng-template #header>
        <div class="flex items-center gap-2.5 min-w-0 pr-2">
          <div
            class="size-8 rounded-xl bg-primary-100 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0 font-bold"
          >
            <ng-icon name="tablerFileText" size="1.2rem" />
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="font-mono font-bold text-xs text-primary-600 dark:text-primary-400">
                #{{ currentTicket() }}
              </span>
              @if (ticketData()?.status_name) {
                <span
                  class="text-[10px] font-semibold px-1.5 py-0.2 rounded border"
                  [style.borderColor]="ticketData()?.status_color || '#3b82f6'"
                  [style.color]="ticketData()?.status_color || '#3b82f6'"
                >
                  {{ ticketData()?.status_name }}
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
      <div class="space-y-3 pt-1 pb-2">
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
              <!-- 1. Description Tab -->
              <p-tab value="description">
                <div class="flex items-center gap-1.5 text-xs font-semibold py-0.5">
                  <ng-icon name="tablerFileText" size="0.95rem" />
                  <span>{{ 'ticketContext.descriptionTab' | translate }}</span>
                </div>
              </p-tab>

              <!-- 2. Comments Tab -->
              <p-tab value="comments">
                <div class="flex items-center gap-1.5 text-xs font-semibold py-0.5">
                  <ng-icon name="tablerMessages" size="0.95rem" />
                  <span>{{ 'ticketContext.commentsTab' | translate }}</span>
                  @if (commentsCount() > 0) {
                    <span class="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-primary-100 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400">
                      {{ commentsCount() }}
                    </span>
                  }
                </div>
              </p-tab>

              <!-- 3. Attachments & Images Tab -->
              <p-tab value="attachments">
                <div class="flex items-center gap-1.5 text-xs font-semibold py-0.5">
                  <ng-icon name="tablerPaperclip" size="0.95rem" />
                  <span>{{ 'ticketContext.attachmentsTab' | translate }}</span>
                  @if (attachmentsCount() > 0) {
                    <span class="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-primary-100 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400">
                      {{ attachmentsCount() }}
                    </span>
                  }
                </div>
              </p-tab>

              <!-- 4. Details / Metadata Tab -->
              <p-tab value="details">
                <div class="flex items-center gap-1.5 text-xs font-semibold py-0.5">
                  <ng-icon name="tablerTag" size="0.95rem" />
                  <span>{{ 'ticketContext.detailsTab' | translate }}</span>
                </div>
              </p-tab>
            </p-tablist>

            <p-tabpanels class="!p-0 !pt-3">
              <!-- Tab 1: Description Panel -->
              <p-tabpanel value="description">
                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                      {{ 'ticketContext.descriptionTab' | translate }}
                    </span>
                    @if (sanitizedDescription()) {
                      <button
                        type="button"
                        (click)="copyDescription()"
                        class="text-[11px] text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                      >
                        @if (copiedDesc()) {
                          <ng-icon name="tablerCheck" size="0.85rem" class="text-emerald-500" />
                          <span class="text-emerald-500">{{ 'ticketContext.descriptionCopied' | translate }}</span>
                        } @else {
                          <ng-icon name="tablerCopy" size="0.85rem" />
                          <span>{{ 'ticketContext.copyDescription' | translate }}</span>
                        }
                      </button>
                    }
                  </div>

                  @if (sanitizedDescription()) {
                    <div
                      class="p-3.5 rounded-xl bg-slate-50/80 dark:bg-zinc-950/60 border border-slate-200/70 dark:border-zinc-800 text-xs text-slate-800 dark:text-zinc-200 leading-relaxed max-h-72 overflow-y-auto select-text prose prose-sm dark:prose-invert max-w-none font-sans"
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

              <!-- Tab 2: Comments Panel -->
              <p-tabpanel value="comments">
                <div class="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                  @if (processedComments().length === 0) {
                    <div class="py-8 text-center text-slate-400 dark:text-zinc-500 text-xs">
                      <ng-icon name="tablerMessages" size="1.75rem" class="mx-auto mb-1.5 opacity-40" />
                      <p>{{ 'ticketContext.noComments' | translate }}</p>
                    </div>
                  } @else {
                    <!-- Filter and Sort Controls -->
                    <div class="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-100 dark:border-zinc-800/80">
                      <div class="flex items-center gap-1">
                        <!-- All -->
                        <button
                          type="button"
                          (click)="commentFilter.set('all')"
                          class="px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer"
                          [class.bg-primary-500]="commentFilter() === 'all'"
                          [class.text-white]="commentFilter() === 'all'"
                          [class.bg-slate-100]="commentFilter() !== 'all'"
                          [class.dark:bg-zinc-800]="commentFilter() !== 'all'"
                          [class.text-slate-600]="commentFilter() !== 'all'"
                          [class.dark:text-zinc-400]="commentFilter() !== 'all'"
                        >
                          {{ 'ticketContext.filterAll' | translate }} ({{ processedComments().length }})
                        </button>
                        <!-- Only Comments -->
                        @if (onlyCommentsCount() > 0) {
                          <button
                            type="button"
                            (click)="commentFilter.set('comments')"
                            class="px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer"
                            [class.bg-primary-500]="commentFilter() === 'comments'"
                            [class.text-white]="commentFilter() === 'comments'"
                            [class.bg-slate-100]="commentFilter() !== 'comments'"
                            [class.dark:bg-zinc-800]="commentFilter() !== 'comments'"
                            [class.text-slate-600]="commentFilter() !== 'comments'"
                            [class.dark:text-zinc-400]="commentFilter() !== 'comments'"
                          >
                            {{ 'ticketContext.filterComments' | translate }} ({{ onlyCommentsCount() }})
                          </button>
                        }
                        <!-- Only Changes -->
                        @if (onlyChangesCount() > 0) {
                          <button
                            type="button"
                            (click)="commentFilter.set('changes')"
                            class="px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer"
                            [class.bg-primary-500]="commentFilter() === 'changes'"
                            [class.text-white]="commentFilter() === 'changes'"
                            [class.bg-slate-100]="commentFilter() !== 'changes'"
                            [class.dark:bg-zinc-800]="commentFilter() !== 'changes'"
                            [class.text-slate-600]="commentFilter() !== 'changes'"
                            [class.dark:text-zinc-400]="commentFilter() !== 'changes'"
                          >
                            {{ 'ticketContext.filterChanges' | translate }} ({{ onlyChangesCount() }})
                          </button>
                        }
                      </div>

                      <!-- Sort order toggle -->
                      <button
                        type="button"
                        (click)="toggleCommentSort()"
                        class="flex items-center gap-1 text-[10px] text-slate-500 dark:text-zinc-400 hover:text-primary-600 dark:hover:text-primary-400 cursor-pointer font-medium px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                        [title]="(commentSort() === 'desc' ? 'ticketContext.sortNewest' : 'ticketContext.sortOldest') | translate"
                      >
                        <ng-icon name="tablerArrowsSort" size="0.85rem" />
                        <span>{{ (commentSort() === 'desc' ? 'ticketContext.sortNewest' : 'ticketContext.sortOldest') | translate }}</span>
                      </button>
                    </div>

                    <!-- Items list -->
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
                              <span class="size-5 rounded-full bg-primary-100 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 flex items-center justify-center text-[9px] font-bold shrink-0">
                                {{ getUserInitials(getCommentUserName(comment)) }}
                              </span>
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
                  }
                </div>
              </p-tabpanel>

              <!-- Tab 3: Attachments Panel -->
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
                        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 flex items-center gap-1">
                          <ng-icon name="tablerPhoto" size="0.8rem" />
                          <span>Imágenes ({{ imageAttachments().length }})</span>
                        </span>
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
                                <div class="absolute inset-0 flex items-center justify-center text-slate-400">
                                  @if (img.isLoading) {
                                    <ng-icon name="tablerRefresh" class="animate-spin" size="1.25rem" />
                                  } @else {
                                    <ng-icon name="tablerPhoto" size="1.5rem" />
                                  }
                                </div>
                              }

                              <div class="relative z-10 p-1.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white text-[10px] truncate font-medium">
                                {{ img.fileName }}
                              </div>
                            </div>
                          }
                        </div>
                      </div>
                    }

                    <!-- Other File Attachments List -->
                    @if (fileAttachments().length > 0) {
                      <div class="space-y-1.5">
                        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 flex items-center gap-1">
                          <ng-icon name="tablerPaperclip" size="0.8rem" />
                          <span>Archivos ({{ fileAttachments().length }})</span>
                        </span>
                        <div class="space-y-1.5">
                          @for (file of fileAttachments(); track file.id) {
                            <div
                              class="p-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between gap-2"
                            >
                              <div class="flex items-center gap-2 min-w-0">
                                <ng-icon name="tablerPaperclip" size="1.1rem" class="text-primary-500 shrink-0" />
                                <div class="min-w-0">
                                  <p class="text-xs font-semibold text-slate-800 dark:text-zinc-200 truncate">
                                    {{ file.fileName }}
                                  </p>
                                  <span class="text-[10px] text-slate-400 font-mono">
                                    {{ formatFileSize(file.fileSize) }}
                                  </span>
                                </div>
                              </div>

                              <button
                                pButton
                                type="button"
                                severity="secondary"
                                variant="outlined"
                                size="small"
                                (click)="downloadAttachment(file)"
                                class="!py-1 !px-2.5 text-xs font-semibold shrink-0"
                              >
                                <ng-icon name="tablerDownload" size="0.85rem" class="mr-1" />
                                <span>{{ 'ticketContext.downloadFile' | translate }}</span>
                              </button>
                            </div>
                          }
                        </div>
                      </div>
                    }
                  }
                </div>
              </p-tabpanel>

              <!-- Tab 4: Details Panel -->
              <p-tabpanel value="details">
                <div class="grid grid-cols-2 gap-2.5 text-xs p-3 rounded-xl bg-slate-50/80 dark:bg-zinc-900/60 border border-slate-200/70 dark:border-zinc-800">
                  <!-- Proyecto -->
                  <div class="space-y-0.5">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                      {{ 'ticketContext.project' | translate }}
                    </span>
                    <p class="font-medium text-slate-800 dark:text-zinc-200 truncate">
                      {{ ticketData()?.project_name || '-' }}
                    </p>
                  </div>

                  <!-- Estado -->
                  <div class="space-y-0.5">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                      {{ 'compact.status' | translate }}
                    </span>
                    <p class="font-medium text-slate-800 dark:text-zinc-200 truncate flex items-center gap-1.5">
                      @if (ticketData()?.status_name) {
                        <span
                          class="size-2 rounded-full shrink-0"
                          [style.backgroundColor]="ticketData()?.status_color || '#3b82f6'"
                        ></span>
                        <span>{{ ticketData()?.status_name }}</span>
                      } @else {
                        <span>-</span>
                      }
                    </p>
                  </div>

                  <!-- Asignado -->
                  <div class="space-y-0.5">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                      {{ 'ticketContext.assignedTo' | translate }}
                    </span>
                    <p class="font-medium text-slate-800 dark:text-zinc-200 truncate">
                      {{ ticketData()?.assignee_name || '-' }}
                    </p>
                  </div>

                  <!-- Responsable -->
                  <div class="space-y-0.5">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                      {{ 'ticketContext.responsible' | translate }}
                    </span>
                    <p class="font-medium text-slate-800 dark:text-zinc-200 truncate">
                      {{ ticketData()?.responsible_name || '-' }}
                    </p>
                  </div>

                  <!-- Prioridad -->
                  <div class="space-y-0.5">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                      {{ 'ticketContext.priority' | translate }}
                    </span>
                    <p class="font-medium text-slate-800 dark:text-zinc-200 truncate">
                      {{ ticketData()?.priority_name || '-' }}
                    </p>
                  </div>

                  <!-- Versión -->
                  <div class="space-y-0.5">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                      {{ 'ticketContext.version' | translate }}
                    </span>
                    <p class="font-medium text-slate-800 dark:text-zinc-200 truncate">
                      {{ ticketData()?.version_name || '-' }}
                    </p>
                  </div>

                  <!-- Inicio -->
                  <div class="space-y-0.5">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                      {{ 'ticketContext.startDate' | translate }}
                    </span>
                    <p class="font-medium text-slate-800 dark:text-zinc-200">
                      {{ ticketData()?.start_date || '-' }}
                    </p>
                  </div>

                  <!-- Vencimiento -->
                  <div class="space-y-0.5">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                      {{ 'ticketContext.dueDate' | translate }}
                    </span>
                    <p class="font-medium text-slate-800 dark:text-zinc-200">
                      {{ ticketData()?.due_date || '-' }}
                    </p>
                  </div>
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
      [style]="{ width: '92vw', maxWidth: '800px' }"
      styleClass="p-dialog-rounded"
    >
      <ng-template #header>
        <div class="flex items-center gap-2">
          <ng-icon name="tablerPhoto" size="1.1rem" class="text-primary-500" />
          <h4 class="text-sm font-bold text-slate-900 dark:text-zinc-100">
            {{ selectedAttachmentName() }}
          </h4>
        </div>
      </ng-template>
      <div class="flex items-center justify-center p-2 bg-slate-950 rounded-xl overflow-hidden">
        <img [src]="previewImage()" [alt]="selectedAttachmentName()" class="max-h-[70vh] object-contain rounded" />
      </div>
    </p-dialog>
  `,
})
export class TicketContextModalComponent {
  readonly activityService = inject(ActivityService);
  private readonly openprojectService = inject(OpenprojectService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly activeTab = signal<string>('description');
  readonly ticketData = signal<TicketContextResult | null>(null);
  readonly processedComments = signal<TicketComment[]>([]);
  readonly commentFilter = signal<'all' | 'comments' | 'changes'>('all');
  readonly commentSort = signal<'desc' | 'asc'>('desc');
  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly copiedDesc = signal<boolean>(false);

  readonly previewImage = signal<string | null>(null);
  readonly selectedAttachmentName = signal<string>('');

  readonly currentTicket = computed<string>(() => {
    return this.activityService.contextTicket() || '';
  });

  readonly sanitizedDescription = computed<SafeHtml | null>(() => {
    const data = this.ticketData();
    const html = data?.description?.html;
    const raw = data?.description?.raw;
    if (html) {
      return this.sanitizer.bypassSecurityTrustHtml(html);
    }
    if (raw) {
      return this.sanitizer.bypassSecurityTrustHtml(`<p class="whitespace-pre-wrap">${raw}</p>`);
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
    return (this.ticketData()?.attachments || []).map((a) => ({
      ...a,
      fileName: a.fileName || a.file_name || 'archivo',
      downloadUrl: a.downloadUrl || a.download_url || '',
      isImage: a.isImage ?? a.is_image ?? false,
      fileSize: a.fileSize ?? a.file_size ?? 0,
      authorName: a.authorName || a.author_name || undefined,
      createdAt: a.createdAt || a.created_at || undefined,
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

  getUserInitials(name: string): string {
    if (!name || name === 'Desconocido') return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  private resetState(): void {
    this.ticketData.set(null);
    this.processedComments.set([]);
    this.commentFilter.set('all');
    this.commentSort.set('desc');
    this.errorMessage.set(null);
    this.activeTab.set('description');
    this.copiedDesc.set(false);
    this.previewImage.set(null);
  }

  private async loadTicketContext(ticket: string): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      const res = await this.openprojectService.getTicketContext(ticket, {
        includeDescription: true,
        includeComments: true,
        includeAttachments: true,
      });

      if (res.success) {
        this.ticketData.set(res);

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

        // Pre-load images for gallery preview
        if (res.attachments && res.attachments.length > 0) {
          this.preloadImages(res.attachments);
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

  private async preloadInlineImages(comments: TicketComment[]): Promise<void> {
    const regex = /(?:src=["'])([^"']*\/attachments\/(\d+)\/content[^"']*)(?:["'])/gi;
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
      try {
        const dataUrl = await this.openprojectService.fetchAttachmentContent(url);
        urlToDataUrl.set(url, dataUrl);
      } catch (e) {
        console.warn('Could not load inline image:', url, e);
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

  private preloadImages(attachments: TicketAttachment[]): void {
    const images = attachments.filter((a) => (a.isImage ?? a.is_image) && (a.downloadUrl || a.download_url) && !a.dataUrl);
    for (const img of images) {
      img.isLoading = true;
      const downloadUrl = img.downloadUrl || img.download_url || '';
      this.openprojectService
        .fetchAttachmentContent(downloadUrl)
        .then((dataUrl) => {
          img.dataUrl = dataUrl;
          img.isLoading = false;
        })
        .catch(() => {
          img.isLoading = false;
        });
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
    if (att.dataUrl) {
      this.previewImage.set(att.dataUrl);
      return;
    }

    try {
      att.isLoading = true;
      const dataUrl = await this.openprojectService.fetchAttachmentContent(downloadUrl);
      att.dataUrl = dataUrl;
      this.previewImage.set(dataUrl);
    } catch (e) {
      console.warn('Could not load image preview:', e);
    } finally {
      att.isLoading = false;
    }
  }

  async downloadAttachment(att: TicketAttachment): Promise<void> {
    try {
      const fileName = att.fileName || att.file_name || 'archivo';
      const downloadUrl = att.downloadUrl || att.download_url || '';
      const dataUrl = att.dataUrl || (await this.openprojectService.fetchAttachmentContent(downloadUrl));
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.warn('Error downloading attachment:', e);
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
