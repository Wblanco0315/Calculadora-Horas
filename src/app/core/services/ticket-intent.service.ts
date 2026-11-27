import { Injectable, signal } from '@angular/core';

/**
 * Work the AI prepared for a ticket that the **user** must finish in the ticket detail:
 * - a comment draft (shown preloaded in the editor; only the user's "Send" posts it);
 * - an attachment upload request (opens the Attachments tab with the upload button highlighted).
 * Also signals tickets changed by the MCP so an open ticket detail reloads.
 * Kept in memory only (drafts never travel in the URL).
 */
@Injectable({ providedIn: 'root' })
export class TicketIntentService {
  private readonly drafts = signal<ReadonlyMap<number, string>>(new Map());
  readonly uploadRequest = signal<number | null>(null);
  /** Last ticket updated through the MCP, with a counter so repeated updates still notify. */
  readonly ticketUpdate = signal<{ ticket: number; seq: number } | null>(null);

  setCommentDraft(ticket: number, text: string): void {
    this.drafts.update((drafts) => new Map(drafts).set(ticket, text));
  }

  /** Reads (reactively) the pending draft of a ticket. */
  commentDraft(ticket: number): string | null {
    return this.drafts().get(ticket) ?? null;
  }

  clearCommentDraft(ticket: number): void {
    if (!this.drafts().has(ticket)) return;
    this.drafts.update((drafts) => {
      const next = new Map(drafts);
      next.delete(ticket);
      return next;
    });
  }

  requestUpload(ticket: number): void {
    this.uploadRequest.set(ticket);
  }

  clearUploadRequest(): void {
    this.uploadRequest.set(null);
  }

  notifyTicketUpdated(ticket: number): void {
    this.ticketUpdate.update((last) => ({ ticket, seq: (last?.seq ?? 0) + 1 }));
  }
}
