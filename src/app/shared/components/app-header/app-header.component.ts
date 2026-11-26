import { Component, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerSun,
  tablerMoon,
  tablerRefresh,
  tablerDownload,
} from '@ng-icons/tabler-icons';
import { WindowService } from '../../../core/window/window.service';
import { ThemeService } from '../../../core/services/theme.service';
import { UpdateService } from '../../../core/services/update.service';
import { StorageService } from '../../../core/services/storage.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { AppLogoComponent } from '../app-logo/app-logo.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, NgIcon, TranslatePipe, AppLogoComponent],
  styleUrl: './app-header.component.css',
  viewProviders: [
    provideIcons({
      tablerSun,
      tablerMoon,
      tablerRefresh,
      tablerDownload,
    }),
  ],
  templateUrl: './app-header.component.html',
})
export class AppHeaderComponent {
  readonly closeAction = input<(() => void) | null>(null);

  readonly windowService = inject(WindowService);
  readonly themeService = inject(ThemeService);
  readonly updateService = inject(UpdateService);
  readonly storageService = inject(StorageService);
  private readonly router = inject(Router);

  onMouseDown(event: MouseEvent): void {
    this.windowService.startDragging(event);
  }

  onDoubleClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, a, input, select, textarea, [data-no-drag]')) {
      return;
    }
    this.windowService.toggleMaximize();
  }

  onClose(): void {
    const customClose = this.closeAction();
    if (customClose) {
      customClose();
      return;
    }

    if (this.storageService.isConfigured() && this.router.url.includes('setup')) {
      this.windowService.returnToCompact();
    } else {
      this.windowService.hideToTray();
    }
  }
}
