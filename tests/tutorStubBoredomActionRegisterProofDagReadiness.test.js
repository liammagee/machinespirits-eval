import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  buildTutorStubBoredomProofDagPlan,
  buildTutorStubBoredomProofDagSyntheticCases,
  assembleTutorStubBoredomProofDagPreflight,
  exactBlockedScorePValue,
  exactBlockedScorePower,
  exactMcNemarPower,
  loadTutorStubBoredomProofDagRegistration,
  objectiveProofProgressByTwoTurns,
  runTutorStubBoredomProofDagEndpointPreflight,
  validateTutorStubBoredomProofDagRegistration,
} from '../services/tutorStubBoredomActionRegisterProofDagPreflight.js';
import { scoreTutorStubResistanceRecovery } from '../services/tutorStubResistanceActionRegisterStudy.js';
import {
  hashPaidStudyEndpointValue,
  validatePaidStudyEndpointGoCertificate,
} from '../services/paidStudyEndpointPreflight.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTRACT_PATH = 'config/paid-study-endpoints/tutor-stub-boredom-action-register-proof-dag.v1.json';
const CERTIFICATE_PATH = 'config/paid-study-endpoints/tutor-stub-boredom-action-register-proof-dag.v1.endpoint-go.json';

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function fileSha256(relativePath) {
  return crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(ROOT, relativePath)))
    .digest('hex');
}

test('boredom evidence is frozen with exact provenance and explicit limitations', () => {
  const registration = loadTutorStubBoredomProofDagRegistration({ root: ROOT });
  const heldout = registration.evidence.prospectiveHeldOutBoredomDetection;
  const action = registration.evidence.historicalMatchedAction;
  assert.equal(heldout.reportSha256, '714f69f489297c571ff4157ce0269e6d3f68ccac485453b53d05cc09d5908c75');
  assert.equal(heldout.preRepinRequest.sha256, '99a12f902ee4589a922524589e32c890bc458a96fa355c408c14ca4c7d1a22e0');
  assert.equal(heldout.preRepinRequest.launchCommit, heldout.observedTraceSource.commit);
  assert.equal(heldout.repinnedRequest.sha256, 'b52aa74bb5980229f85d6d6c8e857c59de72ba22f9e4d7be377eb17fe278b4ee');
  assert.notEqual(heldout.repinnedRequest.launchCommit, heldout.observedTraceSource.commit);
  assert.equal(heldout.canonicalReportBytesPresent, false);
  assert.equal(heldout.boredEffortWithholding, '18/24');
  assert.equal(heldout.observedRate, 0.75);
  assert.equal(heldout.maximumNonTargetRate, 0);
  assert.equal(heldout.modelRoute.learner, 'codex.gpt-5.6-luna');
  assert.equal(action.result, 'matched_5_of_5_mismatched_0_of_5');
  assert.equal(action.rawTraceArchiveSha256, '5c27a5c6c1f19450935baa8489ad2f74e4c16a2647515f4c83bf068659cbd63f');
  assert.equal(action.runSourceDirty, true);
  assert.equal(action.modelRoute.tutor, 'claude-code.claude-sonnet-5');
  assert.equal(action.modelCalls, '822/822');
  assert.equal(action.providerFailures, 0);
  assert.equal(action.traceSha256.length, 10);
  assert.equal(new Set(action.traceSha256).size, 10);
  assert.match(action.limitations.join(' '), /one proof-DAG world only/u);
  assert.equal(action.localIgnoredRowAudit.sha256, '0d8d8e891abfff0ada192e5de067c0795c676c4d903795f51b173aafc732355d');
  assert.equal(action.localIgnoredRowAudit.tracked, false);
  assert.equal(action.localIgnoredRowAudit.privateArchived, false);
  assert.equal(action.localIgnoredRowAudit.narrowAutomaticHit, '3/5_matched_0/5_mismatched');
  assert.match(action.limitations.join(' '), /single-adjudicator conduct ruling/u);
  assert.equal(action.outcomesPooledIntoThisStudy, false);
  assert.equal(heldout.outcomesPooledIntoThisStudy, false);
});

test('18 fresh dialogues per arm are the minimum under the predeclared exact blocked alternative', () => {
  const power17 = exactBlockedScorePower({
    perArmByWorld: [2, 3, 3, 3, 3, 3],
    plainRecoveryRate: 1 / 6,
    warmRecoveryRate: 4 / 6,
  });
  const power18 = exactBlockedScorePower({
    perArmByWorld: [3, 3, 3, 3, 3, 3],
    plainRecoveryRate: 1 / 6,
    warmRecoveryRate: 4 / 6,
  });
  assert.ok(power17 < 0.8);
  assert.ok(power18 >= 0.8);
  assert.ok(Math.abs(power17 - 0.7947641958186097) < 1e-10);
  assert.ok(Math.abs(power18 - 0.8164905471625752) < 1e-10);
  const paired27 = exactMcNemarPower({ pairs: 27, warmOnlyProbability: 4 / 6, plainOnlyProbability: 1 / 6 });
  const paired28 = exactMcNemarPower({ pairs: 28, warmOnlyProbability: 4 / 6, plainOnlyProbability: 1 / 6 });
  assert.ok(paired27 < 0.8);
  assert.ok(paired28 >= 0.8);
  assert.ok(Math.abs(paired27 - 0.7983670167301511) < 1e-12);
  assert.ok(Math.abs(paired28 - 0.8166088496475903) < 1e-12);
  assert.ok(2160 < 2856);
});

test('plan isolates register across 36 distinct fresh dialogues and nine balanced bounded batches', () => {
  const registration = loadTutorStubBoredomProofDagRegistration({ root: ROOT });
  const validation = validateTutorStubBoredomProofDagRegistration(registration);
  assert.equal(validation.ok, true, validation.errors.join('; '));
  const plan = buildTutorStubBoredomProofDagPlan(registration);
  assert.equal(plan.jobs.length, 36);
  assert.equal(new Set(plan.jobs.map((row) => row.id)).size, 36);
  assert.equal(new Set(plan.jobs.map((row) => row.seed)).size, 36);
  assert.equal(plan.assignment_manifest_sha256, registration.design.randomization.assignmentManifestSha256);
  assert.equal(new Set(plan.jobs.map((row) => row.assignment_rank_sha256)).size, 36);
  assert.equal(plan.jobs.filter((row) => row.realization === 'plain').length, 18);
  assert.equal(plan.jobs.filter((row) => row.realization === 'warm').length, 18);
  assert.ok(plan.jobs.every((row) => row.pedagogical_move === 'ask_discriminating_question'));
  for (const world of registration.design.worlds) {
    const rows = plan.jobs.filter((row) => row.world === world);
    assert.equal(rows.length, 6);
    assert.equal(rows.filter((row) => row.realization === 'plain').length, 3);
    assert.equal(rows.filter((row) => row.realization === 'warm').length, 3);
  }
  assert.equal(plan.batches.length, 9);
  assert.ok(plan.batches.every((batch) => batch.cases === 4 && batch.plain === 2 && batch.warm === 2));
  assert.ok(plan.batches.every((batch) => batch.ceiling <= 288));
  assert.equal(plan.total_maximum_model_attempt_reservations, 2160);
  const driftedSeed = structuredClone(registration);
  driftedSeed.design.randomization.assignmentSeed += 1;
  assert.throws(() => buildTutorStubBoredomProofDagPlan(driftedSeed), /randomization assignment drifted/u);
});

test('primary endpoint preserves the existing one-turn bored recovery horizon', () => {
  const secondTurnOnly = scoreTutorStubResistanceRecovery({
    profile: 'bored',
    postLearnerTurns: [
      {
        learnerText: 'I do not know.',
        classification: { turn: { discourse_move: 'uncertainty', evidence_use: 'none' } },
      },
      {
        learnerText: 'The clipped edge supports the die-mark comparison.',
        classification: { turn: { discourse_move: 'inference', evidence_use: 'links_evidence_to_rule' } },
      },
    ],
  });
  const firstTurn = scoreTutorStubResistanceRecovery({
    profile: 'bored',
    postLearnerTurns: [
      {
        learnerText: 'The clipped edge supports the die-mark comparison.',
        classification: { turn: { discourse_move: 'inference', evidence_use: 'links_evidence_to_rule' } },
      },
    ],
  });
  assert.equal(secondTurnOnly.recovered, false);
  assert.equal(secondTurnOnly.deadline_turns, 1);
  assert.equal(firstTurn.recovered, true);
  assert.equal(firstTurn.observed_turn, 1);
});

test('attempt arithmetic and ceiling amendments fail closed', () => {
  const registration = loadTutorStubBoredomProofDagRegistration({ root: ROOT });
  assert.equal(registration.executionReadiness.dialogue.oneCumulativeFullLearnerRepairCalls, 2);
  assert.equal(registration.executionReadiness.dialogue.maximumReservations, 36 * 20 * 3);
  assert.equal(registration.executionReadiness.hardStudyAttemptCeiling, 2160);
  assert.equal(185 + 2160, 2345);
  assert.equal(2345 - 1200, 1145);
  assert.equal(185 + 2160 + 2160, 4505);
  assert.equal(4505 - 1200, 3305);
  const drifted = structuredClone(registration);
  drifted.executionReadiness.hardStudyAttemptCeiling = 2159;
  assert.equal(validateTutorStubBoredomProofDagRegistration(drifted).ok, false);
});

test('endpoint preflight completes randomized recovery, objective proof progress, and fidelity at zero calls', () => {
  const registration = loadTutorStubBoredomProofDagRegistration({ root: ROOT });
  const contract = readJson(CONTRACT_PATH);
  assert.equal(
    contract.registration.registration_sha256,
    fileSha256('config/tutor-stub-boredom-action-register-proof-dag-registration.v1.json'),
  );
  const preflight = runTutorStubBoredomProofDagEndpointPreflight({ contract, registration });
  assert.equal(preflight.model_calls, 0);
  assert.equal(preflight.production_writes, 0);
  assert.equal(preflight.readiness.model_calls, 0);
  assert.equal(preflight.readiness.production_writes, 0);
  assert.equal(preflight.readiness.live_executor_available, false);
  assert.equal(preflight.readiness.hard_study_attempt_ceiling, 2160);
  const assembled = assembleTutorStubBoredomProofDagPreflight({
    cases: buildTutorStubBoredomProofDagSyntheticCases(registration),
    contract,
  });
  assert.equal(assembled.report.distinct_fresh_prefixes, 36);
  assert.equal(assembled.report.plain_dialogues, 18);
  assert.equal(assembled.report.warm_dialogues, 18);
  assert.equal(assembled.report.plain_successes, 3);
  assert.equal(assembled.report.warm_successes, 12);
  assert.equal(assembled.report.recovery_endpoint_deadline_turns, 1);
  assert.ok(assembled.report.exact_two_sided_conditional_blocked_score_p <= 1);
  for (const endpoint of contract.endpoints) assert.equal(assembled.endpoint_status[endpoint.id], 'complete');
  const certificate = readJson(CERTIFICATE_PATH);
  const certificateValidation = validatePaidStudyEndpointGoCertificate({ contract, preflight, certificate });
  assert.equal(certificateValidation.ok, true, certificateValidation.errors.join('; '));
  assert.equal(certificate.status, 'endpoint_runtime_go');
  assert.match(certificate.authorization_scope, /authorizes no model call/u);
  assert.equal(certificate.contract_sha256, hashPaidStudyEndpointValue(contract));
});

test('objective composite, recovery Boolean, and exact randomized plan fail closed', () => {
  const registration = loadTutorStubBoredomProofDagRegistration({ root: ROOT });
  const contract = readJson(CONTRACT_PATH);
  const cases = buildTutorStubBoredomProofDagSyntheticCases(registration);
  assert.equal(objectiveProofProgressByTwoTurns(cases[0].outcome), cases[0].outcome.proof_progress_by_two_turns);

  const contradictory = structuredClone(cases);
  contradictory[0].outcome.proof_progress_by_two_turns = true;
  contradictory[0].outcome.new_supported_public_premises = 0;
  contradictory[0].outcome.best_path_coverage_delta = 0;
  contradictory[0].outcome.proof_debt_delta = 0;
  contradictory[0].outcome.unsupported_public_claims = 99;
  assert.equal(
    assembleTutorStubBoredomProofDagPreflight({ cases: contradictory, contract }).endpoint_status
      .objective_proof_progress_by_two_turns,
    'incomplete',
  );

  const invalidRecovery = structuredClone(cases);
  invalidRecovery[0].outcome.recovered = 'yes';
  assert.equal(
    assembleTutorStubBoredomProofDagPreflight({ cases: invalidRecovery, contract }).endpoint_status
      .profile_specific_resistance_recovery,
    'incomplete',
  );

  const driftedPlan = structuredClone(cases);
  driftedPlan[0].arm = driftedPlan[0].arm === 'plain' ? 'warm' : 'plain';
  assert.equal(
    assembleTutorStubBoredomProofDagPreflight({ cases: driftedPlan, contract }).endpoint_status
      .randomized_register_assembly,
    'incomplete',
  );

  const nullBlocks = [
    { plainN: 3, warmN: 3, plainSuccesses: 3, warmSuccesses: 0 },
    { plainN: 3, warmN: 3, plainSuccesses: 2, warmSuccesses: 0 },
    { plainN: 3, warmN: 3, plainSuccesses: 2, warmSuccesses: 1 },
    { plainN: 3, warmN: 3, plainSuccesses: 2, warmSuccesses: 1 },
    { plainN: 3, warmN: 3, plainSuccesses: 2, warmSuccesses: 1 },
    { plainN: 3, warmN: 3, plainSuccesses: 1, warmSuccesses: 2 },
  ];
  assert.ok(Math.abs(exactBlockedScorePValue(nullBlocks) - 0.060811125) < 1e-12);
});

test('readiness is not a live executor or authorization surface', () => {
  const registration = loadTutorStubBoredomProofDagRegistration({ root: ROOT });
  assert.equal(registration.authorization.modelCallsAuthorized, false);
  assert.equal(registration.authorization.liveRunAuthorized, false);
  assert.equal(registration.authorization.goRequestPrepared, false);
  assert.equal(registration.authorization.thisReadinessConsumesProgrammeHeadroom, false);
  assert.equal(registration.design.noReuseOrPooling.priorTwelveCalibrationDialoguesReused, false);
  assert.equal(registration.design.noReuseOrPooling.priorOutcomesPooled, false);
  assert.equal(registration.design.noReuseOrPooling.interimAnalysis, false);
  assert.equal(registration.executionReadiness.validUnitReruns, false);
  assert.equal(registration.executionReadiness.outcomeSelection, false);
  assert.equal(registration.executionReadiness.liveExecutorAvailable, false);
  assert.equal(registration.executionReadiness.combinedAnalyzerAvailable, false);
  assert.equal(registration.executionReadiness.requestValidatorAvailable, false);
  assert.equal(
    fs.existsSync(path.join(ROOT, 'config/tutor-stub-boredom-action-register-proof-dag-study-go-request.v1.json')),
    false,
  );
});
