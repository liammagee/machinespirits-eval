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
    http.get(`${baseUrl}${path}`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let body;
        try { body = JSON.parse(data); } catch { body = data; }
        resolve({ status: res.statusCode, body });
      });
    }).on('error', reject);
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
    assert.ok(status === 404 || status === 500, `expected 404 or 500, got ${status}`);
    assert.ok(body.error, 'should have error message');
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
    assert.ok(status === 404 || status === 500, `expected 404 or 500, got ${status}`);
    assert.ok(body.error, 'should have error message');
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
