import { create } from 'zustand';
import i18n from '@/i18n/index';
import { getDB } from '@/services/db';
import { SYSTEM_TIMEZONE, normalizeTimeZone, setActiveTimeZone } from '@/utils/timezone';
export type Language = 'en' | 'vi';
export type ThemeMode = 'light' | 'dark' | 'system';

export interface SettingsState {
    language: Language;
    theme: ThemeMode;
    reminderTime: string; // Stored as ISO string or "HH:mm"
    timezone: string;
    isLoaded: boolean;
    setLanguage: (lang: Language) => void;
    setTheme: (theme: ThemeMode) => void;
    setReminderTime: (time: Date) => void;
    setTimezone: (timeZone: string) => Promise<void>;
    loadSettings: () => Promise<void>;
}

const DEFAULT_LANGUAGE: Language = 'en';
const DEFAULT_THEME: ThemeMode = 'light';
const DEFAULT_REMINDER_TIME = new Date(new Date().setHours(8, 0, 0, 0)).toISOString();
const DEFAULT_TIMEZONE = SYSTEM_TIMEZONE;

export const useSettingsStore = create<SettingsState>()((set, get) => ({
    language: DEFAULT_LANGUAGE,
    theme: DEFAULT_THEME,
    reminderTime: DEFAULT_REMINDER_TIME,
    timezone: DEFAULT_TIMEZONE,
    isLoaded: false,

    setLanguage: async (lang) => {
        const db = await getDB();
        await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['language', lang]);
        i18n.locale = lang;
        set({ language: lang });
    },

    setTheme: async (theme) => {
        const db = await getDB();
        await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['theme', theme]);
        set({ theme });
    },

    setReminderTime: async (time) => {
        const db = await getDB();
        await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['reminderTime', time.toISOString()]);
        set({ reminderTime: time.toISOString() });
    },

    setTimezone: async (timeZone) => {
        const normalized = normalizeTimeZone(timeZone);
        const db = await getDB();
        await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['timezone', normalized]);
        setActiveTimeZone(normalized);
        set({ timezone: normalized });
    },

    loadSettings: async () => {
        const db = await getDB();

        const languageRow = await db.getFirstAsync<{ value: string }>(
            'SELECT value FROM settings WHERE key = ?',
            ['language']
        );

        const themeRow = await db.getFirstAsync<{ value: string }>(
            'SELECT value FROM settings WHERE key = ?',
            ['theme']
        );

        const reminderTimeRow = await db.getFirstAsync<{ value: string }>(
            'SELECT value FROM settings WHERE key = ?',
            ['reminderTime']
        );

        const timezoneRow = await db.getFirstAsync<{ value: string }>(
            'SELECT value FROM settings WHERE key = ?',
            ['timezone']
        );

        const language = (languageRow?.value as Language) || DEFAULT_LANGUAGE;
        const theme = (themeRow?.value as ThemeMode) || DEFAULT_THEME;
        const reminderTime = reminderTimeRow?.value || DEFAULT_REMINDER_TIME;
        const timezone = normalizeTimeZone(timezoneRow?.value);

        i18n.locale = language;
        setActiveTimeZone(timezone);
        set({
            language,
            theme,
            reminderTime,
            timezone,
            isLoaded: true,
        });
    },
}));
