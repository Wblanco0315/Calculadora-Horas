/**
 * Local data retention. Activities stored on this device are kept for this many months; older
 * activities that are already in OpenProject are deleted, and older dates are read from the
 * OpenProject time entries instead. The overview statistics cache uses the same window.
 */
export const LOCAL_RETENTION_MONTHS = 3;

/** Local `YYYY-MM-DD` of a date. */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** First local date kept on this device (same day, `LOCAL_RETENTION_MONTHS` months ago). */
export function localRetentionStart(today: Date = new Date()): Date {
  const target = new Date(today.getFullYear(), today.getMonth() - LOCAL_RETENTION_MONTHS, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(today.getDate(), lastDay));
}

/** Whether a `YYYY-MM-DD` date is older than the local retention window. */
export function isBeforeLocalRetention(date: string, today: Date = new Date()): boolean {
  return date < toDateKey(localRetentionStart(today));
}
