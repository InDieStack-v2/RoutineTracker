/**
 * @jest-environment node
 *
 * Unit Tests for StreakService — pure functions, no DB/store imports
 * Run with: cross-env TZ=America/New_York yarn jest services/__tests__/streakService.test.ts
 */

import {
  daysBetween,
  getYesterday,
  computeEvaluateResult,
  computeRecordTaskResult,
  computeRevokeToday,
  FREEZE_CAP,
  FREEZE_AWARD_INTERVAL,
  DEFAULT_SNAPSHOT,
  type StreakSnapshot,
} from '../streakService';

// ─────────────────────────────────────────────────────────────────────────────
// daysBetween
// ─────────────────────────────────────────────────────────────────────────────
describe('daysBetween', () => {
  it('returns 1 for consecutive days', () => {
    expect(daysBetween('2025-01-14', '2025-01-15')).toBe(1);
  });

  it('returns 30 for Jan 1 to Jan 31', () => {
    expect(daysBetween('2025-01-01', '2025-01-31')).toBe(30);
  });

  it('returns 0 for same day', () => {
    expect(daysBetween('2025-01-15', '2025-01-15')).toBe(0);
  });

  it('returns 1 for year boundary (Dec 31 to Jan 1)', () => {
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1);
  });

  it('returns 1 for DST spring-forward (Mar 8 to Mar 9)', () => {
    // DST spring-forward in America/New_York: Mar 8, 2026 → Mar 9, 2026
    // Local Date constructor handles DST correctly
    expect(daysBetween('2026-03-08', '2026-03-09')).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getYesterday
// ─────────────────────────────────────────────────────────────────────────────
describe('getYesterday', () => {
  it('returns previous day within same month', () => {
    expect(getYesterday('2025-01-15')).toBe('2025-01-14');
  });

  it('handles month boundary (Mar 1 → Feb 28)', () => {
    expect(getYesterday('2025-03-01')).toBe('2025-02-28');
  });

  it('handles year boundary (Jan 1 → Dec 31 prev year)', () => {
    expect(getYesterday('2025-01-01')).toBe('2024-12-31');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeEvaluateResult
// ─────────────────────────────────────────────────────────────────────────────
describe('computeEvaluateResult', () => {
  it('AC9: already checked today → returns same snapshot reference (idempotent)', () => {
    const snapshot: StreakSnapshot = {
      ...DEFAULT_SNAPSHOT,
      streakCount: 5,
      lastTaskDate: '2025-01-14',
      lastCheckedDate: '2025-01-15',
    };
    const result = computeEvaluateResult(snapshot, '2025-01-15');
    expect(result).toBe(snapshot); // same reference
  });

  it('no lastTaskDate → returns snapshot with updated lastCheckedDate only', () => {
    const snapshot: StreakSnapshot = {
      ...DEFAULT_SNAPSHOT,
      lastTaskDate: null,
      lastCheckedDate: null,
    };
    const result = computeEvaluateResult(snapshot, '2025-01-15');
    expect(result.lastCheckedDate).toBe('2025-01-15');
    expect(result.streakCount).toBe(0);
    expect(result.lastTaskDate).toBeNull();
  });

  it('daysSince = 1 (yesterday) → no change to streak/freeze, updates lastCheckedDate', () => {
    const snapshot: StreakSnapshot = {
      ...DEFAULT_SNAPSHOT,
      streakCount: 5,
      freezeCount: 2,
      lastTaskDate: '2025-01-14',
      lastCheckedDate: '2025-01-14',
    };
    const result = computeEvaluateResult(snapshot, '2025-01-15');
    expect(result.streakCount).toBe(5);
    expect(result.freezeCount).toBe(2);
    expect(result.lastCheckedDate).toBe('2025-01-15');
    expect(result.lastTaskDate).toBe('2025-01-14');
  });

  it('AC4: 1 missed day, 1 freeze → freeze consumed, streak unchanged, lastTaskDate fast-forwarded', () => {
    const snapshot: StreakSnapshot = {
      ...DEFAULT_SNAPSHOT,
      streakCount: 5,
      freezeCount: 1,
      lastTaskDate: '2025-01-13',
      lastCheckedDate: '2025-01-13',
    };
    const result = computeEvaluateResult(snapshot, '2025-01-15');
    expect(result.streakCount).toBe(5); // unchanged
    expect(result.freezeCount).toBe(0); // consumed
    expect(result.lastTaskDate).toBe('2025-01-14'); // fast-forwarded to yesterday
    expect(result.lastCheckedDate).toBe('2025-01-15');
  });

  it('AC6: 2 missed days, 2 freezes → both consumed, streak unchanged', () => {
    const snapshot: StreakSnapshot = {
      ...DEFAULT_SNAPSHOT,
      streakCount: 10,
      freezeCount: 2,
      lastTaskDate: '2025-01-12',
      lastCheckedDate: '2025-01-12',
    };
    const result = computeEvaluateResult(snapshot, '2025-01-15');
    expect(result.streakCount).toBe(10); // unchanged
    expect(result.freezeCount).toBe(0); // both consumed
    expect(result.lastTaskDate).toBe('2025-01-14'); // fast-forwarded
    expect(result.lastCheckedDate).toBe('2025-01-15');
  });

  it('AC7: 2 missed days, 1 freeze → streak reset to 0, freeze = 0', () => {
    const snapshot: StreakSnapshot = {
      ...DEFAULT_SNAPSHOT,
      streakCount: 10,
      freezeCount: 1,
      lastTaskDate: '2025-01-12',
      lastCheckedDate: '2025-01-12',
    };
    const result = computeEvaluateResult(snapshot, '2025-01-15');
   expect(result.streakCount).toBe(0); // reset
    expect(result.freezeCount).toBe(0); // reset
    expect(result.lastTaskDate).toBeNull();
    expect(result.lastCheckedDate).toBe('2025-01-15');
    expect(result.lastFreezeAwardedAtStreak).toBe(0);
  });

  it('AC5: 1 missed day, 0 freezes → streak reset to 0', () => {
    const snapshot: StreakSnapshot = {
      ...DEFAULT_SNAPSHOT,
      streakCount: 5,
      freezeCount: 0,
      lastTaskDate: '2025-01-13',
      lastCheckedDate: '2025-01-13',
    };
    const result = computeEvaluateResult(snapshot, '2025-01-15');
    expect(result.streakCount).toBe(0); // reset
    expect(result.freezeCount).toBe(0);
    expect(result.lastTaskDate).toBeNull();
    expect(result.lastCheckedDate).toBe('2025-01-15');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeRevokeToday
// ─────────────────────────────────────────────────────────────────────────────
describe('computeRevokeToday', () => {
  it('returns same snapshot reference if lastTaskDate is not today (idempotent)', () => {
    const snapshot: StreakSnapshot = {
      ...DEFAULT_SNAPSHOT,
      streakCount: 5,
      lastTaskDate: '2025-01-14', // yesterday, not today
    };
    const result = computeRevokeToday(snapshot, '2025-01-15');
    expect(result).toBe(snapshot); // same reference
  });

  it('returns same snapshot reference if lastTaskDate is null (never counted)', () => {
    const snapshot: StreakSnapshot = {
      ...DEFAULT_SNAPSHOT,
      lastTaskDate: null,
    };
    const result = computeRevokeToday(snapshot, '2025-01-15');
    expect(result).toBe(snapshot);
  });

  it('decrements streakCount and rolls lastTaskDate back to yesterday', () => {
    const snapshot: StreakSnapshot = {
      ...DEFAULT_SNAPSHOT,
      streakCount: 5,
      lastTaskDate: '2025-01-15',
    };
    const result = computeRevokeToday(snapshot, '2025-01-15');
    expect(result.streakCount).toBe(4);
    expect(result.lastTaskDate).toBe('2025-01-14'); // yesterday
  });

  it('sets lastTaskDate to null when streak reaches 0 (first day revoked)', () => {
    const snapshot: StreakSnapshot = {
      ...DEFAULT_SNAPSHOT,
      streakCount: 1,
      lastTaskDate: '2025-01-15',
    };
    const result = computeRevokeToday(snapshot, '2025-01-15');
    expect(result.streakCount).toBe(0);
    expect(result.lastTaskDate).toBeNull();
  });

  it('does NOT touch longestStreak or freezeCount', () => {
    const snapshot: StreakSnapshot = {
      ...DEFAULT_SNAPSHOT,
      streakCount: 7,
      longestStreak: 10,
      freezeCount: 2,
      lastTaskDate: '2025-01-15',
    };
    const result = computeRevokeToday(snapshot, '2025-01-15');
    expect(result.longestStreak).toBe(10); // unchanged
    expect(result.freezeCount).toBe(2);    // unchanged
  });

  it('complete → revoke cycle: streak returns to original value', () => {
    const original: StreakSnapshot = {
      ...DEFAULT_SNAPSHOT,
      streakCount: 5,
      lastTaskDate: '2025-01-14',
    };
    // Simulate completing a task today
    const afterRecord = computeRecordTaskResult(original, '2025-01-15');
    expect(afterRecord.streakCount).toBe(6);
    expect(afterRecord.lastTaskDate).toBe('2025-01-15');

    // Simulate un-completing the last task
    const afterRevoke = computeRevokeToday(afterRecord, '2025-01-15');
    expect(afterRevoke.streakCount).toBe(5);
    expect(afterRevoke.lastTaskDate).toBe('2025-01-14');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeRecordTaskResult
// ─────────────────────────────────────────────────────────────────────────────
describe('computeRecordTaskResult', () => {
  it('AC2: lastTaskDate = today → returns same snapshot reference (idempotent)', () => {
    const snapshot: StreakSnapshot = {
      ...DEFAULT_SNAPSHOT,
      streakCount: 5,
      lastTaskDate: '2025-01-15',
    };
    const result = computeRecordTaskResult(snapshot, '2025-01-15');
    expect(result).toBe(snapshot); // same reference
  });

  it('AC1: first task ever (lastTaskDate = null) → streakCount = 1, lastTaskDate = today', () => {
    const snapshot: StreakSnapshot = {
      ...DEFAULT_SNAPSHOT,
      lastTaskDate: null,
    };
    const result = computeRecordTaskResult(snapshot, '2025-01-15');
    expect(result.streakCount).toBe(1);
    expect(result.longestStreak).toBe(1);
    expect(result.lastTaskDate).toBe('2025-01-15');
    expect(result.lastCheckedDate).toBe('2025-01-15');
  });

  it('perfect continuation (daysSince = 1) → streakCount increments', () => {
    const snapshot: StreakSnapshot = {
      ...DEFAULT_SNAPSHOT,
      streakCount: 5,
      longestStreak: 10,
      lastTaskDate: '2025-01-14',
    };
    const result = computeRecordTaskResult(snapshot, '2025-01-15');
    expect(result.streakCount).toBe(6);
    expect(result.longestStreak).toBe(10); // unchanged (6 < 10)
    expect(result.lastTaskDate).toBe('2025-01-15');
  });

  it('AC3: streak reaches 7 → freezeCount increments by 1', () => {
    const snapshot: StreakSnapshot = {
      ...DEFAULT_SNAPSHOT,
      streakCount: 6,
      freezeCount: 0,
      lastTaskDate: '2025-01-14',
      lastFreezeAwardedAtStreak: 0,
    };
    const result = computeRecordTaskResult(snapshot, '2025-01-15');
    expect(result.streakCount).toBe(7);
    expect(result.freezeCount).toBe(1); // awarded
    expect(result.lastFreezeAwardedAtStreak).toBe(7);
  });

  it('freeze cap: streak at 21 with 3 freezes already → freezeCount stays at 3', () => {
    const snapshot: StreakSnapshot = {
      ...DEFAULT_SNAPSHOT,
      streakCount: 20,
      freezeCount: 3, // already at cap
      lastTaskDate: '2025-01-14',
      lastFreezeAwardedAtStreak: 14,
    };
    const result = computeRecordTaskResult(snapshot, '2025-01-15');
    expect(result.streakCount).toBe(21);
    expect(result.freezeCount).toBe(3); // capped
    expect(result.lastFreezeAwardedAtStreak).toBe(21);
  });

  it('AC3 double-award guard: called twice at streak 7 → freeze awarded only once', () => {
    const snapshot: StreakSnapshot = {
      ...DEFAULT_SNAPSHOT,
      streakCount: 6,
      freezeCount: 0,
      lastTaskDate: '2025-01-14',
      lastFreezeAwardedAtStreak: 0,
    };
    // First call: streak 6 → 7, award freeze
    const result1 = computeRecordTaskResult(snapshot, '2025-01-15');
    expect(result1.streakCount).toBe(7);
    expect(result1.freezeCount).toBe(1);
    expect(result1.lastFreezeAwardedAtStreak).toBe(7);

    // Second call: idempotent (lastTaskDate === today)
    const result2 = computeRecordTaskResult(result1, '2025-01-15');
    expect(result2).toBe(result1); // same reference
    expect(result2.freezeCount).toBe(1); // still 1, not 2
  });

  it('streak reset: after reset (streak = 0, lastTaskDate = null) → streak goes to 1, lastFreezeAwardedAtStreak = 0', () => {
    const snapshot: StreakSnapshot = {
      ...DEFAULT_SNAPSHOT,
      streakCount: 0,
      freezeCount: 0,
      lastTaskDate: null,
      lastFreezeAwardedAtStreak: 0,
    };
    const result = computeRecordTaskResult(snapshot, '2025-01-15');
    expect(result.streakCount).toBe(1);
    expect(result.longestStreak).toBe(1);
    expect(result.lastTaskDate).toBe('2025-01-15');
    expect(result.lastFreezeAwardedAtStreak).toBe(0); // no award at streak 1
  });
});

describe('computeRecordTaskResult on a specific date', () => {
  it('continues the run when the filtered day is the day after lastTaskDate', () => {
    const snapshot: StreakSnapshot = {
      ...DEFAULT_SNAPSHOT,
      streakCount: 3,
      lastTaskDate: '2025-01-12',
      lastCheckedDate: '2025-01-15',
    };
    const result = computeRecordTaskResult(snapshot, '2025-01-13');
    expect(result.streakCount).toBe(4);
    expect(result.lastTaskDate).toBe('2025-01-13');
    expect(result.lastCheckedDate).toBe('2025-01-15');
  });

  it('extends backward when the filtered day touches the start of the run', () => {
    const snapshot: StreakSnapshot = {
      ...DEFAULT_SNAPSHOT,
      streakCount: 3,
      longestStreak: 3,
      lastTaskDate: '2025-01-14',
    };
    const result = computeRecordTaskResult(snapshot, '2025-01-11');
    expect(result.streakCount).toBe(4);
    expect(result.lastTaskDate).toBe('2025-01-14');
  });

  it('does not reset the current run for a disconnected older day', () => {
    const snapshot: StreakSnapshot = {
      ...DEFAULT_SNAPSHOT,
      streakCount: 5,
      lastTaskDate: '2025-01-15',
    };
    const result = computeRecordTaskResult(snapshot, '2025-01-01');
    expect(result).toBe(snapshot);
  });
});

describe('computeRevokeToday on a specific date', () => {
  it('keeps only the days after a hole inside the run', () => {
    const snapshot: StreakSnapshot = {
      ...DEFAULT_SNAPSHOT,
      streakCount: 5,
      longestStreak: 9,
      freezeCount: 1,
      lastTaskDate: '2025-01-15',
    };
    const result = computeRevokeToday(snapshot, '2025-01-12');
    expect(result.streakCount).toBe(3);
    expect(result.lastTaskDate).toBe('2025-01-15');
    expect(result.longestStreak).toBe(9);
    expect(result.freezeCount).toBe(1);
  });

  it('shortens from the start when the first day of the run is cleared', () => {
    const snapshot: StreakSnapshot = {
      ...DEFAULT_SNAPSHOT,
      streakCount: 4,
      lastTaskDate: '2025-01-14',
    };
    const result = computeRevokeToday(snapshot, '2025-01-11');
    expect(result.streakCount).toBe(3);
    expect(result.lastTaskDate).toBe('2025-01-14');
  });
});
