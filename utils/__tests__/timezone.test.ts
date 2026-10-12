/**
 * @jest-environment node
 */
import { localDateToUTCRange, toLocalDateString, todayLocalDateString } from "../dateUtils";
import {
  calendarDateString,
  calendarDateUtcRange,
  deviceLocalWallClock,
  normalizeTimeZone,
  setActiveTimeZone,
  shiftCalendarDate,
  weekdayOfCalendarDate,
  zonedDateString,
  zonedTimeToUtc,
  SYSTEM_TIMEZONE,
} from "../timezone";

afterEach(() => {
  setActiveTimeZone(SYSTEM_TIMEZONE);
});

describe("normalizeTimeZone", () => {
  it("defaults missing and invalid zones to system", () => {
    expect(normalizeTimeZone(null)).toBe("system");
    expect(normalizeTimeZone("")).toBe("system");
    expect(normalizeTimeZone("Not/AZone")).toBe("system");
    expect(normalizeTimeZone("Asia/Ho_Chi_Minh")).toBe("Asia/Ho_Chi_Minh");
  });
});

describe("explicit IANA zones", () => {
  it("maps Asia/Ho_Chi_Minh midnight to the previous UTC evening", () => {
    const range = calendarDateUtcRange("2026-03-21", "Asia/Ho_Chi_Minh");
    expect(range.start).toBe("2026-03-20T17:00:00.000Z");
    expect(range.end).toBe("2026-03-21T17:00:00.000Z");
    expect(zonedDateString(new Date("2026-03-20T17:00:00.000Z"), "Asia/Ho_Chi_Minh")).toBe(
      "2026-03-21",
    );
    expect(zonedDateString(new Date("2026-03-20T16:59:59.999Z"), "Asia/Ho_Chi_Minh")).toBe(
      "2026-03-20",
    );
  });

  it("keeps America/New_York DST day ranges", () => {
    expect(calendarDateUtcRange("2025-01-15", "America/New_York")).toEqual({
      start: "2025-01-15T05:00:00.000Z",
      end: "2025-01-16T05:00:00.000Z",
    });
    expect(calendarDateUtcRange("2025-07-15", "America/New_York")).toEqual({
      start: "2025-07-15T04:00:00.000Z",
      end: "2025-07-16T04:00:00.000Z",
    });
    expect(calendarDateUtcRange("2026-03-08", "America/New_York")).toEqual({
      start: "2026-03-08T05:00:00.000Z",
      end: "2026-03-09T04:00:00.000Z",
    });
    expect(calendarDateUtcRange("2026-11-01", "America/New_York")).toEqual({
      start: "2026-11-01T04:00:00.000Z",
      end: "2026-11-02T05:00:00.000Z",
    });
  });

  it("does not shift a calendar date string through the device zone", () => {
    expect(calendarDateString(2026, 2, 21)).toBe("2026-03-21");
    expect(shiftCalendarDate("2026-03-01", -1)).toBe("2026-02-28");
    expect(weekdayOfCalendarDate("2026-03-01")).toBe(0);
  });

  it("converts a selected wall clock into the device clock", () => {
    const instant = zonedTimeToUtc(2026, 3, 21, 8, 0, 0, "Asia/Tokyo");
    expect(instant.toISOString()).toBe("2026-03-20T23:00:00.000Z");
    const wall = deviceLocalWallClock(8, 0, "Asia/Tokyo", new Date("2026-03-21T03:00:00.000Z"));
    expect(wall).toEqual({
      hour: instant.getHours(),
      minute: instant.getMinutes(),
    });
  });
});

describe("active timezone", () => {
  it("uses the selected zone for today and day ranges", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-20T18:30:00.000Z"));
    setActiveTimeZone("Asia/Ho_Chi_Minh");

    expect(todayLocalDateString()).toBe("2026-03-21");
    expect(toLocalDateString(new Date("2026-03-20T16:30:00.000Z"))).toBe("2026-03-20");
    expect(localDateToUTCRange("2026-03-21")).toEqual({
      start: "2026-03-20T17:00:00.000Z",
      end: "2026-03-21T17:00:00.000Z",
    });

    jest.useRealTimers();
  });

  it("keeps system on device-local dates", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-20T18:30:00.000Z"));
    setActiveTimeZone("system");

    expect(todayLocalDateString()).toBe(
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`,
    );

    jest.useRealTimers();
  });
});
