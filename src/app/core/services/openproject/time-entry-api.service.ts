import { Injectable, inject } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import {
  TimeEntryActivityType,
  CreateTimeEntryParams,
  PlatformTimeEntry,
  TimeCostReportFilter,
} from '../../interfaces/openproject.interface';
import { OpenprojectService } from './openproject.service';

/** OpenProject time entries: activities, create/update, cost report and per-ticket entries. */
@Injectable({ providedIn: 'root' })
export class TimeEntryApiService {
  private readonly openprojectService = inject(OpenprojectService);

  /**
   * Uploads a work log (time entry) to OpenProject with ISO duration and HAL links
   */
  async createTimeEntry(params: CreateTimeEntryParams): Promise<{ ok: boolean; error?: string }> {
    const rawTicket = params.ticket.trim().replace(/^#/, '');
    if (!rawTicket) {
      return { ok: false, error: 'No ticket specified' };
    }

    const token = this.openprojectService.getToken();
    if (!token) {
      return { ok: false, error: 'Token de OpenProject no configurado' };
    }

    const url = this.openprojectService.sanitizeUrl();

    if (this.openprojectService.isTauriApp()) {
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
        hours: this.openprojectService.minutesToISO(params.minutes),
        _links: links,
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: this.openprojectService.buildAuthHeaders(token),
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

  async getTimeEntryActivities(ticket?: string): Promise<TimeEntryActivityType[]> {
    const token = this.openprojectService.getToken();
    if (!token) return [];
    const url = this.openprojectService.sanitizeUrl();
    const rawTicket = ticket?.trim().replace(/^#/, '');

    if (this.openprojectService.isTauriApp()) {
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
      const headers = this.openprojectService.buildAuthHeaders(token);
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

  async updateTimeEntry(
    entryId: string,
    payload: { hours: string; spentOn: string; comment: string; activityId?: string | null }
  ): Promise<{ ok: boolean; error?: string }> {
    const rawEntryId = entryId.trim();
    const token = this.openprojectService.getToken();
    if (!rawEntryId || !token) return { ok: false, error: 'Time entry or OpenProject token is missing.' };
    const url = this.openprojectService.sanitizeUrl();

    if (this.openprojectService.isTauriApp()) {
      try {
        await invoke('update_work_package_time_entry', {
          url,
          token,
          entryId: rawEntryId,
          payload,
        });
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    }

    try {
      const body: Record<string, unknown> = {
        hours: payload.hours,
        spentOn: payload.spentOn,
        comment: { format: 'plain', raw: payload.comment },
      };
      if (payload.activityId) {
        body['_links'] = { activity: { href: `/api/v3/time_entries/activities/${payload.activityId}` } };
      }
      const response = await fetch(`${url}/api/v3/time_entries/${rawEntryId}`, {
        method: 'PATCH',
        headers: this.openprojectService.buildAuthHeaders(token),
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        return { ok: false, error: error?.message || `HTTP ${response.status}` };
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  getCostReportUrl(ticket: string, projectIdentifier: string): string {
    const query = new URLSearchParams({
      'fields[]': 'WorkPackageId',
      'operators[WorkPackageId]': '=_child_work_packages',
      'values[WorkPackageId]': ticket.trim().replace(/^#/, ''),
      set_filter: '1',
    });
    return `${this.openprojectService.sanitizeUrl()}/projects/${encodeURIComponent(projectIdentifier)}/cost_reports?${query.toString()}`;
  }

  private async getWorkPackageDescendantIds(
    rootTicket: string,
    url: string,
    headers: Record<string, string>
  ): Promise<string[]> {
    const visited = new Set<string>([rootTicket]);
    let frontier = [rootTicket];
    let depth = 0;

    while (frontier.length > 0 && depth < 50) {
      depth += 1;
      const children: string[] = [];
      let offset = 1;
      let hasNextPage = true;

      while (hasNextPage) {
        const query = new URLSearchParams({
          filters: JSON.stringify([{ parent: { operator: '=', values: frontier } }]),
          offset: String(offset),
          pageSize: '100',
          valid_subset: 'true',
        });
        const response = await fetch(`${url}/api/v3/work_packages?${query.toString()}`, { headers });
        if (!response.ok) return [...visited];
        const collection = await response.json();
        const elementList: Array<{ id?: number | string }> = collection?._embedded?.elements ?? [];

        for (const element of elementList) {
          if (element.id === undefined) continue;
          const childId = String(element.id);
          if (visited.has(childId)) continue;
          visited.add(childId);
          children.push(childId);
        }

        hasNextPage = elementList.length === 100;
        offset += 1;
      }

      frontier = children;
    }

    return [...visited];
  }

  private mapPlatformTimeEntry(elements: Array<Record<string, any>>): PlatformTimeEntry[] {
    return elements.map((entry) => {
      const userHref = String(entry['_links']?.['user']?.['href'] || '');
      const activityHref = String(entry['_links']?.['activity']?.['href'] || '');
      return {
        id: String(entry['id']),
        hours: String(entry['hours'] || 'PT0H'),
        spentOn: String(entry['spentOn'] || ''),
        startTime: typeof entry['startTime'] === 'string' ? entry['startTime'] : null,
        comment: String(entry['comment']?.['raw'] || entry['comment']?.['html'] || ''),
        userId: userHref.split('/').filter(Boolean).pop() || null,
        userName: String(entry['_links']?.['user']?.['title'] || 'Usuario'),
        activityName: String(entry['_links']?.['activity']?.['title'] || ''),
        activityId: activityHref.split('/').filter(Boolean).pop() || null,
        projectName: entry['_links']?.['project']?.['title'] || null,
        workPackageName: entry['_links']?.['entity']?.['title'] || entry['_links']?.['workPackage']?.['title'] || null,
        registeredByName: entry['_links']?.['author']?.['title'] || entry['_links']?.['user']?.['title'] || null,
        costs: entry['costs'] ?? entry['overallCosts'] ?? null,
        createdAt: entry['createdAt'] || undefined,
        updatedAt: entry['updatedAt'] || undefined,
      };
    });
  }

  async getTimeCostReportEntries(filter: TimeCostReportFilter): Promise<PlatformTimeEntry[]> {
    const token = this.openprojectService.getToken();
    if (!token) return [];
    const url = this.openprojectService.sanitizeUrl();
    const queryFilter: TimeCostReportFilter = { ...filter };
    if (queryFilter.ticketId) queryFilter.ticketId = queryFilter.ticketId.trim().replace(/^#/, '');

    if (this.openprojectService.isTauriApp()) {
      try {
        return await invoke<PlatformTimeEntry[]>('fetch_time_cost_report_entries', {
          url,
          token,
          filter: queryFilter,
        });
      } catch (error) {
        console.warn('Could not fetch time and cost report entries via Tauri:', error);
        return [];
      }
    }

    try {
      const headers = this.openprojectService.buildAuthHeaders(token);
      const filters: Array<Record<string, { operator: string; values: string[] }>> = [
        { entity_type: { operator: '=', values: ['WorkPackage'] } },
      ];
      if (queryFilter.ticketId) {
        const workPackageIds = queryFilter.includeDescendants === false
          ? [queryFilter.ticketId]
          : await this.getWorkPackageDescendantIds(queryFilter.ticketId, url, headers);
        filters.push({ entity_id: { operator: '=', values: workPackageIds } });
      }
      if (queryFilter.projectId) filters.push({ project_id: { operator: '=', values: [queryFilter.projectId] } });
      if (queryFilter.userId) filters.push({ user_id: { operator: '=', values: [queryFilter.userId] } });
      if (queryFilter.activityId) filters.push({ activity_id: { operator: '=', values: [queryFilter.activityId] } });
      if (queryFilter.spentOnFrom) filters.push({ spent_on: { operator: '>=', values: [queryFilter.spentOnFrom] } });
      if (queryFilter.spentOnTo) filters.push({ spent_on: { operator: '<=', values: [queryFilter.spentOnTo] } });

      const filterJson = JSON.stringify(filters);
      const entries: Array<Record<string, any>> = [];
      const pageSize = 100;
      let offset = 1;
      while (true) {
        const query = new URLSearchParams({ filters: filterJson, pageSize: String(pageSize), offset: String(offset) });
        const response = await fetch(`${url}/api/v3/time_entries?${query.toString()}`, { headers });
        if (!response.ok) return [];
        const data = await response.json();
        const page: Array<Record<string, any>> = data?._embedded?.elements ?? [];
        entries.push(...page);
        if (page.length < pageSize) break;
        offset += 1;
      }

      return this.mapPlatformTimeEntry(entries);
    } catch (error) {
      console.warn('Could not fetch time and cost report entries:', error);
      return [];
    }
  }

  async getWorkPackageTimeEntries(ticket: string): Promise<PlatformTimeEntry[]> {
    return this.getTimeCostReportEntries({ ticketId: ticket, includeDescendants: true });
  }
}
