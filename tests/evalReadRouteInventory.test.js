import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import router from '../routes/evalRoutes.js';
import { EVAL_READ_ROUTE_KEYS } from '../routes/evalReadRouteInventory.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const EXPECTED_ROUTE_KEYS = Object.freeze([
  'POST /codex/sessions',
  'GET /codex/sessions',
  'GET /codex/sessions/:id',
  'GET /codex/sessions/:id/poll',
  'POST /codex/sessions/:id/input',
  'DELETE /codex/sessions/:id',
  'POST /codex/paper-bug-audit-session',
  'GET /scenarios',
  'GET /scenarios/:id',
  'GET /profiles',
  'GET /learner-profiles',
  'GET /configurations',
  'POST /quick',
  'GET /stream/quick',
  'POST /run',
  'POST /compare',
  'POST /matrix',
  'GET /stream/matrix',
  'GET /stream/interact',
  'GET /runs',
  'GET /runs-incomplete',
  'POST /runs-auto-complete',
  'GET /runs/:runId',
  'GET /runs/:runId/report',
  'GET /logs/dates',
  'GET /logs/:date',
  'GET /logs/dialogue/:dialogueId',
  'GET /logs/:date/:index',
  'GET /logs-stats',
  'GET /prompts',
  'GET /prompts/:name',
  'POST /prompts/recommend',
  'GET /stream/run',
  'GET /trajectory/:profile',
  'GET /compare-runs/:runId1/:runId2',
  'GET /trends',
  'GET /docs',
  'GET /docs/:name',
  'GET /monitor/summary',
  'GET /monitor/sessions',
  'GET /monitor/sessions/:id',
  'GET /monitor/alerts',
  'POST /monitor/alerts/:id/acknowledge',
  'POST /runs/:runId/complete',
  'GET /runs/:runId/resume-status',
  'GET /interactions',
  'GET /interactions/:evalId',
  'GET /interactions/:evalId/diagram',
  'GET /interactions/:evalId/transcript',
  'GET /stream/recognition-ab',
]);

function registeredRouteKeys() {
  return router.stack
    .filter((layer) => layer.route)
    .map((layer) => {
      const method = Object.keys(layer.route.methods).find((name) => layer.route.methods[name]);
      return `${method.toUpperCase()} ${layer.route.path}`;
    });
}

test('evaluation router preserves the exact 50-route method and order contract', () => {
  assert.deepEqual(registeredRouteKeys(), EXPECTED_ROUTE_KEYS);
});

test('read-domain inventory owns exactly the 30 non-metered GET routes', () => {
  assert.equal(EVAL_READ_ROUTE_KEYS.length, 30);
  assert.equal(new Set(EVAL_READ_ROUTE_KEYS).size, 30);
  assert.deepEqual(
    EXPECTED_ROUTE_KEYS.filter((routeKey) => EVAL_READ_ROUTE_KEYS.includes(routeKey)),
    EVAL_READ_ROUTE_KEYS,
  );
});

test('compatibility router delegates every read-only domain to bounded registrars', () => {
  const source = fs.readFileSync(path.join(ROOT, 'routes/evalRoutes.js'), 'utf8');
  for (const registrar of [
    'registerEvalConfigurationReadRoutes',
    'registerEvalRunListReadRoutes',
    'registerEvalRunDetailReadRoutes',
    'registerEvalLogReadRoutes',
    'registerEvalPromptReadRoutes',
    'registerEvalTrajectoryReadRoutes',
    'registerEvalAnalysisReadRoutes',
    'registerEvalDocumentationReadRoutes',
    'registerEvalMonitoringReadRoutes',
    'registerEvalRunResumeStatusReadRoute',
    'registerEvalInteractionReadRoutes',
  ]) {
    assert.match(source, new RegExp(`${registrar}\\(router`));
  }
  for (const routeKey of EVAL_READ_ROUTE_KEYS) {
    const routePath = routeKey.slice('GET '.length).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.doesNotMatch(source, new RegExp(`router\\.get\\(\\s*['"]${routePath}['"]`));
  }
});
