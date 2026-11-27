import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Dialog } from 'primeng/dialog';
import { ButtonDirective } from 'primeng/button';
import { ProgressBar } from 'primeng/progressbar';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerDownload,
  tablerRefresh,
  tablerCheck,
  tablerAlertCircle,
  tablerArrowRight,
} from '@ng-icons/tabler-icons';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { UpdateService } from '../../../core/services/update.service';

@Component({
  selector: 'app-update-dialog',
  standalone: true,
  imports: [
    CommonModule,
    Dialog,
    ButtonDirective,
    ProgressBar,
    NgIcon,
    TranslatePipe,
  ],
  viewProviders: [
    provideIcons({
      tablerDownload,
      tablerRefresh,
      tablerCheck,
      tablerAlertCircle,
      tablerArrowRight,
    }),
  ],
  templateUrl: './update-dialog.component.html',
})
export class UpdateDialogComponent {
  readonly updateService = inject(UpdateService);

  onVisibleChange(visible: boolean): void {
    if (!visible) {
      this.updateService.dismissModal();
    }
  }
}
