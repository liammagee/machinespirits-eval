import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildCommitteeFloorAblationPlan,
  buildPhase5LivePilotPlan,
  buildPhase5bLivePilotPlan,
  buildPhase5cLivePilotPlan,
  classifyProgram2LaunchFailure,
  COMMITTEE_FLOOR_ABLATION_SPEC,
  PHASE5_LIVE_PILOT_SPEC,
  validateCommitteeFloorAblationPlan,
} from '../scripts/run-program2-live-pilot.js';
import {
  analyzeFloorAblationRows,
  loadSealedFloorAblationRows,
  summarizeTutorResponseGuard,
} from '../scripts/analyze-program2-committee-floor-ablation.mjs';

function flagValue(command, flag) {
  const index = command.indexOf(flag);
  return index >= 0 ? command[index + 1] : null;
}

function conditionCount(plan, profile, condition) {
  return plan.jobs.filter((job) => job.profile === profile && job.condition === condition).length;
}

test('floor ablation plan is a balanced 12 + 12 + 6 contemporaneous design', () => {
  const plan = buildCommitteeFloorAblationPlan({ outputRoot: '/tmp/program2-floor-plan-test' });
  const validation = validateCommitteeFloorAblationPlan(plan);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
  assert.equal(plan.jobs.length, 30);
  assert.equal(validation.matchedPairCount, 12);
  for (const profile of PHASE5_LIVE_PILOT_SPEC.profiles) {
    assert.equal(conditionCount(plan, profile, 'trained_committee'), 6);
    assert.equal(conditionCount(plan, profile, 'untuned_committee'), 6);
    assert.equal(conditionCount(plan, profile, 'silent_control'), 3);
  }
});

test('matched committee jobs differ only at the mini-model and provenance flags', () => {
  const plan = buildCommitteeFloorAblationPlan({ outputRoot: '/tmp/program2-floor-plan-test' });
  const committee = plan.jobs.filter((job) => job.arm === 'committee');
  for (const pairKey of new Set(committee.map((job) => job.pairKey))) {
    const pair = committee.filter((job) => job.pairKey === pairKey);
    const trained = pair.find((job) => job.condition === 'trained_committee');
    const untuned = pair.find((job) => job.condition === 'untuned_committee');
    assert.ok(trained && untuned, `incomplete pair ${pairKey}`);
    assert.equal(flagValue(trained.command, '--committee-mini-model'), COMMITTEE_FLOOR_ABLATION_SPEC.trainedMiniModel);
    assert.equal(flagValue(untuned.command, '--committee-mini-model'), COMMITTEE_FLOOR_ABLATION_SPEC.untunedMiniModel);
    assert.equal(flagValue(trained.command, '--eval-job-id'), pairKey);
    assert.equal(flagValue(untuned.command, '--eval-job-id'), pairKey);
    const normalized = (command) => {
      const copy = [...command];
      for (const flag of ['--committee-mini-model', '--trace-dir']) {
        const index = copy.indexOf(flag);
        copy[index + 1] = `<${flag}>`;
      }
      return copy;
    };
    assert.deepEqual(normalized(trained.command), normalized(untuned.command));
  }
});

test('adding the floor plan leaves historical Phase 5 plan builders deterministic and on the trained mini', () => {
  for (const [builder, root] of [
    [buildPhase5LivePilotPlan, '/tmp/program2-historical-5'],
    [buildPhase5bLivePilotPlan, '/tmp/program2-historical-5b'],
    [buildPhase5cLivePilotPlan, '/tmp/program2-historical-5c'],
  ]) {
    const first = builder({ outputRoot: root });
    const second = builder({ outputRoot: root });
    assert.deepEqual(first, second);
    assert.ok(
      first.jobs.every(
        (job) => flagValue(job.command, '--committee-mini-model') === PHASE5_LIVE_PILOT_SPEC.committeeMiniModel,
      ),
    );
  }
});

function makeRows({ trainedComp, untunedComp, controlComp }) {
  const rows = [];
  for (const profile of PHASE5_LIVE_PILOT_SPEC.profiles) {
    for (let repeat = 1; repeat <= 6; repeat += 1) {
      const pairKey = `${profile}:r${repeat}`;
      rows.push(makeRow('trained_committee', profile, repeat, pairKey, trainedComp));
      rows.push(makeRow('untuned_committee', profile, repeat, pairKey, untunedComp));
    }
    for (let repeat = 1; repeat <= 3; repeat += 1) {
      rows.push(makeRow('silent_control', profile, repeat, null, controlComp));
    }
  }
  return rows;
}

function makeRow(condition, profile, repeat, pairKey, comp) {
  return {
    job: { id: `${condition}-${profile}-${repeat}`, condition, profile, repeat, pairKey },
    warrant: { opp: 4, comp },
    verdicts: [],
    moments:
      condition === 'silent_control'
        ? []
        : [{ source: 'fallback_multi_question', fallback: { resolution: 'trimmed' } }],
    fixedHorizon: { coverageAtHorizon: 0.8, hardSafetyPassed: true },
    leakTurns: [],
    responseGuard: {
      completedTurns: 4,
      repairedTurns: condition === 'trained_committee' ? 2 : 1,
      deterministicFallbackTurns: condition === 'trained_committee' ? 1 : 0,
      totalAttempts: condition === 'trained_committee' ? 8 : 4,
      outcomeTally: { guarded_original_accepted: condition === 'trained_committee' ? 3 : 4 },
      guardTriggerTally: condition === 'trained_committee' ? { 'live_turn_progression_v1:test': 1 } : {},
      publicClaimStatusTally: { supported: 1, unknown: 3 },
      publicClaimStatusBasisTally: { committed_public_evidence_match: 1, no_material_focus: 3 },
    },
  };
}

test('response-guard diagnostic extracts fallback, trigger, and typed claim-status incidence', () => {
  const summary = summarizeTutorResponseGuard([
    {
      tutorResponseRepaired: true,
      tutorDeterministicFallback: true,
      tutorGuardAccounting: {
        outcome: 'guarded_deterministic_fallback',
        attempts: [{}, {}, {}],
        repairsApplied: [
          {
            triggeredBy: [{ guard: 'live_turn_progression_v1', type: 'supported_public_claim_reopened' }],
          },
        ],
      },
      firstDraftContract: {
        progression: {
          public_claim_status: { status: 'supported', basis: 'committed_public_evidence_match' },
        },
      },
    },
    {
      tutorResponseRepaired: false,
      tutorDeterministicFallback: false,
      tutorGuardAccounting: { outcome: 'guarded_original_accepted', attempts: [{}], repairsApplied: [] },
      prompts: {
        tutor: {
          firstDraftContract: {
            progression: { public_claim_status: { status: 'unknown', basis: 'partial_public_evidence_match' } },
          },
        },
      },
    },
  ]);
  assert.equal(summary.completedTurns, 2);
  assert.equal(summary.deterministicFallbackRate, 0.5);
  assert.equal(summary.repairRate, 0.5);
  assert.equal(summary.meanAttempts, 2);
  assert.equal(summary.guardTriggerTally['live_turn_progression_v1:supported_public_claim_reopened'], 1);
  assert.deepEqual(summary.publicClaimStatusTally, { supported: 1, unknown: 1 });
});

test('sealed-trace loading joins authoritative first-draft contract events to completed fallback turns', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'program2-floor-loader-'));
  try {
    const job = { id: 'fixture-job', condition: 'trained_committee', profile: 'proof_skipper', pairKey: 'p:r1' };
    fs.writeFileSync(path.join(root, 'launch-plan.json'), JSON.stringify({ plan: { jobs: [job] } }));
    const traceDir = path.join(root, 'traces', job.id);
    fs.mkdirSync(traceDir, { recursive: true });
    const trace = [
      {
        type: 'tutor_first_draft_contract',
        turn: 1,
        contract: {
          progression: {
            public_claim_status: { status: 'supported', basis: 'persistent_public_learner_record' },
          },
        },
      },
      {
        type: 'turn_complete',
        turn: 1,
        turnRecord: {
          turn: 1,
          tutorGuardAccounting: { outcome: 'guarded_deterministic_fallback', attempts: [], repairsApplied: [] },
          tutorDeterministicFallback: true,
        },
      },
      { type: 'run_end' },
    ];
    fs.writeFileSync(path.join(traceDir, 'fixture.jsonl'), `${trace.map((row) => JSON.stringify(row)).join('\n')}\n`);

    const loaded = loadSealedFloorAblationRows(root);
    assert.equal(loaded.rows.length, 1);
    assert.deepEqual(loaded.rows[0].responseGuard.publicClaimStatusTally, { supported: 1 });
    assert.deepEqual(loaded.rows[0].responseGuard.publicClaimStatusBasisTally, {
      persistent_public_learner_record: 1,
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('analysis detects a trained-weights contribution from complete matched blocks', () => {
  const artifact = analyzeFloorAblationRows(makeRows({ trainedComp: 4, untunedComp: 1, controlComp: 0 }), {
    draws: 500,
  });
  assert.equal(artifact.readyForLicensedReading, true);
  assert.equal(artifact.primary.pairedBlocks, 12);
  assert.equal(artifact.primary.trainingContributionDetected, true);
  assert.equal(artifact.secondary.trainedMinusControl.advantageDetected, true);
  assert.equal(artifact.reading, 'trained_weights_add_live_gain');
  assert.equal(artifact.responseGuardDiagnostics.role, 'diagnostic_only');
  assert.equal(artifact.responseGuardDiagnostics.changesConfirmatoryEstimands, false);
  assert.equal(artifact.responseGuardDiagnostics.byCondition.trained_committee.deterministicFallbackRate, 0.25);
  assert.equal(artifact.responseGuardDiagnostics.byCondition.untuned_committee.deterministicFallbackRate, 0);
  assert.equal(artifact.responseGuardDiagnostics.trainedMinusUntunedFallbackRate, 0.25);
});

test('analysis requires interval equivalence before licensing harness sufficiency', () => {
  const artifact = analyzeFloorAblationRows(makeRows({ trainedComp: 2, untunedComp: 2, controlComp: 0 }), {
    draws: 500,
  });
  assert.equal(artifact.primary.practicallyEquivalent, true);
  assert.equal(artifact.secondary.untunedMinusControl.advantageDetected, true);
  assert.equal(artifact.reading, 'harness_sufficient_within_equivalence_margin');
});

test('analysis refuses a licensed reading when any planned condition is incomplete', () => {
  const rows = makeRows({ trainedComp: 4, untunedComp: 1, controlComp: 0 });
  rows.pop();
  const artifact = analyzeFloorAblationRows(rows, { draws: 100 });
  assert.equal(artifact.readyForLicensedReading, false);
  assert.equal(artifact.reading, 'incomplete_or_under_informative');
});

test('launcher distinguishes deterministic final audits from provider transport failures', () => {
  const auditFailure = classifyProgram2LaunchFailure({
    error: new Error('child exited 1'),
    traceEvent: {
      turn: 31,
      error: 'Tutor deterministic fallback failed final audit: response_composition:generic_learner_uptake',
      traceFile: '/tmp/audit.jsonl',
    },
  });
  assert.deepEqual(
    {
      kind: auditFailure.kind,
      counts: auditFailure.countsTowardTransportAbort,
      aborts: auditFailure.abortImmediately,
      turn: auditFailure.turn,
    },
    { kind: 'deterministic_final_audit', counts: false, aborts: false, turn: 31 },
  );

  const transportFailure = classifyProgram2LaunchFailure({
    error: new Error('child exited 1'),
    traceEvent: { turn: 4, error: 'provider transport: HTTP 503 temporarily unavailable' },
  });
  assert.deepEqual(
    {
      kind: transportFailure.kind,
      counts: transportFailure.countsTowardTransportAbort,
      aborts: transportFailure.abortImmediately,
    },
    { kind: 'provider_transport', counts: true, aborts: false },
  );

  const infrastructureFailure = classifyProgram2LaunchFailure({ error: new Error('child exited 1') });
  assert.deepEqual(
    {
      kind: infrastructureFailure.kind,
      counts: infrastructureFailure.countsTowardTransportAbort,
      aborts: infrastructureFailure.abortImmediately,
    },
    { kind: 'child_process', counts: false, aborts: true },
  );
});
