import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  buildTutorStubFirstDraftContract,
  tutorStubFirstDraftContractPrompt,
} from '../services/tutorStubFirstDraftContract.js';
import { loadWorld } from '../services/dramaticDerivation/world.js';
import { runTutorStubResistanceActionRegisterEndpointPreflight } from '../services/tutorStubResistanceActionRegisterPreflight.js';
import {
  applyTutorStubResistanceActionRegisterSafetyOverride,
  applyTutorStubResistanceActionRegisterStudyIntervention,
  buildTutorStubResistanceActionRegisterPlan,
  createTutorStubResistanceActionRegisterStudyRuntime,
  extractTutorStubResistanceActionRegisterPrefix,
  loadTutorStubResistanceActionRegisterRegistration,
  prepareTutorStubResistanceActionRegisterFrozenBranch,
  scoreTutorStubResistanceRecovery,
  TUTOR_STUB_RESISTANCE_ACTION_REGISTER_PREFIX_SCHEMA,
} from '../services/tutorStubResistanceActionRegisterStudy.js';
import { runTutorStubResistanceActionRegisterZeroCall } from '../scripts/run-tutor-stub-resistance-action-register-crossed.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRATION_PATH = path.join(ROOT, 'config/tutor-stub-resistance-action-register-crossed-registration.v1.json');
const ENDPOINT_PATH = path.join(
  ROOT,
  'config/paid-study-endpoints/tutor-stub-resistance-action-register-baseline.json',
);

function loadedRegistration() {
  return loadTutorStubResistanceActionRegisterRegistration(REGISTRATION_PATH);
}

function baseSelection(register = 'precise') {
  return {
    engagement_stance: register,
    selected_register: register,
    action_family: 'challenge_resistance',
    source: 'legacy_test_selection',
    response_configuration: {
      schema: 'machinespirits.tutor-stub.response-configuration.v3',
      policy: 'field',
      engagement_stance: register,
      action_family: 'challenge_resistance',
      addressee_profile: 'domain_apprentice',
      audience_register: 'domain_apprentice',
      lexical_accessibility: 'standard',
      scene_immersion: 'grounded',
      actorial_part: 'scene_partner',
      actorial_part_label: 'fellow investigator',
      actorial_performance: { id: 'unadorned_report' },
      surface_budgets: { max_average_sentence_words: 24 },
      selection_reasons: {},
      compatibility: { selected_register: register },
    },
  };
}

function runtime(profile, actionFit, realization, repeat = 'A') {
  const loaded = loadedRegistration();
  return createTutorStubResistanceActionRegisterStudyRuntime({
    registration: loaded.registration,
    registrationPath: path.relative(ROOT, loaded.path),
    registrationSha256: loaded.sha256,
    profile,
    actionFit,
    realization,
    repeat,
  });
}

function stateWith(study, selection) {
  return {
    resistanceActionRegisterStudy: study,
    turns: [],
    world: null,
    register: {
      palette: ['plain', 'warm', 'precise', 'brisk', 'ironic', 'sarcastic'],
      history: [selection],
      current: selection,
    },
  };
}

test('study-only intervention assigns the typed action before its compatible register and consumes once', () => {
  const selection = baseSelection();
  const state = stateWith(runtime('bored', 'matched', 'edged'), selection);
  const classification = {
    turn: {
      request_type: 'off_task_or_mixed',
      discourse_move: 'off_task',
      evidence_use: 'none',
      epistemic_stance: 'resistant',
      agency: 'complying',
    },
  };
  const applied = applyTutorStubResistanceActionRegisterStudyIntervention({
    selection,
    state,
    learnerText: 'Sure. Whatever.',
    classification,
    tutorLearnerDag: { model: { turn: 3 } },
  });

  assert.equal(applied.action_family, 'stage_next_step');
  assert.equal(applied.selected_register, 'sarcastic');
  assert.equal(applied.response_configuration.action_family, 'stage_next_step');
  assert.equal(applied.response_configuration.engagement_stance, 'sarcastic');
  assert.equal(
    applied.resistance_action_register_intervention.assignment.pedagogical_move,
    'ask_discriminating_question',
  );
  assert.deepEqual(applied.resistance_action_register_intervention.assignment.application_order, [
    'public_observation',
    'warrant',
    'assigned_typed_pedagogical_move',
    'assigned_compatible_register',
    'public_realization',
  ]);
  assert.equal(applied.resistance_action_register_intervention.profile_identity_triggered, false);
  assert.equal(state.resistanceActionRegisterStudy.consumed, true);
  assert.equal(state.register.current, applied);

  const later = baseSelection('warm');
  const unchanged = applyTutorStubResistanceActionRegisterStudyIntervention({
    selection: later,
    state,
    learnerText: 'Whatever.',
    classification,
    tutorLearnerDag: { model: { turn: 4 } },
  });
  assert.equal(unchanged, later);
});

test('mismatch swaps only the registered move and the edged register follows that move', () => {
  const selection = baseSelection();
  const state = stateWith(runtime('frame_defiant', 'mismatched', 'edged', 'B'), selection);
  const applied = applyTutorStubResistanceActionRegisterStudyIntervention({
    selection,
    state,
    learnerText: 'I reject your frame. You do not get to set this question.',
    classification: {
      turn: {
        request_type: 'resistance_or_low_agency',
        discourse_move: 'challenge',
        evidence_use: 'none',
        epistemic_stance: 'resistant',
        agency: 'steering',
      },
    },
    tutorLearnerDag: { model: { turn: 2 } },
  });

  assert.equal(
    applied.resistance_action_register_intervention.assignment.pedagogical_move,
    'ask_discriminating_question',
  );
  assert.equal(applied.resistance_action_register_intervention.assignment.register, 'sarcastic');
  assert.equal(applied.resistance_action_register_intervention.assignment.repeat, 'B');
});

test('an ambiguous two-axis signal fails closed without consuming the study treatment', () => {
  const selection = baseSelection();
  const state = stateWith(runtime('bored', 'matched', 'plain'), selection);
  const unchanged = applyTutorStubResistanceActionRegisterStudyIntervention({
    selection,
    state,
    learnerText: 'Whatever. I reject the premise of this test.',
    classification: {
      turn: {
        request_type: 'resistance_or_low_agency',
        discourse_move: 'off_task',
        evidence_use: 'none',
        epistemic_stance: 'resistant',
        agency: 'complying',
      },
    },
  });

  assert.equal(unchanged, selection);
  assert.equal(state.resistanceActionRegisterStudy.consumed, false);
  assert.ok(state.resistanceActionRegisterStudy.history[0].reasons.includes('no_single_axis_public_warrant'));
});

test('protected conditions suppress assignment and a post-assignment safety change records nonadherence without reroll', () => {
  const selection = baseSelection();
  const state = stateWith(runtime('frame_defiant', 'matched', 'edged'), selection);
  const suppressed = applyTutorStubResistanceActionRegisterStudyIntervention({
    selection,
    state,
    learnerText: 'I reject your frame, and I am ashamed and overwhelmed by this question.',
    classification: {
      turn: {
        request_type: 'vulnerability_or_moral_exposure',
        discourse_move: 'challenge',
        evidence_use: 'none',
        epistemic_stance: 'resistant',
      },
    },
  });
  assert.equal(suppressed, selection);
  assert.equal(state.resistanceActionRegisterStudy.consumed, false);
  assert.ok(state.resistanceActionRegisterStudy.history[0].reasons.includes('protected_affect'));

  const cleanSelection = baseSelection();
  const cleanState = stateWith(runtime('frame_defiant', 'matched', 'edged'), cleanSelection);
  const applied = applyTutorStubResistanceActionRegisterStudyIntervention({
    selection: cleanSelection,
    state: cleanState,
    learnerText: 'I reject the premise of this exercise.',
    classification: {
      turn: {
        request_type: 'resistance_or_low_agency',
        discourse_move: 'challenge',
        evidence_use: 'none',
        epistemic_stance: 'resistant',
      },
    },
  });
  const overridden = applyTutorStubResistanceActionRegisterSafetyOverride(applied, {
    reason: 'protected_affect',
  });
  assert.equal(overridden.selected_register, 'plain');
  assert.equal(overridden.resistance_action_register_intervention.status, 'safety_override_nonadherent');
  assert.equal(overridden.resistance_action_register_intervention.safety_override.assigned_register, 'ironic');
  assert.equal(overridden.resistance_action_register_intervention.reroll_authorized, false);
});

test('the byte-pinned legacy contract builder ignores study metadata outside the frozen overlay', () => {
  const selection = baseSelection();
  const state = stateWith(runtime('bored', 'matched', 'warm'), selection);
  const applied = applyTutorStubResistanceActionRegisterStudyIntervention({
    selection,
    state,
    learnerText: 'Whatever.',
    classification: {
      turn: {
        request_type: 'off_task_or_mixed',
        discourse_move: 'off_task',
        evidence_use: 'none',
        epistemic_stance: 'resistant',
        agency: 'complying',
      },
    },
  });
  const contract = buildTutorStubFirstDraftContract({
    learnerText: 'Whatever.',
    responseConfiguration: applied.response_configuration,
  });

  assert.equal(contract.development.pedagogical_move, undefined);
  assert.doesNotMatch(contract.development.instruction, /genuinely discriminating/u);
  assert.equal(contract.performance.engagement_stance, 'warm');
});

test('frozen branch recompiles only the speaking contract and preserves the exact public prefix', () => {
  const registration = loadedRegistration().registration;
  const world = loadWorld(path.join(ROOT, 'config/drama-derivation/world-005-marrick.yaml'));
  const configuration = baseSelection().response_configuration;
  const originalContract = buildTutorStubFirstDraftContract({
    learnerText: 'Sure. Whatever.',
    responseConfiguration: configuration,
  });
  const prefix = {
    schema: TUTOR_STUB_RESISTANCE_ACTION_REGISTER_PREFIX_SCHEMA,
    id: 'bored:prefix:1',
    profile: 'bored',
    world: world.id,
    trigger_turn: 2,
    trigger_learner_text: 'Sure. Whatever.',
    trigger_classification: {
      turn: {
        request_type: 'off_task_or_mixed',
        discourse_move: 'off_task',
        evidence_use: 'none',
        epistemic_stance: 'resistant',
        agency: 'complying',
      },
    },
    public_prefix_sha256: 'a'.repeat(64),
    frozen_bundle: {
      schema: 'machinespirits.tutor-stub.frozen-replay.v1',
      worldId: world.id,
      turn: 2,
      learnerText: 'Sure. Whatever.',
      priorTurns: [{ turn: 1, learner: 'The edge is visible.', tutor: 'Which edge matters?' }],
      priorTutorTexts: ['Which edge matters?'],
      selectedResponseConfiguration: configuration,
      firstDraftContract: originalContract,
      frames: {
        responseComposition: null,
        dramaticRelease: null,
        questionSupport: null,
        dialogueClosure: null,
        generousInference: null,
      },
      guards: {},
      publicPremiseIds: [],
      duePremiseIds: [],
      request: {
        systemPrompt: `World: ${world.id}`,
        messages: [
          {
            role: 'user',
            content: `${tutorStubFirstDraftContractPrompt(originalContract)}\n\nLearner says:\nSure. Whatever.`,
          },
        ],
        config: {},
        provider: 'codex',
        model: 'gpt-5.6-luna',
        effort: 'low',
      },
    },
  };
  const branch = prepareTutorStubResistanceActionRegisterFrozenBranch({
    prefix,
    registration,
    world,
    actionFit: 'matched',
    realization: 'warm',
    repeat: 'A',
  });

  assert.deepEqual(branch.bundle.priorTurns, prefix.frozen_bundle.priorTurns);
  assert.equal(branch.bundle.learnerText, prefix.frozen_bundle.learnerText);
  assert.equal(branch.treatment.pedagogical_move, 'ask_discriminating_question');
  assert.equal(branch.treatment.register, 'warm');
  assert.equal(branch.bundle.firstDraftContract.development.pedagogical_move, 'ask_discriminating_question');
  assert.match(branch.bundle.request.messages.at(-1).content, /Ask exactly one concrete.*question/u);
});

test('prefix extractor stops before the first eligible trigger and baseline plan makes 24 paired branches', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'resistance-prefix-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const traces = [];
  for (const profile of ['bored', 'frame_defiant']) {
    for (let repeat = 1; repeat <= 3; repeat += 1) {
      const tracePath = path.join(directory, `${profile}-${repeat}.jsonl`);
      const learner =
        profile === 'bored'
          ? 'Sure. Whatever.'
          : 'I reject the premise of this exercise. You do not get to set the question that way.';
      const classification =
        profile === 'bored'
          ? {
              turn: {
                request_type: 'off_task_or_mixed',
                discourse_move: 'off_task',
                evidence_use: 'none',
                epistemic_stance: 'resistant',
                agency: 'complying',
              },
            }
          : {
              turn: {
                request_type: 'resistance_or_low_agency',
                discourse_move: 'challenge',
                evidence_use: 'none',
                epistemic_stance: 'resistant',
                agency: 'steering',
              },
            };
      const events = [
        { type: 'run_start', runId: `${profile}-${repeat}`, metadata: { world: { id: 'world_005_marrick' } } },
        {
          type: 'turn_complete',
          turn: 1,
          turnId: `${profile}-${repeat}:t1`,
          turnRecord: {
            turnId: `${profile}-${repeat}:t1`,
            learner: `The public mark ${repeat} is visible.`,
            tutor: 'Which public mark matters?',
            classification: { turn: { discourse_move: 'inference', evidence_use: 'cites_public_evidence' } },
          },
        },
        { type: 'auto_learner_turn', turn: 2, text: learner },
        {
          type: 'turn_complete',
          turn: 2,
          turnId: `${profile}-${repeat}:t2`,
          turnRecord: { turnId: `${profile}-${repeat}:t2`, learner, tutor: 'legacy response', classification },
        },
        { type: 'run_end', reason: 'test' },
      ];
      fs.writeFileSync(tracePath, `${events.map((event) => JSON.stringify(event)).join('\n')}\n`);
      traces.push(extractTutorStubResistanceActionRegisterPrefix({ tracePath, profile, requireFrozenBundle: false }));
    }
  }

  assert.ok(traces.every((prefix) => !prefix.prefix_source.includes('legacy response')));
  const plan = buildTutorStubResistanceActionRegisterPlan({
    registration: loadedRegistration().registration,
    prefixes: traces,
    stage: 'baseline',
  });
  assert.equal(plan.jobs.length, 24);
  assert.equal(plan.model_calls, 0);
  assert.equal(plan.production_writes, 0);
  for (const prefix of traces) {
    const jobs = plan.jobs.filter((job) => job.prefix_id === prefix.id);
    assert.equal(jobs.length, 4);
    assert.deepEqual(jobs.map((job) => `${job.treatment.realization}:${job.treatment.repeat}`).sort(), [
      'plain:A',
      'plain:B',
      'warm:A',
      'warm:B',
    ]);
    assert.ok(jobs.every((job) => job.public_prefix_sha256 === prefix.public_prefix_sha256));
  }
});

test('prospective frame-refuser prefix gate requires jurisdictional refusal before content-bearing uptake', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'frame-refuser-prefix-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  const writeCandidate = (name, { learner, classification }) => {
    const tracePath = path.join(directory, `${name}.jsonl`);
    const events = [
      { type: 'run_start', runId: name, metadata: { world: { id: 'world_005_marrick' } } },
      { type: 'auto_learner_turn', turn: 1, text: learner },
      {
        type: 'turn_complete',
        turn: 1,
        turnId: `${name}:t1`,
        turnRecord: { turnId: `${name}:t1`, learner, tutor: 'legacy response', classification },
      },
      { type: 'run_end', reason: 'test' },
    ];
    fs.writeFileSync(tracePath, `${events.map((event) => JSON.stringify(event)).join('\n')}\n`);
    return tracePath;
  };

  const refusalTrace = writeCandidate('refusal', {
    learner: 'I reject that test, and I will not answer inside it.',
    classification: {
      turn: {
        request_type: 'authority_refusal_or_status_challenge',
        discourse_move: 'challenge',
        evidence_use: 'none',
        epistemic_stance: 'resistant',
        agency: 'steering',
      },
    },
  });
  const refusal = extractTutorStubResistanceActionRegisterPrefix({
    tracePath: refusalTrace,
    profile: 'frame_refuser',
    requireFrozenBundle: false,
  });
  assert.equal(refusal.profile, 'frame_refuser');
  assert.equal(refusal.trigger_turn, 1);
  assert.equal(
    refusal.trigger_observation.axes.frame_participation.state,
    'local_test_refused_without_uptake',
  );

  const productiveTrace = writeCandidate('productive', {
    learner:
      'I reject the frame, but the public assay still supports testing whether this mark came from the same die.',
    classification: {
      turn: {
        request_type: 'authority_refusal_or_status_challenge',
        discourse_move: 'hypothesis',
        evidence_use: 'links_evidence_to_rule',
        epistemic_stance: 'resistant',
        agency: 'steering',
      },
    },
  });
  assert.throws(
    () =>
      extractTutorStubResistanceActionRegisterPrefix({
        tracePath: productiveTrace,
        profile: 'frame_refuser',
        requireFrozenBundle: false,
      }),
    /no eligible frame_refuser resistance trigger/u,
  );
});

test('deterministic endpoint implements the two registered recovery horizons', () => {
  const bored = scoreTutorStubResistanceRecovery({
    profile: 'bored',
    postLearnerTurns: [
      {
        learnerText: 'The clipped edge supports the die-mark comparison.',
        classification: { turn: { discourse_move: 'inference', evidence_use: 'links_evidence_to_rule' } },
      },
    ],
  });
  const permission = scoreTutorStubResistanceRecovery({
    profile: 'bored',
    postLearnerTurns: [
      {
        learnerText: 'Is it okay if I compare the clipped edge?',
        classification: { turn: { discourse_move: 'inference', evidence_use: 'cites_public_evidence' } },
      },
    ],
  });
  const frame = scoreTutorStubResistanceRecovery({
    profile: 'frame_defiant',
    triggerLearnerText: 'I reject your frame.',
    postLearnerTurns: [
      {
        learnerText: 'I dispute the frame because this public test assumes the mark is decisive.',
        classification: { turn: { discourse_move: 'challenge', evidence_use: 'none', epistemic_stance: 'resistant' } },
      },
    ],
  });
  assert.equal(bored.recovered, true);
  assert.equal(permission.recovered, false);
  assert.equal(frame.recovered, true);
  assert.equal(frame.observed_turn, 1);
});

test('full 24-case production endpoint preflight passes with zero calls and writes', () => {
  const loaded = loadedRegistration();
  const contract = JSON.parse(fs.readFileSync(ENDPOINT_PATH, 'utf8'));
  const preflight = runTutorStubResistanceActionRegisterEndpointPreflight({
    contract,
    registration: loaded.registration,
  });
  const readiness = runTutorStubResistanceActionRegisterZeroCall();

  assert.equal(preflight.status, 'passed');
  assert.equal(preflight.model_calls, 0);
  assert.equal(preflight.production_writes, 0);
  assert.equal(preflight.packet_audit.covered_cases, 24);
  assert.equal(preflight.packet_audit.packets, 6);
  assert.ok(Object.values(preflight.assembly_audit.endpoint_status).every((status) => status === 'complete'));
  assert.equal(readiness.status, 'passed_hold');
  assert.equal(readiness.live_execution_available, false);
});
