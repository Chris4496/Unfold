import { Router } from 'express';
import { newId, requireWorker, requireVerifiedWorker } from './auth.js';

/**
 * Worker-facing case routes (mounted at /api/worker).
 *
 * Every route requires a VERIFIED worker (requireVerifiedWorker ->
 * 403 { error: 'not_verified' } for unverified workers), except GET /me
 * which only requires a valid worker JWT so an unverified worker can still
 * read its own profile/verification status.
 *
 * Privacy: case payloads NEVER include device_id. Only deidentified
 * excerpts/summary fields (which the student explicitly authorised via the
 * independent cloud-organisation consent) are exposed.
 *
 * This module intentionally does NOT import genai.js.
 */

/** Statuses that count against a worker's active-case capacity. */
export const ACTIVE_STATUSES = ['claimed', 'replied', 'continued'];

/** Count of a worker's currently active cases (capacity bookkeeping). */
export function activeCaseCount(db, workerId) {
  return db
    .prepare(
      `SELECT COUNT(*) AS n FROM cases
        WHERE claimed_by = ? AND status IN ('claimed','replied','continued')`
    )
    .get(workerId).n;
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Public case shape for workers — never exposes device_id. */
function publicCase(row, { full = false } = {}) {
  const base = {
    id: row.id,
    status: row.status,
    topics: parseJsonArray(row.topics),
    language: row.language ?? null,
    period: row.period ?? null,
    main_concerns: row.main_concerns ?? null,
    recent_change: row.recent_change ?? null,
    claim_count: row.claim_count,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
  if (full) {
    base.excerpts = parseJsonArray(row.excerpts);
    base.claimed_at = row.claimed_at ?? null;
    base.responded_at = row.responded_at ?? null;
  }
  return base;
}

function publicMessage(row) {
  return {
    id: row.id,
    case_id: row.case_id,
    sender: row.sender,
    text: row.text,
    created_at: row.created_at,
  };
}

/** Latest message snippet for a case (140 chars max), or null. */
function lastMessageSnippet(db, caseId) {
  const row = db
    .prepare('SELECT * FROM messages WHERE case_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1')
    .get(caseId);
  if (!row) return null;
  return {
    sender: row.sender,
    text: row.text.length > 140 ? `${row.text.slice(0, 140)}…` : row.text,
    created_at: row.created_at,
  };
}

export function workerRouter(db, config) {
  const router = Router();

  // GET /api/worker/me — only requires a valid worker JWT (not verified),
  // so unverified workers can read their own profile/status.
  router.get('/me', requireWorker(db, config.jwtSecret), (req, res) => {
    const w = req.worker;
    res.json({
      worker: {
        id: w.id,
        email: w.email,
        name: w.name,
        organisation: w.organisation ?? null,
        expertise: parseJsonArray(w.expertise),
        languages: parseJsonArray(w.languages),
        max_active: w.max_active,
        verified: !!w.verified,
        created_at: w.created_at,
      },
    });
  });

  // Everything below requires a verified worker.
  const verified = requireVerifiedWorker(db, config.jwtSecret);

  // GET /api/worker/queue — matched open cases for this worker.
  // Matching rules:
  //   - case status is 'queued' or 'rematch'
  //   - case.language is one of worker.languages
  //   - worker.expertise contains 'general' OR intersects case.topics
  //   - worker's active-case count is below max_active
  // Ordered by created_at ASC (oldest waiting first). Includes waitingHours
  // and claim_count.
  router.get('/queue', verified, (req, res) => {
    const languages = parseJsonArray(req.worker.languages);
    const expertise = parseJsonArray(req.worker.expertise);
    const activeCount = activeCaseCount(db, req.worker.id);
    const atCapacity = activeCount >= req.worker.max_active;

    if (atCapacity || languages.length === 0) {
      return res.json({ cases: [], atCapacity, activeCount, maxActive: req.worker.max_active });
    }

    const placeholders = languages.map(() => '?').join(',');
    const rows = db
      .prepare(
        `SELECT * FROM cases
          WHERE status IN ('queued','rematch')
            AND language IN (${placeholders})
          ORDER BY created_at ASC`
      )
      .all(...languages);

    const matchesGeneral = expertise.includes('general');
    const nowMs = Date.now();
    const cases = rows
      .filter((row) => {
        if (matchesGeneral) return true;
        const topics = parseJsonArray(row.topics);
        return topics.some((t) => expertise.includes(t));
      })
      .map((row) => ({
        ...publicCase(row),
        waitingHours:
          Math.round(Math.max(0, (nowMs - new Date(row.created_at).getTime()) / 36000)) / 100,
      }));

    res.json({ cases, atCapacity: false, activeCount, maxActive: req.worker.max_active });
  });

  // POST /api/worker/cases/:id/claim — atomic claim.
  // 404 case_not_found | 409 already_claimed | 409 capacity_reached.
  router.post('/cases/:id/claim', verified, (req, res) => {
    const row = db.prepare('SELECT * FROM cases WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'case_not_found' });
    if (row.status !== 'queued' && row.status !== 'rematch') {
      return res.status(409).json({ error: 'already_claimed' });
    }
    if (activeCaseCount(db, req.worker.id) >= req.worker.max_active) {
      return res.status(409).json({ error: 'capacity_reached' });
    }

    const now = new Date().toISOString();
    // Atomic conditional UPDATE: only one concurrent claim can win.
    const result = db
      .prepare(
        `UPDATE cases
            SET status = 'claimed',
                claimed_by = ?,
                claimed_at = ?,
                claim_count = claim_count + 1,
                updated_at = ?
          WHERE id = ?
            AND status IN ('queued','rematch')`
      )
      .run(req.worker.id, now, now, req.params.id);

    if (result.changes === 0) {
      // Lost the race: another worker claimed it between read and write.
      return res.status(409).json({ error: 'already_claimed' });
    }

    const updated = db.prepare('SELECT * FROM cases WHERE id = ?').get(req.params.id);
    res.status(201).json({ case: publicCase(updated, { full: true }) });
  });

  // GET /api/worker/cases — my active cases with last message snippet.
  router.get('/cases', verified, (req, res) => {
    const rows = db
      .prepare(
        `SELECT * FROM cases
          WHERE claimed_by = ? AND status IN ('claimed','replied','continued')
          ORDER BY updated_at DESC`
      )
      .all(req.worker.id);
    const cases = rows.map((row) => ({
      ...publicCase(row),
      lastMessage: lastMessageSnippet(db, row.id),
    }));
    res.json({ cases });
  });

  // GET /api/worker/cases/:id — full case detail, only if claimed by me.
  router.get('/cases/:id', verified, (req, res) => {
    const row = db.prepare('SELECT * FROM cases WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'case_not_found' });
    if (row.claimed_by !== req.worker.id) {
      return res.status(403).json({ error: 'not_your_case' });
    }
    res.json({ case: publicCase(row, { full: true }) });
  });

  // POST /api/worker/cases/:id/respond { text } — send a message to the
  // student. Only while the case is 'claimed' or 'continued'; afterwards the
  // status becomes 'replied' and responded_at is set.
  router.post('/cases/:id/respond', verified, (req, res) => {
    const { text } = req.body || {};
    if (typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'text is required' });
    }
    const row = db.prepare('SELECT * FROM cases WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'case_not_found' });
    if (row.claimed_by !== req.worker.id) {
      return res.status(403).json({ error: 'not_your_case' });
    }
    if (row.status !== 'claimed' && row.status !== 'continued') {
      return res.status(409).json({ error: 'invalid_status' });
    }

    const now = new Date().toISOString();
    const messageId = newId();
    db.prepare(
      `INSERT INTO messages (id, case_id, sender, text, created_at)
       VALUES (?, ?, 'worker', ?, ?)`
    ).run(messageId, row.id, text.trim(), now);
    db.prepare(
      `UPDATE cases SET status = 'replied', responded_at = ?, updated_at = ? WHERE id = ?`
    ).run(now, now, row.id);

    const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
    const updated = db.prepare('SELECT * FROM cases WHERE id = ?').get(row.id);
    res.status(201).json({ message: publicMessage(message), case: publicCase(updated, { full: true }) });
  });

  // GET /api/worker/cases/:id/messages — full thread, only if claimed by me.
  router.get('/cases/:id/messages', verified, (req, res) => {
    const row = db.prepare('SELECT * FROM cases WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'case_not_found' });
    if (row.claimed_by !== req.worker.id) {
      return res.status(403).json({ error: 'not_your_case' });
    }
    const messages = db
      .prepare('SELECT * FROM messages WHERE case_id = ? ORDER BY created_at ASC, rowid ASC')
      .all(row.id)
      .map(publicMessage);
    res.json({ messages });
  });

  return router;
}
