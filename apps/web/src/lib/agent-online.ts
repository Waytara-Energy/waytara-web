/** The device agent counts as online while its last heartbeat is newer than three of its upload intervals (and never
 *  less than 90 seconds, so a short interval doesn't flicker). */
export function isAgentOnline(lastSyncTs: string | null, nowMs: number, uploadIntervalS: number | null): boolean {
  if (lastSyncTs === null) return false;
  return nowMs - new Date(lastSyncTs).getTime() < Math.max(90_000, 3 * (uploadIntervalS ?? 60) * 1000);
}
