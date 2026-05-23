export function formatTime(totalMins: number) {
  if (totalMins <= 0) return "00h:00m";
  const hours = Math.floor(totalMins / 60);
  const minutes = totalMins % 60;

  const h = hours.toString().padStart(2, "0");
  const m = minutes.toString().padStart(2, "0");

  return `${h}h:${m}m`;
}

export function formatTimeSeconds(totalSecs: number) {
  if (totalSecs <= 0) return "00h:00m";
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;

  const h = hours.toString().padStart(2, "0");
  const m = minutes.toString().padStart(2, "0");
  const s = seconds.toString().padStart(2, "0");

  if (seconds === 0) {
    return `${h}h:${m}m`;
  }
  return `${h}h:${m}m:${s}s`;
}

export function formatDecimal(totalMinutes: number) {
  return parseFloat((totalMinutes / 60).toFixed(2));
}

export function formatDecimalSeconds(totalSeconds: number) {
  return parseFloat((totalSeconds / 3600).toFixed(2));
}
