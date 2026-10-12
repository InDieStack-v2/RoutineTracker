import {
  calendarDateString,
  daysInCalendarMonth,
  getActiveTimeZone,
  isSystemTimeZone,
  midnightOnCalendarDate,
  shiftCalendarDate,
  weekdayOfCalendarDate,
  zonedDateString,
  zonedParts,
  calendarDateUtcRange,
} from "./timezone";

export {
  calendarDateString,
  formatCalendarDate,
  formatInstant,
  noonOnCalendarDate,
  shiftCalendarDate,
} from "./timezone";

function activeZone(timeZone?: string): string {
  return timeZone ?? getActiveTimeZone();
}

// Calendar dates follow the active timezone. "system" keeps device-local Date methods.
export function toLocalDateString(date: Date, timeZone?: string): string {
  if (isSystemTimeZone(activeZone(timeZone))) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return zonedDateString(date, activeZone(timeZone));
}

export function todayLocalDateString(timeZone?: string): string {
  return toLocalDateString(new Date(), timeZone);
}

export function localDateToUTCRange(localDateStr: string): { start: string; end: string } {
  if (isSystemTimeZone(getActiveTimeZone())) {
    const [year, month, day] = localDateStr.split("-").map(Number);
    const start = new Date(year, month - 1, day).toISOString();
    const end = new Date(year, month - 1, day + 1).toISOString();
    return { start, end };
  }
  return calendarDateUtcRange(localDateStr);
}

export function utcToLocalDateString(isoUtc: string): string {
  return toLocalDateString(new Date(isoUtc));
}

export function addLocalDays(date: Date, days: number, timeZone?: string): Date {
  const zone = activeZone(timeZone);
  if (isSystemTimeZone(zone)) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  }
  return midnightOnCalendarDate(shiftCalendarDate(zonedDateString(date, zone), days), zone);
}

export function startOfWeekMonday(date: Date, timeZone?: string): Date {
  const zone = activeZone(timeZone);
  if (isSystemTimeZone(zone)) {
    const day = date.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    return addLocalDays(date, mondayOffset, zone);
  }
  const dateStr = zonedDateString(date, zone);
  const day = weekdayOfCalendarDate(dateStr);
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return midnightOnCalendarDate(shiftCalendarDate(dateStr, mondayOffset), zone);
}

export function datesInMonth(year: number, monthIndex: number, timeZone?: string): Date[] {
  const zone = activeZone(timeZone);
  if (isSystemTimeZone(zone)) {
    const count = new Date(year, monthIndex + 1, 0).getDate();
    return Array.from({ length: count }, (_, day) => new Date(year, monthIndex, day + 1));
  }
  const count = daysInCalendarMonth(year, monthIndex);
  return Array.from({ length: count }, (_, day) =>
    midnightOnCalendarDate(calendarDateString(year, monthIndex, day + 1), zone),
  );
}

export function currentCalendar(timeZone?: string): { year: number; month: number; day: number; weekday: number } {
  const parts = zonedParts(new Date(), activeZone(timeZone));
  return {
    year: parts.year,
    month: parts.month - 1,
    day: parts.day,
    weekday: parts.weekday,
  };
}

export const WEEKDAY_KEYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function weekdayKey(date: Date): (typeof WEEKDAY_KEYS)[number] {
  if (isSystemTimeZone(getActiveTimeZone())) {
    return WEEKDAY_KEYS[date.getDay()];
  }
  return WEEKDAY_KEYS[zonedParts(date).weekday];
}
