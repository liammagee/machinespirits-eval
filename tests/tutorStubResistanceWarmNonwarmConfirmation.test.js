import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildTutorStubResistanceMeasurementZeroCallFixtureV8 } from '../services/tutorStubResistanceRecoverySemanticAdjudicationV8.js';
import {
  adjudicateTutorStubResistanceFidelityPanelV9,
  adjudicateTutorStubResistanceRecoveryPrimaryPanelV9,
  validateTutorStubResistanceRecoverySemanticRegistrationV9,
} from '../services/tutorStubResistanceRecoverySemanticAdjudicationV9.js';
import {
  buildTutorStubResistanceWarmNonwarmPlan,
  configureTutorStubResistanceWarmNonwarmFromCli,
  loadTutorStubResistanceWarmNonwarmDesign,
} from '../services/tutorStubResistanceWarmNonwarmConfirmation.js';
import { loadTutorStubResistanceConfirmationSemanticInstrument } from '../services/tutorStubResistanceConfirmationSemanticRuntime.js';
import { analyzeTutorStubResistanceWarmNonwarmRows } from '../scripts/run-tutor-stub-resistance-warm-nonwarm-confirmation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESIGN = 'config/tutor-stub-resistance-action-register-warm-nonwarm-confirmation.v1.json';
const CORPUS = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'config/tutor-stub-resistance-recovery-semantic-heldout-corpus.v2.json'), 'utf8'),
);

function adaptCase(row) {
  return {
    ...row,
    expected: {
      primary: {
        bounded_test_merits_engagement: row.expected.judgment.bounded_test_merits_engagement,
        grounded_precise_jurisdictional_condition: row.expected.judgment.grounded_precise_jurisdictional_condition,
        final_recovery: row.expected.judgment.final_recovery,
      },
      primary_evidence: row.expected.evidence.filter((quote) =>
        ['bounded_test_merits_engagement', 'grounded_precise_jurisdictional_condition'].includes(quote.field),
      ),
      fidelity: {
        delivered_clarify_distinction: row.expected.judgment.delivered_clarify_distinction,
        delivered_register: row.expected.judgment.delivered_register,
      },
      fidelity_evidence: row.expected.evidence.filter((quote) =>
        ['delivered_clarify_distinction', 'delivered_register'].includes(quote.field),
      ),
    },
  };
}

function panelFixture(corpusCase, registration, instrument) {
  const entries = registration.measurement.judges.map((judge) => [
    judge.id,
    buildTutorStubResistanceMeasurementZeroCallFixtureV8({ corpusCase, judge, instrument }),
  ]);
  return {
    prompts: Object.fromEntries(entries.map(([id, entry]) => [id, entry.prompt])),
    responses: entries.map(([, entry]) => entry.response),
  };
}

test('warm/nonwarm design freezes 200 unique balanced dialogues with no GPT-5.5 route', () => {
  const loaded = loadTutorStubResistanceWarmNonwarmDesign({ designPath: DESIGN, root: ROOT });
  const plan = buildTutorStubResistanceWarmNonwarmPlan(loaded.design);
  assert.equal(plan.jobs.length, 200);
  assert.equal(new Set(plan.jobs.map((job) => job.id)).size, 200);
  assert.equal(new Set(plan.jobs.map((job) => job.run_seed)).size, 200);
  assert.equal(plan.jobs.filter((job) => job.assigned_arm === 'warm_shared_invitation').length, 100);
  assert.equal(plan.jobs.filter((job) => job.assigned_arm === 'nonwarm_reference').length, 100);
  for (let block = 1; block <= 50; block += 1) {
    const id = `block_${String(block).padStart(2, '0')}`;
    const rows = plan.jobs.filter((job) => job.block_id === id);
    assert.equal(rows.filter((job) => job.assigned_arm === 'warm_shared_invitation').length, 2);
    assert.equal(rows.filter((job) => job.assigned_arm === 'nonwarm_reference').length, 2);
  }
  assert.equal(JSON.stringify(loaded.design.models).includes('gpt-5.5'), true);
  assert.equal(
    loaded.design.models.semanticJudges.some((judge) => judge.modelRef === 'codex.gpt-5.5'),
    false,
  );
});

test('V9 recovery panel requires exact Sol-Sonnet agreement and projects plain or neither to nonwarm', () => {
  const registration = JSON.parse(
    fs.readFileSync(
      path.join(ROOT, 'config/tutor-stub-resistance-recovery-semantic-adjudication-registration.v9.json'),
      'utf8',
    ),
  );
  const validation = validateTutorStubResistanceRecoverySemanticRegistrationV9(registration);
  assert.equal(validation.valid, true, validation.issues.join('; '));
  const source = CORPUS.cases.find(
    (row) => row.expected.judgment.final_recovery === 'yes' && row.expected.judgment.delivered_register === 'plain',
  );
  assert.ok(source);
  const corpusCase = adaptCase(source);
  const primaryFixture = panelFixture(corpusCase, registration, 'primary_recovery');
  const primary = adjudicateTutorStubResistanceRecoveryPrimaryPanelV9({
    caseId: corpusCase.case_id,
    publicPacket: Object.fromEntries(
      ['trigger', 'intervention', 'prior_post_trigger', 'intervening_tutor', 'current_learner'].map((field) => [
        field,
        corpusCase[field],
      ]),
    ),
    responses: primaryFixture.responses,
    registration,
    prompts: primaryFixture.prompts,
  });
  assert.equal(primary.status, 'determinate');
  assert.equal(primary.final_recovery, 'yes');
  primaryFixture.responses[1].judgment.bounded_test_merits_engagement.value = 'no';
  primaryFixture.responses[1].judgment.bounded_test_merits_engagement.evidence_quotes = [];
  const disagreement = adjudicateTutorStubResistanceRecoveryPrimaryPanelV9({
    caseId: corpusCase.case_id,
    publicPacket: Object.fromEntries(
      ['trigger', 'intervention', 'prior_post_trigger', 'intervening_tutor', 'current_learner'].map((field) => [
        field,
        corpusCase[field],
      ]),
    ),
    responses: primaryFixture.responses,
    registration,
    prompts: primaryFixture.prompts,
  });
  assert.equal(disagreement.status, 'measurement_indeterminate');
  assert.equal(disagreement.repair_rerun_replacement_or_selection_allowed, false);

  const fidelityFixture = panelFixture(corpusCase, registration, 'intervention_fidelity');
  fidelityFixture.responses[1].judgment.delivered_register.value = 'neither';
  fidelityFixture.responses[1].judgment.delivered_register.evidence_quotes = [];
  const fidelity = adjudicateTutorStubResistanceFidelityPanelV9({
    caseId: corpusCase.case_id,
    intervention: corpusCase.intervention,
    responses: fidelityFixture.responses,
    registration,
    prompts: fidelityFixture.prompts,
  });
  assert.equal(fidelity.register_measurement.status, 'determinate');
  assert.equal(fidelity.register_measurement.value, 'nonwarm');
});

test('CLI configuration binds the V6 trigger and V9 outcome panel without generating a dialogue', () => {
  const loaded = loadTutorStubResistanceWarmNonwarmDesign({ designPath: DESIGN, root: ROOT });
  const job = buildTutorStubResistanceWarmNonwarmPlan(loaded.design).jobs[0];
  const state = { turns: [], history: [], trace: [] };
  configureTutorStubResistanceWarmNonwarmFromCli({
    args: {
      'resistance-warm-nonwarm-confirmation-design': DESIGN,
      'resistance-warm-nonwarm-confirmation-job': job.id,
      'model-call-budget': '102',
      model: 'codex.gpt-5.6-luna',
      'classifier-model': 'codex.gpt-5.6-luna',
      'learner-record-model': 'codex.gpt-5.6-luna',
      'auto-learner-model': 'codex.gpt-5.6-luna',
      'cli-effort': 'low',
      'run-seed': String(job.run_seed),
      'eval-repeat': String(job.assignment_index),
      'eval-job-id': job.id,
      'acknowledge-research-use': true,
    },
    state,
    root: ROOT,
    autoLearnerEnabled: true,
    autoTurns: 4,
    appendTraceEvent(trace, event) {
      trace.push(event);
    },
    observationSemantics: loaded.design.measurement.triggerInstrument.observationSemantics,
  });
  assert.equal(state.resistanceActionRegisterStudy.registration.version, 11);
  assert.equal(
    state.resistanceActionRegisterStudy.registration.design.trigger.observationSemantics,
    'prospective_frame_resistance_binary_semantic_v6',
  );
  assert.equal(state.resistanceActionRegisterStudy.assigned_arm, job.assigned_arm);
  const instrument = loadTutorStubResistanceConfirmationSemanticInstrument(
    state.resistanceActionRegisterStudy.registration,
  );
  assert.equal(instrument.registration.version, 9);
  assert.equal(instrument.registration.measurement.judges.length, 2);
  assert.equal(state.trace.length, 1);
});

test('final analysis uses determinate denominators and the single predeclared Fisher test', () => {
  const loaded = loadTutorStubResistanceWarmNonwarmDesign({ designPath: DESIGN, root: ROOT });
  const rows = [];
  for (const [assignedArm, recovered] of [
    ['warm_shared_invitation', 30],
    ['nonwarm_reference', 10],
  ]) {
    for (let index = 0; index < 100; index += 1) {
      rows.push({
        case_id: `${assignedArm}-${index}`,
        assigned_arm: assignedArm,
        execution_terminal: true,
        primary_status: 'determinate',
        final_recovery: index < recovered ? 'yes' : 'no',
        action_status: 'determinate',
        action_value: 'yes',
        register_status: 'determinate',
        register_value: assignedArm === 'warm_shared_invitation' ? 'warm' : 'nonwarm',
      });
    }
  }
  const report = analyzeTutorStubResistanceWarmNonwarmRows({ rows, design: loaded.design });
  assert.equal(report.analysis_count, 1);
  assert.equal(report.interim_analysis_performed, false);
  assert.equal(report.confirmatory_claim_allowed, true);
  assert.ok(Math.abs(report.contrast.risk_difference_warm_minus_nonwarm - 0.2) < 1e-12);
  assert.ok(report.contrast.fisher_exact_two_sided_p < 0.05);
});
