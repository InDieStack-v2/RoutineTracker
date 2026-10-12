import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import log from './logger';

export type SQLiteDatabase = SQLite.SQLiteDatabase;

let _db: SQLiteDatabase | null = null;

const SCHEMA_VERSION = 2;

const MIGRATIONS: (string | ((db: SQLiteDatabase) => Promise<void>))[] = [
  // Version 1: Initial schema
  `
    CREATE TABLE IF NOT EXISTS routine_tasks (
      id TEXT PRIMARY KEY NOT NULL,
      label TEXT NOT NULL,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      color TEXT,
      icon TEXT,
      do_it_at TEXT,
      repeat TEXT,
      repeat_values TEXT,
      end_date TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS task_completions (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      task_id TEXT NOT NULL,
      date TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES routine_tasks(id) ON DELETE CASCADE,
      UNIQUE(task_id, date)
    );

    CREATE INDEX IF NOT EXISTS idx_task_completions_task_id ON task_completions(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_completions_date ON task_completions(date);

    CREATE TABLE IF NOT EXISTS mood_logs (
      date TEXT PRIMARY KEY NOT NULL,
      mood_index INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `,

  // Version 2: Migrate task_completions and mood_logs to use UTC datetime
  async function migrateV2(db: SQLiteDatabase): Promise<void> {
    await db.withExclusiveTransactionAsync(async (tx) => {
      // Disable foreign keys during migration
      await tx.execAsync('PRAGMA foreign_keys = OFF');

      try {
        // Idempotency guards: drop new tables if they exist
        await tx.execAsync('DROP TABLE IF EXISTS new_task_completions');
        await tx.execAsync('DROP TABLE IF EXISTS new_mood_logs');

        // Create new_task_completions table with UTC datetime column
        await tx.execAsync(`
          CREATE TABLE new_task_completions (
            id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
            task_id TEXT NOT NULL,
            completed_at_utc TEXT NOT NULL,
            FOREIGN KEY (task_id) REFERENCES routine_tasks(id) ON DELETE CASCADE
          )
        `);

        // Create new_mood_logs table with UTC datetime column
        await tx.execAsync(`
          CREATE TABLE new_mood_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
            logged_at TEXT NOT NULL,
            mood_index INTEGER NOT NULL
          )
        `);

        // Migrate existing data from task_completions
        const completions = await tx.getAllAsync<{ id: number; task_id: string; date: string; completed_at: string }>(
          'SELECT id, task_id, date, completed_at FROM task_completions'
        );
        for (const row of completions) {
          const [y, m, d] = row.date.split('-').map(Number);
          const completedAtUTC = new Date(y, m - 1, d).toISOString();
          await tx.runAsync(
            'INSERT INTO new_task_completions (id, task_id, completed_at_utc) VALUES (?, ?, ?)',
            row.id,
            row.task_id,
            completedAtUTC
          );
        }

        // Migrate existing data from mood_logs
        const moodLogs = await tx.getAllAsync<{ date: string; mood_index: number }>(
          'SELECT date, mood_index FROM mood_logs'
        );
        for (const row of moodLogs) {
          const [y, m, d] = row.date.split('-').map(Number);
          const loggedAtUTC = new Date(y, m - 1, d).toISOString();
          await tx.runAsync(
            'INSERT INTO new_mood_logs (logged_at, mood_index) VALUES (?, ?)',
            loggedAtUTC,
            row.mood_index
          );
        }

        // Drop old tables
        await tx.execAsync('DROP TABLE IF EXISTS task_completions');
        await tx.execAsync('DROP TABLE IF EXISTS mood_logs');

        // Rename new tables
        await tx.execAsync('ALTER TABLE new_task_completions RENAME TO task_completions');
        await tx.execAsync('ALTER TABLE new_mood_logs RENAME TO mood_logs');

        // Recreate indexes
        await tx.execAsync('CREATE INDEX idx_task_completions_task_id ON task_completions(task_id)');
        await tx.execAsync('CREATE INDEX idx_task_completions_completed_at ON task_completions(completed_at_utc)');
      } finally {
        // Re-enable foreign keys
        await tx.execAsync('PRAGMA foreign_keys = ON');
      }
    });
  },
];

async function runMigrations(db: SQLiteDatabase): Promise<void> {
  log.info('[DB] Running database migrations');

  // Get current schema version
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = result?.user_version ?? 0;

  log.info('[DB] Current schema version:', { currentVersion, targetVersion: SCHEMA_VERSION });

  if (currentVersion >= SCHEMA_VERSION) {
    log.info('[DB] Schema is up to date, no migrations needed');
    return;
  }

  // Run pending migrations
  for (let version = currentVersion + 1; version <= SCHEMA_VERSION; version++) {
    const migrationIndex = version - 1;
    if (migrationIndex < MIGRATIONS.length) {
      log.info(`[DB] Running migration to version ${version}`);
      try {
        const migration = MIGRATIONS[migrationIndex];
        if (typeof migration === 'function') {
          await migration(db);
        } else {
          await db.execAsync(migration);
        }
      } catch (error) {
        log.error(`[DB] Migration to version ${version} failed`, { error });
        throw error;
      }
    }
  }

  // Update schema version
  await db.runAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  log.info('[DB] Migrations complete, schema version:', { version: SCHEMA_VERSION });
}

export async function getDB(): Promise<SQLiteDatabase> {
  if (_db !== null) {
    return _db;
  }

  try {
    log.info('[DB] Opening database connection');
  
    const db = await SQLite.openDatabaseAsync('routine_tracker.db');
  
    // WAL is the native journal mode. wa-sqlite on web may reject it.
    if (Platform.OS === 'web') {
      try {
        await db.execAsync('PRAGMA journal_mode = WAL');
      } catch (error) {
        log.warn('[DB] WAL mode unavailable on web', { error });
      }
    } else {
      await db.execAsync('PRAGMA journal_mode = WAL');
    }
    await db.execAsync('PRAGMA foreign_keys = ON');
  
    // Run migrations
    await runMigrations(db);
  
    _db = db;
    log.info('[DB] Database connection established');
  
    return db; 
  } catch (error) {
    log.error('[DB] Failed to open database', { error });
    throw error;
  }
}
