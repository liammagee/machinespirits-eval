/**
 * Guards for the mood-floor replication report.
 *
 * The report's whole weight rests on one claim: that two runs one day apart
 * asked for the same thing, so a difference between them is sampling and not a
 * configuration change. That claim is checked against the database rather than
 * written in prose — and a check that has only ever been seen to pass is a
 * check nobody has tested. These tests make it fail.
 *
 * They also pin the gate. Reading this contrast on `sarcastic_determinate`
 * would score cell 202's control on cell 202's own treatment, which is the
 * error the whole sub-line was corrected for twice (paper v3.0.270, v3.0.272).
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

import { compareProvenance } from '../scripts/analyze-sarcasm-mood-floor-replication.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SCENARIOS = [
  'charisma_desire_resistance_breakthrough_boredom',
  'charisma_desire_resistance_breakthrough_frustration',
];

const BASE_ROW = {
  profile_name: 'cell_202_id_director_sarcastic_determinate_challenge_breakthrough_dynamic_verified',
  config_hash: 'e7688e9d788a6bb9',
  prompt_content_hash: '2e54a2d4ea3e3729',
  ego_model: 'codex.gpt-5.5',
  superego_model: 'codex.gpt-5.5',
  judge_model: 'claude-code/claude-sonnet-5',
};

/** A throwaway database holding only the columns the provenance check reads. */
function withFixtureDb(rowsByRun, assertions) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mood-floor-test-'));
  const dbPath = path.join(dir, 'evaluations.db');
  const db = new Database(dbPath);
  try {
    db.exec(`CREATE TABLE evaluation_results (
      run_id TEXT, profile_name TEXT, scenario_id TEXT, config_hash TEXT,
      prompt_content_hash TEXT, ego_model TEXT, superego_model TEXT, judge_model TEXT
    )`);
    const insert = db.prepare(
      `INSERT INTO evaluation_results
       (run_id, profile_name, scenario_id, config_hash, prompt_content_hash, ego_model, superego_model, judge_model)
       VALUES (@run_id, @profile_name, @scenario_id, @config_hash, @prompt_content_hash, @ego_model, @superego_model, @judge_model)`,
    );
    for (const [runId, overrides] of Object.entries(rowsByRun)) {
      for (const scenarioId of SCENARIOS) {
        insert.run({ ...BASE_ROW, ...overrides, run_id: runId, scenario_id: scenarioId });
      }
    }
    db.close();
    assertions(dbPath);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('matched runs report every provenance field as matched and nothing as a mismatch', () => {
  withFixtureDb({ 'run-a': {}, 'run-b': {} }, (dbPath) => {
    const result = compareProvenance({ dbPath, runs: ['run-a', 'run-b'], scenarios: SCENARIOS });
    assert.deepEqual(result.mismatches, []);
    assert.equal(result.matched.length, 6, 'all six provenance fields should be reported as matched');
    assert.ok(
      result.matched.some((entry) => entry.startsWith('config_hash ')),
      'the matched list must name config_hash, since that is what makes the runs comparable',
    );
  });
});

test('a changed prompt turns the comparison into a configuration change, not a replication', () => {
  withFixtureDb({ 'run-a': {}, 'run-b': { prompt_content_hash: 'ffffffffffffffff' } }, (dbPath) => {
    const result = compareProvenance({ dbPath, runs: ['run-a', 'run-b'], scenarios: SCENARIOS });
    assert.equal(result.mismatches.length, 1);
    assert.match(result.mismatches[0], /^prompt_content_hash: /);
    assert.ok(!result.matched.some((entry) => entry.startsWith('prompt_content_hash ')));
  });
});

test('a swapped generation seat is caught even when every hash agrees', () => {
  withFixtureDb({ 'run-a': {}, 'run-b': { ego_model: 'openrouter.nemotron' } }, (dbPath) => {
    const result = compareProvenance({ dbPath, runs: ['run-a', 'run-b'], scenarios: SCENARIOS });
    assert.deepEqual(
      result.mismatches.map((entry) => entry.split(':')[0]),
      ['ego_model'],
    );
  });
});

test('a run with no matching rows mismatches rather than silently agreeing', () => {
  withFixtureDb({ 'run-a': {} }, (dbPath) => {
    const result = compareProvenance({ dbPath, runs: ['run-a', 'run-missing'], scenarios: SCENARIOS });
    assert.ok(result.mismatches.length > 0, 'an absent run must not read as matched');
    for (const mismatch of result.mismatches) assert.match(mismatch, /run-missing=\(none\)/);
  });
});

test('the report reads the plain gate, never the treatment-specific one', () => {
  const source = fs.readFileSync(path.join(ROOT, 'scripts/analyze-sarcasm-mood-floor-replication.js'), 'utf8');
  assert.match(source, /^const GATE = 'sarcastic';$/m, 'the primary gate must be the plain sarcastic gate');
  // `sarcastic_determinate` may still be scored for description, but nothing
  // may reassign GATE to it — that would grade the control on cell 202's own
  // treatment, the error corrected at paper v3.0.270.
  assert.ok(
    !/GATE\s*=\s*'sarcastic_determinate'/.test(source),
    'the determinate gate must never become the gate this contrast is read on',
  );
});
