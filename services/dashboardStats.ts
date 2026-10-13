import type { RoutineTask } from "@/store/candyStore";
import { scheduledCompletionRate, scheduledTaskIds } from "./routineTaskService";

// days[0] is today, days[i] is i days ago; finished[i] holds the task ids done on days[i].

// Mean of the daily completion rate over the last `span` days (0-100, rounded).
// Days with nothing scheduled are skipped; null when no day had anything scheduled.
export function averageCompletion(
  tasks: RoutineTask[],
  days: Date[],
  finished: string[][],
  span: number,
): number | null {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < Math.min(span, days.length); i += 1) {
    if (scheduledTaskIds(tasks, days[i]).length === 0) continue;
    sum += scheduledCompletionRate(tasks, days[i], finished[i] ?? []);
    count += 1;
  }
  return count === 0 ? null : Math.round((sum / count) * 100);
}

// Tasks most often scheduled but not finished over the `span` days before today.
// Today is excluded: it is still in progress. Ties keep task order.
export function mostMissed(
  tasks: RoutineTask[],
  days: Date[],
  finished: string[][],
  span: number,
  limit = 3,
): { task: RoutineTask; count: number }[] {
  const missed = new Map<string, number>();
  for (let i = 1; i <= Math.min(span, days.length - 1); i += 1) {
    const done = new Set(finished[i] ?? []);
    for (const id of scheduledTaskIds(tasks, days[i])) {
      if (!done.has(id)) missed.set(id, (missed.get(id) ?? 0) + 1);
    }
  }
  return tasks
    .filter((task) => missed.has(task.id))
    .map((task) => ({ task, count: missed.get(task.id) ?? 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
