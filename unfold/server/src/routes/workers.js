import { Router } from 'express';
import {
  newId,
  hashPassword,
  verifyPassword,
  signWorkerToken,
  requireWorker,
} from '../auth.js';

export const EXPERTISE_VALUES = ['academic', 'family', 'sleep', 'group', 'friends', 'general'];

/** Allowed max_active range, aligned with the worker-web form (1–20). */
const MAX_ACTIVE_MIN = 1;
const MAX_ACTIVE_MAX = 20;
const MAX_ACTIVE_DEFAULT = 5;
const MAX_ACTIVE_ERROR = `max_active must be an integer between ${MAX_ACTIVE_MIN} and ${MAX_ACTIVE_MAX}`;

function isValidMaxActive(value) {
  return Number.isInteger(value) && value >= MAX_ACTIVE_MIN && value <= MAX_ACTIVE_MAX;
}

function publicWorker(w) {
  return {
    id: w.id,
    email: w.email,
    name: w.name,
    organisation: w.organisation ?? null,
    expertise: JSON.parse(w.expertise || '[]'),
    languages: JSON.parse(w.languages || '[]'),
    max_active: w.max_active,
    verified: !!w.verified,
    created_at: w.created_at,
  };
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * Worker auth + profile routes. Mounted at /api/workers.
 * Auth header for protected routes: `Authorization: Bearer <jwt>`.
 */
export function workersRouter(db, config) {
  const router = Router();

  // POST /api/workers/register -> creates an UNVERIFIED worker (verified=0).
  // Verification is an out-of-band admin action; unverified workers can log
  // in but cannot access case queue endpoints (requireVerifiedWorker).
  router.post('/register', (req, res) => {
    const { email, password, name, organisation, max_active } = req.body || {};
    if (!isNonEmptyString(email) || !isNonEmptyString(password) || !isNonEmptyString(name)) {
      return res.status(400).json({ error: 'email, password and name are required' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    if (password.length < 8) {
      return res.status(400).json({ error: 'password must be at least 8 characters' });
    }
    if (max_active !== undefined && !isValidMaxActive(max_active)) {
      return res.status(400).json({ error: MAX_ACTIVE_ERROR });
    }
    const existing = db.prepare('SELECT id FROM workers WHERE email = ?').get(normalizedEmail);
    if (existing) return res.status(409).json({ error: 'email_already_registered' });

    const id = newId();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO workers (id, email, password_hash, name, organisation, expertise, languages, max_active, verified, created_at)
       VALUES (?, ?, ?, ?, ?, '["general"]', '[]', ?, 0, ?)`
    ).run(
      id,
      normalizedEmail,
      hashPassword(password),
      name.trim(),
      organisation ?? null,
      max_active ?? MAX_ACTIVE_DEFAULT,
      now
    );

    const worker = db.prepare('SELECT * FROM workers WHERE id = ?').get(id);
    return res.status(201).json({ worker: publicWorker(worker) });
  });

  // POST /api/workers/login -> { token }
  router.post('/login', (req, res) => {
    const { email, password } = req.body || {};
    if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
      return res.status(400).json({ error: 'email and password are required' });
    }
    const worker = db
      .prepare('SELECT * FROM workers WHERE email = ?')
      .get(String(email).trim().toLowerCase());
    if (!worker || !verifyPassword(password, worker.password_hash)) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }
    const token = signWorkerToken(worker.id, config.jwtSecret);
    return res.json({ token, worker: publicWorker(worker) });
  });

  // GET /api/workers/me (worker JWT required)
  router.get('/me', requireWorker(db, config.jwtSecret), (req, res) => {
    return res.json({ worker: publicWorker(req.worker) });
  });

  // PATCH /api/workers/me — update expertise, languages, max_active.
  router.patch('/me', requireWorker(db, config.jwtSecret), (req, res) => {
    const { expertise, languages, max_active } = req.body || {};
    const updates = [];
    const params = [];

    if (expertise !== undefined) {
      if (!Array.isArray(expertise) || expertise.some((e) => !EXPERTISE_VALUES.includes(e))) {
        return res
          .status(400)
          .json({ error: `expertise must be an array of: ${EXPERTISE_VALUES.join('|')}` });
      }
      updates.push('expertise = ?');
      params.push(JSON.stringify(expertise));
    }
    if (languages !== undefined) {
      if (!Array.isArray(languages) || languages.some((l) => typeof l !== 'string')) {
        return res.status(400).json({ error: 'languages must be an array of strings' });
      }
      updates.push('languages = ?');
      params.push(JSON.stringify(languages));
    }
    if (max_active !== undefined) {
      if (!isValidMaxActive(max_active)) {
        return res.status(400).json({ error: MAX_ACTIVE_ERROR });
      }
      updates.push('max_active = ?');
      params.push(max_active);
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'no updatable fields provided' });
    }

    params.push(req.worker.id);
    db.prepare(`UPDATE workers SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    const worker = db.prepare('SELECT * FROM workers WHERE id = ?').get(req.worker.id);
    return res.json({ worker: publicWorker(worker) });
  });

  return router;
}
