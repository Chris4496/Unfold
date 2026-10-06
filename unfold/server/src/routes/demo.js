import { Router } from 'express';
import { ensureFictionalDemo, fictionalDemoSession } from '../fictional-demo.js';

/** Only mounted when the server is explicitly running in local demo mode. */
export function demoRouter(db) {
  const router = Router();
  router.get('/session', (_req, res) => {
    ensureFictionalDemo(db);
    return res.json(fictionalDemoSession(db));
  });
  return router;
}
