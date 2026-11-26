# Project Module

## Purpose & Responsibility
Provides the Full Mode OpenProject project directory inside `DashboardPage`, allowing users to browse, search, and open any project's Kanban boards.

## File Structure
- `src/app/modules/project/project.router.ts`: Lazy-loaded route configuration for `/dashboard/projects`.
- `src/app/modules/project/pages/project.page.ts`: Smart page managing project loading, search filtering, and navigation to `/dashboard/boards/:projectId`.
- `src/app/modules/project/pages/project.page.html`: Template with `@defer` + PrimeNG `<p-skeleton>` loading state, `IconField` search, and responsive project card grid.
- `src/app/modules/project/components/project-card/project-card.component.ts`: Minimal clickable card (a single `<button>`) showing the folder icon, project name and identifier as secondary text. Clicking it opens the project boards.

## User Flow & Key Components
1. User selects **Projects** in the dashboard sidebar.
2. `ProjectPage` fetches projects via `OpenprojectService.getProjects()`.
3. User filters by name, identifier, or ID and clicks a project card (`ProjectCardComponent`) to navigate to `BoardPage`.

## Reactive State & Services
- Local Signals: `projects`, `searchQuery`, `isLoaded`, `isRefreshing`, `filteredProjects` (`computed`).
- Services: `OpenprojectService`, `Router`.
