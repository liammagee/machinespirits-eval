/**
 * API route tests — verifies that the Express endpoints return correct
 * response shapes for read-only operations (config, DB queries, file reads).
 *
 * Uses Node's built-in http module to make requests against the Express app
 * directly (no supertest dependency needed). The app is imported from server.js
 * and listens on an ephemeral port during tests.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';

// Import the Express app (does not start listening on its own)
import { app } from '../server.js';

/** Simple GET helper returning { status, body } with parsed JSON. */
function get(baseUrl, path) {
  return new Promise((resolve, reject) => {
    http
      .get(`${baseUrl}${path}`, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          let body;
          try {
            body = JSON.parse(data);
          } catch {
            body = data;
          }
          resolve({ status: res.statusCode, body });
        });
      })
      .on('error', reject);
  });
}

/** Simple JSON POST helper returning { status, body } with parsed JSON. */
function post(baseUrl, path, body = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const url = new URL(`${baseUrl}${path}`);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      },
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

describe('API routes', () => {
  let server;
  let baseUrl;

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  // ── Health check ──

  it('GET /health returns ok status with package info', async () => {
    const { status, body } = await get(baseUrl, '/health');
    assert.strictEqual(status, 200);
    assert.strictEqual(body.status, 'ok');
    assert.strictEqual(body.package, '@machinespirits/eval');
    assert.ok(body.version, 'should include version');
  });

  // ── Configuration endpoints ──

  it('GET /api/eval/scenarios returns a list of scenarios with id and name', async () => {
    const { status, body } = await get(baseUrl, '/api/eval/scenarios');
    assert.strictEqual(status, 200);
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.scenarios), 'scenarios should be an array');
    assert.ok(body.scenarios.length > 0, 'should have at least one scenario');
    for (const s of body.scenarios) {
      assert.ok(s.id, 'scenario should have id');
      assert.ok(s.name, `scenario ${s.id} should have name`);
    }
  });

  it('GET /api/eval/scenarios/:id returns details for a known scenario', async () => {
    const { status, body } = await get(baseUrl, '/api/eval/scenarios/new_user_first_visit');
    assert.strictEqual(status, 200);
    assert.strictEqual(body.success, true);
    assert.ok(body.scenario, 'should have scenario object');
    assert.ok(body.scenario.learner_context, 'should have learner_context');
  });

  it('GET /api/eval/scenarios/:id returns 404 for unknown scenario', async () => {
    const { status, body } = await get(baseUrl, '/api/eval/scenarios/nonexistent_scenario_xyz');
    assert.strictEqual(status, 404);
    assert.ok(body.error, 'should have error message');
  });

  it('GET /api/eval/configurations returns model configurations', async () => {
    const { status, body } = await get(baseUrl, '/api/eval/configurations');
    assert.strictEqual(status, 200);
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.configurations));
    assert.ok(body.configurations.length > 0);
  });

  it('POST evaluation launch endpoints honor dryRun without requiring API keys', async () => {
    const { status: profilesStatus, body: profilesBody } = await get(baseUrl, '/api/eval/profiles');
    assert.strictEqual(profilesStatus, 200);
    assert.strictEqual(profilesBody.success, true);
    const availableProfiles = profilesBody.profiles.map((p) => p.name).filter(Boolean);
    const profileA = availableProfiles.includes('budget') ? 'budget' : availableProfiles[0];
    const profileB = availableProfiles.find((p) => p !== profileA) || profileA;
    assert.ok(profileA, 'should have at least one available profile');

    const quick = await post(baseUrl, '/api/eval/quick', {
      profile: profileA,
      scenario: 'new_user_first_visit',
      dryRun: true,
      skipRubric: false,
    });
    assert.strictEqual(quick.status, 200);
    assert.strictEqual(quick.body.success, true);
    assert.ok(quick.body.runId, 'quick dryRun should persist a run id');
    assert.strictEqual(quick.body.result.scenarioId, 'new_user_first_visit');

    const run = await post(baseUrl, '/api/eval/run', {
      profiles: [profileA],
      scenarios: ['new_user_first_visit'],
      runsPerConfig: 1,
      dryRun: true,
      skipRubric: false,
    });
    assert.strictEqual(run.status, 200);
    assert.strictEqual(run.body.success, true);
    assert.ok(run.body.runId, 'run dryRun should return a run id');

    const compare = await post(baseUrl, '/api/eval/compare', {
      profiles: [profileA, profileB],
      scenarios: ['new_user_first_visit'],
      runsPerConfig: 1,
      dryRun: true,
    });
    assert.strictEqual(compare.status, 200);
    assert.strictEqual(compare.body.success, true);
    assert.ok(compare.body.runId, 'compare dryRun should return a run id');

    const matrix = await post(baseUrl, '/api/eval/matrix', {
      profiles: [profileA],
      scenarios: ['new_user_first_visit'],
      dryRun: true,
      skipRubric: false,
    });
    assert.strictEqual(matrix.status, 200);
    assert.strictEqual(matrix.body.success, true);
    assert.ok(matrix.body.runId, 'matrix dryRun should return a run id');
  });

  it('POST /api/eval/prompts/recommend honors dryRun without calling recommender APIs', async () => {
    const result = await post(baseUrl, '/api/eval/prompts/recommend', {
      profile: 'budget',
      scenarios: ['new_user_first_visit'],
      dryRun: true,
    });
    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.success, true);
    assert.strictEqual(result.body.readOnly, true);
    assert.strictEqual(result.body.dryRun, true);
    assert.strictEqual(result.body.recommenderModel, 'dry-run');
    assert.ok(result.body.analysis, 'dryRun recommendation should include analysis');
  });

  it('POST chat turn endpoints honor dryRun without model credentials', async () => {
    const tutor = await post(baseUrl, '/api/chat/turn', {
      cellName: 'cell_7_recog_multi_unified',
      learnerMessage: 'I think multiplying by the denominator makes the fraction bigger, but I am not sure why.',
      topic: 'fractions',
      dryRun: true,
    });
    assert.strictEqual(tutor.status, 200);
    assert.strictEqual(tutor.body.dryRun, true);
    assert.ok(tutor.body.finalMessage.includes('(dry run)'), 'dryRun tutor response should be visibly labelled');
    assert.strictEqual(tutor.body.architecture.hasSuperego, true);
    assert.ok(tutor.body.deliberation.some((entry) => entry.role === 'ego'));
    assert.ok(tutor.body.deliberation.some((entry) => entry.role === 'superego'));
    assert.strictEqual(tutor.body.totals.inputTokens, 0);
    assert.strictEqual(tutor.body.totals.outputTokens, 0);

    const learner = await post(baseUrl, '/api/chat/learner-turn', {
      cellName: 'cell_2_base_single_psycho',
      history: [{ role: 'tutor', content: 'What would happen if we tried one example first?' }],
      topic: 'fractions',
      personaId: 'eager_novice',
      dryRun: true,
    });
    assert.strictEqual(learner.status, 200);
    assert.strictEqual(learner.body.dryRun, true);
    assert.ok(learner.body.message.includes('(dry run)'), 'dryRun learner response should be visibly labelled');
    assert.strictEqual(learner.body.learnerProfile, 'ego_superego');
    assert.ok(learner.body.deliberation.some((entry) => entry.role === 'ego'));
    assert.ok(learner.body.deliberation.some((entry) => entry.role === 'superego'));
    assert.ok(learner.body.deliberation.some((entry) => entry.role === 'ego_revision'));
    assert.strictEqual(learner.body.totals.inputTokens, 0);
    assert.strictEqual(learner.body.totals.outputTokens, 0);
  });

  // ── DB-backed endpoints ──

  it('GET /api/eval/runs returns a list of runs', async () => {
    const { status, body } = await get(baseUrl, '/api/eval/runs');
    assert.strictEqual(status, 200);
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.runs), 'runs should be an array');
  });

  it('GET /api/eval/runs respects limit parameter', async () => {
    const { body } = await get(baseUrl, '/api/eval/runs?limit=2');
    assert.ok(body.runs.length <= 2, 'should respect limit');
  });

  it('GET /api/eval/runs-incomplete returns incomplete runs list', async () => {
    const { status, body } = await get(baseUrl, '/api/eval/runs-incomplete');
    assert.strictEqual(status, 200);
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.runs));
    assert.ok(typeof body.found === 'number');
  });

  it('GET /api/eval/runs/:runId returns error for nonexistent run', async () => {
    const { status, body } = await get(baseUrl, '/api/eval/runs/eval-9999-99-99-nonexistent');
    assert.strictEqual(status, 404);
    assert.ok(body.error, 'should have error message');
    assert.strictEqual(body.code, 'run_not_found');
  });

  it('GET /api/eval/runs/:runId returns data for an existing run', async () => {
    const { body: runsList } = await get(baseUrl, '/api/eval/runs?limit=1');
    if (runsList.runs.length === 0) return;
    const runId = runsList.runs[0].id;
    if (runId.startsWith('short-') || runId.startsWith('long-')) return;

    const { status, body } = await get(baseUrl, `/api/eval/runs/${runId}`);
    assert.strictEqual(status, 200);
    assert.ok(body.run || body.success, 'should have run data');
  });

  it('GET /api/eval/runs/:runId/report returns error for nonexistent run', async () => {
    const { status, body } = await get(baseUrl, '/api/eval/runs/eval-9999-99-99-nonexistent/report');
    assert.strictEqual(status, 404);
    assert.ok(body.error, 'should have error message');
    assert.strictEqual(body.code, 'run_not_found');
  });

  // ── File-system endpoints ──

  it('GET /api/eval/prompts returns a list of prompts', async () => {
    const { status, body } = await get(baseUrl, '/api/eval/prompts');
    assert.strictEqual(status, 200);
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.prompts));
  });

  it('GET /api/eval/docs returns a list of documentation files', async () => {
    const { status, body } = await get(baseUrl, '/api/eval/docs');
    assert.strictEqual(status, 200);
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.docs));
  });

  it('file-reading endpoints reject encoded path traversal', async () => {
    for (const route of [
      '/api/eval/prompts/..%2FAGENTS',
      '/api/eval/docs/..%2F..%2FAGENTS',
      '/api/eval/trajectory/..%2F..%2Fpackage',
    ]) {
      const { status, body } = await get(baseUrl, route);
      assert.strictEqual(status, 400, route);
      assert.ok(body.error, route);
    }
  });

  // ── Logs endpoints ──

  it('GET /api/eval/logs/dates returns available log dates', async () => {
    const { status, body } = await get(baseUrl, '/api/eval/logs/dates');
    assert.strictEqual(status, 200);
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.dates));
  });

  it('GET /api/eval/logs-stats returns log statistics', async () => {
    const { status, body } = await get(baseUrl, '/api/eval/logs-stats');
    assert.strictEqual(status, 200);
    assert.strictEqual(body.success, true);
  });

  // ── Interaction endpoints ──

  it('GET /api/eval/interactions returns interactions list', async () => {
    const { status, body } = await get(baseUrl, '/api/eval/interactions');
    assert.strictEqual(status, 200);
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.evals));
    assert.ok(typeof body.count === 'number');
  });

  // ── Analysis endpoints ──

  it('GET /api/eval/trends returns trends data', async () => {
    const { status, body } = await get(baseUrl, '/api/eval/trends');
    assert.strictEqual(status, 200);
    assert.strictEqual(body.success, true);
  });

  // ── Monitoring endpoints ──

  it('GET /api/eval/monitor/summary returns monitoring summary', async () => {
    const { status, body } = await get(baseUrl, '/api/eval/monitor/summary');
    assert.strictEqual(status, 200);
    assert.ok(body.activeSessions !== undefined || body.success !== undefined);
  });
});
