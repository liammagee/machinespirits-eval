import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  boredomContrastAxis,
  buildTutorStubBoredomProofDagPlan,
  buildTutorStubBoredomProofDagSyntheticCases,
  assembleTutorStubBoredomProofDagPreflight,
  exactBlockedScorePValue,
  exactBlockedScorePower,
  exactMcNemarPower,
  loadTutorStubBoredomProofDagRegistration,
  boredomProofProgressNames,
  objectiveProofProgress,
  runTutorStubBoredomProofDagEndpointPreflight,
  validateTutorStubBoredomProofDagRegistration,
} from '../services/tutorStubBoredomActionRegisterProofDagPreflight.js';
import {
  scoreTutorStubResistanceRecovery,
  scoreTutorStubResistanceRecoveryWithinHorizon,
} from '../services/tutorStubResistanceActionRegisterStudy.js';
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
  assert.equal(219 + 2160, 2379);
  assert.equal(219 + 2160 + 2160, 4539);
  assert.equal(
    registration.executionReadiness.attemptAccountingRole,
    'operational_execution_safeguard_only_not_scientific_endpoint_design_objective_or_sample_size_constraint',
  );
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
  assert.equal(preflight.readiness.live_executor_available, true);
  assert.equal(preflight.readiness.combined_analyzer_available, true);
  assert.equal(preflight.readiness.request_validator_available, true);
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
  assert.equal(assembled.report.deadline_turns, 1);
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
  // The field and the endpoint carry the registered window in their names, so
  // the test reads them the same way the code writes them.
  const progress = boredomProofProgressNames(registration);
  assert.equal(progress.field, 'proof_progress_by_two_turns');
  assert.equal(progress.endpoint, 'objective_proof_progress_by_two_turns');
  assert.equal(objectiveProofProgress(cases[0].outcome), cases[0].outcome[progress.field]);

  const contradictory = structuredClone(cases);
  contradictory[0].outcome[progress.field] = true;
  contradictory[0].outcome.new_supported_public_premises = 0;
  contradictory[0].outcome.best_path_coverage_delta = 0;
  contradictory[0].outcome.proof_debt_delta = 0;
  contradictory[0].outcome.unsupported_public_claims = 99;
  assert.equal(
    assembleTutorStubBoredomProofDagPreflight({ cases: contradictory, contract }).endpoint_status[progress.endpoint],
    'incomplete',
  );

  const invalidRecovery = structuredClone(cases);
  invalidRecovery[0].outcome.recovered = 'yes';
  assert.equal(
    assembleTutorStubBoredomProofDagPreflight({ cases: invalidRecovery, contract }).endpoint_status
      .profile_specific_resistance_recovery,
    'incomplete',
  );
  const missingObservedTurn = structuredClone(cases);
  delete missingObservedTurn[0].outcome.observed_turn;
  assert.equal(
    assembleTutorStubBoredomProofDagPreflight({ cases: missingObservedTurn, contract }).endpoint_status
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

test('production readiness and the prepared request remain HOLD-only authorization boundaries', () => {
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
  assert.equal(registration.executionReadiness.liveExecutorAvailable, true);
  assert.equal(registration.executionReadiness.combinedAnalyzerAvailable, true);
  assert.equal(registration.executionReadiness.requestValidatorAvailable, true);
  const requestPath = path.join(ROOT, 'config/tutor-stub-boredom-action-register-proof-dag-study-go-request.v1.json');
  assert.equal(fs.existsSync(requestPath), true);
  const request = JSON.parse(fs.readFileSync(requestPath, 'utf8'));
  assert.equal(request.status, 'HOLD_PENDING_EXPLICIT_HUMAN_APPROVAL');
  assert.equal(request.authorization.explicitHumanApproval, null);
  assert.equal(request.authorization.modelCallsAuthorized, false);
  assert.equal(request.authorization.liveRunAuthorized, false);
});

test('an endpoint contract is refused when it does not belong to the registration being read', () => {
  // The v5 preflight read a v2 contract for as long as the contract path was a
  // second fixed default beside the registration path. It did not pass wrongly;
  // it asked all 36 dialogues for a two-turn field that a five-turn study never
  // writes, and refused a design that was sound. Two things now tie the pair
  // together: the contract states which registration it belongs to, and it names
  // the objective endpoint after the outcome window.
  const v5 = loadTutorStubBoredomProofDagRegistration({
    root: ROOT,
    registrationPath: 'config/tutor-stub-boredom-action-register-proof-dag-registration.v5.json',
  });
  const v2Contract = readJson('config/paid-study-endpoints/tutor-stub-boredom-action-register-proof-dag.v2.json');
  const v5Contract = readJson('config/paid-study-endpoints/tutor-stub-boredom-action-register-proof-dag.v5.json');

  assert.equal(boredomProofProgressNames(v5).endpoint, 'objective_proof_progress_by_five_turns');
  assert.equal(v5Contract.registration.key_secondary_endpoint_id, 'objective_proof_progress_by_five_turns');

  assert.throws(
    () =>
      runTutorStubBoredomProofDagEndpointPreflight({
        contract: v2Contract,
        registration: v5,
        registrationPath: 'config/tutor-stub-boredom-action-register-proof-dag-registration.v5.json',
      }),
    /endpoint contract belongs to .*registration\.v2\.json/u,
  );

  // Without the path, the window name alone still has to give the pair away.
  assert.throws(
    () => runTutorStubBoredomProofDagEndpointPreflight({ contract: v2Contract, registration: v5 }),
    /objective_proof_progress_by_two_turns where this outcome window reads objective_proof_progress_by_five_turns/u,
  );

  const passed = runTutorStubBoredomProofDagEndpointPreflight({
    contract: v5Contract,
    registration: v5,
    registrationPath: 'config/tutor-stub-boredom-action-register-proof-dag-registration.v5.json',
  });
  assert.equal(passed.status, 'passed');
  assert.equal(passed.assembly_audit.endpoint_status.objective_proof_progress_by_five_turns, 'complete');
  assert.equal(passed.readiness.contract_binding.registration_bytes_match_contract, true);
  assert.equal(passed.readiness.model_calls, 0);
  assert.equal(passed.readiness.production_writes, 0);
});

const V6_REGISTRATION_PATH = 'config/tutor-stub-boredom-action-register-proof-dag-registration.v6.json';
const V6_CONTRACT_PATH = 'config/paid-study-endpoints/tutor-stub-boredom-action-register-proof-dag.v6.json';
const V6_CERTIFICATE_PATH =
  'config/paid-study-endpoints/tutor-stub-boredom-action-register-proof-dag.v6.endpoint-go.json';

function loadV6() {
  return loadTutorStubBoredomProofDagRegistration({ root: ROOT, registrationPath: V6_REGISTRATION_PATH });
}

test('v6 contrasts two moves and reads the manner as a balancing block, not as the contrast', () => {
  const v6 = loadV6();
  const v5 = loadTutorStubBoredomProofDagRegistration({
    root: ROOT,
    registrationPath: 'config/tutor-stub-boredom-action-register-proof-dag-registration.v5.json',
  });
  assert.equal(validateTutorStubBoredomProofDagRegistration(v6).ok, true);

  // The axis is what stops a move result being filed under a manner heading.
  const v6Axis = boredomContrastAxis(v6);
  assert.equal(v6Axis.rowField, 'pedagogical_move_level');
  assert.equal(v6Axis.reference, 'ask_question');
  assert.equal(v6Axis.treatment, 'shrink_step');
  assert.equal(v6Axis.blockField, 'arm');
  assert.deepEqual(v6Axis.blockLevels, ['plain', 'warm']);

  // v5 read the same two words the other way round, and had no balanced axis.
  const v5Axis = boredomContrastAxis(v5);
  assert.equal(v5Axis.rowField, 'arm');
  assert.equal(v5Axis.reference, 'plain');
  assert.equal(v5Axis.treatment, 'warm');
  assert.equal(v5Axis.blockField, null);

  // Both moves ask the same host machinery for the same thing, so the
  // instruction text is the single thing that varies between the two arms.
  assert.equal(v6.design.treatment.hostActionFamily, 'stage_next_step');
  assert.equal(v6.design.treatment.hostActionFamilySharedByBothLevels, true);
  const splitFamily = structuredClone(v6);
  splitFamily.design.treatment.hostActionFamilySharedByBothLevels = false;
  assert.equal(validateTutorStubBoredomProofDagRegistration(splitFamily).ok, false);
});

test('v6 plans 36 dialogues with 18 per move, 9 in each move-and-manner cell, and no v5 seed reused', () => {
  const v6 = loadV6();
  const plan = buildTutorStubBoredomProofDagPlan(v6);
  assert.equal(plan.jobs.length, 36);
  assert.equal(new Set(plan.jobs.map((row) => row.id)).size, 36);
  assert.equal(new Set(plan.jobs.map((row) => row.seed)).size, 36);
  assert.equal(plan.assignment_manifest_sha256, v6.design.randomization.assignmentManifestSha256);

  const cell = (level, realization) =>
    plan.jobs.filter((row) => row.pedagogical_move_level === level && row.realization === realization).length;
  assert.equal(plan.jobs.filter((row) => row.pedagogical_move_level === 'ask_question').length, 18);
  assert.equal(plan.jobs.filter((row) => row.pedagogical_move_level === 'shrink_step').length, 18);
  assert.equal(plan.jobs.filter((row) => row.realization === 'plain').length, 18);
  assert.equal(plan.jobs.filter((row) => row.realization === 'warm').length, 18);
  assert.equal(cell('ask_question', 'plain'), 9);
  assert.equal(cell('ask_question', 'warm'), 9);
  assert.equal(cell('shrink_step', 'plain'), 9);
  assert.equal(cell('shrink_step', 'warm'), 9);

  // The move level and the instruction the tutor is given must not part company.
  assert.ok(
    plan.jobs.every((row) => row.pedagogical_move === v6.design.treatment.pedagogicalMoves[row.pedagogical_move_level]),
  );

  for (const world of v6.design.worlds) {
    const rows = plan.jobs.filter((row) => row.world === world);
    assert.equal(rows.length, 6);
    assert.equal(rows.filter((row) => row.pedagogical_move_level === 'ask_question').length, 3);
    assert.equal(rows.filter((row) => row.pedagogical_move_level === 'shrink_step').length, 3);
  }

  // Each batch holds one dialogue of each move-and-manner pair, so a batch that
  // is lost cannot take a whole cell with it.
  assert.equal(plan.batches.length, 9);
  assert.ok(
    plan.batches.every(
      (batch) =>
        batch.cases === 4 &&
        batch.plain === 2 &&
        batch.warm === 2 &&
        batch.ask_question === 2 &&
        batch.shrink_step === 2 &&
        batch.ceiling === 492,
    ),
  );
  assert.equal(plan.total_maximum_model_attempt_reservations, 4428);

  // v5 seeded from 2026090100. A shared seed would make a v6 unit a rerun of a
  // spent one, which this arc forbids outright.
  const v5Plan = buildTutorStubBoredomProofDagPlan(
    loadTutorStubBoredomProofDagRegistration({
      root: ROOT,
      registrationPath: 'config/tutor-stub-boredom-action-register-proof-dag-registration.v5.json',
    }),
  );
  const v5Seeds = new Set(v5Plan.jobs.map((row) => row.seed));
  assert.ok(plan.jobs.every((row) => !v5Seeds.has(row.seed)));
});

test('v6 recovery reads five post-trigger turns where the carried-forward comparability reads one', () => {
  const dull = {
    learnerText: 'I do not know.',
    classification: { turn: { discourse_move: 'uncertainty', evidence_use: 'none' } },
  };
  const engaged = {
    learnerText: 'The clipped edge supports the die-mark comparison.',
    classification: { turn: { discourse_move: 'inference', evidence_use: 'links_evidence_to_rule' } },
  };
  const lateTurns = [dull, dull, dull, engaged, dull];

  const primary = scoreTutorStubResistanceRecoveryWithinHorizon({
    profile: 'bored',
    postLearnerTurns: lateTurns,
    deadlinePostTriggerLearnerTurns: 5,
  });
  assert.equal(primary.recovered, true);
  assert.equal(primary.observed_turn, 4);
  assert.equal(primary.deadline_turns, 5);

  // The v5 primary, carried forward. It reads the same dialogue and finds
  // nothing, which is exactly why the two may never be compared as one measure.
  const comparability = scoreTutorStubResistanceRecovery({ profile: 'bored', postLearnerTurns: lateTurns });
  assert.equal(comparability.recovered, false);
  assert.equal(comparability.deadline_turns, 1);

  // On a first-turn recovery the wide window and the frozen one-turn scorer
  // have to agree, or the comparability reading would not be byte-comparable.
  const early = [engaged, dull, dull, dull, dull];
  assert.equal(
    scoreTutorStubResistanceRecoveryWithinHorizon({
      profile: 'bored',
      postLearnerTurns: early.slice(0, 1),
      deadlinePostTriggerLearnerTurns: 1,
    }).recovered,
    scoreTutorStubResistanceRecovery({ profile: 'bored', postLearnerTurns: early }).recovered,
  );
});

test('v6 endpoint preflight completes the move contrast, the manner block, and content separation at zero calls', () => {
  const v6 = loadV6();
  const contract = readJson(V6_CONTRACT_PATH);
  assert.equal(contract.registration.registration_sha256, fileSha256(V6_REGISTRATION_PATH));

  const preflight = runTutorStubBoredomProofDagEndpointPreflight({
    contract,
    registration: v6,
    registrationPath: V6_REGISTRATION_PATH,
  });
  assert.equal(preflight.status, 'passed');
  assert.equal(preflight.model_calls, 0);
  assert.equal(preflight.production_writes, 0);
  assert.equal(preflight.readiness.contract_binding.registration_bytes_match_contract, true);
  assert.equal(preflight.readiness.hard_study_attempt_ceiling, 4428);
  for (const endpoint of contract.endpoints) {
    assert.equal(preflight.assembly_audit.endpoint_status[endpoint.id], 'complete', endpoint.id);
  }

  // The preflight keeps only the covered cases and the per-endpoint status, so
  // the report body is read from the assembler the preflight itself calls.
  const { report } = assembleTutorStubBoredomProofDagPreflight({
    cases: buildTutorStubBoredomProofDagSyntheticCases(v6),
    contract,
  });
  assert.equal(report.distinct_fresh_prefixes, 36);
  assert.equal(report.manner_block.length, 4);
  assert.ok(report.manner_block.every((cell) => cell.units === 9));
  // The count is reported per move whatever it is, including zero.
  assert.deepEqual(
    report.restated_tutor_content_only.map((row) => row.contrast_level),
    ['ask_question', 'shrink_step'],
  );
  assert.ok(report.restated_tutor_content_only.every((row) => row.restated_tutor_content_only === 0));

  const certificate = readJson(V6_CERTIFICATE_PATH);
  const certificateValidation = validatePaidStudyEndpointGoCertificate({ contract, preflight, certificate });
  assert.equal(certificateValidation.ok, true, certificateValidation.errors.join('; '));
  assert.equal(certificate.contract_sha256, hashPaidStudyEndpointValue(contract));
  assert.match(certificate.authorization_scope, /authorizes no confirmation-model call/u);
});

test('v6 fails closed on an undelivered move, a silent leakage count, and a drifted comparability reading', () => {
  const v6 = loadV6();
  const contract = readJson(V6_CONTRACT_PATH);
  const cases = buildTutorStubBoredomProofDagSyntheticCases(v6);
  const status = (rows) => assembleTutorStubBoredomProofDagPreflight({ cases: rows, contract }).endpoint_status;

  // A unit whose delivered move is not its assigned move is nonadherent. It is
  // analysed where it was assigned and never rerolled, so what has to fail is
  // the interpretability gate, not the unit.
  const undelivered = structuredClone(cases);
  undelivered[0].fidelity.assigned_move_delivered = false;
  assert.equal(status(undelivered).action_register_fidelity_and_safety, 'incomplete');

  // Silence is not zero. A row that never states the count must not pass as a
  // row that states no leakage.
  const silent = structuredClone(cases);
  delete silent[0].outcome.restated_tutor_content_only;
  assert.equal(status(silent).pedagogical_move_balance_and_content_separation, 'incomplete');

  // The comparability reading is derived again from the recovery and the turn
  // it landed on, so a row cannot simply assert it.
  const drifted = structuredClone(cases);
  const recoveredRow = drifted.find((row) => row.outcome.recovered === true);
  recoveredRow.outcome.recovered_at_first_post_trigger_turn = false;
  assert.equal(status(drifted).profile_specific_resistance_recovery, 'incomplete');

  // Breaking the nine-and-nine balance breaks the same gate the leakage count
  // sits behind, because both say whether the move reading can be read at all.
  const unbalanced = structuredClone(cases);
  const plainAsk = unbalanced.find((row) => row.pedagogical_move_level === 'ask_question' && row.arm === 'plain');
  plainAsk.arm = 'warm';
  plainAsk.realization = 'warm';
  assert.equal(status(unbalanced).pedagogical_move_balance_and_content_separation, 'incomplete');
});

test('v6 keeps the programme safeguard settled and refuses a contract from another registration', () => {
  const v6 = loadV6();
  const ceiling = v6.executionReadiness.programmeCeiling;
  assert.equal(ceiling.ledgerBeforeV6, 1912);
  assert.equal(ceiling.v6Maximum, 4428);
  assert.equal(ceiling.ledgerBeforeV6 + ceiling.v6Maximum, ceiling.requiredCeiling);
  assert.equal(ceiling.programmeSafeguard, 15000);
  assert.equal(ceiling.programmeSafeguard - ceiling.requiredCeiling, ceiling.headroom);
  assert.equal(ceiling.shortfall, 0);
  assert.equal(v6.executionReadiness.hardStudyAttemptCeiling, ceiling.v6Maximum);

  // v6 spends no operational headroom of its own, so the safeguard is read, not
  // raised. A raised safeguard has to fail here rather than pass quietly.
  const raised = structuredClone(v6);
  raised.executionReadiness.programmeCeiling.programmeSafeguard = 16000;
  assert.equal(validateTutorStubBoredomProofDagRegistration(raised).ok, false);

  const v5Contract = readJson('config/paid-study-endpoints/tutor-stub-boredom-action-register-proof-dag.v5.json');
  assert.throws(
    () =>
      runTutorStubBoredomProofDagEndpointPreflight({
        contract: v5Contract,
        registration: v6,
        registrationPath: V6_REGISTRATION_PATH,
      }),
    /endpoint contract belongs to .*registration\.v5\.json/u,
  );
});

test('the per-move batch count is written twice, in two spellings, and the two agree', () => {
  // The GO checker compares the per-move count in the contract with the same
  // count in the registration. It built both keys by joining the level name to
  // a suffix, and the two files do not spell a key the same way: a contract key
  // is underscored, a registration key is camel-cased. So the checker asked the
  // registration for ask_questionPerBatch, which no registration carries, and
  // the comparison was between one absent value and another. It failed only
  // because the same line also required an integer. This test holds both
  // spellings still, so a rename on either side has to move them together.
  const v6 = loadV6();
  const contract = readJson(V6_CONTRACT_PATH);
  const batches = v6.executionReadiness.batches;
  const batchContract = contract.runner.batch_contract;
  const levels = v6.design.treatment.pedagogicalMoveLevels;
  assert.deepEqual(levels, ['ask_question', 'shrink_step']);
  assert.deepEqual(
    levels.map((level) => [`${level}_per_batch`, batchContract[`${level}_per_batch`]]),
    [
      ['ask_question_per_batch', 2],
      ['shrink_step_per_batch', 2],
    ],
  );
  assert.deepEqual(
    [
      ['askQuestionPerBatch', batches.askQuestionPerBatch],
      ['shrinkStepPerBatch', batches.shrinkStepPerBatch],
    ],
    [
      ['askQuestionPerBatch', 2],
      ['shrinkStepPerBatch', 2],
    ],
  );
  // Four dialogues a batch, one for each move-and-manner pair, nine batches.
  assert.equal(batches.askQuestionPerBatch + batches.shrinkStepPerBatch, batches.dialoguesPerBatch);
  assert.equal(batches.plainPerBatch + batches.warmPerBatch, batches.dialoguesPerBatch);
  assert.equal(batches.dialoguesPerBatch * batches.executionBatches, 36);
});
