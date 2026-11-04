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
