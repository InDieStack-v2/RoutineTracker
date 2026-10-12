/**
 * @jest-environment node
 */

import {
  addLocalDays,
  datesInMonth,
  localDateToUTCRange,
  startOfWeekMonday,
  toLocalDateString,
  todayLocalDateString,
  utcToLocalDateString,
} from '../dateUtils';

describe('toLocalDateString', () => {
  describe('EST (UTC-5) — winter, January 2025', () => {
    it('returns local Jan 14 for UTC time 1 ms before EST midnight (04:59:59.999Z)', () => {
      const result = toLocalDateString(new Date('2025-01-15T04:59:59.999Z'));
      expect(result).toBe('2025-01-14');
    });

    it('returns local Jan 15 for UTC time exactly at EST midnight (05:00:00.000Z)', () => {
      const result = toLocalDateString(new Date('2025-01-15T05:00:00.000Z'));
      expect(result).toBe('2025-01-15');
    });

    it('returns local Jan 15 for UTC midday (12:00:00.000Z) — always same day', () => {
      const result = toLocalDateString(new Date('2025-01-15T12:00:00.000Z'));
      expect(result).toBe('2025-01-15');
    });

    it('returns local Jan 15 for 11:30 PM EST (= 04:30:00Z next UTC day)', () => {
      const result = toLocalDateString(new Date('2025-01-16T04:30:00.000Z'));
      expect(result).toBe('2025-01-15');
    });
  });

  describe('EDT (UTC-4) — summer, July 2025', () => {
    it('returns local Jul 14 for UTC time 1 ms before EDT midnight (03:59:59.999Z)', () => {
      const result = toLocalDateString(new Date('2025-07-15T03:59:59.999Z'));
      expect(result).toBe('2025-07-14');
    });

    it('returns local Jul 15 for UTC time exactly at EDT midnight (04:00:00.000Z)', () => {
      const result = toLocalDateString(new Date('2025-07-15T04:00:00.000Z'));
      expect(result).toBe('2025-07-15');
    });
  });

  it('returns valid YYYY-MM-DD format for any date', () => {
    const result = toLocalDateString(new Date('2025-01-15T12:00:00.000Z'));
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('todayLocalDateString', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns local date matching fake-timer day — afternoon (7 AM local = 12:00Z)', () => {
    jest.setSystemTime(new Date('2025-01-15T12:00:00Z'));
    const result = todayLocalDateString();
    expect(result).toBe('2025-01-15');
  });

  it('returns PREVIOUS local date when UTC time is before local midnight (11:30 PM EST = 04:30Z) ← TZ-PROOF', () => {
    jest.setSystemTime(new Date('2025-01-15T04:30:00Z'));
    const result = todayLocalDateString();
    expect(result).toBe('2025-01-14');
  });

  it('delegates to toLocalDateString(new Date()) with same result', () => {
    jest.setSystemTime(new Date('2025-01-15T12:00:00Z'));
    const todayResult = todayLocalDateString();
    const manualResult = toLocalDateString(new Date());
    expect(todayResult).toBe(manualResult);
  });
});

describe('localDateToUTCRange', () => {
  describe('EST (UTC-5) — winter', () => {
    it('Jan 15 2025 range: start=2025-01-15T05:00:00.000Z, end=2025-01-16T05:00:00.000Z', () => {
      const result = localDateToUTCRange('2025-01-15');
      expect(result.start).toBe('2025-01-15T05:00:00.000Z');
      expect(result.end).toBe('2025-01-16T05:00:00.000Z');
    });

    it('range spans exactly 24 hours on a standard winter day', () => {
      const result = localDateToUTCRange('2025-01-15');
      const startTime = new Date(result.start).getTime();
      const endTime = new Date(result.end).getTime();
      const hoursDiff = (endTime - startTime) / (1000 * 60 * 60);
      expect(hoursDiff).toBe(24);
    });
  });

  describe('EDT (UTC-4) — summer', () => {
    it('Jul 15 2025 range: start=2025-07-15T04:00:00.000Z, end=2025-07-16T04:00:00.000Z', () => {
      const result = localDateToUTCRange('2025-07-15');
      expect(result.start).toBe('2025-07-15T04:00:00.000Z');
      expect(result.end).toBe('2025-07-16T04:00:00.000Z');
    });
  });

  describe('DST spring-forward 2026-03-08 (23-hour day) — TZ-PROOF', () => {
    it('spring-forward day: start=2026-03-08T05:00:00.000Z, end=2026-03-09T04:00:00.000Z (23h)', () => {
      const result = localDateToUTCRange('2026-03-08');
      expect(result.start).toBe('2026-03-08T05:00:00.000Z');
      expect(result.end).toBe('2026-03-09T04:00:00.000Z');
    });

    it('range is exactly 23 hours on spring-forward day', () => {
      const result = localDateToUTCRange('2026-03-08');
      const startTime = new Date(result.start).getTime();
      const endTime = new Date(result.end).getTime();
      const hoursDiff = (endTime - startTime) / (1000 * 60 * 60);
      expect(hoursDiff).toBe(23);
    });
  });

  describe('DST fall-back 2026-11-01 (25-hour day)', () => {
    it('fall-back day: start=2026-11-01T04:00:00.000Z, end=2026-11-02T05:00:00.000Z (25h)', () => {
      const result = localDateToUTCRange('2026-11-01');
      expect(result.start).toBe('2026-11-01T04:00:00.000Z');
      expect(result.end).toBe('2026-11-02T05:00:00.000Z');
    });

    it('range is exactly 25 hours on fall-back day', () => {
      const result = localDateToUTCRange('2026-11-01');
      const startTime = new Date(result.start).getTime();
      const endTime = new Date(result.end).getTime();
      const hoursDiff = (endTime - startTime) / (1000 * 60 * 60);
      expect(hoursDiff).toBe(25);
    });
  });

  it('returns valid ISO UTC strings (ending with Z)', () => {
    const result = localDateToUTCRange('2025-01-15');
    expect(result.start).toMatch(/Z$/);
    expect(result.end).toMatch(/Z$/);
  });

  it('end is always one local day after start', () => {
    const result = localDateToUTCRange('2025-01-15');
    const startDate = new Date(result.start);
    const endDate = new Date(result.end);

    // The end date should be exactly 1 day (24h, 23h, or 25h depending on DST)
    // after the start date in terms of local date progression
    const startLocalDate = toLocalDateString(startDate);
    const endLocalDate = toLocalDateString(endDate);

    // End should be the next local day
    const expectedEndDate = new Date(startDate);
    expectedEndDate.setDate(expectedEndDate.getDate() + 1);
    expect(endLocalDate).toBe(toLocalDateString(expectedEndDate));
  });
});

describe('utcToLocalDateString', () => {
  describe('EST (UTC-5) midnight boundary', () => {
    it('maps 04:59:59.999Z to local Jan 14 (1ms before local midnight)', () => {
      const result = utcToLocalDateString('2025-01-15T04:59:59.999Z');
      expect(result).toBe('2025-01-14');
    });

    it('maps 05:00:00.000Z to local Jan 15 (exactly at local midnight)', () => {
      const result = utcToLocalDateString('2025-01-15T05:00:00.000Z');
      expect(result).toBe('2025-01-15');
    });
  });

  describe('cross-midnight UTC (11:30 PM EST = UTC next day)', () => {
    it('2025-01-16T04:30:00.000Z maps to local Jan 15 (11:30 PM EST)', () => {
      const result = utcToLocalDateString('2025-01-16T04:30:00.000Z');
      expect(result).toBe('2025-01-15');
    });
  });

  describe('round-trip consistency', () => {
    it('utcToLocalDateString(localDateToUTCRange(date).start) === date', () => {
      const dateStr = '2025-01-15';
      const range = localDateToUTCRange(dateStr);
      const result = utcToLocalDateString(range.start);
      expect(result).toBe(dateStr);
    });

    it('round-trip works for summer EDT date', () => {
      const dateStr = '2025-07-15';
      const range = localDateToUTCRange(dateStr);
      const result = utcToLocalDateString(range.start);
      expect(result).toBe(dateStr);
    });
  });

  it('handles UTC+0 ISO strings with Z suffix', () => {
    const result = utcToLocalDateString('2025-01-15T05:00:00.000Z');
    expect(result).toBe('2025-01-15');
  });
});

describe('startOfWeekMonday', () => {
  it('returns the Monday on or before the given local day', () => {
    const anchor = new Date(2026, 9, 14);
    const start = startOfWeekMonday(anchor);
    const anchorDay = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());

    expect(start.getDay()).toBe(1);
    expect(start.getHours()).toBe(0);
    expect(start.getTime()).toBeLessThanOrEqual(anchorDay.getTime());
    expect(addLocalDays(start, 6).getDay()).toBe(0);
    expect(anchorDay.getTime()).toBeLessThanOrEqual(addLocalDays(start, 6).getTime());
  });

  it('keeps Sunday in the preceding Monday week', () => {
    const monday = startOfWeekMonday(new Date(2026, 9, 14));
    const sunday = addLocalDays(monday, 6);

    expect(sunday.getDay()).toBe(0);
    expect(startOfWeekMonday(sunday).getTime()).toBe(monday.getTime());
    expect(startOfWeekMonday(monday).getTime()).toBe(monday.getTime());
  });
});

describe('datesInMonth', () => {
  it('does not spill a short month into the next month', () => {
    const dates = datesInMonth(2026, 1);

    expect(dates).toHaveLength(28);
    expect(dates.every((date) => date.getMonth() === 1)).toBe(true);
    expect(toLocalDateString(dates[0])).toBe('2026-02-01');
    expect(toLocalDateString(dates[27])).toBe('2026-02-28');
  });

  it('includes day 31 only when the month has one', () => {
    const october = datesInMonth(2026, 9);
    const february = datesInMonth(2024, 1);

    expect(october).toHaveLength(31);
    expect(toLocalDateString(october[30])).toBe('2026-10-31');
    expect(february).toHaveLength(29);
    expect(toLocalDateString(february[28])).toBe('2024-02-29');
  });
});
