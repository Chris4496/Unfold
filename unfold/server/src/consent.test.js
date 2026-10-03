import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './index.js';
import { createDb } from './db.js';

/**
 * Tests for the device consent layer: the INDEPENDENT cloud-organisation
 * authorisation. Only deidentified text may leave the device, and only when
 * cloudOrg is explicitly true.
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

test('health endpoint reports GenAI not configured without a key', async () => {
  const { status, body } = await api('/api/health');
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.genai.configured, false);
});

test('device registration is idempotent per installId', async () => {
  const first = await api('/api/devices/register', { method: 'POST', body: { installId: 'install-abc-123' } });
  assert.equal(first.status, 201);
  assert.ok(first.body.deviceId);
  assert.ok(first.body.token);
  assert.equal(first.body.cloudOrg, false); // default: no cloud consent

  const second = await api('/api/devices/register', { method: 'POST', body: { installId: 'install-abc-123' } });
  assert.equal(second.status, 200);
  assert.equal(second.body.deviceId, first.body.deviceId);
  assert.equal(second.body.token, first.body.token);
});

test('device registration rejects missing/short installId', async () => {
  assert.equal((await api('/api/devices/register', { method: 'POST', body: {} })).status, 400);
  assert.equal((await api('/api/devices/register', { method: 'POST', body: { installId: 'short' } })).status, 400);
});

test('consent requires device auth and a boolean cloudOrg', async () => {
  // No auth
  assert.equal(
    (await api('/api/devices/me/consent', { method: 'PUT', body: { cloudOrg: true } })).status,
    401
  );
  const reg = await api('/api/devices/register', { method: 'POST', body: { installId: 'install-consent-1' } });
  const token = reg.body.token;
  // Non-boolean
  assert.equal(
    (await api('/api/devices/me/consent', { method: 'PUT', body: { cloudOrg: 'yes' }, token })).status,
    400
  );
});

test('consent toggles independently and persists (cloud organisation authorisation)', async () => {
  const reg = await api('/api/devices/register', { method: 'POST', body: { installId: 'install-consent-2' } });
  const token = reg.body.token;

  // Initially off
  let me = await api('/api/devices/me', { token });
  assert.equal(me.body.cloudOrg, false);

  // Enable
  const on = await api('/api/devices/me/consent', { method: 'PUT', body: { cloudOrg: true }, token });
  assert.equal(on.status, 200);
  assert.equal(on.body.cloudOrg, true);
  me = await api('/api/devices/me', { token });
  assert.equal(me.body.cloudOrg, true);

  // Disable again — fully independent toggle
  const off = await api('/api/devices/me/consent', { method: 'PUT', body: { cloudOrg: false }, token });
  assert.equal(off.body.cloudOrg, false);
  me = await api('/api/devices/me', { token });
  assert.equal(me.body.cloudOrg, false);
});

test('consent is per-device, not global', async () => {
  const a = await api('/api/devices/register', { method: 'POST', body: { installId: 'install-device-A' } });
  const b = await api('/api/devices/register', { method: 'POST', body: { installId: 'install-device-B' } });
  await api('/api/devices/me/consent', { method: 'PUT', body: { cloudOrg: true }, token: a.body.token });
  const meB = await api('/api/devices/me', { token: b.body.token });
  assert.equal(meB.body.cloudOrg, false);
});
