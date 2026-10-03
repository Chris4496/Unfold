import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { runSweeper, isWaiting } from './sweeper.js';
import { createDb } from './db.js';
import { newId } from './auth.js';

/**
 * Sweeper timeout rules (see CONTRACT.md):
 * - claimed + no response for > RESPONSE_TIMEOUT_HOURS => status 'rematch',
 *   claimed_by NULL, claim_count++.
 * - queued/rematch unclaimed > UNCLAIMED_TIMEOUT_HOURS => no status change,
 *   but isWaiting() flags it for the student UI.
 */

let db;
let workerId;
const CONFIG = { responseTimeoutHours: 48, unclaimedTimeoutHours: 72 };
const NOW = new Date('2025-01-10T00:00:00.000Z');

function hoursAgo(h) {
  return new Date(NOW.getTime() - h * 3600 * 1000).toISOString();
}

function insertDevice() {
  const id = newId();
  db.prepare('INSERT INTO devices (id, token, created_at) VALUES (?, ?, ?)').run(
    id,
    'tok-' + id,
    NOW.toISOString()
  );
  return id;
}

function insertCase({ status, claimedAt = null, respondedAt = null, claimCount = 0, claimedBy = null, createdAt = hoursAgo(1) }) {
  const id = newId();
  db.prepare(
    `INSERT INTO cases (id, device_id, status, claim_count, claimed_by, created_at, claimed_at, responded_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, insertDevice(), status, claimCount, claimedBy, createdAt, claimedAt, respondedAt, createdAt);
  return id;
}

function getCase(id) {
  return db.prepare('SELECT * FROM cases WHERE id = ?').get(id);
}

beforeEach(() => {
  db = createDb(':memory:');
  workerId = newId();
  db.prepare(
    `INSERT INTO workers (id, email, password_hash, name, created_at) VALUES (?, ?, 'x', 'W', ?)`
  ).run(workerId, `w-${workerId}@example.com`, NOW.toISOString());
});

test('claimed case with no response past the response timeout becomes rematch', () => {
  const id = insertCase({ status: 'claimed', claimedAt: hoursAgo(49), claimCount: 1, claimedBy: workerId });
  const result = runSweeper(db, NOW, CONFIG);
  assert.equal(result.rematched, 1);
  const row = getCase(id);
  assert.equal(row.status, 'rematch');
  assert.equal(row.claimed_by, null);
  assert.equal(row.claimed_at, null);
  assert.equal(row.claim_count, 2); // incremented
  assert.equal(row.updated_at, NOW.toISOString());
});

test('claimed case within the response timeout is untouched', () => {
  const id = insertCase({ status: 'claimed', claimedAt: hoursAgo(47), claimedBy: workerId });
  const result = runSweeper(db, NOW, CONFIG);
  assert.equal(result.rematched, 0);
  assert.equal(getCase(id).status, 'claimed');
});

test('claimed case that already got a response is untouched', () => {
  const id = insertCase({
    status: 'claimed',
    claimedAt: hoursAgo(60),
    respondedAt: hoursAgo(55),
    claimedBy: workerId,
  });
  const result = runSweeper(db, NOW, CONFIG);
  assert.equal(result.rematched, 0);
  assert.equal(getCase(id).status, 'claimed');
});

test('replied / queued / rematch / withdrawn cases are never rematched by the sweeper', () => {
  const ids = [
    insertCase({ status: 'replied', claimedAt: hoursAgo(100), claimedBy: workerId }),
    insertCase({ status: 'queued', createdAt: hoursAgo(100) }),
    insertCase({ status: 'rematch', createdAt: hoursAgo(100) }),
    insertCase({ status: 'withdrawn', createdAt: hoursAgo(100) }),
  ];
  const result = runSweeper(db, NOW, CONFIG);
  assert.equal(result.rematched, 0);
  assert.deepEqual(ids.map((id) => getCase(id).status), ['replied', 'queued', 'rematch', 'withdrawn']);
});

test('isWaiting flags old unclaimed queued/rematch cases only', () => {
  const old = { status: 'queued', created_at: hoursAgo(73) };
  const fresh = { status: 'queued', created_at: hoursAgo(71) };
  const oldRematch = { status: 'rematch', created_at: hoursAgo(100) };
  const oldClaimed = { status: 'claimed', created_at: hoursAgo(100) };
  assert.equal(isWaiting(old, NOW, CONFIG), true);
  assert.equal(isWaiting(fresh, NOW, CONFIG), false);
  assert.equal(isWaiting(oldRematch, NOW, CONFIG), true);
  assert.equal(isWaiting(oldClaimed, NOW, CONFIG), false);
});

test('sweeper defaults to 48h response timeout when config omitted', () => {
  const id = insertCase({ status: 'claimed', claimedAt: hoursAgo(49), claimedBy: workerId });
  const result = runSweeper(db, NOW); // no config
  assert.equal(result.rematched, 1);
  assert.equal(getCase(id).status, 'rematch');
});
