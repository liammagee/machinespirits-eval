/**
 * Shared eval-surface mounter.
 *
 * Both standalone servers — server.js (:8081) and the poetics browser
 * (scripts/browse-poetics-scripts.js, :3466) — expose the SAME eval API + UI
 * surfaces (the four /api/* routers and the public/ UI directories). Rather
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

// API routers, in mount order. [mountPath, router].
const API_ROUTERS = [
  ['/api/eval', evalRoutes],
  ['/api/chat', chatRoutes],
  ['/api/pilot', pilotRoutes],
  ['/api/a19/adjudication', a19AdjudicationRoutes],
];

// Static UI surfaces: [mountPath, dirRelativeToRoot]. Each is existsSync-guarded
// at mount time so a missing directory is skipped silently rather than erroring.
const STATIC_SURFACES = [
  ['/chat', 'public/chat'], // interactive tutor (ego/superego deliberation viewer)
  ['/pilot', 'public/pilot'], // participant-facing human-learner pilot UI
  ['/pilot-admin', 'public/pilot-admin'], // operator dashboard (token-gated API)
  ['/adjudication', 'public/adjudication'], // A19 blinded human-adjudication forms
  ['/eval', 'public/eval'], // static research explainers and companion notes
  ['/components', 'public/components'], // shared design system (techne.css) + UI components
  ['/docs', 'docs'], // documentation tree (poetics pre-mounts /docs/research)
];

/**
 * Mount the eval API routers + static UI surfaces onto an existing Express app.
 * @param {import('express').Express} app  host app (already has auth + json)
 * @param {{ root: string }} opts  root is the repo root used to resolve dirs
 * @returns {import('express').Express} the same app, for chaining
 */
export function mountEvalSurfaces(app, { root } = {}) {
  if (!app) throw new Error('mountEvalSurfaces: an Express app is required');
  if (!root) throw new Error('mountEvalSurfaces: { root } is required');
  for (const [mount, router] of API_ROUTERS) {
    app.use(mount, router);
  }
  for (const [mount, relDir] of STATIC_SURFACES) {
    const dir = path.join(root, relDir);
    if (existsSync(dir)) app.use(mount, express.static(dir));
  }
  return app;
}
