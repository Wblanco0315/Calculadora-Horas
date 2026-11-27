import { Activity } from '../interfaces/activity.interface';

export type ActivitySort = 'none' | 'time-desc' | 'time-asc';
export type ActivityStatusFilter = 'all' | 'synced' | 'unsynced';

export interface ActivityFilterCriteria {
  query: string;
  projectId: string;
  status: ActivityStatusFilter;
  sort: ActivitySort;
}

/** Filters local activities by text (name, ticket, ticket title), project and sync status, then sorts them by time. */
export function filterActivities(activities: Activity[], criteria: ActivityFilterCriteria): Activity[] {
  let list = activities;

  const query = criteria.query.trim().toLowerCase();
  if (query) {
    list = list.filter(
      (activity) =>
        activity.name.toLowerCase().includes(query) ||
        (activity.ticket?.toLowerCase().includes(query) ?? false) ||
        (activity.ticketTitle?.toLowerCase().includes(query) ?? false)
    );
  }

  if (criteria.projectId) {
    list = list.filter((activity) => activity.projectId === criteria.projectId);
  }

  if (criteria.status === 'synced') {
    list = list.filter((activity) => activity.synced);
  } else if (criteria.status === 'unsynced') {
    list = list.filter((activity) => !activity.synced);
  }

  if (criteria.sort === 'time-desc') {
    list = [...list].sort((a, b) => (b.minutes || 0) - (a.minutes || 0));
  } else if (criteria.sort === 'time-asc') {
    list = [...list].sort((a, b) => (a.minutes || 0) - (b.minutes || 0));
  }

  return list;
}

export function hasActiveActivityFilters(criteria: ActivityFilterCriteria): boolean {
  return !!criteria.projectId || criteria.sort !== 'none' || criteria.status !== 'all' || !!criteria.query.trim();
}
