import { Component, OnInit, OnDestroy, signal, computed, effect, inject, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { AvatarModule } from 'primeng/avatar';
import { SidebarModule } from 'primeng/sidebar';
import { ButtonDirective } from 'primeng/button';
import { Breadcrumb } from 'primeng/breadcrumb';
import { Menu } from 'primeng/menu';
import { Skeleton } from 'primeng/skeleton';
import { MenuItem } from 'primeng/api';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerSmartHome,
  tablerLayoutSidebar,
  tablerSun,
  tablerMoon,
  tablerRefresh,
  tablerUser,
  tablerChevronRight,
  tablerAppWindow,
  tablerDownload,
  tablerFolder,
  tablerReportAnalytics,
  tablerSelector,
  tablerLayoutKanban,
  tablerUserCog,
  tablerAdjustmentsHorizontal,
} from '@ng-icons/tabler-icons';
import { StorageService } from '../../../core/services/storage.service';
import { ThemeService } from '../../../core/services/theme.service';
import { LanguageService } from '../../../core/services/language.service';
import { WindowService } from '../../../core/services/window.service';
import { UpdateService } from '../../../core/services/update.service';
import { OpenprojectService } from '../../../core/services/openproject.service';
import { BoardOption, Project } from '../../../core/interfaces/openproject.interface';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { AppHeaderComponent } from '../../../shared/components/app-header/app-header.component';
import { AppLogoComponent } from '../../../shared/components/app-logo/app-logo.component';
import { CloseConfirmModalComponent } from '../../compact/modals/close-confirm-modal/close-confirm-modal.component';

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
    Menu,
    Skeleton,
    NgIcon,
    TranslatePipe,
    AppHeaderComponent,
    AppLogoComponent,
    CloseConfirmModalComponent,
  ],
  viewProviders: [
    provideIcons({
      tablerSmartHome,
      tablerLayoutSidebar,
      tablerSun,
      tablerMoon,
      tablerRefresh,
      tablerUser,
      tablerChevronRight,
      tablerAppWindow,
      tablerDownload,
      tablerFolder,
      tablerReportAnalytics,
      tablerSelector,
      tablerLayoutKanban,
      tablerUserCog,
      tablerAdjustmentsHorizontal,
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
  private readonly openprojectService = inject(OpenprojectService);

  readonly isMobile = signal<boolean>(false);
  readonly open = signal<boolean>(true);

  // Sidebar "Projects" tree: OpenProject projects -> boards (loaded on demand)
  readonly projectsMenuOpen = signal<boolean>(false);
  readonly sidebarProjects = signal<Project[] | null>(null);
  readonly isLoadingProjects = signal<boolean>(false);
  readonly openProjectIds = signal<ReadonlySet<string>>(new Set());
  readonly projectBoards = signal<ReadonlyMap<string, BoardOption[]>>(new Map());
  readonly loadingBoardProjectIds = signal<ReadonlySet<string>>(new Set());

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

  readonly isProjects = computed(() => {
    const url = this.currentUrl();
    return url.startsWith('/dashboard/projects') || url.startsWith('/dashboard/boards');
  });

  /** Project/board IDs of the current `/dashboard/boards/:projectId/:boardId` route, if any. */
  readonly activeBoardRoute = computed<{ projectId: string; boardId: string | null } | null>(() => {
    const path = this.currentUrl().split('?')[0];
    const match = /^\/dashboard\/boards\/([^/]+)(?:\/([^/]+))?/.exec(path);
    return match ? { projectId: decodeURIComponent(match[1]), boardId: match[2] ? decodeURIComponent(match[2]) : null } : null;
  });

  readonly isReports = computed(() => this.currentUrl().startsWith('/dashboard/reports'));

  readonly isTicketDetail = computed(() => this.currentUrl().includes('/tickets/'));

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
    } else if (this.isReports()) {
      items.push({
        label: this.languageService.t('report.title'),
        routerLink: '/dashboard/reports',
      });
    } else if (this.isProjects()) {
      items.push({
        label: this.languageService.t('dashboard.projects'),
        routerLink: '/dashboard/projects',
      });
      if (url.startsWith('/dashboard/boards')) {
        items.push({
          label: this.languageService.t('dashboard.boards'),
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

    return [
      {
        label: this.languageService.t('dashboard.navPocketProject'),
        items: [
          {
            id: 'overview',
            icon: 'tablerSmartHome',
            label: this.languageService.t('dashboard.overview'),
            isActive: this.isOverview(),
            action: () => this.navigateTo('/dashboard/overview'),
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
      {
        label: this.languageService.t('dashboard.navOpenProject'),
        items: [
          {
            id: 'projects',
            icon: 'tablerFolder',
            label: this.languageService.t('dashboard.projects'),
            isActive: this.isProjects(),
            action: () => this.navigateTo('/dashboard/projects'),
          },
          {
            id: 'reports',
            icon: 'tablerReportAnalytics',
            label: this.languageService.t('report.title'),
            isActive: this.isReports(),
            action: () => this.navigateTo('/dashboard/reports'),
          },
        ],
      },
    ];
  });

  /** Footer account popup menu (PrimeNG `p-menu`): user name as group header + settings tabs. */
  readonly accountMenuItems = computed<MenuItem[]>(() => {
    this.languageService.currentLang();
    return [
      {
        label: this.userName(),
        items: [
          {
            label: this.languageService.t('settings.tabUser'),
            icon: 'tablerUserCog',
            command: () => this.navigateTo('/dashboard/settings', { tab: 'user' }),
          },
          {
            label: this.languageService.t('settings.tabSystem'),
            icon: 'tablerAdjustmentsHorizontal',
            command: () => this.navigateTo('/dashboard/settings', { tab: 'system' }),
          },
        ],
      },
    ];
  });

  constructor() {
    // Reveal the active project/board in the sidebar tree when navigating to a board.
    effect(() => {
      const route = this.activeBoardRoute();
      if (!route) return;
      untracked(() => {
        this.projectsMenuOpen.set(true);
        void this.ensureProjectsLoaded();
        this.setProjectOpen(route.projectId, true);
        void this.ensureBoardsLoaded(route.projectId);
      });
    });
  }

  onProjectsMenuOpenChange(open: boolean): void {
    this.projectsMenuOpen.set(open);
    if (open) {
      this.expandSidebarIfCollapsed();
      void this.ensureProjectsLoaded();
    }
  }

  onProjectOpenChange(project: Project, open: boolean): void {
    this.setProjectOpen(project.id, open);
    if (open) void this.ensureBoardsLoaded(project.id, project.identifier);
  }

  isProjectOpen(projectId: string): boolean {
    return this.openProjectIds().has(projectId);
  }

  isProjectActive(projectId: string): boolean {
    return this.activeBoardRoute()?.projectId === projectId;
  }

  isBoardActive(projectId: string, boardId: string, index: number): boolean {
    const route = this.activeBoardRoute();
    if (!route || route.projectId !== projectId) return false;
    return route.boardId ? route.boardId === boardId : index === 0;
  }

  openBoard(project: Project, board: BoardOption): void {
    this.navigateTo(`/dashboard/boards/${project.id}/${board.id}`, {
      name: project.name,
      identifier: project.identifier || '',
    });
  }

  private setProjectOpen(projectId: string, open: boolean): void {
    this.openProjectIds.update((ids) => {
      const next = new Set(ids);
      if (open) next.add(projectId);
      else next.delete(projectId);
      return next;
    });
  }

  /** In icon-only mode PrimeNG hides nested sub-menus, so expand the sidebar first. */
  private expandSidebarIfCollapsed(): void {
    if (!this.isMobile() && !this.open()) this.open.set(true);
  }

  private async ensureProjectsLoaded(force = false): Promise<void> {
    if (this.isLoadingProjects() || (!force && this.sidebarProjects() !== null)) return;
    this.isLoadingProjects.set(true);
    try {
      const projects = await this.openprojectService.getProjects();
      this.sidebarProjects.set([...projects].sort((a, b) => a.name.localeCompare(b.name)));
    } catch {
      this.sidebarProjects.set([]);
    } finally {
      this.isLoadingProjects.set(false);
    }
  }

  private async ensureBoardsLoaded(projectId: string, identifier?: string): Promise<void> {
    if (this.projectBoards().has(projectId) || this.loadingBoardProjectIds().has(projectId)) return;
    this.loadingBoardProjectIds.update((ids) => new Set(ids).add(projectId));
    try {
      const resolvedIdentifier =
        identifier ?? this.sidebarProjects()?.find((project) => project.id === projectId)?.identifier;
      const boards = await this.openprojectService.getProjectBoards(projectId, resolvedIdentifier || undefined);
      this.projectBoards.update((map) => new Map(map).set(projectId, boards));
    } catch {
      this.projectBoards.update((map) => new Map(map).set(projectId, []));
    } finally {
      this.loadingBoardProjectIds.update((ids) => {
        const next = new Set(ids);
        next.delete(projectId);
        return next;
      });
    }
  }

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


  async reloadWithSkeleton(): Promise<void> {
    await this.storageService.reloadConfig();
  }

  toggleTheme(): void {
    const isDark = this.themeService.isDark();
    this.themeService.setTheme(isDark ? 'light' : 'dark');
  }
}
