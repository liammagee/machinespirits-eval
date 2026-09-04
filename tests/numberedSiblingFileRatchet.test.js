// structural-ratchet: numbered sibling files
//
// Counts files whose name carries a version number (`foo.v7.json`, `FooV8.js`,
// `foo-v3.js`, `FooV5Runtime.js`) directly under each listed directory and
// fails when a count rises above its cap. CLAUDE.md, "Edit in place; no
// numbered copies" (2026-09-03): amend a design, judge prompt, adjudicator or
// corpus file in place and commit; a new study gets a new name. Raising a cap
// in the same commit, with the reason in the commit message, is the only
// escape. Lowering a cap after a cleanup is welcome.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { findStructuralRatchetTests, isStructuralRatchetSource } from '../scripts/run-structural-ratchets.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// A version token: `.v7`, `-v7`, `_v7` in kebab or dotted names, or `V7`
// after a lower-case letter in camel-case names. The token may sit at the end
// (`foo.v7.json`, `FooV7.js`) or in the middle (`foo-v7-report.js`,
// `FooV7Runtime.js`). Directories are not counted, so `config/rubrics/v2.2/`
// stays outside the rule.
export const NUMBERED_SIBLING_PATTERN = /[.\-_]v\d+(?:[.\-_]|$)|[a-z]V\d+(?:[A-Z.\-_]|$)/u;

// Baseline counted on 2026-09-03 at the commit that added this file.
export const NUMBERED_SIBLING_CAPS = {
  config: 195,
  services: 33,
  scripts: 32,
  prompts: 1,
  tests: 60,
};

export function listNumberedSiblingFiles(directory, root = ROOT) {
  const absolute = path.join(root, directory);
  return fs
    .readdirSync(absolute, { withFileTypes: true })
    .filter((entry) => entry.isFile() && NUMBERED_SIBLING_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

test('the version-token pattern matches copies and leaves plain names alone', () => {
  for (const name of [
    'foo.v7.json',
    'foo-v3.js',
    'foo_v12.yaml',
    'FooV8.js',
    'FooV5Runtime.js',
    'foo-v2-report.js',
    'foo.v3-successor-2.json',
    'foo-v1.mjs',
  ]) {
    assert.equal(NUMBERED_SIBLING_PATTERN.test(name), true, name);
  }
  for (const name of [
    'foo.json',
    'fooRuntime.js',
    'evaluationStore.js',
    'analyze-voi-curve.js',
    'v8-engine-notes.md',
    'uuidv4.js',
    'sha256Verify.js',
    'level2Vote.js',
  ]) {
    assert.equal(NUMBERED_SIBLING_PATTERN.test(name), false, name);
  }
});

for (const [directory, cap] of Object.entries(NUMBERED_SIBLING_CAPS)) {
  test(`${directory}/ holds no more than ${cap} numbered sibling files`, () => {
    const files = listNumberedSiblingFiles(directory);
    assert.ok(
      files.length <= cap,
      [
        `${directory}/ has ${files.length} numbered sibling files; the cap is ${cap}.`,
        'Amend the existing file in place instead of adding a numbered copy (CLAUDE.md, 2026-09-03).',
        'If a new study truly needs a new file, give it a new name.',
        `To raise the cap on purpose, edit NUMBERED_SIBLING_CAPS in ${path.relative(ROOT, fileURLToPath(import.meta.url))}`,
        'in the same commit and say why in the commit message.',
      ].join('\n'),
    );
  });
}

test('the pre-push ratchet runner picks this file up by its marker line', () => {
  const self = path.relative(ROOT, fileURLToPath(import.meta.url));
  assert.ok(findStructuralRatchetTests().includes(self), `${self} is not in the structural ratchet lane`);
  assert.equal(isStructuralRatchetSource('// structural-ratchet: anything\n'), true);
  assert.equal(isStructuralRatchetSource("assert.ok(source.split('\\n').length < 900);"), true);
  assert.equal(isStructuralRatchetSource('// plain test\n'), false);
});
