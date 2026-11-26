import { Injectable, signal } from '@angular/core';

export interface BreadcrumbTicket {
  id: number;
  subject: string;
}

/** Shares page data the dashboard breadcrumb cannot read from the URL (e.g. the open ticket's subject). */
@Injectable({ providedIn: 'root' })
export class BreadcrumbService {
  readonly ticket = signal<BreadcrumbTicket | null>(null);

  /** Breadcrumb label for a ticket: `#id subject` when the subject is known. */
  ticketLabel(ticketId: string): string {
    const ticket = this.ticket();
    return ticket && String(ticket.id) === ticketId && ticket.subject ? `#${ticketId} ${ticket.subject}` : `#${ticketId}`;
  }
}
