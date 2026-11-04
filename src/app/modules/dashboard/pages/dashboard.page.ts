import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { AvatarModule } from 'primeng/avatar';
import { SidebarModule } from 'primeng/sidebar';
import { ButtonDirective } from 'primeng/button';
import { Breadcrumb } from 'primeng/breadcrumb';
import { MenuItem } from 'primeng/api';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerSmartHome,
  tablerSettings,
  tablerLayoutSidebar,
  tablerSun,
  tablerMoon,
  tablerRefresh,
  tablerUser,
  tablerChevronRight,
  tablerAppWindow,
  tablerDownload,
} from '@ng-icons/tabler-icons';
import { StorageService } from '../../../core/services/storage.service';
import { ThemeService } from '../../../core/services/theme.service';
import { LanguageService } from '../../../core/services/language.service';
import { WindowService } from '../../../core/services/window.service';
import { UpdateService } from '../../../core/services/update.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

export interface NavItem {
  icon: string;
  label: string;
  id?: string;
  isActive?: boolean;
  badge?: string;
  action?: () => void;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    AvatarModule,
    SidebarModule,
    ButtonDirective,
    Breadcrumb,
    NgIcon,
    TranslatePipe,
  ],
  viewProviders: [
    provideIcons({
      tablerSmartHome,
      tablerSettings,
      tablerLayoutSidebar,
      tablerSun,
      tablerMoon,
      tablerRefresh,
      tablerUser,
      tablerChevronRight,
      tablerAppWindow,
      tablerDownload,
    }),
  ],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.css',
})
export class DashboardPage implements OnInit, OnDestroy {
  readonly storageService = inject(StorageService);
  readonly themeService = inject(ThemeService);
  readonly languageService = inject(LanguageService);
  readonly windowService = inject(WindowService);
  readonly updateService = inject(UpdateService);
  private readonly router = inject(Router);

  readonly isMobile = signal<boolean>(false);
  readonly open = signal<boolean>(true);

  private mql?: MediaQueryList;
  private mqlListener?: (e: MediaQueryListEvent) => void;

  readonly config = this.storageService.config;
  readonly isLoading = this.storageService.isLoading;

  /**
   * Reactive signal tracking the current URL across all navigation events.
   */
  readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );

  readonly isOverview = computed(() => {
    const url = this.currentUrl();
    return url.startsWith('/dashboard/overview') || url === '/dashboard';
  });

  readonly isSettings = computed(() => {
    const url = this.currentUrl();
    return url.startsWith('/dashboard/setting');
  });

  readonly userInitials = computed(() => {
    const name = this.storageService.userName();
    if (name) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    }
    const url = this.config().openproject_url;
    if (url) {
      try {
        const host = new URL(url).hostname.replace('www.', '');
        return host.substring(0, 2).toUpperCase();
      } catch {
        return 'OP';
      }
    }
    return 'P2';
  });

  readonly userName = computed(() => {
    const name = this.storageService.userName();
    if (name) {
      return name;
    }
    if (this.config().openproject_token) {
      return 'OpenProject User';
    }
    return 'PocketProject User';
  });

  readonly breadcrumbHome = computed<MenuItem>(() => ({
    icon: 'tablerSmartHome',
    routerLink: '/dashboard/overview',
  }));

  readonly breadcrumbItems = computed<MenuItem[]>(() => {
    this.languageService.currentLang();
    const url = this.currentUrl();
    const items: MenuItem[] = [];

    if (this.isSettings()) {
      items.push({
        label: this.languageService.t('dashboard.settings'),
        routerLink: '/dashboard/settings',
      });

      if (url.includes('tab=user')) {
        items.push({
          label: this.languageService.t('settings.tabUser'),
        });
      } else if (url.includes('tab=system')) {
        items.push({
          label: this.languageService.t('settings.tabSystem'),
        });
      }
    } else {
      items.push({
        label: this.languageService.t('dashboard.overview'),
        routerLink: '/dashboard/overview',
      });
    }

    return items;
  });

  readonly navGroups = computed<NavGroup[]>(() => {
    this.languageService.currentLang();
    const overviewActive = this.isOverview();
    const settingsActive = this.isSettings();

    return [
      {
        label: this.languageService.t('dashboard.navGeneral'),
        items: [
          {
            id: 'overview',
            icon: 'tablerSmartHome',
            label: this.languageService.t('dashboard.overview'),
            isActive: overviewActive,
            action: () => this.navigateTo('/dashboard/overview'),
          },
          {
            id: 'settings',
            icon: 'tablerSettings',
            label: this.languageService.t('dashboard.settings'),
            isActive: settingsActive,
            action: () => this.navigateTo('/dashboard/settings'),
          },
          {
            id: 'compact',
            icon: 'tablerAppWindow',
            label: this.languageService.t('dashboard.compactMode'),
            isActive: false,
            action: () => this.windowService.setCompactMode(),
          },
        ],
      },
    ];
  });

  async ngOnInit(): Promise<void> {
    if (typeof window !== 'undefined') {
      this.mql = window.matchMedia('(max-width: 1023px)');
      this.isMobile.set(this.mql.matches);
      this.open.set(!this.mql.matches);
      this.mqlListener = (e: MediaQueryListEvent) => {
        this.isMobile.set(e.matches);
        this.open.set(!e.matches);
      };
      this.mql.addEventListener('change', this.mqlListener);
    }

    if (!this.storageService.isLoaded()) {
      await this.storageService.loadConfig();
    }
  }

  ngOnDestroy(): void {
    if (this.mql && this.mqlListener) {
      this.mql.removeEventListener('change', this.mqlListener);
    }
  }

  navigateTo(path: string, queryParams?: Record<string, string>): void {
    if (this.isMobile()) {
      this.open.set(false);
    }
    this.router.navigate([path], { queryParams });
  }

  openUserSettings(): void {
    this.navigateTo('/dashboard/settings', { tab: 'user' });
  }

  async reloadWithSkeleton(): Promise<void> {
    await this.storageService.reloadConfig();
  }

  toggleTheme(): void {
    const isDark = this.themeService.isDark();
    this.themeService.setTheme(isDark ? 'light' : 'dark');
  }
}
