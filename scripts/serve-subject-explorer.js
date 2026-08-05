/**
 * Standalone server for the (decoupled) Subject Explorer surface.
 *   npm run subject-explorer          (node scripts/serve-subject-explorer.js [port])
 * Mounts ONLY the subject-explorer routes — no eval DB, no poetics stack — so
 * the surface can be developed and verified in isolation. The same
 * mountSubjectExplorer(app) call also drops it into the main web/electron app.
 *
 * Perimeter matches the real servers (services/httpBasicAuth.js): loopback by
 * default; a public bind is opt-in via HOST / SUBJECT_EXPLORER_HOST and
 * refuses to start without credentials (EVAL_AUTH_* or MS_AUTH_*).
 */

import express from 'express';
import { pathToFileURL } from 'node:url';
import { mountSubjectExplorer } from '../services/subjectExplorer.js';
import { resolveBasicAuthGuard, makeRoleGate } from '../services/httpBasicAuth.js';

export function buildSubjectExplorerApp({ host = '127.0.0.1', env = process.env } = {}) {
  const app = express();
  const guard = resolveBasicAuthGuard({ env, prefix: 'EVAL', host, realm: 'machine spirits eval' });
  if (guard) app.use(guard);
  app.use(makeRoleGate());
  mountSubjectExplorer(app);
  app.get('/', (_req, res) => res.redirect('/subject'));
  return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.argv[2] || process.env.PORT || 4505);
  const host = process.env.SUBJECT_EXPLORER_HOST || process.env.HOST || '127.0.0.1';
  const app = buildSubjectExplorerApp({ host });
  app.listen(port, host, () => console.log(`[subject-explorer] http://${host}:${port}/subject`));
}
