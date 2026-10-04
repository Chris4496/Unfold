/**
 * Cloud-data deletion lifecycle.
 *
 * purgeDeviceCloudData removes ALL cloud-side data derived from a device's
 * synced entries: the entries themselves, cross-record links, cached daily
 * summaries and the background support analysis.
 *
 * Cases (support requests) and their messages are deliberately NOT touched:
 * the lifecycle of deidentified excerpts already shared with the cloud
 * organisation inside a case is a separate product decision (see
 * CONTRACT.md, "Cloud-data deletion lifecycle").
 */

/**
 * Delete every entry-scoped row for a device. Returns the number of
 * entries deleted. Runs in a single transaction.
 */
export function purgeDeviceCloudData(db, deviceId) {
  const tx = db.transaction(() => {
    const { n } = db
      .prepare('SELECT COUNT(*) AS n FROM entries WHERE device_id = ?')
      .get(deviceId);
    db.prepare('DELETE FROM links WHERE device_id = ?').run(deviceId);
    db.prepare('DELETE FROM summaries WHERE device_id = ?').run(deviceId);
    db.prepare('DELETE FROM analyses WHERE device_id = ?').run(deviceId);
    db.prepare('DELETE FROM entries WHERE device_id = ?').run(deviceId);
    return n;
  });
  return tx();
}
