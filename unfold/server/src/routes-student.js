import { Router } from 'express';
import { newId, requireDevice } from './auth.js';
import { isWaiting } from './sweeper.js';
import { purgeDeviceCloudData } from './purge.js';
import {
  classifyEntry,
  linkEntries,
  dailySummary,
  briefResponse,
  analyseBackground,
  ask,
} from './genai.js';

/**
 * Student-facing routes (Expo client). Mounted at /api.
 *
 * Every route requires device auth:
 *   Authorization: Bearer <device token>
 *
 * Data boundary: only DEIDENTIFIED text ever reaches these routes, and the
 * sync endpoint additionally requires the device's independent
 * cloud-organisation consent (cloud_org = 1). Original transcripts/audio
 * never leave the device.
 *
 * All GenAI calls happen server-side in src/genai.js (Gemini, key from
 * the server environment only). Every response carries a `genai` flag so the
 * UI can disclose when a deterministic local fallback was used instead.
 */

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SYNC_ENTRIES = 200;
const RECENT_LINK_WINDOW = 50;
/** Max stored length of a student message (aligned with the client limit). */
const MAX_MESSAGE_CHARS = 500;

/** Wrap async handlers so rejections reach the central error handler. */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function dayOf(iso) {
  return String(iso || '').slice(0, 10);
}

function safeJsonArray(value) {
  return Array.isArray(value) ? value : [];
}

/** Row -> the {id, day, text} shape expected by src/genai.js. */
function toGenaiEntry(row) {
  return { id: row.id, day: dayOf(row.event_at || row.created_at), text: row.deidentified };
}

function publicEntry(row) {
  return {
    clientId: row.client_id,
    createdAt: row.created_at,
    eventAt: row.event_at,
    deidentified: row.deidentified,
    tokens: JSON.parse(row.tokens || '[]'),
    topics: JSON.parse(row.topics || '[]'),
    attributes: JSON.parse(row.attributes || '{}'),
    uncertainty: JSON.parse(row.uncertainty || '{}'),
    genai: !!row.genai,
    syncedAt: row.synced_at,
  };
}

export function studentRouter(db, config = {}) {
  const router = Router();
  router.use(requireDevice(db));

  const stmts = {
    entryByClientId: db.prepare('SELECT * FROM entries WHERE device_id = ? AND client_id = ?'),
    insertEntry: db.prepare(
      `INSERT INTO entries (id, device_id, client_id, created_at, event_at, deidentified, tokens, topics, attributes, uncertainty, genai, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ),
    updateEntry: db.prepare(
      `UPDATE entries
         SET created_at = ?, event_at = ?, deidentified = ?, tokens = ?,
             topics = ?, attributes = ?, uncertainty = ?, genai = ?, synced_at = ?
       WHERE device_id = ? AND client_id = ?`
    ),
    recentEntries: db.prepare(
      'SELECT * FROM entries WHERE device_id = ? ORDER BY created_at DESC LIMIT ?'
    ),
    allEntries: db.prepare('SELECT * FROM entries WHERE device_id = ? ORDER BY created_at ASC'),
    entriesForDay: db.prepare(
      `SELECT * FROM entries WHERE device_id = ? AND substr(COALESCE(NULLIF(event_at, ''), created_at), 1, 10) = ?
       ORDER BY created_at ASC`
    ),
    deleteLinks: db.prepare('DELETE FROM links WHERE device_id = ?'),
    insertLink: db.prepare(
      `INSERT INTO links (id, device_id, from_entry_id, to_entry_id, relation, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ),
    linksForDevice: db.prepare('SELECT * FROM links WHERE device_id = ? ORDER BY created_at ASC'),
    upsertAnalysis: db.prepare(
      `INSERT INTO analyses (device_id, updated_at, approaching, explanation, evidence, genai)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(device_id) DO UPDATE SET
         updated_at = excluded.updated_at,
         approaching = excluded.approaching,
         explanation = excluded.explanation,
         evidence = excluded.evidence,
         genai = excluded.genai`
    ),
    analysisForDevice: db.prepare('SELECT * FROM analyses WHERE device_id = ?'),
    summaryForDay: db.prepare('SELECT * FROM summaries WHERE device_id = ? AND day = ?'),
    upsertSummary: db.prepare(
      `INSERT INTO summaries (device_id, day, text, entry_ids, genai)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(device_id, day) DO UPDATE SET
         text = excluded.text, entry_ids = excluded.entry_ids, genai = excluded.genai`
    ),
    deleteSummariesForDays: (deviceId, days) => {
      const placeholders = days.map(() => '?').join(', ');
      return db
        .prepare(`DELETE FROM summaries WHERE device_id = ? AND day IN (${placeholders})`)
        .run(deviceId, ...days);
    },
    insertCase: db.prepare(
      `INSERT INTO cases (id, device_id, main_concerns, recent_change, period, excerpts, topics, language,
                          status, claim_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', 0, ?, ?)`
    ),
    caseById: db.prepare('SELECT * FROM cases WHERE id = ?'),
    activeCase: db.prepare(
      `SELECT * FROM cases WHERE device_id = ? AND status != 'withdrawn'
       ORDER BY created_at DESC LIMIT 1`
    ),
    messageCount: db.prepare('SELECT COUNT(*) AS n FROM messages WHERE case_id = ?'),
    messagesForCase: db.prepare(
      `SELECT m.*, w.name AS worker_name FROM messages m
       LEFT JOIN workers w ON w.id = m.sender_worker_id
       WHERE m.case_id = ? ORDER BY m.created_at ASC`
    ),
    insertMessage: db.prepare(
      'INSERT INTO messages (id, case_id, sender, text, created_at) VALUES (?, ?, ?, ?, ?)'
    ),
  };

  /** Load a case and verify it belongs to the requesting device. */
  function ownedCase(req, res) {
    const row = stmts.caseById.get(req.params.id);
    if (!row || row.device_id !== req.device.id) {
      res.status(404).json({ error: 'case_not_found' });
      return null;
    }
    return row;
  }

  /**
   * Re-derive cross-record artefacts for a device after entries changed:
   * relink the recent window, regenerate the background support analysis and
   * drop cached daily summaries for the affected days.
   */
  async function refreshDerived(deviceId, changedDays) {
    const recent = stmts.recentEntries.all(deviceId, RECENT_LINK_WINDOW);
    const genaiEntries = recent.map(toGenaiEntry);
    const now = new Date().toISOString();

    const { result: linkResult } = await linkEntries(genaiEntries);
    const replaceLinks = db.transaction(() => {
      stmts.deleteLinks.run(deviceId);
      for (const link of linkResult.links) {
        stmts.insertLink.run(newId(), deviceId, link.fromEntryId, link.toEntryId, link.relation, link.note, now);
      }
    });
    replaceLinks();

    const { result: analysis, genai: analysisGenai } = await analyseBackground({ entries: genaiEntries });
    stmts.upsertAnalysis.run(
      deviceId,
      now,
      analysis.approaching ? 1 : 0,
      analysis.explanation,
      JSON.stringify(analysis.evidence),
      analysisGenai ? 1 : 0
    );

    const days = [...changedDays].filter((day) => DAY_RE.test(day));
    if (days.length > 0) stmts.deleteSummariesForDays(deviceId, days);
  }

  // -------------------------------------------------------------------------
  // POST /api/entries/sync
  // Body: { entries: [{ clientId, createdAt, eventAt?, deidentified, tokens[] }] }
  // Requires cloud_org consent; upserts by (device_id, clientId); classifies
  // new/changed entries server-side and refreshes links/analysis/summaries.
  // -------------------------------------------------------------------------
  router.post(
    '/entries/sync',
    asyncHandler(async (req, res) => {
      if (!req.device.cloud_org) {
        return res.status(403).json({ error: 'cloud_org_not_enabled' });
      }
      const entries = req.body?.entries;
      if (!Array.isArray(entries)) {
        return res.status(400).json({ error: 'entries must be an array' });
      }
      if (entries.length > MAX_SYNC_ENTRIES) {
        return res.status(400).json({ error: `at most ${MAX_SYNC_ENTRIES} entries per sync` });
      }
      for (const entry of entries) {
        if (
          !entry ||
          !isNonEmptyString(entry.clientId) ||
          !isNonEmptyString(entry.createdAt) ||
          typeof entry.deidentified !== 'string' ||
          (entry.eventAt !== undefined && typeof entry.eventAt !== 'string')
        ) {
          return res.status(400).json({
            error: 'each entry needs clientId, createdAt and deidentified (eventAt optional)',
          });
        }
      }

      const deviceId = req.device.id;
      const results = [];
      const changedDays = new Set();
      let changed = 0;

      for (const entry of entries) {
        const clientId = entry.clientId.trim();
        const createdAt = entry.createdAt.trim();
        const existing = stmts.entryByClientId.get(deviceId, clientId);
        // eventAt: an explicit payload value always wins (including updating
        // an existing record's event_at); when omitted, keep the stored
        // event_at for known records and default to createdAt for new ones.
        const eventAt =
          entry.eventAt !== undefined
            ? entry.eventAt.trim()
            : (existing?.event_at ?? createdAt);

        const unchanged =
          existing &&
          existing.deidentified === entry.deidentified &&
          existing.created_at === createdAt &&
          existing.event_at === eventAt;

        if (unchanged) {
          results.push({
            clientId,
            topics: JSON.parse(existing.topics || '[]'),
            attributes: JSON.parse(existing.attributes || '{}'),
            uncertainty: JSON.parse(existing.uncertainty || '{}'),
            genai: !!existing.genai,
          });
          continue;
        }

        const { result: classification, genai } = await classifyEntry({ text: entry.deidentified });
        const syncedAt = new Date().toISOString();
        const row = [
          createdAt,
          eventAt,
          entry.deidentified,
          JSON.stringify(safeJsonArray(entry.tokens)),
          JSON.stringify(classification.topics),
          JSON.stringify(classification.attributes),
          JSON.stringify(classification.uncertainty),
          genai ? 1 : 0,
          syncedAt,
        ];
        if (existing) {
          stmts.updateEntry.run(...row, deviceId, clientId);
          // If the entry moved to a different day, the OLD day's cached
          // summary is affected too and must be regenerated.
          if (existing.event_at !== eventAt) {
            changedDays.add(dayOf(existing.event_at || existing.created_at));
          }
        } else {
          stmts.insertEntry.run(newId(), deviceId, clientId, ...row);
        }
        changed += 1;
        changedDays.add(dayOf(eventAt));
        results.push({ clientId, ...classification, genai });
      }

      if (changed > 0) {
        await refreshDerived(deviceId, changedDays);
      }

      return res.json({ results });
    })
  );

  // -------------------------------------------------------------------------
  // GET /api/entries -> all synced entries + cross-record links for the device
  // -------------------------------------------------------------------------
  router.get('/entries', (req, res) => {
    const deviceId = req.device.id;
    const rows = stmts.allEntries.all(deviceId);
    const clientIdById = new Map(rows.map((row) => [row.id, row.client_id]));
    const links = stmts.linksForDevice.all(deviceId).map((link) => ({
      fromClientId: clientIdById.get(link.from_entry_id) ?? link.from_entry_id,
      toClientId: clientIdById.get(link.to_entry_id) ?? link.to_entry_id,
      relation: link.relation,
      note: link.note,
      createdAt: link.created_at,
    }));
    return res.json({ entries: rows.map(publicEntry), links });
  });

  // -------------------------------------------------------------------------
  // DELETE /api/entries — remove ALL synced entries for this device plus
  // derived artefacts (links, summary cache, background analysis). Cases and
  // their messages are NOT affected (see CONTRACT.md). -> 200 { deleted: n }
  // -------------------------------------------------------------------------
  router.delete('/entries', (req, res) => {
    const deleted = purgeDeviceCloudData(db, req.device.id);
    return res.json({ deleted });
  });

  // -------------------------------------------------------------------------
  // DELETE /api/entries/:clientId — remove one synced entry. Links that
  // reference it and the cached summary of its day are cleaned up too; the
  // background analysis is regenerated on the next sync.
  // -> 200 { deleted: 1 } | 404 { error: 'entry_not_found' }
  // -------------------------------------------------------------------------
  router.delete('/entries/:clientId', (req, res) => {
    const deviceId = req.device.id;
    const row = stmts.entryByClientId.get(deviceId, req.params.clientId);
    if (!row) return res.status(404).json({ error: 'entry_not_found' });
    const tx = db.transaction(() => {
      db.prepare(
        'DELETE FROM links WHERE device_id = ? AND (from_entry_id = ? OR to_entry_id = ?)'
      ).run(deviceId, row.id, row.id);
      db.prepare('DELETE FROM summaries WHERE device_id = ? AND day = ?').run(
        deviceId,
        dayOf(row.event_at || row.created_at)
      );
      db.prepare('DELETE FROM entries WHERE device_id = ? AND client_id = ?').run(
        deviceId,
        req.params.clientId
      );
    });
    tx();
    return res.json({ deleted: 1 });
  });

  // -------------------------------------------------------------------------
  // GET /api/summaries/:day (YYYY-MM-DD) -> cached daily summary or a fresh
  // GenAI/fallback summary, cached on write. -> { day, text, genai }
  // -------------------------------------------------------------------------
  router.get(
    '/summaries/:day',
    asyncHandler(async (req, res) => {
      const day = req.params.day;
      if (!DAY_RE.test(day)) {
        return res.status(400).json({ error: 'day must be YYYY-MM-DD' });
      }
      const cached = stmts.summaryForDay.get(req.device.id, day);
      if (cached) {
        return res.json({ day, text: cached.text, genai: !!cached.genai });
      }
      const rows = stmts.entriesForDay.all(req.device.id, day);
      const { result, genai } = await dailySummary({ day, entries: rows.map(toGenaiEntry) });
      stmts.upsertSummary.run(
        req.device.id,
        day,
        result.text,
        JSON.stringify(rows.map((row) => row.id)),
        genai ? 1 : 0
      );
      return res.json({ day, text: result.text, genai });
    })
  );

  // -------------------------------------------------------------------------
  // POST /api/ask { question } -> NL Q&A over the device's synced entries.
  // Stores nothing. -> { found, text, hits, genai }
  // -------------------------------------------------------------------------
  router.post(
    '/ask',
    asyncHandler(async (req, res) => {
      const { question } = req.body || {};
      if (!isNonEmptyString(question)) {
        return res.status(400).json({ error: 'question is required' });
      }
      const rows = stmts.recentEntries.all(req.device.id, RECENT_LINK_WINDOW);
      const clientIdById = new Map(rows.map((row) => [row.id, row.client_id]));
      const { result, genai } = await ask({
        question: question.trim(),
        entries: rows.map(toGenaiEntry),
      });
      const hits = result.hits.map((hit) => ({
        clientId: clientIdById.get(hit.entryId) ?? hit.entryId,
        dateLabel: hit.dateLabel,
        quote: hit.quote,
      }));
      return res.json({ found: result.found, text: result.text, hits, genai });
    })
  );

  // -------------------------------------------------------------------------
  // POST /api/respond { deidentified, recentKinds[] } -> one brief, optional
  // response shown after a note is saved. -> { kind, text, genai }
  // -------------------------------------------------------------------------
  router.post(
    '/respond',
    asyncHandler(async (req, res) => {
      const { deidentified, recentKinds } = req.body || {};
      if (typeof deidentified !== 'string') {
        return res.status(400).json({ error: 'deidentified text is required' });
      }
      const { result, genai } = await briefResponse({
        text: deidentified,
        recentKinds: safeJsonArray(recentKinds),
      });
      return res.json({ kind: result.kind, text: result.text, genai });
    })
  );

  // -------------------------------------------------------------------------
  // GET /api/analysis -> latest background support analysis for the device.
  // -> { approaching, explanation, evidence, genai, updatedAt }
  // -------------------------------------------------------------------------
  router.get('/analysis', (req, res) => {
    const row = stmts.analysisForDevice.get(req.device.id);
    if (!row) {
      return res.json({
        approaching: false,
        explanation: null,
        evidence: [],
        genai: false,
        updatedAt: null,
      });
    }
    return res.json({
      approaching: !!row.approaching,
      explanation: row.explanation,
      evidence: JSON.parse(row.evidence || '[]'),
      genai: !!row.genai,
      updatedAt: row.updated_at,
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/cases { mainConcerns, recentChange, period, excerpts, topics,
  // language } -> queue a support case (deidentified content only). 201 { id }
  // -------------------------------------------------------------------------
  router.post('/cases', (req, res) => {
    const { mainConcerns, recentChange, period, excerpts, topics, language } = req.body || {};
    if (!isNonEmptyString(mainConcerns) || !isNonEmptyString(recentChange) || !isNonEmptyString(period)) {
      return res.status(400).json({ error: 'mainConcerns, recentChange and period are required' });
    }
    if (excerpts !== undefined && !Array.isArray(excerpts)) {
      return res.status(400).json({ error: 'excerpts must be an array of deidentified excerpts' });
    }
    if (topics !== undefined && !Array.isArray(topics)) {
      return res.status(400).json({ error: 'topics must be an array' });
    }
    if (language !== undefined && typeof language !== 'string') {
      return res.status(400).json({ error: 'language must be a string' });
    }
    const id = newId();
    const now = new Date().toISOString();
    stmts.insertCase.run(
      id,
      req.device.id,
      mainConcerns.trim(),
      recentChange.trim(),
      period.trim(),
      JSON.stringify(safeJsonArray(excerpts)),
      JSON.stringify(safeJsonArray(topics)),
      language ?? null,
      now,
      now
    );
    return res.status(201).json({ id });
  });

  // -------------------------------------------------------------------------
  // GET /api/cases/active -> latest non-withdrawn case with computed flags:
  // waitingNoWorker (queued/rematch older than UNCLAIMED_TIMEOUT_HOURS),
  // messages count, status.
  // -------------------------------------------------------------------------
  router.get('/cases/active', (req, res) => {
    const row = stmts.activeCase.get(req.device.id);
    if (!row) return res.json({ case: null });
    const { n: messages } = stmts.messageCount.get(row.id);
    return res.json({
      case: {
        id: row.id,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        claimCount: row.claim_count,
        claimed: !!row.claimed_by,
        waitingNoWorker: isWaiting(row, new Date(), config),
        messages,
      },
    });
  });

  // POST /api/cases/:id/withdraw — student withdraws the request for support.
  router.post('/cases/:id/withdraw', (req, res) => {
    const row = ownedCase(req, res);
    if (!row) return;
    if (row.status === 'withdrawn') {
      return res.status(400).json({ error: 'invalid_transition', status: row.status });
    }
    db.prepare(`UPDATE cases SET status = 'withdrawn', updated_at = ? WHERE id = ?`).run(
      new Date().toISOString(),
      row.id
    );
    return res.json({ id: row.id, status: 'withdrawn' });
  });

  // POST /api/cases/:id/continue — student continues the conversation after a
  // worker reply (replied -> continued).
  router.post('/cases/:id/continue', (req, res) => {
    const row = ownedCase(req, res);
    if (!row) return;
    if (row.status !== 'replied') {
      return res.status(400).json({ error: 'invalid_transition', status: row.status });
    }
    db.prepare(`UPDATE cases SET status = 'continued', updated_at = ? WHERE id = ?`).run(
      new Date().toISOString(),
      row.id
    );
    return res.json({ id: row.id, status: 'continued' });
  });

  // POST /api/cases/:id/rematch — student asks for a different worker: the
  // case goes back to the queue (status queued, claimed_by NULL,
  // claim_count++), keeping its history for the next worker.
  router.post('/cases/:id/rematch', (req, res) => {
    const row = ownedCase(req, res);
    if (!row) return;
    if (!['claimed', 'replied', 'continued', 'rematch'].includes(row.status)) {
      return res.status(400).json({ error: 'invalid_transition', status: row.status });
    }
    db.prepare(
      `UPDATE cases
         SET status = 'queued', claimed_by = NULL, claimed_at = NULL, responded_at = NULL,
             claim_count = claim_count + 1, updated_at = ?
       WHERE id = ?`
    ).run(new Date().toISOString(), row.id);
    return res.json({ id: row.id, status: 'queued' });
  });

  // GET /api/cases/:id/messages — conversation on an owned case.
  router.get('/cases/:id/messages', (req, res) => {
    const row = ownedCase(req, res);
    if (!row) return;
    const messages = stmts.messagesForCase.all(row.id).map((message) => ({
      id: message.id,
      sender: message.sender,
      text: message.text,
      createdAt: message.created_at,
      workerName: message.worker_name ?? null,
    }));
    return res.json({ messages });
  });

  // POST /api/cases/:id/messages { text } — student sends a message.
  router.post('/cases/:id/messages', (req, res) => {
    const row = ownedCase(req, res);
    if (!row) return;
    if (row.status === 'withdrawn') {
      return res.status(400).json({ error: 'invalid_transition', status: row.status });
    }
    const { text } = req.body || {};
    if (!isNonEmptyString(text)) {
      return res.status(400).json({ error: 'text is required' });
    }
    const message = {
      id: newId(),
      sender: 'student',
      text: text.trim().slice(0, MAX_MESSAGE_CHARS),
      createdAt: new Date().toISOString(),
    };
    stmts.insertMessage.run(message.id, row.id, message.sender, message.text, message.createdAt);
    db.prepare('UPDATE cases SET updated_at = ? WHERE id = ?').run(message.createdAt, row.id);
    return res.status(201).json({ message });
  });

  return router;
}
