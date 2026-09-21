function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

/** `startedAt`..`endedAt` as "Xh Ym" — `endedAt` null means still running,
 *  shown as "In progress" rather than a duration against `now` (which
 *  would keep changing between server renders). Performance's session
 *  history table — a list of *past* sessions, where "In progress" is the
 *  right label for the one still-open row that shows up in it. */
export function formatDuration(startedAt: string, endedAt: string | null): string {
  if (!endedAt) return "In progress";
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  return formatMinutes(Math.round(ms / 60000));
}

/** How long a still-open session has been running, as of now — the
 *  EvChargerOverview "current session" card wants the actual elapsed time,
 *  not the word "In progress" formatDuration gives a historical list. */
export function formatElapsedSince(startedAt: string): string {
  const ms = Date.now() - new Date(startedAt).getTime();
  return formatMinutes(Math.max(0, Math.round(ms / 60000)));
}
