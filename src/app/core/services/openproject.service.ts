import { Injectable, inject } from '@angular/core';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { StorageService } from './storage.service';
import {
  Project,
  StatusOption,
  VersionOption,
  BoardOption,
  BoardColumnDropPosition,
  BoardColumnOption,
  BoardWorkPackageCard,
  BoardLocation,
  TimeEntryActivityType,
  TicketInfoResult,
  TicketContextResult,
  TicketContextOptions,
  TicketComment,
  TicketAttachment,
  CreateTimeEntryParams,
  WorkPackageOptionItem,
  WorkPackageFormSchema,
  UpdateWorkPackagePayload,
  PlatformTimeEntry,
  WorkPackageRevision,
  WorkPackageCostSummary,
  TimeCostReportFilter,
  UploadedAttachment,
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
  private readonly inlineImageCache = new Map<string, Promise<string>>();

  private isTauriApp(): boolean {
    try {
      return isTauri() || (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window);
    } catch {
      return false;
    }
  }

  sanitizeUrl(url?: string): string {
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

  getWorkPackageUrl(ticket: string): string {
    const raw = ticket.trim().replace(/^#/, '');
    return `${this.sanitizeUrl()}/work_packages/${raw}`;
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
      Accept: 'application/hal+json, application/json',
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

  /**
   * Converts an ISO 8601 duration string (e.g. "PT1H30M", "PT1.5H") to total minutes
   */
  isoDurationToMinutes(iso?: string | null): number {
    if (!iso) return 0;
    const match = iso.match(/P(?:(\d+(?:\.\d+)?)D)?T?(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?/i);
    if (!match) return 0;
    const days = parseFloat(match[1] || '0');
    const hours = parseFloat(match[2] || '0');
    const mins = parseFloat(match[3] || '0');
    const secs = parseFloat(match[4] || '0');
    return Math.round(days * 8 * 60 + hours * 60 + mins + secs / 60);
  }

  invalidateBoardCache(projectId?: string, gridId?: string): void {
    if (projectId) {
      this.boardsCache.delete(projectId);
    } else if (!gridId) {
      this.boardsCache.clear();
    }
    if (gridId) {
      this.boardColumnsCache.delete(gridId);
    } else if (!projectId) {
      this.boardColumnsCache.clear();
    }
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
      const headers = this.buildAuthHeaders(token);

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
        availableStatuses = await this.getStatuses();
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

  async getWorkPackageRevisions(ticketIdList: string[]): Promise<WorkPackageRevision[]> {
    const ticketIds = [...new Set(ticketIdList.map((ticket) => ticket.trim().replace(/^#/, '')))]
      .filter((ticket) => /^\d+$/.test(ticket));
    const token = this.getToken();
    if (ticketIds.length === 0 || !token) return [];
    const url = this.sanitizeUrl();

    if (this.isTauriApp()) {
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
        headers: this.buildAuthHeaders(token),
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
    const token = this.getToken();
    if (!rawTicket || !token) return { available: false, hasUpdates: false };
    const url = this.sanitizeUrl();

    if (this.isTauriApp()) {
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
            ...this.buildAuthHeaders(token),
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

    const token = this.getToken();
    const url = this.sanitizeUrl();

    if (this.isTauriApp()) {
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
      const headers = this.buildAuthHeaders(token);
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
        available_statuses: await this.getStatuses(),
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

  /**
   * Fetches content of an attachment using authenticated HTTP headers and returns a data URL
   */
  async fetchAttachmentContent(downloadUrl: string): Promise<string> {
    const token = this.getToken();
    const url = this.sanitizeUrl();

    if (this.isTauriApp()) {
      try {
        return await invoke<string>('fetch_attachment_content', {
          url,
          token,
          downloadUrl,
        });
      } catch (err) {
        console.warn('Tauri attachment fetch error:', err);
        throw err;
      }
    }

    // Web Fallback
    const fullUrl = this.resolveHref(downloadUrl);
    const res = await fetch(fullUrl, {
      headers: {
        Authorization: this.buildAuthHeaders(token)['Authorization'],
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }

  /**
   * Resolves an OpenProject href (absolute, root-relative or relative) against the configured
   * base URL without duplicating the relative root (e.g. `/openproject/openproject/...`).
   */
  resolveHref(href: string): string {
    const trimmed = href.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    const base = this.sanitizeUrl();
    let origin = base;
    let basePath = '';
    try {
      const parsed = new URL(base);
      origin = parsed.origin;
      basePath = parsed.pathname.replace(/\/+$/, '');
    } catch {
      // Keep the raw base when it cannot be parsed
    }
    if (trimmed.startsWith('/')) {
      if (basePath && (trimmed === basePath || trimmed.startsWith(`${basePath}/`))) {
        return `${origin}${trimmed}`;
      }
      return `${base}${trimmed}`;
    }
    return `${base}/${trimmed}`;
  }

  /**
   * True when an image source points to an OpenProject attachment / asset that needs authentication.
   */
  isOpenProjectImageSource(src: string): boolean {
    if (!src || /^(data|blob):/i.test(src)) return false;
    if (/\/attachments\/\d+/i.test(src) || !/^https?:\/\//i.test(src)) return true;
    try {
      return src.startsWith(new URL(this.sanitizeUrl()).origin);
    } catch {
      return false;
    }
  }

  /**
   * Downloads an OpenProject image with the API token and returns a cached object URL usable in `<img src>`.
   */
  getAttachmentImageUrl(href: string): Promise<string> {
    const cacheKey = this.attachmentCacheKey(href);
    const cached = this.inlineImageCache.get(cacheKey);
    if (cached) return cached;
    const pending = this.fetchAttachmentContent(this.resolveHref(href))
      .then((url) => toObjectUrl(url))
      .catch((err) => {
        this.inlineImageCache.delete(cacheKey);
        throw err;
      });
    this.inlineImageCache.set(cacheKey, pending);
    return pending;
  }

  /**
   * Registers a local object URL for an attachment (e.g. right after uploading it) to avoid re-downloading it.
   */
  cacheAttachmentImageUrl(href: string, objectUrl: string): void {
    this.inlineImageCache.set(this.attachmentCacheKey(href), Promise.resolve(objectUrl));
  }

  private attachmentCacheKey(href: string): string {
    const match = /\/attachments\/(\d+)/i.exec(href);
    return match ? `attachment:${match[1]}` : href;
  }

  /**
   * Replaces OpenProject attachment image sources inside rendered HTML with authenticated
   * data/blob URLs so they can be displayed inside the app (the webview cannot send the token).
   */
  async resolveInlineAttachmentImages(html: string | null | undefined): Promise<string> {
    if (!html || typeof DOMParser === 'undefined') return html || '';
    const doc = new DOMParser().parseFromString(`<div id="op-root">${html}</div>`, 'text/html');
    const root = doc.getElementById('op-root');
    if (!root) return html;

    const images = Array.from(root.querySelectorAll('img'));
    if (images.length === 0) return html;

    await Promise.all(
      images.map(async (img) => {
        const src = img.getAttribute('src') || '';
        if (!this.isOpenProjectImageSource(src)) return;
        try {
          img.setAttribute('src', await this.getAttachmentImageUrl(src));
          img.setAttribute('data-op-src', src);
          img.setAttribute('loading', 'lazy');
        } catch (err) {
          img.setAttribute('data-op-broken', 'true');
          console.warn('Could not load inline image:', src, err);
        }
      })
    );

    return root.innerHTML;
  }

  /**
   * Uploads a file as an attachment of the given work package and returns its metadata.
   */
  async uploadWorkPackageAttachment(
    ticket: string,
    file: File
  ): Promise<{ ok: boolean; attachment?: UploadedAttachment; error?: string }> {
    const rawTicket = ticket.trim().replace(/^#/, '');
    if (!rawTicket) return { ok: false, error: 'No ticket ID' };
    const token = this.getToken();
    if (!token) return { ok: false, error: 'No token' };
    const url = this.sanitizeUrl();
    const fileName = file.name || `image-${Date.now()}.png`;
    const contentType = file.type || 'application/octet-stream';

    if (this.isTauriApp()) {
      try {
        const dataBase64 = await fileToBase64(file);
        const attachment = await invoke<UploadedAttachment>('upload_work_package_attachment', {
          url,
          token,
          ticket: rawTicket,
          fileName,
          contentType,
          dataBase64,
        });
        return { ok: true, attachment };
      } catch (err: unknown) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }

    try {
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify({ fileName })], { type: 'application/json' }));
      form.append('file', file, fileName);
      const res = await fetch(`${url}/api/v3/work_packages/${rawTicket}/attachments`, {
        method: 'POST',
        headers: { Authorization: this.buildAuthHeaders(token)['Authorization'] },
        body: form,
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        return { ok: false, error: errJson?.message || `HTTP ${res.status}` };
      }
      const data: any = await res.json();
      return {
        ok: true,
        attachment: {
          id: String(data.id ?? ''),
          fileName: data.fileName || fileName,
          contentType: data.contentType || contentType,
          downloadUrl: data._links?.downloadLocation?.href || '',
        },
      };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
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

    if (this.isTauriApp()) {
      try {
        const res = await invoke<BoardOption[]>('fetch_project_boards', {
          url,
          token,
          projectId,
          projectIdentifier: projectIdentifier || null,
        });
        if (res && res.length) {
          this.boardsCache.set(projectId, res);
          return res;
        }
      } catch (err) {
        console.warn('Could not fetch project boards via Tauri:', err);
      }
    }

    try {
      const res = await fetch(`${url}/api/v3/grids`, {
        headers: this.buildAuthHeaders(token),
      });
      if (!res.ok) return [];
      const data = await res.json();
      if (!data?._embedded?.elements) return [];

      const boards: BoardOption[] = data._embedded.elements
        .filter((g: Record<string, unknown>) => {
          const links = g['_links'] as Record<string, { href?: string; title?: string }> | undefined;
          const scope = links?.['scope']?.href ?? links?.['page']?.href ?? '';
          const isBoard =
            scope.endsWith('/boards') ||
            (Array.isArray((g as any).widgets) &&
              (g as any).widgets.some((w: any) => w.identifier === 'work_package_query'));
          const isSubtaskView = (g as any).options?.attribute === 'subtasks';
          if (!isBoard || isSubtaskView) return false;

          const projHref = links?.['project']?.href ?? '';
          const projId = projHref.split('/').pop() || '';
          const pid = String(projectId).trim();
          const matchesProject =
            projId === pid ||
            projHref.endsWith(`/${pid}`) ||
            scope.includes(`/${pid}/`) ||
            Boolean(projectIdentifier && scope.includes(`/${projectIdentifier}/`));

          return matchesProject;
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

  async getBoardColumns(gridId: string, forceRefresh = false): Promise<BoardColumnOption[]> {
    if (!gridId) return [];
    if (forceRefresh) {
      this.boardColumnsCache.delete(gridId);
    } else if (this.boardColumnsCache.has(gridId)) {
      return this.boardColumnsCache.get(gridId)!;
    }

    const token = this.getToken();
    if (!token) return [];
    const url = this.sanitizeUrl();

    if (this.isTauriApp()) {
      try {
        const res = await invoke<BoardColumnOption[]>('fetch_board_columns', {
          url,
          token,
          gridId,
        });
        if (res && res.length) {
          this.boardColumnsCache.set(gridId, res);
          return res;
        }
      } catch (err) {
        console.warn('Could not fetch board columns via Tauri:', err);
      }
    }

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
            const elements: Array<Record<string, any>> = qData._embedded?.results?._embedded?.elements ?? [];
            const workPackages: BoardWorkPackageCard[] = elements.map((el) => ({
              id: Number(el['id']),
              subject: String(el['subject'] || ''),
              typeName: el['_links']?.['type']?.['title'] || undefined,
              typeColor: el['_embedded']?.['type']?.['color'] || undefined,
              statusId: el['_links']?.['status']?.['href']?.split('/').pop() || undefined,
              statusName: el['_links']?.['status']?.['title'] || undefined,
              statusColor: el['_embedded']?.['status']?.['color'] || undefined,
              priorityName: el['_links']?.['priority']?.['title'] || undefined,
              assigneeName: el['_links']?.['assignee']?.['title'] || undefined,
              projectName: el['_links']?.['project']?.['title'] || undefined,
              startDate: el['startDate'] ?? null,
              dueDate: el['dueDate'] ?? null,
              lockVersion: typeof el['lockVersion'] === 'number' ? el['lockVersion'] : undefined,
            }));

            let statusId: string | undefined;
            let statusName: string | undefined;
            if (Array.isArray(qData.filters)) {
              const statusFilter = qData.filters.find((f: any) => {
                const href = f?._links?.filter?.href || '';
                const name = (f?.name || '').toLowerCase();
                return href.endsWith('/status') || href.endsWith('/status_id') || name === 'status' || name === 'estado';
              });
              if (statusFilter) {
                const valObj = statusFilter?._links?.values?.[0];
                if (valObj?.href) {
                  statusId = valObj.href.split('/').pop();
                  statusName = valObj.title;
                } else if (Array.isArray(statusFilter.values) && statusFilter.values.length > 0) {
                  const firstVal = statusFilter.values[0];
                  statusId = typeof firstVal === 'object' ? firstVal.id || firstVal.href?.split('/').pop() : String(firstVal);
                }
              }
            }

            return {
              queryId,
              name: qData.name ?? `Columna ${queryId}`,
              widgetId: widget.id,
              startColumn: widget.startColumn,
              workPackageIds: elements.map((e) => Number(e['id'])),
              workPackages,
              statusId,
              statusName,
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

    const results: Array<BoardLocation | null> = await Promise.all(
      boards.map(async (board): Promise<BoardLocation | null> => {
        const columns = await this.getBoardColumns(board.id);
        const col = columns.find((c) => c.workPackageIds.includes(ticketNum));
        if (!col) return null;
        return {
          boardId: board.id,
          boardName: board.name,
          boardColumnQueryId: col.queryId,
          boardColumnName: col.name,
          statusId: col.statusId,
          statusName: col.statusName,
        };
      })
    );

    return results.find((r): r is BoardLocation => r !== null) ?? null;
  }

  async moveWorkPackageToBoardColumn(
    ticket: string,
    targetQueryId: string,
    sourceQueryId?: string,
    targetStatusId?: string,
    dropPosition?: BoardColumnDropPosition,
    expectedLockVersion?: number
  ): Promise<{ ok: boolean; statusId?: string; error?: string; conflict?: boolean }> {
    const rawTicket = ticket.trim().replace(/^#/, '');
    const ticketNum = parseInt(rawTicket, 10);
    if (isNaN(ticketNum)) return { ok: false, error: 'Invalid ticket ID' };
    const token = this.getToken();
    if (!token) return { ok: false, error: 'No token' };
    const url = this.sanitizeUrl();

    if (this.isTauriApp()) {
      try {
        const res = await invoke<{ ok: boolean; statusId?: string; error?: string }>(
          'move_work_package_to_board_column',
          {
            url,
            token,
            ticket: rawTicket,
            targetQueryId,
            sourceQueryId: sourceQueryId || null,
            targetStatusId: targetStatusId || null,
            targetPositionIndex: dropPosition?.targetIndex ?? null,
            targetTicketIds: dropPosition?.targetTicketIds ?? null,
            expectedLockVersion: expectedLockVersion ?? null,
          }
        );

        if (res.ok) {
          this.boardColumnsCache.forEach((cols, gridId) => {
            if (cols.some((c) => c.queryId === targetQueryId || c.queryId === sourceQueryId)) {
              this.boardColumnsCache.delete(gridId);
            }
          });
        }
        return res.ok ? res : { ...res, conflict: isWorkPackageConflict(res.error || '') };
      } catch (err: any) {
        const error = err instanceof Error ? err.message : String(err);
        return { ok: false, error, conflict: isWorkPackageConflict(error) };
      }
    }

    const headers = this.buildAuthHeaders(token);

    try {
      const workPackageEndpoint = `${url}/api/v3/work_packages/${rawTicket}`;
      const snapshotResponse = await fetch(workPackageEndpoint, { headers });
      if (!snapshotResponse.ok) return { ok: false, error: `HTTP ${snapshotResponse.status}` };
      const snapshot = await snapshotResponse.json();
      const currentLockVersion = Number(snapshot.lockVersion);
      if (
        expectedLockVersion !== undefined &&
        Number.isFinite(currentLockVersion) &&
        currentLockVersion !== expectedLockVersion
      ) {
        return {
          ok: false,
          conflict: true,
          error: 'The ticket changed in OpenProject. Refresh it before moving the card.',
        };
      }
      const patchLockVersion = expectedLockVersion ?? currentLockVersion;

      // 1. Resolve target status if not explicitly passed
      let effectiveStatusId = targetStatusId;
      if (!effectiveStatusId) {
        for (const cols of this.boardColumnsCache.values()) {
          const matched = cols.find((c) => c.queryId === targetQueryId);
          if (matched?.statusId) {
            effectiveStatusId = matched.statusId;
            break;
          }
        }
      }

      // 2. If it is an action board for status, update the ticket status in OpenProject
      let statusWasUpdated = false;
      if (effectiveStatusId && sourceQueryId !== targetQueryId) {
        const statusRes = await this.updateWorkPackageStatus(rawTicket, effectiveStatusId, patchLockVersion);
        if (!statusRes.ok) {
          return { ok: false, error: statusRes.error || 'Could not update work package status.' };
        }
        statusWasUpdated = true;
      }

      // 3. Remove order from source query if distinct (-1 tells OpenProject to remove_order)
      if (sourceQueryId && sourceQueryId !== targetQueryId) {
        await fetch(`${url}/api/v3/queries/${sourceQueryId}/order`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ delta: { [String(ticketNum)]: -1 } }),
        }).catch((err) => console.warn('Could not remove previous order:', err));
      }

      // 4. Persist the requested drop position, or keep the legacy first-position behavior.
      let orderMap: Record<string, number> = {};
      try {
        const orderRes = await fetch(`${url}/api/v3/queries/${targetQueryId}/order`, {
          method: 'GET',
          headers,
        });
        if (!orderRes.ok) {
          if (dropPosition) {
            const error = await orderRes.text();
            return { ok: false, error: error || `HTTP ${orderRes.status}` };
          }
        } else {
          orderMap = await orderRes.json();
        }
      } catch (error) {
        if (dropPosition) {
          return { ok: false, error: error instanceof Error ? error.message : String(error) };
        }
        console.warn('Could not check existing query order:', error);
      }

      const orderDelta = buildQueryOrderDelta(ticketNum, orderMap, dropPosition);
      const putRes = await fetch(`${url}/api/v3/queries/${targetQueryId}/order`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ delta: orderDelta }),
      });

      if (!putRes.ok) {
        if (!statusWasUpdated) {
          const errData = await putRes.json().catch(() => null);
          return { ok: false, error: errData?.message || `HTTP ${putRes.status}` };
        }
      }

      // 5. Invalidate column cache for affected grids
      this.boardColumnsCache.forEach((cols, gridId) => {
        if (cols.some((c) => c.queryId === targetQueryId || c.queryId === sourceQueryId)) {
          this.boardColumnsCache.delete(gridId);
        }
      });

      return { ok: true, statusId: effectiveStatusId };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // ──────────────────────────────────────────────
  // Work Package Form, Update, Comments & Time Entries
  // ──────────────────────────────────────────────

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
    const token = this.getToken();
    if (!token) return empty;
    const url = this.sanitizeUrl();
    let availableAssignees: WorkPackageOptionItem[] = [];
    let availableResponsibles: WorkPackageOptionItem[] = [];

    if (this.isTauriApp()) {
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
      const headers = this.buildAuthHeaders(token);
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
    const token = this.getToken();
    if (!token) return { ok: false, error: 'No token' };
    const url = this.sanitizeUrl();

    if (this.isTauriApp()) {
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
      const headers = this.buildAuthHeaders(token);
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
    const token = this.getToken();
    if (!token) return { ok: false, error: 'No token' };
    const url = this.sanitizeUrl();

    if (this.isTauriApp()) {
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
        headers: this.buildAuthHeaders(token),
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

  async getCurrentUserId(): Promise<string | null> {
    const token = this.getToken();
    if (!token) return null;
    const url = this.sanitizeUrl();

    if (this.isTauriApp()) {
      try {
        return await invoke<string>('fetch_current_user_id', { url, token });
      } catch {
        return null;
      }
    }

    try {
      const response = await fetch(`${url}/api/v3/users/me`, {
        headers: this.buildAuthHeaders(token),
      });
      if (!response.ok) return null;
      const user = await response.json();
      return user?.id !== undefined ? String(user.id) : null;
    } catch {
      return null;
    }
  }

  async updateTimeEntry(
    entryId: string,
    payload: { hours: string; spentOn: string; comment: string; activityId?: string | null }
  ): Promise<{ ok: boolean; error?: string }> {
    const rawEntryId = entryId.trim();
    const token = this.getToken();
    if (!rawEntryId || !token) return { ok: false, error: 'Time entry or OpenProject token is missing.' };
    const url = this.sanitizeUrl();

    if (this.isTauriApp()) {
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
        headers: this.buildAuthHeaders(token),
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

  async getWorkPackageCostSummary(ticket: string): Promise<WorkPackageCostSummary> {
    const rawTicket = ticket.trim().replace(/^#/, '');
    const token = this.getToken();
    const empty: WorkPackageCostSummary = { laborCosts: null, materialCosts: null, overallCosts: null };
    if (!rawTicket || !token) return empty;
    const url = this.sanitizeUrl();

    if (this.isTauriApp()) {
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
        headers: this.buildAuthHeaders(token),
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

  getCostReportUrl(ticket: string, projectIdentifier: string): string {
    const query = new URLSearchParams({
      'fields[]': 'WorkPackageId',
      'operators[WorkPackageId]': '=_child_work_packages',
      'values[WorkPackageId]': ticket.trim().replace(/^#/, ''),
      set_filter: '1',
    });
    return `${this.sanitizeUrl()}/projects/${encodeURIComponent(projectIdentifier)}/cost_reports?${query.toString()}`;
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
    const token = this.getToken();
    if (!token) return [];
    const url = this.sanitizeUrl();
    const queryFilter: TimeCostReportFilter = { ...filter };
    if (queryFilter.ticketId) queryFilter.ticketId = queryFilter.ticketId.trim().replace(/^#/, '');

    if (this.isTauriApp()) {
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
      const headers = this.buildAuthHeaders(token);
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

function isWorkPackageConflict(message: string): boolean {
  return /http 409|lock.?version|concurrent|changed since|conflict/i.test(message);
}

function buildQueryOrderDelta(
  ticketId: number,
  orderMap: Record<string, number>,
  dropPosition?: BoardColumnDropPosition
): Record<string, number> {
  const orderGap = 8192;
  const orderedEntry = Object.entries(orderMap)
    .map(([id, value]) => ({ id: Number(id), position: Number(value) }))
    .filter((entry) => Number.isSafeInteger(entry.id) && entry.id !== ticketId && Number.isFinite(entry.position))
    .sort((first, second) => first.position - second.position || first.id - second.id);

  if (!dropPosition) {
    const firstPosition = orderedEntry[0]?.position;
    return { [String(ticketId)]: firstPosition === undefined ? 0 : firstPosition - orderGap };
  }

  const targetTicketIds = [...new Set(dropPosition.targetTicketIds)]
    .filter((id) => Number.isSafeInteger(id) && id > 0 && id !== ticketId);
  const targetIndex = Math.max(0, Math.min(dropPosition.targetIndex, targetTicketIds.length));
  const previousTicketId = targetTicketIds[targetIndex - 1];
  const nextTicketId = targetTicketIds[targetIndex];
  const positionById = new Map(orderedEntry.map((entry) => [entry.id, entry.position]));
  const orderedTicketIds = orderedEntry.map((entry) => entry.id);

  for (let index = 0; index < targetTicketIds.length; index += 1) {
    const targetTicketId = targetTicketIds[index];
    if (orderedTicketIds.includes(targetTicketId)) continue;

    const nextKnownId = targetTicketIds.slice(index + 1).find((id) => orderedTicketIds.includes(id));
    if (nextKnownId !== undefined) {
      orderedTicketIds.splice(orderedTicketIds.indexOf(nextKnownId), 0, targetTicketId);
      continue;
    }

    const previousKnownId = targetTicketIds
      .slice(0, index)
      .reverse()
      .find((id) => orderedTicketIds.includes(id));
    if (previousKnownId !== undefined) {
      orderedTicketIds.splice(orderedTicketIds.indexOf(previousKnownId) + 1, 0, targetTicketId);
      continue;
    }

    orderedTicketIds.splice(Math.min(index, orderedTicketIds.length), 0, targetTicketId);
  }

  const nextIndex = nextTicketId === undefined ? -1 : orderedTicketIds.indexOf(nextTicketId);
  const previousIndex = previousTicketId === undefined ? -1 : orderedTicketIds.indexOf(previousTicketId);
  const insertionIndex = nextIndex >= 0
    ? nextIndex
    : previousIndex >= 0
      ? previousIndex + 1
      : Math.min(targetIndex, orderedTicketIds.length);
  const previousPosition = insertionIndex > 0 ? positionById.get(orderedTicketIds[insertionIndex - 1]) : undefined;
  const nextPosition = insertionIndex < orderedTicketIds.length
    ? positionById.get(orderedTicketIds[insertionIndex])
    : undefined;

  if (previousPosition !== undefined && nextPosition !== undefined && nextPosition - previousPosition > 1) {
    return { [String(ticketId)]: previousPosition + Math.floor((nextPosition - previousPosition) / 2) };
  }
  if (previousPosition !== undefined && insertionIndex === orderedTicketIds.length) {
    return { [String(ticketId)]: previousPosition + orderGap };
  }
  if (nextPosition !== undefined && insertionIndex === 0) {
    return { [String(ticketId)]: nextPosition - orderGap };
  }
  if (orderedTicketIds.length === 0) {
    return { [String(ticketId)]: 0 };
  }

  orderedTicketIds.splice(insertionIndex, 0, ticketId);
  return Object.fromEntries(orderedTicketIds.map((id, index) => [String(id), index * orderGap]));
}

function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

async function toObjectUrl(url: string): Promise<string> {
  if (!url.startsWith('data:')) return url;
  const blob = await (await fetch(url)).blob();
  return URL.createObjectURL(blob);
}
