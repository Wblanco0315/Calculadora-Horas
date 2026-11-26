import { Component, computed, inject, signal, effect, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Dialog } from 'primeng/dialog';
import { ButtonDirective } from 'primeng/button';
import { Select } from 'primeng/select';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerCloudUpload,
  tablerRefresh,
  tablerCheck,
  tablerAlertCircle,
} from '@ng-icons/tabler-icons';
import { Activity } from '../../../../core/interfaces/activity.interface';
import { ActivityService } from '../../../../core/services/activity.service';
import { FavoriteService } from '../../../../core/services/favorite.service';
import { LanguageService } from '../../../../core/services/language.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-sync-confirm-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, Dialog, ButtonDirective, Select, NgIcon, TranslatePipe],
  viewProviders: [
    provideIcons({
      tablerCloudUpload,
      tablerRefresh,
      tablerCheck,
      tablerAlertCircle,
    }),
  ],
  templateUrl: './sync-confirm-modal.component.html',
})
export class SyncConfirmModalComponent implements OnInit {
  readonly activityService = inject(ActivityService);
  private readonly favoriteService = inject(FavoriteService);
  readonly languageService = inject(LanguageService);

  readonly singleActivity = computed(() => this.activityService.singleSyncActivity());
  readonly isSubmitting = signal<boolean>(false);
  readonly statusMessage = signal<string>('');
  readonly statusType = signal<'success' | 'error'>('success');

  selectedActivityTypeId = '';

  readonly activityTypeOptions = computed(() => {
    return this.activityService.timeEntryActivities().map((t) => ({
      label: t.name,
      value: t.id,
    }));
  });

  readonly syncCount = computed(() => {
    if (this.activityService.isSelectionMode() && this.activityService.selectedActivities().length > 0) {
      return this.activityService.selectedActivities().length;
    }
    return this.activityService.unsyncedActivities().length;
  });

  readonly hasPredefinedType = computed<boolean>(() => {
    const single = this.singleActivity();
    if (single) {
      return !!(single.activityTypeId || single.activity_type_id);
    }
    const list = this.activityService.isSelectionMode() && this.activityService.selectedActivities().length > 0
      ? this.activityService.selectedActivities()
      : this.activityService.unsyncedActivities();
    return list.length > 0 && list.every((a) => !!(a.activityTypeId || a.activity_type_id));
  });

  readonly predefinedTypeName = computed<string>(() => {
    const single = this.singleActivity();
    if (single) {
      if (single.activityTypeName) return single.activityTypeName;
      const typeId = String(single.activityTypeId || single.activity_type_id);
      const found = this.activityService.timeEntryActivities().find((t) => String(t.id) === typeId);
      return found?.name || typeId;
    }
    return '';
  });

  constructor() {
    effect(() => {
      const opts = this.activityTypeOptions();
      if (opts.length > 0 && !this.selectedActivityTypeId) {
        this.selectedActivityTypeId = opts[0].value;
      }
    });
  }

  ngOnInit(): void {
    if (this.activityService.timeEntryActivities().length === 0) {
      this.activityService.fetchTimeEntryActivities().catch(() => {});
    }
  }

  displayTitle(act: Activity): string {
    const direct = (act.ticketTitle || act.ticket_title || '').trim();
    if (direct) return direct;
    if (act.ticket) {
      const fav = this.favoriteService.favoriteTickets().find((f) => f.ticket === act.ticket);
      if (fav?.title?.trim()) return fav.title.trim();
    }
    return act.name?.trim() || '';
  }

  async onVisibleChange(visible: boolean): Promise<void> {
    if (!visible) {
      this.activityService.closeSyncModal();
      this.statusMessage.set('');
    } else {
      const single = this.singleActivity();
      if (this.activityService.timeEntryActivities().length === 0 || single?.ticket) {
        await this.activityService.fetchTimeEntryActivities(single?.ticket).catch(() => {});
      }
      if (single && (single.activityTypeId || single.activity_type_id)) {
        this.selectedActivityTypeId = String(single.activityTypeId || single.activity_type_id);
      } else {
        const opts = this.activityTypeOptions();
        if (opts.length > 0 && !this.selectedActivityTypeId) {
          this.selectedActivityTypeId = opts[0].value;
        }
      }
    }
  }

  async confirmSync(): Promise<void> {
    this.isSubmitting.set(true);
    this.statusMessage.set('');

    const single = this.singleActivity();
    if (single) {
      const typeToSend = (single.activityTypeId || single.activity_type_id)
        ? String(single.activityTypeId || single.activity_type_id)
        : (this.selectedActivityTypeId || undefined);
      const res = await this.activityService.syncActivity(single.id, typeToSend);
      this.isSubmitting.set(false);
      if (res.ok) {
        this.statusType.set('success');
        this.statusMessage.set(this.languageService.t('compact.syncModal.successSingle'));
        setTimeout(() => {
          this.activityService.closeSyncModal();
        }, 1200);
      } else {
        this.statusType.set('error');
        this.statusMessage.set(res.error || this.languageService.t('compact.syncModal.error'));
      }
    } else {
      const res = await this.activityService.syncAllUnsynced(this.selectedActivityTypeId || undefined);
      this.isSubmitting.set(false);
      if (res.failCount === 0) {
        this.statusType.set('success');
        this.statusMessage.set(this.languageService.t('compact.syncModal.successBulk', { count: res.successCount }));
        setTimeout(() => {
          this.activityService.closeSyncModal();
        }, 1200);
      } else {
        this.statusType.set('error');
        this.statusMessage.set(
          this.languageService.t('compact.syncModal.partialBulk', { success: res.successCount, fail: res.failCount })
        );
      }
    }
  }
}
