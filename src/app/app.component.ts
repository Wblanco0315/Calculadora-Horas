import { Component, effect, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { StorageService } from './core/services/storage.service';
import { ThemeService } from './core/services/theme.service';
import { UpdateService } from './core/services/update.service';
import { WindowService } from './core/window/window.service';
import { McpActionService } from './core/services/mcp-action.service';
import { hideAppLoader } from './core/utils/app-loader.util';
import { UpdateDialogComponent } from './shared/components/update-dialog/update-dialog.component';
import { WindowTransitionComponent } from './shared/components/window-transition/window-transition.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, UpdateDialogComponent, WindowTransitionComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  private readonly storageService = inject(StorageService);
  private readonly themeService = inject(ThemeService);
  private readonly updateService = inject(UpdateService);
  private readonly windowService = inject(WindowService);
  private readonly mcpActionService = inject(McpActionService);

  async ngOnInit(): Promise<void> {
    try {
      const config = await this.storageService.loadConfig();
      this.themeService.setTheme(config.theme_mode || 'system');
      this.themeService.setPrimaryColor(config.primary_color || 'violet');

      if (!config.is_configured) {
        await this.windowService.maximize();
      } else {
        await this.windowService.restoreWindow();
      }
      // Interface actions requested by the PocketProject MCP (open views, tickets, comment drafts).
      this.mcpActionService.start();
    } finally {
      // The index.html loader covers the boot, the config load and the window placement.
      hideAppLoader();
    }

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
