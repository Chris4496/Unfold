import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './index.js';
import { createDb } from './db.js';
import { newId, hashPassword, signWorkerToken } from './auth.js';
import { runSweeper } from './sweeper.js';

/**
 * Tests for the worker-facing case routes (src/routes-worker.js):
 * queue matching (language, expertise intersection, capacity), the
 * verified-worker gate (403 not_verified), atomic claim + race (409),
 * the respond flow, and sweeper auto-rematch integration.
 */

let server;
let baseUrl;
let db;

const testConfig = {
  jwtSecret: 'test-secret',
  moonshotApiKey: '',
  moonshotBaseUrl: 'https://api.moonshot.ai/v1',
  genaiModel: 'kimi-k3',
  unclaimedTimeoutHours: 72,
  responseTimeoutHours: 48,
};

const NOW = new Date('2025-01-10T00:00:00.000Z');
function hoursAgo(h) {
  return new Date(NOW.getTime() - h * 3600 * 1000).toISOString();
}
function realHoursAgo(h) {
  return new Date(Date.now() - h * 3600 * 1000).toISOString();
}

function insertWorker({ verified = 1, expertise = ['general'], languages = ['en'], maxActive = 5 }) {
  const id = newId();
  db.prepare(
    `INSERT INTO workers (id, email, password_hash, name, expertise, languages, max_active, verified, created_at)
     VALUES (?, ?, ?, 'W', ?, ?, ?, ?, ?)`
  ).run(
    id,
    `w-${id}@example.com`,
    hashPassword('demo1234'),
    JSON.stringify(expertise),
    JSON.stringify(languages),
    maxActive,
    verified,
    NOW.toISOString()
  );
  return { id, token: signWorkerToken(id, testConfig.jwtSecret) };
}

function insertCase({
  status = 'queued',
  topics = [],
  language = 'en',
  claimedBy = null,
  claimedAt = null,
  respondedAt = null,
  claimCount = 0,
  createdAt = hoursAgo(1),
  deviceId = 'seed-device',
}) {
  const id = newId();
  db.prepare(
    `INSERT INTO cases (id, device_id, main_concerns, recent_change, period, excerpts, topics, language,
                        status, claim_count, claimed_by, created_at, claimed_at, responded_at, updated_at)
     VALUES (?, ?, 'stress', 'poor sleep', '2 weeks', '["excerpt one"]', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    deviceId,
    JSON.stringify(topics),
    language,
    status,
    claimCount,
    claimedBy,
    createdAt,
    claimedAt,
    respondedAt,
    createdAt
  );
  return id;
}

function getCase(id) {
  return db.prepare('SELECT * FROM cases WHERE id = ?').get(id);
}

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

before(async () => {
  db = createDb(':memory:');
  db.prepare('INSERT INTO devices (id, token, created_at) VALUES (?, ?, ?)').run(
    'seed-device',
    'seed-token',
    NOW.toISOString()
  );
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

// --- Verified-worker gate ------------------------------------------------

test('unverified worker gets 403 not_verified on all case routes, but /me works', async () => {
  const u = insertWorker({ verified: 0 });
  const caseId = insertCase({});

  const me = await api('/api/worker/me', { token: u.token });
  assert.equal(me.status, 200);
  assert.equal(me.body.worker.verified, false);

  const queue = await api('/api/worker/queue', { token: u.token });
  assert.equal(queue.status, 403);
  assert.equal(queue.body.error, 'not_verified');

  for (const [method, path] of [
    ['POST', `/api/worker/cases/${caseId}/claim`],
    ['GET', '/api/worker/cases'],
    ['GET', `/api/worker/cases/${caseId}`],
    ['GET', `/api/worker/cases/${caseId}/messages`],
  ]) {
    const res = await api(path, { method, token: u.token });
    assert.equal(res.status, 403, `${method} ${path}`);
    assert.equal(res.body.error, 'not_verified');
  }
  const respond = await api(`/api/worker/cases/${caseId}/respond`, {
    method: 'POST',
    body: { text: 'hi' },
    token: u.token,
  });
  assert.equal(respond.status, 403);
  assert.equal(respond.body.error, 'not_verified');
});

test('missing/invalid token gets 401', async () => {
  assert.equal((await api('/api/worker/queue')).status, 401);
  assert.equal((await api('/api/worker/queue', { token: 'nope' })).status, 401);
});

// --- Queue matching --------------------------------------------------------

test('queue filters by language, expertise intersection, and includes waitingHours/claim_count', async () => {
  const w = insertWorker({ expertise: ['academic', 'sleep'], languages: ['en', 'zh-HK'] });

  const matchEn = insertCase({ topics: ['academic'], language: 'en', createdAt: realHoursAgo(5), claimCount: 2 });
  const matchZh = insertCase({ topics: ['sleep'], language: 'zh-HK', createdAt: realHoursAgo(1) });
  insertCase({ topics: ['family'], language: 'en' }); // no expertise intersection
  insertCase({ topics: ['academic'], language: 'fr' }); // language mismatch
  const someoneElse = insertWorker({});
  insertCase({ topics: ['academic'], language: 'en', status: 'claimed', claimedBy: someoneElse.id, claimedAt: hoursAgo(0.5) }); // not open

  const res = await api('/api/worker/queue', { token: w.token });
  assert.equal(res.status, 200);
  const ids = res.body.cases.map((c) => c.id);
  assert.deepEqual(new Set(ids), new Set([matchEn, matchZh]));
  // Oldest first
  assert.equal(ids[0], matchEn);
  // waitingHours + claim_count present, device_id never exposed
  const first = res.body.cases[0];
  assert.ok(first.waitingHours >= 4.9 && first.waitingHours <= 5.2, `waitingHours=${first.waitingHours}`);
  assert.equal(first.claim_count, 2);
  assert.equal(first.device_id, undefined);
  assert.equal(res.body.atCapacity, false);
});

test('general expertise matches any topics', async () => {
  const w = insertWorker({ expertise: ['general'], languages: ['en'] });
  const a = insertCase({ topics: ['family'], language: 'en' });
  const b = insertCase({ topics: [], language: 'en' });
  const res = await api('/api/worker/queue', { token: w.token });
  const ids = res.body.cases.map((c) => c.id);
  assert.ok(ids.includes(a) && ids.includes(b));
});

test('queue is empty when worker is at capacity', async () => {
  const w = insertWorker({ expertise: ['general'], languages: ['en'], maxActive: 1 });
  insertCase({ status: 'claimed', claimedBy: w.id, claimedAt: hoursAgo(0.5) });
  insertCase({}); // open case that would otherwise match

  const res = await api('/api/worker/queue', { token: w.token });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.cases, []);
  assert.equal(res.body.atCapacity, true);
  assert.equal(res.body.activeCount, 1);
});

test('rematch cases reappear in the queue', async () => {
  const w = insertWorker({ expertise: ['general'], languages: ['en'] });
  const id = insertCase({ status: 'rematch', language: 'en', claimCount: 1 });
  const res = await api('/api/worker/queue', { token: w.token });
  const found = res.body.cases.find((c) => c.id === id);
  assert.ok(found);
  assert.equal(found.status, 'rematch');
});

// --- Claim ---------------------------------------------------------------

test('claim succeeds atomically and a second claim gets 409 already_claimed', async () => {
  const w1 = insertWorker({});
  const w2 = insertWorker({});
  const caseId = insertCase({});

  const first = await api(`/api/worker/cases/${caseId}/claim`, { method: 'POST', token: w1.token });
  assert.equal(first.status, 201);
  assert.equal(first.body.case.status, 'claimed');
  assert.equal(first.body.case.claim_count, 1);
  assert.ok(first.body.case.claimed_at);
  assert.equal(first.body.case.device_id, undefined);

  // Claim race: the loser's conditional UPDATE changes 0 rows -> 409.
  const second = await api(`/api/worker/cases/${caseId}/claim`, { method: 'POST', token: w2.token });
  assert.equal(second.status, 409);
  assert.equal(second.body.error, 'already_claimed');

  const row = getCase(caseId);
  assert.equal(row.claimed_by, w1.id);
  assert.equal(row.claim_count, 1); // failed claim did not bump the counter
});

test('claim returns 404 for unknown case and 409 at capacity', async () => {
  const w = insertWorker({ maxActive: 1 });
  assert.equal(
    (await api('/api/worker/cases/does-not-exist/claim', { method: 'POST', token: w.token })).status,
    404
  );
  insertCase({ status: 'claimed', claimedBy: w.id, claimedAt: hoursAgo(0.5) });
  const open = insertCase({});
  const res = await api(`/api/worker/cases/${open}/claim`, { method: 'POST', token: w.token });
  assert.equal(res.status, 409);
  assert.equal(res.body.error, 'capacity_reached');
});

// --- My cases / detail / respond / messages -------------------------------

test('GET /cases lists my active cases with last message snippet', async () => {
  const w = insertWorker({});
  const other = insertWorker({});
  const mine = insertCase({ status: 'claimed', claimedBy: w.id, claimedAt: hoursAgo(0.5) });
  insertCase({ status: 'claimed', claimedBy: other.id, claimedAt: hoursAgo(0.5) }); // not mine
  insertCase({ status: 'queued' }); // not claimed
  const longText = 'x'.repeat(200);
  db.prepare('INSERT INTO messages (id, case_id, sender, text, created_at) VALUES (?, ?, ?, ?, ?)').run(
    newId(),
    mine,
    'student',
    longText,
    hoursAgo(0.2)
  );

  const res = await api('/api/worker/cases', { token: w.token });
  assert.equal(res.status, 200);
  assert.equal(res.body.cases.length, 1);
  const c = res.body.cases[0];
  assert.equal(c.id, mine);
  assert.equal(c.lastMessage.sender, 'student');
  assert.equal(c.lastMessage.text.length, 141); // 140 chars + ellipsis
  assert.equal(c.device_id, undefined);
});

test('case detail only for the claiming worker, never exposes device_id', async () => {
  const w = insertWorker({});
  const other = insertWorker({});
  const caseId = insertCase({ status: 'claimed', claimedBy: w.id, claimedAt: hoursAgo(0.5) });

  const ok = await api(`/api/worker/cases/${caseId}`, { token: w.token });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.case.main_concerns, 'stress');
  assert.deepEqual(ok.body.case.excerpts, ['excerpt one']);
  assert.equal(ok.body.case.period, '2 weeks');
  assert.equal(ok.body.case.device_id, undefined);

  const denied = await api(`/api/worker/cases/${caseId}`, { token: other.token });
  assert.equal(denied.status, 403);
  assert.equal(denied.body.error, 'not_your_case');
  assert.equal((await api(`/api/worker/cases/${newId()}`, { token: w.token })).status, 404);
});

test('respond flow: claimant can respond once, status becomes replied', async () => {
  const w = insertWorker({});
  const other = insertWorker({});
  const caseId = insertCase({ status: 'claimed', claimedBy: w.id, claimedAt: hoursAgo(0.5) });

  // Non-owner cannot respond
  const denied = await api(`/api/worker/cases/${caseId}/respond`, {
    method: 'POST',
    body: { text: 'hello' },
    token: other.token,
  });
  assert.equal(denied.status, 403);

  // Empty text rejected
  assert.equal(
    (await api(`/api/worker/cases/${caseId}/respond`, { method: 'POST', body: { text: '  ' }, token: w.token })).status,
    400
  );

  const res = await api(`/api/worker/cases/${caseId}/respond`, {
    method: 'POST',
    body: { text: 'Thanks for sharing — here are some next steps.' },
    token: w.token,
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.message.sender, 'worker');
  assert.equal(res.body.case.status, 'replied');
  assert.ok(res.body.case.responded_at);

  // Responding again while 'replied' is not allowed
  const again = await api(`/api/worker/cases/${caseId}/respond`, {
    method: 'POST',
    body: { text: 'follow up' },
    token: w.token,
  });
  assert.equal(again.status, 409);
  assert.equal(again.body.error, 'invalid_status');

  // Messages endpoint shows the thread for the claimant only
  const msgs = await api(`/api/worker/cases/${caseId}/messages`, { token: w.token });
  assert.equal(msgs.status, 200);
  assert.equal(msgs.body.messages.length, 1);
  assert.equal(msgs.body.messages[0].text, 'Thanks for sharing — here are some next steps.');
  assert.equal((await api(`/api/worker/cases/${caseId}/messages`, { token: other.token })).status, 403);
});

test('respond allowed again when status becomes continued (student replied)', async () => {
  const w = insertWorker({});
  const caseId = insertCase({ status: 'claimed', claimedBy: w.id, claimedAt: hoursAgo(0.5) });
  await api(`/api/worker/cases/${caseId}/respond`, { method: 'POST', body: { text: 'first' }, token: w.token });
  db.prepare("UPDATE cases SET status = 'continued' WHERE id = ?").run(caseId); // student replied
  const res = await api(`/api/worker/cases/${caseId}/respond`, {
    method: 'POST',
    body: { text: 'second' },
    token: w.token,
  });
  assert.equal(res.status, 201);
  assert.equal(getCase(caseId).status, 'replied');
});

// --- Withdrawn cases (H6) --------------------------------------------------

test('withdrawn case: detail and messages return 404 case_not_found, respond returns 409 invalid_status', async () => {
  const w = insertWorker({});
  const caseId = insertCase({ status: 'withdrawn', claimedBy: w.id, claimedAt: hoursAgo(2) });

  // Even the worker who claimed the case loses read access after withdraw.
  const detail = await api(`/api/worker/cases/${caseId}`, { token: w.token });
  assert.equal(detail.status, 404);
  assert.equal(detail.body.error, 'case_not_found');

  const msgs = await api(`/api/worker/cases/${caseId}/messages`, { token: w.token });
  assert.equal(msgs.status, 404);
  assert.equal(msgs.body.error, 'case_not_found');

  // Write routes already reject withdrawn cases with 409 invalid_status.
  const respond = await api(`/api/worker/cases/${caseId}/respond`, {
    method: 'POST',
    body: { text: 'are you still there?' },
    token: w.token,
  });
  assert.equal(respond.status, 409);
  assert.equal(respond.body.error, 'invalid_status');
});

// --- Worker identity on messages -------------------------------------------

test('respond stores sender_worker_id and messages expose worker_name', async () => {
  const w = insertWorker({});
  const caseId = insertCase({ status: 'claimed', claimedBy: w.id, claimedAt: hoursAgo(0.5) });
  db.prepare('INSERT INTO messages (id, case_id, sender, text, created_at) VALUES (?, ?, ?, ?, ?)').run(
    newId(),
    caseId,
    'student',
    'a student note',
    hoursAgo(0.3)
  );

  const res = await api(`/api/worker/cases/${caseId}/respond`, {
    method: 'POST',
    body: { text: 'worker reply' },
    token: w.token,
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.message.worker_name, 'W');

  const stored = db
    .prepare('SELECT sender_worker_id FROM messages WHERE id = ?')
    .get(res.body.message.id);
  assert.equal(stored.sender_worker_id, w.id);

  const msgs = await api(`/api/worker/cases/${caseId}/messages`, { token: w.token });
  assert.equal(msgs.status, 200);
  const bySender = Object.fromEntries(msgs.body.messages.map((m) => [m.sender, m]));
  assert.equal(bySender.worker.worker_name, 'W');
  assert.equal(bySender.student.worker_name, null);
});

// --- Sweeper auto-rematch integration --------------------------------------

test('sweeper auto-rematch returns a stale claimed case to the queue for another worker', async () => {
  const w1 = insertWorker({});
  const w2 = insertWorker({});
  const caseId = insertCase({
    status: 'claimed',
    claimedBy: w1.id,
    claimedAt: hoursAgo(49), // beyond the 48h response timeout
    claimCount: 1,
  });

  const result = runSweeper(db, NOW, testConfig);
  assert.equal(result.rematched, 1);
  const row = getCase(caseId);
  assert.equal(row.status, 'rematch');
  assert.equal(row.claimed_by, null);
  assert.equal(row.claimed_at, null);
  assert.equal(row.claim_count, 2);

  // The original worker no longer sees it as theirs...
  assert.equal((await api(`/api/worker/cases/${caseId}`, { token: w1.token })).status, 403);

  // ...and a different worker can now pick it up from the queue and claim it.
  const queue = await api('/api/worker/queue', { token: w2.token });
  assert.ok(queue.body.cases.some((c) => c.id === caseId && c.status === 'rematch'));
  const reclaim = await api(`/api/worker/cases/${caseId}/claim`, { method: 'POST', token: w2.token });
  assert.equal(reclaim.status, 201);
  assert.equal(getCase(caseId).claimed_by, w2.id);
});

test('sweeper leaves unclaimed queued cases queued (student side computes waiting flag)', () => {
  insertCase({ status: 'queued', createdAt: hoursAgo(100) });
  const result = runSweeper(db, NOW, testConfig);
  assert.equal(result.rematched, 0);
  const stillQueued = db.prepare("SELECT COUNT(*) AS n FROM cases WHERE status = 'queued'").get().n;
  assert.ok(stillQueued >= 1);
});
