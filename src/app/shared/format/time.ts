export function formatTimeMinutes(totalMinutes: number, format: 'HH:MM' | 'decimal' = 'HH:MM'): string {
  if (totalMinutes < 0) totalMinutes = 0;

  if (format === 'decimal') {
    const hours = (totalMinutes / 60).toFixed(2);
    return `${hours}h`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.floor(totalMinutes % 60);
  const h = String(hours).padStart(2, '0');
  const m = String(minutes).padStart(2, '0');
  return `${h}h:${m}m`;
}

export function formatTimeSeconds(totalSeconds: number): string {
  if (totalSeconds < 0) totalSeconds = 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const h = String(hours).padStart(2, '0');
  const m = String(minutes).padStart(2, '0');
  const s = String(seconds).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export function calculateEstimatedExit(entryTime: string, targetMinutes: number, lunchMinutes: number): string {
  if (!entryTime) return '--:--';
  const [entryH, entryM] = entryTime.split(':').map((n) => parseInt(n, 10) || 0);
  const totalMins = entryH * 60 + entryM + targetMinutes + lunchMinutes;

  const exitH = Math.floor(totalMins / 60) % 24;
  const exitM = totalMins % 60;
  return `${String(exitH).padStart(2, '0')}:${String(exitM).padStart(2, '0')}`;
}

/**
 * Formats an ISO 8601 duration (e.g. 'P3DT8H', 'PT1H30M', 'P1D', 'PT45M') into a readable string (e.g. '3d 8h', '1h 30m', '1d').
 */
export function formatIsoDuration(iso?: string | null): string {
  if (!iso || !iso.trim()) return '-';
  const clean = iso.trim();

  // If already a plain number (e.g., "8" or "8.5")
  if (/^\d+(?:\.\d+)?$/.test(clean)) {
    return `${clean}h`;
  }

  // ISO 8601 duration regex: P[nY][nM][nW][nD][T[nH][nM][nS]]
  const isoRegex = /^P(?:(\d+(?:\.\d+)?)Y)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i;
  const match = clean.match(isoRegex);
  if (!match) return clean;

  const years = match[1] ? `${match[1]}y` : '';
  const months = match[2] ? `${match[2]}mo` : '';
  const weeks = match[3] ? `${match[3]}w` : '';
  const days = match[4] ? `${match[4]}d` : '';
  const hours = match[5] ? `${match[5]}h` : '';
  const minutes = match[6] ? `${match[6]}m` : '';
  const seconds = match[7] ? `${match[7]}s` : '';

  const parts = [years, months, weeks, days, hours, minutes, seconds].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : '0h';
}
