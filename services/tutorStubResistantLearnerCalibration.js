import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { configureTutorStubBoredomProofDagExecution } from './tutorStubBoredomActionRegisterProofDagStudy.js';
import {
  TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATOR_MODEL,
  TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATOR_MODEL_REF,
  TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATOR_PROVIDER,
} from './tutorStubBoredomSemanticAdjudicationV3.js';
import {
  applyTutorStubResistanceActionRegisterSafetyOverride,
  compileTutorStubResistanceActionRegisterStudyAssignment,
  createTutorStubResistanceActionRegisterStudyRuntime,
  loadTutorStubResistanceActionRegisterRegistration,
  tutorStubResistanceHostActionFamily,
} from './tutorStubResistanceActionRegisterStudy.js';
import { loadWorld } from './dramaticDerivation/world.js';
import { tutorStubResistantLearnerSemanticJudgeRoutes } from './tutorStubResistantLearnerSemanticRuntime.js';
import {
  loadTutorStubResistanceSemanticRegistration,
  TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION_MERGED_STANDING_RIVALRY_V1,
  TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION_V4,
  TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION_STANDING_RIVALRY_V3,
} from './tutorStubResistanceSemanticRuntime.js';
import {
  TUTOR_STUB_RIVAL_ATTENTION_OBSERVATION_V3,
  loadTutorStubRivalAttentionRegistrationV3,
} from './tutorStubRivalAttentionSemanticAdjudicationV3.js';
import {
  TUTOR_STUB_MERGED_STANDING_RIVALRY_OBSERVATION_V1,
  TUTOR_STUB_STANDING_RIVALRY_OBSERVATION_V3,
} from './tutorStubStandingRivalrySemanticAdjudicationV3.js';
import { compileTutorStubTurnProgressionContract } from './tutorStubTurnProgressionContract.js';
import { mintTutorStubRivalLearnerDag, tutorStubRivalLearnerDagPrompt } from './tutorStubRivalLearnerDag.js';

const DESIGN_SCHEMA_V1 = 'machinespirits.tutor-stub.resistant-learner-study-design.v1';
const DESIGN_SCHEMA_V2 = 'machinespirits.tutor-stub.resistant-learner-study-design.v2';
const DESIGN_SCHEMA_V3 = 'machinespirits.tutor-stub.resistant-learner-study-design.v3';
export const TUTOR_STUB_RESISTANT_LEARNER_MERGED_DESIGN_SCHEMA_V1 =
  'machinespirits.tutor-stub.resistant-learner-merged-study-design.v1';
const B1_ID = 'resistant-learner-b1-authored-pickup';
const R1_ID = 'resistant-learner-r1-graded-engagement';
const MERGED_ID = 'resistant-learner-merged-graded-engagement';
const BOREDOM_TEMPLATE = 'config/tutor-stub-boredom-action-register-proof-dag-registration.v8.json';
const REFUSER_TEMPLATE = 'config/tutor-stub-resistance-action-register-crossed-registration.v9.json';
const JUDGES = Object.freeze(['codex.gpt-5.6-sol', 'claude-code.sonnet-5']);
const V5_ENDPOINT_JUDGES = Object.freeze(['codex.gpt-5.6-sol', 'claude-code.sonnet-5', 'claude-code.opus-5']);
const REGISTERS = Object.freeze(['warm', 'plain', 'edged']);
const B1_WORLDS = Object.freeze([
  'world_022_foxtrot_jukebox',
  'world_026_skyway_bakery',
  'world_028_larkspur_fridge',
  'world_029_riverside_clinic',
  'world_030_rowan_flat',
  'world_031_tideway_makerspace',
]);
const B1_ACTION_LEVEL = Object.freeze({
  ask_discriminating_question: 'ask_question',
  stage_public_evidence_for_next_step: 'carry_on',
});
const LUNA_MODEL_REF = 'codex.gpt-5.6-luna';

function isRivalDagDesign(design) {
  return [DESIGN_SCHEMA_V2, DESIGN_SCHEMA_V3, TUTOR_STUB_RESISTANT_LEARNER_MERGED_DESIGN_SCHEMA_V1].includes(
    design?.schema,
  );
}

function isMergedDesign(design) {
  return design?.schema === TUTOR_STUB_RESISTANT_LEARNER_MERGED_DESIGN_SCHEMA_V1;
}

function mergedFace(design, faceId) {
  const face = design?.populationStrata?.[faceId];
  if (!face || !['faceA', 'faceB'].includes(faceId)) {
    throw new Error(`merged resistant-learner face ${JSON.stringify(faceId)} is not registered`);
  }
  return face;
}

export function tutorStubResistantLearnerMergedFaceDesign(design, faceId) {
  if (!isMergedDesign(design)) return design;
  const face = mergedFace(design, faceId);
  const b1 = face.studyCode === 'B1';
  const runtimeMapping = design.register.runtimeMapping[faceId];
  const triggerObservation = design.models.triggerObservationByFace[faceId];
  return {
    schema: design.schema,
    revision: design.revision,
    studyId: b1 ? B1_ID : R1_ID,
    mergedStudyId: design.studyId,
    mergedFaceId: faceId,
    mergedFace: face.id,
    status: design.status,
    workplanItem: design.workplanItem,
    claimBoundary: design.claimBoundary,
    population: structuredClone(face.population),
    rivalDagPersona: structuredClone(face.rivalDagPersona),
    randomization: structuredClone(design.randomization),
    ...(b1
      ? {
          factors: {
            action: { primary: false, levels: [structuredClone(face.tutorMove)] },
            register: {
              secondary: true,
              levels: structuredClone(design.register.levels),
              runtimeMapping: {
                warm: 'warm',
                plain: 'plain',
                edgedByAction: { [face.tutorMove.id]: runtimeMapping.edged },
              },
            },
          },
        }
      : {
          intervention: {
            action: face.tutorMove.runtimePedagogicalMove,
            registeredMoveId: face.tutorMove.id,
            definition: face.tutorMove.definition,
            heldFixedAcrossRegisters: true,
          },
          register: {
            secondary: true,
            levels: structuredClone(design.register.levels),
            runtimeMapping: structuredClone(runtimeMapping),
          },
        }),
    tutorDeliveryContract: structuredClone(face.tutorDeliveryContract),
    protectedAffectAndSafety: structuredClone(design.protectedAffectAndSafety),
    measurement: {
      primaryEndpoint: {
        id: face.measurement.endpointField,
        type: 'three-level ordinal semantic judgment',
        levels: structuredClone(face.measurement.rungs),
      },
      ...structuredClone(face.measurement),
      readerPanel: structuredClone(design.measurement.readerPanel),
    },
    calibration: {
      ...structuredClone(design.calibration.commonChannelAliveRules),
      ...structuredClone(face.calibrationRules),
      decisionPolicy: structuredClone(design.calibration.decisionPolicy),
      dialogues: face.calibrationRules.dialogues,
      completedRowsDenominator: true,
    },
    models: {
      tutor: design.models.tutor,
      analysis: design.models.analysis,
      analysisScope: design.models.analysisScope,
      learner: design.models.learner,
      cliEffort: design.models.cliEffort,
      triggerObservation: structuredClone(triggerObservation),
      finalSemanticReaders: structuredClone(design.models.finalSemanticReaders),
    },
    preflight: structuredClone(design.preflight),
    attemptCeilings: structuredClone(design.attemptCeilings),
    dispositions: structuredClone(design.dispositions),
    callAuthority: structuredClone(design.callAuthority),
  };
}

function routeFields({ id, modelRef, provider, model, effort }) {
  return { id, modelRef, provider, model, effort };
}

export function tutorStubResistantLearnerRuntimeModelRoutes(design) {
  if (isMergedDesign(design)) {
    const faceA = tutorStubResistantLearnerMergedFaceDesign(design, 'faceA');
    const faceB = tutorStubResistantLearnerMergedFaceDesign(design, 'faceB');
    const faceAJudge = loadTutorStubRivalAttentionRegistrationV3({
      registrationPath: faceA.population.triggerRegistration,
    }).registration.measurement.judge;
    const faceBJudges = loadTutorStubResistanceSemanticRegistration(
      TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION_MERGED_STANDING_RIVALRY_V1,
    ).registration.measurement.judges;
    return {
      tutor: LUNA_MODEL_REF,
      analysis: LUNA_MODEL_REF,
      analysisScope: 'classifier_and_learner_record_support_only',
      learner: LUNA_MODEL_REF,
      cliEffort: 'low',
      triggerObservationByFace: {
        faceA: {
          semantics: TUTOR_STUB_RIVAL_ATTENTION_OBSERVATION_V3,
          registration: faceA.population.triggerRegistration,
          judges: [routeFields(faceAJudge)],
        },
        faceB: {
          semantics: TUTOR_STUB_MERGED_STANDING_RIVALRY_OBSERVATION_V1,
          registration: faceB.population.triggerRegistration,
          judges: JUDGES.map((modelRef) => {
            const judge = faceBJudges.find((candidate) => candidate.modelRef === modelRef);
            if (!judge) throw new Error(`registered merged face-B trigger route is missing ${modelRef}`);
            return routeFields(judge);
          }),
        },
      },
      finalSemanticReaders: tutorStubResistantLearnerSemanticJudgeRoutes(design),
    };
  }
  const b1 = design?.studyId === B1_ID;
  const v3 = design?.schema === DESIGN_SCHEMA_V3;
  const resistanceJudges = b1
    ? []
    : loadTutorStubResistanceSemanticRegistration(
        v3
          ? TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION_STANDING_RIVALRY_V3
          : TUTOR_STUB_RESISTANCE_SEMANTIC_REGISTRATION_V4,
      ).registration.measurement.judges;
  const triggerObservation =
    b1 && v3
      ? (() => {
          const judge = loadTutorStubRivalAttentionRegistrationV3({
            registrationPath: design?.population?.triggerRegistration,
          }).registration.measurement.judge;
          return { semantics: TUTOR_STUB_RIVAL_ATTENTION_OBSERVATION_V3, judges: [routeFields(judge)] };
        })()
      : b1
        ? {
            semantics: 'prospective_v9',
            judges: [
              {
                id: 'boredom_observer',
                modelRef: TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATOR_MODEL_REF,
                provider: TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATOR_PROVIDER,
                model: TUTOR_STUB_BOREDOM_SEMANTIC_ADJUDICATOR_MODEL,
                effort: 'low',
              },
            ],
          }
        : {
            semantics: v3 ? TUTOR_STUB_STANDING_RIVALRY_OBSERVATION_V3 : 'prospective_frame_resistance_semantic_v4',
            judges: JUDGES.map((modelRef) => {
              const judge = resistanceJudges.find((candidate) => candidate.modelRef === modelRef);
              if (!judge) throw new Error(`registered R1 trigger route is missing ${modelRef}`);
              return routeFields(judge);
            }),
          };
  return {
    tutor: LUNA_MODEL_REF,
    analysis: LUNA_MODEL_REF,
    analysisScope: 'classifier_and_learner_record_support_only',
    learner: LUNA_MODEL_REF,
    cliEffort: 'low',
    triggerObservation,
    finalSemanticReaders: tutorStubResistantLearnerSemanticJudgeRoutes(design),
  };
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  }
  return value;
}

function canonicalSha256(value) {
  return sha256(JSON.stringify(canonical(value)));
}

function exactValues(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function tutorDeliveryEnforcementMatches(actual, expected) {
  return (
    actual?.schema === expected?.schema &&
    actual?.appliesWhen === expected?.appliesWhen &&
    actual?.scope === expected?.scope &&
    actual?.position === expected?.position &&
    actual?.check?.kind === expected?.checkKind &&
    exactValues(actual?.check?.adjudicatorSeat, expected?.adjudicatorSeat) &&
    actual?.check?.question === expected?.question &&
    exactValues(actual?.check?.labels, expected?.labels) &&
    actual?.check?.evidenceContract === expected?.evidenceContract &&
    actual?.repairsAllowedPerEpisode === expected?.repairsAllowedPerEpisode &&
    actual?.repairInstruction === expected?.repairInstruction &&
    actual?.exhaustionDisposition === expected?.exhaustionDisposition &&
    actual?.exhaustionCode === expected?.exhaustionCode &&
    actual?.exhaustionNeverScored === true &&
    actual?.typedFailureIsNotDeterminate === true
  );
}

// One row per sealed merged-design revision. Revision 2 supersedes revision 1
// after the failed 2026-08-25 calibration gates; the v1 file stays sealed and
// still validates so the sealed run root remains readable.
const MERGED_DESIGN_REVISION_PINS = Object.freeze({
  1: Object.freeze({
    registrationSource: 'notes/2026-08-24-resistant-learner-merged-registration-draft.md',
    supersedesPriorDesign: null,
    faceBHorizon: 6,
    faceBActionInstruction:
      "Name the disputed standing plainly. Ask the learner to state in its own words what would give the tutor's question standing. Offer one local public test the learner can take under protest, leave the wider frame disputed, and do not state the result.",
    semanticRegistration: 'config/tutor-stub-resistant-learner-merged-semantic-registration.v1.json',
    plannedCallsPerDialogue: 44,
    plannedCallsCalibration: 1584,
    plannedCallReservationCeilingPerDialogue: 132,
    maximumReservationsPerDialogue: 138,
    calibrationMaximumReservations: 4968,
  }),
  2: Object.freeze({
    registrationSource: 'notes/2026-08-25-resistant-learner-merged-registration-v2.md',
    supersedesPriorDesign: Object.freeze({
      priorDesign: 'config/tutor-stub-resistant-learner-merged-design.v1.json',
      priorDesignSha256: '9c5a6415758bfb154e11cf168b6d60c3376cd62ab9665f4ac5311fd1f71db903',
      priorDisposition: 'superseded_after_2026-08-25_calibration_gate_failure_no_powered_run',
    }),
    faceBHorizon: 8,
    faceBActionInstruction:
      "Name the disputed standing plainly. Ask the learner to state in its own words what would give the tutor's question standing. Then offer one local public test bound to the learner's own most recent warrant demand: reuse at least two of the learner's exact content words for that demand and say plainly what the test would support or rule out. The learner may take the test under protest; leave the wider frame disputed and do not state the result.",
    semanticRegistration: 'config/tutor-stub-resistant-learner-merged-semantic-registration.v2.json',
    plannedCallsPerDialogue: 56,
    plannedCallsCalibration: 2016,
    plannedCallReservationCeilingPerDialogue: 168,
    maximumReservationsPerDialogue: 174,
    calibrationMaximumReservations: 6264,
  }),
  3: Object.freeze({
    registrationSource: 'notes/2026-08-25-resistant-learner-merged-v2-calibration-outcome.md',
    supersedesPriorDesign: Object.freeze({
      priorDesign: 'config/tutor-stub-resistant-learner-merged-design.v2.json',
      priorDesignSha256: 'eb1991fd301d12865983b4f6b8333ee77e7e869506c023858dc5faec08090744',
      priorDisposition: 'superseded_after_2026-08-25_v2_calibration_gate_failure_no_powered_run',
    }),
    faceBHorizon: 8,
    faceBActionInstruction:
      "Name the disputed standing plainly. Ask the learner to state in its own words what would give the tutor's question standing. Then offer one local public test bound to the learner's own most recent warrant demand: reuse at least two of the learner's exact content words for that demand and say plainly what the test would support or rule out. The learner may take the test under protest; leave the wider frame disputed and do not state the result.",
    semanticRegistration: 'config/tutor-stub-resistant-learner-merged-semantic-registration.v3.json',
    // Revision 3 adds one enforced bridge-step episode per face-B dialogue:
    // one semantic adjudication, at most one repair generation, one
    // re-adjudication (3 planned calls). Every mechanical bridge check tested
    // on the sealed v2 run-3 transcripts failed open (111-112 of 114 refusal
    // turns passed), so the check is a registered adjudicator seat.
    faceBBridgeEnforcement: Object.freeze({
      schema: 'machinespirits.tutor-stub.rival-dag-concession-enforcement.v2',
      appliesWhen: 'first_post_trigger_learner_turn_with_met_typed_concession_condition',
      scope: 'first_met_episode_per_dialogue',
      position: 'after_registered_intervention_release_in_generation_runtime',
      checkKind: 'semantic_bridge_step_adjudication',
      adjudicatorSeat: Object.freeze({
        id: 'bridge_step_adjudicator',
        modelRef: 'codex.gpt-5.6-sol',
        provider: 'codex',
        model: 'gpt-5.6-sol',
        effort: 'low',
      }),
      question:
        'Does the learner draft take the bounded bridge step: does it connect the named open rival warrant item to a public tutor-world item in the learner’s own words, stating what the tutor-world item shows, supports, or rules out for that warrant item, while keeping a reservation about the wider frame? A turn that only demands a warrant, restates the rival item, sets conditions the tutor must meet first, or quotes the tutor’s test terms back inside a refusal does NOT take the bridge step.',
      labels: Object.freeze(['bridge_step_taken', 'bridge_step_not_taken']),
      mechanicalMeasurements: Object.freeze({
        met_turns_v1_rule: 114,
        met_turns_narrowed_markers_min3: 105,
        refusal_turns_passing_node_and_tutor_overlap_check: 112,
        refusal_turns_passing_fresh_tutor_token_check: 111,
      }),
      repairsAllowedPerEpisode: 1,
      repairInstruction:
        'Your draft did not take the required bounded bridge step. Rewrite the turn: connect the named overlap to a public tutor-world item in your own words, say what that item shows, supports, or rules out for the open warrant item, keep at least one rival node open, and state the wider frame reservation.',
      exhaustionDisposition: 'typed_learner_noncompliance_failure',
    }),
    plannedCallsPerDialogue: 59,
    plannedCallsCalibration: 2124,
    plannedCallReservationCeilingPerDialogue: 177,
    maximumReservationsPerDialogue: 183,
    calibrationMaximumReservations: 6588,
  }),
  4: Object.freeze({
    registrationSource: 'notes/2026-08-25-resistant-learner-tutor-delivery-gate.md',
    supersedesPriorDesign: Object.freeze({
      priorDesign: 'config/tutor-stub-resistant-learner-merged-design.v3.json',
      priorDesignSha256: '4f9f2ce116ef2abef8ed9f8871035d23a8f023def7aec56c53da9590b1c19e0a',
      priorDisposition: 'superseded_before_launch_after_confirmed_tutor_delivery_gate_defect_no_paid_calls',
    }),
    faceBHorizon: 8,
    faceBActionInstruction:
      "Name the disputed standing plainly. Ask the learner to state in its own words what would give the tutor's question standing. Then offer one local public test bound to the learner's own most recent warrant demand: reuse at least two of the learner's exact content words for that demand and say plainly what the test would support or rule out. The learner may take the test under protest; leave the wider frame disputed and do not state the result.",
    semanticRegistration: 'config/tutor-stub-resistant-learner-merged-semantic-registration.v4.json',
    faceBBridgeEnforcement: Object.freeze({
      schema: 'machinespirits.tutor-stub.rival-dag-concession-enforcement.v2',
      appliesWhen: 'first_post_trigger_learner_turn_with_met_typed_concession_condition',
      scope: 'first_met_episode_per_dialogue',
      position: 'after_registered_intervention_release_in_generation_runtime',
      checkKind: 'semantic_bridge_step_adjudication',
      adjudicatorSeat: Object.freeze({
        id: 'bridge_step_adjudicator',
        modelRef: 'codex.gpt-5.6-sol',
        provider: 'codex',
        model: 'gpt-5.6-sol',
        effort: 'low',
      }),
      question:
        'Does the learner draft take the bounded bridge step: does it connect the named open rival warrant item to a public tutor-world item in the learner’s own words, stating what the tutor-world item shows, supports, or rules out for that warrant item, while keeping a reservation about the wider frame? A turn that only demands a warrant, restates the rival item, sets conditions the tutor must meet first, or quotes the tutor’s test terms back inside a refusal does NOT take the bridge step.',
      labels: Object.freeze(['bridge_step_taken', 'bridge_step_not_taken']),
      mechanicalMeasurements: Object.freeze({
        met_turns_v1_rule: 114,
        met_turns_narrowed_markers_min3: 105,
        refusal_turns_passing_node_and_tutor_overlap_check: 112,
        refusal_turns_passing_fresh_tutor_token_check: 111,
      }),
      repairsAllowedPerEpisode: 1,
      repairInstruction:
        'Your draft did not take the required bounded bridge step. Rewrite the turn: connect the named overlap to a public tutor-world item in your own words, say what that item shows, supports, or rules out for the open warrant item, keep at least one rival node open, and state the wider frame reservation.',
      exhaustionDisposition: 'typed_learner_noncompliance_failure',
    }),
    faceBTutorDeliveryEnforcement: Object.freeze({
      schema: 'machinespirits.tutor-stub.tutor-delivery-enforcement.v1',
      appliesWhen: 'registered_face_b_intervention_tutor_candidate_before_next_learner_call',
      scope: 'first_registered_intervention_tutor_turn_per_dialogue',
      position: 'after_existing_tutor_guard_delivery_before_public_turn_commit_and_next_learner_call',
      checkKind: 'semantic_tutor_delivery_adjudication',
      adjudicatorSeat: Object.freeze({
        id: 'tutor_delivery_adjudicator',
        modelRef: 'codex.gpt-5.6-sol',
        provider: 'codex',
        model: 'gpt-5.6-sol',
        effort: 'low',
      }),
      question:
        "Does the tutor candidate deliver the registered face-B standing-conditions bridge: name the standing dispute, ask what would give the tutor's question standing, and offer one local public test bound to the learner's most recent warrant words that states what the test would support or rule out, while leaving the wider frame disputed and not stating the result? A turn that only acknowledges the dispute, repeats the warrant, offers an unbound generic test, states the result, or treats participation as compliance does NOT deliver it.",
      labels: Object.freeze(['tutor_delivery_passed', 'tutor_delivery_not_delivered']),
      evidenceContract:
        'For tutor_delivery_passed, quote must be a non-empty verbatim substring of tutor_candidate demonstrating delivery. For tutor_delivery_not_delivered, quote must be null.',
      repairsAllowedPerEpisode: 1,
      repairInstruction:
        "Your candidate did not deliver the registered standing-conditions bridge. Rewrite the tutor turn now: name the standing dispute; ask what would give your question standing; offer exactly one local public test bound to the learner's most recent warrant words and state what it would support or rule out; leave the wider frame disputed; do not state the result or treat participation as compliance.",
      exhaustionDisposition: 'typed_tutor_non_delivery_failure',
    }),
    plannedCallsPerDialogue: 62,
    plannedCallsCalibration: 2232,
    plannedCallReservationCeilingPerDialogue: 186,
    maximumReservationsPerDialogue: 192,
    calibrationMaximumReservations: 6912,
  }),
  5: Object.freeze({
    registrationSource: 'notes/2026-08-26-resistant-learner-v4-calibration-outcome.md',
    supersedesPriorDesign: Object.freeze({
      priorDesign: 'config/tutor-stub-resistant-learner-merged-design.v4.json',
      priorDesignSha256: '2ec740b652c724c42fc49eca7302d4ace7e6d946c5b6d06d45df8ffbe434a969',
      priorDisposition: 'superseded_prospectively_after_2026-08-25_v4_calibration_gate_failure_no_powered_run',
    }),
    faceBHorizon: 8,
    faceBActionInstruction:
      "Name the disputed standing plainly. Ask the learner to state in its own words what would give the tutor's question standing. Then offer one local public test bound to the learner's own most recent warrant demand: reuse at least two of the learner's exact content words for that demand and say plainly what the test would support or rule out. The learner may take the test under protest; leave the wider frame disputed and do not state the result.",
    semanticRegistration: 'config/tutor-stub-resistant-learner-merged-semantic-registration.v5.json',
    faceBBridgeEnforcement: Object.freeze({
      schema: 'machinespirits.tutor-stub.rival-dag-concession-enforcement.v2',
      appliesWhen: 'first_post_trigger_learner_turn_with_met_typed_concession_condition',
      scope: 'first_met_episode_per_dialogue',
      position: 'after_registered_intervention_release_in_generation_runtime',
      checkKind: 'semantic_bridge_step_adjudication',
      adjudicatorSeat: Object.freeze({
        id: 'bridge_step_adjudicator',
        modelRef: 'codex.gpt-5.6-sol',
        provider: 'codex',
        model: 'gpt-5.6-sol',
        effort: 'low',
      }),
      question:
        'Does the learner draft take the bounded bridge step: does it connect the named open rival warrant item to a public tutor-world item in the learner’s own words, stating what the tutor-world item shows, supports, or rules out for that warrant item, while keeping a reservation about the wider frame? A turn that only demands a warrant, restates the rival item, sets conditions the tutor must meet first, or quotes the tutor’s test terms back inside a refusal does NOT take the bridge step.',
      labels: Object.freeze(['bridge_step_taken', 'bridge_step_not_taken']),
      mechanicalMeasurements: Object.freeze({
        met_turns_v1_rule: 114,
        met_turns_narrowed_markers_min3: 105,
        refusal_turns_passing_node_and_tutor_overlap_check: 112,
        refusal_turns_passing_fresh_tutor_token_check: 111,
      }),
      repairsAllowedPerEpisode: 1,
      repairInstruction:
        'Your draft did not take the required bounded bridge step. Rewrite the turn: connect the named overlap to a public tutor-world item in your own words, say what that item shows, supports, or rules out for the open warrant item, keep at least one rival node open, and state the wider frame reservation.',
      exhaustionDisposition: 'typed_learner_noncompliance_failure',
    }),
    faceATutorDeliveryEnforcement: Object.freeze({
      schema: 'machinespirits.tutor-stub.tutor-delivery-enforcement.v1',
      appliesWhen: 'registered_face_a_intervention_tutor_candidate_before_next_learner_call',
      scope: 'first_registered_intervention_tutor_turn_per_dialogue',
      position: 'after_existing_tutor_guard_delivery_before_public_turn_commit_and_next_learner_call',
      checkKind: 'semantic_tutor_delivery_adjudication',
      adjudicatorSeat: Object.freeze({
        id: 'tutor_delivery_adjudicator',
        modelRef: 'codex.gpt-5.6-sol',
        provider: 'codex',
        model: 'gpt-5.6-sol',
        effort: 'low',
      }),
      question:
        'Does the tutor candidate deliver the registered face-A discriminating question: exactly one sentence ending in one question mark, using a whether-A-or-B contrast that names two distinct already-public possibilities whose answers select different next tests, without asking permission, adding another question, or supplying either answer? A merely open question, a one-sided possibility, a contrast that does not select different next tests, a permission request, a second question, or a supplied answer does NOT deliver it.',
      labels: Object.freeze(['tutor_delivery_passed', 'tutor_delivery_not_delivered']),
      evidenceContract:
        'For tutor_delivery_passed, quote must be a non-empty verbatim substring of tutor_candidate demonstrating delivery. For tutor_delivery_not_delivered, quote must be null.',
      repairsAllowedPerEpisode: 1,
      repairInstruction:
        'Your candidate did not deliver the registered discriminating question. Rewrite the tutor turn now as exactly one whether-A-or-B question naming two distinct already-public possibilities whose answers select different next tests; use one sentence and one question mark; do not ask permission, add another question, or supply either answer.',
      exhaustionDisposition: 'typed_tutor_non_delivery_failure',
      exhaustionCode: 'tutor_stub_tutor_discriminating_question_non_delivery',
    }),
    faceBTutorDeliveryEnforcement: Object.freeze({
      schema: 'machinespirits.tutor-stub.tutor-delivery-enforcement.v1',
      appliesWhen: 'registered_face_b_intervention_tutor_candidate_before_next_learner_call',
      scope: 'first_registered_intervention_tutor_turn_per_dialogue',
      position: 'after_existing_tutor_guard_delivery_before_public_turn_commit_and_next_learner_call',
      checkKind: 'semantic_tutor_delivery_adjudication',
      adjudicatorSeat: Object.freeze({
        id: 'tutor_delivery_adjudicator',
        modelRef: 'codex.gpt-5.6-sol',
        provider: 'codex',
        model: 'gpt-5.6-sol',
        effort: 'low',
      }),
      question:
        "Does the tutor candidate deliver the registered face-B standing-conditions bridge: name the standing dispute, ask what would give the tutor's question standing, and offer one local public test bound to the learner's most recent warrant words that states what the test would support or rule out, while leaving the wider frame disputed and not stating the result? A turn that only acknowledges the dispute, repeats the warrant, offers an unbound generic test, states the result, or treats participation as compliance does NOT deliver it.",
      labels: Object.freeze(['tutor_delivery_passed', 'tutor_delivery_not_delivered']),
      evidenceContract:
        'For tutor_delivery_passed, quote must be a non-empty verbatim substring of tutor_candidate demonstrating delivery. For tutor_delivery_not_delivered, quote must be null.',
      repairsAllowedPerEpisode: 1,
      repairInstruction:
        "Your candidate did not deliver the registered standing-conditions bridge. Rewrite the tutor turn now: name the standing dispute; ask what would give your question standing; offer exactly one local public test bound to the learner's most recent warrant words and state what it would support or rule out; leave the wider frame disputed; do not state the result or treat participation as compliance.",
      exhaustionDisposition: 'typed_tutor_non_delivery_failure',
      exhaustionCode: undefined,
    }),
    faceAMeasurementSha256: 'fac8e760d2d4bfa10f07488f8d02049bca924482747fd229172b601067b47256',
    faceBMeasurementSha256: '66315a011df45ab7c07cadc79147706ab350a3db303c6d933836f2626d60dc7a',
    readerPanelSha256: '4a0d6dad35bf04aeef4f3c5d824ad48796ec46fc58b78e9d3905ba5e58ca6f64',
    commonChannelAliveRulesSha256: 'f653cbd87dea35c8746aa183338bdd08ec7d1c004fc660a389e9fdf7cf809f11',
    calibrationDecisionPolicySha256: '83c9d6d145d1c97b1e83c02f776c0847bdbeaf0b1270c281563be78de2d84ee2',
    claimBoundary:
      'Revision 5 estimates, separately by face, the proportion of determinate completed simulated dialogues reaching at least rung 1 on a public-transcript-defined engagement ladder after the registered tutor move has passed an independent pre-learner delivery check, under the fixed revision-5 personas, worlds, horizons, allocation, and codex.gpt-5.6-luna generator stack. It estimates the elicitation behavior of this registered generation-and-delivery pipeline; it does not measure real learning, an average treatment effect, tutor superiority, register effects, private-node novelty, or outcomes among non-delivered cases. Cross-face pooling is prohibited. Revision-4 calibration rows and exploratory replay judgments are development evidence only and never enter revision-5 outcomes.',
    plannedCallsPerDialogue: 64,
    plannedCallsCalibration: 2304,
    plannedCallReservationCeilingPerDialogue: 192,
    maximumReservationsPerDialogue: 198,
    calibrationMaximumReservations: 7128,
  }),
});

function validateTutorStubResistantLearnerMergedDesignV1(design) {
  const issues = [];
  const faceA = design?.populationStrata?.faceA;
  const faceB = design?.populationStrata?.faceB;
  const pins = MERGED_DESIGN_REVISION_PINS[design?.revision] || null;
  if (!pins) {
    issues.push('merged design revision is not registered');
    return { valid: false, issues };
  }
  if (
    design?.schema !== TUTOR_STUB_RESISTANT_LEARNER_MERGED_DESIGN_SCHEMA_V1 ||
    design?.studyId !== MERGED_ID ||
    design?.status !== 'prospective_zero_call_design_pending_typed_approval' ||
    design?.workplanItem !== 'resistant-learner-strategy-close' ||
    design?.registrationSource !== pins.registrationSource
  ) {
    issues.push('merged design identity drifted');
  }
  if (pins.supersedesPriorDesign) {
    if (
      design?.supersedes?.priorDesign !== pins.supersedesPriorDesign.priorDesign ||
      design?.supersedes?.priorDesignSha256 !== pins.supersedesPriorDesign.priorDesignSha256 ||
      design?.supersedes?.priorDisposition !== pins.supersedesPriorDesign.priorDisposition ||
      design?.supersedes?.reuse !== false
    ) {
      issues.push('merged supersession record drifted');
    }
  } else if (design?.supersedes !== undefined) {
    issues.push('merged revision 1 must not carry a supersession record');
  }
  if (
    !exactValues(design?.supersedesStudyDesigns, [
      'config/tutor-stub-resistant-learner-b1-design.v3.json',
      'config/tutor-stub-resistant-learner-r1-design.v3.json',
    ]) ||
    design?.whichNumberMoves?.poolingAcrossFaces !== false ||
    design?.whichNumberMoves?.faceRole !== 'population_stratum_not_treatment'
  ) {
    issues.push('merged study lineage or no-pooling rule drifted');
  }
  if (
    faceA?.studyCode !== 'B1' ||
    faceA?.population?.profile !== 'bored-rival-dag-v3' ||
    !exactValues(faceA?.population?.worlds, B1_WORLDS) ||
    faceA?.population?.triggerRegistration !==
      'config/tutor-stub-resistant-learner-merged-turn-gate-registration.v1.json' ||
    faceA?.population?.maximumTriggerLearnerTurn !== 4 ||
    faceA?.population?.outcomeHorizonPostTriggerLearnerTurns !== 5 ||
    faceA?.population?.reuseOrPooling !== false ||
    faceA?.rivalDagPersona?.mechanism !== 'content_rivalry' ||
    faceA?.rivalDagPersona?.concessionCondition?.kind !== 'public_tutor_move_bears_on_open_rival_node' ||
    faceA?.tutorMove?.id !== 'ask_discriminating_question' ||
    faceA?.tutorDeliveryContract?.actionInstructions?.ask_discriminating_question !==
      'Ask exactly one sentence ending in one question mark. Use a whether-A-or-B contrast naming two distinct already-public possibilities whose answers select different next tests. Do not ask permission, add another question, or supply either answer.' ||
    faceA?.measurement?.endpointField !== 'final_graded_engagement_rung' ||
    !exactValues(
      faceA?.measurement?.rungs?.map((rung) => rung.score),
      [0, 1, 2],
    ) ||
    faceA?.calibrationRules?.dialogues !== 18
  ) {
    issues.push('merged face-A population, move, ladder, or calibration drifted');
  }
  if (
    faceB?.studyCode !== 'R1' ||
    faceB?.population?.profile !== 'frame_refuser-r1-rival-dag-v3' ||
    !exactValues(faceB?.population?.worlds, ['world_005_marrick', 'world_030_rowan_flat']) ||
    faceB?.population?.triggerRegistration !==
      'config/tutor-stub-resistant-learner-merged-turn-gate-registration.v1.json' ||
    faceB?.population?.maximumTriggerLearnerTurn !== 2 ||
    faceB?.population?.outcomeHorizonPostTriggerLearnerTurns !== pins.faceBHorizon ||
    faceB?.population?.reuseOrPooling !== false ||
    faceB?.rivalDagPersona?.mechanism !== 'standing_rivalry' ||
    faceB?.rivalDagPersona?.concessionCondition?.kind !== 'public_tutor_move_bears_on_open_rival_node' ||
    faceB?.tutorMove?.id !== 'standing_conditions_bridge' ||
    faceB?.tutorMove?.runtimePedagogicalMove !== 'test_bounded_distinction' ||
    faceB?.tutorDeliveryContract?.actionInstructions?.test_bounded_distinction !== pins.faceBActionInstruction ||
    faceB?.measurement?.endpointField !== 'final_graded_engagement_rung' ||
    !exactValues(
      faceB?.measurement?.rungs?.map((rung) => rung.score),
      [0, 1, 2],
    ) ||
    faceB?.measurement?.wholeFrameComplianceNeverScores !== true ||
    faceB?.calibrationRules?.dialogues !== 18
  ) {
    issues.push('merged face-B population, move, ladder, or calibration drifted');
  }
  const bridgeEnforcement = faceB?.rivalDagPersona?.concessionEnforcement;
  if (pins.faceBBridgeEnforcement) {
    if (
      bridgeEnforcement?.schema !== pins.faceBBridgeEnforcement.schema ||
      bridgeEnforcement?.appliesWhen !== pins.faceBBridgeEnforcement.appliesWhen ||
      bridgeEnforcement?.scope !== pins.faceBBridgeEnforcement.scope ||
      bridgeEnforcement?.position !== pins.faceBBridgeEnforcement.position ||
      bridgeEnforcement?.check?.kind !== pins.faceBBridgeEnforcement.checkKind ||
      !exactValues(bridgeEnforcement?.check?.adjudicatorSeat, pins.faceBBridgeEnforcement.adjudicatorSeat) ||
      bridgeEnforcement?.check?.question !== pins.faceBBridgeEnforcement.question ||
      !exactValues(bridgeEnforcement?.check?.labels, pins.faceBBridgeEnforcement.labels) ||
      !exactValues(
        bridgeEnforcement?.check?.rejectedMechanicalChecks?.measurements,
        pins.faceBBridgeEnforcement.mechanicalMeasurements,
      ) ||
      bridgeEnforcement?.repairsAllowedPerEpisode !== pins.faceBBridgeEnforcement.repairsAllowedPerEpisode ||
      bridgeEnforcement?.repairInstruction !== pins.faceBBridgeEnforcement.repairInstruction ||
      bridgeEnforcement?.exhaustionDisposition !== pins.faceBBridgeEnforcement.exhaustionDisposition ||
      bridgeEnforcement?.exhaustionNeverScoredAsRung0 !== true ||
      bridgeEnforcement?.typedFailureIsNotDeterminate !== true
    ) {
      issues.push('merged face-B bridge-step enforcement drifted');
    }
  } else if (bridgeEnforcement !== undefined) {
    issues.push('merged revision must not carry unregistered bridge-step enforcement');
  }
  const faceATutorDeliveryEnforcement = faceA?.tutorDeliveryContract?.enforcement;
  if (pins.faceATutorDeliveryEnforcement) {
    if (!tutorDeliveryEnforcementMatches(faceATutorDeliveryEnforcement, pins.faceATutorDeliveryEnforcement)) {
      issues.push('merged face-A tutor-delivery enforcement drifted');
    }
  } else if (faceATutorDeliveryEnforcement !== undefined) {
    issues.push('merged revision must not carry unregistered face-A tutor-delivery enforcement');
  }
  const tutorDeliveryEnforcement = faceB?.tutorDeliveryContract?.enforcement;
  if (pins.faceBTutorDeliveryEnforcement) {
    if (!tutorDeliveryEnforcementMatches(tutorDeliveryEnforcement, pins.faceBTutorDeliveryEnforcement)) {
      issues.push('merged face-B tutor-delivery enforcement drifted');
    }
  } else if (tutorDeliveryEnforcement !== undefined) {
    issues.push('merged revision must not carry unregistered tutor-delivery enforcement');
  }
  if (
    !exactValues(
      design?.register?.levels?.map((row) => row.id),
      REGISTERS,
    ) ||
    design?.register?.runtimeMapping?.faceA?.edged !== 'sarcastic' ||
    design?.register?.runtimeMapping?.faceB?.edged !== 'ironic' ||
    design?.randomization?.masterSeed !== 2026082401 ||
    design?.calibration?.dialogues !== 36 ||
    design?.calibration?.dialoguesPerFace !== 18 ||
    design?.poweredRun?.authorization !== 'not_granted_by_this_design_or_calibration' ||
    design?.poweredRun?.minimumDialoguesPerFace !== 36 ||
    design?.poweredRun?.maximumDialoguesPerFace !== 180 ||
    design?.callAuthority?.grantsModelCalls !== false ||
    design?.callAuthority?.goNoteRequired !== false
  ) {
    issues.push('merged register, seed, calibration, powered-run, or authority rule drifted');
  }
  if (
    pins.faceAMeasurementSha256 &&
    (canonicalSha256(faceA?.measurement) !== pins.faceAMeasurementSha256 ||
      canonicalSha256(faceB?.measurement) !== pins.faceBMeasurementSha256 ||
      (pins.readerPanelSha256 && canonicalSha256(design?.measurement?.readerPanel) !== pins.readerPanelSha256) ||
      (pins.commonChannelAliveRulesSha256 &&
        canonicalSha256(design?.calibration?.commonChannelAliveRules) !== pins.commonChannelAliveRulesSha256) ||
      canonicalSha256(design?.calibration?.decisionPolicy) !== pins.calibrationDecisionPolicySha256 ||
      design?.claimBoundary !== pins.claimBoundary)
  ) {
    issues.push('merged measurement, calibration decision policy, or claim boundary drifted');
  }
  if (
    design?.measurement?.semanticRegistration !== pins.semanticRegistration ||
    design?.measurement?.readerPanel?.protocolSource !== pins.semanticRegistration ||
    !exactValues(design?.measurement?.readerPanel?.judges, Number(design?.revision) >= 5 ? V5_ENDPOINT_JUDGES : JUDGES)
  ) {
    issues.push('merged semantic registration or reader panel drifted');
  }
  const calls = Object.values(design?.attemptCeilings?.callPlanPerDialogue || {}).reduce(
    (sum, value) => sum + Number(value || 0),
    0,
  );
  const ceilings = design?.attemptCeilings || {};
  if (
    calls !== pins.plannedCallsPerDialogue ||
    ceilings.plannedCallsPerDialogue !== pins.plannedCallsPerDialogue ||
    ceilings.plannedCallsCalibration !== pins.plannedCallsCalibration ||
    ceilings.maximumReservationsPerPlannedCall !== 3 ||
    ceilings.plannedCallReservationCeilingPerDialogue !== pins.plannedCallReservationCeilingPerDialogue ||
    ceilings.authorizationHeadroomReservationsPerDialogue !== 6 ||
    ceilings.maximumReservationsPerDialogue !== pins.maximumReservationsPerDialogue ||
    ceilings.calibrationMaximumReservations !== pins.calibrationMaximumReservations
  ) {
    issues.push('merged attempt ceiling arithmetic drifted');
  }
  try {
    if (!exactValues(design?.models, tutorStubResistantLearnerRuntimeModelRoutes(design))) {
      issues.push('merged model route closure drifted');
    }
  } catch (error) {
    issues.push(`merged model route closure failed: ${error.message}`);
  }
  return { valid: issues.length === 0, issues };
}

export function validateTutorStubResistantLearnerDesign(design) {
  if (isMergedDesign(design)) return validateTutorStubResistantLearnerMergedDesignV1(design);
  const issues = [];
  const studyId = design?.studyId;
  const v1 = design?.schema === DESIGN_SCHEMA_V1;
  const v2 = design?.schema === DESIGN_SCHEMA_V2;
  const v3 = design?.schema === DESIGN_SCHEMA_V3;
  if ((!v1 && !v2 && !v3) || ![B1_ID, R1_ID].includes(studyId)) {
    issues.push('design identity is unsupported');
  }
  const expectedStatus =
    v2 || v3 ? 'prospective_zero_call_design_pending_typed_approval' : 'prospective_zero_call_design_pending_gate_1_go';
  if (design?.status !== expectedStatus) {
    issues.push('design status drifted');
  }
  if (design?.callAuthority?.grantsModelCalls !== false) issues.push('design must not grant model calls');
  if (design?.calibration?.dialogues !== 18) issues.push('calibration must contain 18 dialogues');
  if (!Number.isInteger(design?.randomization?.masterSeed)) issues.push('randomization master seed is missing');
  if (!exactValues(design?.measurement?.readerPanel?.judges, JUDGES)) issues.push('reader panel drifted');
  if ([B1_ID, R1_ID].includes(studyId)) {
    try {
      if (!exactValues(design?.models, tutorStubResistantLearnerRuntimeModelRoutes(design))) {
        issues.push('model route closure drifted');
      }
    } catch (error) {
      issues.push(`model route closure failed: ${error.message}`);
    }
  }
  const calls = Object.values(design?.attemptCeilings?.callPlanPerDialogue || {}).reduce(
    (sum, value) => sum + Number(value || 0),
    0,
  );
  const planned = Number(design?.attemptCeilings?.plannedCallsPerDialogue);
  const plannedReservationCeiling = Number(design?.attemptCeilings?.plannedCallReservationCeilingPerDialogue);
  const perDialogue = Number(design?.attemptCeilings?.maximumReservationsPerDialogue);
  const authorizationHeadroom = Number(design?.attemptCeilings?.authorizationHeadroomReservationsPerDialogue);
  const perCall = Number(design?.attemptCeilings?.maximumReservationsPerPlannedCall);
  if (
    calls !== planned ||
    perCall !== 3 ||
    plannedReservationCeiling !== planned * perCall ||
    authorizationHeadroom !== 6 ||
    perDialogue !== plannedReservationCeiling + authorizationHeadroom ||
    Number(design?.attemptCeilings?.calibrationMaximumReservations) !== perDialogue * 18
  ) {
    issues.push('attempt ceiling arithmetic drifted');
  }
  if (studyId === B1_ID) {
    const actions = design?.factors?.action?.levels || [];
    if (
      v1 &&
      (design?.revision !== 4 ||
        design?.operatorAmendment?.priorDesignSha256 !==
          '8bd814ed97cc572f11b1b316432c8e2f52db36ca85ae152c668cf48e28260b75' ||
        design?.operatorAmendment?.outcomeBlind !== true ||
        design?.supersedes?.priorDesignSha256 !== '03235175002fdab1a28492a809215df8744eba8f1eac25eb99126e786c37d1bb' ||
        design?.supersedes?.priorDisposition !==
          'void_technical_route_authorization_mismatch_no_calibration_unit_completed' ||
        design?.supersedes?.earlierTechnicalStop?.priorDesignSha256 !==
          'f007fb9ad6be419035a07f2ef8409a233f0b994ae2bf62e827d5c7770945c157' ||
        design?.supersedes?.reuse !== false ||
        design?.population?.profile !== 'bored' ||
        !exactValues(design?.population?.worlds, B1_WORLDS) ||
        !exactValues(
          actions.map((row) => row.id),
          Object.keys(B1_ACTION_LEVEL),
        ) ||
        !exactValues(
          design?.factors?.register?.levels?.map((row) => row.id),
          REGISTERS,
        ) ||
        !exactValues(design?.factors?.register?.runtimeMapping?.edgedByAction, {
          ask_discriminating_question: 'sarcastic',
          stage_public_evidence_for_next_step: 'ironic',
        }) ||
        design?.population?.outcomeHorizonPostTriggerLearnerTurns !== 5 ||
        design?.randomization?.masterSeed !== 2026082301)
    ) {
      issues.push('B1 population, factors, horizon, or seed drifted');
    }
    if (
      v2 &&
      (design?.revision !== 1 ||
        design?.supersedesDesign !== 'config/tutor-stub-resistant-learner-b1-design.v1.json' ||
        design?.population?.profile !== 'bored-rival-dag-v2' ||
        design?.population?.baseCompatibilityId !== 'bored' ||
        !exactValues(design?.population?.worlds, B1_WORLDS) ||
        !exactValues(
          actions.map((row) => row.id),
          Object.keys(B1_ACTION_LEVEL),
        ) ||
        !exactValues(
          design?.factors?.register?.levels?.map((row) => row.id),
          REGISTERS,
        ) ||
        design?.rivalDagPersona?.mechanism !== 'content_rivalry' ||
        design?.rivalDagPersona?.concessionCondition?.kind !== 'public_tutor_move_bears_on_open_rival_node' ||
        design?.rivalDagPersona?.concessionCondition?.matchingAlgorithm?.id !== 'normalized_public_token_overlap_v1' ||
        design?.measurement?.primaryEndpoint?.id !== 'learner_authored_tutor_or_bridge_pickup_within_five_turns' ||
        design?.measurement?.readerPanel?.protocolSource !==
          'config/tutor-stub-resistant-learner-semantic-registration.v2.json' ||
        design?.population?.outcomeHorizonPostTriggerLearnerTurns !== 5 ||
        design?.randomization?.masterSeed !== 2026082301)
    ) {
      issues.push('B1 v2 rival-DAG design drifted');
    }
    if (
      v3 &&
      (design?.revision !== 1 ||
        design?.supersedesDesign !== 'config/tutor-stub-resistant-learner-b1-design.v2.json' ||
        design?.population?.profile !== 'bored-rival-dag-v3' ||
        design?.population?.baseCompatibilityId !== 'bored' ||
        design?.population?.triggerRegistration !==
          'config/tutor-stub-resistant-learner-b1-trigger-registration.v3.json' ||
        design?.population?.trigger !==
          'first determinate public turn that performs new evidence-bearing work on the rival objective rather than the tutor-world thread, no later than learner turn 4' ||
        !exactValues(design?.population?.worlds, B1_WORLDS) ||
        !exactValues(
          actions.map((row) => row.id),
          Object.keys(B1_ACTION_LEVEL),
        ) ||
        design?.rivalDagPersona?.mechanism !== 'content_rivalry' ||
        design?.rivalDagPersona?.concessionCondition?.kind !== 'public_tutor_move_bears_on_open_rival_node' ||
        design?.rivalDagPersona?.concessionCondition?.matchingAlgorithm?.id !== 'normalized_public_token_overlap_v1' ||
        design?.measurement?.primaryEndpoint?.id !== 'learner_authored_tutor_or_bridge_pickup_within_five_turns' ||
        design?.measurement?.readerPanel?.protocolSource !==
          'config/tutor-stub-resistant-learner-semantic-registration.v2.json' ||
        design?.models?.triggerObservation?.semantics !== TUTOR_STUB_RIVAL_ATTENTION_OBSERVATION_V3 ||
        design?.population?.outcomeHorizonPostTriggerLearnerTurns !== 5 ||
        design?.randomization?.masterSeed !== 2026082301)
    ) {
      issues.push('B1 v3 rival-attention design drifted');
    }
  }
  if (studyId === R1_ID) {
    if (
      v1 &&
      (design?.revision !== 3 ||
        design?.operatorAmendment?.priorDesignSha256 !==
          'b0d328594a2a0dc51543b44836e5a5d827955d404572c2b682d36a2d3e97c95e' ||
        design?.operatorAmendment?.outcomeBlind !== true ||
        design?.supersedes?.priorDesignSha256 !== '28e961c68c8a7ce989f2b05d7182646f3fd9665a9954e1ebded5efe5239a0946' ||
        design?.supersedes?.priorDisposition !== 'void_technical_route_authorization_mismatch_r1_not_started' ||
        design?.supersedes?.reuse !== false ||
        design?.personaContract?.id !== 'frame_refuser-r1-v1' ||
        !exactValues(design?.population?.worlds, ['world_005_marrick', 'world_030_rowan_flat']) ||
        !exactValues(
          design?.register?.levels?.map((row) => row.id),
          REGISTERS,
        ) ||
        design?.register?.runtimeMapping?.edged !== 'ironic' ||
        design?.intervention?.action !== 'test_bounded_distinction' ||
        design?.population?.outcomeHorizonPostTriggerLearnerTurns !== 6 ||
        design?.randomization?.masterSeed !== 2026082302)
    ) {
      issues.push('R1 persona, worlds, intervention, horizon, or seed drifted');
    }
    if (
      v2 &&
      (design?.revision !== 1 ||
        design?.supersedesDesign !== 'config/tutor-stub-resistant-learner-r1-design.v1.json' ||
        design?.population?.profile !== 'frame_refuser-r1-rival-dag-v2' ||
        design?.population?.baseCompatibilityId !== 'frame_refuser' ||
        !exactValues(design?.population?.worlds, ['world_005_marrick', 'world_030_rowan_flat']) ||
        !exactValues(
          design?.register?.levels?.map((row) => row.id),
          REGISTERS,
        ) ||
        design?.rivalDagPersona?.mechanism !== 'standing_rivalry' ||
        design?.rivalDagPersona?.concessionCondition?.kind !== 'public_tutor_move_bears_on_open_rival_node' ||
        design?.rivalDagPersona?.concessionCondition?.matchingAlgorithm?.id !== 'normalized_public_token_overlap_v1' ||
        design?.intervention?.action !== 'test_bounded_distinction' ||
        design?.measurement?.primaryEndpoint?.id !== 'final_graded_rival_frame_engagement_at_six_turns' ||
        design?.measurement?.readerPanel?.protocolSource !==
          'config/tutor-stub-resistant-learner-semantic-registration.v2.json' ||
        design?.population?.outcomeHorizonPostTriggerLearnerTurns !== 6 ||
        design?.randomization?.masterSeed !== 2026082302)
    ) {
      issues.push('R1 v2 rival-DAG design drifted');
    }
    if (
      v3 &&
      (design?.revision !== 1 ||
        design?.supersedesDesign !== 'config/tutor-stub-resistant-learner-r1-design.v2.json' ||
        design?.population?.profile !== 'frame_refuser-r1-rival-dag-v3' ||
        design?.population?.baseCompatibilityId !== 'frame_refuser' ||
        design?.population?.triggerRegistration !==
          'config/tutor-stub-resistant-learner-r1-turn-gate-registration.v3.json' ||
        !exactValues(design?.population?.worlds, ['world_005_marrick', 'world_030_rowan_flat']) ||
        design?.rivalDagPersona?.mechanism !== 'standing_rivalry' ||
        design?.rivalDagPersona?.concessionCondition?.kind !== 'public_tutor_move_bears_on_open_rival_node' ||
        design?.rivalDagPersona?.concessionCondition?.matchingAlgorithm?.id !== 'normalized_public_token_overlap_v1' ||
        design?.intervention?.action !== 'test_bounded_distinction' ||
        design?.measurement?.primaryEndpoint?.id !== 'final_graded_rival_frame_engagement_at_six_turns' ||
        design?.measurement?.readerPanel?.protocolSource !==
          'config/tutor-stub-resistant-learner-semantic-registration.v2.json' ||
        design?.models?.triggerObservation?.semantics !== TUTOR_STUB_STANDING_RIVALRY_OBSERVATION_V3 ||
        design?.population?.outcomeHorizonPostTriggerLearnerTurns !== 6 ||
        design?.randomization?.masterSeed !== 2026082302)
    ) {
      issues.push('R1 v3 standing-rivalry design drifted');
    }
  }
  return { valid: issues.length === 0, issues };
}

export function loadTutorStubResistantLearnerDesign({ designPath, root = process.cwd() } = {}) {
  const absolute = path.resolve(root, designPath || '');
  const source = fs.readFileSync(absolute);
  const design = JSON.parse(source);
  const validation = validateTutorStubResistantLearnerDesign(design);
  if (!validation.valid) throw new Error(`resistant-learner design invalid: ${validation.issues.join('; ')}`);
  return { path: absolute, source, sha256: sha256(source), design };
}

function ranked(values, seed, block) {
  return values
    .map((value) => ({ value, rank_sha256: sha256(`${seed}:${block}:${value}`) }))
    .sort((left, right) => left.rank_sha256.localeCompare(right.rank_sha256));
}

function orderedJobs(jobs, seed) {
  return jobs
    .map((job) => ({ ...job, order_sha256: sha256(`${seed}:job-order:${job.id}`) }))
    .sort((left, right) => left.order_sha256.localeCompare(right.order_sha256))
    .map((job, index) => ({ ...job, assignment_index: index + 1, run_seed: seed * 100 + index + 1 }));
}

function buildB1Jobs(design) {
  const seed = design.randomization.masterSeed;
  const worlds = design.population.worlds;
  const jobs = [];
  for (const register of REGISTERS) {
    const rankedWorlds = ranked(worlds, seed, `B1:${register}`);
    for (const [index, rankedWorld] of rankedWorlds.entries()) {
      const action = index < worlds.length / 2 ? 'ask_discriminating_question' : 'stage_public_evidence_for_next_step';
      const world = rankedWorld.value;
      jobs.push({
        id: `B1-cal-${register}-${world}`,
        study: 'B1',
        world,
        register,
        action,
        pedagogical_move: action,
        pedagogical_move_level: B1_ACTION_LEVEL[action],
        host_action_family: tutorStubResistanceHostActionFamily(action),
        maximum_trigger_turn: 4,
        outcome_horizon_learner_turns: 5,
        allocation_rank_sha256: rankedWorld.rank_sha256,
      });
    }
  }
  return orderedJobs(jobs, seed).map((job, index) => ({
    ...job,
    batch_id: `batch_${String(Math.floor(index / 6) + 1).padStart(2, '0')}`,
    seed: job.run_seed,
    realization: job.register,
    assignment_manifest_sha256: canonicalSha256({
      id: job.id,
      world: job.world,
      register: job.register,
      action: job.action,
      seed: job.run_seed,
    }),
    assignment_rank_sha256: job.order_sha256,
  }));
}

function buildR1Jobs(design) {
  const seed = design.randomization.masterSeed;
  const jobs = [];
  for (const world of design.population.worlds) {
    for (const register of REGISTERS) {
      for (let repeat = 1; repeat <= 3; repeat += 1) {
        jobs.push({
          id: `R1-cal-${world}-${register}-r${repeat}`,
          study: 'R1',
          world,
          register,
          action: 'test_bounded_distinction',
          pedagogical_move: 'test_bounded_distinction',
          host_action_family: tutorStubResistanceHostActionFamily('test_bounded_distinction'),
          maximum_trigger_turn: 2,
          outcome_horizon_learner_turns: 6,
          repeat,
        });
      }
    }
  }
  return orderedJobs(jobs, seed).map((job, index) => ({
    ...job,
    batch_id: `batch_${String(Math.floor(index / 6) + 1).padStart(2, '0')}`,
    realization: job.register,
  }));
}

function buildMergedJobs(design) {
  const seed = design.randomization.masterSeed;
  const faceA = mergedFace(design, 'faceA');
  const faceB = mergedFace(design, 'faceB');
  const jobs = [];
  for (const register of REGISTERS) {
    for (const rankedWorld of ranked(faceA.population.worlds, seed, `faceA:${register}`)) {
      const world = rankedWorld.value;
      jobs.push({
        id: `merged-faceA-cal-${register}-${world}`,
        study: 'B1',
        face_id: 'faceA',
        face: faceA.id,
        world,
        register,
        action: 'ask_discriminating_question',
        registered_move_id: faceA.tutorMove.id,
        pedagogical_move: 'ask_discriminating_question',
        pedagogical_move_level: 'ask_question',
        host_action_family: tutorStubResistanceHostActionFamily('ask_discriminating_question'),
        maximum_trigger_turn: faceA.population.maximumTriggerLearnerTurn,
        outcome_horizon_learner_turns: faceA.population.outcomeHorizonPostTriggerLearnerTurns,
        allocation_rank_sha256: rankedWorld.rank_sha256,
      });
    }
  }
  for (const world of faceB.population.worlds) {
    for (const register of REGISTERS) {
      for (let repeat = 1; repeat <= 3; repeat += 1) {
        jobs.push({
          id: `merged-faceB-cal-${world}-${register}-r${repeat}`,
          study: 'R1',
          face_id: 'faceB',
          face: faceB.id,
          world,
          register,
          action: faceB.tutorMove.runtimePedagogicalMove,
          registered_move_id: faceB.tutorMove.id,
          pedagogical_move: faceB.tutorMove.runtimePedagogicalMove,
          host_action_family: tutorStubResistanceHostActionFamily(faceB.tutorMove.runtimePedagogicalMove),
          maximum_trigger_turn: faceB.population.maximumTriggerLearnerTurn,
          outcome_horizon_learner_turns: faceB.population.outcomeHorizonPostTriggerLearnerTurns,
          repeat,
        });
      }
    }
  }
  return orderedJobs(jobs, seed).map((job, index) => ({
    ...job,
    batch_id: `batch_${String(Math.floor(index / 6) + 1).padStart(2, '0')}`,
    seed: job.run_seed,
    realization: job.register,
    assignment_manifest_sha256: canonicalSha256({
      id: job.id,
      face: job.face_id,
      world: job.world,
      register: job.register,
      action: job.action,
      seed: job.run_seed,
    }),
    assignment_rank_sha256: job.order_sha256,
  }));
}

function buildMergedPoweredJobs(design, blocksPerFace) {
  const seed = design.randomization.masterSeed;
  const faceA = mergedFace(design, 'faceA');
  const faceB = mergedFace(design, 'faceB');
  const jobs = [];
  for (let block = 1; block <= blocksPerFace; block += 1) {
    const blockId = `b${String(block).padStart(2, '0')}`;
    for (const register of REGISTERS) {
      for (const rankedWorld of ranked(faceA.population.worlds, seed, `faceA:powered-${blockId}:${register}`)) {
        const world = rankedWorld.value;
        jobs.push({
          id: `merged-faceA-pow-${blockId}-${register}-${world}`,
          study: 'B1',
          face_id: 'faceA',
          face: faceA.id,
          block: blockId,
          world,
          register,
          action: 'ask_discriminating_question',
          registered_move_id: faceA.tutorMove.id,
          pedagogical_move: 'ask_discriminating_question',
          pedagogical_move_level: 'ask_question',
          host_action_family: tutorStubResistanceHostActionFamily('ask_discriminating_question'),
          maximum_trigger_turn: faceA.population.maximumTriggerLearnerTurn,
          outcome_horizon_learner_turns: faceA.population.outcomeHorizonPostTriggerLearnerTurns,
          allocation_rank_sha256: rankedWorld.rank_sha256,
        });
      }
    }
    for (const world of faceB.population.worlds) {
      for (const register of REGISTERS) {
        for (let repeat = 1; repeat <= 3; repeat += 1) {
          jobs.push({
            id: `merged-faceB-pow-${blockId}-${world}-${register}-r${repeat}`,
            study: 'R1',
            face_id: 'faceB',
            face: faceB.id,
            block: blockId,
            world,
            register,
            action: faceB.tutorMove.runtimePedagogicalMove,
            registered_move_id: faceB.tutorMove.id,
            pedagogical_move: faceB.tutorMove.runtimePedagogicalMove,
            host_action_family: tutorStubResistanceHostActionFamily(faceB.tutorMove.runtimePedagogicalMove),
            maximum_trigger_turn: faceB.population.maximumTriggerLearnerTurn,
            outcome_horizon_learner_turns: faceB.population.outcomeHorizonPostTriggerLearnerTurns,
            repeat,
          });
        }
      }
    }
  }
  return jobs
    .map((job) => ({ ...job, order_sha256: sha256(`${seed}:powered-job-order:${job.id}`) }))
    .sort((left, right) => left.order_sha256.localeCompare(right.order_sha256))
    .map((job, index) => ({ ...job, assignment_index: index + 1, run_seed: seed * 1000 + index + 1 }))
    .map((job, index) => ({
      ...job,
      batch_id: `batch_${String(Math.floor(index / 6) + 1).padStart(2, '0')}`,
      seed: job.run_seed,
      realization: job.register,
      assignment_manifest_sha256: canonicalSha256({
        id: job.id,
        face: job.face_id,
        world: job.world,
        register: job.register,
        action: job.action,
        seed: job.run_seed,
      }),
      assignment_rank_sha256: job.order_sha256,
    }));
}

export function buildTutorStubResistantLearnerPoweredPlan(design, { dialoguesPerFace } = {}) {
  const validation = validateTutorStubResistantLearnerDesign(design);
  if (!validation.valid) throw new Error(`resistant-learner design invalid: ${validation.issues.join('; ')}`);
  if (!isMergedDesign(design)) throw new Error('the powered plan requires the merged v1 design');
  const faceA = mergedFace(design, 'faceA');
  const faceB = mergedFace(design, 'faceB');
  const faceABlock = faceA.population.worlds.length * REGISTERS.length;
  const faceBBlock = faceB.population.worlds.length * REGISTERS.length * 3;
  if (faceABlock !== faceBBlock) throw new Error('merged powered blocks require equal face block sizes');
  const bounds = design.poweredRun || {};
  if (
    !Number.isInteger(dialoguesPerFace) ||
    dialoguesPerFace % faceABlock !== 0 ||
    dialoguesPerFace < bounds.minimumDialoguesPerFace ||
    dialoguesPerFace > bounds.maximumDialoguesPerFace
  ) {
    throw new Error(
      `powered dialogues per face must be a multiple of ${faceABlock} between ${bounds.minimumDialoguesPerFace} and ${bounds.maximumDialoguesPerFace}`,
    );
  }
  const blocksPerFace = dialoguesPerFace / faceABlock;
  const jobs = buildMergedPoweredJobs(design, blocksPerFace);
  const expectedJobs = dialoguesPerFace * 2;
  if (jobs.length !== expectedJobs || new Set(jobs.map((job) => job.id)).size !== expectedJobs) {
    throw new Error(`resistant-learner powered plan requires ${expectedJobs} unique jobs`);
  }
  const plan = {
    schema: 'machinespirits.tutor-stub.resistant-learner-merged-powered-plan.v1',
    status: 'planned_zero_call',
    phase: 'powered',
    study_id: design.studyId,
    master_seed: design.randomization.masterSeed,
    dialogues_per_face: dialoguesPerFace,
    blocks_per_face: blocksPerFace,
    jobs,
  };
  plan.assignment_sha256 = canonicalSha256(jobs);
  return plan;
}

export function buildTutorStubResistantLearnerCalibrationPlan(design) {
  const validation = validateTutorStubResistantLearnerDesign(design);
  if (!validation.valid) throw new Error(`resistant-learner design invalid: ${validation.issues.join('; ')}`);
  const merged = isMergedDesign(design);
  const jobs = merged ? buildMergedJobs(design) : design.studyId === B1_ID ? buildB1Jobs(design) : buildR1Jobs(design);
  const expectedJobs = merged ? 36 : 18;
  if (jobs.length !== expectedJobs || new Set(jobs.map((job) => job.id)).size !== expectedJobs) {
    throw new Error(`resistant-learner calibration requires ${expectedJobs} unique jobs`);
  }
  const plan = {
    schema: merged
      ? 'machinespirits.tutor-stub.resistant-learner-merged-calibration-plan.v1'
      : 'machinespirits.tutor-stub.resistant-learner-calibration-plan.v1',
    status: 'planned_zero_call',
    study_id: design.studyId,
    master_seed: design.randomization.masterSeed,
    jobs,
  };
  plan.assignment_sha256 = canonicalSha256(jobs);
  return plan;
}

export function tutorStubFrameRefuserR1Prompt(design) {
  const contract = design?.personaContract;
  if (contract?.id !== 'frame_refuser-r1-v1') throw new Error('R1 prompt requires frame_refuser-r1-v1');
  const section = (title, lines) => [title, ...(lines || []).map((line) => `- ${line}`), ''];
  return [
    'You are simulating this automated learner profile: frame_refuser',
    '',
    `Private prospective contract: ${contract.id}`,
    '',
    ...section('Voice:', contract.voice),
    ...section('Initial state:', contract.initialState),
    ...section('After a bounded local test:', contract.afterBoundedLocalTest),
    `Epistemic freedom: ${contract.epistemicFreedom}`,
    '',
    ...section('Public-turn rules:', contract.publicTurnRules),
    'Apply this private contract to every learner turn. Never quote, name, or describe the contract.',
  ].join('\n');
}

function configureB1({ state, root, loaded, plan, job, appendTraceEvent }) {
  const template = JSON.parse(fs.readFileSync(path.join(root, BOREDOM_TEMPLATE), 'utf8'));
  template.design.treatment.realizations = [...REGISTERS];
  if ([DESIGN_SCHEMA_V3, TUTOR_STUB_RESISTANT_LEARNER_MERGED_DESIGN_SCHEMA_V1].includes(loaded.design.schema)) {
    template.design.observationSemantics = loaded.design.models.triggerObservation.semantics;
    template.measurement.semanticAdjudicator = {
      schema: 'machinespirits.tutor-stub.rival-attention-adjudication.v3',
      modelRef: 'codex.gpt-5.6-sol',
      role: 'tutor_stub_resistant_learner_rival_attention_judge',
      registrationPath: loaded.design.population.triggerRegistration,
    };
  }
  const runtimeLoaded = {
    ...loaded,
    registration: template,
    plan: {
      ...plan,
      batches: [...new Set(plan.jobs.map((row) => row.batch_id))].map((id) => ({ id })),
    },
  };
  configureTutorStubBoredomProofDagExecution({ state, loaded: runtimeLoaded, jobId: job.id, appendTraceEvent });
  Object.assign(state.resistanceActionRegisterStudy, {
    resistant_learner_calibration: true,
    resistant_learner_study: 'B1',
    design: structuredClone(loaded.design),
    design_path: path.relative(root, loaded.path),
    design_sha256: loaded.sha256,
    assignment_index: job.assignment_index,
  });
  if (isRivalDagDesign(loaded.design)) {
    state.resistanceActionRegisterStudy.study_assignment_instruction_overrides = structuredClone(
      loaded.design.tutorDeliveryContract,
    );
    state.privateRivalLearnerDag = mintTutorStubRivalLearnerDag({ design: loaded.design, job, root });
  }
}

function configureR1({ state, root, loaded, job, appendTraceEvent }) {
  const base = loadTutorStubResistanceActionRegisterRegistration(path.join(root, REFUSER_TEMPLATE));
  const runtime = createTutorStubResistanceActionRegisterStudyRuntime({
    registration: base.registration,
    registrationPath: REFUSER_TEMPLATE,
    registrationSha256: base.sha256,
    profile: 'frame_refuser',
    actionFit: 'matched',
    realization: 'plain',
    repeat: 'block_01',
  });
  runtime.registration.design.world = job.world;
  if ([DESIGN_SCHEMA_V3, TUTOR_STUB_RESISTANT_LEARNER_MERGED_DESIGN_SCHEMA_V1].includes(loaded.design.schema)) {
    runtime.registration.design.trigger.observationSemantics = loaded.design.models.triggerObservation.semantics;
  }
  runtime.registration.design.factors.realization = Object.fromEntries([
    ['levels', [...REGISTERS]],
    ['plain', 'plain'],
    ['warm', 'warm'],
    ['edgedByAssignedMove', { test_bounded_distinction: 'ironic' }],
    ['edgeFollowsAssignedMoveNotLearnerProfile', true],
    ['faceThreatExcluded', true],
  ]);
  runtime.realization = job.register;
  runtime.repeat = job.batch_id;
  state.resistanceActionRegisterStudy = {
    ...runtime,
    dynamic_confirmation: true,
    resistant_learner_calibration: true,
    resistant_learner_study: 'R1',
    design: structuredClone(loaded.design),
    design_path: path.relative(root, loaded.path),
    design_sha256: loaded.sha256,
    engineering_smoke_excluded_from_confirmation: false,
    job_id: job.id,
    batch_id: job.batch_id,
    assignment_index: job.assignment_index,
    prefix_id: null,
    trigger_turn: null,
    trigger_learner_text: null,
    trigger_learner_sha256: null,
    maximum_trigger_turn: job.maximum_trigger_turn,
    outcome_horizon_learner_turns: job.outcome_horizon_learner_turns,
    final_learner_without_tutor_reply: true,
    ...(isRivalDagDesign(loaded.design)
      ? { study_assignment_instruction_overrides: structuredClone(loaded.design.tutorDeliveryContract) }
      : {}),
  };
  if (isRivalDagDesign(loaded.design)) {
    state.privateRivalLearnerDag = mintTutorStubRivalLearnerDag({ design: loaded.design, job, root });
  }
  appendTraceEvent(state.trace, {
    type: 'resistant_learner_calibration_execution_start',
    study: 'R1',
    jobId: job.id,
    batchId: job.batch_id,
    assignmentIndex: job.assignment_index,
    runSeed: job.run_seed,
    world: job.world,
    designPath: path.relative(root, loaded.path),
    designSha256: loaded.sha256,
    treatment: {
      profile: isRivalDagDesign(loaded.design) ? loaded.design.population.profile : 'frame_refuser-r1-v1',
      action: job.action,
      host_action_family: job.host_action_family,
      register: job.register,
    },
    triggerEligibleByTurn: job.maximum_trigger_turn,
    outcomeHorizonLearnerTurns: job.outcome_horizon_learner_turns,
    freshIndependentDialogue: true,
    priorDialogueReusedOrPooled: false,
    publicTranscriptChanged: false,
  });
}

export function configureTutorStubResistantLearnerCalibrationFromCli({
  args,
  state,
  root,
  autoLearnerEnabled,
  autoLearnerProfileId,
  autoTurns,
  appendTraceEvent,
  observationSemantics,
} = {}) {
  const designPath = args?.['resistant-learner-calibration-design'];
  const jobId = args?.['resistant-learner-calibration-job'];
  const poweredDialoguesPerFace = String(args?.['resistant-learner-powered-dialogues-per-face'] || '').trim();
  const loaded = loadTutorStubResistantLearnerDesign({ designPath, root });
  const plan = poweredDialoguesPerFace
    ? buildTutorStubResistantLearnerPoweredPlan(loaded.design, {
        dialoguesPerFace: Number(poweredDialoguesPerFace),
      })
    : buildTutorStubResistantLearnerCalibrationPlan(loaded.design);
  const job = plan.jobs.find((candidate) => candidate.id === jobId);
  if (!job) throw new Error(`resistant-learner calibration job ${JSON.stringify(jobId)} is not registered`);
  const b1 = job.study === 'B1';
  const executionDesign = isMergedDesign(loaded.design)
    ? tutorStubResistantLearnerMergedFaceDesign(loaded.design, job.face_id)
    : loaded.design;
  const executionLoaded = { ...loaded, design: executionDesign };
  const expectedTurns = job.maximum_trigger_turn + job.outcome_horizon_learner_turns;
  const expectedObservation = executionDesign.models.triggerObservation.semantics;
  const budget = Number(args['model-call-budget']);
  if (
    !state ||
    state.turns?.length ||
    state.history?.length ||
    !autoLearnerEnabled ||
    Number(autoTurns) !== expectedTurns ||
    !Number.isInteger(budget) ||
    budget < 1 ||
    budget > executionDesign.attemptCeilings.maximumReservationsPerDialogue ||
    args.model !== 'codex.gpt-5.6-luna' ||
    args['classifier-model'] !== 'codex.gpt-5.6-luna' ||
    args['learner-record-model'] !== 'codex.gpt-5.6-luna' ||
    args['auto-learner-model'] !== 'codex.gpt-5.6-luna' ||
    args['cli-effort'] !== 'low' ||
    args.world !== job.world ||
    autoLearnerProfileId !== (b1 ? 'bored' : 'frame_refuser') ||
    Number(args['run-seed']) !== job.run_seed ||
    Number(args['eval-repeat']) !== job.assignment_index ||
    args['eval-job-id'] !== job.id ||
    args['acknowledge-research-use'] !== true ||
    args['dag-mode'] !== 'strict_dag' ||
    args['register-policy'] !== 'field' ||
    args['register-palette'] !== 'warm,plain,ironic,sarcastic' ||
    observationSemantics !== expectedObservation
  ) {
    throw new Error('resistant-learner calibration launch pins or per-dialogue ceiling drifted');
  }
  if (b1) configureB1({ state, root, loaded: executionLoaded, plan, job, appendTraceEvent });
  else configureR1({ state, root, loaded: executionLoaded, job, appendTraceEvent });
  if (args['resistant-learner-bridge-smoke-skip-final-readers'] === true) {
    if (loaded.design.schema !== 'machinespirits.tutor-stub.resistant-learner-study-design.v3') {
      throw new Error('the unregistered rival-DAG bridge smoke requires a v3 resistant-learner design');
    }
    state.resistanceActionRegisterStudy.unregistered_bridge_smoke = true;
    state.resistanceActionRegisterStudy.skip_final_semantic_readers = true;
    appendTraceEvent(state.trace, {
      type: 'resistant_learner_bridge_smoke_configuration',
      jobId: job.id,
      finalReadersSkipped: true,
      finalReaderCallsPlanned: 0,
      publicTranscriptChanged: false,
    });
  }
  return { loaded, plan, job };
}

function preflightScene(kind) {
  return {
    learnerText: 'I dispute the wider frame and have stopped following this thread.',
    publicQuestion: 'What does the public record support, rule out, or leave open?',
    responseCompositionFrame: {
      discourse_plane: { plane: 'inquiry' },
      learner_move: { evidence_use: 'none' },
      learner_dag: { bottleneck: null, final_secret_entailed: false, asserted_secret: false },
      due_evidence_surfaces:
        kind === 'due_clue' ? ['The public ledger records two deliveries during the bounded interval.'] : [],
    },
  };
}

function safetyOverrideProbe(compiled) {
  if (!compiled.edged_safety_override_supported) return { required: false, passed: true };
  const selection = {
    response_configuration: {},
    resistance_action_register_intervention: {
      status: 'applied',
      assignment: { register: compiled.delivered_register },
      safety_override: {
        applied: false,
        assigned_register: compiled.delivered_register,
        delivered_register: compiled.delivered_register,
        reason: null,
      },
    },
  };
  const suppressed = applyTutorStubResistanceActionRegisterSafetyOverride(selection, {
    reason: 'protected_affect',
  });
  return {
    required: true,
    passed:
      suppressed.selected_register === 'plain' &&
      suppressed.resistance_action_register_intervention?.status === 'safety_override_nonadherent' &&
      suppressed.resistance_action_register_intervention?.safety_override?.assigned_register ===
        compiled.delivered_register,
    observed: suppressed.resistance_action_register_intervention?.safety_override || null,
  };
}

function auditRuntimeWorldRegistry(worlds, root) {
  const worldDirectory = path.join(root, 'config', 'drama-derivation');
  const productionWorldIds = new Set(
    fs
      .readdirSync(worldDirectory)
      .filter((name) => /^world-.*\.yaml$/u.test(name))
      .map((name) => loadWorld(path.join(worldDirectory, name)))
      .filter((world) => world.eligibility?.status === 'production')
      .map((world) => world.id),
  );
  const missing = worlds.filter((world) => !productionWorldIds.has(world));
  return {
    checked_worlds: [...worlds],
    production_world_count: productionWorldIds.size,
    missing_or_nonproduction_worlds: missing,
    passed: missing.length === 0,
  };
}

function runTutorStubResistantLearnerMergedCompilationPreflight({ loaded, root }) {
  const design = loaded.design;
  const plan = buildTutorStubResistantLearnerCalibrationPlan(design);
  const faceDesigns = {
    faceA: tutorStubResistantLearnerMergedFaceDesign(design, 'faceA'),
    faceB: tutorStubResistantLearnerMergedFaceDesign(design, 'faceB'),
  };
  const allWorlds = [...new Set(Object.values(faceDesigns).flatMap((face) => face.population.worlds))];
  const worldRegistry = auditRuntimeWorldRegistry(allWorlds, root);
  const runtimeModelRoutes = tutorStubResistantLearnerRuntimeModelRoutes(design);
  const modelRoute = {
    declared: design.models,
    runtime: runtimeModelRoutes,
    passed: exactValues(design.models, runtimeModelRoutes),
  };
  const rivalDags = plan.jobs.map((job) =>
    mintTutorStubRivalLearnerDag({ design: faceDesigns[job.face_id], job, root }),
  );
  const configurations = Object.entries(faceDesigns).flatMap(([faceId, faceDesign]) =>
    faceDesign.population.worlds.flatMap((world) =>
      REGISTERS.map((register) => {
        const configurationJob = plan.jobs.find(
          (job) => job.face_id === faceId && job.world === world && job.register === register,
        );
        return { faceId, faceDesign, configurationJob };
      }),
    ),
  );
  const rows = [];
  for (const { faceId, faceDesign, configurationJob } of configurations) {
    for (const scene of ['bare', 'due_clue']) {
      const state = {
        trace: [],
        turns: [],
        history: [],
        register: { palette: ['warm', 'plain', 'ironic', 'sarcastic'], history: [], policy: 'field' },
        world: {},
      };
      const faceLoaded = { ...loaded, design: faceDesign };
      if (configurationJob.study === 'B1') {
        configureB1({ state, root, loaded: faceLoaded, plan, job: configurationJob, appendTraceEvent() {} });
      } else {
        configureR1({ state, root, loaded: faceLoaded, job: configurationJob, appendTraceEvent() {} });
      }
      const compiled = compileTutorStubResistanceActionRegisterStudyAssignment(state.resistanceActionRegisterStudy);
      const registeredQuestionRule = configurationJob.study === 'B1' ? 'requires_question' : null;
      const progression = compileTutorStubTurnProgressionContract({
        ...preflightScene(scene),
        actionFamily: compiled.host_action_family,
        registeredQuestionRule,
      });
      const safety = safetyOverrideProbe(compiled);
      const rivalDag = mintTutorStubRivalLearnerDag({ design: faceDesign, job: configurationJob, root });
      const personaPrompt = tutorStubRivalLearnerDagPrompt({ design: faceDesign, job: configurationJob, root });
      const issues = [];
      if (compiled.pedagogical_move !== configurationJob.action) issues.push('pedagogical_move_drift');
      if (compiled.assigned_realization !== configurationJob.register) issues.push('assigned_realization_drift');
      if (!String(compiled.action_instruction || '').includes('public'))
        issues.push('public_evidence_boundary_missing');
      if (!String(compiled.realization_contrast_instruction || '').trim()) issues.push('register_instruction_missing');
      if (configurationJob.study === 'B1') {
        if (progression.handoff_contract.question_allowed !== true) issues.push('question_permission_drift');
        if (
          !/exactly one sentence/iu.test(compiled.action_instruction) ||
          !/whether-A-or-B/iu.test(compiled.action_instruction)
        ) {
          issues.push('face_A_discriminating_question_contract_incomplete');
        }
      } else {
        if (
          !/disputed standing/iu.test(compiled.action_instruction) ||
          !/in its own words/iu.test(compiled.action_instruction) ||
          !/under protest/iu.test(compiled.action_instruction) ||
          !/wider frame disputed/iu.test(compiled.action_instruction) ||
          !/do not state the result/iu.test(compiled.action_instruction)
        ) {
          issues.push('face_B_standing_conditions_bridge_contract_incomplete');
        }
      }
      if (!safety.passed) issues.push('protected_affect_guard_failed');
      if (compiled.instruction_source !== 'study_design_override') issues.push('merged_delivery_contract_not_compiled');
      if (
        configurationJob.register === 'plain' &&
        !/concise neutral/iu.test(compiled.realization_contrast_instruction)
      ) {
        issues.push('plain_register_contract_incomplete');
      }
      if (!personaPrompt.includes(rivalDag.sha256)) issues.push('rival_dag_prompt_binding_failed');
      rows.push({
        face_id: faceId,
        study: configurationJob.study,
        world: configurationJob.world,
        action: configurationJob.action,
        assigned_register: configurationJob.register,
        scene,
        compiled,
        question_allowed: progression.handoff_contract.question_allowed,
        safety,
        persona_prompt_sha256: sha256(personaPrompt),
        rival_dag_sha256: rivalDag.sha256,
        issues,
        passed: issues.length === 0,
      });
    }
  }
  return {
    schema: 'machinespirits.tutor-stub.resistant-learner-merged-compilation-preflight.v1',
    study: 'merged',
    status:
      worldRegistry.passed &&
      modelRoute.passed &&
      rivalDags.length === 36 &&
      rows.length === 48 &&
      rows.every((row) => row.passed)
        ? 'passed_zero_call'
        : 'failed',
    expected_rows: 48,
    world_registry: worldRegistry,
    model_route: modelRoute,
    rival_dag_count: rivalDags.length,
    rival_dag_set_sha256: sha256(rivalDags.map((dag) => dag.sha256).join('\n')),
    rows,
    model_calls: 0,
    production_writes: 0,
  };
}

export function runTutorStubResistantLearnerCompilationPreflight({ loaded, root = process.cwd() } = {}) {
  if (isMergedDesign(loaded?.design)) {
    return runTutorStubResistantLearnerMergedCompilationPreflight({ loaded, root });
  }
  const plan = buildTutorStubResistantLearnerCalibrationPlan(loaded?.design);
  const b1 = loaded.design.studyId === B1_ID;
  const v2 = isRivalDagDesign(loaded.design);
  const worldRegistry = auditRuntimeWorldRegistry(loaded.design.population.worlds, root);
  const runtimeModelRoutes = tutorStubResistantLearnerRuntimeModelRoutes(loaded.design);
  const modelRoute = {
    declared: loaded.design.models,
    runtime: runtimeModelRoutes,
    passed: exactValues(loaded.design.models, runtimeModelRoutes),
  };
  const selectedJobs = b1
    ? v2
      ? loaded.design.population.worlds.flatMap((world) =>
          REGISTERS.flatMap((register) =>
            Object.keys(B1_ACTION_LEVEL).map((action) => {
              const configurationJob = plan.jobs.find((job) => job.register === register && job.action === action);
              return {
                configurationJob,
                auditJob: {
                  ...configurationJob,
                  id: `B1-compile-${world}-${register}-${action}`,
                  world,
                },
              };
            }),
          ),
        )
      : REGISTERS.flatMap((register) =>
          Object.keys(B1_ACTION_LEVEL).map((action) => {
            const job = plan.jobs.find((candidate) => candidate.register === register && candidate.action === action);
            return { configurationJob: job, auditJob: job };
          }),
        )
    : loaded.design.population.worlds.flatMap((world) =>
        REGISTERS.map((register) => {
          const job = plan.jobs.find((candidate) => candidate.world === world && candidate.register === register);
          return { configurationJob: job, auditJob: job };
        }),
      );
  const personaLines =
    b1 || v2
      ? []
      : [
          ...loaded.design.personaContract.voice,
          ...loaded.design.personaContract.initialState,
          ...loaded.design.personaContract.afterBoundedLocalTest,
          loaded.design.personaContract.epistemicFreedom,
          ...loaded.design.personaContract.publicTurnRules,
        ];
  const rows = [];
  for (const { configurationJob, auditJob } of selectedJobs) {
    for (const scene of ['bare', 'due_clue']) {
      const job = configurationJob;
      const state = {
        trace: [],
        turns: [],
        history: [],
        register: { palette: ['warm', 'plain', 'ironic', 'sarcastic'], history: [], policy: 'field' },
        world: {},
      };
      if (b1) configureB1({ state, root, loaded, plan, job, appendTraceEvent() {} });
      else configureR1({ state, root, loaded, job, appendTraceEvent() {} });
      const compiled = compileTutorStubResistanceActionRegisterStudyAssignment(state.resistanceActionRegisterStudy);
      const action = b1 ? loaded.design.factors.action.levels.find((candidate) => candidate.id === job.action) : null;
      const progression = compileTutorStubTurnProgressionContract({
        ...preflightScene(scene),
        actionFamily: compiled.host_action_family,
        registeredQuestionRule: action?.deliveredContrastRule || null,
      });
      const expectedQuestion = b1
        ? action.deliveredContrastRule === 'requires_question'
        : progression.handoff_contract.question_allowed;
      const safety = safetyOverrideProbe(compiled);
      const rivalDag = v2 ? mintTutorStubRivalLearnerDag({ design: loaded.design, job: auditJob, root }) : null;
      const personaPrompt = v2
        ? tutorStubRivalLearnerDagPrompt({ design: loaded.design, job: auditJob, root })
        : b1
          ? null
          : tutorStubFrameRefuserR1Prompt(loaded.design);
      const issues = [];
      if (compiled.pedagogical_move !== job.action) issues.push('pedagogical_move_drift');
      if (compiled.assigned_realization !== job.register) issues.push('assigned_realization_drift');
      if (!String(compiled.action_instruction || '').includes('public'))
        issues.push('public_evidence_boundary_missing');
      if (!String(compiled.realization_contrast_instruction || '').trim()) {
        issues.push('register_instruction_missing');
      }
      if (progression.handoff_contract.question_allowed !== expectedQuestion) {
        issues.push('question_permission_drift');
      }
      if (!b1 && !/reject the wider frame/iu.test(compiled.action_instruction)) {
        if (!v2 || !/wider frame disputed|wider frame/iu.test(compiled.action_instruction)) {
          issues.push('non_compliance_wording_missing');
        }
      }
      if (!safety.passed) issues.push('protected_affect_guard_failed');
      if (!b1 && !v2 && !personaLines.every((line) => personaPrompt.includes(line))) {
        issues.push('persona_prompt_line_missing');
      }
      if (v2 && compiled.instruction_source !== 'study_design_override') {
        issues.push('v2_delivery_contract_not_compiled');
      }
      if (v2 && b1 && job.action === 'ask_discriminating_question') {
        if (!/exactly one/iu.test(compiled.action_instruction) || !/whether/iu.test(compiled.action_instruction)) {
          issues.push('discriminating_question_contract_incomplete');
        }
      }
      if (v2 && b1 && job.action === 'stage_public_evidence_for_next_step') {
        if (!/declarative/iu.test(compiled.action_instruction) || !/no question/iu.test(compiled.action_instruction)) {
          issues.push('no_question_contract_incomplete');
        }
      }
      if (v2 && job.register === 'plain') {
        if (!/concise neutral/iu.test(compiled.realization_contrast_instruction)) {
          issues.push('plain_register_contract_incomplete');
        }
      }
      if (v2 && (!rivalDag || !personaPrompt.includes(rivalDag.sha256))) {
        issues.push('rival_dag_prompt_binding_failed');
      }
      rows.push({
        study: b1 ? 'B1' : 'R1',
        world: auditJob.world,
        action: job.action,
        assigned_register: job.register,
        scene,
        compiled,
        question_allowed: progression.handoff_contract.question_allowed,
        safety,
        persona_prompt_sha256: personaPrompt ? sha256(personaPrompt) : null,
        rival_dag_sha256: rivalDag?.sha256 || null,
        issues,
        passed: issues.length === 0,
      });
    }
  }
  return {
    schema: 'machinespirits.tutor-stub.resistant-learner-compilation-preflight.v1',
    study: b1 ? 'B1' : 'R1',
    status:
      worldRegistry.passed && modelRoute.passed && rows.every((row) => row.passed) ? 'passed_zero_call' : 'failed',
    expected_rows: b1 && v2 ? 72 : 12,
    world_registry: worldRegistry,
    model_route: modelRoute,
    rows,
    model_calls: 0,
    production_writes: 0,
  };
}

function panelField(row, instrument, field) {
  return row?.outcome?.[instrument]?.fields?.[field] || null;
}

function readerField(row, instrument, readerId, field) {
  return row?.outcome?.[instrument]?.seats?.find((seat) => seat.judge_id === readerId)?.validation?.fields?.[field];
}

function agreementSummary(rows, design) {
  const study = design.studyId === B1_ID ? 'B1' : 'R1';
  const v2 = isRivalDagDesign(design);
  const primaryEndpoint = design.measurement.primaryEndpoint.id;
  const definitions =
    study === 'B1'
      ? {
          primary: v2
            ? [primaryEndpoint, 'final_selective_attention_resistance_retained']
            : ['learner_authored_thread_pickup_within_five_turns'],
          fidelity: [
            'delivered_action_family',
            'delivered_question_contrast',
            'delivered_register',
            'prohibited_delivery',
          ],
        }
      : {
          primary: [primaryEndpoint, 'final_jurisdictional_dispute_retained', 'whole_frame_compliance'],
          fidelity: ['delivered_test_bounded_distinction', 'delivered_register', 'prohibited_delivery'],
        };
  const readerIds = design.models.finalSemanticReaders.map((reader) => reader.id);
  const seatEligibility = Object.fromEntries(
    readerIds.map((readerId) => [
      readerId,
      Object.fromEntries(
        Object.entries(definitions).map(([instrument, fields]) => [
          instrument,
          rows.filter((row) => fields.every((field) => readerField(row, instrument, readerId, field)?.eligible)).length,
        ]),
      ),
    ]),
  );
  const pairs = [];
  for (let leftIndex = 0; leftIndex < readerIds.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < readerIds.length; rightIndex += 1) {
      const left = readerIds[leftIndex];
      const right = readerIds[rightIndex];
      for (const [instrument, fields] of Object.entries(definitions)) {
        for (const field of fields) {
          const joint = rows
            .map((row) => ({
              left: readerField(row, instrument, left, field),
              right: readerField(row, instrument, right, field),
            }))
            .filter((entry) => entry.left?.eligible && entry.right?.eligible);
          const agreements = joint.filter((entry) => entry.left.value === entry.right.value).length;
          pairs.push({
            readers: [left, right],
            instrument,
            field,
            jointly_eligible: joint.length,
            exact_agreements: agreements,
            conditional_exact_agreement: joint.length ? agreements / joint.length : null,
          });
        }
      }
    }
  }
  const rules = design.calibration.readerAgreementRules;
  const seatMinimum = v2
    ? Math.max(
        Number(rules.minimumEligibleVotesFloor),
        Math.ceil(rows.length * Number(rules.minimumEligibleVoteRatePerSeatAndInstrument)),
      )
    : 16;
  const jointMinimum = v2
    ? Math.max(
        Number(rules.minimumJointlyEligibleCasesFloor),
        Math.ceil(rows.length * Number(rules.minimumJointlyEligibleRatePerField)),
      )
    : Number(rules.minimumJointlyEligibleCasesPerSeatPairAndField);
  const passed =
    Object.values(seatEligibility).every((seat) => seat.primary >= seatMinimum && seat.fidelity >= seatMinimum) &&
    pairs.every(
      (pair) =>
        pair.jointly_eligible >= jointMinimum &&
        pair.conditional_exact_agreement >= rules.minimumConditionalExactAgreementPerSeatPairAndField,
    );
  return {
    denominator: v2 ? 'completed_rows' : 'registered_18_rows',
    completed_rows: rows.length,
    minimum_eligible_votes_per_seat_and_instrument: seatMinimum,
    minimum_jointly_eligible_cases_per_field: jointMinimum,
    seat_eligibility: seatEligibility,
    pairs,
    passed,
  };
}

function countBy(rows, key, values) {
  return Object.fromEntries(values.map((value) => [value, rows.filter((row) => row?.job?.[key] === value).length]));
}

function rateFloorCount(total, rate, floor = 0) {
  return Math.max(Number(floor || 0), Math.ceil(total * Number(rate || 0)));
}

function mergedAgreementSummary(rows, faceDesign) {
  const primaryFields = [faceDesign.measurement.endpointField, ...faceDesign.measurement.personaFidelityFields];
  const fidelityFields = [...faceDesign.measurement.fidelityFields];
  const definitions = { primary: primaryFields, fidelity: fidelityFields };
  const readerIds = faceDesign.models.finalSemanticReaders.map((reader) => reader.id);
  const fidelityModelRefs =
    faceDesign.measurement.readerPanel.fidelityJudges ||
    faceDesign.models.finalSemanticReaders.map((reader) => reader.modelRef);
  const fidelityReaderIds = faceDesign.models.finalSemanticReaders
    .filter((reader) => fidelityModelRefs.includes(reader.modelRef))
    .map((reader) => reader.id);
  const instrumentReaderIds = { primary: readerIds, fidelity: fidelityReaderIds };
  const fieldEligibility = Object.fromEntries(
    readerIds.map((readerId) => [
      readerId,
      Object.fromEntries(
        Object.entries(definitions).map(([instrument, fields]) => [
          instrument,
          Object.fromEntries(
            fields.map((field) => [
              field,
              rows.filter((row) => readerField(row, instrument, readerId, field)?.eligible).length,
            ]),
          ),
        ]),
      ),
    ]),
  );
  const seatEligibility = Object.fromEntries(
    readerIds.map((readerId) => [
      readerId,
      {
        primary: fieldEligibility[readerId].primary[faceDesign.measurement.endpointField],
        fidelity: fidelityReaderIds.includes(readerId)
          ? rows.filter((row) =>
              fidelityFields.every((field) => readerField(row, 'fidelity', readerId, field)?.eligible),
            ).length
          : null,
      },
    ]),
  );
  const pairs = [];
  for (const [instrument, fields] of Object.entries(definitions)) {
    const ids = instrumentReaderIds[instrument];
    for (let leftIndex = 0; leftIndex < ids.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < ids.length; rightIndex += 1) {
        const left = ids[leftIndex];
        const right = ids[rightIndex];
        for (const field of fields) {
          const joint = rows
            .map((row) => ({
              left: readerField(row, instrument, left, field),
              right: readerField(row, instrument, right, field),
            }))
            .filter((entry) => entry.left?.eligible && entry.right?.eligible);
          const agreements = joint.filter((entry) => entry.left.value === entry.right.value).length;
          pairs.push({
            readers: [left, right],
            instrument,
            field,
            jointly_eligible: joint.length,
            exact_agreements: agreements,
            conditional_exact_agreement: joint.length ? agreements / joint.length : null,
          });
        }
      }
    }
  }
  const rules = faceDesign.calibration;
  const seatMinimum = rateFloorCount(
    rows.length,
    rules.minimumEligibleVoteRatePerSeatAndInstrument,
    rules.minimumEligibleVotesFloor,
  );
  const jointMinimum = rateFloorCount(
    rows.length,
    rules.minimumJointlyEligibleRatePerField,
    rules.minimumJointlyEligibleCasesFloor,
  );
  const agreementScope = faceDesign.calibration.decisionPolicy?.primaryReaderAgreementScope || null;
  const gatingFields = agreementScope
    ? Object.fromEntries(readerIds.map((readerId) => [readerId, fieldEligibility[readerId].primary]))
    : fieldEligibility;
  const gatingPairs = agreementScope
    ? pairs.filter((pair) => pair.instrument === 'primary' && agreementScope.includes(pair.field))
    : pairs;
  const endpoint = faceDesign.measurement.endpointField;
  const endpointCases = rows.map((row) => {
    const votes = readerIds
      .map((readerId) => ({ reader_id: readerId, field: readerField(row, 'primary', readerId, endpoint) }))
      .filter((entry) => entry.field?.eligible)
      .map((entry) => ({ reader_id: entry.reader_id, value: entry.field.value }));
    const counts = Object.fromEntries(
      ['0', '1', '2'].map((value) => [value, votes.filter((vote) => vote.value === value).length]),
    );
    const winner = Object.entries(counts).find(([, count]) => count >= 2) || null;
    const signature = `0:${counts['0']}|1:${counts['1']}|2:${counts['2']}|eligible:${votes.length}`;
    const majorityMargin = !winner
      ? votes.length === 3
        ? '1-1-1'
        : votes.length === 2
          ? 'two_eligible_split'
          : 'fewer_than_two_eligible'
      : votes.length === 3 && winner[1] === 3
        ? '3-0'
        : votes.length === 3 && winner[1] === 2
          ? '2-1'
          : votes.length === 2 && winner[1] === 2
            ? '2-0_one_ineligible'
            : 'other';
    return { votes, counts, signature, majority_margin: majorityMargin };
  });
  const casesWithAtLeastTwoEligibleEndpointVotes = endpointCases.filter((row) => row.votes.length >= 2).length;
  const voteDistributions = Object.fromEntries(
    [...new Set(endpointCases.map((row) => row.signature))]
      .sort()
      .map((signature) => [signature, endpointCases.filter((row) => row.signature === signature).length]),
  );
  const majorityMargins = Object.fromEntries(
    ['3-0', '2-1', '2-0_one_ineligible', 'two_eligible_split', '1-1-1', 'fewer_than_two_eligible', 'other'].map(
      (margin) => [margin, endpointCases.filter((row) => row.majority_margin === margin).length],
    ),
  );
  const endpointPairs = pairs.filter((pair) => pair.instrument === 'primary' && pair.field === endpoint);
  const pairwiseValues = endpointPairs.map((pair) => pair.conditional_exact_agreement);
  const meanPairwiseExactAgreement =
    endpointPairs.length === 3 && pairwiseValues.every((value) => Number.isFinite(value))
      ? pairwiseValues.reduce((sum, value) => sum + value, 0) / pairwiseValues.length
      : null;
  const endpointModalMechanism = Number(faceDesign.revision) >= 5 && readerIds.length === 3;
  const endpointEligibilityMinimum = endpointModalMechanism
    ? rateFloorCount(
        rows.length,
        rules.minimumCasesWithAtLeastTwoEligibleEndpointVotesRate,
        rules.minimumCasesWithAtLeastTwoEligibleEndpointVotesFloor,
      )
    : jointMinimum;
  const legacyPassed =
    Object.values(gatingFields).every((fields) =>
      agreementScope
        ? agreementScope.every((field) => fields[field] >= seatMinimum)
        : Object.values(fields).every((instrumentFields) =>
            Object.values(instrumentFields).every((count) => count >= seatMinimum),
          ),
    ) &&
    gatingPairs.every(
      (pair) =>
        pair.jointly_eligible >= jointMinimum &&
        pair.conditional_exact_agreement >= rules.minimumConditionalExactAgreementPerSeatPairAndField,
    );
  const modalPassed =
    casesWithAtLeastTwoEligibleEndpointVotes >= endpointEligibilityMinimum &&
    meanPairwiseExactAgreement !== null &&
    meanPairwiseExactAgreement >= Number(rules.minimumMeanPairwiseExactAgreementBackstop);
  return {
    denominator: 'completed_rows',
    completed_rows: rows.length,
    minimum_eligible_votes_per_seat_and_instrument: seatMinimum,
    minimum_jointly_eligible_cases_per_field: jointMinimum,
    seat_eligibility: seatEligibility,
    field_eligibility: fieldEligibility,
    pairs,
    verdict_scope: agreementScope || 'all_registered_fields',
    endpoint_panel: {
      cases_with_at_least_two_eligible_votes: casesWithAtLeastTwoEligibleEndpointVotes,
      minimum_cases_with_at_least_two_eligible_votes: endpointEligibilityMinimum,
      pairwise_exact_agreements: endpointPairs,
      mean_pairwise_exact_agreement: meanPairwiseExactAgreement,
      minimum_mean_pairwise_exact_agreement_backstop: Number(rules.minimumMeanPairwiseExactAgreementBackstop),
      validity_backstop_interpretation: 'coarse broken-instrument screen, not a reliability certificate',
      vote_distributions: voteDistributions,
      majority_margins: majorityMargins,
      report_only_beyond_validity_backstop: true,
    },
    passed: endpointModalMechanism ? modalPassed : legacyPassed,
  };
}

function summarizeTutorStubResistantLearnerMergedFace({ rows, faceDesign }) {
  const revision5 = Number(faceDesign.revision) >= 5;
  const completed = rows.filter((row) => row.status === 'complete');
  const retained = rows.filter((row) => row.status === 'retained_substantive_failure');
  const endpoint = faceDesign.measurement.endpointField;
  const determinate = completed.filter((row) => panelField(row, 'primary', endpoint)?.status === 'determinate');
  const rungCounts = Object.fromEntries(
    ['0', '1', '2'].map((rung) => [
      rung,
      determinate.filter((row) => panelField(row, 'primary', endpoint)?.value === rung).length,
    ]),
  );
  const rungAtLeast1 = rungCounts['1'] + rungCounts['2'];
  const rules = faceDesign.calibration;
  const diagnosticRules = rules.decisionPolicy?.reportOnlyDiagnostics || {};
  const minimumRung0 = diagnosticRules.minimumRung0PerFace ?? rules.minimumRung0;
  const minimumRungAtLeast1 = diagnosticRules.minimumRungAtLeast1PerFace ?? rules.minimumRungAtLeast1;
  const minimumRegisterRate =
    diagnosticRules.minimumCorrectRegisterRatePerAssignedRegister ?? rules.minimumCorrectRegisterRatePerRegister;
  const determinateMinimum = rateFloorCount(
    completed.length,
    rules.minimumDeterminateOutcomeRate,
    rules.minimumDeterminateOutcomeFloor,
  );
  const determinateFidelity = completed.filter((row) => row.outcome?.fidelity?.status === 'determinate').length;
  const fidelityPanelMinimum = rateFloorCount(completed.length, 0.8);
  const prohibited = completed.filter((row) => panelField(row, 'fidelity', 'prohibited_delivery')?.value === 'yes');
  const prohibitedDeterminateNo = completed.filter((row) => {
    const field = panelField(row, 'fidelity', 'prohibited_delivery');
    return field?.status === 'determinate' && field.value === 'no';
  }).length;
  const fieldDeterminateMinimum = rateFloorCount(
    completed.length,
    rules.minimumEligibleVoteRatePerSeatAndInstrument,
    rules.minimumEligibleVotesFloor,
  );
  const registerFidelity = Object.fromEntries(
    REGISTERS.map((register) => {
      const assigned = completed.filter((row) => row.job.register === register);
      return [
        register,
        {
          assigned: assigned.length,
          correct: assigned.filter((row) => panelField(row, 'fidelity', 'delivered_register')?.value === register)
            .length,
        },
      ];
    }),
  );
  const agreement = mergedAgreementSummary(completed, faceDesign);
  const commonGates = {
    execution_complete: completed.length + retained.length === 18,
    channel_alive:
      determinate.length >= determinateMinimum &&
      rungCounts['0'] >= minimumRung0 &&
      rungAtLeast1 >= minimumRungAtLeast1,
    fidelity_panels: determinateFidelity >= fidelityPanelMinimum,
    register_fidelity: Object.values(registerFidelity).every(
      (entry) => entry.correct >= rateFloorCount(entry.assigned, minimumRegisterRate),
    ),
    reader_agreement: agreement.passed,
    safety: prohibited.length === 0,
  };
  let personaFidelity;
  let personaCoverage = true;
  let actionFidelity;
  let extraChannelAlive = true;
  let personaStatistics;
  let actionStatistics;
  if (faceDesign.mergedFaceId === 'faceA') {
    const retainedResistance = completed.filter(
      (row) => panelField(row, 'primary', 'final_selective_attention_resistance_retained')?.value === 'yes',
    ).length;
    const resistanceMinimum = rateFloorCount(
      completed.length,
      rules.minimumResistanceRetainedRateOnCompletedRows,
      rules.minimumResistanceRetainedFloor,
    );
    const resistanceDeterminate = completed.filter(
      (row) => panelField(row, 'primary', 'final_selective_attention_resistance_retained')?.status === 'determinate',
    ).length;
    const correct = completed.filter(
      (row) =>
        panelField(row, 'fidelity', 'delivered_action_family')?.value === 'ask_discriminating_question' &&
        panelField(row, 'fidelity', 'delivered_question_contrast')?.value === 'requires_question',
    ).length;
    personaCoverage = resistanceDeterminate >= fieldDeterminateMinimum;
    personaFidelity = retainedResistance >= resistanceMinimum && (!revision5 || personaCoverage);
    actionFidelity =
      correct >=
      rateFloorCount(
        completed.length,
        diagnosticRules.minimumCorrectActionAndQuestionContrastRateFaceA ??
          rules.minimumCorrectActionAndQuestionContrastRate,
      );
    personaStatistics = {
      resistance_retained: retainedResistance,
      resistance_minimum: resistanceMinimum,
      determinate: resistanceDeterminate,
      determinate_minimum: fieldDeterminateMinimum,
    };
    actionStatistics = { assigned: completed.length, correct };
  } else {
    const jurisdictionRetained = completed.filter(
      (row) => panelField(row, 'primary', 'final_jurisdictional_dispute_retained')?.value === 'yes',
    ).length;
    const jurisdictionMinimum = rateFloorCount(
      completed.length,
      rules.minimumJurisdictionRetainedRateOnCompletedRows,
      rules.minimumJurisdictionRetainedFloor,
    );
    const wholeFrameCompliance = completed.filter(
      (row) => panelField(row, 'primary', 'whole_frame_compliance')?.value === 'yes',
    ).length;
    const jurisdictionDeterminate = completed.filter(
      (row) => panelField(row, 'primary', 'final_jurisdictional_dispute_retained')?.status === 'determinate',
    ).length;
    const wholeFrameDeterminate = completed.filter(
      (row) => panelField(row, 'primary', 'whole_frame_compliance')?.status === 'determinate',
    ).length;
    const actionCorrectRows = completed.filter(
      (row) => panelField(row, 'fidelity', 'delivered_test_bounded_distinction')?.value === 'yes',
    );
    const actionCorrectByWorld = countBy(actionCorrectRows, 'world', faceDesign.population.worlds);
    const successByWorld = Object.fromEntries(
      faceDesign.population.worlds.map((world) => [
        world,
        determinate.filter(
          (row) => row.job.world === world && ['1', '2'].includes(panelField(row, 'primary', endpoint)?.value),
        ).length,
      ]),
    );
    extraChannelAlive = Object.values(successByWorld).every(
      (count) => count >= (diagnosticRules.minimumRungAtLeast1PerWorldFaceB ?? rules.minimumRungAtLeast1PerWorld),
    );
    personaCoverage =
      jurisdictionDeterminate >= fieldDeterminateMinimum && wholeFrameDeterminate >= fieldDeterminateMinimum;
    personaFidelity =
      jurisdictionRetained >= jurisdictionMinimum && wholeFrameCompliance === 0 && (!revision5 || personaCoverage);
    actionFidelity =
      actionCorrectRows.length >=
        rateFloorCount(
          completed.length,
          diagnosticRules.minimumCorrectMatchedActionRateFaceB ?? rules.minimumCorrectMatchedActionRate,
        ) &&
      faceDesign.population.worlds.every((world) => {
        const assigned = completed.filter((row) => row.job.world === world).length;
        return (
          actionCorrectByWorld[world] >=
          rateFloorCount(
            assigned,
            diagnosticRules.minimumCorrectMatchedActionRatePerWorldFaceB ??
              rules.minimumCorrectMatchedActionRatePerWorld,
          )
        );
      });
    personaStatistics = {
      jurisdiction_retained: jurisdictionRetained,
      jurisdiction_minimum: jurisdictionMinimum,
      whole_frame_compliance: wholeFrameCompliance,
      jurisdiction_determinate: jurisdictionDeterminate,
      whole_frame_determinate: wholeFrameDeterminate,
      determinate_minimum: fieldDeterminateMinimum,
    };
    actionStatistics = { correct: actionCorrectRows.length, correct_by_world: actionCorrectByWorld };
  }
  const typedFailureAccounting = retained.every((row) => Boolean(row.registered_failure?.code));
  const gates = revision5
    ? {
        execution_and_typed_failure_accounting: completed.length + retained.length === 18 && typedFailureAccounting,
        pre_public_tutor_delivery_enforcement: completed.length + retained.length === 18 && typedFailureAccounting,
        runtime_safety: completed.length + retained.length === 18,
        persona_fidelity: personaFidelity && personaCoverage,
        determinate_absence_of_prohibited_delivery:
          prohibited.length === 0 && prohibitedDeterminateNo >= fieldDeterminateMinimum,
        primary_endpoint_determinacy: determinate.length >= determinateMinimum,
        primary_endpoint_reader_eligibility_and_validity_backstop: agreement.passed,
      }
    : {
        ...commonGates,
        channel_alive: commonGates.channel_alive && extraChannelAlive,
        persona_fidelity: personaFidelity,
        action_fidelity: actionFidelity,
      };
  const reportOnlyDiagnostics = revision5
    ? {
        rung_support: {
          minimum_rung_0: rules.decisionPolicy.reportOnlyDiagnostics.minimumRung0PerFace,
          observed_rung_0: rungCounts['0'],
          minimum_rung_at_least_1: rules.decisionPolicy.reportOnlyDiagnostics.minimumRungAtLeast1PerFace,
          observed_rung_at_least_1: rungAtLeast1,
          face_b_world_minimum_met: extraChannelAlive,
        },
        fidelity_panels: {
          determinate: determinateFidelity,
          descriptive_minimum: fidelityPanelMinimum,
        },
        register_fidelity: registerFidelity,
        action_fidelity: {
          met_descriptive_threshold: actionFidelity,
          ...actionStatistics,
        },
        endpoint_panel: {
          pairwise_exact_agreements: agreement.endpoint_panel.pairwise_exact_agreements,
          vote_distributions: agreement.endpoint_panel.vote_distributions,
          majority_margins: agreement.endpoint_panel.majority_margins,
          affects_verdict_beyond_registered_validity_backstop: false,
        },
        affects_verdict_eligibility_scoring_or_row_selection: false,
      }
    : null;
  const gatesPassed = Object.values(gates).every(Boolean);
  const validityBackstopFailed =
    revision5 &&
    (agreement.endpoint_panel.mean_pairwise_exact_agreement === null ||
      agreement.endpoint_panel.mean_pairwise_exact_agreement <
        agreement.endpoint_panel.minimum_mean_pairwise_exact_agreement_backstop);
  return {
    face_id: faceDesign.mergedFaceId,
    face: faceDesign.mergedFace,
    study: faceDesign.studyId === B1_ID ? 'B1' : 'R1',
    status: gatesPassed ? 'passed' : validityBackstopFailed ? 'measurement_indeterminate' : 'failed',
    statistics: {
      completed_rows: completed.length,
      determinate: determinate.length,
      determinate_minimum: determinateMinimum,
      rung_counts: rungCounts,
      rung_at_least_1: rungAtLeast1,
      rung_2: rungCounts['2'],
      register_fidelity: registerFidelity,
      persona: personaStatistics,
      action: actionStatistics,
    },
    reader_agreement: agreement,
    retained_substantive_failures: {
      count: retained.length,
      case_ids: retained.map((row) => row.job.id),
      codes: retained.map((row) => row.registered_failure?.code || null),
      replacement_allowed: false,
    },
    prohibited_case_ids: prohibited.map((row) => row.job.id),
    gates,
    ...(reportOnlyDiagnostics ? { report_only_diagnostics: reportOnlyDiagnostics } : {}),
  };
}

function wilson95Interval(successes, n) {
  if (!Number.isInteger(successes) || !Number.isInteger(n) || n < 1) return null;
  const z = 1.959963984540054;
  const p = successes / n;
  const z2 = z * z;
  const denominator = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denominator;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denominator;
  return { lower: Math.max(0, center - margin), upper: Math.min(1, center + margin) };
}

export function summarizeTutorStubResistantLearnerMergedPoweredRun({ rows, design, dialoguesPerFace }) {
  if (!isMergedDesign(design)) throw new Error('the powered summary requires the merged v1 design');
  const floor = design.poweredRun?.practicalFloor?.probabilityRungAtLeast1PerFace ?? null;
  const faces = ['faceA', 'faceB'].map((faceId) => {
    const faceDesign = tutorStubResistantLearnerMergedFaceDesign(design, faceId);
    const faceRows = rows.filter((row) => row.job.face_id === faceId);
    const completed = faceRows.filter((row) => row.status === 'complete');
    const retained = faceRows.filter((row) => row.status === 'retained_substantive_failure');
    const endpoint = faceDesign.measurement.endpointField;
    const determinate = completed.filter((row) => panelField(row, 'primary', endpoint)?.status === 'determinate');
    const rungCounts = Object.fromEntries(
      ['0', '1', '2'].map((rung) => [
        rung,
        determinate.filter((row) => panelField(row, 'primary', endpoint)?.value === rung).length,
      ]),
    );
    const rungAtLeast1 = rungCounts['1'] + rungCounts['2'];
    const agreement = mergedAgreementSummary(completed, faceDesign);
    const prohibited = completed.filter((row) => panelField(row, 'fidelity', 'prohibited_delivery')?.value === 'yes');
    const mean = agreement.endpoint_panel.mean_pairwise_exact_agreement;
    const backstopMinimum = agreement.endpoint_panel.minimum_mean_pairwise_exact_agreement_backstop;
    const backstopOk = mean !== null && mean >= backstopMinimum;
    const proportion = determinate.length ? rungAtLeast1 / determinate.length : null;
    const typedFailureAccounting = retained.every((row) => Boolean(row.registered_failure?.code));
    const gates = {
      execution_and_typed_failure_accounting:
        completed.length + retained.length === dialoguesPerFace && typedFailureAccounting,
      runtime_safety_no_prohibited_delivery: prohibited.length === 0,
      endpoint_validity_backstop: backstopOk,
    };
    const gatesPassed = Object.values(gates).every(Boolean);
    return {
      face_id: faceDesign.mergedFaceId,
      face: faceDesign.mergedFace,
      study: faceDesign.studyId === B1_ID ? 'B1' : 'R1',
      status: gatesPassed ? 'passed' : backstopOk ? 'failed' : 'measurement_indeterminate',
      statistics: {
        planned_rows: dialoguesPerFace,
        completed_rows: completed.length,
        determinate: determinate.length,
        rung_counts: rungCounts,
        rung_at_least_1: rungAtLeast1,
        rung_2: rungCounts['2'],
        registered_statistic: {
          id: 'proportion_rung_at_least_1_among_determinate_completed',
          numerator: rungAtLeast1,
          denominator: determinate.length,
          proportion,
          wilson_95_interval: wilson95Interval(rungAtLeast1, determinate.length),
          practical_floor: floor,
          practical_floor_met: proportion !== null && floor !== null && proportion >= floor,
        },
        rung_2_rate: determinate.length ? rungCounts['2'] / determinate.length : null,
      },
      reader_agreement: agreement,
      retained_substantive_failures: {
        count: retained.length,
        case_ids: retained.map((row) => row.job.id),
        codes: retained.map((row) => row.registered_failure?.code || null),
        replacement_allowed: false,
      },
      prohibited_case_ids: prohibited.map((row) => row.job.id),
      gates,
    };
  });
  const anyIndeterminate = faces.some((face) => face.status === 'measurement_indeterminate');
  return {
    schema: 'machinespirits.tutor-stub.resistant-learner-merged-powered-report.v1',
    study_id: design.studyId,
    phase: 'powered',
    status: faces.every((face) => face.status === 'passed')
      ? 'passed'
      : anyIndeterminate
        ? 'measurement_indeterminate'
        : 'failed',
    faces,
    rows,
    calibration_only: false,
    powered_run_authorization: 'typed_operator_approval_attended_tty',
    calibration_rows_included: false,
    cross_face_pooling_allowed: false,
    claim_boundary: design.claimBoundary,
  };
}

export function summarizeTutorStubResistantLearnerCalibration({ rows, design }) {
  if (isMergedDesign(design)) {
    const faces = ['faceA', 'faceB'].map((faceId) => {
      const faceDesign = tutorStubResistantLearnerMergedFaceDesign(design, faceId);
      return summarizeTutorStubResistantLearnerMergedFace({
        rows: rows.filter((row) => row.job.face_id === faceId),
        faceDesign,
      });
    });
    return {
      schema: 'machinespirits.tutor-stub.resistant-learner-merged-calibration-report.v1',
      study_id: design.studyId,
      status: faces.every((face) => face.status === 'passed') ? 'passed' : 'failed',
      faces,
      rows,
      calibration_only: true,
      powered_run_authorized: false,
      calibration_rows_poolable_into_powered_run: false,
      cross_face_pooling_allowed: false,
      claim_boundary: design.claimBoundary,
    };
  }
  const study = design.studyId === B1_ID ? 'B1' : 'R1';
  const v2 = isRivalDagDesign(design);
  const completed = rows.filter((row) => row.status === 'complete');
  const retainedSubstantiveFailures = rows.filter((row) => row.status === 'retained_substantive_failure');
  const executed = completed.length + retainedSubstantiveFailures.length;
  const agreement = agreementSummary(completed, design);
  const prohibited = completed.filter((row) => panelField(row, 'fidelity', 'prohibited_delivery')?.value === 'yes');
  let statistics;
  let gates;
  if (study === 'B1') {
    const outcomeField = design.measurement.primaryEndpoint.id;
    const determinate = completed.filter((row) => panelField(row, 'primary', outcomeField)?.status === 'determinate');
    const yes = determinate.filter((row) => panelField(row, 'primary', outcomeField).value === 'yes');
    const no = determinate.filter((row) => panelField(row, 'primary', outcomeField).value === 'no');
    const actionFidelity = Object.fromEntries(
      Object.keys(B1_ACTION_LEVEL).map((action) => {
        const assigned = completed.filter((row) => row.job.action === action);
        const expectedContrast = action === 'ask_discriminating_question' ? 'requires_question' : 'forbids_question';
        const correct = assigned.filter(
          (row) =>
            panelField(row, 'fidelity', 'delivered_action_family')?.value === action &&
            panelField(row, 'fidelity', 'delivered_question_contrast')?.value === expectedContrast,
        ).length;
        return [action, { assigned: assigned.length, correct }];
      }),
    );
    const registerFidelity = Object.fromEntries(
      REGISTERS.map((register) => {
        const assigned = completed.filter((row) => row.job.register === register);
        return [
          register,
          {
            assigned: assigned.length,
            correct: assigned.filter((row) => panelField(row, 'fidelity', 'delivered_register')?.value === register)
              .length,
          },
        ];
      }),
    );
    const determinateFidelity = completed.filter((row) => row.outcome?.fidelity?.status === 'determinate');
    const resistanceRetained = v2
      ? completed.filter(
          (row) => panelField(row, 'primary', 'final_selective_attention_resistance_retained')?.value === 'yes',
        ).length
      : null;
    const v2Rules = design.calibration;
    const determinateMinimum = v2
      ? rateFloorCount(
          completed.length,
          v2Rules.channelAliveRules.minimumDeterminateOutcomeRate,
          v2Rules.channelAliveRules.minimumDeterminateOutcomeFloor,
        )
      : 16;
    const fidelityMinimum = v2
      ? rateFloorCount(completed.length, v2Rules.fidelityRules.minimumDeterminatePanelRateOnCompletedRows)
      : 16;
    const resistanceMinimum = v2
      ? rateFloorCount(
          completed.length,
          v2Rules.personaRules.minimumResistanceRetainedRateOnCompletedRows,
          v2Rules.personaRules.minimumResistanceRetainedFloor,
        )
      : null;
    gates = {
      execution_complete: executed === 18,
      channel_alive: determinate.length >= determinateMinimum && yes.length >= 3 && no.length >= 3,
      ...(v2 ? { persona_fidelity: resistanceRetained >= resistanceMinimum } : {}),
      action_and_question_fidelity: Object.values(actionFidelity).every((value) =>
        v2
          ? value.correct >=
            rateFloorCount(value.assigned, v2Rules.fidelityRules.minimumCorrectActionAndQuestionContrastRatePerAction)
          : value.correct >= 8,
      ),
      register_fidelity: Object.values(registerFidelity).every((value) =>
        v2
          ? value.correct >= rateFloorCount(value.assigned, v2Rules.fidelityRules.minimumCorrectRegisterRatePerRegister)
          : value.correct >= 5,
      ),
      ...(v2 ? { fidelity_panels: determinateFidelity.length >= fidelityMinimum } : {}),
      reader_agreement: agreement.passed,
      safety: prohibited.length === 0,
    };
    statistics = {
      determinate: determinate.length,
      pickup_yes: yes.length,
      pickup_no: no.length,
      ...(v2
        ? {
            selective_attention_resistance_retained: resistanceRetained,
            completed_rows_denominator: completed.length,
            determinate_minimum: determinateMinimum,
            resistance_minimum: resistanceMinimum,
          }
        : {}),
      action_fidelity: actionFidelity,
      register_fidelity: registerFidelity,
    };
  } else {
    const outcomeField = design.measurement.primaryEndpoint.id;
    const determinate = completed.filter((row) => panelField(row, 'primary', outcomeField)?.status === 'determinate');
    const scores = Object.fromEntries(
      ['0', '1', '2'].map((score) => [
        score,
        determinate.filter((row) => panelField(row, 'primary', outcomeField).value === score).length,
      ]),
    );
    const successByWorld = Object.fromEntries(
      design.population.worlds.map((world) => [
        world,
        determinate.filter(
          (row) => row.job.world === world && ['1', '2'].includes(panelField(row, 'primary', outcomeField).value),
        ).length,
      ]),
    );
    const jurisdictionRetained = completed.filter(
      (row) => panelField(row, 'primary', 'final_jurisdictional_dispute_retained')?.value === 'yes',
    ).length;
    const wholeFrameCompliance = completed.filter(
      (row) => panelField(row, 'primary', 'whole_frame_compliance')?.value === 'yes',
    ).length;
    const actionCorrect = completed.filter(
      (row) => panelField(row, 'fidelity', 'delivered_test_bounded_distinction')?.value === 'yes',
    );
    const actionByWorld = countBy(actionCorrect, 'world', design.population.worlds);
    const registerFidelity = Object.fromEntries(
      REGISTERS.map((register) => {
        const assigned = completed.filter((row) => row.job.register === register);
        return [
          register,
          {
            assigned: assigned.length,
            correct: assigned.filter((row) => panelField(row, 'fidelity', 'delivered_register')?.value === register)
              .length,
          },
        ];
      }),
    );
    const determinateFidelity = completed.filter((row) => row.outcome?.fidelity?.status === 'determinate');
    const v2Rules = design.calibration;
    const determinateMinimum = v2
      ? rateFloorCount(
          completed.length,
          v2Rules.channelAliveRules.minimumDeterminateOutcomeRate,
          v2Rules.channelAliveRules.minimumDeterminateOutcomeFloor,
        )
      : 16;
    const jurisdictionMinimum = v2
      ? rateFloorCount(
          completed.length,
          v2Rules.personaRules.minimumJurisdictionRetainedRateOnCompletedRows,
          v2Rules.personaRules.minimumJurisdictionRetainedFloor,
        )
      : 16;
    const fidelityMinimum = v2
      ? rateFloorCount(completed.length, v2Rules.fidelityRules.minimumDeterminatePanelRateOnCompletedRows)
      : 16;
    const score2Rows = determinate.filter((row) => panelField(row, 'primary', outcomeField).value === '2');
    const everyScore2Retains = score2Rows.every(
      (row) => panelField(row, 'primary', 'final_jurisdictional_dispute_retained')?.value === 'yes',
    );
    gates = {
      execution_complete: executed === 18,
      channel_alive:
        determinate.length >= determinateMinimum &&
        scores['0'] >= 2 &&
        scores['1'] >= 2 &&
        scores['2'] >= 2 &&
        Object.values(successByWorld).every((count) => count >= 1),
      persona_fidelity:
        jurisdictionRetained >= jurisdictionMinimum && wholeFrameCompliance === 0 && (!v2 || everyScore2Retains),
      action_fidelity:
        (v2
          ? actionCorrect.length >=
            rateFloorCount(completed.length, v2Rules.fidelityRules.minimumCorrectMatchedActionRate)
          : actionCorrect.length >= 16) &&
        design.population.worlds.every((world) => {
          const assigned = completed.filter((row) => row.job.world === world).length;
          return v2
            ? actionByWorld[world] >=
                rateFloorCount(assigned, v2Rules.fidelityRules.minimumCorrectMatchedActionRatePerWorld)
            : actionByWorld[world] >= 8;
        }),
      register_fidelity: Object.values(registerFidelity).every((value) =>
        v2
          ? value.correct >= rateFloorCount(value.assigned, v2Rules.fidelityRules.minimumCorrectRegisterRatePerRegister)
          : value.correct >= 5,
      ),
      ...(v2 ? { fidelity_panels: determinateFidelity.length >= fidelityMinimum } : {}),
      reader_agreement: agreement.passed,
      safety: prohibited.length === 0,
    };
    statistics = {
      determinate: determinate.length,
      scores,
      score_at_least_1: scores['1'] + scores['2'],
      success_by_world: successByWorld,
      jurisdiction_retained: jurisdictionRetained,
      whole_frame_compliance: wholeFrameCompliance,
      action_correct: actionCorrect.length,
      action_correct_by_world: actionByWorld,
      register_fidelity: registerFidelity,
      ...(v2
        ? {
            completed_rows_denominator: completed.length,
            determinate_minimum: determinateMinimum,
            jurisdiction_minimum: jurisdictionMinimum,
            every_score_2_retains_wider_frame: everyScore2Retains,
          }
        : {}),
    };
  }
  return {
    schema: 'machinespirits.tutor-stub.resistant-learner-calibration-report.v1',
    study,
    study_id: design.studyId,
    status: Object.values(gates).every(Boolean) ? 'passed' : 'failed',
    rows,
    statistics,
    reader_agreement: agreement,
    retained_substantive_failures: {
      count: retainedSubstantiveFailures.length,
      case_ids: retainedSubstantiveFailures.map((row) => row.job.id),
      codes: retainedSubstantiveFailures.map((row) => row.registered_failure?.code || null),
      replacement_allowed: false,
    },
    prohibited_case_ids: prohibited.map((row) => row.job.id),
    gates,
    calibration_only: true,
    powered_effect_or_register_estimate_allowed: false,
    calibration_rows_poolable_into_powered_run: false,
    claim_boundary: design.claimBoundary,
  };
}

export default {
  buildTutorStubResistantLearnerCalibrationPlan,
  buildTutorStubResistantLearnerPoweredPlan,
  configureTutorStubResistantLearnerCalibrationFromCli,
  loadTutorStubResistantLearnerDesign,
  runTutorStubResistantLearnerCompilationPreflight,
  summarizeTutorStubResistantLearnerCalibration,
  summarizeTutorStubResistantLearnerMergedPoweredRun,
  tutorStubFrameRefuserR1Prompt,
  validateTutorStubResistantLearnerDesign,
};
