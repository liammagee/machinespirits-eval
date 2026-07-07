// desktop/routeParity.js
//
// Pure helpers (NO native deps) to fingerprint and compare the route table of an
// Express app. Used by tests/desktopRouteParity.test.js to assert the desktop's
// production app serves the same routes as the canonical web app — so a future
// edit that forks the desktop's route table fails CI instead of drifting.

/**
 * A deterministic, order-independent set of "METHOD path" / middleware markers
 * for an Express app's top-level layer stack. Express 4 exposes `app._router`,
 * Express 5 `app.router`.
 */
export function routeFingerprint(app) {
  const stack = (app && (app._router?.stack || app.router?.stack)) || [];
  const out = [];
  for (const layer of stack) {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods || {})
        .filter((m) => layer.route.methods[m])
        .map((m) => m.toUpperCase())
        .sort()
        .join(',');
      out.push(`route ${layer.route.path} [${methods}]`);
    } else {
      out.push(`mw ${layer.name || 'anonymous'} ${layer.regexp?.source || ''}`);
    }
  }
  return out;
}

/** Compare two apps' route fingerprints as sets (ordering is not significant). */
export function diffRoutes(appA, appB) {
  const a = routeFingerprint(appA);
  const b = routeFingerprint(appB);
  const aSet = new Set(a);
  const bSet = new Set(b);
  const onlyInA = [...aSet].filter((x) => !bSet.has(x));
  const onlyInB = [...bSet].filter((x) => !aSet.has(x));
  return { equal: onlyInA.length === 0 && onlyInB.length === 0, onlyInA, onlyInB };
}
