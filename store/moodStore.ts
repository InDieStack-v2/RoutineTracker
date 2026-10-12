import { create } from 'zustand';
import { getDB, type SQLiteDatabase } from '@/services/db';
import { utcToLocalDateString, localDateToUTCRange, toLocalDateString } from '@/utils/dateUtils';

export type MoodType = 'Great' | 'Good' | 'Okay' | 'Not Good' | 'Bad';

export interface MoodLog {
    date: string; // YYYY-MM-DD
    moodIndex: number; // 0 to 4 corresponding to Emojis
}

export interface MoodState {
    moodLogs: MoodLog[];
    initialize: () => Promise<void>;
    addMoodLog: (log: MoodLog) => Promise<void>;
    getMoodLog: (date: string) => MoodLog | undefined;
}

export const useMoodStore = create<MoodState>()((set, get) => ({
    moodLogs: [],

    initialize: async () => {
        const db = await getDB();
        await seedLastWeekMoods(db);
        const rows = await db.getAllAsync<{ logged_at: string; mood_index: number }>(
            'SELECT logged_at, mood_index FROM mood_logs ORDER BY logged_at'
        );
        const moodLogs: MoodLog[] = rows.map((row) => ({
            date: utcToLocalDateString(row.logged_at),
            moodIndex: row.mood_index,
        }));
        set({ moodLogs });
    },

    addMoodLog: async (log) => {
        const db = await getDB();
        const logged_at = loggedAtForMoodDate(log.date);
        const { start, end } = localDateToUTCRange(log.date);

        // Check if a mood log already exists for this local day
        const existingRow = await db.getFirstAsync<{ logged_at: string }>(
            'SELECT logged_at FROM mood_logs WHERE logged_at >= ? AND logged_at < ?',
            [start, end]
        );

        if (existingRow) {
            // Update existing record for this local day
            await db.runAsync(
                'UPDATE mood_logs SET mood_index = ?, logged_at = ? WHERE logged_at >= ? AND logged_at < ?',
                [log.moodIndex, logged_at, start, end]
            );
        } else {
            // Insert new record
            await db.runAsync(
                'INSERT INTO mood_logs (logged_at, mood_index) VALUES (?, ?)',
                [logged_at, log.moodIndex]
            );
        }

        set((state) => {
            const filteredLogs = state.moodLogs.filter((l) => l.date !== log.date);
            return { moodLogs: [...filteredLogs, log] };
        });
    },

    getMoodLog: (date) => {
        const found = get().moodLogs.find((l) => l.date === date);
        if (found) return found;

        // Lazy-load from DB if not in memory
        const { start, end } = localDateToUTCRange(date);
        getDB()
            .then((db) =>
                db.getFirstAsync<{ logged_at: string; mood_index: number }>(
                    'SELECT logged_at, mood_index FROM mood_logs WHERE logged_at >= ? AND logged_at < ? ORDER BY logged_at DESC LIMIT 1',
                    [start, end]
                )
            )
            .then((row) => {
                if (row) {
                    const log: MoodLog = { date: utcToLocalDateString(row.logged_at), moodIndex: row.mood_index };
                    set((state) => {
                        if (state.moodLogs.some((l) => l.date === date)) return state;
                        return { moodLogs: [...state.moodLogs, log] };
                    });
                }
            })
            .catch((err) => {
                console.error('Failed to load mood log from DB:', err);
            });

        return undefined;
    },
}));

function loggedAtForMoodDate(dateStr: string): string {
    if (dateStr === toLocalDateString(new Date())) {
        return new Date().toISOString();
    }
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0, 0).toISOString();
}

const LAST_WEEK_SAMPLE = [1, 0, 2, 3, 1, 4, 2];

async function seedLastWeekMoods(db: SQLiteDatabase): Promise<void> {
    const today = new Date();
    const weekday = today.getDay();
    const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
    const thisMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + mondayOffset);

    for (let i = 0; i < LAST_WEEK_SAMPLE.length; i++) {
        const date = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() - 7 + i);
        const dateStr = toLocalDateString(date);
        const { start, end } = localDateToUTCRange(dateStr);
        const existing = await db.getFirstAsync<{ logged_at: string }>(
            'SELECT logged_at FROM mood_logs WHERE logged_at >= ? AND logged_at < ?',
            [start, end],
        );
        if (existing) continue;
        await db.runAsync(
            'INSERT INTO mood_logs (logged_at, mood_index) VALUES (?, ?)',
            [loggedAtForMoodDate(dateStr), LAST_WEEK_SAMPLE[i]],
        );
    }
}
