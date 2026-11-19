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
    }),
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
                  @if ((ticketData()?.comments || []).length === 0) {
                    <div class="py-8 text-center text-slate-400 dark:text-zinc-500 text-xs">
                      <ng-icon name="tablerMessages" size="1.75rem" class="mx-auto mb-1.5 opacity-40" />
                      <p>{{ 'ticketContext.noComments' | translate }}</p>
                    </div>
                  } @else {
                    @for (comment of ticketData()?.comments; track comment.id) {
                      <div
                        class="p-3 rounded-xl bg-slate-50/80 dark:bg-zinc-900/60 border border-slate-200/70 dark:border-zinc-800 space-y-1.5"
                      >
                        <div class="flex items-center justify-between text-[11px] gap-2">
                          <div class="flex items-center gap-1.5 font-bold text-slate-800 dark:text-zinc-200 truncate">
                            <ng-icon name="tablerUser" size="0.85rem" class="text-primary-500 shrink-0" />
                            <span class="truncate">{{ comment.userName }}</span>
                          </div>
                          @if (comment.createdAt) {
                            <span class="text-[10px] text-slate-400 dark:text-zinc-500 shrink-0">
                              {{ formatDate(comment.createdAt) }}
                            </span>
                          }
                        </div>
                        <div
                          class="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed break-words whitespace-pre-wrap select-text font-normal"
                          [innerHTML]="sanitizeHtml(comment.commentHtml || comment.commentRaw)"
                        ></div>
                      </div>
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
    return (this.ticketData()?.comments || []).length;
  });

  readonly allAttachments = computed<TicketAttachment[]>(() => {
    return this.ticketData()?.attachments || [];
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

  private resetState(): void {
    this.ticketData.set(null);
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

  private preloadImages(attachments: TicketAttachment[]): void {
    const images = attachments.filter((a) => a.isImage && a.downloadUrl && !a.dataUrl);
    for (const img of images) {
      img.isLoading = true;
      this.openprojectService
        .fetchAttachmentContent(img.downloadUrl)
        .then((dataUrl) => {
          img.dataUrl = dataUrl;
          img.isLoading = false;
        })
        .catch(() => {
          img.isLoading = false;
        });
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
    this.selectedAttachmentName.set(att.fileName);
    if (att.dataUrl) {
      this.previewImage.set(att.dataUrl);
      return;
    }

    try {
      att.isLoading = true;
      const dataUrl = await this.openprojectService.fetchAttachmentContent(att.downloadUrl);
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
      const dataUrl = att.dataUrl || (await this.openprojectService.fetchAttachmentContent(att.downloadUrl));
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = att.fileName;
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
