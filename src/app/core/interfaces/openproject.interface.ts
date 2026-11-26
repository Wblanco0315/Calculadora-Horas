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
  /** OpenProject board kind: `free` (basic) or `action`. */
  kind?: string | null;
  /** Attribute an action board is based on (`status`, `assignee`, `version`, `subproject`). */
  attribute?: string | null;
  createdAt?: string | null;
}

export interface BoardWorkPackageCard {
  id: number;
  subject: string;
  typeName?: string;
  typeColor?: string;
  statusId?: string;
  statusName?: string;
  statusColor?: string;
  priorityName?: string;
  assigneeName?: string;
  projectName?: string;
  startDate?: string | null;
  dueDate?: string | null;
  lockVersion?: number;
}

export interface BoardColumnOption {
  queryId: string;
  name: string;
  widgetId: number;
  startColumn: number;
  workPackageIds: number[];
  workPackages?: BoardWorkPackageCard[];
  statusId?: string;
  statusName?: string;
}

export interface BoardColumnDropPosition {
  targetIndex: number;
  targetTicketIds: number[];
}

export interface WorkPackageOptionItem {
  id: string;
  name: string;
  color?: string;
}

export interface WorkPackageFormSchema {
  statuses: WorkPackageOptionItem[];
  priorities: WorkPackageOptionItem[];
  assignees: WorkPackageOptionItem[];
  responsibles: WorkPackageOptionItem[];
  versions: WorkPackageOptionItem[];
}

export interface WorkPackageRevision {
  id: string;
  lockVersion: number;
  updatedAt?: string;
}

export interface WorkPackageCostSummary {
  laborCosts?: string | null;
  materialCosts?: string | null;
  overallCosts?: string | null;
}

export interface TimeCostReportFilter {
  ticketId?: string;
  projectId?: string;
  userId?: string;
  activityId?: string;
  spentOnFrom?: string;
  spentOnTo?: string;
  includeDescendants?: boolean;
}

export type TimeCostReportGroup = 'none' | 'spentOn' | 'user' | 'activity' | 'project' | 'workPackage';

export interface UpdateWorkPackagePayload {
  lockVersion?: number;
  subject?: string;
  descriptionRaw?: string;
  startDate?: string | null;
  clearStartDate?: boolean;
  dueDate?: string | null;
  clearDueDate?: boolean;
  estimatedTime?: string;
  statusId?: string;
  priorityId?: string;
  assigneeId?: string | null;
  clearAssignee?: boolean;
  responsibleId?: string | null;
  clearResponsible?: boolean;
  versionId?: string | null;
  clearVersion?: boolean;
}

export interface PlatformTimeEntry {
  id: string;
  hours: string;
  spentOn: string;
  startTime?: string | null;
  comment: string;
  userId?: string | null;
  userName: string;
  activityName: string;
  activityId?: string | null;
  projectName?: string | null;
  workPackageName?: string | null;
  registeredByName?: string | null;
  costs?: string | number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface BoardLocation {
  boardId: string;
  boardName: string;
  boardColumnQueryId: string;
  boardColumnName: string;
  statusId?: string;
  statusName?: string;
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

export interface TicketActivityDetail {
  raw: string;
  html: string;
}

export interface TicketComment {
  id: string;
  commentRaw: string;
  commentHtml: string;
  createdAt: string;
  userName: string;
  details?: TicketActivityDetail[];
  // Resilient fallback properties for snake_case IPC
  comment_raw?: string;
  comment_html?: string;
  created_at?: string;
  user_name?: string;
}

export interface UploadedAttachment {
  id: string;
  fileName: string;
  contentType: string;
  downloadUrl: string;
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
  // Resilient fallback properties for snake_case IPC
  file_name?: string;
  file_size?: number;
  content_type?: string;
  download_url?: string;
  is_image?: boolean;
  author_name?: string;
  created_at?: string;
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
  typeName?: string | null;
  type_name?: string | null;
  authorName?: string | null;
  author_name?: string | null;
  createdAt?: string | null;
  created_at?: string | null;
  updatedAt?: string | null;
  updated_at?: string | null;
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

/** Work package match from a typeahead search (subject or ID). */
export interface WorkPackageSearchItem {
  id: number;
  subject: string;
  projectId?: string | null;
  projectName?: string | null;
  typeName?: string | null;
  statusName?: string | null;
}
