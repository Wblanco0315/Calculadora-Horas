import { Component, OnInit, OnDestroy, signal, computed, effect, inject, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, NavigationEnd } from '@angular/router';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, filter, from, map, of, switchMap } from 'rxjs';
import { AvatarModule } from 'primeng/avatar';
import { SidebarModule } from 'primeng/sidebar';
import { ButtonDirective } from 'primeng/button';
import { Breadcrumb } from 'primeng/breadcrumb';
import { Menu } from 'primeng/menu';
import { Skeleton } from 'primeng/skeleton';
import { Toast } from 'primeng/toast';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
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
  tablerSearch,
  tablerTicket,
  tablerLoader2,
  tablerClockHour4,
} from '@ng-icons/tabler-icons';
import { StorageService } from '../../../core/services/storage.service';
import { ThemeService } from '../../../core/services/theme.service';
import { LanguageService } from '../../../core/services/language.service';
import { WindowService } from '../../../core/services/window.service';
import { UpdateService } from '../../../core/services/update.service';
import { BreadcrumbService } from '../../../core/services/breadcrumb.service';
import { OpenprojectService } from '../../../core/services/openproject.service';
import { BoardOption, Project, WorkPackageSearchItem } from '../../../core/interfaces/openproject.interface';
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
    Toast,
    IconField,
    InputIcon,
    InputText,
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
      tablerSearch,
      tablerTicket,
      tablerLoader2,
      tablerClockHour4,
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
    return (
      url.startsWith('/dashboard/projects') ||
      url.startsWith('/dashboard/boards') ||
      url.startsWith('/dashboard/tickets/')
    );
  });

  readonly isDirectTicket = computed(() => this.currentUrl().startsWith('/dashboard/tickets/'));

  /** Text typed in the sidebar search. */
  private readonly breadcrumbService = inject(BreadcrumbService);

  readonly sidebarQuery = signal<string>('');

  /** Tickets matching the sidebar search (subject or ID), fetched after the user stops typing. */
  readonly ticketMatches = signal<WorkPackageSearchItem[]>([]);
  readonly isSearchingTickets = signal<boolean>(false);

  /** Show the "go to ticket" shortcut only when the typed ID is not already among the matches. */
  readonly showGoToTicket = computed(() => {
    const ticketId = this.searchTicketId();
    return ticketId !== null && !this.ticketMatches().some((ticket) => ticket.id === ticketId);
  });

  /** Ticket being resolved to its project/board after a sidebar search. */
  readonly openingTicketId = signal<number | null>(null);

  private readonly normalizedQuery = computed(() => normalizeSearch(this.sidebarQuery()));

  /** Ticket ID when the search is a work package number (`123` or `#123`). */
  readonly searchTicketId = computed<number | null>(() => {
    const match = /^#?(\d+)$/.exec(this.sidebarQuery().trim());
    const id = match ? Number(match[1]) : NaN;
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  });

  /** Sidebar projects matching the search (all of them when the search is empty). */
  readonly filteredSidebarProjects = computed<Project[]>(() => {
    const projects = this.sidebarProjects() ?? [];
    const query = this.normalizedQuery();
    if (!query) return projects;
    return projects.filter((project) =>
      normalizeSearch(`${project.name} ${project.identifier ?? ''}`).includes(query)
    );
  });

  /** Navigation groups filtered by the search; the projects entry stays while any project matches. */
  readonly visibleNavGroups = computed<NavGroup[]>(() => {
    const query = this.normalizedQuery();
    if (!query) return this.navGroups();
    const hasProjectMatch = this.filteredSidebarProjects().length > 0;
    return this.navGroups()
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) => normalizeSearch(item.label).includes(query) || (item.id === 'projects' && hasProjectMatch)
        ),
      }))
      .filter((group) => group.items.length > 0);
  });

  /** Project/board IDs of the current `/dashboard/boards/:projectId/:boardId` route, if any. */
  readonly activeBoardRoute = computed<{ projectId: string; boardId: string | null } | null>(() => {
    const path = this.currentUrl().split('?')[0];
    const match = /^\/dashboard\/boards\/([^/]+)(?:\/([^/]+))?/.exec(path);
    return match ? { projectId: decodeURIComponent(match[1]), boardId: match[2] ? decodeURIComponent(match[2]) : null } : null;
  });

  readonly isTimeEntries = computed(() => this.currentUrl().startsWith('/dashboard/time-entries'));

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

  /** `{project} > Boards > {board} > #ticket` crumbs for `/dashboard/boards/...` routes. */
  private readonly boardBreadcrumbItems = computed<MenuItem[]>(() => {
    const route = this.activeBoardRoute();
    if (!route) return [];

    const queryParams = new URLSearchParams(this.currentUrl().split('?')[1] ?? '');
    const project = this.sidebarProjects()?.find((item) => item.id === route.projectId);
    const projectName = project?.name || queryParams.get('name') || route.projectId;
    const projectQueryParams = { name: projectName, identifier: project?.identifier || queryParams.get('identifier') || '' };
    const boardListLink = ['/dashboard/boards', route.projectId];
    const ticketId = /\/tickets\/([^/?#]+)/.exec(this.currentUrl())?.[1] ?? null;

    const items: MenuItem[] = [
      { label: projectName, routerLink: boardListLink, queryParams: projectQueryParams },
      {
        label: this.languageService.t('dashboard.boards'),
        routerLink: route.boardId ? boardListLink : undefined,
        queryParams: route.boardId ? projectQueryParams : undefined,
      },
    ];

    if (route.boardId) {
      const board = this.projectBoards().get(route.projectId)?.find((item) => item.id === route.boardId);
      items.push({
        label: board?.name || route.boardId,
        routerLink: ticketId ? ['/dashboard/boards', route.projectId, route.boardId] : undefined,
        queryParams: ticketId ? projectQueryParams : undefined,
      });
    }

    if (ticketId) {
      items.push({ label: this.breadcrumbService.ticketLabel(decodeURIComponent(ticketId)) });
    }

    return items;
  });

  /** `{project} > Boards > #ticket` for `/dashboard/tickets/:id?projectId=...` (ticket found in no board). */
  private readonly directTicketBreadcrumbItems = computed<MenuItem[]>(() => {
    const [path, query = ''] = this.currentUrl().split('?');
    const ticketId = decodeURIComponent(/\/tickets\/([^/#]+)/.exec(path)?.[1] ?? '');
    const queryParams = new URLSearchParams(query);
    const projectId = queryParams.get('projectId');
    const items: MenuItem[] = [];

    if (projectId) {
      const project = this.sidebarProjects()?.find((item) => item.id === projectId);
      const projectQueryParams = {
        name: project?.name || queryParams.get('name') || projectId,
        identifier: project?.identifier || queryParams.get('identifier') || '',
      };
      const boardListLink = ['/dashboard/boards', projectId];
      items.push(
        { label: projectQueryParams.name, routerLink: boardListLink, queryParams: projectQueryParams },
        { label: this.languageService.t('dashboard.boards'), routerLink: boardListLink, queryParams: projectQueryParams }
      );
    }

    items.push({ label: this.breadcrumbService.ticketLabel(ticketId) });
    return items;
  });

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
    } else if (this.isTimeEntries()) {
      items.push({ label: this.languageService.t('timeEntry.title') });
    } else if (this.isReports()) {
      items.push({
        label: this.languageService.t('report.title'),
        routerLink: '/dashboard/reports',
      });
    } else if (this.isDirectTicket()) {
      items.push({
        label: this.languageService.t('dashboard.projects'),
        routerLink: '/dashboard/projects',
      });
      items.push(...this.directTicketBreadcrumbItems());
    } else if (this.isProjects()) {
      items.push({
        label: this.languageService.t('dashboard.projects'),
        routerLink: '/dashboard/projects',
      });
      items.push(...this.boardBreadcrumbItems());
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
            id: 'timeEntries',
            icon: 'tablerClockHour4',
            label: this.languageService.t('timeEntry.title'),
            isActive: this.isTimeEntries(),
            action: () => this.navigateTo('/dashboard/time-entries'),
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
    // Ticket search: wait until typing pauses, cancel stale requests, ignore 1-letter text queries.
    toObservable(this.sidebarQuery)
      .pipe(
        map((query) => query.trim().replace(/^#/, '')),
        debounceTime(SIDEBAR_SEARCH_DEBOUNCE_MS),
        switchMap((query) =>
          isTicketSearchable(query)
            ? from(this.openprojectService.searchWorkPackages(query)).pipe(catchError(() => of([])))
            : of([])
        ),
        takeUntilDestroyed()
      )
      .subscribe((tickets) => {
        this.ticketMatches.set(tickets);
        this.isSearchingTickets.set(false);
      });

    // Reveal the active project in the sidebar and load the names the breadcrumb needs.
    effect(() => {
      const route = this.activeBoardRoute();
      if (!route) return;
      untracked(() => {
        this.projectsMenuOpen.set(true);
        void this.ensureProjectsLoaded();
        if (route.boardId) void this.ensureBoardsLoaded(route.projectId);
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

  onSidebarQueryChange(value: string): void {
    this.sidebarQuery.set(value);
    // Show the loading state right away; the request itself waits for typing to pause.
    this.isSearchingTickets.set(isTicketSearchable(value.trim().replace(/^#/, '')));
    // Project names are searchable too, so make sure they are loaded.
    if (value.trim()) void this.ensureProjectsLoaded();
  }

  /** Enter: open the ticket when the search is an ID, otherwise the first match. */
  onSidebarSearchSubmit(): void {
    const ticketId = this.searchTicketId();
    if (ticketId) {
      void this.openTicket(ticketId);
      return;
    }
    if (!this.sidebarQuery().trim()) return;
    const firstProject = this.filteredSidebarProjects()[0];
    const firstNavItem = this.visibleNavGroups()[0]?.items[0];
    const firstTicket = this.ticketMatches()[0];
    if (firstProject) {
      this.openProject(firstProject);
    } else if (firstNavItem?.action) {
      firstNavItem.action();
    } else if (firstTicket) {
      void this.openTicket(firstTicket.id);
      return;
    }
    this.sidebarQuery.set('');
  }

  /**
   * Opens a ticket by ID inside its project and board, so the breadcrumb reads
   * `Projects > project > Boards > board > #id`. Falls back to `/dashboard/tickets/:id`
   * (still under its project) when no board column contains the ticket.
   */
  async openTicket(ticketId: number): Promise<void> {
    if (this.openingTicketId() !== null) return;
    this.openingTicketId.set(ticketId);
    try {
      const ticket = await this.openprojectService.getTicketContext(String(ticketId), {
        includeDescription: false,
        includeComments: false,
        includeAttachments: false,
      });
      const projectId = ticket.success && ticket.project_id ? String(ticket.project_id) : '';
      if (!projectId) {
        this.navigateTo(`/dashboard/tickets/${ticketId}`);
        return;
      }

      await this.ensureProjectsLoaded();
      const project = this.sidebarProjects()?.find((item) => item.id === projectId);
      const queryParams = {
        name: project?.name || ticket.project_name || projectId,
        identifier: project?.identifier || '',
      };
      const boardId = await this.findBoardContainingTicket(projectId, queryParams.identifier, ticketId);
      if (boardId) {
        this.navigateTo(`/dashboard/boards/${projectId}/${boardId}/tickets/${ticketId}`, queryParams);
      } else {
        this.navigateTo(`/dashboard/tickets/${ticketId}`, { ...queryParams, projectId });
      }
    } catch {
      this.navigateTo(`/dashboard/tickets/${ticketId}`);
    } finally {
      this.openingTicketId.set(null);
      this.sidebarQuery.set('');
    }
  }

  private async findBoardContainingTicket(
    projectId: string,
    identifier: string,
    ticketId: number
  ): Promise<string | null> {
    const boards = await this.openprojectService.getProjectBoards(projectId, identifier || undefined);
    const matches = await Promise.all(
      boards.map(async (board) => {
        try {
          const columns = await this.openprojectService.getBoardColumns(board.id);
          return columns.some(
            (column) =>
              column.workPackageIds.includes(ticketId) ||
              column.workPackages?.some((workPackage) => workPackage.id === ticketId)
          )
            ? board.id
            : null;
        } catch {
          return null;
        }
      })
    );
    return matches.find((boardId) => boardId !== null) ?? null;
  }

  isProjectActive(projectId: string): boolean {
    return this.activeBoardRoute()?.projectId === projectId;
  }

  openProject(project: Project): void {
    this.navigateTo(`/dashboard/boards/${project.id}`, {
      name: project.name,
      identifier: project.identifier || '',
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

/** Lowercases and strips accents so searches match regardless of diacritics. */
function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

/** Pause after the last keystroke before searching tickets. */
const SIDEBAR_SEARCH_DEBOUNCE_MS = 350;

/** IDs are searched from the first digit; text needs at least two characters. */
function isTicketSearchable(query: string): boolean {
  return /^\d+$/.test(query) || query.length >= 2;
}
