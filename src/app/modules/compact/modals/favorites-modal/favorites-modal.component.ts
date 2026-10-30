import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Dialog } from 'primeng/dialog';
import { ButtonDirective } from 'primeng/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerStar, tablerX } from '@ng-icons/tabler-icons';
import { FavoriteTicket } from '../../../../core/interfaces/activity.interface';
import { ActivityService } from '../../../../core/services/activity.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-favorites-modal',
  standalone: true,
  imports: [CommonModule, Dialog, ButtonDirective, NgIcon, TranslatePipe],
  viewProviders: [
    provideIcons({
      tablerStar,
      tablerX,
    }),
  ],
  template: `
    <p-dialog
      [visible]="activityService.showFavoritesModal()"
      (visibleChange)="onVisibleChange($event)"
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      [style]="{ width: '92vw', maxWidth: '420px' }"
      styleClass="p-dialog-rounded"
    >
      <ng-template #header>
        <div class="flex items-center gap-2.5">
          <div
            class="size-8 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold"
          >
            <ng-icon name="tablerStar" class="fill-amber-500" size="1.2rem" />
          </div>
          <div>
            <h3 class="text-sm sm:text-base font-bold text-slate-900 dark:text-zinc-100">
              {{ 'compact.favorites' | translate }}
            </h3>
            <p class="text-[11px] text-slate-500 dark:text-zinc-400">
              {{ 'compact.favoritesTitle' | translate }}
            </p>
          </div>
        </div>
      </ng-template>

      <div class="space-y-2 py-2 max-h-72 overflow-y-auto">
        @if (activityService.favoriteTickets().length === 0) {
          <div class="text-center py-8 text-slate-400 dark:text-zinc-500 text-xs select-none">
            <ng-icon name="tablerStar" size="2rem" class="mx-auto mb-2 opacity-40 text-amber-500" />
            <p>{{ 'compact.modal.noFavorites' | translate }}</p>
          </div>
        } @else {
          @for (fav of activityService.favoriteTickets(); track fav.ticket) {
            <div
              class="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/60 cursor-pointer transition-colors"
              (click)="selectFavorite(fav)"
            >
              <div class="min-w-0 pr-2">
                <div class="flex items-center gap-1.5">
                  <span class="font-mono font-bold text-xs text-primary-600 dark:text-primary-400">
                    #{{ fav.ticket }}
                  </span>
                  @if (fav.projectName) {
                    <span class="text-[10px] text-slate-400 dark:text-zinc-500 truncate">
                      {{ fav.projectName }}
                    </span>
                  }
                </div>
                <p class="text-xs font-medium text-slate-700 dark:text-zinc-200 truncate mt-0.5">
                  {{ fav.title }}
                </p>
              </div>
              <button
                type="button"
                (click)="$event.stopPropagation(); removeFavorite(fav)"
                class="cursor-pointer text-slate-400 hover:text-red-500 p-1"
                [title]="'compact.modal.removeFavorite' | translate"
              >
                <ng-icon name="tablerStar" class="text-amber-500 fill-amber-500" size="1.1rem" />
              </button>
            </div>
          }
        }
      </div>

      <ng-template #footer>
        <div class="flex items-center justify-end gap-2 pt-2">
          <button
            pButton
            type="button"
            severity="secondary"
            variant="text"
            size="small"
            (click)="activityService.closeFavoritesModal()"
            class="text-xs"
          >
            {{ 'compact.cancel' | translate }}
          </button>
        </div>
      </ng-template>
    </p-dialog>
  `,
})
export class FavoritesModalComponent {
  readonly activityService = inject(ActivityService);

  onVisibleChange(visible: boolean): void {
    if (!visible) {
      this.activityService.closeFavoritesModal();
    }
  }

  selectFavorite(fav: FavoriteTicket): void {
    this.activityService.closeFavoritesModal();
    this.activityService.openAddModal({
      ticket: fav.ticket,
      title: fav.title,
      projectId: fav.projectId,
      projectName: fav.projectName,
    });
  }

  removeFavorite(fav: FavoriteTicket): void {
    this.activityService.toggleFavorite(fav.ticket, fav.title);
  }
}
