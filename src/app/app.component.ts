import { Component, effect, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { StorageService } from './core/services/storage.service';
import { ThemeService } from './core/services/theme.service';
import { UpdateService } from './core/services/update.service';
import { UpdateDialogComponent } from './shared/components/update-dialog/update-dialog.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, UpdateDialogComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  private readonly storageService = inject(StorageService);
  private readonly themeService = inject(ThemeService);
  private readonly updateService = inject(UpdateService);

  async ngOnInit(): Promise<void> {
    const config = await this.storageService.loadConfig();
    this.themeService.setTheme(config.theme_mode || 'system');
    this.themeService.setPrimaryColor(config.primary_color || 'violet');

    // Check for updates in the background on startup
    this.updateService.checkForUpdates(true).catch((err) => {
      console.warn('Silent update check failed:', err);
    });
  }

  protected isLoaded: boolean = false;

  constructor() {
    effect(() => {
      this.isLoaded = true;
    });
  }
}
