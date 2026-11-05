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
