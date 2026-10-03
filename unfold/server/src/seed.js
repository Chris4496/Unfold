import { createDb } from './db.js';
import { config } from './config.js';
import { newId, hashPassword } from './auth.js';

/**
 * Seed script: creates one verified demo worker and one unverified worker.
 * Idempotent: existing rows (matched by email) are left untouched.
 *
 * Demo credentials (local development only):
 *   demo.worker@unfold.local / demo1234  (verified, general expertise, zh-HK + en)
 *   new.worker@unfold.local  / demo1234  (unverified)
 */
export function seed(db) {
  const now = new Date().toISOString();
  const insert = db.prepare(
    `INSERT INTO workers (id, email, password_hash, name, organisation, expertise, languages, max_active, verified, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(email) DO NOTHING`
  );

  const demo = insert.run(
    newId(),
    'demo.worker@unfold.local',
    hashPassword('demo1234'),
    'Demo Worker',
    'Unfold Demo NGO',
    JSON.stringify(['general']),
    JSON.stringify(['zh-HK', 'en']),
    5,
    1, // verified
    now
  );

  const unverified = insert.run(
    newId(),
    'new.worker@unfold.local',
    hashPassword('demo1234'),
    'New Worker',
    'Unfold Demo NGO',
    JSON.stringify(['general']),
    JSON.stringify(['en']),
    5,
    0, // not verified
    now
  );

  return {
    demoWorkerInserted: demo.changes > 0,
    unverifiedWorkerInserted: unverified.changes > 0,
  };
}

import { fileURLToPath } from 'node:url';
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const db = createDb(config.dbPath);
  const result = seed(db);
  console.log('[seed] done:', result);
  console.log('[seed] demo worker: demo.worker@unfold.local / demo1234 (verified)');
  console.log('[seed] unverified worker: new.worker@unfold.local / demo1234');
}
