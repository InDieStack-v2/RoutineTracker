export const SYSTEM_TIMEZONE = "system";

let activeTimeZone = SYSTEM_TIMEZONE;

export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
};

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const FALLBACK_TIME_ZONES = [
  "UTC",
  "Pacific/Honolulu",
  "America/Anchorage",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "Atlantic/Reykjavik",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Ho_Chi_Minh",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Pacific/Auckland",
];

export function isSystemTimeZone(timeZone: string | null | undefined): boolean {
  return !timeZone || timeZone === SYSTEM_TIMEZONE;
}

export function getActiveTimeZone(): string {
  return activeTimeZone;
}

export function setActiveTimeZone(timeZone: string | null | undefined): void {
  activeTimeZone = normalizeTimeZone(timeZone);
}

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function resolveTimeZone(timeZone?: string | null): string {
  const zone = timeZone ?? getActiveTimeZone();
  if (isSystemTimeZone(zone)) return deviceTimeZone();
  return zone;
}

export function isValidTimeZone(timeZone: string): boolean {
  if (isSystemTimeZone(timeZone)) return true;
  try {
    Intl.DateTimeFormat("en-US", { timeZone }).format(0);
    return true;
  } catch {
    return false;
  }
}

export function normalizeTimeZone(timeZone: string | null | undefined): string {
  if (isSystemTimeZone(timeZone)) return SYSTEM_TIMEZONE;
  if (timeZone && isValidTimeZone(timeZone)) return timeZone;
  return SYSTEM_TIMEZONE;
}

export function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function calendarDateString(year: number, monthIndex: number, day: number): string {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

export function zonedParts(date: Date, timeZone: string = getActiveTimeZone()): ZonedParts {
  if (isSystemTimeZone(timeZone)) {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
      second: date.getSeconds(),
      weekday: date.getDay(),
    };
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: resolveTimeZone(timeZone),
    hourCycle: "h23",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") map[part.type] = part.value;
  }

  let hour = Number(map.hour);
  if (hour === 24) hour = 0;
  const weekdayName = (map.weekday ?? "Sun").slice(0, 3);

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour,
    minute: Number(map.minute),
    second: Number(map.second),
    weekday: WEEKDAY_INDEX[weekdayName] ?? 0,
  };
}

export function zonedDateString(date: Date, timeZone: string = getActiveTimeZone()): string {
  const parts = zonedParts(date, timeZone);
  return calendarDateString(parts.year, parts.month - 1, parts.day);
}

export function shiftCalendarDate(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`;
}

export function weekdayOfCalendarDate(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function daysInCalendarMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function offsetMs(date: Date, timeZone: string): number {
  const parts = zonedParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - date.getTime();
}

export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string = getActiveTimeZone(),
): Date {
  if (isSystemTimeZone(timeZone)) {
    return new Date(year, month - 1, day, hour, minute, second);
  }

  const zone = resolveTimeZone(timeZone);
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  const firstOffset = offsetMs(new Date(utcGuess), zone);
  let result = utcGuess - firstOffset;
  const secondOffset = offsetMs(new Date(result), zone);
  if (secondOffset !== firstOffset) {
    result = utcGuess - secondOffset;
  }
  return new Date(result);
}

export function calendarDateUtcRange(
  dateStr: string,
  timeZone: string = getActiveTimeZone(),
): { start: string; end: string } {
  const [year, month, day] = dateStr.split("-").map(Number);
  if (isSystemTimeZone(timeZone)) {
    return {
      start: new Date(year, month - 1, day).toISOString(),
      end: new Date(year, month - 1, day + 1).toISOString(),
    };
  }

  const next = shiftCalendarDate(dateStr, 1);
  const [nextYear, nextMonth, nextDay] = next.split("-").map(Number);
  return {
    start: zonedTimeToUtc(year, month, day, 0, 0, 0, timeZone).toISOString(),
    end: zonedTimeToUtc(nextYear, nextMonth, nextDay, 0, 0, 0, timeZone).toISOString(),
  };
}

export function noonOnCalendarDate(dateStr: string, timeZone: string = getActiveTimeZone()): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return zonedTimeToUtc(year, month, day, 12, 0, 0, timeZone);
}

export function midnightOnCalendarDate(
  dateStr: string,
  timeZone: string = getActiveTimeZone(),
): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return zonedTimeToUtc(year, month, day, 0, 0, 0, timeZone);
}

export function formatCalendarDate(
  dateStr: string,
  locale: string,
  options: Intl.DateTimeFormatOptions,
): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(locale, {
    ...options,
    timeZone: "UTC",
  });
}

export function formatInstant(
  date: Date,
  locale: string,
  options: Intl.DateTimeFormatOptions,
  timeZone: string = getActiveTimeZone(),
): string {
  if (isSystemTimeZone(timeZone)) {
    return date.toLocaleDateString(locale, options);
  }
  return date.toLocaleDateString(locale, {
    ...options,
    timeZone: resolveTimeZone(timeZone),
  });
}

export function listTimeZones(): string[] {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };
  if (typeof intl.supportedValuesOf === "function") {
    try {
      const zones = intl.supportedValuesOf("timeZone");
      if (zones.length > 0) return zones;
    } catch {
      // Older engines fall through to the curated list.
    }
  }
  return FALLBACK_TIME_ZONES;
}

export function timeZoneOffsetLabel(timeZone: string, date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: resolveTimeZone(timeZone),
      timeZoneName: "shortOffset",
      hour: "2-digit",
    }).formatToParts(date);
    return parts.find((part) => part.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

export function deviceLocalWallClock(
  hour: number,
  minute: number,
  timeZone: string = getActiveTimeZone(),
  now = new Date(),
): { hour: number; minute: number } {
  if (isSystemTimeZone(timeZone)) return { hour, minute };
  const parts = zonedParts(now, timeZone);
  const instant = zonedTimeToUtc(parts.year, parts.month, parts.day, hour, minute, 0, timeZone);
  return { hour: instant.getHours(), minute: instant.getMinutes() };
}
