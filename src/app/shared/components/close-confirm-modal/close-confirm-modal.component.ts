import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Dialog } from 'primeng/dialog';
import { ButtonDirective } from 'primeng/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerAlertTriangle, tablerMinimize, tablerPower } from '@ng-icons/tabler-icons';
import { WindowService } from '../../../core/services/window.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-close-confirm-modal',
  standalone: true,
  imports: [CommonModule, Dialog, ButtonDirective, NgIcon, TranslatePipe],
  viewProviders: [
    provideIcons({
      tablerAlertTriangle,
      tablerMinimize,
      tablerPower,
    }),
  ],
  templateUrl: './close-confirm-modal.component.html',
})
export class CloseConfirmModalComponent {
  readonly windowService = inject(WindowService);

  onVisibleChange(visible: boolean): void {
    if (!visible) {
      this.windowService.cancelClose();
    }
  }
}

