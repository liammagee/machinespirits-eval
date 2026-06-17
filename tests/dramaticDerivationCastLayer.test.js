import assert from 'node:assert/strict';
import test from 'node:test';
import {
  auditCastLayerPublicInput,
  CAST_LAYER_SCHEMA,
  CAST_REINVENTION_TRIGGERS,
  deriveCastState,
  projectCastStateForRole,
  TUTOR_REINVENTION_SCHEMA,
} from '../services/dramaticDerivation/index.js';

const HETHEL_CAST = Object.freeze({
  tutor: {
    role: 'master of works',
    public_identity: 'a bridge-mason retained by the assize',
    temperament: ['spare', 'exact', 'patient under pressure'],
    pedagogical_habit: 'reads material traces before accepting testimony',
    recognition_style: 'credits quickness, then slows it',
    default_stance: 'craft examiner',
    risks: ['can become too terse when the learner needs reassurance', 'may mistake speed for ownership'],
  },
  learner: {
    role: "bridge-warden's young clerk",
    public_identity: 'keeps the assize-book under civic pressure',
    level: 'novice but numerate',
    prior_bias: 'trusts official bond and town verdict',
    temperament: ['quick', 'anxious', 'eager to close'],
    recognition_need: 'needs their speed acknowledged before being slowed',
    likely_failure: 'turns liability into causation',
    phatic_style: 'short assent, then premature entry',
  },
  relation: {
    frame: 'apprenticeship under public pressure',
    power_gradient: 'high but not hostile',
    stakes: 'the record becomes civic judgment',
    trust_baseline: 'working but untested',
  },
});

test('cast layer exposes the bounded reinvention trigger vocabulary', () => {
  assert.deepEqual([...CAST_REINVENTION_TRIGGERS].sort(), [
    'defensive_after_correction',
    'didactic_failure',
    'echo_without_ownership',
    'recognition_pressure_unresolved',
    'repeated_same_object_repair',
    'scene_needs_repair',
  ]);
});

test('cast layer audit rejects forbidden proof-state inputs recursively', () => {
  const audit = auditCastLayerPublicInput({
    worldCast: HETHEL_CAST,
    proofPath: ['p_point', 'p_surface'],
    learnerState: {
      hiddenBoard: [['failedAt', 'hethelSpan', 'crownJoint']],
      nested: { D: 3, premiseId: 'p_point', predicateName: 'felledBy' },
    },
  });

  assert.equal(audit.ok, false);
  assert.deepEqual(
    audit.leaks.map((leak) => leak.key).sort(),
    ['D', 'hiddenBoard', 'predicateName', 'premiseId', 'proofPath'],
  );

  const state = deriveCastState({
    worldCast: HETHEL_CAST,
    releaseSchedule: [{ turn: 4, premise: 'p_point' }],
  });
  assert.equal(state.schema, CAST_LAYER_SCHEMA);
  assert.equal(state.publicOnly, true);
  assert.equal(state.mayOverrideProofControl, false);
  assert.equal(state.inputAudit.ok, false);
  assert.match(JSON.stringify(state), /input rejected/u);
  assert.doesNotMatch(JSON.stringify(state), /p_point/u);
});

test('static authored cast normalizes public roles and projections without reinvention', () => {
  const state = deriveCastState({
    worldCast: HETHEL_CAST,
    worldSetting: 'The assize sits under public pressure.',
    worldLearnerVoice: "The bridge-warden's clerk is quick to close the book.",
    transcript: [{ turn: 1, role: 'learner', text: 'I think the bond names the answer.' }],
    reinventionEnabled: false,
  });

  assert.equal(state.schema, CAST_LAYER_SCHEMA);
  assert.equal(state.publicOnly, true);
  assert.equal(state.mayOverrideProofControl, false);
  assert.equal(state.proofControlAuthority, 'none');
  assert.equal(state.tutor.stableRole, 'master of works');
  assert.equal(state.tutor.currentStance, 'craft examiner');
  assert.equal(state.learner.stableRole, "bridge-warden's young clerk");
  assert.equal(state.learner.currentPosture, 'ordinary');
  assert.equal(state.relation.frame, 'apprenticeship under public pressure');
  assert.equal(state.reinvention, null);
  assert.equal(state.inputAudit.ok, true);
  assert.equal(state.nonLeakAudit.ok, true);

  const tutorLines = projectCastStateForRole(state, 'tutor');
  const learnerLines = projectCastStateForRole(state, 'learner');
  const directorLines = projectCastStateForRole(state, 'director');
  const superegoLines = projectCastStateForRole(state, 'tutor_superego');

  assert.ok(tutorLines.some((line) => /current stance: craft examiner/u.test(line)));
  assert.ok(learnerLines.some((line) => /bridge-warden's young clerk/u.test(line)));
  assert.ok(directorLines.some((line) => /Relation: apprenticeship/u.test(line)));
  assert.ok(superegoLines.some((line) => /Audit tutor stance/u.test(line)));
  assert.doesNotMatch(learnerLines.join('\n'), /reinvention audit|forbidden changes|proof-control/u);
});

test('fluent echo activates bounded tutor reinvention without proof-control authority', () => {
  const state = deriveCastState({
    worldCast: HETHEL_CAST,
    turn: 9,
    transcript: [{ turn: 8, role: 'learner', text: 'As you said, liability is the phrase to keep.' }],
    discursiveCalibration: {
      publicOnly: true,
      publicPosture: 'fluent_echo',
      uptakeQuality: 'echo_only',
      conversationalStrain: { level: 'medium' },
      recognitionPressure: { active: false, level: null, desiredActs: [] },
    },
    didacticMode: {
      publicOnly: true,
      mayOverrideProofControl: false,
      learningSignal: 'echo_only',
      recommendedMode: 'teach_back',
      currentObject: 'the liability and causation distinction',
      scope: 'scene',
    },
  });

  assert.equal(state.reinvention.schema, TUTOR_REINVENTION_SCHEMA);
  assert.equal(state.reinvention.active, true);
  assert.equal(state.reinvention.trigger, 'echo_without_ownership');
  assert.equal(state.reinvention.fromStance, 'craft examiner');
  assert.equal(state.reinvention.toStance, 'co-investigator');
  assert.equal(state.tutor.currentStance, 'co-investigator');
  assert.equal(state.reinvention.mayOverrideProofControl, false);
  assert.equal(state.reinvention.proofControlAuthority, 'none');
  assert.deepEqual(state.reinvention.allowedChanges, ['tone', 'figure', 'tempo', 'example_style', 'recognition_act']);
  assert.ok(state.reinvention.forbiddenChanges.includes('release_timing'));
  assert.ok(state.reinvention.forbiddenChanges.includes('proof_target'));
  assert.equal(state.nonLeakAudit.ok, true);

  const tutorLines = projectCastStateForRole(state, 'tutor');
  assert.ok(tutorLines.some((line) => /Tutor reinvention active: craft examiner -> co-investigator/u.test(line)));
  assert.ok(tutorLines.some((line) => /Forbidden changes: release_timing/u.test(line)));
});

test('repeated same-object repair chooses repair-and-rebuild guide and preserves target neutrality', () => {
  const state = deriveCastState({
    worldCast: HETHEL_CAST,
    turn: 12,
    transcript: [
      { turn: 10, role: 'learner', text: 'No, sorry, I lost the break-point again.' },
      { turn: 11, role: 'tutor', text: 'Let us put the break-point back in view.' },
    ],
    repairSignals: [{ publicObject: 'the break-point', count: 2, sameObject: true }],
  });

  assert.equal(state.reinvention.trigger, 'repeated_same_object_repair');
  assert.equal(state.reinvention.toStance, 'repair-and-rebuild guide');
  assert.equal(state.reinvention.mayOverrideProofControl, false);
  assert.equal(state.reinvention.proofControlAuthority, 'none');
  assert.match(state.reinvention.exitCondition, /the break-point/u);
});
