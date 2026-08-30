import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  ANALYSIS_DOC_RELATIVE_PATH,
  ANALYSIS_REGISTRY_RELATIVE_PATH,
  AnalysisRegistryError,
  loadAnalysisRegistry,
  renderAnalysisRegistry,
  synchronizeAnalysisRegistry,
  validateAnalysisRegistry,
} from '../scripts/sync-analysis-scripts-registry.js';

test('the analysis registry covers the live analyze-* inventory and its generated documentation', () => {
  const projectRoot = path.resolve('.');
  const registry = loadAnalysisRegistry(projectRoot);
  const validation = validateAnalysisRegistry(registry, projectRoot);

  assert.deepEqual(validation.errors, []);
  assert.equal(registry.scripts.length, validation.inventory.length);
  assert.equal(
    fs.readFileSync(path.join(projectRoot, ANALYSIS_DOC_RELATIVE_PATH), 'utf8'),
    renderAnalysisRegistry(registry),
  );
  assert.deepEqual(synchronizeAnalysisRegistry({ projectRoot, mode: 'check' }), {
    changed: false,
    count: registry.scripts.length,
    docPath: path.join(projectRoot, ANALYSIS_DOC_RELATIVE_PATH),
  });
});

test('write mode repairs documentation while inventory drift fails closed', (t) => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'analysis-registry-'));
  t.after(() => fs.rmSync(projectRoot, { recursive: true, force: true }));
  fs.mkdirSync(path.join(projectRoot, 'scripts'), { recursive: true });
  fs.writeFileSync(
    path.join(projectRoot, 'scripts/analyze-alpha.js'),
    "const args = process.argv.slice(2);\nif (args.includes('--json')) console.log('{}');\n",
  );
  const registry = {
    version: 1,
    families: [{ id: 'fixture', title: 'Fixture family' }],
    scripts: [
      {
        path: 'scripts/analyze-alpha.js',
        family: 'fixture',
        purpose: 'Exercise deterministic registry synchronization.',
        flags: ['--json'],
      },
    ],
  };
  fs.writeFileSync(path.join(projectRoot, ANALYSIS_REGISTRY_RELATIVE_PATH), `${JSON.stringify(registry, null, 2)}\n`);
  fs.writeFileSync(path.join(projectRoot, ANALYSIS_DOC_RELATIVE_PATH), '# stale\n');

  assert.deepEqual(synchronizeAnalysisRegistry({ projectRoot, mode: 'write' }), {
    changed: true,
    count: 1,
    docPath: path.join(projectRoot, ANALYSIS_DOC_RELATIVE_PATH),
  });
  assert.equal(
    fs.readFileSync(path.join(projectRoot, ANALYSIS_DOC_RELATIVE_PATH), 'utf8'),
    renderAnalysisRegistry(registry),
  );
  assert.equal(synchronizeAnalysisRegistry({ projectRoot, mode: 'check' }).changed, false);

  fs.writeFileSync(path.join(projectRoot, 'scripts/analyze-beta.mjs'), 'export const beta = true;\n');
  assert.throws(
    () => synchronizeAnalysisRegistry({ projectRoot, mode: 'check' }),
    (error) =>
      error instanceof AnalysisRegistryError &&
      error.details.includes('on disk but unregistered: scripts/analyze-beta.mjs'),
  );
});
