import { create } from 'zustand';
import { getDB } from '@/services/db';

export interface RoutineTask {
    id: string;
    label: string;
    isFavorite: boolean;
    color?: string;
    icon?: string;
    doItAt?: 'morning' | 'afternoon' | 'evening'; // Time in HH:mm format
    repeat?: 'daily' | 'weekly' | 'monthly';
    repeatValues?: string[]; // weekdays ('Mon') for daily/weekly; day-of-month ('15') for monthly
    endDate?: Date | null;

    createdAt?: Date;
    updatedAt?: Date;
    deletedAt?: Date | null;
}
export interface CandyProps {
    count: number;
    routineTasks: RoutineTask[];
}

export interface CandyState extends CandyProps {
    initialize: () => Promise<void>;
    increment: () => void;
    addRoutineTask: (task: RoutineTask) => Promise<void>;
    deleteRoutineTask: (taskId: string) => Promise<void>;
    updateRoutineTask: (taskId: string, updatedTask: Partial<RoutineTask>) => Promise<void>;
    getRoutineTask: (taskId: string) => RoutineTask | undefined;
}

export type CandyStore = ReturnType<typeof CreateCandyAppStore>

interface RoutineTaskRow {
    id: string;
    label: string;
    is_favorite: number;
    color: string | null;
    icon: string | null;
    do_it_at: string | null;
    repeat: string | null;
    repeat_values: string | null;
    end_date: string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
}

const rowToTask = (row: RoutineTaskRow): RoutineTask => ({
    id: row.id,
    label: row.label,
    isFavorite: row.is_favorite === 1,
    color: row.color ?? undefined,
    icon: row.icon ?? undefined,
    doItAt: row.do_it_at as RoutineTask['doItAt'],
    repeat: row.repeat as RoutineTask['repeat'],
    repeatValues: row.repeat_values ? JSON.parse(row.repeat_values) : undefined,
    endDate: row.end_date ? new Date(row.end_date) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
});

const CreateCandyAppStore = (initProps?: Partial<CandyProps>) => {
    const defaultProps: CandyProps = {
        count: 0,
        routineTasks: [],
    };

    return create<CandyProps & CandyState>()((set, get) => ({
        ...defaultProps,
        ...initProps,
        increment: () => set((prev) => ({ ...prev, count: prev.count + 1 })),
        getRoutineTask: (taskId: string) =>
            get().routineTasks.find((task) => task.id === taskId),
        initialize: async () => {
            const db = await getDB();
            const rows = await db.getAllAsync<RoutineTaskRow>(
                'SELECT * FROM routine_tasks WHERE deleted_at IS NULL'
            );
            const routineTasks = rows.map(rowToTask);
            set({ routineTasks });
        },
        addRoutineTask: async (task: RoutineTask) => {
            const db = await getDB();
            const now = new Date().toISOString();
            const repeatValuesJson = task.repeatValues ? JSON.stringify(task.repeatValues) : null;

            await db.runAsync(
                `INSERT INTO routine_tasks (id, label, is_favorite, color, icon, do_it_at, repeat, repeat_values, end_date, created_at, updated_at, deleted_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    task.id,
                    task.label,
                    task.isFavorite ? 1 : 0,
                    task.color ?? null,
                    task.icon ?? null,
                    task.doItAt ?? null,
                    task.repeat ?? null,
                    repeatValuesJson,
                    task.endDate ? task.endDate.toISOString() : null,
                    now,
                    now,
                    null,
                ]
            );

            set((state) => ({
                routineTasks: [
                    ...state.routineTasks,
                    { ...task, createdAt: new Date(now), updatedAt: new Date(now), deletedAt: null },
                ],
            }));
        },
        deleteRoutineTask: async (taskId: string) => {
            const db = await getDB();
            const now = new Date().toISOString();

            await db.runAsync(
                'UPDATE routine_tasks SET deleted_at = ? WHERE id = ?',
                [now, taskId]
            );

            set((state) => ({
                routineTasks: state.routineTasks.map((task) =>
                    task.id === taskId ? { ...task, deletedAt: new Date(now) } : task
                ),
            }));
        },
        updateRoutineTask: async (taskId: string, updatedTask: Partial<RoutineTask>) => {
            const db = await getDB();
            const now = new Date().toISOString();
            const currentTask = get().routineTasks.find((t) => t.id === taskId);
            if (!currentTask) return;

            const merged = { ...currentTask, ...updatedTask };
            const repeatValuesJson = merged.repeatValues ? JSON.stringify(merged.repeatValues) : null;

            await db.runAsync(
                `UPDATE routine_tasks SET label = ?, is_favorite = ?, color = ?, icon = ?, do_it_at = ?, repeat = ?, repeat_values = ?, end_date = ?, updated_at = ? WHERE id = ?`,
                [
                    merged.label,
                    merged.isFavorite ? 1 : 0,
                    merged.color ?? null,
                    merged.icon ?? null,
                    merged.doItAt ?? null,
                    merged.repeat ?? null,
                    repeatValuesJson,
                    merged.endDate ? merged.endDate.toISOString() : null,
                    now,
                    taskId,
                ]
            );

            set((state) => ({
                routineTasks: state.routineTasks.map((task) =>
                    task.id === taskId ? { ...task, ...updatedTask, updatedAt: new Date(now) } : task
                ),
            }));
        },
    }));
}

export const candyStore = CreateCandyAppStore();
