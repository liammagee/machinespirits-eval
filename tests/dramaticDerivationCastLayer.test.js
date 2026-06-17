import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  auditCastLayerPublicInput,
  CAST_LAYER_SCHEMA,
  CAST_REINVENTION_TRIGGERS,
  deriveCastState,
  loadWorld,
  makeLlmDirector,
  makeLlmLearner,
  makeLlmTutor,
  projectCastStateForRole,
  TUTOR_REINVENTION_SCHEMA,
} from '../services/dramaticDerivation/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = 'You are the tutor in the assize. Guide without giving the answer.';

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

const HETHEL_WORLD = {
  ...loadWorld(path.join(ROOT, 'config/drama-derivation/world-006-hethel.yaml')),
  cast: HETHEL_CAST,
};

function stubClient(replies) {
  const calls = [];
  const remaining = new Map(Object.entries(replies).map(([role, list]) => [role, [...list]]));
  return {
    calls,
    client: {
      mode: 'mock',
      usage: () => ({}),
      async call(role, payload) {
        calls.push({ role, ...payload });
        const queue = remaining.get(role);
        if (!queue || !queue.length) throw new Error(`stubClient: no reply queued for ${role}`);
        const next = queue.shift();
        return typeof next === 'string' ? next : JSON.stringify(next);
      },
    },
  };
}

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

test('tutor prompt projection records cast state and bounded reinvention metadata', async () => {
  const { client, calls } = stubClient({
    tutor: [
      {
        dialogue: 'Let us check that together before the book closes.',
        move: { figure: 'erotema', target_premise: null, intent: 'test' },
      },
    ],
  });
  const tutor = makeLlmTutor(HETHEL_WORLD, client, {
    script: SCRIPT,
    castLayer: true,
    castReinvention: true,
  });
  const out = await tutor({
    turn: 9,
    role: 'tutor',
    world: HETHEL_WORLD,
    ledger: [],
    releasedFacts: [],
    transcript: [{ turn: 8, role: 'learner', text: 'As you said, liability is the phrase to keep.' }],
    staging: { phase: null },
    trajectory: [],
    learnerAbox: { grounded: HETHEL_WORLD.background, hypotheses: [] },
    inference: { frontier: [], voiced: [], overreachCount: 0 },
    scene: { index: 1, goal: 'test ownership', exchangesSoFar: 1 },
    publicRegister: 'default',
  });

  const tutorCall = calls.find((call) => call.role === 'tutor');
  assert.ok(tutorCall.system.includes('# Cast layer'));
  assert.ok(tutorCall.user.includes('CAST LAYER (TUTOR projection'));
  assert.ok(tutorCall.user.includes('Tutor reinvention active: craft examiner -> co-investigator'));
  assert.equal(tutorCall.meta.castState.schema, CAST_LAYER_SCHEMA);
  assert.equal(tutorCall.meta.tutorReinvention.schema, TUTOR_REINVENTION_SCHEMA);
  assert.equal(out.castState.reinvention.trigger, 'echo_without_ownership');
  assert.equal(out.tutorReinvention.mayOverrideProofControl, false);
  assert.equal(out.move.intent, 'test');
  assert.equal(out.release, 'p_surface');
});

test('learner prompt projection excludes tutor-private reinvention audit', async () => {
  const { client, calls } = stubClient({
    learner: [
      {
        dialogue: 'I see the pressure on the book, but I will keep the cause separate.',
        adopt_indices: [],
        retract_indices: [],
        derive_indices: [],
        hypothesis: null,
        exchange_type: 'substantive',
        asserts_answer: null,
      },
    ],
  });
  const learner = makeLlmLearner({
    setting: HETHEL_WORLD.setting,
    voice: HETHEL_WORLD.learnerVoice,
    client,
    cast: HETHEL_CAST,
    castLayer: true,
  });
  await learner({
    turn: 3,
    question: HETHEL_WORLD.question,
    questionPattern: HETHEL_WORLD.questionPattern,
    rules: HETHEL_WORLD.rules,
    background: HETHEL_WORLD.background,
    releasedFacts: [],
    releasedThisTurn: [],
    factSurfaces: {},
    transcript: [{ turn: 2, role: 'tutor', text: 'Hold the record open.' }],
    abox: { grounded: HETHEL_WORLD.background, hypotheses: [] },
    voiced: [],
    publicRegister: 'default',
  });

  const learnerCall = calls.find((call) => call.role === 'learner');
  assert.ok(learnerCall.system.includes('CAST LAYER (LEARNER projection'));
  assert.ok(learnerCall.system.includes("bridge-warden's young clerk"));
  assert.doesNotMatch(learnerCall.system, /Tutor reinvention active|forbidden changes|release_timing|proof target:|target_premise/u);
  assert.equal(learnerCall.meta.castState.schema, CAST_LAYER_SCHEMA);
  assert.equal(learnerCall.meta.castState.reinvention, null);
});

test('director prologue consumes authored cast as public source of character truth', async () => {
  const { client, calls } = stubClient({
    director: [
      {
        stage_notes: 'The assize opens under pressure, with the record waiting.',
        tutor_character: 'The bridge-mason is spare and exact.',
        learner_character: 'The clerk is quick and anxious to close.',
        register_note: 'The period surface follows assize craft and civic pressure.',
      },
    ],
  });
  const director = makeLlmDirector(HETHEL_WORLD, client, { castLayer: true, publicRegister: 'default' });
  const prologue = await director.prologue({ turn: 0, publicRegister: 'default' });

  const directorCall = calls.find((call) => call.role === 'director');
  assert.ok(directorCall.system.includes('# Cast layer'));
  assert.ok(directorCall.user.includes('CAST LAYER (DIRECTOR projection'));
  assert.ok(directorCall.user.includes('master of works'));
  assert.equal(directorCall.meta.castState.schema, CAST_LAYER_SCHEMA);
  assert.match(prologue.tutorCharacter, /bridge-mason/u);
});

test('tutor reinvention is bounded to the active scene', async () => {
  const { client, calls } = stubClient({
    tutor: [
      {
        dialogue: 'Let us check that together.',
        move: { figure: 'erotema', target_premise: null, intent: 'test' },
      },
      {
        dialogue: 'Stay with the same shared check.',
        move: { figure: 'erotema', target_premise: null, intent: 'test' },
      },
      {
        dialogue: 'The next scene can return to the ordinary examination.',
        move: { figure: 'erotema', target_premise: null, intent: 'test' },
      },
      {
        dialogue: 'We do not need another stance change for the same friction.',
        move: { figure: 'erotema', target_premise: null, intent: 'test' },
      },
    ],
  });
  const tutor = makeLlmTutor(HETHEL_WORLD, client, {
    script: SCRIPT,
    castLayer: true,
    castReinvention: true,
  });
  const baseView = {
    role: 'tutor',
    world: HETHEL_WORLD,
    ledger: [],
    releasedFacts: [],
    staging: { phase: null },
    trajectory: [],
    learnerAbox: { grounded: HETHEL_WORLD.background, hypotheses: [] },
    inference: { frontier: [], voiced: [], overreachCount: 0 },
    publicRegister: 'default',
  };

  const first = await tutor({
    ...baseView,
    turn: 9,
    transcript: [{ turn: 8, role: 'learner', text: 'As you said, liability is the phrase to keep.' }],
    scene: { index: 1, goal: 'test ownership', exchangesSoFar: 1 },
  });
  const second = await tutor({
    ...baseView,
    turn: 10,
    transcript: [{ turn: 9, role: 'learner', text: 'I can try it in my own words now.' }],
    scene: { index: 1, goal: 'test ownership', exchangesSoFar: 2 },
  });
  const third = await tutor({
    ...baseView,
    turn: 11,
    transcript: [{ turn: 10, role: 'learner', text: 'I follow the distinction now.' }],
    scene: { index: 2, goal: 'move to the next object', exchangesSoFar: 0 },
  });
  const fourth = await tutor({
    ...baseView,
    turn: 12,
    transcript: [{ turn: 11, role: 'learner', text: 'As you said, I can repeat the phrase.' }],
    scene: { index: 3, goal: 'check repeated echo', exchangesSoFar: 0 },
  });

  assert.equal(first.tutorReinvention.trigger, 'echo_without_ownership');
  assert.equal(first.castState.tutor.currentStance, 'co-investigator');
  assert.equal(second.tutorReinvention.trigger, 'echo_without_ownership');
  assert.equal(second.castState.tutor.currentStance, 'co-investigator');
  assert.equal(third.tutorReinvention, null);
  assert.equal(third.castState.tutor.currentStance, 'craft examiner');
  assert.equal(fourth.tutorReinvention, null);
  assert.equal(fourth.castState.tutor.currentStance, 'craft examiner');

  const tutorCalls = calls.filter((call) => call.role === 'tutor');
  assert.ok(tutorCalls[1].user.includes('Tutor reinvention active: craft examiner -> co-investigator'));
  assert.doesNotMatch(tutorCalls[2].user, /Tutor reinvention active/u);
  assert.doesNotMatch(tutorCalls[3].user, /Tutor reinvention active/u);
});
