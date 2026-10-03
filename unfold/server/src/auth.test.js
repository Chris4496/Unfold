import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPassword,
  verifyPassword,
  signWorkerToken,
  verifyWorkerToken,
  requireWorker,
  requireVerifiedWorker,
  requireDevice,
  newId,
  newDeviceToken,
} from './auth.js';
import { createDb } from './db.js';

function insertWorker(db, { verified = 0 } = {}) {
  const id = newId();
  db.prepare(
    `INSERT INTO workers (id, email, password_hash, name, organisation, expertise, languages, max_active, verified, created_at)
     VALUES (?, ?, ?, ?, NULL, '["general"]', '[]', 5, ?, ?)`
  ).run(id, `w-${id}@example.com`, hashPassword('password123'), 'Test Worker', verified, new Date().toISOString());
  return id;
}

function mockReqRes(authHeader) {
  const req = { headers: authHeader ? { authorization: authHeader } : {} };
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return { req, res };
}

test('password hashing round-trips and rejects wrong passwords', () => {
  const hash = hashPassword('secret-pw');
  assert.notEqual(hash, 'secret-pw');
  assert.ok(verifyPassword('secret-pw', hash));
  assert.ok(!verifyPassword('wrong-pw', hash));
});

test('worker JWT sign/verify round-trip', () => {
  const token = signWorkerToken('worker-1', 'test-secret');
  const payload = verifyWorkerToken(token, 'test-secret');
  assert.equal(payload.sub, 'worker-1');
  assert.equal(payload.role, 'worker');
  assert.throws(() => verifyWorkerToken(token, 'other-secret'));
  assert.throws(() => verifyWorkerToken('not-a-token', 'test-secret'));
});

test('requireWorker: 401 without token, 401 with bad token, 200 with valid token', () => {
  const db = createDb(':memory:');
  const secret = 'test-secret';
  const workerId = insertWorker(db);
  const mw = requireWorker(db, secret);

  // No header
  {
    const { req, res } = mockReqRes(null);
    let called = false;
    mw(req, res, () => (called = true));
    assert.equal(res.statusCode, 401);
    assert.equal(called, false);
  }
  // Bad token
  {
    const { req, res } = mockReqRes('Bearer garbage');
    let called = false;
    mw(req, res, () => (called = true));
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, 'invalid_token');
    assert.equal(called, false);
  }
  // Valid token: sets req.worker without password_hash
  {
    const token = signWorkerToken(workerId, secret);
    const { req, res } = mockReqRes(`Bearer ${token}`);
    let called = false;
    mw(req, res, () => (called = true));
    assert.equal(called, true);
    assert.equal(req.worker.id, workerId);
    assert.equal(req.worker.password_hash, undefined);
  }
});

test('requireVerifiedWorker: 403 for unverified worker, pass for verified', () => {
  const db = createDb(':memory:');
  const secret = 'test-secret';
  const mw = requireVerifiedWorker(db, secret);

  const unverifiedId = insertWorker(db, { verified: 0 });
  {
    const token = signWorkerToken(unverifiedId, secret);
    const { req, res } = mockReqRes(`Bearer ${token}`);
    let called = false;
    mw(req, res, () => (called = true));
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error, 'not_verified');
    assert.equal(called, false);
  }

  const verifiedId = insertWorker(db, { verified: 1 });
  {
    const token = signWorkerToken(verifiedId, secret);
    const { req, res } = mockReqRes(`Bearer ${token}`);
    let called = false;
    mw(req, res, () => (called = true));
    assert.equal(called, true);
    assert.equal(req.worker.verified, 1);
  }
});

test('requireDevice: 401 without/with bad token, pass with valid device token', () => {
  const db = createDb(':memory:');
  const token = newDeviceToken();
  db.prepare('INSERT INTO devices (id, token, cloud_org, created_at) VALUES (?, ?, 0, ?)').run(
    'dev_test',
    token,
    new Date().toISOString()
  );
  const mw = requireDevice(db);

  {
    const { req, res } = mockReqRes(null);
    let called = false;
    mw(req, res, () => (called = true));
    assert.equal(res.statusCode, 401);
    assert.equal(called, false);
  }
  {
    const { req, res } = mockReqRes('Bearer wrong-token');
    let called = false;
    mw(req, res, () => (called = true));
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, 'invalid_device_token');
  }
  {
    const { req, res } = mockReqRes(`Bearer ${token}`);
    let called = false;
    mw(req, res, () => (called = true));
    assert.equal(called, true);
    assert.equal(req.device.id, 'dev_test');
  }
});
