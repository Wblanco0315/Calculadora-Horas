import { Injectable, inject } from '@angular/core';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { StorageService } from './storage.service';
import {
  Project,
  StatusOption,
  VersionOption,
  BoardOption,
  BoardColumnOption,
  BoardLocation,
  TimeEntryActivityType,
  TicketInfoResult,
  CreateTimeEntryParams,
} from '../interfaces/openproject.interface';

@Injectable({
  providedIn: 'root',
})
export class OpenprojectService {
  private readonly storageService = inject(StorageService);

  private readonly versionsCache = new Map<string, VersionOption[]>();
  private readonly boardsCache = new Map<string, BoardOption[]>();
  private readonly boardColumnsCache = new Map<string, BoardColumnOption[]>();
  private statusesCache: StatusOption[] | null = null;

  private isTauriApp(): boolean {
    try {
      return isTauri() || (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window);
    } catch {
      return false;
    }
  }

  private sanitizeUrl(url?: string): string {
    const raw = (url || this.storageService.config().openproject_url || '').trim();
    let clean = raw.replace(/\/+$/, '');
    if (!clean) {
      clean = 'https://openproject.wposs.com/openproject';
    }
    if (clean.endsWith('/api/v3')) {
      clean = clean.substring(0, clean.length - 7);
    }
    return clean;
  }

  private getToken(): string {
    return (this.storageService.config().openproject_token || '').trim();
  }

  private buildAuthHeaders(token: string): Record<string, string> {
    const trimmed = token.trim();
    let auth = '';
    if (trimmed.startsWith('Bearer ') || trimmed.startsWith('opapi-')) {
      auth = trimmed.startsWith('Bearer ') ? trimmed : `Bearer ${trimmed}`;
    } else {
      const encoded = typeof btoa !== 'undefined' ? btoa(`apikey:${trimmed}`) : '';
      auth = `Basic ${encoded}`;
    }

    return {
      Authorization: auth,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
  }

  /**
   * Converts minutes into an ISO 8601 duration string (e.g. 90 -> "PT1.5H", 15 -> "PT0.25H")
   */
  minutesToISO(minutes: number): string {
    const hours = parseFloat((Math.max(0, minutes) / 60).toFixed(2));
    return `PT${hours}H`;
  }

  // ──────────────────────────────────────────────
  // Ticket Info
  // ──────────────────────────────────────────────

  /**
   * Fetches ticket metadata including subject, project, status, color, version and available statuses
   */
  async getTicketInfo(ticket: string): Promise<TicketInfoResult> {
    const rawTicket = ticket.trim().replace(/^#/, '');
    if (!rawTicket) {
      return { success: false, message: 'Ticket vacío' };
    }

    const token = this.getToken();
    const url = this.sanitizeUrl();

    if (this.isTauriApp()) {
      try {
        return await invoke<TicketInfoResult>('fetch_ticket_info', {
          url,
          token,
          ticket: rawTicket,
        });
      } catch (err: unknown) {
        return {
          success: false,
          message: err instanceof Error ? err.message : String(err),
        };
      }
    }

    // Web Fallback implementation
    try {
      const endpoint = `${url}/api/v3/work_packages/${rawTicket}`;
      const formEndpoint = `${url}/api/v3/work_packages/${rawTicket}/form`;
      const headers = this.buildAuthHeaders(token);

      const [wpRes, formRes] = await Promise.all([
        fetch(endpoint, { headers }),
        fetch(formEndpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({}),
        }),
      ]);

      if (!wpRes.ok) {
        return {
          success: false,
          message: `HTTP ${wpRes.status}`,
        };
      }

      const wpData = await wpRes.json();
      const subject = wpData.subject || null;
      const projectName = wpData._links?.project?.title || null;
      const projectHref = wpData._links?.project?.href || '';
      const projectId = projectHref ? projectHref.split('/').pop() : null;

      const statusName = wpData._links?.status?.title || null;
      const statusHref = wpData._links?.status?.href || '';
      const statusId = statusHref ? statusHref.split('/').pop() : null;
      const statusColor = wpData._embedded?.status?.color || null;

      const versionName = wpData._links?.version?.title || null;
      const versionHref = wpData._links?.version?.href || '';
      const versionId = versionHref ? versionHref.split('/').pop() : null;

      const lockVersion = wpData.lockVersion || null;

      let availableStatuses: StatusOption[] | null = null;
      if (formRes.ok) {
        const formData = await formRes.json();
        const allowedRaw =
          formData?._embedded?.schema?.status?.allowedValues ??
          formData?._embedded?.schema?.status?._links?.allowedValues;
        const allowedArray = Array.isArray(allowedRaw) ? allowedRaw : [];

        if (allowedArray.length > 0) {
          availableStatuses = allowedArray.map((s: Record<string, unknown>) => ({
            id: String(s['id'] || (String(s['href'] || '').split('/').pop())),
            name: String(s['name'] || s['title'] || ''),
            color: typeof s['color'] === 'string' ? s['color'] : undefined,
          }));
        }
      }

      return {
        success: true,
        subject,
        project_id: projectId,
        project_name: projectName,
        status_id: statusId,
        status_name: statusName,
        status_color: statusColor,
        version_id: versionId,
        version_name: versionName,
        lock_version: lockVersion,
        available_statuses: availableStatuses,
        message: 'OK',
      };
    } catch (err: unknown) {
      return {
        success: false,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ──────────────────────────────────────────────
  // Subir los tiempos (Create Time Entry)
  // ──────────────────────────────────────────────

  /**
   * Uploads a work log (time entry) to OpenProject with ISO duration and HAL links
   */
  async createTimeEntry(params: CreateTimeEntryParams): Promise<{ ok: boolean; error?: string }> {
    const rawTicket = params.ticket.trim().replace(/^#/, '');
    if (!rawTicket) {
      return { ok: false, error: 'No ticket specified' };
    }

    const token = this.getToken();
    if (!token) {
      return { ok: false, error: 'Token de OpenProject no configurado' };
    }

    const url = this.sanitizeUrl();

    if (this.isTauriApp()) {
      try {
        await invoke('create_time_entry', {
          url,
          token,
          ticket: rawTicket,
          minutes: params.minutes,
          date: params.date,
          comment: params.comment || 'Registro de tiempo',
          activityTypeId: params.activityTypeId || null,
          projectId: params.projectId || null,
        });
        return { ok: true };
      } catch (err: unknown) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    // Web Fallback implementation
    try {
      const endpoint = `${url}/api/v3/time_entries`;
      const links: Record<string, { href: string }> = {
        workPackage: { href: `/api/v3/work_packages/${rawTicket}` },
      };
      if (params.projectId) {
        links['project'] = { href: `/api/v3/projects/${params.projectId}` };
      }
      if (params.activityTypeId) {
        links['activity'] = { href: `/api/v3/time_entries/activities/${params.activityTypeId}` };
      }

      const payload = {
        comment: { format: 'plain', raw: params.comment || 'Registro de tiempo' },
        spentOn: params.date,
        hours: this.minutesToISO(params.minutes),
        _links: links,
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: this.buildAuthHeaders(token),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        return {
          ok: false,
          error: errJson?.message || `HTTP ${res.status}`,
        };
      }

      return { ok: true };
    } catch (err: unknown) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ──────────────────────────────────────────────
  // Projects & Activity Types
  // ──────────────────────────────────────────────

  async getProjects(): Promise<Project[]> {
    const token = this.getToken();
    if (!token) return [];
    const url = this.sanitizeUrl();

    if (this.isTauriApp()) {
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
      const headers = this.buildAuthHeaders(token);

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

  async getTimeEntryActivities(ticket?: string): Promise<TimeEntryActivityType[]> {
    const token = this.getToken();
    if (!token) return [];
    const url = this.sanitizeUrl();
    const rawTicket = ticket?.trim().replace(/^#/, '');

    if (this.isTauriApp()) {
      try {
        const res = await invoke<TimeEntryActivityType[]>('fetch_time_entry_activities', {
          url,
          token,
          ticket: rawTicket || null,
        });
        if (res && res.length > 0) return res;
      } catch (err) {
        console.warn('Could not fetch time entry activities via Tauri:', err);
      }
    }

    try {
      const headers = this.buildAuthHeaders(token);
      const formEndpoint = `${url}/api/v3/time_entries/form`;

      const parseFormActivities = (formData: Record<string, unknown>): TimeEntryActivityType[] => {
        const embedded = formData['_embedded'] as Record<string, unknown> | undefined;
        const schema = (embedded?.['schema'] || formData['schema']) as Record<string, unknown> | undefined;
        const activitySchema = schema?.['activity'] as Record<string, unknown> | undefined;

        const embeddedValues = (activitySchema?.['_embedded'] as Record<string, unknown> | undefined)?.['allowedValues'];
        if (Array.isArray(embeddedValues) && embeddedValues.length > 0) {
          return embeddedValues
            .map((v: { id?: number | string; name?: string; _links?: { self?: { href?: string; title?: string } } }) => ({
              id: String(v.id || (v._links?.self?.href || '').split('/').pop() || ''),
              name: v.name || v._links?.self?.title || '',
            }))
            .filter((a) => a.id && a.name);
        }

        const links = activitySchema?.['_links'] as Record<string, unknown> | undefined;
        const linkedValues = (links?.['allowedValues'] || activitySchema?.['allowedValues']) as unknown;
        if (Array.isArray(linkedValues) && linkedValues.length > 0) {
          return linkedValues
            .map((v: { href?: string; title?: string; id?: number | string; name?: string }) => ({
              id: String(v.id || (v.href || '').split('/').pop() || ''),
              name: v.name || v.title || '',
            }))
            .filter((a) => a.id && a.name);
        }
        return [];
      };

      // 1. If ticket is provided, query time_entries/form with workPackage link
      if (rawTicket) {
        const formRes = await fetch(formEndpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            _links: {
              workPackage: { href: `/api/v3/work_packages/${rawTicket}` },
            },
          }),
        });
        if (formRes.ok) {
          const formData = await formRes.json();
          const items = parseFormActivities(formData);
          if (items.length > 0) return items;
        }
      }

      // 2. Discover via GET /api/v3/work_packages?pageSize=1
      const wpRes = await fetch(`${url}/api/v3/work_packages?pageSize=1`, { headers });
      if (wpRes.ok) {
        const wpData = await wpRes.json();
        const sampleWp = wpData?._embedded?.elements?.[0];
        if (sampleWp?.id) {
          const formRes = await fetch(formEndpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              _links: {
                workPackage: { href: `/api/v3/work_packages/${sampleWp.id}` },
              },
            }),
          });
          if (formRes.ok) {
            const formData = await formRes.json();
            const items = parseFormActivities(formData);
            if (items.length > 0) return items;
          }
        }
      }

      // 3. Discover via GET /api/v3/projects?pageSize=1
      const projRes = await fetch(`${url}/api/v3/projects?pageSize=1`, { headers });
      if (projRes.ok) {
        const projData = await projRes.json();
        const sampleProj = projData?._embedded?.elements?.[0];
        if (sampleProj?.id) {
          const formRes = await fetch(formEndpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              _links: {
                project: { href: `/api/v3/projects/${sampleProj.id}` },
              },
            }),
          });
          if (formRes.ok) {
            const formData = await formRes.json();
            const items = parseFormActivities(formData);
            if (items.length > 0) return items;
          }
        }
      }

      // 4. Try POST /api/v3/time_entries/form with {}
      const emptyFormRes = await fetch(formEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });
      if (emptyFormRes.ok) {
        const formData = await emptyFormRes.json();
        const items = parseFormActivities(formData);
        if (items.length > 0) return items;
      }

      // 5. Fallback to GET endpoint
      const res = await fetch(`${url}/api/v3/time_entries/activities`, { headers });
      if (res.ok) {
        const data = await res.json();
        const elements = data?._embedded?.elements || data?.elements;
        if (Array.isArray(elements)) {
          return elements.map((a: { id: number | string; name: string }) => ({
            id: String(a.id),
            name: a.name,
          }));
        }
      }

      return [];
    } catch (err) {
      console.warn('Web fetch time entry activities error:', err);
      return [];
    }
  }

  async getStatuses(): Promise<StatusOption[]> {
    if (this.statusesCache) return this.statusesCache;
    const token = this.getToken();
    if (!token) return [];
    const url = this.sanitizeUrl();

    if (this.isTauriApp()) {
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
        headers: this.buildAuthHeaders(token),
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

  // ──────────────────────────────────────────────
  // Status & Version Updates
  // ──────────────────────────────────────────────

  async updateWorkPackageStatus(
    ticket: string,
    statusId: string,
    lockVersion?: number
  ): Promise<{ ok: boolean; error?: string }> {
    const rawTicket = ticket.trim().replace(/^#/, '');
    if (!rawTicket) return { ok: false, error: 'No ticket ID' };
    const token = this.getToken();
    if (!token) return { ok: false, error: 'No token' };
    const url = this.sanitizeUrl();

    if (this.isTauriApp()) {
      try {
        await invoke('update_work_package_status', {
          url,
          token,
          ticket: rawTicket,
          statusId,
          lockVersion: lockVersion || null,
        });
        return { ok: true };
      } catch (err: unknown) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }

    try {
      const headers = this.buildAuthHeaders(token);
      let actualLockVersion = lockVersion;

      if (actualLockVersion === undefined) {
        const wpRes = await fetch(`${url}/api/v3/work_packages/${rawTicket}`, { headers });
        if (!wpRes.ok) return { ok: false, error: `HTTP ${wpRes.status}` };
        const wpData = await wpRes.json();
        actualLockVersion = wpData.lockVersion;
      }

      const patchRes = await fetch(`${url}/api/v3/work_packages/${rawTicket}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          lockVersion: actualLockVersion,
          _links: {
            status: { href: `/api/v3/statuses/${statusId}` },
          },
        }),
      });

      if (!patchRes.ok) {
        const errJson = await patchRes.json().catch(() => null);
        return { ok: false, error: errJson?.message || `HTTP ${patchRes.status}` };
      }

      return { ok: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async getProjectVersions(projectId: string): Promise<VersionOption[]> {
    if (!projectId) return [];
    if (this.versionsCache.has(projectId)) {
      return this.versionsCache.get(projectId)!;
    }

    const token = this.getToken();
    if (!token) return [];
    const url = this.sanitizeUrl();

    if (this.isTauriApp()) {
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
        headers: this.buildAuthHeaders(token),
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

  async updateWorkPackageVersion(
    ticket: string,
    versionId: string | null,
    lockVersion?: number
  ): Promise<{ ok: boolean; error?: string }> {
    const rawTicket = ticket.trim().replace(/^#/, '');
    if (!rawTicket) return { ok: false, error: 'No ticket ID' };
    const token = this.getToken();
    if (!token) return { ok: false, error: 'No token' };
    const url = this.sanitizeUrl();

    if (this.isTauriApp()) {
      try {
        await invoke('update_work_package_version', {
          url,
          token,
          ticket: rawTicket,
          versionId: versionId || null,
          lockVersion: lockVersion || null,
        });
        return { ok: true };
      } catch (err: unknown) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }

    try {
      const headers = this.buildAuthHeaders(token);
      let actualLockVersion = lockVersion;

      if (actualLockVersion === undefined) {
        const wpRes = await fetch(`${url}/api/v3/work_packages/${rawTicket}`, { headers });
        if (!wpRes.ok) return { ok: false, error: `HTTP ${wpRes.status}` };
        const wpData = await wpRes.json();
        actualLockVersion = wpData.lockVersion;
      }

      const patchRes = await fetch(`${url}/api/v3/work_packages/${rawTicket}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          lockVersion: actualLockVersion,
          _links: {
            version: versionId ? { href: `/api/v3/versions/${versionId}` } : { href: null },
          },
        }),
      });

      if (!patchRes.ok) {
        const errJson = await patchRes.json().catch(() => null);
        return { ok: false, error: errJson?.message || `HTTP ${patchRes.status}` };
      }

      return { ok: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // ──────────────────────────────────────────────
  // Boards & Columns (Legacy parity)
  // ──────────────────────────────────────────────

  async getProjectBoards(projectId: string, projectIdentifier?: string): Promise<BoardOption[]> {
    if (!projectId) return [];
    if (this.boardsCache.has(projectId)) {
      return this.boardsCache.get(projectId)!;
    }

    const token = this.getToken();
    if (!token) return [];
    const url = this.sanitizeUrl();

    try {
      const res = await fetch(`${url}/api/v3/grids`, {
        headers: this.buildAuthHeaders(token),
      });
      if (!res.ok) return [];
      const data = await res.json();
      if (!data?._embedded?.elements) return [];

      const identifier = projectIdentifier || projectId;
      const boards: BoardOption[] = data._embedded.elements
        .filter((g: Record<string, unknown>) => {
          const links = g['_links'] as Record<string, { href?: string }> | undefined;
          const scope = links?.['scope']?.href ?? links?.['page']?.href ?? '';
          return scope.endsWith('/boards') && scope.includes(`/${identifier}/`);
        })
        .map((g: Record<string, unknown>) => {
          const links = g['_links'] as Record<string, { title?: string }> | undefined;
          return {
            id: String(g['id']),
            name:
              (g['name'] as string) ||
              links?.['scope']?.title ||
              links?.['page']?.title ||
              `Board ${g['id']}`,
          };
        });

      this.boardsCache.set(projectId, boards);
      return boards;
    } catch (err) {
      console.warn('Boards fetch error:', err);
      return [];
    }
  }

  async getBoardColumns(gridId: string): Promise<BoardColumnOption[]> {
    if (!gridId) return [];
    if (this.boardColumnsCache.has(gridId)) {
      return this.boardColumnsCache.get(gridId)!;
    }

    const token = this.getToken();
    if (!token) return [];
    const url = this.sanitizeUrl();

    try {
      const headers = this.buildAuthHeaders(token);
      const gridRes = await fetch(`${url}/api/v3/grids/${gridId}`, { headers });
      if (!gridRes.ok) return [];
      const gridData = await gridRes.json();
      const widgets: Array<{ id: number; startColumn: number; options?: { queryId?: string | number } }> =
        gridData.widgets ?? [];

      const columnResults = await Promise.all(
        widgets.map(async (widget) => {
          const queryId = String(widget.options?.queryId ?? '');
          if (!queryId) return null;

          try {
            const qRes = await fetch(`${url}/api/v3/queries/${queryId}`, { headers });
            if (!qRes.ok) return null;
            const qData = await qRes.json();
            const elements: Array<{ id: number }> = qData._embedded?.results?._embedded?.elements ?? [];
            return {
              queryId,
              name: qData.name ?? `Columna ${queryId}`,
              widgetId: widget.id,
              startColumn: widget.startColumn,
              workPackageIds: elements.map((e) => e.id),
            } as BoardColumnOption;
          } catch {
            return null;
          }
        })
      );

      const columns = columnResults
        .filter((c): c is BoardColumnOption => c !== null)
        .sort((a, b) => a.startColumn - b.startColumn);

      this.boardColumnsCache.set(gridId, columns);
      return columns;
    } catch (err) {
      console.warn('Columns fetch error:', err);
      return [];
    }
  }

  async findTicketBoardColumn(
    projectId: string,
    ticket: string,
    projectIdentifier?: string
  ): Promise<BoardLocation | null> {
    const ticketNum = parseInt(ticket.trim().replace(/^#/, ''), 10);
    if (isNaN(ticketNum)) return null;

    const boards = await this.getProjectBoards(projectId, projectIdentifier);
    if (!boards.length) return null;

    const results = await Promise.all(
      boards.map(async (board) => {
        const columns = await this.getBoardColumns(board.id);
        const col = columns.find((c) => c.workPackageIds.includes(ticketNum));
        return col
          ? {
              boardId: board.id,
              boardName: board.name,
              boardColumnQueryId: col.queryId,
              boardColumnName: col.name,
            }
          : null;
      })
    );

    return results.find((r): r is BoardLocation => r !== null) ?? null;
  }

  async moveWorkPackageToBoardColumn(
    ticket: string,
    targetQueryId: string,
    sourceQueryId?: string
  ): Promise<{ ok: boolean; error?: string }> {
    const ticketNum = parseInt(ticket.trim().replace(/^#/, ''), 10);
    if (isNaN(ticketNum)) return { ok: false, error: 'Invalid ticket ID' };
    const token = this.getToken();
    if (!token) return { ok: false, error: 'No token' };
    const url = this.sanitizeUrl();
    const headers = this.buildAuthHeaders(token);

    try {
      if (sourceQueryId && sourceQueryId !== targetQueryId) {
        await fetch(`${url}/api/v3/queries/${sourceQueryId}/order`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ delta: { [String(ticketNum)]: -40960 } }),
        });
      }

      const putRes = await fetch(`${url}/api/v3/queries/${targetQueryId}/order`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ delta: { [String(ticketNum)]: -1 } }),
      });

      if (!putRes.ok) {
        const errData = await putRes.json().catch(() => null);
        return { ok: false, error: errData?.message || `HTTP ${putRes.status}` };
      }

      // Invalidate column cache for the grid
      this.boardColumnsCache.forEach((cols, gridId) => {
        if (cols.some((c) => c.queryId === targetQueryId)) {
          this.boardColumnsCache.delete(gridId);
        }
      });

      return { ok: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
