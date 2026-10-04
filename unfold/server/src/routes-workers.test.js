import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './index.js';
import { createDb } from './db.js';

/**
 * HTTP tests for the worker auth/profile routes (src/routes/workers.js):
 * register/login round-trip and the max_active range (1–20, aligned with
 * the worker-web registration/profile form).
 */

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

test('register accepts an optional max_active in 1–20 (default 5)', async () => {
  const ok = await api('/api/workers/register', {
    method: 'POST',
    body: { email: 'reg-a@example.com', password: 'password123', name: 'A', max_active: 12 },
  });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.worker.max_active, 12);
  assert.equal(ok.body.worker.verified, false); // new workers start unverified

  const def = await api('/api/workers/register', {
    method: 'POST',
    body: { email: 'reg-b@example.com', password: 'password123', name: 'B' },
  });
  assert.equal(def.status, 201);
  assert.equal(def.body.worker.max_active, 5);

  for (const bad of [0, 21, 2.5, '10']) {
    const res = await api('/api/workers/register', {
      method: 'POST',
      body: {
        email: `reg-bad-${String(bad)}@example.com`,
        password: 'password123',
        name: 'C',
        max_active: bad,
      },
    });
    assert.equal(res.status, 400, `max_active=${JSON.stringify(bad)}`);
  }

  const dup = await api('/api/workers/register', {
    method: 'POST',
    body: { email: 'reg-a@example.com', password: 'password123', name: 'A2' },
  });
  assert.equal(dup.status, 409);
  assert.equal(dup.body.error, 'email_already_registered');
});

test('PATCH /api/workers/me validates max_active in 1–20', async () => {
  await api('/api/workers/register', {
    method: 'POST',
    body: { email: 'reg-patch@example.com', password: 'password123', name: 'P' },
  });
  const login = await api('/api/workers/login', {
    method: 'POST',
    body: { email: 'reg-patch@example.com', password: 'password123' },
  });
  assert.equal(login.status, 200);
  const token = login.body.token;

  const edgeLow = await api('/api/workers/me', { method: 'PATCH', body: { max_active: 1 }, token });
  assert.equal(edgeLow.status, 200);
  assert.equal(edgeLow.body.worker.max_active, 1);
  const edgeHigh = await api('/api/workers/me', { method: 'PATCH', body: { max_active: 20 }, token });
  assert.equal(edgeHigh.status, 200);
  assert.equal(edgeHigh.body.worker.max_active, 20);

  for (const bad of [0, 21, 100]) {
    const res = await api('/api/workers/me', { method: 'PATCH', body: { max_active: bad }, token });
    assert.equal(res.status, 400, `max_active=${bad}`);
  }
});
