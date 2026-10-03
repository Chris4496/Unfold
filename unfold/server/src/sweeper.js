/**
 * Timeout sweeper for support cases.
 *
 * Rules (see CONTRACT.md):
 * - A case in status 'queued' or 'rematch' that has been unclaimed for more
 *   than UNCLAIMED_TIMEOUT_HOURS keeps its status; the "still waiting" flag
 *   is computed at read time (isWaiting) so the student UI can disclose it.
 * - A case in status 'claimed' whose worker has not responded for more than
 *   RESPONSE_TIMEOUT_HOURS is auto-returned to the queue: status becomes
 *   'rematch', claimed_by/claimed_at are cleared, and claim_count is
 *   incremented (it counts failed claim attempts as well).
 *
 * The sweeper is deterministic and takes `now` explicitly so tests can
 * control time.
 */

export function runSweeper(db, now = new Date(), config = {}) {
  const responseTimeoutHours = Number(config.responseTimeoutHours ?? 48);
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  const cutoff = new Date(nowMs - responseTimeoutHours * 3600 * 1000).toISOString();

  const result = db
    .prepare(
      `UPDATE cases
         SET status = 'rematch',
             claimed_by = NULL,
             claimed_at = NULL,
             claim_count = claim_count + 1,
             updated_at = ?
       WHERE status = 'claimed'
         AND responded_at IS NULL
         AND claimed_at IS NOT NULL
         AND claimed_at < ?`
    )
    .run(new Date(nowMs).toISOString(), cutoff);

  return { rematched: result.changes };
}

/**
 * Read-time helper: should the student see the "still waiting" flag?
 * True for unclaimed queued/rematch cases older than the unclaimed timeout.
 */
export function isWaiting(caseRow, now = new Date(), config = {}) {
  const unclaimedTimeoutHours = Number(config.unclaimedTimeoutHours ?? 72);
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  if (caseRow.status !== 'queued' && caseRow.status !== 'rematch') return false;
  const ageMs = nowMs - new Date(caseRow.created_at).getTime();
  return ageMs > unclaimedTimeoutHours * 3600 * 1000;
}

/** Start the periodic sweeper. Returns the interval handle. */
export function startSweeper(db, config, intervalMs = 60 * 1000) {
  const handle = setInterval(() => {
    try {
      runSweeper(db, new Date(), config);
    } catch (err) {
      console.error('[sweeper] error:', err.message);
    }
  }, intervalMs);
  handle.unref?.();
  return handle;
}
