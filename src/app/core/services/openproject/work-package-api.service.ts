import { Injectable, inject } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { Subject } from 'rxjs';
import {
  StatusOption,
  TicketInfoResult,
  TicketContextResult,
  TicketContextOptions,
  TicketComment,
  TicketAttachment,
  WorkPackageRevision,
  WorkPackageCostSummary,
  WorkPackageSearchItem,
} from '../../interfaces/openproject.interface';
import { OpenprojectService } from './openproject.service';
import { ProjectApiService } from './project-api.service';

/** Work packages: ticket info and context, search, revisions, form schema, updates, status/version and comments. */
@Injectable({ providedIn: 'root' })
export class WorkPackageApiService {
  private readonly openprojectService = inject(OpenprojectService);
  private readonly projectApi = inject(ProjectApiService);

  private readonly statusChangedSubject = new Subject<{ ticket: string; statusId: string }>();
  /** Emits after any successful status change made from the app (status picker, board move…). */
  readonly statusChanged$ = this.statusChangedSubject.asObservable();

  /**
   * Fetches ticket metadata including subject, project, status, color, version and available statuses
   */
  async getTicketInfo(ticket: string): Promise<TicketInfoResult> {
    const rawTicket = ticket.trim().replace(/^#/, '');
    if (!rawTicket) {
      return { success: false, message: 'Ticket vacío' };
    }

    const token = this.openprojectService.getToken();
    const url = this.openprojectService.sanitizeUrl();

    if (this.openprojectService.isTauriApp()) {
      try {
        const res = await invoke<TicketInfoResult>('fetch_ticket_info', {
          url,
          token,
          ticket: rawTicket,
        });

        if (res.success && res.subject) {
          return res;
        }

        // Resilient fallback to fetch_ticket_context if fetch_ticket_info failed
        const ctx = await this.getTicketContext(rawTicket, {
          includeDescription: false,
          includeComments: false,
          includeAttachments: false,
        });
        if (ctx.success && ctx.subject) {
          return {
            success: true,
            subject: ctx.subject,
            project_id: ctx.project_id,
            project_name: ctx.project_name,
            status_id: ctx.status_id,
            status_name: ctx.status_name,
            status_color: ctx.status_color,
            version_id: ctx.version_id,
            version_name: ctx.version_name,
            lock_version: ctx.lock_version,
            available_statuses: ctx.available_statuses,
            message: 'OK',
          };
        }

        return res;
      } catch (err: unknown) {
        try {
          const ctx = await this.getTicketContext(rawTicket, {
            includeDescription: false,
            includeComments: false,
            includeAttachments: false,
          });
          if (ctx.success && ctx.subject) {
            return {
              success: true,
              subject: ctx.subject,
              project_id: ctx.project_id,
              project_name: ctx.project_name,
              status_id: ctx.status_id,
              status_name: ctx.status_name,
              status_color: ctx.status_color,
              version_id: ctx.version_id,
              version_name: ctx.version_name,
              lock_version: ctx.lock_version,
              available_statuses: ctx.available_statuses,
              message: 'OK',
            };
          }
        } catch {}

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
      const headers = this.openprojectService.buildAuthHeaders(token);

      const wpRes = await fetch(endpoint, { headers });
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
      try {
        const formRes = await fetch(formEndpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(lockVersion ? { lockVersion } : {}),
        });
        if (formRes.ok) {
          const formData = await formRes.json();
          const allowedRaw =
            formData?._embedded?.schema?.status?._embedded?.allowedValues ??
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
      } catch {}

      if (!availableStatuses || availableStatuses.length === 0) {
        availableStatuses = await this.projectApi.getStatuses();
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

  /** Searches work packages by subject or ID (OpenProject `typeahead` filter), most recently updated first. */
  async searchWorkPackages(query: string, limit = 8): Promise<WorkPackageSearchItem[]> {
    const text = query.trim().replace(/^#/, '');
    const token = this.openprojectService.getToken();
    if (!text || !token) return [];
    const url = this.openprojectService.sanitizeUrl();

    if (this.openprojectService.isTauriApp()) {
      return invoke<WorkPackageSearchItem[]>('search_work_packages', { url, token, query: text, limit });
    }

    const params = new URLSearchParams({
      filters: JSON.stringify([{ typeahead: { operator: '**', values: [text] } }]),
      sortBy: JSON.stringify([['updatedAt', 'desc']]),
      pageSize: String(limit),
    });
    const response = await fetch(`${url}/api/v3/work_packages?${params.toString()}`, {
      headers: this.openprojectService.buildAuthHeaders(token),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const elements: any[] = Array.isArray(data?._embedded?.elements) ? data._embedded.elements : [];
    return elements
      .filter((item) => typeof item?.id === 'number')
      .map((item) => ({
        id: item.id,
        subject: item.subject ?? '',
        projectId: item._links?.project?.href?.split('/').pop() ?? null,
        projectName: item._links?.project?.title ?? null,
        typeName: item._links?.type?.title ?? null,
        statusName: item._links?.status?.title ?? null,
      }));
  }

  async getWorkPackageRevisions(ticketIdList: string[]): Promise<WorkPackageRevision[]> {
    const ticketIds = [...new Set(ticketIdList.map((ticket) => ticket.trim().replace(/^#/, '')))]
      .filter((ticket) => /^\d+$/.test(ticket));
    const token = this.openprojectService.getToken();
    if (ticketIds.length === 0 || !token) return [];
    const url = this.openprojectService.sanitizeUrl();

    if (this.openprojectService.isTauriApp()) {
      try {
        return await invoke<WorkPackageRevision[]>('fetch_work_package_revisions', {
          url,
          token,
          ticketIds,
        });
      } catch {
        return [];
      }
    }

    const query = new URLSearchParams({
      filters: JSON.stringify([{ id: { operator: '=', values: ticketIds } }]),
      offset: '1',
      pageSize: String(ticketIds.length),
      valid_subset: 'true',
    });
    try {
      const response = await fetch(`${url}/api/v3/work_packages?${query.toString()}`, {
        headers: this.openprojectService.buildAuthHeaders(token),
      });
      if (!response.ok) return [];
      const data = await response.json();
      const elements = data?._embedded?.elements;
      if (!Array.isArray(elements)) return [];
      return elements
        .filter((item: any) => item?.id !== undefined && typeof item?.lockVersion === 'number')
        .map((item: any) => ({
          id: String(item.id),
          lockVersion: item.lockVersion,
          updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : undefined,
        }));
    } catch {
      return [];
    }
  }

  async getWorkPackageLockVersion(ticket: string): Promise<number | null> {
    const rawTicket = ticket.trim().replace(/^#/, '');
    const revision = (await this.getWorkPackageRevisions([rawTicket])).find((item) => item.id === rawTicket);
    return revision?.lockVersion ?? null;
  }

  async getWorkPackageUpdateStream(
    ticket: string,
    lastUpdateTimestamp: string
  ): Promise<{ available: boolean; hasUpdates: boolean }> {
    const rawTicket = ticket.trim().replace(/^#/, '');
    const token = this.openprojectService.getToken();
    if (!rawTicket || !token) return { available: false, hasUpdates: false };
    const url = this.openprojectService.sanitizeUrl();

    if (this.openprojectService.isTauriApp()) {
      try {
        return await invoke<{ available: boolean; hasUpdates: boolean }>(
          'fetch_work_package_update_stream',
          { url, token, ticket: rawTicket, lastUpdateTimestamp }
        );
      } catch {
        return { available: false, hasUpdates: false };
      }
    }

    const query = new URLSearchParams({
      sortBy: 'asc',
      filter: 'all',
      last_update_timestamp: lastUpdateTimestamp,
    });
    try {
      const response = await fetch(
        `${url}/work_packages/${rawTicket}/activities/update_streams?${query.toString()}`,
        {
          headers: {
            ...this.openprojectService.buildAuthHeaders(token),
            Accept: 'text/vnd.turbo-stream.html, */*',
            'X-Requested-With': 'XMLHttpRequest',
          },
          credentials: 'include',
        }
      );
      if (!response.ok) return { available: false, hasUpdates: false };
      const contentType = response.headers.get('content-type') || '';
      const body = await response.text();
      const available = contentType.includes('turbo-stream') || body.includes('<turbo-stream');
      return { available, hasUpdates: available && body.includes('<turbo-stream') };
    } catch {
      return { available: false, hasUpdates: false };
    }
  }

  /**
   * Fetches full ticket context including description, comments, and attachments
   */
  async getTicketContext(
    ticket: string,
    options?: TicketContextOptions
  ): Promise<TicketContextResult> {
    const rawTicket = ticket.trim().replace(/^#/, '');
    if (!rawTicket) {
      return { success: false, ticket, message: 'Ticket vacío' };
    }

    const token = this.openprojectService.getToken();
    const url = this.openprojectService.sanitizeUrl();

    if (this.openprojectService.isTauriApp()) {
      try {
        return await invoke<TicketContextResult>('fetch_ticket_context', {
          url,
          token,
          ticket: rawTicket,
          includeDescription: options?.includeDescription ?? true,
          includeComments: options?.includeComments ?? true,
          includeAttachments: options?.includeAttachments ?? true,
        });
      } catch (err: unknown) {
        return {
          success: false,
          ticket: `#${rawTicket}`,
          message: err instanceof Error ? err.message : String(err),
        };
      }
    }

    // Web Fallback implementation
    try {
      const headers = this.openprojectService.buildAuthHeaders(token);
      const wpEndpoint = `${url}/api/v3/work_packages/${rawTicket}`;

      const res = await fetch(wpEndpoint, { headers });
      if (!res.ok) {
        return {
          success: false,
          ticket: `#${rawTicket}`,
          message: `HTTP ${res.status}`,
        };
      }

      const wpData: any = await res.json();
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

      const priorityName = wpData._links?.priority?.title || null;
      const assigneeName = wpData._links?.assignee?.title || null;
      const responsibleName = wpData._links?.responsible?.title || null;
      const startDate = wpData.startDate || null;
      const dueDate = wpData.dueDate || null;
      const estimatedTime = wpData.estimatedTime || null;
      const spentTime = wpData.spentTime || null;
      const lockVersion = wpData.lockVersion || null;

      // 1. Description
      const descRaw = wpData.description?.raw || null;
      const descHtml = wpData.description?.html || null;
      const description = (descRaw || descHtml) ? { raw: descRaw, html: descHtml } : null;

      // 2. Comments / Activities
      let comments: TicketComment[] | null = null;
      if (options?.includeComments ?? true) {
        try {
          const actRes = await fetch(`${url}/api/v3/work_packages/${rawTicket}/activities`, { headers });
          if (actRes.ok) {
            const actData: any = await actRes.json();
            const elements: any[] = actData._embedded?.elements || [];

            // Pre-populate known users from work package links
            const knownUsers = new Map<string, string>();
            if (wpData._links?.author?.href && wpData._links?.author?.title) {
              const uid = wpData._links.author.href.split('/').pop();
              if (uid) knownUsers.set(uid, wpData._links.author.title);
            }
            if (wpData._links?.assignee?.href && wpData._links?.assignee?.title) {
              const uid = wpData._links.assignee.href.split('/').pop();
              if (uid) knownUsers.set(uid, wpData._links.assignee.title);
            }
            if (wpData._links?.responsible?.href && wpData._links?.responsible?.title) {
              const uid = wpData._links.responsible.href.split('/').pop();
              if (uid) knownUsers.set(uid, wpData._links.responsible.title);
            }

            // Fetch any missing user names
            const missingUids = new Set<string>();
            for (const a of elements) {
              const uHref = a._links?.user?.href;
              if (uHref) {
                const uid = uHref.split('/').pop();
                if (uid && !knownUsers.has(uid)) {
                  missingUids.add(uid);
                }
              }
            }

            for (const uid of missingUids) {
              try {
                const uRes = await fetch(`${url}/api/v3/users/${uid}`, { headers });
                if (uRes.ok) {
                  const uData: any = await uRes.json();
                  if (uData.name) {
                    knownUsers.set(uid, uData.name);
                  }
                }
              } catch {}
            }

            comments = [];
            for (const a of elements) {
              const commentRaw = a.comment?.raw || '';
              const commentHtml = a.comment?.html || a.comment?.raw || '';

              const details: Array<{ raw: string; html: string }> = [];
              if (Array.isArray(a.details)) {
                for (const d of a.details) {
                  const dRaw = d.raw || '';
                  const dHtml = d.html || d.raw || '';
                  if (dRaw || dHtml) {
                    details.push({ raw: dRaw, html: dHtml });
                  }
                }
              }

              if (commentRaw || commentHtml || details.length > 0) {
                const uHref = a._links?.user?.href || '';
                const uid = uHref.split('/').pop() || '';
                const userName = knownUsers.get(uid) || a._links?.user?.title || (uid ? `Usuario #${uid}` : 'Desconocido');

                comments.push({
                  id: String(a.id),
                  commentRaw,
                  commentHtml: commentHtml || commentRaw,
                  createdAt: a.createdAt || '',
                  userName,
                  details,
                });
              }
            }
          }
        } catch {
          comments = [];
        }
      }

      // 3. Attachments
      let attachments: TicketAttachment[] | null = null;
      if (options?.includeAttachments ?? true) {
        try {
          const attRes = await fetch(`${url}/api/v3/work_packages/${rawTicket}/attachments`, { headers });
          if (attRes.ok) {
            const attData: any = await attRes.json();
            const elements: any[] = attData._embedded?.elements || [];
            attachments = elements.map((att: any) => {
              const fileName = att.fileName || 'archivo';
              const contentType = att.contentType || 'application/octet-stream';
              const isImage = contentType.startsWith('image/') ||
                /\.(png|jpe?g|webp|gif|svg)$/i.test(fileName);
              return {
                id: String(att.id),
                fileName,
                fileSize: att.fileSize || 0,
                contentType,
                downloadUrl: att._links?.downloadLocation?.href || '',
                isImage,
                createdAt: att.createdAt || undefined,
                authorName: att._links?.author?.title || undefined,
              };
            });
          }
        } catch {
          attachments = [];
        }
      }

      return {
        success: true,
        ticket: `#${rawTicket}`,
        subject,
        description,
        comments,
        attachments,
        project_id: projectId,
        project_name: projectName,
        status_id: statusId,
        status_name: statusName,
        status_color: statusColor,
        version_id: versionId,
        version_name: versionName,
        priority_name: priorityName,
        assignee_name: assigneeName,
        responsible_name: responsibleName,
        start_date: startDate,
        due_date: dueDate,
        estimated_time: estimatedTime,
        spent_time: spentTime,
        lock_version: lockVersion,
        available_statuses: await this.projectApi.getStatuses(),
        message: 'OK',
      };
    } catch (err: unknown) {
      return {
        success: false,
        ticket: `#${rawTicket}`,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async updateWorkPackageStatus(
    ticket: string,
    statusId: string,
    lockVersion?: number
  ): Promise<{ ok: boolean; error?: string }> {
    const rawTicket = ticket.trim().replace(/^#/, '');
    if (!rawTicket) return { ok: false, error: 'No ticket ID' };
    const token = this.openprojectService.getToken();
    if (!token) return { ok: false, error: 'No token' };
    const url = this.openprojectService.sanitizeUrl();

    if (this.openprojectService.isTauriApp()) {
      try {
        await invoke('update_work_package_status', {
          url,
          token,
          ticket: rawTicket,
          statusId,
          lockVersion: lockVersion || null,
        });
        this.statusChangedSubject.next({ ticket: rawTicket, statusId });
        return { ok: true };
      } catch (err: unknown) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }

    try {
      const headers = this.openprojectService.buildAuthHeaders(token);
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

      this.statusChangedSubject.next({ ticket: rawTicket, statusId });
      return { ok: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async updateWorkPackageVersion(
    ticket: string,
    versionId: string | null,
    lockVersion?: number
  ): Promise<{ ok: boolean; error?: string }> {
    const rawTicket = ticket.trim().replace(/^#/, '');
    if (!rawTicket) return { ok: false, error: 'No ticket ID' };
    const token = this.openprojectService.getToken();
    if (!token) return { ok: false, error: 'No token' };
    const url = this.openprojectService.sanitizeUrl();

    if (this.openprojectService.isTauriApp()) {
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
      const headers = this.openprojectService.buildAuthHeaders(token);
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


  async getWorkPackageCostSummary(ticket: string): Promise<WorkPackageCostSummary> {
    const rawTicket = ticket.trim().replace(/^#/, '');
    const token = this.openprojectService.getToken();
    const empty: WorkPackageCostSummary = { laborCosts: null, materialCosts: null, overallCosts: null };
    if (!rawTicket || !token) return empty;
    const url = this.openprojectService.sanitizeUrl();

    if (this.openprojectService.isTauriApp()) {
      try {
        return await invoke<WorkPackageCostSummary>('fetch_work_package_cost_summary', {
          url,
          token,
          ticket: rawTicket,
        });
      } catch {
        return empty;
      }
    }

    try {
      const response = await fetch(`${url}/api/v3/work_packages/${rawTicket}`, {
        headers: this.openprojectService.buildAuthHeaders(token),
      });
      if (!response.ok) return empty;
      const workPackage = await response.json();
      return {
        laborCosts: typeof workPackage.laborCosts === 'string' ? workPackage.laborCosts : null,
        materialCosts: typeof workPackage.materialCosts === 'string' ? workPackage.materialCosts : null,
        overallCosts: typeof workPackage.overallCosts === 'string' ? workPackage.overallCosts : null,
      };
    } catch {
      return empty;
    }
  }
}

export function isWorkPackageConflict(message: string): boolean {
  return /http 409|lock.?version|concurrent|changed since|conflict/i.test(message);
}
