import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './index.js';
import { createDb } from './db.js';
import { runSweeper } from './sweeper.js';
import { newId, signWorkerToken } from './auth.js';

/**
 * Tests for the student-facing routes (src/routes-student.js).
 *
 * All tests run against a real Express app on an ephemeral port with an
 * in-memory database. GEMINI_API_KEY is cleared so every GenAI feature
 * exercises its deterministic local fallback (genai = false).
 */

// Force the deterministic fallback path regardless of the shell environment.
process.env.GEMINI_API_KEY = '';

let server;
let baseUrl;
let db;

const testConfig = {
  jwtSecret: 'test-secret',
  geminiApiKey: '',
  geminiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
  genaiModel: 'gemini-3.8-flash',
  unclaimedTimeoutHours: 72,
  responseTimeoutHours: 48,
};

let installCounter = 0;

async function api(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

/** Register a fresh device; optionally enable cloud-org consent. */
async function freshDevice({ consent = true } = {}) {
  installCounter += 1;
  const reg = await api('/api/devices/register', {
    method: 'POST',
    body: { installId: `student-test-install-${installCounter}` },
  });
  const token = reg.body.token;
  if (consent) {
    const on = await api('/api/devices/me/consent', {
      method: 'PUT',
      body: { cloudOrg: true },
      token,
    });
    assert.equal(on.status, 200);
  }
  return token;
}

const SAMPLE_ENTRIES = [
  {
    clientId: 'e1',
    createdAt: '2025-01-06T09:00:00.000Z',
    deidentified: 'I have a coursework deadline and an exam next week, I feel stressed.',
    tokens: [],
  },
  {
    clientId: 'e2',
    createdAt: '2025-01-07T09:00:00.000Z',
    deidentified: 'I could not sleep again, I kept thinking about the exam.',
    tokens: [],
  },
  {
    clientId: 'e3',
    createdAt: '2025-01-08T09:00:00.000Z',
    deidentified: 'Mum and dad called about my grades and the exam.',
    tokens: [],
  },
];

async function syncSamples(token) {
  return api('/api/entries/sync', {
    method: 'POST',
    body: { entries: SAMPLE_ENTRIES },
    token,
  });
}

function insertWorker() {
  const id = newId();
  db.prepare(
    `INSERT INTO workers (id, email, password_hash, name, verified, created_at)
     VALUES (?, ?, 'x', 'W', 1, ?)`
  ).run(id, `worker-${id}@example.com`, new Date().toISOString());
  return id;
}

/** Look up the server-side device id for a device token. */
function deviceIdForToken(token) {
  return db.prepare('SELECT id FROM devices WHERE token = ?').get(token).id;
}

before(async () => {
  db = createDb(':memory:');
  const app = createApp({ db, config: testConfig });
  await new Promise((resolve) => {
    server = app.listen(0, () => resolve());
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server?.close();
  db?.close();
});

// ---------------------------------------------------------------------------
// Sync + consent
// ---------------------------------------------------------------------------

test('sync requires device auth', async () => {
  const res = await api('/api/entries/sync', { method: 'POST', body: { entries: [] } });
  assert.equal(res.status, 401);
});

test('sync is forbidden (403) without cloud-organisation consent', async () => {
  const token = await freshDevice({ consent: false });
  const res = await api('/api/entries/sync', {
    method: 'POST',
    body: { entries: SAMPLE_ENTRIES },
    token,
  });
  assert.equal(res.status, 403);
  assert.equal(res.body.error, 'cloud_org_not_enabled');
});

test('sync validates the request body', async () => {
  const token = await freshDevice();
  assert.equal(
    (await api('/api/entries/sync', { method: 'POST', body: {}, token })).status,
    400
  );
  assert.equal(
    (
      await api('/api/entries/sync', {
        method: 'POST',
        body: { entries: [{ clientId: 'x', deidentified: 'text' }] }, // missing createdAt
        token,
      })
    ).status,
    400
  );
});

test('sync classifies new entries with the deterministic fallback (genai=false)', async () => {
  const token = await freshDevice();
  const res = await syncSamples(token);
  assert.equal(res.status, 200);
  assert.equal(res.body.results.length, 3);
  for (const result of res.body.results) {
    assert.equal(result.genai, false); // no API key -> local fallback, flagged
  }
  const byClientId = Object.fromEntries(res.body.results.map((r) => [r.clientId, r]));
  assert.ok(byClientId.e1.topics.includes('academic'));
  assert.ok(byClientId.e2.topics.includes('sleep'));
  assert.ok(byClientId.e3.topics.includes('family'));
  assert.ok(Array.isArray(byClientId.e1.uncertainty));

  // GET /api/entries returns entries + links
  const list = await api('/api/entries', { token });
  assert.equal(list.status, 200);
  assert.equal(list.body.entries.length, 3);
  assert.ok(Array.isArray(list.body.links));
  assert.equal(list.body.entries[0].genai, false);

  // Background analysis was regenerated by the sync (>=3 entries, >=2 days,
  // >=2 difficult topics -> fallback flags approaching = true)
  const analysis = await api('/api/analysis', { token });
  assert.equal(analysis.status, 200);
  assert.equal(analysis.body.approaching, true);
  assert.equal(analysis.body.genai, false);
  assert.ok(analysis.body.updatedAt);
  assert.ok(analysis.body.explanation.includes('not a clinical judgement'));
});

test('sync upserts by (device, clientId) and leaves unchanged entries alone', async () => {
  const token = await freshDevice();
  await syncSamples(token);
  const again = await syncSamples(token);
  assert.equal(again.status, 200);
  const list = await api('/api/entries', { token });
  assert.equal(list.body.entries.length, 3); // still three rows, not six
});

test('sync accepts eventAt updates for existing records and invalidates old+new day caches', async () => {
  const token = await freshDevice();
  const deviceId = deviceIdForToken(token);
  const entry = {
    clientId: 'ev1',
    createdAt: '2025-01-06T09:00:00.000Z',
    deidentified: 'I could not sleep before the exam.',
    tokens: [],
  };
  const eventAtOf = () =>
    db.prepare('SELECT event_at FROM entries WHERE device_id = ? AND client_id = ?').get(deviceId, 'ev1')
      .event_at;

  // Initial sync without eventAt: event_at defaults to createdAt.
  await api('/api/entries/sync', { method: 'POST', body: { entries: [entry] }, token });
  assert.equal(eventAtOf(), '2025-01-06T09:00:00.000Z');

  // Prime the old day's summary cache.
  await api('/api/summaries/2025-01-06', { token });
  assert.ok(
    db.prepare('SELECT * FROM summaries WHERE device_id = ? AND day = ?').get(deviceId, '2025-01-06')
  );

  // Re-sync with a corrected eventAt: event_at moves and the OLD day's
  // cached summary is dropped as well.
  const moved = await api('/api/entries/sync', {
    method: 'POST',
    body: { entries: [{ ...entry, eventAt: '2024-12-20T09:00:00.000Z' }] },
    token,
  });
  assert.equal(moved.status, 200);
  assert.equal(eventAtOf(), '2024-12-20T09:00:00.000Z');
  assert.equal(
    db.prepare('SELECT * FROM summaries WHERE device_id = ? AND day = ?').get(deviceId, '2025-01-06'),
    undefined,
    'old-day summary cache must be invalidated when event_at moves'
  );

  // Re-syncing WITHOUT eventAt must not clobber the stored event_at.
  const noEventAt = await api('/api/entries/sync', {
    method: 'POST',
    body: { entries: [{ ...entry, deidentified: 'Still not sleeping before the exam.' }] },
    token,
  });
  assert.equal(noEventAt.status, 200);
  assert.equal(eventAtOf(), '2024-12-20T09:00:00.000Z');
});

test('sync of a changed entry reclassifies it and clears the affected summary cache', async () => {
  const token = await freshDevice();
  await syncSamples(token);

  // Prime the summary cache for the day of entry e1.
  const first = await api('/api/summaries/2025-01-06', { token });
  assert.equal(first.status, 200);
  const cached = db
    .prepare('SELECT * FROM summaries WHERE day = ?')
    .get('2025-01-06');
  assert.ok(cached, 'summary row should be cached');

  // Change e1's text and re-sync: the cached summary for its day must be
  // dropped and the entry reclassified.
  const changed = {
    ...SAMPLE_ENTRIES[0],
    deidentified: 'Slept badly again before the presentation with my group.',
  };
  const res = await api('/api/entries/sync', {
    method: 'POST',
    body: { entries: [changed] },
    token,
  });
  assert.equal(res.status, 200);
  assert.ok(res.body.results[0].topics.includes('sleep'));
  assert.equal(res.body.results[0].genai, false);

  const stillCached = db
    .prepare('SELECT * FROM summaries WHERE day = ?')
    .get('2025-01-06');
  assert.equal(stillCached, undefined, 'affected summary cache must be cleared');
});

// ---------------------------------------------------------------------------
// Summaries
// ---------------------------------------------------------------------------

test('daily summaries are generated on demand and then served from cache', async () => {
  const token = await freshDevice();
  await syncSamples(token);

  const first = await api('/api/summaries/2025-01-07', { token });
  assert.equal(first.status, 200);
  assert.equal(first.body.day, '2025-01-07');
  assert.equal(first.body.genai, false);
  assert.ok(first.body.text.toLowerCase().includes('sleep'));

  // Prove the second call is served from the cache by rewriting the row.
  db.prepare(`UPDATE summaries SET text = 'CACHED-TEXT' WHERE day = '2025-01-07'`).run();
  const second = await api('/api/summaries/2025-01-07', { token });
  assert.equal(second.body.text, 'CACHED-TEXT');

  assert.equal((await api('/api/summaries/not-a-day', { token })).status, 400);
});

// ---------------------------------------------------------------------------
// Ask / respond / analysis
// ---------------------------------------------------------------------------

test('ask answers from synced entries and honestly reports misses (stores nothing)', async () => {
  const token = await freshDevice();
  await syncSamples(token);

  const hit = await api('/api/ask', {
    method: 'POST',
    body: { question: 'When is the exam deadline?' },
    token,
  });
  assert.equal(hit.status, 200);
  assert.equal(hit.body.found, true);
  assert.equal(hit.body.genai, false);
  assert.ok(hit.body.hits.length >= 1);
  assert.equal(hit.body.hits[0].clientId, 'e1'); // oldest matching note first

  const miss = await api('/api/ask', {
    method: 'POST',
    body: { question: 'What about basketball practice?' },
    token,
  });
  assert.equal(miss.body.found, false);
  assert.equal(miss.body.hits.length, 0);

  assert.equal(
    (await api('/api/ask', { method: 'POST', body: { question: '  ' }, token })).status,
    400
  );
});

test('respond returns a brief response with a fallback kind', async () => {
  const token = await freshDevice();
  const res = await api('/api/respond', {
    method: 'POST',
    body: { deidentified: 'I am really stressed about the coursework deadline.', recentKinds: [] },
    token,
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.genai, false);
  assert.equal(res.body.kind, 'encouragement');
  assert.ok(res.body.text.length > 0);

  assert.equal(
    (await api('/api/respond', { method: 'POST', body: {}, token })).status,
    400
  );
});

test('analysis returns a default shape before any sync', async () => {
  const token = await freshDevice();
  const res = await api('/api/analysis', { token });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, {
    approaching: false,
    explanation: null,
    evidence: [],
    genai: false,
    updatedAt: null,
  });
});

// ---------------------------------------------------------------------------
// Cloud-data deletion lifecycle
// ---------------------------------------------------------------------------

test('DELETE /api/entries removes all entries, derived data, and the device\'s cases with messages', async () => {
  const token = await freshDevice();
  await syncSamples(token);
  const caseId = await createCase(token);
  const deviceId = deviceIdForToken(token);

  // Prime derived artefacts: summary cache, background analysis, a link.
  await api('/api/summaries/2025-01-06', { token });
  const byClient = Object.fromEntries(
    db.prepare('SELECT id, client_id FROM entries WHERE device_id = ?')
      .all(deviceId)
      .map((r) => [r.client_id, r.id])
  );
  db.prepare(
    `INSERT INTO links (id, device_id, from_entry_id, to_entry_id, relation, note, created_at)
     VALUES (?, ?, ?, ?, 'related', NULL, ?)`
  ).run(newId(), deviceId, byClient.e1, byClient.e2, new Date().toISOString());
  assert.ok(db.prepare('SELECT * FROM analyses WHERE device_id = ?').get(deviceId));

  // A conversation on the shared case.
  const msg = await api(`/api/cases/${caseId}/messages`, {
    method: 'POST',
    body: { text: 'a bit more context' },
    token,
  });
  assert.equal(msg.status, 201);

  const res = await api('/api/entries', { method: 'DELETE', token });
  assert.equal(res.status, 200);
  assert.equal(res.body.deleted, 3); // entries semantics unchanged
  assert.equal(res.body.casesDeleted, 1); // additive field

  for (const table of ['entries', 'links', 'summaries', 'analyses', 'cases']) {
    assert.equal(
      db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE device_id = ?`).get(deviceId).n,
      0,
      `${table} must be empty after the purge`
    );
  }
  // The case's conversation goes with it (N1: shared case content is purged).
  assert.equal(
    db.prepare('SELECT COUNT(*) AS n FROM messages WHERE case_id = ?').get(caseId).n,
    0
  );

  // No active case remains.
  const active = await api('/api/cases/active', { token });
  assert.equal(active.body.case, null);

  // Auth is required.
  assert.equal((await api('/api/entries', { method: 'DELETE' })).status, 401);
});

test('DELETE /api/entries/:clientId removes one entry, its links, its day summary cache and the stale analysis', async () => {
  const token = await freshDevice();
  await syncSamples(token);
  const caseId = await createCase(token);
  const deviceId = deviceIdForToken(token);

  // Unknown clientId -> 404.
  const missing = await api('/api/entries/nope', { method: 'DELETE', token });
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error, 'entry_not_found');

  // Prime the day summary cache and a link involving e1.
  await api('/api/summaries/2025-01-06', { token });
  const byClient = Object.fromEntries(
    db.prepare('SELECT id, client_id FROM entries WHERE device_id = ?')
      .all(deviceId)
      .map((r) => [r.client_id, r.id])
  );
  db.prepare(
    `INSERT INTO links (id, device_id, from_entry_id, to_entry_id, relation, note, created_at)
     VALUES (?, ?, ?, ?, 'related', NULL, ?)`
  ).run(newId(), deviceId, byClient.e1, byClient.e2, new Date().toISOString());
  // The sync produced a background analysis row; it goes stale the moment an
  // entry is deleted (N2).
  assert.ok(db.prepare('SELECT * FROM analyses WHERE device_id = ?').get(deviceId));

  const res = await api('/api/entries/e1', { method: 'DELETE', token });
  assert.equal(res.status, 200);
  assert.equal(res.body.deleted, 1);

  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM entries WHERE device_id = ?').get(deviceId).n, 2);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM links WHERE device_id = ?').get(deviceId).n, 0);
  assert.equal(
    db.prepare('SELECT COUNT(*) AS n FROM summaries WHERE device_id = ? AND day = ?').get(deviceId, '2025-01-06').n,
    0
  );
  assert.equal(
    db.prepare('SELECT COUNT(*) AS n FROM analyses WHERE device_id = ?').get(deviceId).n,
    0,
    'stale analysis row must be deleted (regenerated on the next sync)'
  );

  // No GenAI call is triggered and no stale evidence is served: the analysis
  // endpoint falls back to its default shape until the next sync.
  const analysis = await api('/api/analysis', { token });
  assert.deepEqual(analysis.body, {
    approaching: false,
    explanation: null,
    evidence: [],
    genai: false,
    updatedAt: null,
  });

  // Cases are device-scoped, not entry-scoped: the single-record route must
  // leave them (and their messages) untouched.
  const active = await api('/api/cases/active', { token });
  assert.equal(active.body.case.id, caseId);
});

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

const CASE_BODY = {
  mainConcerns: 'academic pressure and sleep',
  recentChange: 'more sleep concerns this week',
  period: '2025-01-01 to 2025-01-08',
  excerpts: [{ id: 'e1', createdAt: '2025-01-06T09:00:00.000Z', text: 'coursework deadline' }],
  topics: ['academic', 'sleep'],
  language: 'zh-HK',
};

async function createCase(token) {
  const res = await api('/api/cases', { method: 'POST', body: CASE_BODY, token });
  assert.equal(res.status, 201);
  return res.body.id;
}

test('case lifecycle: create -> active -> withdraw', async () => {
  const token = await freshDevice();
  assert.equal(
    (await api('/api/cases', { method: 'POST', body: { mainConcerns: 'x' }, token })).status,
    400
  );

  const id = await createCase(token);

  const active = await api('/api/cases/active', { token });
  assert.equal(active.status, 200);
  assert.equal(active.body.case.id, id);
  assert.equal(active.body.case.status, 'queued');
  assert.equal(active.body.case.waitingNoWorker, false);
  assert.equal(active.body.case.messages, 0);

  const withdrawn = await api(`/api/cases/${id}/withdraw`, { method: 'POST', token });
  assert.equal(withdrawn.status, 200);
  assert.equal(withdrawn.body.status, 'withdrawn');

  // Withdrawing again is an invalid transition.
  assert.equal(
    (await api(`/api/cases/${id}/withdraw`, { method: 'POST', token })).status,
    400
  );

  const after = await api('/api/cases/active', { token });
  assert.equal(after.body.case, null);
});

test('withdraw keeps the case row (metadata) but deletes excerpts and all messages (N1)', async () => {
  const token = await freshDevice();
  const id = await createCase(token);

  // Claimed by a worker; conversation in both directions.
  const workerId = insertWorker();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE cases SET status = 'claimed', claimed_by = ?, claimed_at = ? WHERE id = ?`
  ).run(workerId, now, id);
  const posted = await api(`/api/cases/${id}/messages`, {
    method: 'POST',
    body: { text: 'a bit more context' },
    token,
  });
  assert.equal(posted.status, 201);
  db.prepare(
    `INSERT INTO messages (id, case_id, sender, sender_worker_id, text, created_at)
     VALUES (?, ?, 'worker', ?, 'worker reply', ?)`
  ).run(newId(), id, workerId, now);
  assert.equal(
    db.prepare('SELECT COUNT(*) AS n FROM messages WHERE case_id = ?').get(id).n,
    2
  );

  const res = await api(`/api/cases/${id}/withdraw`, { method: 'POST', token });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { id, status: 'withdrawn' });

  // The case row is retained with its metadata; the shared content is gone.
  const row = db.prepare('SELECT * FROM cases WHERE id = ?').get(id);
  assert.ok(row, 'case row must be retained after withdraw');
  assert.equal(row.status, 'withdrawn');
  assert.equal(row.period, CASE_BODY.period);
  assert.equal(row.main_concerns, CASE_BODY.mainConcerns);
  assert.equal(row.excerpts, '[]', 'shared excerpts must be cleared on withdraw');
  assert.equal(
    db.prepare('SELECT COUNT(*) AS n FROM messages WHERE case_id = ?').get(id).n,
    0,
    'withdraw must delete the whole conversation'
  );

  // Student read-models reflect the deletion.
  assert.equal((await api('/api/cases/active', { token })).body.case, null);
  const msgs = await api(`/api/cases/${id}/messages`, { token });
  assert.deepEqual(msgs.body.messages, []);

  // Worker side unchanged: the withdrawn case stays closed (404) even to the
  // worker who claimed it.
  const workerToken = signWorkerToken(workerId, testConfig.jwtSecret);
  const detail = await api(`/api/worker/cases/${id}`, { token: workerToken });
  assert.equal(detail.status, 404);
  assert.equal(detail.body.error, 'case_not_found');
  const workerMsgs = await api(`/api/worker/cases/${id}/messages`, { token: workerToken });
  assert.equal(workerMsgs.status, 404);
});

test('rematch returns a claimed case to the queue (queued, claimed_by NULL, claim_count++)', async () => {
  const token = await freshDevice();
  const id = await createCase(token);
  const workerId = insertWorker();

  // Student cannot rematch a case that is still queued.
  assert.equal(
    (await api(`/api/cases/${id}/rematch`, { method: 'POST', token })).status,
    400
  );

  // Simulate a worker claim.
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE cases SET status = 'claimed', claimed_by = ?, claimed_at = ? WHERE id = ?`
  ).run(workerId, now, id);

  const res = await api(`/api/cases/${id}/rematch`, { method: 'POST', token });
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'queued');

  const row = db.prepare('SELECT * FROM cases WHERE id = ?').get(id);
  assert.equal(row.status, 'queued');
  assert.equal(row.claimed_by, null);
  assert.equal(row.claimed_at, null);
  assert.equal(row.claim_count, 1);
});

test('continue moves replied -> continued and rejects other states', async () => {
  const token = await freshDevice();
  const id = await createCase(token);

  // Not allowed while still queued.
  assert.equal(
    (await api(`/api/cases/${id}/continue`, { method: 'POST', token })).status,
    400
  );

  db.prepare(`UPDATE cases SET status = 'replied', responded_at = ? WHERE id = ?`).run(
    new Date().toISOString(),
    id
  );
  const res = await api(`/api/cases/${id}/continue`, { method: 'POST', token });
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'continued');
});

test('case messages: student can post and read; withdrawn cases reject new messages', async () => {
  const token = await freshDevice();
  const id = await createCase(token);

  assert.equal(
    (await api(`/api/cases/${id}/messages`, { method: 'POST', body: { text: '  ' }, token })).status,
    400
  );

  const posted = await api(`/api/cases/${id}/messages`, {
    method: 'POST',
    body: { text: 'Thank you, a bit more context: the deadline moved.' },
    token,
  });
  assert.equal(posted.status, 201);
  assert.equal(posted.body.message.sender, 'student');

  const list = await api(`/api/cases/${id}/messages`, { token });
  assert.equal(list.status, 200);
  assert.equal(list.body.messages.length, 1);
  assert.equal(list.body.messages[0].sender, 'student');

  const active = await api('/api/cases/active', { token });
  assert.equal(active.body.case.messages, 1);

  await api(`/api/cases/${id}/withdraw`, { method: 'POST', token });
  assert.equal(
    (
      await api(`/api/cases/${id}/messages`, {
        method: 'POST',
        body: { text: 'hello?' },
        token,
      })
    ).status,
    400
  );
});

test('student messages are truncated to 500 chars and expose workerName', async () => {
  const token = await freshDevice();
  const id = await createCase(token);

  const long = await api(`/api/cases/${id}/messages`, {
    method: 'POST',
    body: { text: 'y'.repeat(800) },
    token,
  });
  assert.equal(long.status, 201);
  assert.equal(long.body.message.text.length, 500);

  // Simulate a worker reply carrying sender_worker_id.
  const workerId = insertWorker();
  db.prepare(
    `INSERT INTO messages (id, case_id, sender, sender_worker_id, text, created_at)
     VALUES (?, ?, 'worker', ?, ?, ?)`
  ).run(newId(), id, workerId, 'worker reply', new Date().toISOString());

  const list = await api(`/api/cases/${id}/messages`, { token });
  assert.equal(list.status, 200);
  const workerMsg = list.body.messages.find((m) => m.sender === 'worker');
  assert.equal(workerMsg.workerName, 'W');
  const studentMsg = list.body.messages.find((m) => m.sender === 'student');
  assert.equal(studentMsg.workerName, null);
});

test('ownership: another device cannot touch someone else\'s case', async () => {
  const tokenA = await freshDevice();
  const tokenB = await freshDevice();
  const id = await createCase(tokenA);

  for (const attempt of [
    api(`/api/cases/${id}/withdraw`, { method: 'POST', token: tokenB }),
    api(`/api/cases/${id}/rematch`, { method: 'POST', token: tokenB }),
    api(`/api/cases/${id}/continue`, { method: 'POST', token: tokenB }),
    api(`/api/cases/${id}/messages`, { token: tokenB }),
    api(`/api/cases/${id}/messages`, { method: 'POST', body: { text: 'hi' }, token: tokenB }),
  ]) {
    const res = await attempt;
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'case_not_found');
  }

  // Device B also sees no active case and no entries.
  assert.equal((await api('/api/cases/active', { token: tokenB })).body.case, null);
});

// ---------------------------------------------------------------------------
// Timeout handling
// ---------------------------------------------------------------------------

test('waiting flag: old queued/rematch cases are flagged via isWaiting; runSweeper rematches stale claims', async () => {
  const token = await freshDevice();
  const waitingId = await createCase(token);

  // Age the queued case beyond UNCLAIMED_TIMEOUT_HOURS (72h).
  const old = new Date(Date.now() - 100 * 3600 * 1000).toISOString();
  db.prepare('UPDATE cases SET created_at = ? WHERE id = ?').run(old, waitingId);

  const active = await api('/api/cases/active', { token });
  assert.equal(active.body.case.status, 'queued');
  assert.equal(active.body.case.waitingNoWorker, true);

  // A claimed case with no worker response past RESPONSE_TIMEOUT_HOURS (48h)
  // is returned to the queue by the sweeper as 'rematch'.
  const staleId = await createCase(token);
  const workerId = insertWorker();
  // Slightly newer than `old` so this case is the latest active one, but
  // still older than both timeout thresholds.
  const oldStale = new Date(Date.now() - 99 * 3600 * 1000).toISOString();
  db.prepare(
    `UPDATE cases SET status = 'claimed', claimed_by = ?, claimed_at = ?, created_at = ? WHERE id = ?`
  ).run(workerId, oldStale, oldStale, staleId);

  const swept = runSweeper(db, new Date(), testConfig);
  assert.equal(swept.rematched, 1);

  const row = db.prepare('SELECT * FROM cases WHERE id = ?').get(staleId);
  assert.equal(row.status, 'rematch');
  assert.equal(row.claimed_by, null);
  assert.equal(row.claim_count, 1);

  // The rematched case is now the latest active case and is flagged waiting.
  const after = await api('/api/cases/active', { token });
  assert.equal(after.body.case.id, staleId);
  assert.equal(after.body.case.status, 'rematch');
  assert.equal(after.body.case.waitingNoWorker, true);
});
