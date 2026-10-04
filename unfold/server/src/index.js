import express from 'express';
import cors from 'cors';
import { config as defaultConfig } from './config.js';
import { createDb } from './db.js';
import { workersRouter } from './routes/workers.js';
import { devicesRouter } from './routes/devices.js';
import { workerRouter } from './routes-worker.js';
import { studentRouter } from './routes-student.js';
import { startSweeper } from './sweeper.js';

/**
 * Express app factory. Exported separately from the listener so tests can
 * build an app against an in-memory database.
 *
 * All GenAI calls happen server-side (see src/genai.js) using the Gemini
 * key from the server environment only; nothing here ever ships a key to a
 * client.
 */
export function createApp({ db, config = defaultConfig } = {}) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      genai: {
        configured: !!config.geminiApiKey,
        model: config.genaiModel,
        baseUrl: config.geminiBaseUrl,
      },
      timeouts: {
        unclaimedHours: config.unclaimedTimeoutHours,
        responseHours: config.responseTimeoutHours,
      },
    });
  });

  app.use('/api/workers', workersRouter(db, config));
  app.use('/api/worker', workerRouter(db, config));
  app.use('/api/devices', devicesRouter(db));
  app.use('/api', studentRouter(db, config));

  // 404 for unknown API routes
  app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found' }));

  // Central error handler
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error('[server] error:', err);
    res.status(500).json({ error: 'internal_error' });
  });

  return app;
}

// Boot only when run directly (node src/index.js), not when imported by tests.
import { fileURLToPath } from 'node:url';
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const db = createDb(defaultConfig.dbPath);
  const app = createApp({ db, config: defaultConfig });
  startSweeper(db, defaultConfig);
  app.listen(defaultConfig.port, () => {
    console.log(`[server] Unfold backend listening on http://localhost:${defaultConfig.port}`);
    console.log(
      `[server] GenAI: ${defaultConfig.geminiApiKey ? `configured (model ${defaultConfig.genaiModel})` : 'NOT configured — deterministic local fallbacks will be used (genai=0)'}`
    );
  });
}
