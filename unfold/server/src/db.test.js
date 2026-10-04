import { test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { createDb, migrateDb } from './db.js';

/**
 * Tests for the guarded schema migrations (src/db.js). Databases created by
 * older server versions lack messages.sender_worker_id; migrateDb must add
 * it without touching fresh databases.
 */

test('migrateDb adds sender_worker_id to a pre-existing messages table', () => {
  const db = new Database(':memory:');
  // Minimal "old" schema: workers + messages without sender_worker_id.
  db.exec(`
    CREATE TABLE workers (id TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE messages (
      id         TEXT PRIMARY KEY,
      case_id    TEXT NOT NULL,
      sender     TEXT NOT NULL,
      text       TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  db.prepare('INSERT INTO workers (id, name) VALUES (?, ?)').run('w1', 'Worker One');
  db.prepare('INSERT INTO messages (id, case_id, sender, text, created_at) VALUES (?, ?, ?, ?, ?)').run(
    'm1',
    'c1',
    'worker',
    'old reply',
    '2025-01-01T00:00:00.000Z'
  );

  migrateDb(db);
  const columns = db.prepare('PRAGMA table_info(messages)').all().map((col) => col.name);
  assert.ok(columns.includes('sender_worker_id'));

  // Existing rows get NULL; new rows can record the sending worker.
  assert.equal(
    db.prepare('SELECT sender_worker_id FROM messages WHERE id = ?').get('m1').sender_worker_id,
    null
  );
  db.prepare(
    'INSERT INTO messages (id, case_id, sender, sender_worker_id, text, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run('m2', 'c1', 'worker', 'w1', 'new reply', '2025-01-02T00:00:00.000Z');
  assert.equal(
    db.prepare('SELECT sender_worker_id FROM messages WHERE id = ?').get('m2').sender_worker_id,
    'w1'
  );

  // Idempotent: running the migration again is a no-op.
  migrateDb(db);
  db.close();
});

test('createDb on a fresh database already has sender_worker_id', () => {
  const db = createDb(':memory:');
  const columns = db.prepare('PRAGMA table_info(messages)').all().map((col) => col.name);
  assert.ok(columns.includes('sender_worker_id'));
  db.close();
});
