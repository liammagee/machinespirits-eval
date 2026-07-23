import assert from 'node:assert/strict';
import test from 'node:test';

import Database from 'better-sqlite3';

import {
  computeEvalSignature,
  findAccumulationGaps,
  getAggregatedGroups,
  getAggregatedStats,
} from '../services/evalSignature.js';

function fixtureDatabase() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE evaluation_results (
      id INTEGER PRIMARY KEY,
      run_id TEXT,
      config_hash TEXT,
      scenario_id TEXT,
      scenario_name TEXT,
      profile_name TEXT,
      tutor_rubric_version TEXT,
      tutor_first_turn_score REAL,
      tutor_overall_score REAL,
      tutor_scores TEXT,
      learner_scores TEXT,
      tutor_development_score REAL,
      tutor_last_turn_score REAL,
      dialogue_id TEXT,
      dialogue_rounds INTEGER,
      factor_recognition INTEGER,
      factor_multi_agent_tutor INTEGER,
      factor_multi_agent_learner INTEGER,
      learner_architecture TEXT,
      model TEXT,
      ego_model TEXT,
      superego_model TEXT,
      judge_model TEXT,
      created_at TEXT,
      success INTEGER
    )
  `);
  const insert = db.prepare(`
    INSERT INTO evaluation_results (
      run_id, config_hash, scenario_id, scenario_name, profile_name,
      tutor_rubric_version, tutor_first_turn_score, tutor_overall_score,
      factor_recognition, factor_multi_agent_tutor, factor_multi_agent_learner,
      learner_architecture, model, judge_model, created_at, success
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insert.run(
    'run-a',
    'hash-a',
    's1',
    'Scenario 1',
    'cell_alpha',
    '2.2',
    6,
    6,
    1,
    0,
    0,
    'unified',
    'm',
    'j',
    '2026-01-01',
    1,
  );
  insert.run(
    'run-b',
    'hash-a',
    's1',
    'Scenario 1',
    'cell_alpha',
    '2.2',
    8,
    8,
    1,
    0,
    0,
    'unified',
    'm',
    'j',
    '2026-01-02',
    1,
  );
  insert.run(
    'run-c',
    'hash-b',
    's2',
    'Scenario 2',
    'cell_beta',
    '2.2',
    5,
    5,
    0,
    1,
    1,
    'ego_superego',
    'm',
    'j',
    '2026-01-03',
    1,
  );
  insert.run(
    'run-d',
    'hash-old',
    's3',
    'Pilot',
    'cell_pilot',
    '2.1',
    9,
    9,
    0,
    0,
    0,
    'unified',
    'm',
    'j',
    '2026-01-04',
    1,
  );
  insert.run(
    'run-e',
    'hash-failed',
    's4',
    'Failed',
    'cell_failed',
    '2.2',
    9,
    9,
    0,
    0,
    0,
    'unified',
    'm',
    'j',
    '2026-01-05',
    0,
  );
  return db;
}

test('eval signatures accept database and camel-case shapes with explicit fallbacks', () => {
  assert.equal(
    computeEvalSignature({ config_hash: 'hash', scenario_id: 'scene', tutor_rubric_version: '2.2' }),
    'hash::scene::2.2',
  );
  assert.equal(
    computeEvalSignature({ configHash: 'hash', scenarioId: 'scene', rubricVersion: '2.1' }),
    'hash::scene::2.1',
  );
  assert.equal(computeEvalSignature({}), 'no-hash::unknown::unknown');
});

test('aggregation respects epoch and profile/scenario filters', (t) => {
  const db = fixtureDatabase();
  t.after(() => db.close());

  const groups = getAggregatedGroups(db, '2.0');
  assert.equal(groups.size, 2);
  const repeated = groups.get('hash-a::s1::2.2');
  assert.equal(repeated.n, 2);
  assert.equal(repeated.nRuns, 2);
  assert.equal(repeated.mean, 7);
  assert.ok(Math.abs(repeated.sd - Math.sqrt(2)) < 1e-10);

  assert.equal(getAggregatedGroups(db, 'all', { profileName: 'pilot' }).size, 1);
  assert.equal(getAggregatedGroups(db, 'all', { scenarioId: 's2' }).size, 1);
});

test('summary statistics and accumulation gaps retain comparable group identity', (t) => {
  const db = fixtureDatabase();
  t.after(() => db.close());

  const stats = getAggregatedStats(db, '2.0');
  assert.equal(stats.totalRows, 3);
  assert.equal(stats.totalGroups, 2);
  assert.deepEqual(stats.byN, { 1: 1, 2: 1, '3+': 0 });
  assert.equal(stats.byProfile.cell_alpha.nSum, 2);
  assert.deepEqual(stats.validationIssues, []);

  const gaps = findAccumulationGaps(db, '2.0', 3);
  assert.deepEqual(
    gaps.map((gap) => [gap.profileName, gap.currentN, gap.needed]),
    [
      ['cell_beta', 1, 2],
      ['cell_alpha', 2, 1],
    ],
  );
});
