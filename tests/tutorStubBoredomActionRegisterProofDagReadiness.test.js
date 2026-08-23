import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  boredomContrastAxis,
  boredomRegisteredSizes,
  buildTutorStubBoredomProofDagPlan,
  buildTutorStubBoredomProofDagSyntheticCases,
  assembleTutorStubBoredomProofDagPreflight,
  exactBlockedScoreOneSidedPValue,
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
  tutorStubResistanceHostActionFamily,
} from '../services/tutorStubResistanceActionRegisterStudy.js';
import { compileTutorStubTurnProgressionContract } from '../services/tutorStubTurnProgressionContract.js';
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

const V7_REGISTRATION_PATH = 'config/tutor-stub-boredom-action-register-proof-dag-registration.v7.json';
const V7_CONTRACT_PATH = 'config/paid-study-endpoints/tutor-stub-boredom-action-register-proof-dag.v7.json';
const V7_CERTIFICATE_PATH =
  'config/paid-study-endpoints/tutor-stub-boredom-action-register-proof-dag.v7.endpoint-go.json';

function loadV7() {
  return loadTutorStubBoredomProofDagRegistration({ root: ROOT, registrationPath: V7_REGISTRATION_PATH });
}

test('v7 registers a one-sided test that cannot reject in the other direction', () => {
  const v7 = loadV7();
  const primary = v7.measurement.primaryEndpoint;
  assert.equal(primary.analysis, 'one_sided_exact_conditional_blocked_score_test');
  assert.equal(primary.direction, 'treatment_greater_than_reference');
  assert.equal(primary.definitionChangedFromV6, false);
  assert.equal(v7.measurement.keySecondaryEndpoint.direction, 'treatment_greater_than_reference');

  // Six worlds, seven per move in each. The treatment side wins every world,
  // which is the extreme of the registered direction, so the one-sided test
  // must be far below alpha and the two-sided one must agree.
  // The block fields keep the v1 spelling: plain is the reference side and warm
  // is the treatment side. v6 moved what those two sides are without renaming
  // the fields, so the names read oddly and the meaning is fixed by the
  // function's own contract.
  const allTreatment = Array.from({ length: 6 }, () => ({
    plainN: 7,
    warmN: 7,
    plainSuccesses: 0,
    warmSuccesses: 7,
  }));
  const oneSidedFor = exactBlockedScoreOneSidedPValue(allTreatment);
  assert.ok(oneSidedFor < 0.0001, `expected a tiny p, got ${oneSidedFor}`);

  // The same margin the other way. A two-sided test would reject it just as
  // hard; the registered one-sided test must refuse to reject at all. This is
  // the price the approval sentence has to state.
  const allReference = allTreatment.map((block) => ({
    ...block,
    plainSuccesses: 7,
    warmSuccesses: 0,
  }));
  // The upper tail then holds the whole distribution, so the p is 1 up to the
  // rounding a sum of many probabilities carries.
  assert.ok(exactBlockedScoreOneSidedPValue(allReference) > 0.9999);
  assert.ok(exactBlockedScorePValue(allReference) < 0.0001);

  // A dead heat sits well above alpha on both.
  const evenBlocks = allTreatment.map((block) => ({
    ...block,
    plainSuccesses: 3,
    warmSuccesses: 3,
  }));
  assert.ok(exactBlockedScoreOneSidedPValue(evenBlocks) > 0.05);

  // The one-sided p is never above the two-sided one on a result that runs the
  // registered way, which is the whole reason for the switch.
  const v6Shaped = Array.from({ length: 6 }, () => ({
    plainN: 7,
    warmN: 7,
    plainSuccesses: 3,
    warmSuccesses: 5,
  }));
  assert.ok(exactBlockedScoreOneSidedPValue(v6Shaped) <= exactBlockedScorePValue(v6Shaped));
});

test('v7 splits the one manner floor into an obedience floor and a legibility floor', () => {
  const v7 = loadV7();
  const fidelity = v7.measurement.treatmentFidelity;
  assert.equal(fidelity.minimumAssignedRegisterDelivery, 0.9);
  assert.equal(fidelity.minimumRegisterReadability, 0.8);
  assert.equal(fidelity.minimumRegisterVisibility, undefined);
  assert.equal(fidelity.registerFloorSplitFromV6, true);
  assert.equal(fidelity.bothRegisterRatesMustBeReported, true);
  assert.equal(fidelity.failedFidelityDisposition, 'fail_interpretability_gate_not_rerun');
  // The split must never read as a rescue of the run that failed the merged
  // floor, so the registration has to say what v6 would have scored and that
  // v6 stays closed either way.
  assert.match(fidelity.registerFloorSplitAppliesToV7Only, /v6 is not rescored/u);
  assert.match(fidelity.registerFloorSplitAppliesToV7Only, /at least 0\.889/u);
  assert.match(fidelity.registerFloorSplitAppliesToV7Only, /0\.0858/u);
  // v6 kept one floor for both facts.
  const v6 = loadV6();
  assert.equal(v6.measurement.treatmentFidelity.minimumRegisterVisibility, 0.9);
  assert.equal(v6.measurement.treatmentFidelity.minimumRegisterReadability, undefined);
});

test('v7 rows must carry the two manner facts apart and the merged flag must be their conjunction', () => {
  const v7 = loadV7();
  const contract = readJson(V7_CONTRACT_PATH);
  const cases = buildTutorStubBoredomProofDagSyntheticCases(v7);
  const status = (rows) => assembleTutorStubBoredomProofDagPreflight({ cases: rows, contract }).endpoint_status;
  assert.equal(status(cases).action_register_fidelity_and_safety, 'complete');

  // A run that emits only the merged flag is the defect this split exists to
  // catch. It must not pass.
  const mergedOnly = cases.map((row, index) =>
    index === 0
      ? {
          ...row,
          fidelity: {
            ...row.fidelity,
            register_delivered_as_designed: undefined,
            register_readable: undefined,
          },
        }
      : row,
  );
  assert.notEqual(status(mergedOnly).action_register_fidelity_and_safety, 'complete');

  // A merged flag that is not exactly the two together is a third opinion
  // written beside them, so it fails too.
  const inconsistent = cases.map((row, index) =>
    index === 0 ? { ...row, fidelity: { ...row.fidelity, register_readable: false } } : row,
  );
  assert.notEqual(status(inconsistent).action_register_fidelity_and_safety, 'complete');
});

test('v7 plans 84 dialogues over 21 batches with every count read from the registration', () => {
  const v7 = loadV7();
  const sizes = boredomRegisteredSizes(v7);
  const batches = v7.executionReadiness.batches;
  const dialogue = v7.executionReadiness.dialogue;
  assert.equal(dialogue.dialogues, 84);
  assert.equal(batches.executionBatches, 21);
  assert.equal(batches.dialoguesPerBatch, 4);
  assert.equal(batches.dialoguesPerBatch * batches.executionBatches, dialogue.dialogues);
  assert.equal(batches.askQuestionPerBatch + batches.shrinkStepPerBatch, batches.dialoguesPerBatch);
  assert.equal(batches.plainPerBatch + batches.warmPerBatch, batches.dialoguesPerBatch);

  const plan = buildTutorStubBoredomProofDagPlan(v7);
  assert.equal(plan.jobs.length, dialogue.dialogues);
  assert.equal(new Set(plan.jobs.map((job) => job.id)).size, dialogue.dialogues);
  assert.equal(new Set(plan.jobs.map((job) => job.batch_id)).size, batches.executionBatches);
  assert.equal(plan.assignment_manifest_sha256, v7.design.randomization.assignmentManifestSha256);

  // 42 a move, 42 a manner, and 21 in each of the four move-and-manner cells.
  const count = (field, value) => plan.jobs.filter((job) => job[field] === value).length;
  assert.equal(count('pedagogical_move_level', 'ask_question'), sizes.perMove);
  assert.equal(count('pedagogical_move_level', 'shrink_step'), sizes.perMove);
  assert.equal(count('realization', 'plain'), sizes.perManner);
  assert.equal(count('realization', 'warm'), sizes.perManner);
  for (const move of ['ask_question', 'shrink_step']) {
    for (const manner of ['plain', 'warm']) {
      const cell = plan.jobs.filter((job) => job.pedagogical_move_level === move && job.realization === manner);
      assert.equal(cell.length, dialogue.dialogues / 4, `${move}/${manner}`);
      // Seven per world in each cell, so no world carries an unbalanced cell.
      const perWorld = new Map();
      for (const job of cell) perWorld.set(job.world, (perWorld.get(job.world) || 0) + 1);
      assert.equal(perWorld.size, v7.design.worlds.length);
    }
  }

  // No seed is reused from v6, so no v7 dialogue can replay a v6 one.
  const v6Seed = loadV6().design.freshPrefixGeneration.seedBase;
  assert.notEqual(v7.design.freshPrefixGeneration.seedBase, v6Seed);
});

test('v7 endpoint preflight, contract, and certificate agree at zero calls', () => {
  const v7 = loadV7();
  const contract = readJson(V7_CONTRACT_PATH);
  assert.equal(contract.registration.registration_sha256, fileSha256(V7_REGISTRATION_PATH));
  assert.equal(contract.runner.batch_contract.required_batches.length, v7.executionReadiness.batches.executionBatches);
  assert.equal(contract.registration.required_distinct_prefixes, v7.executionReadiness.dialogue.dialogues);

  const preflight = runTutorStubBoredomProofDagEndpointPreflight({
    contract,
    registration: v7,
    registrationPath: V7_REGISTRATION_PATH,
  });
  assert.equal(preflight.status, 'passed');
  assert.equal(preflight.model_calls, 0);
  assert.equal(preflight.production_writes, 0);
  assert.equal(preflight.readiness.contract_binding.registration_bytes_match_contract, true);
  assert.equal(preflight.readiness.hard_study_attempt_ceiling, v7.executionReadiness.dialogue.maximumReservations);
  assert.equal(preflight.readiness.execution_batches, v7.executionReadiness.batches.executionBatches);
  assert.equal(preflight.readiness.independent_dialogues, v7.executionReadiness.dialogue.dialogues);
  for (const endpoint of contract.endpoints) {
    assert.equal(preflight.assembly_audit.endpoint_status[endpoint.id], 'complete', endpoint.id);
  }

  const { report } = assembleTutorStubBoredomProofDagPreflight({
    cases: buildTutorStubBoredomProofDagSyntheticCases(v7),
    contract,
  });
  const sizes = boredomRegisteredSizes(v7);
  assert.equal(report.distinct_fresh_prefixes, sizes.dialogues);
  // Two moves by two manners, and every one of the four cells the same size.
  assert.equal(report.manner_block.length, 4);
  assert.ok(report.manner_block.every((cell) => cell.units === sizes.dialogues / 4));

  const certificate = readJson(V7_CERTIFICATE_PATH);
  const certificateValidation = validatePaidStudyEndpointGoCertificate({ contract, preflight, certificate });
  assert.equal(certificateValidation.ok, true, certificateValidation.errors.join('; '));
  assert.equal(certificate.contract_sha256, hashPaidStudyEndpointValue(contract));
  assert.match(certificate.authorization_scope, /authorizes no confirmation-model call/u);
});

test('v7 records that the safeguard, not the effect, set the sample size', () => {
  const v7 = loadV7();
  const ceiling = v7.executionReadiness.programmeCeiling;
  assert.equal(ceiling.ledgerBeforeV7, 3008);
  assert.equal(ceiling.v7Maximum, 10332);
  assert.equal(ceiling.requiredCeiling, ceiling.ledgerBeforeV7 + ceiling.v7Maximum);
  assert.ok(ceiling.requiredCeiling <= ceiling.programmeSafeguard);
  assert.equal(ceiling.headroom, ceiling.programmeSafeguard - ceiling.requiredCeiling);
  // The registration says attempt accounting is an operational safeguard and
  // must not set the design. Here it did, and the registration has to say so
  // rather than round it away.
  assert.match(v7.executionReadiness.attemptAccountingRole, /operational/u);
  assert.match(ceiling.theSafeguardNowBindsTheDesign, /setting the sample size/u);

  // The planning scenario falls short of the stated target and the registration
  // records both numbers.
  assert.equal(v7.power.targetPower, 0.8);
  assert.equal(v7.power.targetPowerReached, false);
  const planning = v7.power.powerTable.find((row) => /planning scenario/u.test(row.scenario));
  assert.ok(planning, 'the planning scenario must be named in the power table');
  assert.equal(planning.perMove, 42);
  assert.ok(planning.oneSidedPower > planning.twoSidedPower);
  assert.ok(planning.oneSidedPower < v7.power.targetPower);
});

const V8_REGISTRATION_PATH = 'config/tutor-stub-boredom-action-register-proof-dag-registration.v8.json';

function loadV8() {
  return loadTutorStubBoredomProofDagRegistration({ root: ROOT, registrationPath: V8_REGISTRATION_PATH });
}

test('v8 gives its two arms different host families, so they compile to different question permissions', () => {
  const v8 = loadV8();
  const treatment = v8.design.treatment;
  assert.deepEqual(treatment.pedagogicalMoveLevels, ['carry_on', 'ask_question']);
  assert.equal(treatment.reference, 'carry_on');
  assert.equal(treatment.treatment, 'ask_question');
  // v6 and v7 named one family for both arms. v8 must not, and must not leave
  // the field lying around either.
  assert.equal(treatment.hostActionFamily, undefined);
  assert.equal(treatment.hostActionFamilySharedByBothLevels, false);

  // The families the registration declares must be the ones the study code
  // actually returns. This is the pair of copies v7 never compared.
  for (const level of treatment.pedagogicalMoveLevels) {
    const move = treatment.pedagogicalMoves[level];
    assert.equal(treatment.hostActionFamilyByLevel[level], tutorStubResistanceHostActionFamily(move), level);
  }

  // And the separation has to produce the behaviour it was made for. Compile
  // the real turn-progression contract for each arm and read the permission.
  const base = {
    learnerText: 'I suppose so. It is all a bit much and I have rather lost the thread of it.',
    publicQuestion: 'Which entry in the delivery ledger covers the third week?',
    responseCompositionFrame: {
      discourse_plane: { plane: 'inquiry' },
      learner_move: { evidence_use: 'none' },
      learner_dag: { bottleneck: null, final_secret_entailed: false, asserted_secret: false },
    },
    questionSupport: null,
  };
  const permissionFor = (level) =>
    compileTutorStubTurnProgressionContract({
      ...base,
      actionFamily: treatment.hostActionFamilyByLevel[level],
    }).handoff_contract?.question_allowed;
  assert.equal(permissionFor('ask_question'), true);
  assert.equal(permissionFor('carry_on'), false);

  // v7's own pair, for contrast: one family, so one permission, so one arm.
  const v7 = loadV7();
  const v7Families = v7.design.treatment.pedagogicalMoveLevels.map((level) =>
    tutorStubResistanceHostActionFamily(v7.design.treatment.pedagogicalMoves[level]),
  );
  assert.equal(new Set(v7Families).size, 1);
});

test('a v8 registration whose arms compile alike is refused', () => {
  const v8 = loadV8();
  assert.equal(validateTutorStubBoredomProofDagRegistration(v8).ok, true);

  // Put the reference arm back on v7's family. Nothing else changes, and the
  // registration still reads as a two-arm move contrast, but the two arms now
  // earn the same handoff. That is the state v7 shipped in and the preflight
  // must refuse it.
  const blurred = structuredClone(v8);
  blurred.design.treatment.pedagogicalMoves.carry_on = 'ask_discriminating_question';
  blurred.design.treatment.hostActionFamilyByLevel.carry_on = 'stage_next_step';
  const refused = validateTutorStubBoredomProofDagRegistration(blurred);
  assert.equal(refused.ok, false);
  assert.ok(
    refused.errors.some((error) => /compile to the same question permission/u.test(error)),
    `expected the arms-alike refusal, got ${refused.errors.join('; ')}`,
  );

  // A declared family that disagrees with what the study code returns is
  // refused too, whichever way round the disagreement runs.
  const mislabelled = structuredClone(v8);
  mislabelled.design.treatment.hostActionFamilyByLevel.carry_on = 'stage_next_step';
  assert.equal(validateTutorStubBoredomProofDagRegistration(mislabelled).ok, false);
});

test('v8 makes the delivered contrast the floor and labels the two echoed gates as echoes', () => {
  const v8 = loadV8();
  const fidelity = v8.measurement.treatmentFidelity;
  assert.equal(fidelity.minimumMoveContrastDelivery, 0.9);
  assert.deepEqual(fidelity.deliveredContrastByMove, {
    ask_discriminating_question: 'requires_question',
    stage_public_evidence_for_next_step: 'forbids_question',
  });
  // Every move the design assigns must have a contrast rule, or a unit could
  // pass a floor that never looked at it.
  for (const move of Object.values(v8.design.treatment.pedagogicalMoves)) {
    assert.ok(fidelity.deliveredContrastByMove[move], move);
  }

  // The two echoes are kept, pinned at 1, and named as echoes. At 1 they say
  // no safety override replaced what was assigned; below 1 they would read like
  // a measurement of the tutor, which is how v7 misread its own 1.00.
  assert.equal(fidelity.minimumAssignedMoveDelivery, 1);
  assert.equal(fidelity.minimumAssignedRegisterDelivery, 1);
  assert.match(fidelity.echoedGatesMayNotBeReportedAsReadings, /echoes, not readings/u);
  assert.ok(
    v8.measurement.mandatoryDisclosures.some((line) => /echoes of the study own instruction/u.test(line)),
    'the report must have to say that the echoed gates read nothing',
  );

  // A v8 that drops the delivered-contrast floor, or that lowers an echo so it
  // looks like a reading, is refused.
  for (const damage of [
    (draft) => delete draft.measurement.treatmentFidelity.minimumMoveContrastDelivery,
    (draft) => delete draft.measurement.treatmentFidelity.deliveredContrastByMove,
    (draft) => {
      draft.measurement.treatmentFidelity.minimumAssignedMoveDelivery = 0.9;
    },
  ]) {
    const draft = structuredClone(v8);
    damage(draft);
    assert.equal(validateTutorStubBoredomProofDagRegistration(draft).ok, false);
  }
});

test('v8 reads both directions, so the reference arm winning is a finding', () => {
  const v8 = loadV8();
  const primary = v8.measurement.primaryEndpoint;
  assert.equal(primary.analysis, 'two_sided_exact_conditional_blocked_score_test');
  assert.equal(primary.direction, 'either_direction');
  assert.equal(primary.analysisChangedFromV7, true);
  assert.equal(primary.analysisV7Value, 'one_sided_exact_conditional_blocked_score_test');
  assert.match(v8.claimBoundary, /two-sided/u);
  assert.match(primary.directionRule, /not written down as a null/u);

  // The margin v7's one-sided test had to ignore. Six worlds, six per arm, the
  // reference arm winning every world: v7 would have returned a p near 1 and
  // reported nothing; v8's test rejects.
  const allReference = Array.from({ length: 6 }, () => ({
    plainN: 6,
    warmN: 6,
    plainSuccesses: 6,
    warmSuccesses: 0,
  }));
  assert.ok(exactBlockedScoreOneSidedPValue(allReference) > 0.9999);
  assert.ok(exactBlockedScorePValue(allReference) < 0.0001);

  // A registration that keeps a direction while claiming two sides is refused.
  const directed = structuredClone(v8);
  directed.measurement.primaryEndpoint.direction = 'treatment_greater_than_reference';
  assert.equal(validateTutorStubBoredomProofDagRegistration(directed).ok, false);
});

test('v8 plans 72 dialogues over 18 batches, balanced in every arm-and-manner cell', () => {
  const v8 = loadV8();
  const sizes = boredomRegisteredSizes(v8);
  const batches = v8.executionReadiness.batches;
  const dialogue = v8.executionReadiness.dialogue;
  assert.equal(dialogue.dialogues, 72);
  assert.equal(batches.executionBatches, 18);
  assert.equal(batches.dialoguesPerBatch, 4);
  assert.equal(batches.carryOnPerBatch + batches.askQuestionPerBatch, batches.dialoguesPerBatch);
  assert.equal(batches.plainPerBatch + batches.warmPerBatch, batches.dialoguesPerBatch);

  const plan = buildTutorStubBoredomProofDagPlan(v8);
  assert.equal(plan.jobs.length, 72);
  assert.equal(new Set(plan.jobs.map((job) => job.id)).size, 72);
  assert.equal(new Set(plan.jobs.map((job) => job.seed)).size, 72);
  assert.equal(plan.assignment_manifest_sha256, v8.design.randomization.assignmentManifestSha256);
  assert.equal(plan.total_maximum_model_attempt_reservations, v8.executionReadiness.hardStudyAttemptCeiling);

  // 36 an arm, 36 a manner, 18 in each of the four cells, three of each cell in
  // every world. Twelve a world divides by four, which is why v8 needs only one
  // pattern where v7 needed a mirrored pair.
  const count = (field, value) => plan.jobs.filter((job) => job[field] === value).length;
  assert.equal(count('pedagogical_move_level', 'carry_on'), sizes.perMove);
  assert.equal(count('pedagogical_move_level', 'ask_question'), sizes.perMove);
  assert.equal(count('realization', 'plain'), sizes.perManner);
  assert.equal(count('realization', 'warm'), sizes.perManner);
  assert.equal(Object.keys(v8.design.randomization.worldPatterns).length, 1);
  for (const level of ['carry_on', 'ask_question']) {
    for (const manner of ['plain', 'warm']) {
      const cell = plan.jobs.filter((job) => job.pedagogical_move_level === level && job.realization === manner);
      assert.equal(cell.length, 18, `${level}/${manner}`);
      const perWorld = new Map();
      for (const job of cell) perWorld.set(job.world, (perWorld.get(job.world) || 0) + 1);
      assert.equal(perWorld.size, v8.design.worlds.length);
      for (const [world, held] of perWorld) assert.equal(held, 3, `${level}/${manner} in ${world}`);
    }
  }

  // Every batch holds one of each cell, so stopping after any batch leaves both
  // the contrast and the manner balance even.
  for (const batch of plan.batches) {
    assert.equal(batch.cases, 4);
    assert.equal(batch.carry_on, 2);
    assert.equal(batch.ask_question, 2);
    assert.equal(batch.plain, 2);
    assert.equal(batch.warm, 2);
  }
});

test('a prefix seed range that meets a spent version is refused', () => {
  const v8 = loadV8();
  const base = v8.design.freshPrefixGeneration.seedBase;
  assert.equal(base, 2026112200);

  // Every version since v5 has written down that its seeds meet no prior
  // version's, and until v8 nothing read those fields. Move v8 onto v7's base
  // and the check must fire: v7 is charged against the safeguard as v7Spend, so
  // its prefixes are spent and may not be regenerated.
  const collided = structuredClone(v8);
  collided.design.freshPrefixGeneration.seedBase = loadV7().design.freshPrefixGeneration.seedBase;
  const refused = validateTutorStubBoredomProofDagRegistration(collided);
  assert.equal(refused.ok, false);
  assert.ok(
    refused.errors.some((error) => /meet spent v7's/u.test(error)),
    `expected the spent-seed refusal, got ${refused.errors.join('; ')}`,
  );

  // v6 and v5 are charged too, so their ranges are guarded on the same terms.
  for (const spent of [5, 6]) {
    const draft = structuredClone(v8);
    draft.design.freshPrefixGeneration.seedBase = loadTutorStubBoredomProofDagRegistration({
      root: ROOT,
      registrationPath: `config/tutor-stub-boredom-action-register-proof-dag-registration.v${spent}.json`,
    }).design.freshPrefixGeneration.seedBase;
    const result = validateTutorStubBoredomProofDagRegistration(draft);
    assert.ok(
      result.errors.some((error) => new RegExp(`meet spent v${spent}'s`, 'u').test(error)),
      `v${spent} range must be guarded`,
    );
  }

  // The check is tied to the ledger, not to a list kept here: drop v7's spend
  // and v7's seeds stop being guarded, which is the coupling that stops the two
  // rules drifting apart.
  const unledgered = structuredClone(collided);
  delete unledgered.executionReadiness.programmeCeiling.v7Spend;
  const loosened = validateTutorStubBoredomProofDagRegistration(unledgered);
  assert.ok(!loosened.errors.some((error) => /meet spent v7's/u.test(error)));
});

test('v8 records that the safeguard, not the effect, set the sample size', () => {
  const v8 = loadV8();
  const ceiling = v8.executionReadiness.programmeCeiling;
  assert.equal(ceiling.ledgerBeforeV8, 4684);
  assert.equal(ceiling.v8Maximum, 8856);
  assert.equal(ceiling.requiredCeiling, ceiling.ledgerBeforeV8 + ceiling.v8Maximum);
  assert.equal(ceiling.headroom, ceiling.programmeSafeguard - ceiling.requiredCeiling);
  assert.ok(ceiling.requiredCeiling <= ceiling.programmeSafeguard);

  // The size v7 ran no longer fits, and the registration must say so rather
  // than quietly lowering the per-dialogue ceiling to make it fit.
  const v7Size = v8.power.sizesConsidered.find((row) => row.dialogues === 84);
  assert.ok(v7Size, '84 must be considered and rejected on the record');
  assert.ok(v7Size.ledgerPlusCeiling > ceiling.programmeSafeguard);
  assert.equal(v7Size.chosen, undefined);
  assert.match(v8.power.positionForV8.whyRunItAtThisSize, /15016/u);
  assert.match(ceiling.theSafeguardNowBindsTheDesign, /refused/u);

  // The reference rate has no prior at all, so the table carries the whole scan
  // and at least one row falls short of the target. Reporting only the friendly
  // rows would be the misreading the position field exists to stop.
  assert.equal(v8.power.referenceRate.measured, false);
  assert.equal(v8.power.targetPowerReached, false);
  assert.ok(v8.power.powerTable.length >= 4);
  assert.ok(v8.power.powerTable.some((row) => row.twoSidedPower < 0.5));
  assert.ok(v8.power.powerTable.every((row) => row.perArm === 36 && row.dialogues === 72));
  assert.match(v8.power.positionForV8.whatANullWouldMean, /not license/u);
  assert.match(v8.power.positionForV8.whatAReversalWouldMean, /reportable/u);
});

test('the delivered-contrast preflight now compiles both arms with a due public clue', () => {
  const v8 = loadV8();
  // v8's own preflight proved its contrast on one made-up scene with no due
  // clue. On that scene the reference family does forbid a question, so the
  // contrast certified. In the run a clue was due on 7 of 33 reference turns,
  // the due-source branch outranked the family there, and the delivered-contrast
  // gate failed at 0.788 against a floor of 0.90. The registration is unchanged;
  // what changed is that the check now runs the harder scene too.
  assert.equal(validateTutorStubBoredomProofDagRegistration(v8).ok, true);

  const frame = {
    discourse_plane: { plane: 'inquiry' },
    learner_move: { evidence_use: 'none' },
    learner_dag: { bottleneck: null, final_secret_entailed: false, asserted_secret: false },
    due_evidence_surfaces: ['The third-week ledger entry records two deliveries, not one.'],
  };
  const scene = {
    learnerText: 'I suppose so. It is all a bit much and I have rather lost the thread of it.',
    publicQuestion: 'Which entry in the delivery ledger covers the third week?',
    responseCompositionFrame: frame,
  };
  const families = v8.design.treatment.hostActionFamilyByLevel;
  const rules = v8.measurement.treatmentFidelity.deliveredContrastByMove;
  const moves = v8.design.treatment.pedagogicalMoves;

  const permission = (level) =>
    compileTutorStubTurnProgressionContract({
      ...scene,
      actionFamily: families[level],
      registeredQuestionRule: rules[moves[level]],
    }).handoff_contract.question_allowed;

  assert.equal(permission(v8.design.treatment.treatment), true);
  assert.equal(permission(v8.design.treatment.reference), false);

  // Drop the rule and the reference arm asks a question on the same scene.
  // That is the failure the preflight has to be able to see.
  assert.equal(
    compileTutorStubTurnProgressionContract({
      ...scene,
      actionFamily: families[v8.design.treatment.reference],
    }).handoff_contract.question_allowed,
    true,
  );
});
