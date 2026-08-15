import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { env } from "../env.js";
import { rootLogger } from "../logger.js";

/**
 * Resolve DATABASE_URL to a filesystem path. Accepts:
 *   file:./autobiz.db      (relative to cwd)
 *   file:/abs/path/foo.db  (absolute)
 *   ./path/foo.db          (bare relative)
 */
export function dbPath(): string {
  const url = env.database_url;
  const stripped = url.startsWith("file:") ? url.slice("file:".length) : url;
  return resolve(process.cwd(), stripped);
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  owner_name TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  goal TEXT NOT NULL,
  status TEXT NOT NULL,
  plan_version INTEGER NOT NULL DEFAULT 1,
  builder_version INTEGER NOT NULL DEFAULT 0,
  idempotency_key TEXT UNIQUE,
  started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS business_state (
  project_id TEXT PRIMARY KEY REFERENCES projects(id),
  landing_url TEXT,
  stripe_payment_link TEXT,
  stripe_balance_usd REAL NOT NULL DEFAULT 0,
  charges_count INTEGER NOT NULL DEFAULT 0,
  uptime_pct REAL NOT NULL DEFAULT 100,
  p95_latency_ms INTEGER NOT NULL DEFAULT 0,
  errors_last_5m INTEGER NOT NULL DEFAULT 0,
  decisions_count INTEGER NOT NULL DEFAULT 0,
  bugs_open INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plans (
  project_id TEXT NOT NULL REFERENCES projects(id),
  version INTEGER NOT NULL,
  json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (project_id, version)
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects(id),
  project_seq INTEGER NOT NULL,
  turn INTEGER NOT NULL,
  agent TEXT NOT NULL,
  agent_run_id TEXT NOT NULL,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  confidence REAL,
  metadata TEXT,
  ts TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_project_seq ON events(project_id, project_seq);

CREATE TABLE IF NOT EXISTS decisions (
  decision_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  topic TEXT NOT NULL,
  before_json TEXT NOT NULL,
  after_json TEXT NOT NULL,
  aggregate TEXT NOT NULL,
  terac_ask_id TEXT,
  ts TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bugs (
  bug_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  builder_version INTEGER NOT NULL,
  severity TEXT NOT NULL,
  where_ TEXT NOT NULL,
  observed TEXT NOT NULL,
  expected TEXT NOT NULL,
  repro_json TEXT NOT NULL,
  fixed_in_version INTEGER,
  ts TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects(id),
  from_role TEXT NOT NULL,
  content TEXT NOT NULL,
  queued_for_turn INTEGER,
  absorbed_at TEXT,
  ts TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS turns (
  turn_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  turn INTEGER NOT NULL,
  agent TEXT NOT NULL,
  agent_run_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plugin_configs (
  id TEXT PRIMARY KEY,
  connected INTEGER NOT NULL,
  encrypted_json TEXT,
  masked_json TEXT NOT NULL,
  connected_at TEXT
);
`;

export function openDatabase(): Database.Database {
  const path = dbPath();
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("synchronous = NORMAL");
  return db;
}

export function migrate(db: Database.Database): void {
  db.exec(SCHEMA);

  const now = new Date().toISOString();
  const row = db
    .prepare<[], { id: string }>("SELECT id FROM workspaces WHERE id = 'default'")
    .get();
  if (!row) {
    db.prepare(
      "INSERT INTO workspaces (id, owner_name, owner_email, created_at) VALUES (?, ?, ?, ?)",
    ).run("default", env.demo_owner_name, env.demo_owner_email, now);
  }

  rootLogger.info({ path: dbPath(), created: !row }, "sqlite migrated");
}

export function initDb(): Database.Database {
  const db = openDatabase();
  migrate(db);
  return db;
}

// Allow: node dist/db/migrate.js
if (import.meta.url === `file://${process.argv[1]}`) {
  const db = initDb();
  db.close();
  process.exit(0);
}

// Silence unused import in browsers/tests
void existsSync;
