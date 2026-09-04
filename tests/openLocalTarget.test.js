import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { openLocalTarget } from '../scripts/lib/openLocalTarget.js';

const ROOT = path.join(import.meta.dirname, '..');

test('local preview targets are passed as one argv element without a shell', () => {
  const calls = [];
  const target = '/tmp/figure"; touch should-not-run; $.html';
  openLocalTarget(target, {
    execFile(command, args, options) {
      calls.push({ command, args, options });
    },
  });

  assert.deepEqual(calls, [{ command: 'open', args: [target], options: { stdio: 'ignore' } }]);
});

test('preview and capture helpers do not build shell command templates', () => {
  for (const file of [
    'scripts/render-sequence-diagram.js',
    'scripts/generate-paper-figures.js',
    'scripts/browse-poetics-scripts.js',
  ]) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.doesNotMatch(source, /exec(?:Sync)?\s*\(\s*`(?:open|npx)/u, file);
  }
});
