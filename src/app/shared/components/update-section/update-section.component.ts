import { Component, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ButtonDirective } from 'primeng/button';
import { ProgressBar } from 'primeng/progressbar';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerRefresh,
  tablerCheck,
  tablerDownload,
  tablerAlertCircle,
  tablerClock,
} from '@ng-icons/tabler-icons';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { UpdateService } from '../../../core/services/update.service';

@Component({
  selector: 'app-update-section',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    ButtonDirective,
    ProgressBar,
    NgIcon,
    TranslatePipe,
  ],
  viewProviders: [
    provideIcons({
      tablerRefresh,
      tablerCheck,
      tablerDownload,
      tablerAlertCircle,
      tablerClock,
    }),
  ],
  templateUrl: './update-section.component.html',
})
export class UpdateSectionComponent {
  readonly updateService = inject(UpdateService);
}
