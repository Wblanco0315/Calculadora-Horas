export function formatTime(totalMins: number) {
  if (totalMins <= 0) return "00h:00m";
  const hours = Math.floor(totalMins / 60);
  const minutes = totalMins % 60;

  const h = hours.toString().padStart(2, "0");
  const m = minutes.toString().padStart(2, "0");

  return `${h}h:${m}m`;
}

export function formatDecimal(totalMinutes: number) {
  return parseFloat((totalMinutes / 60).toFixed(2));
}
