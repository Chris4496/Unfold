import Database from 'better-sqlite3';

/**
 * Schema DDL for the Unfold backend.
 *
 * Notes:
 * - Only DEIDENTIFIED text ever reaches this server, and only when the
 *   student has explicitly enabled cloud organisation on the device.
 * - Original transcripts/audio never leave the device and are never stored.
 * - `genai` columns flag whether a row was produced by the GenAI model (1)
 *   or by a deterministic local fallback (0), so UIs can disclose this.
 */
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS workers (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  organisation  TEXT,
  expertise     TEXT NOT NULL DEFAULT '[]', -- JSON array of 'academic|family|sleep|group|friends|general'
  languages     TEXT NOT NULL DEFAULT '[]', -- JSON array, e.g. ['zh-HK','en']
  max_active    INTEGER NOT NULL DEFAULT 5,
  verified      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS devices (
  id         TEXT PRIMARY KEY,
  token      TEXT UNIQUE NOT NULL,
  cloud_org  INTEGER NOT NULL DEFAULT 0, -- independent cloud-organisation consent
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entries (
  id           TEXT PRIMARY KEY,
  device_id    TEXT NOT NULL REFERENCES devices(id),
  client_id    TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  event_at     TEXT NOT NULL,
  deidentified TEXT NOT NULL,
  tokens       TEXT NOT NULL DEFAULT '[]', -- JSON
  topics       TEXT NOT NULL DEFAULT '[]', -- JSON
  attributes   TEXT NOT NULL DEFAULT '{}', -- JSON
  uncertainty  TEXT NOT NULL DEFAULT '{}', -- JSON
  genai        INTEGER NOT NULL DEFAULT 0,
  synced_at    TEXT NOT NULL,
  UNIQUE(device_id, client_id)
);

CREATE TABLE IF NOT EXISTS links (
  id            TEXT PRIMARY KEY,
  device_id     TEXT NOT NULL REFERENCES devices(id),
  from_entry_id TEXT NOT NULL,
  to_entry_id   TEXT NOT NULL,
  relation      TEXT NOT NULL,
  note          TEXT,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS summaries (
  device_id TEXT NOT NULL REFERENCES devices(id),
  day       TEXT NOT NULL,
  text      TEXT NOT NULL,
  entry_ids TEXT NOT NULL DEFAULT '[]', -- JSON
  genai     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (device_id, day)
);

CREATE TABLE IF NOT EXISTS analyses (
  device_id   TEXT PRIMARY KEY REFERENCES devices(id),
  updated_at  TEXT NOT NULL,
  approaching INTEGER NOT NULL DEFAULT 0,
  explanation TEXT,
  evidence    TEXT NOT NULL DEFAULT '[]', -- JSON
  genai       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cases (
  id            TEXT PRIMARY KEY,
  device_id     TEXT NOT NULL REFERENCES devices(id),
  main_concerns TEXT,
  recent_change TEXT,
  period        TEXT,
  excerpts      TEXT NOT NULL DEFAULT '[]', -- JSON: deidentified excerpts only
  topics        TEXT NOT NULL DEFAULT '[]', -- JSON
  language      TEXT,
  status        TEXT NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued','claimed','replied','continued','rematch','withdrawn')),
  claim_count   INTEGER NOT NULL DEFAULT 0,
  claimed_by    TEXT REFERENCES workers(id),
  created_at    TEXT NOT NULL,
  claimed_at    TEXT,
  responded_at  TEXT,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id               TEXT PRIMARY KEY,
  case_id          TEXT NOT NULL REFERENCES cases(id),
  sender           TEXT NOT NULL CHECK (sender IN ('worker','student')),
  sender_worker_id TEXT REFERENCES workers(id), -- set when sender = 'worker'
  text             TEXT NOT NULL,
  created_at       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_entries_device ON entries(device_id, created_at);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status, updated_at);
CREATE INDEX IF NOT EXISTS idx_messages_case ON messages(case_id, created_at);
`;

/**
 * Guarded migrations for databases created by older server versions.
 * Every migration checks for its column first, so it is idempotent and
 * a no-op on fresh databases (where SCHEMA already has the column).
 */
export function migrateDb(db) {
  const messageColumns = db
    .prepare('PRAGMA table_info(messages)')
    .all()
    .map((col) => col.name);
  if (!messageColumns.includes('sender_worker_id')) {
    db.exec('ALTER TABLE messages ADD COLUMN sender_worker_id TEXT REFERENCES workers(id)');
  }
}

/** Create (or open) a database and ensure the schema exists. */
export function createDb(dbPath = './unfold.db') {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  migrateDb(db);
  return db;
}
