import { Injectable, inject } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import {
  Project,
  StatusOption,
  VersionOption,
} from '../../interfaces/openproject.interface';
import { OpenprojectService } from './openproject.service';

/** Projects, statuses and project versions (cached). */
@Injectable({ providedIn: 'root' })
export class ProjectApiService {
  private readonly openprojectService = inject(OpenprojectService);

  private readonly versionsCache = new Map<string, VersionOption[]>();

  private statusesCache: StatusOption[] | null = null;

  async getProjects(): Promise<Project[]> {
    const token = this.openprojectService.getToken();
    if (!token) return [];
    const url = this.openprojectService.sanitizeUrl();

    if (this.openprojectService.isTauriApp()) {
      try {
        const res = await invoke<Project[]>('fetch_openproject_projects', { url, token });
        return res || [];
      } catch (err) {
        console.warn('Could not fetch OpenProject projects:', err);
        return [];
      }
    }

    // Web Fallback: Paginated projects fetch
    try {
      const pageSize = 100;
      let offset = 1;
      let total = Infinity;
      const allProjects: Project[] = [];
      const headers = this.openprojectService.buildAuthHeaders(token);

      while (allProjects.length < total) {
        const res = await fetch(`${url}/api/v3/projects?pageSize=${pageSize}&offset=${offset}`, { headers });
        if (!res.ok) break;
        const data = await res.json();
        if (!data?._embedded?.elements) break;

        total = data.total ?? 0;
        const elements: Array<{ id: number | string; name: string; identifier?: string }> = data._embedded.elements;
        allProjects.push(
          ...elements.map((p) => ({
            id: String(p.id),
            name: p.name,
            identifier: p.identifier,
          }))
        );

        if (elements.length < pageSize) break;
        offset += pageSize;
      }

      return allProjects;
    } catch (err) {
      console.warn('Web fetch projects error:', err);
      return [];
    }
  }

  async getStatuses(): Promise<StatusOption[]> {
    if (this.statusesCache) return this.statusesCache;
    const token = this.openprojectService.getToken();
    if (!token) return [];
    const url = this.openprojectService.sanitizeUrl();

    if (this.openprojectService.isTauriApp()) {
      try {
        const res = await invoke<StatusOption[]>('fetch_statuses', { url, token });
        if (res && res.length) {
          this.statusesCache = res;
          return res;
        }
      } catch (err) {
        console.warn('Could not fetch statuses via Tauri:', err);
      }
    }

    try {
      const res = await fetch(`${url}/api/v3/statuses`, {
        headers: this.openprojectService.buildAuthHeaders(token),
      });
      if (!res.ok) return [];
      const data = await res.json();
      if (!data?._embedded?.elements) return [];
      const list: StatusOption[] = data._embedded.elements.map(
        (s: { id: number | string; name: string; color?: string }) => ({
          id: String(s.id),
          name: s.name,
          color: s.color,
        })
      );
      this.statusesCache = list;
      return list;
    } catch (err) {
      console.warn('Web fetch statuses error:', err);
      return [];
    }
  }

  async getProjectVersions(projectId: string): Promise<VersionOption[]> {
    if (!projectId) return [];
    if (this.versionsCache.has(projectId)) {
      return this.versionsCache.get(projectId)!;
    }

    const token = this.openprojectService.getToken();
    if (!token) return [];
    const url = this.openprojectService.sanitizeUrl();

    if (this.openprojectService.isTauriApp()) {
      try {
        const res = await invoke<VersionOption[]>('fetch_project_versions', {
          url,
          token,
          projectId,
        });
        if (res) {
          this.versionsCache.set(projectId, res);
          return res;
        }
      } catch (err) {
        console.warn('Could not fetch project versions via Tauri:', err);
      }
    }

    try {
      const res = await fetch(`${url}/api/v3/projects/${projectId}/versions`, {
        headers: this.openprojectService.buildAuthHeaders(token),
      });
      if (!res.ok) return [];
      const data = await res.json();
      if (!data?._embedded?.elements) return [];
      const versions: VersionOption[] = data._embedded.elements.map(
        (v: { id: number | string; name: string; status?: string }) => ({
          id: String(v.id),
          name: v.name,
          status: v.status,
        })
      );
      this.versionsCache.set(projectId, versions);
      return versions;
    } catch (err) {
      console.warn('Web fetch project versions error:', err);
      return [];
    }
  }
}
