/**
 * Shared eval-surface mounter.
 *
 * Both standalone servers — server.js (:8081) and the poetics browser
 * (scripts/browse-poetics-scripts.js, :3466) — expose the SAME eval API + UI
 * surfaces (the shared /api/* routers and the public/ UI directories). Rather
 * than each hand-maintain its own copy of those mounts (where they inevitably
 * drift), they are defined ONCE here and both servers call
 * `mountEvalSurfaces(app, { root })`. Same single-source discipline as
 * railHtml() for the nav: one definition, no divergence.
 *
 * Contract — the HOST app owns the cross-cutting concerns and this mounter
 * touches none of them:
 *   - auth guard (server.js uses prefix 'EVAL'; poetics uses 'POETICS')
 *   - body parsing (express.json) — must already be applied by the host
 *   - the health check, the catch-all '/', the error handler, and listen()
 * This mounter adds ONLY the eval routers + the static UI directories, each
 * existsSync-guarded so an absent public/ dir is a silent skip (matching the
 * prior server.js behaviour, where each static block was existsSync-wrapped).
 *
 * Ordering: a caller that serves a MORE-specific static subtree (e.g. the
 * poetics app's '/docs/research', mounted with { index:false } for the paper)
 * must register it BEFORE calling this, so the broader '/docs' mount here does
 * not shadow it. Express matches in registration order, so first-registered
 * wins for overlapping prefixes.
 */
import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import evalRoutes from '../routes/evalRoutes.js';
import chatRoutes from '../routes/chatRoutes.js';
import pilotRoutes from '../routes/pilotRoutes.js';
import a19AdjudicationRoutes from '../routes/a19AdjudicationRoutes.js';
import humanCodingRoutes from '../routes/humanCodingRoutes.js';
import { createTutorStubSessionRouter } from '../routes/tutorStubSessionRoutes.js';
import { mountSubjectExplorer } from './subjectExplorer.js';
import { createTutorStubProcessSessionHost } from './tutorStubProcessSessionFactory.js';
import { buildTutorStubPublicCatalog } from './tutorStubCatalog.js';

// API routers, in mount order. [mountPath, router].
const API_ROUTERS = [
  ['/api/eval', evalRoutes],
  ['/api/chat', chatRoutes],
  ['/api/pilot', pilotRoutes],
  ['/api/a19/adjudication', a19AdjudicationRoutes],
  ['/api/human-coding', humanCodingRoutes],
];

// Static UI surfaces: [mountPath, dirRelativeToRoot]. Each is existsSync-guarded
// at mount time so a missing directory is skipped silently rather than erroring.
const STATIC_SURFACES = [
  ['/tutor', 'public/tutor'], // shared browser + Electron tutor-stub session studio
  ['/pilot', 'public/pilot'], // participant-facing human-learner pilot UI
  ['/pilot-admin', 'public/pilot-admin'], // operator dashboard (token-gated API)
  ['/adjudication', 'public/adjudication'], // A19 blinded human-adjudication forms
  ['/human-coding-admin', 'public/human-coding-admin'], // consolidated human labelling game
  ['/eval', 'public/eval'], // static research explainers and companion notes
  ['/components', 'public/components'], // shared design system (techne.css) + UI components
  ['/docs', 'docs'], // documentation tree (poetics pre-mounts /docs/research)
];

/**
 * Mount the eval API routers + static UI surfaces onto an existing Express app.
 * @param {import('express').Express} app  host app (already has auth + json)
 * @param {{ root: string, tutorStubSessionHost?: object|false, tutorStubCatalogProvider?: Function|false }} opts root resolves
 * static dirs; the real process-backed host is the default, while tests may
 * inject a host and narrow embedders may explicitly pass false
 * @returns {import('express').Express} the same app, for chaining
 */
export function mountEvalSurfaces(app, { root, tutorStubSessionHost, tutorStubCatalogProvider } = {}) {
  if (!app) throw new Error('mountEvalSurfaces: an Express app is required');
  if (!root) throw new Error('mountEvalSurfaces: { root } is required');
  for (const [mount, router] of API_ROUTERS) {
    app.use(mount, router);
  }
  const sessionHost =
    tutorStubSessionHost === undefined ? createTutorStubProcessSessionHost({ root }) : tutorStubSessionHost;
  if (sessionHost) {
    app.locals.tutorStubSessionHost = sessionHost;
    const catalogProvider =
      tutorStubCatalogProvider === undefined ? () => buildTutorStubPublicCatalog({ root }) : tutorStubCatalogProvider;
    app.use('/api/tutor-stub', createTutorStubSessionRouter({ host: sessionHost, catalogProvider }));
  }
  // Compatibility page only. The legacy eval-cell workbench now lives in the
  // explicit research mode of the shared tutor shell.
  app.use('/chat', (req, res) => {
    const prefix = (req.baseUrl || '').replace(/\/chat$/u, '');
    res.redirect(302, `${prefix}/tutor?mode=research`);
  });
  for (const [mount, relDir] of STATIC_SURFACES) {
    const dir = path.join(root, relDir);
    if (existsSync(dir)) app.use(mount, express.static(dir));
  }
  // Decoupled belief–desire DAG surface (MACHINE-SPIRIT.md §5): reads only the
  // structural engine + authored worlds; no DB, no shared state.
  mountSubjectExplorer(app);
  return app;
}
