import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENTRYPOINTS = [
  'scripts/advanced-eval-analysis.js',
  'scripts/bench-judge-parallelism.js',
  'scripts/qualitative-analysis.js',
  'scripts/test-readiness-dimension.js',
];

test('async analysis entrypoints turn rejected main promises into a failing process status', () => {
  for (const relativePath of ENTRYPOINTS) {
    const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    assert.doesNotMatch(source, /main\(\)\.catch\(console\.error\)/u, relativePath);
    assert.match(
      source,
      /main\(\)\.catch\(\(error\) => \{[\s\S]*?console\.error\(error\);[\s\S]*?process\.exitCode = 1;[\s\S]*?\}\);/u,
      relativePath,
    );
  }
});
