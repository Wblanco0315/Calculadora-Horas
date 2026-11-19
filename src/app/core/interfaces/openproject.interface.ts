export interface Project {
  id: string;
  name: string;
  identifier?: string;
}

export interface StatusOption {
  id: string;
  name: string;
  color?: string;
}

export interface VersionOption {
  id: string;
  name: string;
  status?: string;
}

export interface BoardOption {
  id: string;
  name: string;
}

export interface BoardColumnOption {
  queryId: string;
  name: string;
  widgetId: number;
  startColumn: number;
  workPackageIds: number[];
}

export interface BoardLocation {
  boardId: string;
  boardName: string;
  boardColumnQueryId: string;
  boardColumnName: string;
}

export interface TimeEntryActivityType {
  id: string;
  name: string;
}

export interface TicketDescription {
  raw?: string | null;
  html?: string | null;
  format?: string | null;
}

export interface TicketComment {
  id: string;
  commentRaw: string;
  commentHtml: string;
  createdAt: string;
  userName: string;
}

export interface TicketAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  downloadUrl: string;
  isImage: boolean;
  createdAt?: string;
  authorName?: string;
  dataUrl?: string;
  isLoading?: boolean;
}

export interface TicketContextOptions {
  includeDescription?: boolean;
  includeComments?: boolean;
  includeAttachments?: boolean;
}

export interface TicketContextResult {
  success: boolean;
  ticket: string;
  subject?: string | null;
  description?: TicketDescription | null;
  comments?: TicketComment[] | null;
  attachments?: TicketAttachment[] | null;
  project_id?: string | null;
  project_name?: string | null;
  status_id?: string | null;
  status_name?: string | null;
  status_color?: string | null;
  version_id?: string | null;
  version_name?: string | null;
  priority_name?: string | null;
  assignee_name?: string | null;
  responsible_name?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  estimated_time?: string | null;
  spent_time?: string | null;
  lock_version?: number | null;
  available_statuses?: StatusOption[] | null;
  message: string;
}

export interface TicketInfoResult {
  success: boolean;
  subject?: string | null;
  project_id?: string | null;
  project_name?: string | null;
  status_id?: string | null;
  status_name?: string | null;
  status_color?: string | null;
  version_id?: string | null;
  version_name?: string | null;
  lock_version?: number | null;
  available_statuses?: StatusOption[] | null;
  message: string;
}

export interface CreateTimeEntryParams {
  ticket: string;
  minutes: number;
  date: string; // YYYY-MM-DD
  comment: string;
  activityTypeId?: string;
  projectId?: string;
}
