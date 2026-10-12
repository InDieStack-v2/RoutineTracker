// Convert a Date object to a local YYYY-MM-DD string using device timezone
export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Return today's date as a local YYYY-MM-DD string
export function todayLocalDateString(): string {
  return toLocalDateString(new Date());
}

// Convert a local YYYY-MM-DD string to a UTC ISO range [start, end) covering that entire local day
export function localDateToUTCRange(localDateStr: string): { start: string; end: string } {
  const [year, month, day] = localDateStr.split('-').map(Number);
  const start = new Date(year, month - 1, day).toISOString();
  const end = new Date(year, month - 1, day + 1).toISOString();
  return { start, end };
}

// Convert a UTC ISO string to a local YYYY-MM-DD string
export function utcToLocalDateString(isoUtc: string): string {
  return toLocalDateString(new Date(isoUtc));
}

// Local calendar day `days` away from `date`, at local midnight.
export function addLocalDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

// Monday 00:00 local of the week that contains `date`. Sunday closes that week.
export function startOfWeekMonday(date: Date): Date {
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return addLocalDays(date, mondayOffset);
}

// Every local midnight in `monthIndex` (0-11). Does not spill into the next month.
export function datesInMonth(year: number, monthIndex: number): Date[] {
  const count = new Date(year, monthIndex + 1, 0).getDate();
  return Array.from({ length: count }, (_, day) => new Date(year, monthIndex, day + 1));
}
