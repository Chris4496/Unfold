import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export function newId() {
  return crypto.randomUUID();
}

/** Generate an opaque device token (device auth, not a JWT). */
export function newDeviceToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}

export function verifyPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

/** Sign a worker JWT. Payload only carries the worker id and role. */
export function signWorkerToken(workerId, secret, expiresIn = '7d') {
  return jwt.sign({ sub: workerId, role: 'worker' }, secret, { expiresIn });
}

export function verifyWorkerToken(token, secret) {
  return jwt.verify(token, secret); // throws on invalid/expired
}

function readBearer(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
}

/**
 * Middleware factory: requires a valid worker JWT.
 * Auth header format: `Authorization: Bearer <jwt>`.
 * On success sets req.worker (full row, password_hash stripped).
 */
export function requireWorker(db, secret) {
  return (req, res, next) => {
    const token = readBearer(req);
    if (!token) return res.status(401).json({ error: 'missing_bearer_token' });
    let payload;
    try {
      payload = verifyWorkerToken(token, secret);
    } catch {
      return res.status(401).json({ error: 'invalid_token' });
    }
    if (payload.role !== 'worker') return res.status(401).json({ error: 'invalid_token' });
    const worker = db.prepare('SELECT * FROM workers WHERE id = ?').get(payload.sub);
    if (!worker) return res.status(401).json({ error: 'worker_not_found' });
    const { password_hash, ...safe } = worker;
    req.worker = safe;
    next();
  };
}

/**
 * Middleware factory: like requireWorker, but additionally requires the
 * worker to be verified by an admin before they may see or claim cases.
 */
export function requireVerifiedWorker(db, secret) {
  const base = requireWorker(db, secret);
  return (req, res, next) => {
    base(req, res, () => {
      if (!req.worker.verified) {
        return res.status(403).json({ error: 'not_verified' });
      }
      next();
    });
  };
}

/**
 * Middleware factory: requires a device token.
 * Auth header format: `Authorization: Bearer <device token>`.
 * On success sets req.device.
 */
export function requireDevice(db) {
  return (req, res, next) => {
    const token = readBearer(req);
    if (!token) return res.status(401).json({ error: 'missing_bearer_token' });
    const device = db.prepare('SELECT * FROM devices WHERE token = ?').get(token);
    if (!device) return res.status(401).json({ error: 'invalid_device_token' });
    req.device = device;
    next();
  };
}
