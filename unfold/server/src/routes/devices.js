import crypto from 'node:crypto';
import { Router } from 'express';
import { newDeviceToken, requireDevice } from '../auth.js';

/**
 * Deterministic device id derived from the client installId so that
 * POST /api/devices/register is idempotent: re-registering the same
 * install returns the same device row and token.
 */
function deviceIdFromInstallId(installId) {
  return 'dev_' + crypto.createHash('sha256').update(String(installId)).digest('hex').slice(0, 32);
}

function publicDevice(d) {
  return {
    deviceId: d.id,
    cloudOrg: !!d.cloud_org,
    created_at: d.created_at,
  };
}

/**
 * Device routes. Mounted at /api/devices.
 * Auth header for device routes: `Authorization: Bearer <device token>`.
 */
export function devicesRouter(db) {
  const router = Router();

  // POST /api/devices/register { installId } — idempotent.
  // The installId is a random id generated and stored on the device; it is
  // not personal data. Returns { deviceId, token }.
  router.post('/register', (req, res) => {
    const { installId } = req.body || {};
    if (typeof installId !== 'string' || installId.trim().length < 8) {
      return res.status(400).json({ error: 'installId (min 8 chars) is required' });
    }
    const id = deviceIdFromInstallId(installId.trim());
    const existing = db.prepare('SELECT * FROM devices WHERE id = ?').get(id);
    if (existing) {
      return res.json({ ...publicDevice(existing), token: existing.token });
    }
    const token = newDeviceToken();
    const now = new Date().toISOString();
    db.prepare('INSERT INTO devices (id, token, cloud_org, created_at) VALUES (?, ?, 0, ?)').run(
      id,
      token,
      now
    );
    const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(id);
    return res.status(201).json({ ...publicDevice(device), token: device.token });
  });

  // PUT /api/devices/me/consent { cloudOrg } — the INDEPENDENT cloud-
  // organisation authorisation. Only when cloudOrg is true may deidentified
  // text leave the device; original transcripts/audio never sync regardless.
  router.put('/me/consent', requireDevice(db), (req, res) => {
    const { cloudOrg } = req.body || {};
    if (typeof cloudOrg !== 'boolean') {
      return res.status(400).json({ error: 'cloudOrg must be a boolean' });
    }
    db.prepare('UPDATE devices SET cloud_org = ? WHERE id = ?').run(cloudOrg ? 1 : 0, req.device.id);
    const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(req.device.id);
    return res.json(publicDevice(device));
  });

  // GET /api/devices/me — current device record (device token required).
  router.get('/me', requireDevice(db), (req, res) => {
    return res.json(publicDevice(req.device));
  });

  return router;
}
