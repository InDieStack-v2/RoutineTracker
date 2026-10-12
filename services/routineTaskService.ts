import { RoutineTask } from "@/store/candyStore";
import log from "./logger";
import { useSettingsStore } from "@/store/settingsStore";
import { getDB } from "@/services/db";
import {
  localDateToUTCRange,
  toLocalDateString,
  utcToLocalDateString,
  WEEKDAY_KEYS,
  weekdayKey,
} from "@/utils/dateUtils";

export interface UserRoutineTask extends RoutineTask {
  isDone: boolean;
  isHidden: boolean;
}

export type RoutineTaskSummary = {
  id: string;
  label: string;
  icon: string | null;
  color: string | null;
};

const WEEKDAY_SET = new Set<string>(WEEKDAY_KEYS);

// daily: weekdays in repeatValues ("on these days"). Missing values = every day.
// weekly: weekdays in repeatValues, else the weekday of createdAt.
// monthly: day-of-month numbers in repeatValues, else the day of createdAt.
// A selected day past the month's length lands on the last day.
export function isTaskScheduledOn(task: RoutineTask, onDate: Date): boolean {
  const repeat = task.repeat ?? "daily";
  if (repeat === "weekly") return matchesWeekly(task, onDate);
  if (repeat === "monthly") return matchesMonthly(task, onDate);
  return matchesOnTheseDays(task, onDate);
}

function matchesOnTheseDays(task: RoutineTask, onDate: Date): boolean {
  if (task.repeatValues == null) return true;
  return weekdayValues(task.repeatValues).includes(weekdayKey(onDate));
}

function matchesWeekly(task: RoutineTask, onDate: Date): boolean {
  if (task.repeatValues == null) {
    return task.createdAt == null || weekdayKey(task.createdAt) === weekdayKey(onDate);
  }
  return weekdayValues(task.repeatValues).includes(weekdayKey(onDate));
}

function matchesMonthly(task: RoutineTask, onDate: Date): boolean {
  if (task.repeatValues == null) {
    return task.createdAt == null || matchesMonthDay(task.createdAt.getDate(), onDate);
  }
  return monthDayValues(task.repeatValues).some((day) => matchesMonthDay(day, onDate));
}

function weekdayValues(values: string[]): string[] {
  return values.filter((value) => WEEKDAY_SET.has(value));
}

function monthDayValues(values: string[]): number[] {
  const days: number[] = [];
  for (const value of values) {
    if (!/^\d+$/.test(value)) continue;
    const day = Number(value);
    if (day >= 1 && day <= 31) days.push(day);
  }
  return days;
}

function matchesMonthDay(day: number, onDate: Date): boolean {
  const date = onDate.getDate();
  if (date === day) return true;
  const lastDay = new Date(onDate.getFullYear(), onDate.getMonth() + 1, 0).getDate();
  return date === lastDay && day > lastDay;
}

function localDayTime(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function isLiveOnDate(task: RoutineTask, onDate: Date | null): boolean {
  if (task.deletedAt != null) {
    if (onDate == null || new Date(task.deletedAt).getTime() < new Date(onDate).getTime()) {
      return false;
    }
  }
  if (onDate == null) return true;
  if (task.createdAt != null && localDayTime(task.createdAt) > localDayTime(onDate)) {
    return false;
  }
  if (task.endDate != null && localDayTime(task.endDate) < localDayTime(onDate)) {
    return false;
  }
  return true;
}

export function scheduledCompletionRate(
  tasks: RoutineTask[],
  onDate: Date,
  finishedIds: readonly string[],
): number {
  const finished = new Set(finishedIds);
  let available = 0;
  let done = 0;
  for (const task of tasks) {
    if (!isLiveOnDate(task, onDate) || !isTaskScheduledOn(task, onDate)) continue;
    available += 1;
    if (finished.has(task.id)) done += 1;
  }
  return available === 0 ? 0 : done / available;
}

export class RoutineTaskService {
  public static async getFilteredRoutineTasks(
    routineTasks: RoutineTask[],
    onDate: Date | null = null,
    options?: { includeHidden?: boolean },
  ): Promise<UserRoutineTask[]> {
    log.info("[RoutineTaskService] Filtering routine tasks", {
      routineTasks,
      onDate,
    });
    const finishedRoutineTaskIds = await this.getFinishedRoutineTasks(onDate);
    const includeHidden = options?.includeHidden === true;

    return routineTasks
      .filter((task) => isLiveOnDate(task, onDate))
      .map((task) => ({
        ...task,
        isDone: finishedRoutineTaskIds.includes(task.id),
        isHidden: onDate != null && !isTaskScheduledOn(task, onDate),
      }))
      .filter((task) => includeHidden || !task.isHidden);
  }

  public static async markFinishedRoutineTask(
    onDate: Date,
    taskId: string,
    _totalTasksCount?: number,
  ): Promise<void> {
    log.info(
      `[RoutineTaskService] Marking finished routine task: ${taskId} - ${onDate}`,
    );
    const db = await getDB();
    const localDateStr = toLocalDateString(onDate);
    const { start, end } = localDateToUTCRange(localDateStr);
    const completedAtUtc = completionInstantForLocalDate(onDate);

    try {
      // Check if already exists for this date using UTC range
      const existing = await db.getFirstAsync<{ id: number }>(
        "SELECT id FROM task_completions WHERE task_id = ? AND completed_at_utc >= ? AND completed_at_utc < ?",
        [taskId, start, end],
      );

      if (!existing) {
        await db.runAsync(
          "INSERT INTO task_completions (task_id, completed_at_utc) VALUES (?, ?)",
          [taskId, completedAtUtc],
        );
      }
    } catch (error) {
      log.error("[RoutineTaskService] Error setting finished routine task", {
        error,
      });
    }
  }

  public static async deleteFinishedRoutineTask(
    onDate: Date,
    taskId: string,
    _totalTasksCount?: number,
  ): Promise<void> {
    log.info(
      `[RoutineTaskService] Deleting finished routine task: ${taskId} - ${onDate}`,
    );
    const db = await getDB();
    const localDateStr = toLocalDateString(onDate);
    const { start, end } = localDateToUTCRange(localDateStr);

    try {
      await db.runAsync(
        "DELETE FROM task_completions WHERE task_id = ? AND completed_at_utc >= ? AND completed_at_utc < ?",
        [taskId, start, end],
      );
    } catch (error) {
      log.error("[RoutineTaskService] Error deleting finished routine task", {
        error,
      });
    }
  }

  public static async getFinishedRoutineTasks(
    onDate: Date | null = new Date(),
  ): Promise<string[]> {
    log.info("[RoutineTaskService] Getting finished routine tasks", { onDate });

    if (!onDate) {
      return [];
    }

    const db = await getDB();
    const localDateStr = toLocalDateString(onDate);
    const { start, end } = localDateToUTCRange(localDateStr);

    try {
      const results = await db.getAllAsync<{ task_id: string }>(
        "SELECT task_id FROM task_completions WHERE completed_at_utc >= ? AND completed_at_utc < ?",
        [start, end],
      );
      return results.map((row) => row.task_id);
    } catch (error) {
      log.error("[RoutineTaskService] Error getting finished routine tasks", {
        error,
      });
      return [];
    }
  }

  public static async getFinishedRoutineTasksForDates(
    dates: Date[],
  ): Promise<string[][]> {
    log.info("[RoutineTaskService] Getting finished routine tasks for dates", {
      count: dates.length,
    });

    if (dates.length === 0) {
      return [];
    }

    const db = await getDB();
    const localDateStrings = dates.map((d) => toLocalDateString(d));
    const utcRanges = localDateStrings.map((localDateStr) =>
      localDateToUTCRange(localDateStr),
    );

    try {
      // Build a UNION query to fetch all dates at once
      const unionParts = utcRanges.map(() => "SELECT ? as start, ? as end");
      const unionQuery = unionParts.join(" UNION ALL ");
      const rangeParams = utcRanges.flatMap((range) => [range.start, range.end]);

      const results = await db.getAllAsync<{ completed_at_utc: string; task_id: string }>(
        `SELECT tc.completed_at_utc, tc.task_id
         FROM task_completions tc
         JOIN (${unionQuery}) AS ranges
         ON tc.completed_at_utc >= ranges.start AND tc.completed_at_utc < ranges.end`,
        rangeParams,
      );

      // Group task_ids by local date (derived from completed_at_utc)
      const tasksByLocalDate = new Map<string, string[]>();
      for (const localDateStr of localDateStrings) {
        tasksByLocalDate.set(localDateStr, []);
      }
      for (const row of results) {
        const localDateStr = utcToLocalDateString(row.completed_at_utc);
        const existing = tasksByLocalDate.get(localDateStr) || [];
        existing.push(row.task_id);
        tasksByLocalDate.set(localDateStr, existing);
      }

      // Return in same order as input dates
      return localDateStrings.map((dateStr) => tasksByLocalDate.get(dateStr) || []);
    } catch (error) {
      log.error(
        "[RoutineTaskService] Error getting batch finished routine tasks",
        { error },
      );
      // Return empty arrays for all requested dates in case of error
      return dates.map(() => []);
    }
  }

  public static async getRoutineTaskSummaries(
    ids: string[],
  ): Promise<RoutineTaskSummary[]> {
    const unique = [...new Set(ids.filter(Boolean))];
    log.info("[RoutineTaskService] Getting routine task summaries", {
      count: unique.length,
    });

    if (unique.length === 0) {
      return [];
    }

    const db = await getDB();
    const placeholders = unique.map(() => "?").join(", ");

    try {
      return await db.getAllAsync<RoutineTaskSummary>(
        `SELECT id, label, icon, color FROM routine_tasks WHERE id IN (${placeholders})`,
        unique,
      );
    } catch (error) {
      log.error("[RoutineTaskService] Error getting routine task summaries", {
        error,
      });
      return [];
    }
  }


  public static async finishRoutineTask(taskId: string): Promise<void> {
    log.info(`[RoutineTaskService] Finishing routine task: ${taskId}`);
    const onDate = new Date();
    await this.markFinishedRoutineTask(onDate, taskId);
  }

  public static getDailyReminderTime(): Date | null {
    try {
      const reminderTime = useSettingsStore.getState().reminderTime;
      if (reminderTime) {
        const parsedDate = new Date(reminderTime);
        if (!isNaN(parsedDate.getTime())) {
          return parsedDate;
        }

        const hours = parsedDate.getHours();
        const minutes = parsedDate.getMinutes();

        if (!isNaN(hours) && !isNaN(minutes)) {
          log.info("[RoutineTaskService] Daily reminder time parsed", {
            hours,
            minutes,
          });
          
          const date = new Date();
          date.setHours(hours, minutes, 0, 0);
          return date;
        }
        
        log.warn("[RoutineTaskService] Daily reminder time invalid", {
          reminderTime,
        });
        return null;
      }
      return null;
    } catch (error) {
      log.error("[RoutineTaskService] Error getting daily reminder time", {
        error,
      });
      return null;
    }
  }
}

// Today keeps the real clock time. Any other filter day is stored at local noon
// so day counts and reloads attribute the completion to that day, not to now.
function completionInstantForLocalDate(onDate: Date): string {
  const localDateStr = toLocalDateString(onDate);
  if (localDateStr === toLocalDateString(new Date())) {
    return new Date().toISOString();
  }
  const [year, month, day] = localDateStr.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0).toISOString();
}
