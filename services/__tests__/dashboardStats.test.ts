/**
 * @jest-environment node
 *
 * Unit Tests for dashboardStats — averageCompletion and mostMissed
 * Run with: cross-env TZ=America/New_York yarn jest services/__tests__/dashboardStats.test.ts
 */

jest.mock('@/services/db', () => ({ getDB: jest.fn() }));
jest.mock('@/store/settingsStore', () => ({
  useSettingsStore: { getState: jest.fn() },
}));
jest.mock('../logger');

import { averageCompletion, mostMissed } from '../dashboardStats';
import type { RoutineTask } from '@/store/candyStore';

function makeTask(id: string, overrides: Partial<RoutineTask> = {}): RoutineTask {
  return { id, label: id, isFavorite: false, deletedAt: null, ...overrides };
}

// days[0] = Wed 2025-01-15 (today), days[i] = i days earlier. Jan 13 is a Monday.
function makeDays(count: number): Date[] {
  return Array.from({ length: count }, (_, i) => new Date(2025, 0, 15 - i));
}

const empty = (count: number): string[][] => Array.from({ length: count }, () => []);

describe('averageCompletion', () => {
  it('is null when nothing is scheduled', () => {
    expect(averageCompletion([], makeDays(7), empty(7), 7)).toBeNull();
  });

  it('averages the daily rates', () => {
    const tasks = [makeTask('a'), makeTask('b')];
    const finished = empty(2);
    finished[0] = ['a']; // today 50%
    finished[1] = ['a', 'b']; // yesterday 100%
    expect(averageCompletion(tasks, makeDays(2), finished, 2)).toBe(75);
  });

  it('counts a scheduled day with nothing done as 0%', () => {
    expect(averageCompletion([makeTask('a')], makeDays(4), empty(4), 4)).toBe(0);
  });

  it('skips days with nothing scheduled instead of counting them as 0%', () => {
    // Monday-only task: of Jan 15..12 only Mon Jan 13 (index 2) is scheduled
    const tasks = [makeTask('a', { repeat: 'weekly', repeatValues: ['Mon'] })];
    const finished = empty(4);
    finished[2] = ['a'];
    expect(averageCompletion(tasks, makeDays(4), finished, 4)).toBe(100);
  });

  it('only looks at the requested span', () => {
    const finished = empty(30);
    for (let i = 0; i < 7; i += 1) finished[i] = ['a']; // done the last 7 days only
    const tasks = [makeTask('a')];
    expect(averageCompletion(tasks, makeDays(30), finished, 7)).toBe(100);
    expect(averageCompletion(tasks, makeDays(30), finished, 30)).toBe(23); // 7/30
  });

  it('ignores days before a task was created', () => {
    const tasks = [makeTask('a', { createdAt: new Date(2025, 0, 14) })];
    const finished = empty(7);
    finished[0] = ['a'];
    finished[1] = ['a'];
    expect(averageCompletion(tasks, makeDays(7), finished, 7)).toBe(100);
  });

  it('ignores completions of tasks that are not scheduled that day', () => {
    const tasks = [makeTask('a', { repeat: 'weekly', repeatValues: ['Mon'] })];
    const finished = empty(3);
    finished[0] = ['a']; // done on Wed, not scheduled
    expect(averageCompletion(tasks, makeDays(3), finished, 3)).toBe(0); // Monday missed
  });

  it('handles fewer days than the span', () => {
    expect(averageCompletion([makeTask('a')], makeDays(2), [['a'], ['a']], 30)).toBe(100);
  });
});

describe('mostMissed', () => {
  it('is empty when nothing was missed', () => {
    const finished = [[], ['a'], ['a']];
    expect(mostMissed([makeTask('a')], makeDays(3), finished, 30)).toEqual([]);
  });

  it('never counts today as missed', () => {
    expect(mostMissed([makeTask('a')], makeDays(1), empty(1), 30)).toEqual([]);
  });

  it('ranks by misses and drops tasks that were never missed', () => {
    const tasks = [makeTask('a'), makeTask('b'), makeTask('c')];
    const finished = [[], ['a', 'b', 'c'], ['a', 'b'], ['a']];
    // misses: a 0, b 1, c 2
    const result = mostMissed(tasks, makeDays(4), finished, 30);
    expect(result.map((r) => [r.task.id, r.count])).toEqual([
      ['c', 2],
      ['b', 1],
    ]);
  });

  it('returns at most `limit` tasks', () => {
    const tasks = ['a', 'b', 'c', 'd'].map((id) => makeTask(id));
    expect(mostMissed(tasks, makeDays(2), empty(2), 30)).toHaveLength(3);
  });

  it('keeps task order on ties', () => {
    const tasks = [makeTask('b'), makeTask('a')];
    const result = mostMissed(tasks, makeDays(2), empty(2), 30);
    expect(result.map((r) => r.task.id)).toEqual(['b', 'a']);
  });

  it('only counts days where the task was scheduled', () => {
    // Monday-only task: Jan 13 (index 2) is the only scheduled day in range
    const tasks = [makeTask('a', { repeat: 'weekly', repeatValues: ['Mon'] })];
    const result = mostMissed(tasks, makeDays(4), empty(4), 30);
    expect(result.map((r) => r.count)).toEqual([1]);
  });

  it('covers exactly `span` days before today', () => {
    const tasks = [makeTask('a')];
    // days[1..30] are the 30 days before today; days[31] is outside the window
    expect(mostMissed(tasks, makeDays(32), empty(32), 30)[0].count).toBe(30);
    expect(mostMissed(tasks, makeDays(32), empty(32), 7)[0].count).toBe(7);
  });

  it('skips days before the task existed', () => {
    const tasks = [makeTask('a', { createdAt: new Date(2025, 0, 13) })];
    // scheduled Jan 13, 14 (indexes 2, 1) → 2 misses; earlier days not counted
    expect(mostMissed(tasks, makeDays(10), empty(10), 30)[0].count).toBe(2);
  });
});
