import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Dialog } from 'primeng/dialog';
import { ButtonDirective } from 'primeng/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerStar, tablerX, tablerFileText } from '@ng-icons/tabler-icons';
import { FavoriteTicket } from '../../../../core/interfaces/activity.interface';
import { ActivityService } from '../../../../core/services/activity.service';
import { FavoriteService } from '../../../../core/services/favorite.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-favorites-modal',
  standalone: true,
  imports: [CommonModule, Dialog, ButtonDirective, NgIcon, TranslatePipe],
  viewProviders: [
    provideIcons({
      tablerStar,
      tablerX,
      tablerFileText,
    }),
  ],
  templateUrl: './favorites-modal.component.html',
})
export class FavoritesModalComponent {
  readonly activityService = inject(ActivityService);
  readonly favoriteService = inject(FavoriteService);

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
    this.favoriteService.toggleFavorite(fav.ticket, fav.title);
  }
}
