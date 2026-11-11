/**
 * How long ago something happened, in the short words of a status line: "1 sec ago", "5 mins ago", "3 hrs ago", "10 days ago", "1 month ago",
 * "2 years ago". A month is 30 days and a year 365. A moment in the future (a clock a little ahead) reads as "1 sec ago".
 */
export function timeAgo(thenMs: number, nowMs: number): string {
  const secs = Math.max(1, Math.floor((nowMs - thenMs) / 1000));
  const unit = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"} ago`;
  if (secs < 60) return unit(secs, "sec");
  const mins = Math.floor(secs / 60);
  if (mins < 60) return unit(mins, "min");
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return unit(hrs, "hr");
  const days = Math.floor(hrs / 24);
  if (days < 30) return unit(days, "day");
  if (days < 365) return unit(Math.min(11, Math.floor(days / 30)), "month");
  return unit(Math.floor(days / 365), "year");
}
