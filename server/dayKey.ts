// The calendar day (YYYY-MM-DD) in the app's time zone; Intl handles daylight saving time.
export function dayKey(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}
