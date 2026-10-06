import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './index.js';
import { createDb } from './db.js';
import { loadConfig } from './config.js';
import { FICTIONAL_DEMO_CASE_ID, FICTIONAL_DEMO_DEVICE_ID } from './fictional-demo.js';
import { newId, signWorkerToken } from './auth.js';

const TEST_CONFIG = {
  jwtSecret: 'fictional-demo-test-secret',
  geminiApiKey: '',
  geminiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
  genaiModel: 'gemini-3.8-flash',
  unclaimedTimeoutHours: 72,
  responseTimeoutHours: 48,
  demoMode: true,
};

async function withServer(config, run) {
  const db = createDb(':memory:');
  const server = createApp({ db, config }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    await run({ db, baseUrl });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    db.close();
  }
}

async function request(baseUrl, path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

test('fictional demo is complete, correlated, idempotent, and retains normal worker authorization', async () => {
  await withServer(TEST_CONFIG, async ({ db, baseUrl }) => {
    const first = await request(baseUrl, '/api/demo/session');
    assert.equal(first.status, 200);
    assert.equal(first.body.persona.name, 'Maya');
    assert.equal(first.body.entries.length, 18);
    assert.equal(first.body.case.id, FICTIONAL_DEMO_CASE_ID);
    assert.equal(first.body.case.status, 'continued');
    assert.equal(first.body.case.summary.excerpts.length, first.body.entries.length);

    const entryIds = first.body.entries.map((entry) => entry.id);
    assert.equal(new Set(entryIds).size, entryIds.length);
    for (const [index, entry] of first.body.entries.entries()) {
      const excerpt = first.body.case.summary.excerpts[index];
      assert.equal(entry.id, excerpt.id);
      assert.equal(entry.eventAt, excerpt.createdAt);
      assert.equal(entry.createdAt, excerpt.recordedAt);
      assert.equal(entry.deidentified, excerpt.text);
      assert.equal(entry.transcript, excerpt.text);
      assert.equal(entry.audioUri, undefined);
    }
    const retrospective = first.body.entries.find((entry) => entry.id === 'maya-note-12');
    assert.notEqual(retrospective.createdAt, retrospective.eventAt);
    assert.equal(db.prepare('SELECT cloud_org FROM devices WHERE id = ?').get(FICTIONAL_DEMO_DEVICE_ID).cloud_org, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM cases').get().n, 1);

    const login = await request(baseUrl, '/api/workers/login', {
      method: 'POST',
      body: { email: 'demo.worker@unfold.local', password: 'demo1234' },
    });
    assert.equal(login.status, 200);
    assert.equal(login.body.worker.verified, true);
    const workerToken = login.body.token;
    const workerCases = await request(baseUrl, '/api/worker/cases', { token: workerToken });
    assert.deepEqual(workerCases.body.cases.map((item) => item.id), [FICTIONAL_DEMO_CASE_ID]);

    const detail = await request(baseUrl, `/api/worker/cases/${FICTIONAL_DEMO_CASE_ID}`, { token: workerToken });
    assert.equal(detail.status, 200);
    assert.equal(detail.body.case.excerpts.length, 18);
    assert.deepEqual(detail.body.case.excerpts.map((excerpt) => excerpt.id), entryIds);
    assert.equal(detail.body.case.device_id, undefined);
    assert.equal(detail.body.case.deviceToken, undefined);
    assert.equal(detail.body.case.excerpts[0].text, first.body.entries[0].deidentified);
    const thread = await request(baseUrl, `/api/worker/cases/${FICTIONAL_DEMO_CASE_ID}/messages`, { token: workerToken });
    assert.equal(thread.body.messages.length, 4);

    // An unassigned verified worker cannot see the full history.
    const otherId = newId();
    db.prepare(
      `INSERT INTO workers (id, email, password_hash, name, expertise, languages, max_active, verified, created_at)
       VALUES (?, ?, 'x', 'Other worker', '["general"]', '["en"]', 5, 1, ?)`,
    ).run(otherId, `other-${otherId}@example.test`, new Date().toISOString());
    const otherToken = signWorkerToken(otherId, TEST_CONFIG.jwtSecret);
    assert.equal((await request(baseUrl, `/api/worker/cases/${FICTIONAL_DEMO_CASE_ID}`, { token: otherToken })).status, 403);

    // A normal student message and worker response are retained on re-entry.
    const studentMessage = await request(baseUrl, `/api/cases/${FICTIONAL_DEMO_CASE_ID}/messages`, {
      method: 'POST',
      token: first.body.deviceToken,
      body: { text: 'I tried the written task plan and want to keep talking.' },
    });
    assert.equal(studentMessage.status, 201);
    const workerReply = await request(baseUrl, `/api/worker/cases/${FICTIONAL_DEMO_CASE_ID}/respond`, {
      method: 'POST',
      token: workerToken,
      body: { text: 'Thanks for the update. We can keep checking what feels manageable.' },
    });
    assert.equal(workerReply.status, 201);
    const second = await request(baseUrl, '/api/demo/session');
    assert.equal(second.body.deviceToken, first.body.deviceToken);
    assert.equal(second.body.entries.length, 18);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM cases').get().n, 1);
    const refreshedThread = await request(baseUrl, `/api/worker/cases/${FICTIONAL_DEMO_CASE_ID}/messages`, { token: workerToken });
    assert.equal(refreshedThread.body.messages.length, 6);

    // The regular withdraw route clears the shared snapshot and conversation;
    // bootstrap/re-entry must not silently restore either.
    const withdrawn = await request(baseUrl, `/api/cases/${FICTIONAL_DEMO_CASE_ID}/withdraw`, {
      method: 'POST',
      token: first.body.deviceToken,
      body: {},
    });
    assert.equal(withdrawn.status, 200);
    assert.equal((await request(baseUrl, `/api/worker/cases/${FICTIONAL_DEMO_CASE_ID}`, { token: workerToken })).status, 404);
    const afterWithdraw = await request(baseUrl, '/api/demo/session');
    assert.equal(afterWithdraw.body.case.status, 'withdrawn');
    assert.deepEqual(afterWithdraw.body.case.summary.excerpts, []);
    const withdrawnThread = await request(baseUrl, `/api/worker/cases/${FICTIONAL_DEMO_CASE_ID}/messages`, { token: workerToken });
    assert.equal(withdrawnThread.status, 404);
  });
});

test('fictional demo requires opt-in and is disabled in production configuration', () => {
  assert.equal(loadConfig({ DEMO_MODE: '1', NODE_ENV: 'development' }).demoMode, true);
  assert.equal(loadConfig({ DEMO_MODE: '1', NODE_ENV: 'production' }).demoMode, false);
  assert.equal(loadConfig({ NODE_ENV: 'development' }).demoMode, false);
});

test('fictional demo endpoint is absent unless local demo mode is explicitly enabled', async () => {
  await withServer({ ...TEST_CONFIG, demoMode: false }, async ({ baseUrl }) => {
    const result = await request(baseUrl, '/api/demo/session');
    assert.equal(result.status, 404);
    assert.equal(result.body.error, 'not_found');
  });
});
