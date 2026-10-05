/**
 * Cloud-data deletion lifecycle.
 *
 * purgeDeviceCloudData removes ALL cloud-side data a device ever produced:
 * the synced entries themselves, cross-record links, cached daily summaries,
 * the background support analysis, and — per the N1 lifecycle decision — the
 * device's cases (support requests) together with their whole conversation
 * (messages). Deidentified excerpts shared inside a case leave with the case
 * row, so nothing shared with the cloud organisation survives a purge.
 *
 * See CONTRACT.md, "Cloud-data deletion lifecycle".
 */

/**
 * Delete every cloud row for a device, in a single transaction.
 * Returns `{ deleted, casesDeleted }` where `deleted` keeps the
 * entries-count semantics used by the DELETE /api/entries and consent-purge
 * responses, and `casesDeleted` counts the removed case rows.
 */
export function purgeDeviceCloudData(db, deviceId) {
  const tx = db.transaction(() => {
    const { n } = db
      .prepare('SELECT COUNT(*) AS n FROM entries WHERE device_id = ?')
      .get(deviceId);
    const { n: casesDeleted } = db
      .prepare('SELECT COUNT(*) AS n FROM cases WHERE device_id = ?')
      .get(deviceId);
    // Messages first: they reference the cases being deleted.
    db.prepare(
      'DELETE FROM messages WHERE case_id IN (SELECT id FROM cases WHERE device_id = ?)'
    ).run(deviceId);
    db.prepare('DELETE FROM cases WHERE device_id = ?').run(deviceId);
    db.prepare('DELETE FROM links WHERE device_id = ?').run(deviceId);
    db.prepare('DELETE FROM summaries WHERE device_id = ?').run(deviceId);
    db.prepare('DELETE FROM analyses WHERE device_id = ?').run(deviceId);
    db.prepare('DELETE FROM entries WHERE device_id = ?').run(deviceId);
    return { deleted: n, casesDeleted };
  });
  return tx();
}
