/** Times on the dashboard, always in the tenant's timezone. */

export function fmtTime(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz }).format(new Date(iso));
}

export function fmtDayTime(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: tz }).format(new Date(iso));
}

export function fmtDate(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: tz }).format(new Date(iso));
}
