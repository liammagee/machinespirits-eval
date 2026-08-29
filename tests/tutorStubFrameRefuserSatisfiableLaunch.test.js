// GUARD: the satisfiable-condition launch path — arm projection, compilation,
// route table, launch preflight, typed approval. Zero-call throughout: the
// route probes and role smokes are stubbed, so nothing here contacts a
// provider.
//
// The arm projection is where a study quietly stops being the study it
// registered. It lowers each version of the tutor onto the sealed parent's
// runtime design, and everything it fails to carry across is a silent revert
// to the sealed face-B behaviour. Two things matter most: the per-arm
// adjudication question must reach the enforcement seat, or the delivery gate
// judges the wrong thing; and the arm must carry THIS study's exhibit-minting
// persona, or the learner demands rule warrants again and the whole study is
// its own predecessor.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SATISFIABLE_CURRENT_REVISION,
  loadTutorStubResistantLearnerDesign,
  runTutorStubResistantLearnerCompilationPreflight,
  tutorStubFrameRefuserSatisfiableArmDesign,
  validateTutorStubResistantLearnerDesign,
} from '../services/tutorStubResistantLearnerCalibration.js';
import {
  buildTutorStubFrameRefuserSatisfiableApproval,
  runTutorStubFrameRefuserSatisfiablePreflight,
  tutorStubFrameRefuserSatisfiableRouteTable,
} from '../services/tutorStubFrameRefuserSatisfiableLaunch.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESIGN_PATH = 'config/tutor-stub-frame-refuser-satisfiable-design.v1.json';
const load = () => loadTutorStubResistantLearnerDesign({ designPath: DESIGN_PATH, root: REPO_ROOT });
const design = () => JSON.parse(fs.readFileSync(path.join(REPO_ROOT, DESIGN_PATH), 'utf8'));
const arm = (armId) => tutorStubFrameRefuserSatisfiableArmDesign(design(), armId, { root: REPO_ROOT });

// Stubs: the launch preflight's only two outward-facing steps.
const stubProbe = (route) => ({ status: 'passed_zero_call', modelRef: route.modelRef });
const stubSmoke = async (route) => ({ status: 'passed_zero_call_stub', role: route.role });
const preflight = () =>
  runTutorStubFrameRefuserSatisfiablePreflight({
    loaded: load(),
    root: REPO_ROOT,
    destination: path.join(REPO_ROOT, '.test-tmp', 'satisfiable-launch-preflight-destination'),
    destinationExists: () => false,
    probeRoute: stubProbe,
    smokeRole: stubSmoke,
  });

test('each arm carries its own registered move and adjudication question', () => {
  const treatment = arm('treatment');
  const reference = arm('reference');

  assert.equal(treatment.satisfiableExecution.registeredMoveId, 'exhibit_discharge');
  assert.equal(reference.satisfiableExecution.registeredMoveId, 'standing_conditions_bridge');
  assert.notEqual(treatment.intervention.action, reference.intervention.action);

  // The question must reach the enforcement seat on each arm. If it does not,
  // the delivery gate adjudicates the sealed face-B move on both arms and
  // reports a contrast that was never delivered.
  const questions = design().tutorDeliveryEnforcement.perArmAdjudication;
  assert.equal(treatment.tutorDeliveryContract.enforcement.check.question, questions.treatmentQuestion);
  assert.equal(reference.tutorDeliveryContract.enforcement.check.question, questions.referenceQuestion);
  assert.notEqual(
    treatment.tutorDeliveryContract.enforcement.check.question,
    reference.tutorDeliveryContract.enforcement.check.question,
  );

  // Both arms wait for the exhibit, and the arm says so rather than leaving
  // the runtime to re-derive it.
  for (const armDesign of [treatment, reference]) {
    assert.equal(
      armDesign.satisfiableExecution.deliveryTimingRule,
      'first_intervention_turn_at_or_after_the_demanded_exhibit_is_public',
    );
    assert.match(armDesign.tutorDeliveryContract.enforcement.scope, /at_or_after_the_demanded_exhibit_is_public/u);
  }
});

test('the arm projection carries the exhibit mint, not the sealed warrant one', () => {
  // The failure this catches: an arm that inherits the sealed face-B persona
  // mints rule warrants, so the learner demands the undischargeable thing the
  // whole study exists to remove — and nothing else would notice.
  for (const armId of ['treatment', 'reference']) {
    const armDesign = arm(armId);
    assert.equal(armDesign.population.profile, 'frame_refuser_exhibit-r2-rival-dag-v1');
    assert.equal(armDesign.rivalDagPersona.mint.openNodeKind, 'exhibit');
    // The concession condition stays the sealed one, resolved rather than
    // copied, so it cannot drift from face B.
    assert.equal(
      armDesign.rivalDagPersona.concessionCondition.matchingAlgorithm.id,
      'normalized_public_token_overlap_v1',
    );
    // The trigger registration is the sealed face-B one: this study shares the
    // standing-rivalry runtime path.
    assert.ok(armDesign.population.triggerRegistration.includes('merged-turn-gate-registration'));
  }
});

test('the reference arm keeps the sealed instruction bytes', () => {
  const reference = arm('reference');
  // The measured 0.114 base rate was taken on this text. The only registered
  // change to the reference arm is when it lands, never what it says.
  assert.ok(String(reference.tutorDeliveryContract.actionInstructions.test_bounded_distinction || '').trim());
  assert.equal(reference.intervention.action, 'test_bounded_distinction');
  // The treatment contract deliberately omits the compact instruction so the
  // compact text has one source rather than two copies that can drift.
  assert.deepEqual(Object.keys(arm('treatment').tutorDeliveryContract.actionInstructions), ['condition_discharge']);
});

test('both arms compile through the runtime with the right question and mint', () => {
  const compilation = runTutorStubResistantLearnerCompilationPreflight({ loaded: load(), root: REPO_ROOT });
  assert.equal(compilation.status, 'passed_zero_call');
  assert.equal(compilation.schema, 'machinespirits.tutor-stub.frame-refuser-satisfiable-compilation-preflight.v1');
  assert.equal(compilation.rows.length, 8, 'two arms x two worlds x two scenes');
  assert.equal(compilation.rival_dag_count, 48);
  assert.equal(compilation.model_calls, 0);
  assert.deepEqual(
    compilation.rows.filter((row) => !row.passed),
    [],
    'every compiled row must pass',
  );
  // The two arms must not compile to the same thing.
  const families = new Set(compilation.rows.map((row) => `${row.arm_id}:${row.host_action_family}`));
  assert.equal(families.size, 2, 'each arm compiles to its own host action family');
});

test('the route table covers every seat the run needs, on the sealed stack', () => {
  const routes = tutorStubFrameRefuserSatisfiableRouteTable(design(), { root: REPO_ROOT });
  for (const armId of ['treatment', 'reference']) {
    const armRoutes = routes.filter((route) => route.arm_id === armId);
    const roles = armRoutes.map((route) => route.role);
    for (const role of ['tutor', 'analysis', 'learner', 'tutor.delivery_repair']) {
      assert.ok(roles.includes(role), `${armId} must route ${role}`);
    }
    assert.ok(
      roles.some((role) => role.startsWith('trigger.')),
      `${armId} must route a trigger seat`,
    );
    assert.ok(
      roles.some((role) => role.startsWith('final.primary.')),
      `${armId} must route the endpoint panel`,
    );
    assert.ok(
      roles.some((role) => role.startsWith('tutor_delivery.')),
      `${armId} must route the delivery adjudication seat — without it the delivered-contrast floor is unmeasurable`,
    );
  }
  // The stack is held to the sealed one so the reference arm stays comparable.
  const models = new Set(routes.map((route) => route.modelRef));
  assert.ok(models.has('codex.gpt-5.6-luna'));
  assert.ok(![...models].some((modelRef) => /nemotron|kimi/u.test(modelRef)), 'the weak stack must never appear here');
});

test('the launch preflight passes zero-call and grants nothing', async () => {
  const result = await preflight();
  assert.equal(result.status, 'passed_zero_call');
  assert.equal(result.model_calls_executed, 0);
  assert.equal(result.production_writes, 0);
  assert.deepEqual(
    Object.entries(result.checks).filter(([, passed]) => !passed),
    [],
  );
  assert.equal(result.jobs, 48);
  assert.equal(result.planned_role_calls, 3072);
  assert.equal(result.hard_attempt_ceiling, 9504);
  // Passing the preflight is not authorization. It never was and must not
  // become one.
  assert.equal(design().callAuthority.grantsModelCalls, false);
  assert.equal(result.checks.grants_no_model_calls, true);
});

test('a superseded revision cannot be loaded, let alone launched', () => {
  // Revision 1's treatment move could not be delivered at all; rerunning it
  // would spend on a study known to fail its own delivery gate. The design
  // validator refuses it outright, so it never reaches the launch preflight —
  // which is why the preflight carries no revision check of its own. A check
  // there could only recompute its own expectation.
  const stale = { ...design(), revision: 1 };
  const result = validateTutorStubResistantLearnerDesign(stale);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => /design identity is unsupported/u.test(issue)));
  assert.equal(SATISFIABLE_CURRENT_REVISION, 2);
});

test('a destination that already exists stops the launch', async () => {
  const result = await runTutorStubFrameRefuserSatisfiablePreflight({
    loaded: load(),
    root: REPO_ROOT,
    destination: '/tmp/already-there',
    destinationExists: () => true,
    probeRoute: stubProbe,
    smokeRole: stubSmoke,
  });
  assert.equal(result.checks.destination_absent, false);
  assert.equal(result.status, 'failed');
});

test('the typed approval demands the exact phrase and authorizes calibration only', async () => {
  const result = await preflight();
  const approval = buildTutorStubFrameRefuserSatisfiableApproval({
    signedBy: 'operator',
    approvalPhrase: `APPROVE CALIBRATION ${result.hard_attempt_ceiling}`,
    preflight: result,
  });
  assert.equal(approval.calibration_only, true);
  assert.equal(approval.powered_run_authorized, false);
  assert.equal(approval.attended, true);
  assert.equal(approval.create_once, true);
  assert.equal(approval.hard_attempt_ceiling, 9504);

  // A near-miss phrase is not approval, and neither is an unsigned one.
  assert.throws(
    () =>
      buildTutorStubFrameRefuserSatisfiableApproval({
        signedBy: 'operator',
        approvalPhrase: 'APPROVE CALIBRATION',
        preflight: result,
      }),
    /must be exactly/u,
  );
  assert.throws(
    () =>
      buildTutorStubFrameRefuserSatisfiableApproval({
        signedBy: '   ',
        approvalPhrase: `APPROVE CALIBRATION ${result.hard_attempt_ceiling}`,
        preflight: result,
      }),
    /operator name/u,
  );
});
