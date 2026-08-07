import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import express from 'express';

import { resolveEvalRouteDependencies } from '../routes/evalRoutes.js';
import { bindEvalSurfaceDependencies, mountEvalSurfaces } from '../services/evalSurfaces.js';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('evalRoutes host dependency injection', () => {
  it('resolves store and runner from the current request app without cross-host leakage', () => {
    const storeA = { id: 'store-a' };
    const runnerA = { id: 'runner-a' };
    const storeB = { id: 'store-b' };
    const runnerB = { id: 'runner-b' };
    const appA = express();
    const appB = express();

    bindEvalSurfaceDependencies(appA, { evaluationStore: storeA, evaluationRunner: runnerA });
    bindEvalSurfaceDependencies(appB, { evaluationStore: storeB, evaluationRunner: runnerB });

    assert.deepEqual(resolveEvalRouteDependencies({ app: appA }), {
      evaluationStore: storeA,
      evaluationRunner: runnerA,
    });
    assert.deepEqual(resolveEvalRouteDependencies({ app: appB }), {
      evaluationStore: storeB,
      evaluationRunner: runnerB,
    });
  });

  it('fails closed when a host serves eval routes without binding dependencies', () => {
    assert.throws(
      () => resolveEvalRouteDependencies({ app: express() }),
      /bind the host with bindEvalSurfaceDependencies/u,
    );
    assert.throws(() => bindEvalSurfaceDependencies(express()), /evaluationStore is required/u);
  });

  it('constructs a runner bound to the supplied store and accepts explicit test runners', () => {
    const calls = [];
    const evaluationStore = {
      getRun(runId) {
        calls.push(['getRun', runId]);
        return { id: runId };
      },
      getRunStats: () => [],
      getScenarioStats: () => [],
      getResults: () => [],
    };
    const app = express();
    bindEvalSurfaceDependencies(app, { evaluationStore });

    const dependencies = resolveEvalRouteDependencies({ app });
    assert.equal(dependencies.evaluationStore, evaluationStore);
    assert.deepEqual(dependencies.evaluationRunner.getRunResults('run-bound-to-store'), {
      run: { id: 'run-bound-to-store' },
      stats: [],
      scenarioStats: [],
      results: [],
    });
    assert.deepEqual(calls, [['getRun', 'run-bound-to-store']]);

    const explicitRunner = { id: 'explicit-runner' };
    mountEvalSurfaces(app, {
      root: ROOT_DIR,
      evaluationStore,
      evaluationRunner: explicitRunner,
      tutorStubSessionHost: false,
      tutorStubCatalogProvider: false,
    });
    assert.equal(app.locals.evaluationRunner, explicitRunner);
  });

  it('keeps the route module free of legacy facade and runner namespace imports', () => {
    const source = fs.readFileSync(path.join(ROOT_DIR, 'routes', 'evalRoutes.js'), 'utf8');
    assert.doesNotMatch(source, /from ['"]\.\.\/services\/evaluationStore\.js['"]/u);
    assert.doesNotMatch(source, /import \* as evaluationRunner/u);
    assert.match(source, /evaluationStoreFor\(req\)/u);
    assert.match(source, /evaluationRunnerFor\(req\)/u);
  });
});
