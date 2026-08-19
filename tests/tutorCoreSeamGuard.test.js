// GUARD: tutor-core must stay re-extractable. Every relative import inside
// tutor-core/** must resolve to a path that is still inside tutor-core/, and
// no import may use an eval-repo specifier.
// Rationale + standalone proof: TUTOR-CORE-SEAM-CHECK.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CORE_ROOT = path.join(REPO_ROOT, 'tutor-core');

function walkJsFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkJsFiles(full));
    else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) out.push(full);
  }
  return out;
}

// Static and dynamic import specifiers plus require calls.
const SPECIFIER_RE =
  /(?:import\s+(?:[\s\S]*?from\s+)?|import\(\s*|require\(\s*|export\s+(?:\*|\{[\s\S]*?\})\s+from\s+)['"]([^'"]+)['"]/g;

test('tutor-core imports never escape tutor-core/', () => {
  const files = walkJsFiles(CORE_ROOT);
  assert.ok(files.length > 20, `expected a real tutor-core tree, found ${files.length} js files`);

  const violations = [];
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(SPECIFIER_RE)) {
      const spec = match[1];
      if (!spec.startsWith('.')) continue; // bare package or node built-in
      const resolved = path.resolve(path.dirname(file), spec);
      const rel = path.relative(CORE_ROOT, resolved);
      if (rel.startsWith('..')) {
        violations.push(`${path.relative(REPO_ROOT, file)} -> ${spec}`);
      }
    }
  }
  assert.deepEqual(violations, [], `relative imports escaping tutor-core/:\n${violations.join('\n')}`);
});

test('tutor-core never names eval-repo modules', () => {
  const files = walkJsFiles(CORE_ROOT);
  const forbidden = [];
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(SPECIFIER_RE)) {
      const spec = match[1];
      if (
        /(^|\/)(scripts|routes)\//.test(spec) ||
        spec.includes('evalProfileRegistry') ||
        spec.includes('localPromptLoader') ||
        spec.includes('adaptiveTutor')
      ) {
        forbidden.push(`${path.relative(REPO_ROOT, file)} -> ${spec}`);
      }
    }
  }
  assert.deepEqual(forbidden, [], `eval-repo specifiers inside tutor-core/:\n${forbidden.join('\n')}`);
});
