// store/streakStore.ts
import { create } from 'zustand';
import { getDB } from '@/services/db';
import {
  StreakSnapshot,
  DEFAULT_SNAPSHOT,
  computeEvaluateResult,
  computeRecordTaskResult,
  computeRevokeToday,
} from '@/services/streakService';
import { todayLocalDateString } from '@/utils/dateUtils';
import log from '@/services/logger';

const SETTINGS_KEY = 'streak_state';

export interface StreakState extends StreakSnapshot {
  isLoaded: boolean;
  loadStreak: () => Promise<void>;
  evaluateNewDay: () => Promise<void>;
  recordTaskDone: (date?: string) => Promise<void>;
  revokeToday: (date?: string) => Promise<void>;
}

async function persistSnapshot(snapshot: StreakSnapshot): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    [SETTINGS_KEY, JSON.stringify(snapshot)]
  );
}

export const useStreakStore = create<StreakState>()((set, get) => ({
  ...DEFAULT_SNAPSHOT,
  isLoaded: false,

  loadStreak: async () => {
    try {
      const db = await getDB();
      const row = await db.getFirstAsync<{ value: string }>(
        'SELECT value FROM settings WHERE key = ?',
        [SETTINGS_KEY]
      );
      if (row?.value) {
        const parsed: StreakSnapshot = { ...DEFAULT_SNAPSHOT, ...JSON.parse(row.value) };
        set({ ...parsed, isLoaded: true });
      } else {
        set({ isLoaded: true });
      }
    } catch (error) {
      log.error('[StreakStore] loadStreak failed', { error });
      set({ isLoaded: true });
    }
  },

  evaluateNewDay: async () => {
    try {
      const today = todayLocalDateString();
      const current = get();
      const newSnapshot = computeEvaluateResult(current, today);
      if (newSnapshot === current) return; // pure function returned same ref — no change
      await persistSnapshot(newSnapshot);
      set(newSnapshot);
    } catch (error) {
      log.error('[StreakStore] evaluateNewDay failed', { error });
    }
  },

   recordTaskDone: async (date?: string) => {
     try {
       const today = todayLocalDateString();
       const target = date ?? today;
       if (target > today) return;
       const current = get();
       const newSnapshot = computeRecordTaskResult(current, target);
       if (newSnapshot === current) return;
       await persistSnapshot(newSnapshot);
       set(newSnapshot);
       log.info('[StreakStore] streak updated', { streakCount: newSnapshot.streakCount, freezeCount: newSnapshot.freezeCount, date: target });
     } catch (error) {
       log.error('[StreakStore] recordTaskDone failed', { error });
     }
   },

    revokeToday: async (date?: string) => {
     try {
       const today = todayLocalDateString();
       const target = date ?? today;
       if (target > today) return;
       const current = get();
       const newSnapshot = computeRevokeToday(current, target);
       if (newSnapshot === current) return;
       await persistSnapshot(newSnapshot);
       set(newSnapshot);
       log.info('[StreakStore] streak revoked', { streakCount: newSnapshot.streakCount, date: target });
     } catch (error) {
       log.error('[StreakStore] revokeToday failed', { error });
     }
    },
 }));
