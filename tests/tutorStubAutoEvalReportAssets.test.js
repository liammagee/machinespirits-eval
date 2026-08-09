import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import { machineSpiritsReportCss, tutorStubIndexClientJs } from '../services/tutorStubAutoEvalReportAssets.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

test('auto-eval report CSS preserves its emitted byte contract', () => {
  const css = machineSpiritsReportCss();

  assert.equal(Buffer.byteLength(css), 84_221);
  assert.equal(sha256(css), 'c29c27a714e8164a0262f858229346f433ea7962d8dd8f2b5decd7afa5e6b5bd');
  assert.equal(machineSpiritsReportCss(), css);
});

test('auto-eval index client preserves its emitted byte and syntax contract', () => {
  const client = `${tutorStubIndexClientJs()}\n`;

  assert.equal(Buffer.byteLength(client), 82_509);
  assert.equal(sha256(client), 'bf91f143a6db56f87eed215b3741c887bb0ab7b2e2cfb2e8a659d463f5499661');
  assert.doesNotThrow(() => new vm.Script(client));
  assert.equal(`${tutorStubIndexClientJs()}\n`, client);
});

test('auto-eval report asset owner remains dependency-free and presentation-only', () => {
  const source = fs.readFileSync(path.join(ROOT, 'services', 'tutorStubAutoEvalReportAssets.js'), 'utf8');

  assert.doesNotMatch(source, /^import\s/mu);
  assert.doesNotMatch(source, /\b(?:fs|path|process|fetch|console)\s*\./u);
  assert.match(source, /^export function machineSpiritsReportCss\(\)/mu);
  assert.match(source, /^export function tutorStubIndexClientJs\(\)/mu);
});
