import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  checkStaticImportCycles,
  extractStaticRelativeSpecifiers,
  findStronglyConnectedComponents,
} from '../scripts/check-static-import-cycles.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('static import extraction covers multiline, side-effect, and re-export declarations only', () => {
  const source = `
    import {
      first,
      second,
    } from './first.js';
    import './side-effect.js';
    export { third } from './third.js';
    export function ordinaryExport() { return "from './not-an-import.js'"; }
    const deferred = import('./dynamic.js');
    // import './commented.js';
  `;

  assert.deepEqual(extractStaticRelativeSpecifiers(source), ['./first.js', './side-effect.js', './third.js']);
});

test('strongly connected components distinguish cycles from acyclic edges', () => {
  const graph = new Map([
    ['a', ['b']],
    ['b', ['a', 'c']],
    ['c', []],
    ['d', ['d']],
  ]);

  assert.deepEqual(findStronglyConnectedComponents(graph), [['a', 'b'], ['d']]);
});

test('repository static imports match the ratcheted zero-cycle baseline', () => {
  const result = checkStaticImportCycles({ repoRoot });

  assert.equal(result.ok, true);
  assert.deepEqual(result.actualCycles, []);
});
