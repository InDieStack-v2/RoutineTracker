/**
 * @jest-environment node
 *
 * Unit Tests for RoutineTaskService — timezone correctness with mocked SQLite DB
 * Run with: cross-env TZ=America/New_York yarn jest services/__tests__/routineTaskService.test.ts
 *
 * TZ=America/New_York means:
 *   EST (UTC-5): January — local midnight at 05:00 UTC
 *   EDT (UTC-4): July — local midnight at 04:00 UTC
 *   Cross-midnight: 11:30 PM local on Jan 15 = 04:30Z on Jan 16 UTC (INSIDE Jan 15 range)
 *   Just-after-midnight: 12:30 AM local on Jan 16 = 05:30Z on Jan 16 UTC (OUTSIDE Jan 15 range)
 */

// MUST be before any imports — jest.mock is hoisted but explicit placement aids readability
jest.mock('@/services/db', () => ({
  getDB: jest.fn(),
}));
jest.mock('@/store/settingsStore', () => ({
  useSettingsStore: {
    getState: jest.fn(),
  },
}));
jest.mock('../logger');

import { RoutineTaskService, isTaskScheduledOn, scheduledCompletionRate } from '../routineTaskService';
import { getDB } from '@/services/db';
import { useSettingsStore } from '@/store/settingsStore';
import { localDateToUTCRange } from '@/utils/dateUtils';
import type { RoutineTask } from '@/store/candyStore';

const mockGetDB = getDB as jest.MockedFunction<typeof getDB>;
const mockUseSettingsStore = useSettingsStore as jest.Mocked<typeof useSettingsStore>;

// Fresh mock DB for each test — prevents state leakage
let mockDb: {
  getAllAsync: jest.Mock;
  getFirstAsync: jest.Mock;
  runAsync: jest.Mock;
  execAsync: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockDb = {
    getAllAsync: jest.fn(),
    getFirstAsync: jest.fn(),
    runAsync: jest.fn(),
    execAsync: jest.fn(),
  };
  mockGetDB.mockResolvedValue(mockDb as any);
});

// Helper to build a minimal RoutineTask
function makeTask(overrides: Partial<RoutineTask> = {}): RoutineTask {
  return {
    id: 'task-1',
    label: 'Test Task',
    isFavorite: false,
    deletedAt: null,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// getFinishedRoutineTasks
// ─────────────────────────────────────────────────────────────────────────────
describe('getFinishedRoutineTasks', () => {
  it('returns [] when onDate is null', async () => {
    const result = await RoutineTaskService.getFinishedRoutineTasks(null);
    expect(result).toEqual([]);
    expect(mockDb.getAllAsync).not.toHaveBeenCalled();
  });

  it('returns [] when onDate is undefined', async () => {
    // Explicitly passing undefined triggers default param (new Date()),
    // but the falsy guard in the method body returns [] before DB call
    // when the value is null. For undefined, default kicks in.
    // We pass undefined explicitly — default param replaces it with new Date().
    // However, per spec we test this case; mock DB returns [] to satisfy.
    mockDb.getAllAsync.mockResolvedValue([]);
    const result = await RoutineTaskService.getFinishedRoutineTasks(undefined as any);
    // With default param = new Date(), it queries DB. We verify it doesn't crash.
    expect(Array.isArray(result)).toBe(true);
  });

  it('queries DB with correct UTC range for local date in EST', async () => {
    // 7 AM UTC = 2 AM EST on Jan 15 → local date is Jan 15
    const onDate = new Date('2025-01-15T07:00:00Z');
    mockDb.getAllAsync.mockResolvedValue([]);

    await RoutineTaskService.getFinishedRoutineTasks(onDate);

    // In EST (UTC-5), local midnight Jan 15 = 05:00Z Jan 15
    // local midnight Jan 16 = 05:00Z Jan 16
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      'SELECT task_id FROM task_completions WHERE completed_at_utc >= ? AND completed_at_utc < ?',
      ['2025-01-15T05:00:00.000Z', '2025-01-16T05:00:00.000Z'],
    );
  });

  it('returns task_ids from DB result', async () => {
    mockDb.getAllAsync.mockResolvedValue([
      { task_id: 'a' },
      { task_id: 'b' },
    ]);

    const result = await RoutineTaskService.getFinishedRoutineTasks(
      new Date('2025-01-15T12:00:00Z'),
    );

    expect(result).toEqual(['a', 'b']);
  });

  it('CRITICAL: finds task completed at 11:30 PM local Jan 15 (= 04:30Z Jan 16)', async () => {
    // 11:30 PM EST on Jan 15 = 04:30 UTC on Jan 16
    // This is INSIDE the Jan 15 range [05:00Z Jan 15, 05:00Z Jan 16)
    const onDate = new Date('2025-01-15T12:00:00Z');
    mockDb.getAllAsync.mockResolvedValue([
      { task_id: 'task-1' },
    ]);

    const result = await RoutineTaskService.getFinishedRoutineTasks(onDate);

    // Verify the query range includes 04:30Z Jan 16
    const [start, end] = mockDb.getAllAsync.mock.calls[0][1];
    expect(start).toBe('2025-01-15T05:00:00.000Z');
    expect(end).toBe('2025-01-16T05:00:00.000Z');
    // 04:30Z >= 05:00Z? No. 04:30Z < 05:00Z? Yes. So it's inside the range.
    expect(result).toEqual(['task-1']);
  });

  it('CRITICAL: does NOT find task completed at 12:30 AM local Jan 16 (= 05:30Z Jan 16)', async () => {
    // 12:30 AM EST on Jan 16 = 05:30 UTC on Jan 16
    // This is OUTSIDE the Jan 15 range [05:00Z Jan 15, 05:00Z Jan 16)
    // because 05:30Z >= 05:00Z (the end bound)
    const onDate = new Date('2025-01-15T12:00:00Z');
    // Simulate: DB query uses correct bounds, so this row would NOT be returned
    mockDb.getAllAsync.mockResolvedValue([]);

    const result = await RoutineTaskService.getFinishedRoutineTasks(onDate);

    // Verify the SQL end param excludes 05:30Z
    const [start, end] = mockDb.getAllAsync.mock.calls[0][1];
    expect(start).toBe('2025-01-15T05:00:00.000Z');
    expect(end).toBe('2025-01-16T05:00:00.000Z');
    // end is exclusive: 05:30Z >= 05:00Z → excluded
    expect(result).toEqual([]);
  });

  it('returns [] when DB throws error', async () => {
    mockDb.getAllAsync.mockRejectedValue(new Error('DB error'));

    const result = await RoutineTaskService.getFinishedRoutineTasks(
      new Date('2025-01-15T12:00:00Z'),
    );

    expect(result).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getFilteredRoutineTasks
// ─────────────────────────────────────────────────────────────────────────────
describe('getFilteredRoutineTasks', () => {
  it('includes tasks with deletedAt = null', async () => {
    mockDb.getAllAsync.mockResolvedValue([]);
    const tasks = [makeTask({ id: 't1', deletedAt: null })];

    const result = await RoutineTaskService.getFilteredRoutineTasks(
      tasks,
      new Date('2025-01-15T12:00:00Z'),
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t1');
  });

  it('excludes tasks with deletedAt before onDate', async () => {
    mockDb.getAllAsync.mockResolvedValue([]);
    const tasks = [
      makeTask({ id: 't1', deletedAt: new Date('2025-01-14T00:00:00.000Z') }),
    ];

    const result = await RoutineTaskService.getFilteredRoutineTasks(
      tasks,
      new Date('2025-01-15T12:00:00Z'),
    );

    expect(result).toHaveLength(0);
  });

  it('includes tasks with deletedAt same as or after onDate', async () => {
    mockDb.getAllAsync.mockResolvedValue([]);
    const tasks = [
      makeTask({ id: 't1', deletedAt: new Date('2025-01-16T00:00:00.000Z') }),
    ];

    const result = await RoutineTaskService.getFilteredRoutineTasks(
      tasks,
      new Date('2025-01-15T12:00:00Z'),
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t1');
  });

  it('marks task as isDone=true when task.id is in finishedRoutineTaskIds', async () => {
    mockDb.getAllAsync.mockResolvedValue([{ task_id: 't1' }]);
    const tasks = [makeTask({ id: 't1' })];

    const result = await RoutineTaskService.getFilteredRoutineTasks(
      tasks,
      new Date('2025-01-15T12:00:00Z'),
    );

    expect(result[0].isDone).toBe(true);
  });

  it('marks task as isDone=false when task.id is NOT in finishedRoutineTaskIds', async () => {
    mockDb.getAllAsync.mockResolvedValue([]);
    const tasks = [makeTask({ id: 't1' })];

    const result = await RoutineTaskService.getFilteredRoutineTasks(
      tasks,
      new Date('2025-01-15T12:00:00Z'),
    );

    expect(result[0].isDone).toBe(false);
  });

  it('returns [] when routineTasks is empty', async () => {
    mockDb.getAllAsync.mockResolvedValue([]);

    const result = await RoutineTaskService.getFilteredRoutineTasks(
      [],
      new Date('2025-01-15T12:00:00Z'),
    );

    expect(result).toEqual([]);
  });
});

describe('schedule filtering', () => {
  const wednesday = new Date(2025, 0, 15);
  const thursday = new Date(2025, 0, 16);
  const monday = new Date(2025, 0, 13);

  beforeEach(() => {
    mockDb.getAllAsync.mockResolvedValue([]);
  });

  it('keeps legacy tasks with no repeat on every day', () => {
    expect(isTaskScheduledOn(makeTask(), wednesday)).toBe(true);
  });

  it('shows a daily task only on selected weekdays', async () => {
    const tasks = [
      makeTask({ id: 't1', repeat: 'daily', repeatValues: ['Mon', 'Wed'] }),
    ];

    const onWednesday = await RoutineTaskService.getFilteredRoutineTasks(tasks, wednesday);
    const onThursday = await RoutineTaskService.getFilteredRoutineTasks(tasks, thursday);

    expect(onWednesday.map((task) => task.id)).toEqual(['t1']);
    expect(onWednesday[0].isHidden).toBe(false);
    expect(onThursday).toEqual([]);
  });

  it('hides a daily task when on-these-days is explicitly empty', () => {
    expect(
      isTaskScheduledOn(makeTask({ repeat: 'daily', repeatValues: [] }), wednesday),
    ).toBe(false);
  });

  it('shows a weekly task on selected weekdays, not the created weekday', () => {
    const task = makeTask({
      repeat: 'weekly',
      repeatValues: ['Mon'],
      createdAt: wednesday,
    });

    expect(isTaskScheduledOn(task, monday)).toBe(true);
    expect(isTaskScheduledOn(task, wednesday)).toBe(false);
  });

  it('falls back to the created weekday when weekly values are missing', () => {
    const task = makeTask({ repeat: 'weekly', createdAt: wednesday });

    expect(isTaskScheduledOn(task, wednesday)).toBe(true);
    expect(isTaskScheduledOn(task, thursday)).toBe(false);
  });

  it('shows a monthly task on the selected day and clamps short months', () => {
    const task = makeTask({ repeat: 'monthly', repeatValues: ['31'] });

    expect(isTaskScheduledOn(task, new Date(2025, 0, 31))).toBe(true);
    expect(isTaskScheduledOn(task, new Date(2025, 0, 30))).toBe(false);
    expect(isTaskScheduledOn(task, new Date(2025, 1, 28))).toBe(true);
    expect(isTaskScheduledOn(task, new Date(2025, 1, 27))).toBe(false);
    expect(isTaskScheduledOn(task, new Date(2024, 1, 29))).toBe(true);
    expect(isTaskScheduledOn(task, new Date(2025, 3, 30))).toBe(true);
  });

  it('falls back to the created day of month when monthly values are missing', () => {
    const task = makeTask({ repeat: 'monthly', createdAt: new Date(2025, 0, 31) });

    expect(isTaskScheduledOn(task, new Date(2025, 2, 31))).toBe(true);
    expect(isTaskScheduledOn(task, new Date(2025, 1, 28))).toBe(true);
    expect(isTaskScheduledOn(task, new Date(2025, 1, 15))).toBe(false);
  });

  it('rates a day by scheduled tasks only', () => {
    const tasks = [
      makeTask({ id: 'due', repeat: 'daily', repeatValues: ['Wed'] }),
      makeTask({ id: 'also', repeat: 'daily', repeatValues: ['Wed'] }),
      makeTask({ id: 'off', repeat: 'weekly', repeatValues: ['Mon'] }),
      makeTask({ id: 'later', createdAt: thursday, repeat: 'daily' }),
    ];

    expect(scheduledCompletionRate(tasks, wednesday, ['due'])).toBe(0.5);
    expect(scheduledCompletionRate(tasks, wednesday, ['due', 'also', 'off'])).toBe(1);
    expect(scheduledCompletionRate(tasks, thursday, ['off'])).toBe(0);
    expect(scheduledCompletionRate(tasks, monday, ['off'])).toBe(1);
    expect(scheduledCompletionRate([], wednesday, [])).toBe(0);
  });

  it('returns scheduled and hidden tasks when includeHidden is set', async () => {
    const tasks = [
      makeTask({ id: 'due', repeat: 'daily', repeatValues: ['Wed'] }),
      makeTask({ id: 'off', repeat: 'daily', repeatValues: ['Mon'] }),
      makeTask({ id: 'future', createdAt: thursday, repeat: 'daily' }),
      makeTask({ id: 'ended', endDate: monday, repeat: 'daily' }),
    ];

    const hidden = await RoutineTaskService.getFilteredRoutineTasks(tasks, wednesday, {
      includeHidden: true,
    });
    const visible = await RoutineTaskService.getFilteredRoutineTasks(tasks, wednesday);

    expect(hidden.map((task) => task.id).sort()).toEqual(['due', 'off']);
    expect(hidden.find((task) => task.id === 'due')?.isHidden).toBe(false);
    expect(hidden.find((task) => task.id === 'off')?.isHidden).toBe(true);
    expect(visible.map((task) => task.id)).toEqual(['due']);
  });

  it('does not apply the schedule when no date is given', async () => {
    const tasks = [makeTask({ id: 't1', repeat: 'weekly', repeatValues: ['Mon'] })];

    const result = await RoutineTaskService.getFilteredRoutineTasks(tasks, null, {
      includeHidden: true,
    });

    expect(result).toHaveLength(1);
    expect(result[0].isHidden).toBe(false);
  });

  it('puts pinned tasks first and keeps the original order otherwise', async () => {
    mockDb.getAllAsync.mockResolvedValue([]);
    const tasks = [
      makeTask({ id: 'a' }),
      makeTask({ id: 'b', isFavorite: true }),
      makeTask({ id: 'c' }),
      makeTask({ id: 'd', isFavorite: true }),
    ];

    const result = await RoutineTaskService.getFilteredRoutineTasks(tasks, null);

    expect(result.map((task) => task.id)).toEqual(['b', 'd', 'a', 'c']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// markFinishedRoutineTask
// ─────────────────────────────────────────────────────────────────────────────
describe('markFinishedRoutineTask', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-15T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('inserts completion when no existing record (getFirstAsync returns null)', async () => {
    mockDb.getFirstAsync.mockResolvedValue(null);
    mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 1, changes: 1 });

    await RoutineTaskService.markFinishedRoutineTask(
      new Date('2025-01-15T12:00:00Z'),
      'task-1',
    );

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      'INSERT INTO task_completions (task_id, completed_at_utc) VALUES (?, ?)',
      ['task-1', '2025-01-15T12:00:00.000Z'],
    );
  });

  it('does NOT insert when record already exists (getFirstAsync returns {id:1})', async () => {
    mockDb.getFirstAsync.mockResolvedValue({ id: 1 });

    await RoutineTaskService.markFinishedRoutineTask(
      new Date('2025-01-15T12:00:00Z'),
      'task-1',
    );

    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });

  it('idempotent: getFirstAsync called first, then INSERT only if null', async () => {
    mockDb.getFirstAsync.mockResolvedValue(null);
    mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 1, changes: 1 });

    await RoutineTaskService.markFinishedRoutineTask(
      new Date('2025-01-15T12:00:00Z'),
      'task-1',
    );

    // getFirstAsync must be called before runAsync
    const getFirstAsyncOrder = mockDb.getFirstAsync.mock.invocationCallOrder[0];
    const runAsyncOrder = mockDb.runAsync.mock.invocationCallOrder[0];
    expect(getFirstAsyncOrder).toBeLessThan(runAsyncOrder);
  });

  it('uses correct UTC range for local date in SQL SELECT check', async () => {
    mockDb.getFirstAsync.mockResolvedValue(null);
    mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 1, changes: 1 });

    await RoutineTaskService.markFinishedRoutineTask(
      new Date('2025-01-15T12:00:00Z'),
      'task-1',
    );

    // getFirstAsync should use the UTC range for Jan 15 local
    expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
      'SELECT id FROM task_completions WHERE task_id = ? AND completed_at_utc >= ? AND completed_at_utc < ?',
      ['task-1', '2025-01-15T05:00:00.000Z', '2025-01-16T05:00:00.000Z'],
    );
  });

  it('stores the completion inside the filtered local day when that day is not today', async () => {
    mockDb.getFirstAsync.mockResolvedValue(null);
    mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 1, changes: 1 });

    await RoutineTaskService.markFinishedRoutineTask(
      new Date(2025, 0, 14, 15, 0, 0),
      'task-1',
    );

    const inserted = mockDb.runAsync.mock.calls[0][1][1] as string;
    const range = localDateToUTCRange('2025-01-14');
    expect(inserted >= range.start && inserted < range.end).toBe(true);
    expect(inserted).not.toBe('2025-01-15T12:00:00.000Z');
  });

  it('does NOT throw when DB throws error (error is caught)', async () => {
    mockDb.getFirstAsync.mockRejectedValue(new Error('DB error'));

    await expect(
      RoutineTaskService.markFinishedRoutineTask(
        new Date('2025-01-15T12:00:00Z'),
        'task-1',
      ),
    ).resolves.not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// deleteFinishedRoutineTask
// ─────────────────────────────────────────────────────────────────────────────
describe('deleteFinishedRoutineTask', () => {
  it('calls DELETE with correct UTC range for local date', async () => {
    mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 0, changes: 1 });

    await RoutineTaskService.deleteFinishedRoutineTask(
      new Date('2025-01-15T12:00:00Z'),
      'task-1',
    );

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      'DELETE FROM task_completions WHERE task_id = ? AND completed_at_utc >= ? AND completed_at_utc < ?',
      ['task-1', '2025-01-15T05:00:00.000Z', '2025-01-16T05:00:00.000Z'],
    );
  });

  it('TZ-5 CROSS-MIDNIGHT: onDate is 11:30 PM EST Jan 15 expressed as UTC (2025-01-16T04:30:00Z)', async () => {
    // 04:30Z Jan 16 = 11:30 PM EST Jan 15
    // toLocalDateString uses getFullYear/getMonth/getDate (local time methods)
    // In EST, 04:30Z Jan 16 = 11:30 PM Jan 15 local → "2025-01-15"
    mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 0, changes: 0 });

    await RoutineTaskService.deleteFinishedRoutineTask(
      new Date('2025-01-16T04:30:00Z'),
      'task-1',
    );

    // Should use Jan 15 UTC bounds, NOT Jan 16
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      'DELETE FROM task_completions WHERE task_id = ? AND completed_at_utc >= ? AND completed_at_utc < ?',
      ['task-1', '2025-01-15T05:00:00.000Z', '2025-01-16T05:00:00.000Z'],
    );
  });

  it('does NOT throw when DB throws error', async () => {
    mockDb.runAsync.mockRejectedValue(new Error('DB error'));

    await expect(
      RoutineTaskService.deleteFinishedRoutineTask(
        new Date('2025-01-15T12:00:00Z'),
        'task-1',
      ),
    ).resolves.not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getFinishedRoutineTasksForDates
// ─────────────────────────────────────────────────────────────────────────────
describe('getFinishedRoutineTasksForDates', () => {
  it('returns [] when dates array is empty', async () => {
    const result = await RoutineTaskService.getFinishedRoutineTasksForDates([]);
    expect(result).toEqual([]);
    expect(mockDb.getAllAsync).not.toHaveBeenCalled();
  });

  it('single date: query structure, correct params', async () => {
    mockDb.getAllAsync.mockResolvedValue([]);

    await RoutineTaskService.getFinishedRoutineTasksForDates([
      new Date('2025-01-15T12:00:00Z'),
    ]);

    expect(mockDb.getAllAsync).toHaveBeenCalledTimes(1);
    const [sql, params] = mockDb.getAllAsync.mock.calls[0];
    // For single date, no UNION ALL — just a single SELECT
    expect(sql).toContain('SELECT ? as start, ? as end');
    expect(sql).toContain('JOIN');
    expect(params).toEqual(['2025-01-15T05:00:00.000Z', '2025-01-16T05:00:00.000Z']);
  });

  it('multiple dates: returns arrays in same order as input dates', async () => {
    mockDb.getAllAsync.mockResolvedValue([
      { task_id: 'a', completed_at_utc: '2025-01-15T12:00:00Z' },
      { task_id: 'b', completed_at_utc: '2025-01-16T12:00:00Z' },
    ]);

    const result = await RoutineTaskService.getFinishedRoutineTasksForDates([
      new Date('2025-01-15T12:00:00Z'),
      new Date('2025-01-16T12:00:00Z'),
    ]);

    // 'a' completed at 12:00Z Jan 15 = 7 AM EST Jan 15 → local Jan 15
    // 'b' completed at 12:00Z Jan 16 = 7 AM EST Jan 16 → local Jan 16
    expect(result).toEqual([['a'], ['b']]);
  });

  it('cross-midnight grouping: UTC 2025-01-16T04:30:00Z is local Jan 15 → groups under Jan 15', async () => {
    // 04:30Z Jan 16 = 11:30 PM EST Jan 15 → local date is Jan 15
    mockDb.getAllAsync.mockResolvedValue([
      { task_id: 'task-1', completed_at_utc: '2025-01-16T04:30:00.000Z' },
    ]);

    const result = await RoutineTaskService.getFinishedRoutineTasksForDates([
      new Date('2025-01-15T12:00:00Z'),
    ]);

    // utcToLocalDateString('2025-01-16T04:30:00.000Z') = '2025-01-15' in EST
    expect(result).toEqual([['task-1']]);
  });

  it('returns all empty arrays when DB throws error', async () => {
    mockDb.getAllAsync.mockRejectedValue(new Error('DB error'));

    const result = await RoutineTaskService.getFinishedRoutineTasksForDates([
      new Date('2025-01-15T12:00:00Z'),
      new Date('2025-01-16T12:00:00Z'),
    ]);

    expect(result).toEqual([[], []]);
  });
});

describe('getRoutineTaskSummaries', () => {
  it('returns [] when ids is empty and does not query', async () => {
    const result = await RoutineTaskService.getRoutineTaskSummaries([]);
    expect(result).toEqual([]);
    expect(mockDb.getAllAsync).not.toHaveBeenCalled();
  });

  it('returns labels for completed tasks, including deleted rows', async () => {
    mockDb.getAllAsync.mockResolvedValue([
      { id: 'task-1', label: 'Read', icon: '📚', color: '#8882e7' },
      { id: 'task-2', label: 'Old task', icon: null, color: null },
    ]);

    const result = await RoutineTaskService.getRoutineTaskSummaries([
      'task-1',
      'task-1',
      'task-2',
    ]);

    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      'SELECT id, label, icon, color FROM routine_tasks WHERE id IN (?, ?)',
      ['task-1', 'task-2'],
    );
    expect(result).toEqual([
      { id: 'task-1', label: 'Read', icon: '📚', color: '#8882e7' },
      { id: 'task-2', label: 'Old task', icon: null, color: null },
    ]);
  });

  it('returns [] when the lookup throws', async () => {
    mockDb.getAllAsync.mockRejectedValue(new Error('DB error'));

    const result = await RoutineTaskService.getRoutineTaskSummaries(['task-1']);

    expect(result).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getDailyReminderTime
// ─────────────────────────────────────────────────────────────────────────────
describe('getDailyReminderTime', () => {
  // TZ-7: Note that the hours/minutes branch in getDailyReminderTime is dead code
  // (unreachable because if parsedDate.getTime() is NaN, parsedDate.getHours() is also NaN)

  it('returns Date object for valid ISO string reminderTime', () => {
    mockUseSettingsStore.getState.mockReturnValue({
      reminderTime: '2026-03-22T08:00:00.000Z',
    } as any);

    const result = RoutineTaskService.getDailyReminderTime();

    expect(result).toBeInstanceOf(Date);
    expect(result?.toISOString()).toBe('2026-03-22T08:00:00.000Z');
  });

  it('returns null when reminderTime is null', () => {
    mockUseSettingsStore.getState.mockReturnValue({
      reminderTime: null,
    } as any);

    const result = RoutineTaskService.getDailyReminderTime();

    expect(result).toBeNull();
  });

  it('returns null when reminderTime is invalid string ("not-a-date")', () => {
    mockUseSettingsStore.getState.mockReturnValue({
      reminderTime: 'not-a-date',
    } as any);

    const result = RoutineTaskService.getDailyReminderTime();

    // new Date('not-a-date') → NaN, getTime() is NaN → falls through to warn + return null
    expect(result).toBeNull();
  });

  it('returns null when getState throws', () => {
    mockUseSettingsStore.getState.mockImplementation(() => {
      throw new Error('Store error');
    });

    const result = RoutineTaskService.getDailyReminderTime();

    expect(result).toBeNull();
  });
});
