import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  buildTutorStubResistanceMeasurementZeroCallFixtureV5,
  scoreTutorStubResistanceMeasurementCorpusV5,
} from '../services/tutorStubResistanceRecoverySemanticAdjudicationV5.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const corpus = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'config/tutor-stub-resistance-recovery-semantic-heldout-corpus.v5.json'), 'utf8'),
);
const consumed = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'config/tutor-stub-resistance-recovery-semantic-heldout-corpus.v2.json'), 'utf8'),
);
const registration = JSON.parse(
  fs.readFileSync(
    path.join(ROOT, 'config/tutor-stub-resistance-recovery-semantic-adjudication-registration.v5.json'),
    'utf8',
  ),
);

test('fresh V5 heldout has the frozen independent strata and no exact consumed text reuse', () => {
  assert.equal(corpus.role, 'genuinely_fresh_heldout_blinded');
  assert.equal(corpus.authored_after_instrument_freeze_commit, registration.instrument.freezeCommit);
  assert.equal(corpus.judge_models_authored_gold_or_cases, false);
  assert.equal(corpus.cases.length, 120);
  assert.equal(new Set(corpus.cases.map((row) => row.case_id)).size, 120);
  const recovery = Object.fromEntries(
    ['merits_only', 'grounded_only', 'both', 'no_recovery'].map((label) => [
      label,
      corpus.cases.filter((row) => row.strata.recovery === label).length,
    ]),
  );
  assert.deepEqual(recovery, { merits_only: 32, grounded_only: 32, both: 16, no_recovery: 40 });
  const registers = Object.fromEntries(
    ['warm', 'plain', 'neither'].map((label) => [
      label,
      corpus.cases.filter((row) => row.strata.register === label).length,
    ]),
  );
  assert.deepEqual(registers, { warm: 40, plain: 40, neither: 40 });
  assert.equal(corpus.cases.filter((row) => row.strata.action_present).length, 80);
  assert.equal(corpus.cases.filter((row) => row.strata.intervening_tutor_dependent).length, 24);
  const fieldNames = ['trigger', 'intervention', 'prior_post_trigger', 'intervening_tutor', 'current_learner'];
  const consumedTexts = new Set(
    consumed.cases.flatMap((row) => [
      ...fieldNames.map((field) => row[field]),
      ...row.expected.evidence.map((entry) => entry.text),
    ]),
  );
  for (const row of corpus.cases) {
    for (const field of fieldNames) assert.equal(consumedTexts.has(row[field]), false, `${row.case_id}:${field}`);
    for (const quote of [...row.expected.primary_evidence, ...row.expected.fidelity_evidence]) {
      assert.equal(consumedTexts.has(quote.text), false, `${row.case_id}:${quote.field}`);
      assert.equal(row[quote.source_id].indexOf(quote.text), row[quote.source_id].lastIndexOf(quote.text));
      assert.notEqual(row[quote.source_id].indexOf(quote.text), -1);
    }
  }
});

test('V5 execution prompts contain neither gold nor the other instrument packet', () => {
  for (const corpusCase of corpus.cases) {
    for (const judge of registration.measurement.judges) {
      const primary = buildTutorStubResistanceMeasurementZeroCallFixtureV5({
        corpusCase,
        judge,
        instrument: 'primary_recovery',
      });
      const fidelity = buildTutorStubResistanceMeasurementZeroCallFixtureV5({
        corpusCase,
        judge,
        instrument: 'intervention_fidelity',
      });
      const primaryText = JSON.stringify(primary.prompt);
      const fidelityText = JSON.stringify(fidelity.prompt);
      assert.equal(primaryText.includes('expected'), false);
      assert.equal(primaryText.includes('strata'), false);
      assert.equal(primaryText.includes('delivered_register'), false);
      assert.deepEqual(Object.keys(fidelity.prompt.public_packet), ['intervention']);
      assert.equal(fidelityText.includes(corpusCase.current_learner), false);
      assert.equal(fidelityText.includes('final_recovery'), false);
    }
  }
});

test('V5 frozen instruments traverse all fresh cases as a zero-call engineering preflight', () => {
  const responsePairs = Object.fromEntries(
    corpus.cases.map((corpusCase) => [
      corpusCase.case_id,
      {
        primary: Object.fromEntries(
          registration.measurement.judges.map((judge) => [
            judge.id,
            buildTutorStubResistanceMeasurementZeroCallFixtureV5({
              corpusCase,
              judge,
              instrument: 'primary_recovery',
            }),
          ]),
        ),
        fidelity: Object.fromEntries(
          registration.measurement.judges.map((judge) => [
            judge.id,
            buildTutorStubResistanceMeasurementZeroCallFixtureV5({
              corpusCase,
              judge,
              instrument: 'intervention_fidelity',
            }),
          ]),
        ),
      },
    ]),
  );
  const score = scoreTutorStubResistanceMeasurementCorpusV5({ corpus, responsePairs, registration });
  assert.equal(score.status, 'passed');
  assert.equal(score.primary.metrics.panel_exact_accuracy, 1);
  assert.equal(score.fidelity.metrics.panel_action_accuracy, 1);
  assert.equal(score.fidelity.metrics.panel_register_accuracy, 1);
  assert.equal(score.prohibited_tool_events, 0);
});
