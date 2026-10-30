import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'url';
import { runMigrationsSync } from './migrate/runner.js';
import { initEncryptionKey, isEncryptionKeyInitialized } from '../lib/crypto.js';
import { nodeSqliteFactory } from './node-sqlite.js';
import type { Db, DbFactory } from './types.js';

export type { Db, DbFactory } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LEGACY_DB_PATH = path.resolve(__dirname, '../../data/freeapi.db');
const DB_PATH = path.resolve(__dirname, '../../data/apidoct.db');
const runtimeRequire = createRequire(import.meta.url);

let db: Db;

export function getDb(): Db {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() or connectDb() first.');
  }
  return db;
}

export function getDefaultDbPath(): string {
  const envPath = process.env.APIDOCT_DB_PATH?.trim() || process.env.FREEAPI_DB_PATH?.trim();
  if (envPath) return envPath;
  if (fs.existsSync(LEGACY_DB_PATH)) {
    return LEGACY_DB_PATH;
  }
  return DB_PATH;
}

function isTermuxEnvironment(): boolean {
  return (
    process.platform === 'android' ||
    Boolean(process.env.TERMUX_VERSION) ||
    Boolean(process.env.PREFIX?.includes('com.termux'))
  );
}

/** Default factory: opens a better-sqlite3 connection at the given path with fallback to node:sqlite on Termux. */
function betterSqliteFactory(resolvedPath: string): Db {
  try {
    const BetterSqlite = runtimeRequire('better-sqlite3') as new (path: string) => unknown;
    return new BetterSqlite(resolvedPath) as Db;
  } catch (cause) {
    // Automatic fallback for Termux / ARM Android environments
    try {
      return nodeSqliteFactory(resolvedPath);
    } catch {
      throw new Error(
        'better-sqlite3 is not compiled for this platform. Reinstall dependencies or run Node.js 22.13+ for node:sqlite on Termux.',
        { cause },
      );
    }
  }
}

export function defaultDbFactory(platform: NodeJS.Platform = process.platform): DbFactory {
  return isTermuxEnvironment() ? nodeSqliteFactory : betterSqliteFactory;
}

export function connectDb(
  dbPath?: string,
  opts?: {
    /** Create the parent directory if absent. Default: true. Set false in
     *  environments that do not have a writable local filesystem. */
    ensureDir?: boolean;
    /** Factory that constructs the raw Db connection. Default: better-sqlite3. */
    factory?: DbFactory;
  },
): Db {
  const resolvedPath = dbPath ?? getDefaultDbPath();
  const isMemory = resolvedPath === ':memory:';
  const ensureDir = opts?.ensureDir ?? true;
  const factory = opts?.factory ?? defaultDbFactory();

  if (!isMemory && ensureDir) {
    const dataDir = path.dirname(resolvedPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  db = factory(resolvedPath);
  if (!isMemory) db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  // The dashboard and the proxy hot path write concurrently; without a busy
  // timeout the loser of a write race gets SQLITE_BUSY immediately and the
  // request fails. Five seconds is far longer than any write here takes.
  db.pragma('busy_timeout = 5000');

  if (!isMemory) restrictDbFilePermissions(resolvedPath);

  console.log(`Database initialized at ${resolvedPath}`);
  return db;
}

/** Restrict the DB and its WAL sidecars to the owner. The file holds encrypted
 *  provider keys plus the dashboard password hash, so it must not be readable by
 *  other local users. Best-effort: filesystems without POSIX modes (Windows,
 *  some mounts) throw, and that must not stop startup. */
function restrictDbFilePermissions(resolvedPath: string): void {
  for (const suffix of ['', '-wal', '-shm']) {
    const target = `${resolvedPath}${suffix}`;
    try {
      if (fs.existsSync(target)) fs.chmodSync(target, 0o600);
    } catch {
      // Non-fatal: permissions are a hardening measure, not a correctness one.
    }
  }
}

export function initDb(
  dbPath?: string,
  opts?: { ensureDir?: boolean; factory?: DbFactory },
): Db {
  const db = connectDb(dbPath, opts);

  if (process.env.NODE_ENV !== 'development') {
    runMigrationsSync(db, 'up');
  } else {
    // In dev, verify the DB has been initialised. If not, give a clear error.
    const ready = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'"
    ).get();
    if (!ready) {
      console.error(
        '\n  [dev] Database not initialised. Run:\n\n' +
        '    npm run db:migration:up\n\n' +
        '  Then restart the server.\n'
      );
      process.exit(1);
    }
  }

  if (!isEncryptionKeyInitialized()) initEncryptionKey(db);

  // Auto-seed and sync keys, settings, user, models, and fallback config
  try {
    const keyCount = (db.prepare('SELECT COUNT(*) as count FROM api_keys').get() as { count: number })?.count ?? 0;
    const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number })?.count ?? 0;
    const candidatePaths = [
      path.resolve(__dirname, './seed-data.json'),
      path.resolve(__dirname, '../../src/db/seed-data.json'),
      path.resolve(process.cwd(), 'src/db/seed-data.json'),
      path.resolve(process.cwd(), 'server/src/db/seed-data.json'),
    ];
    const seedPath = candidatePaths.find(p => fs.existsSync(p));
    if (seedPath) {
      const seed = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
      if (keyCount === 0 && seed.keys && Array.isArray(seed.keys)) {
        const insertKey = db.prepare(`
          INSERT OR IGNORE INTO api_keys (id, platform, label, encrypted_key, iv, auth_tag, status, enabled, created_at, last_checked_at, base_url, last_health_error)
          VALUES (@id, @platform, @label, @encrypted_key, @iv, @auth_tag, @status, @enabled, @created_at, @last_checked_at, @base_url, @last_health_error)
        `);
        for (const k of seed.keys) insertKey.run(k);
        console.log(`[seed] Successfully seeded ${seed.keys.length} master API keys into database from ${seedPath}.`);
      } else if (seed.keys && Array.isArray(seed.keys)) {
        // Sync enabled/status flags for keys
        const updateKey = db.prepare(`
          UPDATE api_keys SET enabled = @enabled, status = @status, last_health_error = @last_health_error WHERE id = @id
        `);
        for (const k of seed.keys) updateKey.run(k);
      }
      if (userCount === 0 && seed.users && Array.isArray(seed.users)) {
        const insertUser = db.prepare(`
          INSERT OR IGNORE INTO users (id, email, password_hash, created_at)
          VALUES (@id, @email, @password_hash, @created_at)
        `);
        for (const u of seed.users) insertUser.run(u);
        console.log(`[seed] Successfully seeded master admin user ${seed.users[0]?.email}.`);
      }
      if (seed.settings && Array.isArray(seed.settings)) {
        const insertSetting = db.prepare(`
          INSERT OR REPLACE INTO settings (key, value) VALUES (@key, @value)
        `);
        for (const s of seed.settings) insertSetting.run(s);
        console.log(`[seed] Successfully seeded system settings.`);
      }
      if (seed.models && Array.isArray(seed.models)) {
        const insertModel = db.prepare(`
          INSERT OR REPLACE INTO models (id, platform, model_id, display_name, intelligence_rank, speed_rank, size_label, monthly_token_budget, context_window, enabled, supports_vision, supports_tools, key_id, source, endpoint_scope)
          VALUES (@id, @platform, @model_id, @display_name, @intelligence_rank, @speed_rank, @size_label, @monthly_token_budget, @context_window, @enabled, @supports_vision, @supports_tools, @key_id, @source, @endpoint_scope)
        `);
        for (const m of seed.models) insertModel.run(m);
        console.log(`[seed] Successfully seeded/synced ${seed.models.length} verified models.`);
      }

      // Ensure dead / retired models are disabled
      db.prepare("UPDATE models SET enabled = 0 WHERE (platform = 'groq' AND model_id LIKE 'llama%') OR (platform = 'cohere' AND model_id = 'command-r') OR platform = 'apinex' OR model_id IN ('stepaudio-2.5-chat', 'zai-org/GLM-5.3-Flash')").run();

      // Sync fallback_config for all enabled models
      const enabledModels = db.prepare("SELECT id FROM models WHERE enabled = 1").all() as Array<{ id: number }>;
      let priority = 1;
      for (const m of enabledModels) {
        db.prepare("INSERT OR IGNORE INTO fallback_config (model_db_id, priority, enabled) VALUES (?, ?, 1)").run(m.id, priority++);
        db.prepare("UPDATE fallback_config SET enabled = 1 WHERE model_db_id = ?").run(m.id);
      }
    } else {
      console.warn('[seed] seed-data.json not found in candidate paths:', candidatePaths);
    }
  } catch (err: any) {
    console.error('[seed] Notice during seed-data check:', err?.message ?? err);
  }

  return db;
}

// Generic key/value settings accessors (used by routing strategy, etc.).
export function getSetting(key: string): string | undefined {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value;
}

export function setSetting(key: string, value: string): void {
  if (key === 'unified_api_key') cachedUnifiedKey = value;
  const db = getDb();
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value);
}

let cachedUnifiedKey: string | null = null;

export function getUnifiedApiKey(): string {
  if (cachedUnifiedKey) return cachedUnifiedKey;
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = 'unified_api_key'").get() as { value?: string } | undefined;
  if (row?.value) {
    cachedUnifiedKey = row.value;
    return row.value;
  }
  return '';
}

export function regenerateUnifiedKey(): string {
  const db = getDb();
  const key = `apidoct-${crypto.randomBytes(24).toString('hex')}`;
  db.prepare("UPDATE settings SET value = ? WHERE key = 'unified_api_key'").run(key);
  cachedUnifiedKey = key;
  return key;
}
