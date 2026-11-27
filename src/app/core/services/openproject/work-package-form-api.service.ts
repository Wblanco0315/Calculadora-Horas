import { Injectable, inject } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import {
  WorkPackageOptionItem,
  WorkPackageFormSchema,
  UpdateWorkPackagePayload,
} from '../../interfaces/openproject.interface';
import { OpenprojectService } from './openproject.service';
import { isWorkPackageConflict } from './work-package-api.service';

/** Work package editing: form schema with allowed values, field updates and comments. */
@Injectable({ providedIn: 'root' })
export class WorkPackageFormApiService {
  private readonly openprojectService = inject(OpenprojectService);

  private parseSchemaAllowedValues(schemaField: any): WorkPackageOptionItem[] {
    const raw =
      schemaField?._embedded?.allowedValues ??
      schemaField?.allowedValues ??
      schemaField?._embedded?.elements ??
      schemaField?.elements ??
      (Array.isArray(schemaField?._links?.allowedValues) ? schemaField._links.allowedValues : undefined);
    if (!Array.isArray(raw)) return [];

    return raw
      .map((v: Record<string, any>) => ({
        id: String(
          v['id'] ||
            v['href']?.split('/').pop() ||
            v['_links']?.['self']?.['href']?.split('/').pop() ||
            ''
        ),
        name: String(v['name'] || v['title'] || v['_links']?.['self']?.['title'] || ''),
        color: typeof v['color'] === 'string' ? v['color'] : undefined,
      }))
      .filter((item) => item.id && item.name);
  }

  private async fetchAvailablePeople(
    ticket: string,
    field: 'assignees' | 'responsibles',
    url: string,
    headers: HeadersInit
  ): Promise<WorkPackageOptionItem[]> {
    const query =
      'filters=%5B%5D&pageSize=-1&select=elements%2Fid%2Celements%2Fname%2Celements%2Femail%2Celements%2Fself%2Ctotal%2Ccount%2CpageSize';
    const endpoint = `${url}/api/v3/work_packages/${ticket}/available_${field}?${query}`;

    try {
      const response = await fetch(endpoint, { headers, credentials: 'include' });
      if (!response.ok) return [];
      return this.parseSchemaAllowedValues(await response.json());
    } catch {
      return [];
    }
  }

  private async loadSchemaAllowedValues(
    schemaField: any,
    url: string,
    headers: HeadersInit
  ): Promise<WorkPackageOptionItem[]> {
    const embeddedValues = this.parseSchemaAllowedValues(schemaField);
    if (embeddedValues.length > 0) return embeddedValues;

    const allowedValuesLink = schemaField?._links?.allowedValues;
    const href = Array.isArray(allowedValuesLink)
      ? allowedValuesLink[0]?.href
      : allowedValuesLink?.href;
    if (typeof href !== 'string' || !href) return [];

    const apiBase = url.endsWith('/') ? url.slice(0, -1) : url;
    let nextUrl: string | null = this.resolveAllowedValuesUrl(href, apiBase);
    const result: WorkPackageOptionItem[] = [];
    const visited = new Set<string>();

    while (nextUrl && !visited.has(nextUrl) && visited.size < 20) {
      visited.add(nextUrl);
      try {
        const response = await fetch(nextUrl, { headers });
        if (!response.ok) break;
        const data = await response.json();
        result.push(...this.parseSchemaAllowedValues(data));
        const nextHref = data?._links?.next?.href;
        nextUrl = typeof nextHref === 'string' ? this.resolveAllowedValuesUrl(nextHref, apiBase) : null;
      } catch {
        break;
      }
    }

    return result;
  }

  private resolveAllowedValuesUrl(href: string, apiBase: string): string | null {
    try {
      const target = href.startsWith('/api/v3/')
        ? new URL(`${apiBase}${href}`)
        : new URL(href, `${apiBase}/`);
      return target.origin === new URL(apiBase).origin ? target.toString() : null;
    } catch {
      return null;
    }
  }

  async getWorkPackageForm(ticket: string): Promise<WorkPackageFormSchema> {
    const empty: WorkPackageFormSchema = {
      statuses: [],
      priorities: [],
      assignees: [],
      responsibles: [],
      versions: [],
    };
    const rawTicket = ticket.trim().replace(/^#/, '');
    if (!rawTicket) return empty;
    const token = this.openprojectService.getToken();
    if (!token) return empty;
    const url = this.openprojectService.sanitizeUrl();
    let availableAssignees: WorkPackageOptionItem[] = [];
    let availableResponsibles: WorkPackageOptionItem[] = [];

    if (this.openprojectService.isTauriApp()) {
      try {
        return await invoke<WorkPackageFormSchema>('fetch_work_package_form', {
          url,
          token,
          ticket: rawTicket,
        });
      } catch (err) {
        console.warn('Could not fetch work package form via Tauri:', err);
        return empty;
      }
    }

    try {
      const headers = this.openprojectService.buildAuthHeaders(token);
      [availableAssignees, availableResponsibles] = await Promise.all([
        this.fetchAvailablePeople(rawTicket, 'assignees', url, headers),
        this.fetchAvailablePeople(rawTicket, 'responsibles', url, headers),
      ]);
      const res = await fetch(`${url}/api/v3/work_packages/${rawTicket}/form`, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        return {
          ...empty,
          assignees: availableAssignees,
          responsibles: availableResponsibles.length > 0 ? availableResponsibles : availableAssignees,
        };
      }

      const formData = await res.json();
      const schema = formData?._embedded?.schema ?? {};
      const [statuses, priorities, versions] = await Promise.all([
        this.loadSchemaAllowedValues(schema['status'], url, headers),
        this.loadSchemaAllowedValues(schema['priority'], url, headers),
        this.loadSchemaAllowedValues(schema['version'], url, headers),
      ]);
      const [schemaAssignees, schemaResponsibles] = await Promise.all([
        availableAssignees.length > 0
          ? Promise.resolve([])
          : this.loadSchemaAllowedValues(schema['assignee'], url, headers),
        availableResponsibles.length > 0
          ? Promise.resolve([])
          : this.loadSchemaAllowedValues(schema['responsible'], url, headers),
      ]);
      const assignees = availableAssignees.length > 0 ? availableAssignees : schemaAssignees;
      const responsibles =
        availableResponsibles.length > 0
          ? availableResponsibles
          : schemaResponsibles.length > 0
            ? schemaResponsibles
            : assignees;
      return { statuses, priorities, assignees, responsibles, versions };
    } catch (err) {
      console.warn('Web fetch work package form error:', err);
      return { ...empty, assignees: availableAssignees, responsibles: availableResponsibles };
    }
  }

  async updateWorkPackage(
    ticket: string,
    payload: UpdateWorkPackagePayload
  ): Promise<{ ok: boolean; lockVersion?: number; error?: string; conflict?: boolean }> {
    const rawTicket = ticket.trim().replace(/^#/, '');
    if (!rawTicket) return { ok: false, error: 'No ticket ID' };
    const token = this.openprojectService.getToken();
    if (!token) return { ok: false, error: 'No token' };
    const url = this.openprojectService.sanitizeUrl();

    if (this.openprojectService.isTauriApp()) {
      try {
        const lockVersion = await invoke<number>('update_work_package', {
          url,
          token,
          ticket: rawTicket,
          payload,
        });
        return { ok: true, lockVersion };
      } catch (err: unknown) {
        const error = err instanceof Error ? err.message : String(err);
        return { ok: false, error, conflict: isWorkPackageConflict(error) };
      }
    }

    try {
      const headers = this.openprojectService.buildAuthHeaders(token);
      const wpEndpoint = `${url}/api/v3/work_packages/${rawTicket}`;
      let lockVersion = payload.lockVersion;

      if (lockVersion === undefined) {
        const wpRes = await fetch(wpEndpoint, { headers });
        if (!wpRes.ok) return { ok: false, error: `HTTP ${wpRes.status}` };
        const wpData = await wpRes.json();
        lockVersion = wpData.lockVersion;
      }

      const body: Record<string, any> = { lockVersion };
      if (payload.subject !== undefined) body['subject'] = payload.subject;
      if (payload.descriptionRaw !== undefined) {
        body['description'] = { format: 'markdown', raw: payload.descriptionRaw };
      }
      if (payload.clearStartDate) {
        body['startDate'] = null;
      } else if (payload.startDate !== undefined) {
        body['startDate'] = payload.startDate;
      }
      if (payload.clearDueDate) {
        body['dueDate'] = null;
      } else if (payload.dueDate !== undefined) {
        body['dueDate'] = payload.dueDate;
      }
      if (payload.estimatedTime !== undefined) {
        body['estimatedTime'] = payload.estimatedTime;
      }

      const links: Record<string, { href: string | null }> = {};
      if (payload.statusId) links['status'] = { href: `/api/v3/statuses/${payload.statusId}` };
      if (payload.priorityId) links['priority'] = { href: `/api/v3/priorities/${payload.priorityId}` };
      if (payload.clearAssignee) {
        links['assignee'] = { href: null };
      } else if (payload.assigneeId) {
        links['assignee'] = { href: `/api/v3/users/${payload.assigneeId}` };
      }
      if (payload.clearResponsible) {
        links['responsible'] = { href: null };
      } else if (payload.responsibleId) {
        links['responsible'] = { href: `/api/v3/users/${payload.responsibleId}` };
      }
      if (payload.clearVersion) {
        links['version'] = { href: null };
      } else if (payload.versionId) {
        links['version'] = { href: `/api/v3/versions/${payload.versionId}` };
      }

      if (Object.keys(links).length > 0) {
        body['_links'] = links;
      }

      const patchRes = await fetch(wpEndpoint, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body),
      });

      if (!patchRes.ok) {
        const errJson = await patchRes.json().catch(() => null);
        const error = errJson?.message || `HTTP ${patchRes.status}`;
        return {
          ok: false,
          error,
          conflict:
            patchRes.status === 409 ||
            String(errJson?.errorIdentifier || '').includes('Conflict') ||
            /lock.?version|concurrent|changed since/i.test(error),
        };
      }

      const updated = await patchRes.json();
      return { ok: true, lockVersion: updated.lockVersion };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async addWorkPackageComment(
    ticket: string,
    comment: string
  ): Promise<{ ok: boolean; error?: string }> {
    const rawTicket = ticket.trim().replace(/^#/, '');
    if (!rawTicket) return { ok: false, error: 'No ticket ID' };
    const trimmed = comment.trim();
    if (!trimmed) return { ok: false, error: 'Comment is empty' };
    const token = this.openprojectService.getToken();
    if (!token) return { ok: false, error: 'No token' };
    const url = this.openprojectService.sanitizeUrl();

    if (this.openprojectService.isTauriApp()) {
      try {
        await invoke('add_work_package_comment', {
          url,
          token,
          ticket: rawTicket,
          comment: trimmed,
        });
        return { ok: true };
      } catch (err: unknown) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }

    try {
      const res = await fetch(`${url}/api/v3/work_packages/${rawTicket}/activities`, {
        method: 'POST',
        headers: this.openprojectService.buildAuthHeaders(token),
        body: JSON.stringify({ comment: { format: 'markdown', raw: trimmed } }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        return { ok: false, error: errJson?.message || `HTTP ${res.status}` };
      }
      return { ok: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
