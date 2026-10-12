// services/streakService.ts
import { toLocalDateString } from '@/utils/dateUtils';

export const FREEZE_CAP = 3;
export const FREEZE_AWARD_INTERVAL = 7;

export interface StreakSnapshot {
  streakCount: number;
  longestStreak: number;
  freezeCount: number;
  lastTaskDate: string | null;   // YYYY-MM-DD local
  lastCheckedDate: string | null; // YYYY-MM-DD local
  lastFreezeAwardedAtStreak: number;
}

export const DEFAULT_SNAPSHOT: StreakSnapshot = {
  streakCount: 0,
  longestStreak: 0,
  freezeCount: 0,
  lastTaskDate: null,
  lastCheckedDate: null,
  lastFreezeAwardedAtStreak: 0,
};

/**
 * Days B is after A (both YYYY-MM-DD local date strings).
 * Uses local-time Date constructor to avoid UTC offset issues.
 * e.g. daysBetween('2025-01-14', '2025-01-15') === 1
 */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const dateA = new Date(ay, am - 1, ad);
  const dateB = new Date(by, bm - 1, bd);
  return Math.round((dateB.getTime() - dateA.getTime()) / 86400000);
}

/**
 * Return the YYYY-MM-DD local date string for the day before dateStr.
 */
export function getYesterday(dateStr: string): string {
  return shiftDate(dateStr, -1);
}

function shiftDate(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return toLocalDateString(new Date(year, month - 1, day + days));
}

function streakStartDate(lastTaskDate: string, streakCount: number): string {
  return shiftDate(lastTaskDate, -(Math.max(streakCount, 1) - 1));
}

function applyStreak(
  snapshot: StreakSnapshot,
  streakCount: number,
  lastTaskDate: string,
  freezeCount: number,
): StreakSnapshot {
  let nextFreeze = freezeCount;
  let awardedAt = snapshot.lastFreezeAwardedAtStreak;
  if (
    streakCount > 0 &&
    streakCount % FREEZE_AWARD_INTERVAL === 0 &&
    streakCount > awardedAt
  ) {
    nextFreeze = Math.min(FREEZE_CAP, nextFreeze + 1);
    awardedAt = streakCount;
  }
  const lastCheckedDate =
    snapshot.lastCheckedDate && snapshot.lastCheckedDate > lastTaskDate
      ? snapshot.lastCheckedDate
      : lastTaskDate;
  return {
    streakCount,
    longestStreak: Math.max(snapshot.longestStreak, streakCount),
    freezeCount: nextFreeze,
    lastTaskDate,
    lastCheckedDate,
    lastFreezeAwardedAtStreak: awardedAt,
  };
}

// A day before the current run only extends it when it touches the start,
// or when freezes cover the gap. A disconnected older day must not reset it.
function recordEarlierDate(snapshot: StreakSnapshot, date: string): StreakSnapshot {
  const { lastTaskDate, streakCount, freezeCount } = snapshot;
  if (!lastTaskDate || streakCount <= 0) return snapshot;
  const start = streakStartDate(lastTaskDate, streakCount);
  if (date >= start) return snapshot;

  const missedBefore = daysBetween(date, start) - 1;
  if (missedBefore === 0) {
    return applyStreak(snapshot, streakCount + 1, lastTaskDate, freezeCount);
  }
  if (missedBefore > 0 && freezeCount >= missedBefore) {
    return applyStreak(snapshot, streakCount + 1, lastTaskDate, freezeCount - missedBefore);
  }
  return snapshot;
}

/**
 * Evaluate day transition: consumes freezes or resets streak for missed days.
 * Call on every app foreground event. Idempotent — safe to call many times/day.
 * Returns same snapshot reference if no change (for cheap equality checks).
 */
export function computeEvaluateResult(
  snapshot: StreakSnapshot,
  today: string,
): StreakSnapshot {
  const { lastCheckedDate, lastTaskDate, streakCount, freezeCount } = snapshot;

  // Idempotent: already evaluated today
  if (lastCheckedDate === today) return snapshot;

  // No prior activity — nothing to evaluate, just record today
  if (!lastTaskDate || lastTaskDate === today) {
    return { ...snapshot, lastCheckedDate: today };
  }

  const daysSince = daysBetween(lastTaskDate, today);

  // Completed yesterday or same day — no gap, streak intact
  if (daysSince <= 1) {
    return { ...snapshot, lastCheckedDate: today };
  }

  // Gap: (daysSince - 1) missed days
  const missedDays = daysSince - 1;

  if (freezeCount >= missedDays) {
    // Freezes cover the entire gap
    return {
      ...snapshot,
      freezeCount: Math.max(0, freezeCount - missedDays),
      // Fast-forward lastTaskDate to yesterday so recordTaskDone sees daysSince = 1
      lastTaskDate: getYesterday(today),
      lastCheckedDate: today,
    };
  } else {
    // Streak broken — not enough freezes
    return {
      ...snapshot,
      streakCount: 0,
      freezeCount: 0,
      lastTaskDate: null,
      lastCheckedDate: today,
      lastFreezeAwardedAtStreak: 0,
    };
  }
}

/**
 * Drop `today` from the current run. The tip rolls back one day. A hole inside
 * the run keeps only the days after it. Freezes already earned stay earned.
 * Returns the same snapshot reference if that date was not in the run.
 */
export function computeRevokeToday(
  snapshot: StreakSnapshot,
  today: string,
): StreakSnapshot {
  const { lastTaskDate, streakCount } = snapshot;
  if (!lastTaskDate || streakCount <= 0) return snapshot;
  const start = streakStartDate(lastTaskDate, streakCount);
  if (today < start || today > lastTaskDate) return snapshot;

  if (today === lastTaskDate) {
    const newStreak = Math.max(0, streakCount - 1);
    return {
      ...snapshot,
      streakCount: newStreak,
      lastTaskDate: newStreak > 0 ? getYesterday(today) : null,
    };
  }

  return {
    ...snapshot,
    streakCount: daysBetween(today, lastTaskDate),
  };
}

/**
 * Record that `today` has at least one finished task. The argument is the
 * filtered local date, not necessarily the real today. A later disconnected
 * day still starts a new run. An earlier day only extends the current run
 * when it connects. Idempotent if that date is already in the run.
 */
export function computeRecordTaskResult(
  snapshot: StreakSnapshot,
  today: string,
): StreakSnapshot {
  const { lastTaskDate, streakCount, longestStreak, freezeCount, lastFreezeAwardedAtStreak } = snapshot;

  if (lastTaskDate === today) return snapshot;

  let newStreak: number;
  let newFreezeCount = freezeCount;

  if (!lastTaskDate) {
    newStreak = 1;
  } else {
    const daysSince = daysBetween(lastTaskDate, today);
    if (daysSince === 1) {
      newStreak = streakCount + 1;
    } else if (daysSince > 1) {
      const missedDays = daysSince - 1;
      if (newFreezeCount >= missedDays) {
        newFreezeCount = Math.max(0, newFreezeCount - missedDays);
        newStreak = streakCount + 1;
      } else {
        newFreezeCount = 0;
        newStreak = 1;
      }
    } else {
      return recordEarlierDate(snapshot, today);
    }
  }

  // Award 1 freeze at each FREEZE_AWARD_INTERVAL milestone, capped at FREEZE_CAP
  let newLastFreezeAwardedAtStreak = lastFreezeAwardedAtStreak;
  if (
    newStreak > 0 &&
    newStreak % FREEZE_AWARD_INTERVAL === 0 &&
    newStreak > lastFreezeAwardedAtStreak
  ) {
    newFreezeCount = Math.min(FREEZE_CAP, newFreezeCount + 1);
    newLastFreezeAwardedAtStreak = newStreak;
  }

  return {
    streakCount: newStreak,
    longestStreak: Math.max(longestStreak, newStreak),
    freezeCount: newFreezeCount,
    lastTaskDate: today,
    lastCheckedDate:
      snapshot.lastCheckedDate && snapshot.lastCheckedDate > today
        ? snapshot.lastCheckedDate
        : today,
    lastFreezeAwardedAtStreak: newLastFreezeAwardedAtStreak,
  };

}
