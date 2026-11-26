import { Injectable, inject } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import {
  UploadedAttachment,
} from '../../interfaces/openproject.interface';
import { OpenprojectService } from './openproject.service';

/** Work package attachments: download, content, inline images and uploads. */
@Injectable({ providedIn: 'root' })
export class AttachmentApiService {
  private readonly openprojectService = inject(OpenprojectService);

  private readonly inlineImageCache = new Map<string, Promise<string>>();

  /**
   * Fetches content of an attachment using authenticated HTTP headers and returns a data URL
   */
  /**
   * Downloads an attachment. On desktop it is saved to the Downloads folder and the saved path is
   * returned; on the web the browser download is triggered and `null` is returned.
   */
  async downloadAttachment(downloadUrl: string, fileName: string): Promise<string | null> {
    const token = this.openprojectService.getToken();
    const url = this.openprojectService.sanitizeUrl();

    if (this.openprojectService.isTauriApp()) {
      return invoke<string>('download_work_package_attachment', {
        url,
        token,
        downloadUrl,
        fileName,
      });
    }

    const res = await fetch(this.openprojectService.resolveHref(downloadUrl), {
      headers: { Authorization: this.openprojectService.buildAuthHeaders(token)['Authorization'] },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const objectUrl = URL.createObjectURL(await res.blob());
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
    return null;
  }

  async fetchAttachmentContent(downloadUrl: string): Promise<string> {
    const token = this.openprojectService.getToken();
    const url = this.openprojectService.sanitizeUrl();

    if (this.openprojectService.isTauriApp()) {
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
    const fullUrl = this.openprojectService.resolveHref(downloadUrl);
    const res = await fetch(fullUrl, {
      headers: {
        Authorization: this.openprojectService.buildAuthHeaders(token)['Authorization'],
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }

  /**
   * True when an image source points to an OpenProject attachment / asset that needs authentication.
   */
  isOpenProjectImageSource(src: string): boolean {
    if (!src || /^(data|blob):/i.test(src)) return false;
    if (/\/attachments\/\d+/i.test(src) || !/^https?:\/\//i.test(src)) return true;
    try {
      return src.startsWith(new URL(this.openprojectService.sanitizeUrl()).origin);
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
    const pending = this.fetchAttachmentContent(this.openprojectService.resolveHref(href))
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
    const token = this.openprojectService.getToken();
    if (!token) return { ok: false, error: 'No token' };
    const url = this.openprojectService.sanitizeUrl();
    const fileName = file.name || `image-${Date.now()}.png`;
    const contentType = file.type || 'application/octet-stream';

    if (this.openprojectService.isTauriApp()) {
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
        headers: { Authorization: this.openprojectService.buildAuthHeaders(token)['Authorization'] },
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
