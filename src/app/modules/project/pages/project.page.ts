import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { ButtonDirective } from 'primeng/button';
import { Skeleton } from 'primeng/skeleton';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerFolder, tablerSearch, tablerRefresh, tablerFolderOff } from '@ng-icons/tabler-icons';
import { ProjectApiService } from '../../../core/services/openproject/project-api.service';
import { Project } from '../../../core/interfaces/openproject.interface';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { ProjectCardComponent } from '../components/project-card/project-card.component';

@Component({
  selector: 'app-project-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IconField,
    InputIcon,
    InputText,
    ButtonDirective,
    Skeleton,
    NgIcon,
    TranslatePipe,
    ProjectCardComponent,
  ],
  viewProviders: [provideIcons({ tablerFolder, tablerSearch, tablerRefresh, tablerFolderOff })],
  templateUrl: './project.page.html',
})
export class ProjectPage implements OnInit {
  private readonly projectApi = inject(ProjectApiService);
  private readonly router = inject(Router);

  readonly projects = signal<Project[]>([]);
  readonly searchQuery = signal<string>('');
  readonly isLoaded = signal<boolean>(false);
  readonly isRefreshing = signal<boolean>(false);

  readonly filteredProjects = computed<Project[]>(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const list = this.projects();
    if (!query) return list;
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        (p.identifier && p.identifier.toLowerCase().includes(query)) ||
        p.id.includes(query)
    );
  });

  async ngOnInit(): Promise<void> {
    await this.loadProjects();
  }

  async loadProjects(): Promise<void> {
    this.isRefreshing.set(true);
    try {
      const list = await this.projectApi.getProjects();
      this.projects.set(list);
    } finally {
      this.isLoaded.set(true);
      this.isRefreshing.set(false);
    }
  }

  openProjectBoards(project: Project): void {
    this.router.navigate(['/dashboard/boards', project.id], {
      queryParams: {
        name: project.name,
        identifier: project.identifier || '',
      },
    });
  }
}
