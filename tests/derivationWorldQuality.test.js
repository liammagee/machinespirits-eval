import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { auditWorldDirectory, auditWorldQuality } from '../services/dramaticDerivation/worldQuality.js';
import { loadWorld } from '../services/dramaticDerivation/world.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORLD_DIR = path.join(ROOT, 'config', 'drama-derivation');

test('the full derivation-world catalog passes the authoring-quality gate', () => {
  const report = auditWorldDirectory(WORLD_DIR);
  const worldFileCount = readdirSync(WORLD_DIR).filter((file) => /^world-.*\.yaml$/u.test(file)).length;
  assert.equal(report.reports.length, worldFileCount);
  assert.equal(report.ok, true, report.errors.map((issue) => `${issue.source}: ${issue.message}`).join('\n'));
});

test('the quality gate catches missing public rule language', () => {
  const world = loadWorld(path.join(WORLD_DIR, 'world-000-smoke.yaml'));
  const mutated = { ...world, rules: world.rules.map((rule, index) => (index === 0 ? { ...rule, gloss: '' } : rule)) };
  const report = auditWorldQuality(mutated);
  assert.ok(report.errors.some((issue) => issue.code === 'missing_rule_gloss'));
});

test('period worlds must author their presentation instead of inheriting a language fallback', () => {
  const world = loadWorld(path.join(WORLD_DIR, 'world-000-smoke.yaml'));
  const mutated = {
    ...world,
    presentation: { ...world.presentation, narrative_diction: '', ledger_term: '', summary: '' },
  };
  const report = auditWorldQuality(mutated);
  const messages = report.errors.filter((issue) => issue.code === 'missing_presentation').map((issue) => issue.message);
  assert.deepEqual(messages, [
    'world needs explicit presentation.narrative_diction',
    'world needs explicit presentation.ledger_term',
    'world needs explicit presentation.summary',
  ]);
});

test('the normal tutor-stub roster excludes non-production worlds', () => {
  const output = execFileSync(process.execPath, ['scripts/tutor-stub.js', '--list-worlds'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.match(output, /world_016_ai_syllabus_af1/u);
  assert.doesNotMatch(output, /world_000_smoke/u);
  assert.doesNotMatch(output, /world_017_saintcloud/u);
  assert.doesNotMatch(output, /world_018_edmund/u);
});
