import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { deriveAdaptiveWarrantShadow } from '../scripts/derive-adaptive-warrant-shadow.js';

import {
  aggregateAdaptiveWarrantStudy,
  buildAdaptiveWarrantBaselineJobs,
  buildBlindedAnnotationCorpus,
  evaluateAdaptiveWarrantDecisionGate,
  isUnhedgedOwnVoiceClaim,
  resolveAdaptiveWarrantStudyStatus,
  scoreBlindedAnnotations,
  validateBlindedAnnotationResponse,
  STUDY_CONDITIONS,
  STUDY_PROFILES,
} from '../scripts/run-adaptive-warrant-baseline-study.js';

function resultRow({
  profile,
  condition,
  seed,
  growth = 0,
  breakTurn = null,
  firstWarrantTurn = null,
  firstRevisionTurn = null,
} = {}) {
  return {
    jobId: `${profile}-${condition}-${seed}`,
    profile,
    condition,
    seed,
    childStatus: 'ok',
    turnCount: 8,
    learnerAnalysisCallCount: 8,
    learnerAnalysisPromptFailureCount: 0,
    learnerAnalysisErrorCount: 0,
    learnerAnalysisCoverage: 1,
    learnerRecordGrowth: growth,
    firstUnhedgedOwnVoiceClaimTurn: breakTurn,
    deferenceBreakByHorizon: breakTurn !== null,
    firstWarrantTurn,
    firstRevisionTurn,
    revisionLagTurns:
      firstWarrantTurn === null || firstRevisionTurn === null ? null : firstRevisionTurn - firstWarrantTurn,
    warrantedButUnrevisedByHorizon: firstWarrantTurn !== null && firstRevisionTurn === null,
    liveWarrantCount: condition === 'baseline' ? 0 : 1,
    shadowWarrantCount: 1,
    overrideCount: condition === 'intervening' ? 1 : 0,
    gateOutcomeCoverage: condition === 'baseline' ? null : 1,
    liveShadowAgreement: condition === 'baseline' ? null : 1,
    fallbackCount: 0,
    leakFailureCount: 0,
    tracePath: `/tmp/${profile}-${condition}-${seed}.jsonl`,
    decisions: [
      {
        turn: 3,
        strategy_in_force: 'stage_next_step',
        actual_family: condition === 'intervening' ? 'challenge_resistance' : 'stage_next_step',
        revised: condition === 'intervening',
        gate: null,
        shadow: { revision_warranted: true },
      },
    ],
    publicTurns: [
      {
        turn: 1,
        learner: 'May I enter the first fact?',
        tutor: 'Look at the public assay.',
        dag_total: 4,
        grounded_count: 4,
        voiced_derived_count: 0,
        action_family: 'stage_next_step',
      },
      {
        turn: 2,
        learner: 'May I keep the same entry?',
        tutor: 'Make the entry in your own voice.',
        dag_total: 4,
        grounded_count: 4,
        voiced_derived_count: 0,
        action_family: 'stage_next_step',
      },
      {
        turn: 3,
        learner: 'The assay rules out clipping.',
        tutor: 'Yes. Test the next clue.',
        dag_total: 5,
        grounded_count: 5,
        voiced_derived_count: 0,
        action_family: condition === 'intervening' ? 'challenge_resistance' : 'stage_next_step',
      },
    ],
  };
}

test('study plan is a paired 3-condition x 3-profile matrix with frozen eight-turn commands', () => {
  const jobs = buildAdaptiveWarrantBaselineJobs({
    rootDir: '/tmp/warrant-study',
    runs: 5,
    masterSeed: 101,
    studyId: 'test-study',
    dryRun: true,
  });
  assert.equal(jobs.length, 45);
  for (const profile of STUDY_PROFILES) {
    for (const condition of STUDY_CONDITIONS) {
      const cell = jobs.filter((job) => job.profile === profile && job.condition === condition.id);
      assert.equal(cell.length, 5);
      assert.deepEqual(
        cell.map((job) => job.seed).sort((a, b) => a - b),
        [101, 102, 103, 104, 105],
      );
      for (const job of cell) {
        assert.ok(job.command.includes('--no-stop-on-grounded'));
        assert.equal(job.command[job.command.indexOf('--turns') + 1], '8');
        assert.equal(job.command[job.command.indexOf('--warrant-gate') + 1], condition.warrantGateMode);
        assert.equal(job.command[job.command.indexOf('--policies') + 1], 'dynamic');
        assert.equal(job.command[job.command.indexOf('--learner-analysis-prompt-profile') + 1], 'compact_v1');
        assert.ok(job.command.includes('--dry-run'));
      }
    }
  }
});

test('deference-break measure is public-text-only and distinguishes permission from own-voice claims', () => {
  assert.equal(isUnhedgedOwnVoiceClaim('May I enter that the assay rules out clipping?'), false);
  assert.equal(isUnhedgedOwnVoiceClaim('I think the assay rules out clipping.'), false);
  assert.equal(isUnhedgedOwnVoiceClaim('What does the assay show?'), false);
  assert.equal(isUnhedgedOwnVoiceClaim('The assay rules out clipping; these shillings were newly struck.'), true);
});

test('aggregator keeps manipulation checks separate and computes paired downstream contrasts', () => {
  const rows = [];
  for (const profile of STUDY_PROFILES) {
    rows.push(resultRow({ profile, condition: 'baseline', seed: 101, growth: 0, breakTurn: null }));
    rows.push(
      resultRow({
        profile,
        condition: 'instrumented',
        seed: 101,
        growth: 0,
        breakTurn: null,
        firstWarrantTurn: 3,
      }),
    );
    rows.push(
      resultRow({
        profile,
        condition: 'intervening',
        seed: 101,
        growth: 2,
        breakTurn: 5,
        firstWarrantTurn: 3,
        firstRevisionTurn: 3,
      }),
    );
  }
  const aggregates = aggregateAdaptiveWarrantStudy(rows, { horizon: 8 });
  assert.equal(aggregates.byCell.low_agency.intervening.meanLearnerRecordGrowth, 2);
  assert.equal(aggregates.byCell.low_agency.intervening.meanLearnerAnalysisCoverage, 1);
  assert.equal(aggregates.byCell.low_agency.intervening.meanRevisionLagTurns, 0);
  assert.equal(aggregates.byCell.low_agency.intervening.overrideSessions, 1);
  assert.equal(aggregates.byCell.low_agency.instrumented.meanRevisionLagTurns, null);
  assert.equal(aggregates.byCell.low_agency.instrumented.warrantedButUnrevised, 1);
  assert.equal(aggregates.byCell.low_agency.baseline.meanLiveShadowAgreement, null);
  assert.equal(aggregates.pairedContrasts.low_agency.activeMinusBaselineLearnerRecordGrowth, 2);
  assert.equal(aggregates.pairedContrasts.low_agency.activeMinusBaselineDeferenceBreakRate, 1);
  assert.equal(aggregates.pairedContrasts.low_agency.activeMinusBaselineDeferenceBreakTurn, -4);
  assert.equal(aggregates.pairedContrasts.low_agency.instrumentedMinusBaselineLearnerRecordGrowth, 0);
  assert.equal(aggregates.pairedContrasts.low_agency.instrumentedMinusBaselineDeferenceBreakRate, 0);
  assert.equal(aggregates.pairedContrasts.low_agency.instrumentedMinusBaselineDeferenceBreakTurn, 0);
});

test('study status fails closed when a completed row used learner-analysis fallback', () => {
  const jobs = [{ id: 'one' }];
  const valid = resultRow({ profile: 'low_agency', condition: 'baseline', seed: 101 });
  assert.equal(resolveAdaptiveWarrantStudyStatus([valid], jobs), 'complete');
  assert.equal(resolveAdaptiveWarrantStudyStatus([{ ...valid, learnerAnalysisCoverage: 0 }], jobs), 'invalid_analysis');
});

test('offline shadow aligns DAG growth with the next decision-time learner record', () => {
  const traceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'warrant-shadow-parity-'));
  const tracePath = path.join(traceDir, 'trace.jsonl');
  const events = [];
  for (const turn of [1, 2, 3]) {
    events.push({
      type: 'tutor_first_draft_contract',
      turn,
      contract: {
        development: { action_family: 'stage_next_step' },
        performance: { engagement_stance: 'precise', actorial_part: 'examiner', tactic: 'evidentiary_boundary' },
      },
    });
    events.push({ type: 'auto_learner_turn', turn, text: `Neutral learner turn ${turn}.` });
    events.push({
      type: 'turn_complete',
      turn,
      turnRecord: {
        stateObservation: {
          dag: { grounded_count: turn === 1 ? 0 : 1, voiced_derived_count: 0 },
        },
      },
    });
  }
  fs.writeFileSync(tracePath, `${events.map((event) => JSON.stringify(event)).join('\n')}\n`);
  try {
    const decisions = deriveAdaptiveWarrantShadow(tracePath).sessions[0].decisions;
    assert.equal(decisions[0].turn, 2);
    assert.equal(decisions[0].trouble_turns.length, 0);
    assert.equal(decisions[1].turn, 3);
    assert.deepEqual(
      decisions[1].trouble_turns.map((row) => row.turn),
      [2],
    );
    assert.equal(decisions[1].revision_warranted, false);
  } finally {
    fs.rmSync(traceDir, { recursive: true, force: true });
  }
});

test('live and offline gates agree on repeated unresolved evidence-request defeat', async () => {
  const { createTutorStubWarrantGate } = await import('../services/tutorStubWarrantGate.js');
  const traceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'warrant-contract-parity-'));
  const tracePath = path.join(traceDir, 'trace.jsonl');
  const learnerTurns = [
    'What public mark on the coin or dies would establish the link?',
    'What public mark on the coin or dies would establish the link?',
    'No visible flaw is recorded; please record a distinctive cut or die-mark before comparison.',
  ];
  const classification = {
    request_type: 'stepwise_support_request',
    discourse_move: 'question',
    evidence_use: 'cites_public_evidence',
    epistemic_stance: 'reflective',
    agency: 'steering',
  };
  const events = [];
  const live = createTutorStubWarrantGate({ mode: 'observe' });
  const liveDecisions = [];
  for (const turn of [1, 2, 3]) {
    const learnerText = learnerTurns[turn - 1];
    const turnClassification = turn === 1 ? null : { turn: classification };
    liveDecisions.push(
      live.assess({
        turn,
        learnerText,
        classification: turnClassification,
        dagModel: { learnerRecord: { grounded: Array.from({ length: 5 }, (_, index) => `f${index}`) } },
        priorActionFamily: 'stage_next_step',
      }),
    );
    live.recordTurnOutcome({ turn, actionFamily: 'stage_next_step' });
    events.push({
      type: 'tutor_first_draft_contract',
      turn,
      contract: {
        development: { action_family: 'stage_next_step' },
        performance: { engagement_stance: 'precise', actorial_part: 'examiner', tactic: 'evidentiary_boundary' },
      },
    });
    events.push({ type: 'auto_learner_turn', turn, text: learnerText });
    events.push({
      type: 'turn_complete',
      turn,
      turnRecord: {
        classification: turnClassification,
        stateObservation: { dag: { grounded_count: 5, voiced_derived_count: 0 } },
      },
    });
  }
  fs.writeFileSync(tracePath, `${events.map((event) => JSON.stringify(event)).join('\n')}\n`);
  try {
    const offline = deriveAdaptiveWarrantShadow(tracePath).sessions[0].decisions;
    assert.equal(offline.length, 2);
    for (const [index, decision] of offline.entries()) {
      const liveDecision = liveDecisions[index + 1];
      assert.equal(decision.revision_warranted, liveDecision.revision_warranted);
      assert.equal(decision.warrant_basis, liveDecision.warrant_basis);
      assert.equal(decision.action_contract.status, liveDecision.action_contract.status);
      assert.equal(
        decision.action_contract.transition?.recommended_action_family || null,
        liveDecision.action_contract.transition?.recommended_action_family || null,
      );
    }
    assert.equal(offline[0].revision_warranted, true);
    assert.equal(offline[0].policy.family, 'answer_accountably');
    assert.equal(offline[1].revision_warranted, true);
    assert.equal(offline[1].policy.family, 'answer_accountably');
  } finally {
    fs.rmSync(traceDir, { recursive: true, force: true });
  }
});

test('annotation corpus hides condition and keeps the arm mapping in a separate key', () => {
  const rows = [
    resultRow({ profile: 'low_agency', condition: 'baseline', seed: 101 }),
    resultRow({ profile: 'low_agency', condition: 'instrumented', seed: 101 }),
    resultRow({ profile: 'low_agency', condition: 'intervening', seed: 101 }),
  ];
  const { corpus, key } = buildBlindedAnnotationCorpus(rows, { perCell: 1, studyId: 'test' });
  assert.equal(corpus.cases.length, 3);
  assert.equal(key.cases.length, 3);
  assert.equal('condition' in corpus.cases[0], false);
  assert.equal('profile' in corpus.cases[0], false);
  assert.ok(key.cases.every((row) => row.condition));
  assert.ok(corpus.cases.every((row) => row.revision_warranted === null));
});

test('annotation corpus offset freezes a disjoint validation decision per cell', () => {
  const rows = ['baseline', 'instrumented', 'intervening'].map((condition) => {
    const row = resultRow({ profile: 'low_agency', condition, seed: 101 });
    row.decisions.push({ ...row.decisions[0], turn: 4 });
    row.publicTurns.push({ ...row.publicTurns.at(-1), turn: 4 });
    return row;
  });
  const primary = buildBlindedAnnotationCorpus(rows, { perCell: 1, studyId: 'test' });
  const validation = buildBlindedAnnotationCorpus(rows, {
    perCell: 1,
    studyId: 'test-validation',
    samplingSeed: 'test',
    offsetPerCell: 1,
    sampleIdPrefix: 'validation-case',
  });
  const primarySources = new Set(primary.key.cases.map((row) => `${row.job_id}:${row.turn}`));
  const validationSources = validation.key.cases.map((row) => `${row.job_id}:${row.turn}`);
  assert.equal(validationSources.length, 3);
  assert.ok(validationSources.every((source) => !primarySources.has(source)));
  assert.ok(validation.corpus.cases.every((row) => row.sample_id.startsWith('validation-case-')));
});

test('annotation scorer excludes uncertain consensus and reports decision precision and recall', () => {
  const annotatorA = {
    cases: [
      { sample_id: 'a', revision_warranted: 'yes' },
      { sample_id: 'b', revision_warranted: 'no' },
      { sample_id: 'c', revision_warranted: 'yes' },
      { sample_id: 'd', revision_warranted: 'uncertain' },
    ],
  };
  const annotatorB = {
    cases: [
      { sample_id: 'a', revision_warranted: 'yes' },
      { sample_id: 'b', revision_warranted: 'no' },
      { sample_id: 'c', revision_warranted: 'no' },
      { sample_id: 'd', revision_warranted: 'uncertain' },
    ],
  };
  const key = {
    cases: [
      { sample_id: 'a', shadow: { revision_warranted: true } },
      { sample_id: 'b', shadow: { revision_warranted: true } },
      { sample_id: 'c', shadow: { revision_warranted: false } },
      { sample_id: 'd', shadow: { revision_warranted: false } },
    ],
  };
  const scores = scoreBlindedAnnotations({ annotatorA, annotatorB, key });
  assert.equal(scores.metrics.scoredConsensusCases, 2);
  assert.equal(scores.metrics.uncertainCases, 2);
  assert.equal(scores.metrics.truePositive, 1);
  assert.equal(scores.metrics.falsePositive, 1);
  assert.equal(scores.metrics.precision, 0.5);
  assert.equal(scores.metrics.recall, 1);
  assert.equal(scores.metrics.accuracy, 0.5);
});

test('blind annotation validation fails closed before the private key is needed', () => {
  const corpus = {
    study_id: 'test-study',
    blinded: true,
    cases: [{ sample_id: 'a' }, { sample_id: 'b' }],
  };
  const valid = {
    schema: 'machinespirits.adaptation-refinement.warrant-annotation-response.v1',
    study_id: 'test-study',
    corpus_sha256: 'frozen',
    cases: [
      { sample_id: 'a', revision_warranted: 'yes', note: 'Persistent strategy failure.' },
      { sample_id: 'b', revision_warranted: 'uncertain', note: 'Evidence supports either reading.' },
    ],
  };
  assert.deepEqual(
    validateBlindedAnnotationResponse({ response: valid, corpus, expectedCorpusSha256: 'frozen' }),
    { ok: true, cases: 2, counts: { yes: 1, no: 0, uncertain: 1 } },
  );
  assert.throws(
    () =>
      validateBlindedAnnotationResponse({
        response: { ...valid, cases: valid.cases.slice(0, 1) },
        corpus,
        expectedCorpusSha256: 'frozen',
      }),
    /exactly 2 frozen cases/u,
  );
  assert.throws(
    () => validateBlindedAnnotationResponse({ response: valid, corpus, expectedCorpusSha256: 'changed' }),
    /corpus_sha256/u,
  );
});

test('v2 annotations validate successor families and the scorer gates decision plus transition quality', () => {
  const corpus = {
    study_id: 'contract-validation',
    blinded: true,
    cases: Array.from({ length: 12 }, (_, index) => ({ sample_id: `c${index + 1}` })),
  };
  const labels = [
    ['yes', 'stage_next_step'],
    ['yes', 'answer_accountably'],
    ...Array.from({ length: 10 }, () => ['no', 'hold']),
  ];
  const response = {
    schema: 'machinespirits.adaptation-refinement.warrant-annotation-response.v2',
    study_id: corpus.study_id,
    corpus_sha256: 'frozen-v2',
    cases: corpus.cases.map((row, index) => ({
      sample_id: row.sample_id,
      revision_warranted: labels[index][0],
      recommended_action_family: labels[index][1],
      note: 'Decision-time evidence supports this transition.',
    })),
  };
  assert.equal(
    validateBlindedAnnotationResponse({ response, corpus, expectedCorpusSha256: 'frozen-v2' }).ok,
    true,
  );
  const key = {
    cases: corpus.cases.map((row, index) => ({
      sample_id: row.sample_id,
      profile: index >= 8 ? 'diligent' : 'low_agency',
      shadow: {
        revision_warranted: labels[index][0] === 'yes',
        policy: labels[index][0] === 'yes' ? { family: labels[index][1] } : null,
      },
    })),
  };
  const score = scoreBlindedAnnotations({ annotatorA: response, annotatorB: response, key });
  assert.equal(score.metrics.precision, 1);
  assert.equal(score.metrics.recall, 1);
  assert.equal(score.metrics.transitionAccuracy, 1);
  assert.equal(score.metrics.diligentFalsePositiveRate, 0);
  const gate = evaluateAdaptiveWarrantDecisionGate(score, { liveShadowAgreement: 1 });
  assert.equal(gate.passed, true);
  assert.ok(gate.checks.every((row) => row.passed));
});
