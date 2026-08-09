import assert from 'node:assert/strict';
import test from 'node:test';
import { readTutorStubApplicationSource } from './helpers/tutorStubSourceContract.js';

import { normalizeTutorStubDagMode } from '../services/tutorStubDagFeatures.js';

const MODES = ['strict_dag', 'human_scaffold', 'defeasible_human_scaffold'];

test('DAG mode normalization preserves defaults, case folding, and hyphen aliases', () => {
  assert.equal(normalizeTutorStubDagMode(undefined, { modes: MODES }), 'strict_dag');
  assert.equal(normalizeTutorStubDagMode(' HUMAN-SCAFFOLD ', { modes: MODES }), 'human_scaffold');
  assert.equal(normalizeTutorStubDagMode('defeasible-human-scaffold', { modes: MODES }), 'defeasible_human_scaffold');
});

test('unknown DAG modes retain the exact actionable error', () => {
  assert.throws(
    () => normalizeTutorStubDagMode('loose', { modes: MODES }),
    /Unknown --dag-mode: loose\. Expected strict_dag, human_scaffold, defeasible_human_scaffold\./u,
  );
});

test('the CLI imports rather than redeclares DAG-mode normalization', () => {
  const source = readTutorStubApplicationSource();
  assert.match(source, /normalizeTutorStubDagMode/u);
  assert.doesNotMatch(source, /function normalizeDagMode\(/u);
});
