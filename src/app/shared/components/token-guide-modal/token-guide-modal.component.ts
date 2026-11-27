import { Component, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Dialog } from 'primeng/dialog';
import { ButtonDirective } from 'primeng/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerKey, tablerCheck } from '@ng-icons/tabler-icons';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-token-guide-modal',
  standalone: true,
  imports: [
    CommonModule,
    Dialog,
    ButtonDirective,
    NgIcon,
    TranslatePipe,
  ],
  viewProviders: [
    provideIcons({
      tablerKey,
      tablerCheck,
    }),
  ],
  templateUrl: './token-guide-modal.component.html',
})
export class TokenGuideModalComponent {
  readonly visible = model<boolean>(false);

  close(): void {
    this.visible.set(false);
  }
}
