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
import {
  TUTOR_STUB_DEMANDED_EXHIBIT_RULE,
  mintTutorStubRivalLearnerDag,
  selectTutorStubDemandedExhibit,
  tutorStubRivalLearnerDagPrompt,
} from './tutorStubRivalLearnerDag.js';

const DESIGN_SCHEMA_V1 = 'machinespirits.tutor-stub.resistant-learner-study-design.v1';
const DESIGN_SCHEMA_V2 = 'machinespirits.tutor-stub.resistant-learner-study-design.v2';
const DESIGN_SCHEMA_V3 = 'machinespirits.tutor-stub.resistant-learner-study-design.v3';
export const TUTOR_STUB_RESISTANT_LEARNER_MERGED_DESIGN_SCHEMA_V1 =
  'machinespirits.tutor-stub.resistant-learner-merged-study-design.v1';
const B1_ID = 'resistant-learner-b1-authored-pickup';
const R1_ID = 'resistant-learner-r1-graded-engagement';
const MERGED_ID = 'resistant-learner-merged-graded-engagement';
export const TUTOR_STUB_FRAME_REFUSER_DEPTH_DESIGN_SCHEMA_V1 =
  'machinespirits.tutor-stub.frame-refuser-depth-study-design.v1';
const DEPTH_ID = 'frame-refuser-depth';
export const TUTOR_STUB_FRAME_REFUSER_SATISFIABLE_DESIGN_SCHEMA_V1 =
  'machinespirits.tutor-stub.frame-refuser-satisfiable-study-design.v1';
const SATISFIABLE_ID = 'frame-refuser-satisfiable';
export const SATISFIABLE_CURRENT_REVISION = 2;
export const SATISFIABLE_DELIVERY_TIMING_RULE = 'first_intervention_turn_at_or_after_the_demanded_exhibit_is_public';
const SATISFIABLE_MASTER_SEED = 2026083001;
const SATISFIABLE_CASE_ID_STEM = 'sat1';
const DEPTH_ARM_IDS = Object.freeze(['treatment', 'reference']);
const DEPTH_WORLDS = Object.freeze(['world_005_marrick', 'world_030_rowan_flat']);
// The seven authoritative calibration gates, byte-identical to
// design.calibration.authoritativeGates in the registered depth design file.
// The validator compares the file against this list so the code constants
// below can never drift from the registration without failing closed.
const DEPTH_AUTHORITATIVE_GATES = Object.freeze([
  'minimumDeterminateOutcomeRate 0.8 with floor 8',
  'minimumEligibleVoteRatePerSeatAndInstrument 0.8 with floor 8',
  'minimumPairwiseExactEndpointAgreement 0.8',
  'minimumTreatmentDeliveryRate 0.8 on adjudicated intervention turns',
  'maximumReferenceContaminationRate 0.1 on adjudicated intervention turns',
  'maximumConfirmedProhibitedDeliveries 0',
  'minimumJurisdictionRetainedRateOnCompletedRows 0.67 with floor 6',
]);
const DEPTH_GATE_CONSTANTS = Object.freeze({
  minimumDeterminateOutcomeRate: 0.8,
  minimumDeterminateOutcomeFloor: 8,
  minimumEligibleVoteRatePerSeatAndInstrument: 0.8,
  minimumEligibleVotesFloor: 8,
  minimumPairwiseExactEndpointAgreement: 0.8,
  minimumTreatmentDeliveryRate: 0.8,
  maximumReferenceContaminationRate: 0.1,
  maximumConfirmedProhibitedDeliveries: 0,
  minimumJurisdictionRetainedRateOnCompletedRows: 0.67,
  minimumJurisdictionRetainedFloor: 6,
});
// Revision 2, registered after the failed 2026-08-27 revision-1 calibration:
// the reference contamination gate (which re-counted typed non-delivery
// failures) is replaced by a blind-panel arm-separation bound on completed
// treatment rows; reference cleanliness stays enforced by the bundled
// adjudication question and is certified per row, reported but not gated.
const DEPTH_AUTHORITATIVE_GATES_V2 = Object.freeze([
  'minimumDeterminateOutcomeRate 0.8 with floor 8',
  'minimumEligibleVoteRatePerSeatAndInstrument 0.8 with floor 8',
  'minimumPairwiseExactEndpointAgreement 0.8',
  'minimumTreatmentDeliveryRate 0.8 on adjudicated intervention turns',
  'maximumTreatmentBridgeReadRate 0.1 on completed treatment rows (blind-panel arm separation)',
  'maximumConfirmedProhibitedDeliveries 0',
  'minimumJurisdictionRetainedRateOnCompletedRows 0.67 with floor 6',
]);
const DEPTH_GATE_CONSTANTS_V2 = Object.freeze({
  minimumDeterminateOutcomeRate: 0.8,
  minimumDeterminateOutcomeFloor: 8,
  minimumEligibleVoteRatePerSeatAndInstrument: 0.8,
  minimumEligibleVotesFloor: 8,
  minimumPairwiseExactEndpointAgreement: 0.8,
  minimumTreatmentDeliveryRate: 0.8,
  maximumTreatmentBridgeReadRate: 0.1,
  maximumConfirmedProhibitedDeliveries: 0,
  minimumJurisdictionRetainedRateOnCompletedRows: 0.67,
  minimumJurisdictionRetainedFloor: 6,
});
// The satisfiable-condition study carries the depth gates unchanged and adds
// one of its own: the demanded exhibit has to be reachable inside the outcome
// horizon, or the tutor never had the chance the study is about.
const SATISFIABLE_AUTHORITATIVE_GATES = Object.freeze([
  'minimumDeterminateOutcomeRate 0.8 with floor 8',
  'minimumEligibleVoteRatePerSeatAndInstrument 0.8 with floor 8',
  'minimumPairwiseExactEndpointAgreement 0.8',
  'minimumTreatmentDeliveryRate 0.8 on adjudicated intervention turns',
  'maximumTreatmentBridgeReadRate 0.1 on completed treatment rows',
  'maximumConfirmedProhibitedDeliveries 0',
  'minimumJurisdictionRetainedRateOnCompletedRows 0.67 with floor 6',
  'minimumDischargeOpportunityRateOnCompletedTreatmentRows 0.8: the demanded exhibit was available to the tutor within the outcome horizon',
]);
const SATISFIABLE_GATE_CONSTANTS = Object.freeze({
  ...DEPTH_GATE_CONSTANTS_V2,
  minimumDischargeOpportunityRateOnCompletedTreatmentRows: 0.8,
});
// Registered per-revision calibration constants. Revision 2 exists because
// revision 1 failed its own Gate 1 (case-id echo defect, floors sized against
// planned instead of completed dialogues, contamination double-count); the
// failed run is archived and none of its rows are reused.
const DEPTH_REVISIONS = Object.freeze({
  1: Object.freeze({
    dialogues: 20,
    perArm: 10,
    masterSeed: 2026082601,
    plannedCallsCalibration: 1280,
    calibrationMaximumReservations: 3960,
    authoritativeGates: DEPTH_AUTHORITATIVE_GATES,
    gateConstants: DEPTH_GATE_CONSTANTS,
    caseId: (armId, world, repeat) => `depth-${armId}-cal-${world}-r${repeat}`,
    artifactSchemaVersion: 'v1',
  }),
  2: Object.freeze({
    dialogues: 36,
    perArm: 18,
    masterSeed: 2026082701,
    plannedCallsCalibration: 2304,
    calibrationMaximumReservations: 7128,
    authoritativeGates: DEPTH_AUTHORITATIVE_GATES_V2,
    gateConstants: DEPTH_GATE_CONSTANTS_V2,
    // Underscore-only case ids: the failed revision-1 run showed the sealed
    // reader seat deterministically merging a hyphen-underscore boundary when
    // echoing the case id, which voided every one of its votes.
    caseId: (armId, world, repeat) => `depth_${armId}_cal_${world}_r${repeat}`,
    artifactSchemaVersion: 'v2',
  }),
  // Revision 3 exists because the revision-2 treatment instruction let the
  // tutor wrap the condition, exhibit, and re-offer inside the reference
  // move's standing formula; 3 of 11 completed treatment turns blind-read as
  // the bridge and one ended with the forbidden standing question. Sizing,
  // ceilings, gates, and floors are unchanged; only the instruction, the
  // treatment adjudication question, the seed, and the case-id stem move.
  3: Object.freeze({
    dialogues: 36,
    perArm: 18,
    masterSeed: 2026082801,
    plannedCallsCalibration: 2304,
    calibrationMaximumReservations: 7128,
    authoritativeGates: DEPTH_AUTHORITATIVE_GATES_V2,
    gateConstants: DEPTH_GATE_CONSTANTS_V2,
    // `cal3` keeps every revision-3 case id distinct from both archived
    // failed calibrations, so no row can collide with or reuse them.
    caseId: (armId, world, repeat) => `depth_${armId}_cal3_${world}_r${repeat}`,
    artifactSchemaVersion: 'v3',
  }),
  // Revision 4 exists because the revision-3 calibration failed on attrition
  // and on a quote-echo trap: the treatment adjudication banned the
  // standing-precondition formula with no rule for words the tutor quotes
  // from the learner, whose own condition-naming line IS that formula — 4 of
  // 5 exhausted treatment drafts quoted it verbatim and were rejected for
  // it. Revision 4 requires the restatement in the tutor's own words, tells
  // the adjudicator to judge only the tutor's own voice, and resizes to 48
  // dialogues so the unchanged floors of 8 completed per arm are reachable
  // at the observed 61 percent typed-failure attrition. Gates, floors, and
  // per-dialogue ceilings do not move.
  4: Object.freeze({
    dialogues: 48,
    perArm: 24,
    masterSeed: 2026082901,
    plannedCallsCalibration: 3072,
    calibrationMaximumReservations: 9504,
    authoritativeGates: DEPTH_AUTHORITATIVE_GATES_V2,
    gateConstants: DEPTH_GATE_CONSTANTS_V2,
    // `cal4` keeps every revision-4 case id distinct from all three archived
    // failed calibrations, so no row can collide with or reuse them.
    caseId: (armId, world, repeat) => `depth_${armId}_cal4_${world}_r${repeat}`,
    artifactSchemaVersion: 'v4',
  }),
});
export const TUTOR_STUB_FRAME_REFUSER_DEPTH_CURRENT_REVISION = 4;

function depthRevision(design) {
  const revision = DEPTH_REVISIONS[design?.revision];
  if (!revision) throw new Error(`frame-refuser depth revision ${JSON.stringify(design?.revision)} is not registered`);
  return revision;
}

export function tutorStubFrameRefuserDepthArtifactSchemaVersion(design) {
  return depthRevision(design).artifactSchemaVersion;
}
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

function isDepthDesign(design) {
  return design?.schema === TUTOR_STUB_FRAME_REFUSER_DEPTH_DESIGN_SCHEMA_V1;
}

function isSatisfiableDesign(design) {
  return design?.schema === TUTOR_STUB_FRAME_REFUSER_SATISFIABLE_DESIGN_SCHEMA_V1;
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

function validateTutorStubFrameRefuserDepthDesignV1(design) {
  const issues = [];
  if (!DEPTH_REVISIONS[design?.revision] || design?.studyId !== DEPTH_ID) {
    issues.push('depth design identity is unsupported');
    return { valid: false, issues };
  }
  const revision = depthRevision(design);
  if (design?.status !== 'prospective_zero_call_design_pending_typed_approval') issues.push('depth status drifted');
  if (design?.workplanItem !== 'frame-refuser-depth-study') issues.push('depth workplan item drifted');
  const lineage = design?.lineage || {};
  if (
    lineage.parentDesign !== 'config/tutor-stub-resistant-learner-merged-design.v5.json' ||
    lineage.reuseOfParentRows !== false ||
    lineage.measuredReferenceRung2Rate !== 0.114
  ) {
    issues.push('depth lineage drifted');
  }
  const population = design?.population || {};
  if (
    population.profile !== 'frame_refuser-r1-rival-dag-v3' ||
    population.baseCompatibilityId !== 'frame_refuser' ||
    !exactValues(population.worlds, DEPTH_WORLDS) ||
    population.maximumTriggerLearnerTurn !== 2 ||
    population.outcomeHorizonPostTriggerLearnerTurns !== 8
  ) {
    issues.push('depth population drifted from the sealed face-B population');
  }
  if (design?.register?.held !== 'plain' || design?.register?.reportOnly !== true) {
    issues.push('depth register hold drifted');
  }
  const treatment = design?.arms?.treatment || {};
  const reference = design?.arms?.reference || {};
  if (
    treatment.id !== 'condition_discharge' ||
    treatment.hostActionFamily !== 'reanchor_public_evidence' ||
    !String(treatment.actionInstruction || '').trim()
  ) {
    issues.push('depth treatment arm drifted');
  }
  if (
    reference.id !== 'standing_conditions_bridge' ||
    reference.hostActionFamily !== 'clarify_distinction' ||
    reference.actionInstruction !==
      'unchanged from parent design faceB tutorDeliveryContract.actionInstructions.test_bounded_distinction'
  ) {
    issues.push('depth reference arm drifted');
  }
  try {
    if (
      tutorStubResistanceHostActionFamily('condition_discharge') !== treatment.hostActionFamily ||
      tutorStubResistanceHostActionFamily('test_bounded_distinction') !== reference.hostActionFamily
    ) {
      issues.push('depth arm host action families disagree with the registered move map');
    }
  } catch (error) {
    issues.push(`depth arm move is not registered with the host: ${error.message}`);
  }
  const floors = design?.arms?.distinctDeliveredBehaviourFloors || {};
  if (
    floors.minimumTreatmentDeliveryRate !== 0.8 ||
    (design.revision === 1
      ? floors.maximumReferenceContaminationRate !== 0.1
      : floors.maximumTreatmentBridgeReadRate !== revision.gateConstants.maximumTreatmentBridgeReadRate)
  ) {
    issues.push('depth delivered-contrast floors drifted');
  }
  const enforcement = design?.tutorDeliveryEnforcement || {};
  const seat = enforcement?.perArmAdjudication?.adjudicatorSeat;
  if (
    enforcement.schema !== 'machinespirits.tutor-stub.tutor-delivery-enforcement.v1' ||
    enforcement.repairsAllowedPerEpisode !== 1 ||
    enforcement.exhaustionDisposition !== 'typed_tutor_non_delivery_failure' ||
    enforcement.exhaustionNeverScored !== true ||
    enforcement.typedFailureIsNotDeterminate !== true ||
    !String(enforcement?.perArmAdjudication?.treatmentQuestion || '').trim() ||
    !String(enforcement?.perArmAdjudication?.referenceQuestion || '').trim() ||
    !exactValues(seat, {
      id: 'tutor_delivery_adjudicator',
      modelRef: 'codex.gpt-5.6-sol',
      provider: 'codex',
      model: 'gpt-5.6-sol',
      effort: 'low',
    })
  ) {
    issues.push('depth tutor-delivery enforcement drifted');
  }
  if (
    design?.measurement?.endpointField !== 'final_graded_engagement_rung' ||
    design?.measurement?.readerPanel?.protocolSource !==
      'config/tutor-stub-resistant-learner-merged-semantic-registration.v5.json' ||
    design?.measurement?.readerPanel?.minimumPairwiseExactAgreement !== 0.8
  ) {
    issues.push('depth measurement or reader panel drifted');
  }
  if (
    design?.calibration?.dialogues !== revision.dialogues ||
    design?.calibration?.perArm !== revision.perArm ||
    !exactValues(design?.calibration?.authoritativeGates, revision.authoritativeGates)
  ) {
    issues.push('depth calibration registration drifted from the code gate constants');
  }
  if (
    design?.poweredRun?.authorization !== 'not_granted_by_this_design_or_calibration' ||
    design?.poweredRun?.calibrationRowsExcluded !== true ||
    design?.poweredRun?.registeredAlternative !== 0.35
  ) {
    issues.push('depth powered-run boundary drifted');
  }
  if (design?.randomization?.masterSeed !== revision.masterSeed) issues.push('depth master seed drifted');
  if (design.revision >= 2 && design?.randomization?.caseIdRule !== 'underscore_only_lowercase') {
    issues.push('depth revision 2 requires the underscore-only case-id rule');
  }
  if (design.revision >= 2 && design?.lineage?.firstCalibration?.rowsReused !== false) {
    issues.push('depth revision 2 must disclose the failed first calibration and refuse row reuse');
  }
  if (design.revision >= 3 && design?.lineage?.secondCalibration?.rowsReused !== false) {
    issues.push('depth revision 3 must disclose the failed second calibration and refuse row reuse');
  }
  if (design.revision >= 4 && design?.lineage?.thirdCalibration?.rowsReused !== false) {
    issues.push('depth revision 4 must disclose the failed third calibration and refuse row reuse');
  }
  const ceilings = design?.attemptCeilings || {};
  if (
    ceilings.plannedCallsCalibration !== revision.plannedCallsCalibration ||
    ceilings.maximumReservationsPerPlannedCall !== 3 ||
    ceilings.calibrationMaximumReservations !== revision.calibrationMaximumReservations
  ) {
    issues.push('depth attempt ceilings drifted');
  }
  if (
    design?.models?.tutor !== LUNA_MODEL_REF ||
    design?.models?.learner !== LUNA_MODEL_REF ||
    design?.models?.cliEffort !== 'low' ||
    design?.models?.analysisScope !== 'classifier_and_learner_record_support_only'
  ) {
    issues.push('depth model stack drifted from the sealed stack');
  }
  if (
    design?.callAuthority?.grantsModelCalls !== false ||
    design?.callAuthority?.approvalSurvivesCodeFix !== true ||
    design?.callAuthority?.goNoteRequired !== false
  ) {
    issues.push('depth call authority drifted');
  }
  if (design?.dispositions?.validUnitRerun !== false || design?.dispositions?.interimOutcomeAnalysis !== false) {
    issues.push('depth dispositions drifted');
  }
  return { valid: issues.length === 0, issues };
}

/**
 * The satisfiable-condition study (workplan frame-refuser-satisfiable-condition).
 * Its whole point is that exactly ONE registered thing moves against the sealed
 * face-B reference: the kind of node the learner demands. So this validator is
 * mostly a hold-still check — reference arm, ladder, panel, stack, ceilings and
 * dispositions must match the depth study's sealed values, or the measured
 * 0.114 base rate it is compared against stops meaning anything.
 */
function validateTutorStubFrameRefuserSatisfiableDesignV1(design) {
  const issues = [];
  // Revision 2 exists because revision 1's treatment move could not be
  // delivered: a premise becomes public through the paced release schedule, not
  // by the tutor speaking it, and both demanded exhibits release after the turn
  // the move would have fired on. Both arms now deliver at or after the exhibit
  // is public. See the design's whyDeliveryWaitsForRelease block.
  if (design?.revision !== SATISFIABLE_CURRENT_REVISION || design?.studyId !== SATISFIABLE_ID) {
    issues.push('satisfiable design identity is unsupported');
    return { valid: false, issues };
  }
  if (design?.status !== 'prospective_zero_call_design_pending_implementation_and_typed_approval') {
    issues.push('satisfiable status drifted');
  }
  if (design?.workplanItem !== 'frame-refuser-satisfiable-condition') issues.push('satisfiable workplan item drifted');

  const lineage = design?.lineage || {};
  if (
    lineage.parentDesign !== 'config/tutor-stub-resistant-learner-merged-design.v5.json' ||
    lineage.predecessorStudy !== 'config/tutor-stub-frame-refuser-depth-design.v4.json' ||
    lineage.predecessorRowsReused !== false ||
    lineage.measuredReferenceRung2Rate !== 0.114
  ) {
    issues.push('satisfiable lineage drifted');
  }

  const population = design?.population || {};
  if (
    population.profile !== 'frame_refuser_exhibit-r2-rival-dag-v1' ||
    population.baseCompatibilityId !== 'frame_refuser' ||
    !exactValues(population.worlds, DEPTH_WORLDS) ||
    population.maximumTriggerLearnerTurn !== 2 ||
    population.outcomeHorizonPostTriggerLearnerTurns !== 8
  ) {
    issues.push('satisfiable population drifted from the sealed face-B population');
  }

  // The one registered change, and the rule that keeps it dischargeable.
  const mint = population?.rivalDagPersona?.mint || {};
  if (mint.openNodeKind !== 'exhibit' || mint.adHocAuthorshipAllowed !== false) {
    issues.push('satisfiable mint is not the registered exhibit mint');
  }
  if (population?.rivalDagPersona?.demandSelectionRule?.id !== TUTOR_STUB_DEMANDED_EXHIBIT_RULE) {
    issues.push('satisfiable demand selection rule drifted from the implemented rule');
  }
  // The revision-2 fix: the tutor cannot bring a premise forward, so the move
  // waits for it, and both arms wait together or the contrast is not a contrast.
  const timing = population?.rivalDagPersona?.demandSelectionRule?.deliveryTiming || {};
  if (
    timing.id !== SATISFIABLE_DELIVERY_TIMING_RULE ||
    timing.heldIdenticalAcrossArms !== true ||
    !String(timing.ifTheExhibitNeverBecomesPublicInsideTheHorizon || '').trim()
  ) {
    issues.push('satisfiable delivery timing rule drifted');
  }
  if (!String(design?.whyDeliveryWaitsForRelease?.fix || '').trim()) {
    issues.push('satisfiable design must record why delivery waits for release');
  }

  // Both adjudication questions must be written out, not left as a reference:
  // without them no arm projection can be built.
  const adjudication = design?.tutorDeliveryEnforcement?.perArmAdjudication || {};
  if (
    design?.tutorDeliveryEnforcement?.schema !== 'machinespirits.tutor-stub.tutor-delivery-enforcement.v1' ||
    design?.tutorDeliveryEnforcement?.repairsAllowedPerEpisode !== 1 ||
    design?.tutorDeliveryEnforcement?.exhaustionNeverScored !== true ||
    design?.tutorDeliveryEnforcement?.typedFailureIsNotDeterminate !== true ||
    !String(adjudication.treatmentQuestion || '').trim() ||
    !String(adjudication.referenceQuestion || '').trim() ||
    !exactValues(adjudication.adjudicatorSeat, {
      id: 'tutor_delivery_adjudicator',
      modelRef: 'codex.gpt-5.6-sol',
      provider: 'codex',
      model: 'gpt-5.6-sol',
      effort: 'low',
    })
  ) {
    issues.push('satisfiable tutor-delivery enforcement drifted');
  }
  // The reference question must forbid the demanded exhibit, or both arms could
  // deliver the same behaviour and the gate would compare a copy with itself.
  if (!/WITHOUT naming the exhibit/u.test(String(adjudication.referenceQuestion || ''))) {
    issues.push('satisfiable reference adjudication must forbid naming the demanded exhibit');
  }
  // The treatment question must judge the tutor's own voice; the learner's own
  // line IS the banned formula, and quoting it sank four revision-3 drafts.
  if (!/Judge only the tutor's own voice/u.test(String(adjudication.treatmentQuestion || ''))) {
    issues.push('satisfiable treatment adjudication must carry the quote-echo exemption');
  }

  if (design?.register?.held !== 'plain' || design?.register?.reportOnly !== true) {
    issues.push('satisfiable register hold drifted');
  }

  const treatment = design?.arms?.treatment || {};
  const reference = design?.arms?.reference || {};
  if (
    treatment.id !== 'exhibit_discharge' ||
    treatment.hostActionFamily !== 'reanchor_public_evidence' ||
    !String(treatment.actionInstruction || '').trim()
  ) {
    issues.push('satisfiable treatment arm drifted');
  }
  // The reference arm is the sealed face-B move and may not be reworded here;
  // it is the thing the 0.114 base rate was measured on.
  if (
    reference.id !== 'standing_conditions_bridge' ||
    reference.hostActionFamily !== 'clarify_distinction' ||
    reference.actionInstruction !==
      'unchanged from parent design faceB tutorDeliveryContract.actionInstructions.test_bounded_distinction'
  ) {
    issues.push('satisfiable reference arm drifted from the sealed face-B move');
  }
  try {
    if (
      tutorStubResistanceHostActionFamily('condition_discharge') !== treatment.hostActionFamily ||
      tutorStubResistanceHostActionFamily('test_bounded_distinction') !== reference.hostActionFamily
    ) {
      issues.push('satisfiable arm host action families disagree with the registered move map');
    }
  } catch (error) {
    issues.push(`satisfiable arm move is not registered with the host: ${error.message}`);
  }

  const floors = design?.arms?.distinctDeliveredBehaviourFloors || {};
  if (
    floors.minimumTreatmentDeliveryRate !== SATISFIABLE_GATE_CONSTANTS.minimumTreatmentDeliveryRate ||
    floors.maximumTreatmentBridgeReadRate !== SATISFIABLE_GATE_CONSTANTS.maximumTreatmentBridgeReadRate
  ) {
    issues.push('satisfiable delivered-contrast floors drifted');
  }

  if (
    design?.measurement?.endpointField !== 'final_graded_engagement_rung' ||
    design?.measurement?.readerPanel?.protocolSource !==
      'config/tutor-stub-resistant-learner-merged-semantic-registration.v5.json' ||
    design?.measurement?.readerPanel?.minimumPairwiseExactAgreement !== 0.8
  ) {
    issues.push('satisfiable measurement or reader panel drifted');
  }
  // The ladder is deliberately NOT amended despite the known v4 reader
  // disagreement; amending it would break comparability with the measured base.
  if (!/BYTE-IDENTICAL/u.test(String(design?.measurement?.ladderSource || ''))) {
    issues.push('satisfiable ladder must declare itself byte-identical to the sealed face-B rungs');
  }

  if (
    design?.calibration?.dialogues !== 48 ||
    design?.calibration?.perArm !== 24 ||
    !exactValues(design?.calibration?.authoritativeGates, SATISFIABLE_AUTHORITATIVE_GATES)
  ) {
    issues.push('satisfiable calibration registration drifted from the code gate constants');
  }

  if (
    design?.poweredRun?.authorization !== 'not_granted_by_this_design_or_calibration' ||
    design?.poweredRun?.calibrationRowsExcluded !== true ||
    design?.poweredRun?.registeredAlternative !== 0.35
  ) {
    issues.push('satisfiable powered-run boundary drifted');
  }

  if (design?.randomization?.masterSeed !== SATISFIABLE_MASTER_SEED) issues.push('satisfiable master seed drifted');
  if (design?.randomization?.caseIdRule !== 'underscore_only_lowercase') {
    issues.push('satisfiable design requires the underscore-only case-id rule');
  }
  if (design?.randomization?.caseIdStem !== SATISFIABLE_CASE_ID_STEM) issues.push('satisfiable case-id stem drifted');

  const ceilings = design?.attemptCeilings || {};
  if (
    ceilings.plannedCallsCalibration !== 3072 ||
    ceilings.maximumReservationsPerPlannedCall !== 3 ||
    ceilings.calibrationMaximumReservations !== 9504
  ) {
    issues.push('satisfiable attempt ceilings drifted');
  }

  if (
    design?.models?.tutor !== LUNA_MODEL_REF ||
    design?.models?.learner !== LUNA_MODEL_REF ||
    design?.models?.cliEffort !== 'low' ||
    design?.models?.analysisScope !== 'classifier_and_learner_record_support_only'
  ) {
    issues.push('satisfiable model stack drifted from the sealed stack');
  }

  if (design?.callAuthority?.grantsModelCalls !== false || design?.callAuthority?.approvalSurvivesCodeFix !== true) {
    issues.push('satisfiable call authority drifted');
  }
  if (
    design?.dispositions?.validUnitRerun !== false ||
    design?.dispositions?.interimOutcomeAnalysis !== false ||
    !String(design?.dispositions?.demandedExhibitUnavailable || '').trim()
  ) {
    issues.push('satisfiable dispositions drifted');
  }
  return { valid: issues.length === 0, issues };
}

export function validateTutorStubResistantLearnerDesign(design) {
  if (isSatisfiableDesign(design)) return validateTutorStubFrameRefuserSatisfiableDesignV1(design);
  if (isDepthDesign(design)) return validateTutorStubFrameRefuserDepthDesignV1(design);
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

const sealedParentCache = new Map();

function sealedParentDesign(design, root) {
  const key = `${root}:${design.lineage.parentDesign}`;
  if (!sealedParentCache.has(key)) {
    sealedParentCache.set(key, loadTutorStubResistantLearnerDesign({ designPath: design.lineage.parentDesign, root }));
  }
  return sealedParentCache.get(key);
}

/**
 * The satisfiable design records its concession condition as a REFERENCE to
 * the sealed face-B one ("unchanged from parent design faceB …") rather than
 * copying it, so the two can never drift apart. Resolve that reference here,
 * once, and hand the minter a persona with the real condition attached.
 */
export function tutorStubFrameRefuserSatisfiableRivalDagDesign(design, { root = process.cwd() } = {}) {
  if (!isSatisfiableDesign(design)) {
    throw new Error('the satisfiable rival-DAG projection requires the frame-refuser satisfiable design');
  }
  const parent = sealedParentDesign(design, root);
  const faceB = mergedFace(parent.design, 'faceB');
  return {
    randomization: structuredClone(design.randomization),
    rivalDagPersona: {
      ...structuredClone(design.population.rivalDagPersona),
      concessionCondition: structuredClone(faceB.rivalDagPersona.concessionCondition),
    },
  };
}

/**
 * Project one satisfiable-study arm onto the sealed parent face-B execution
 * design, the same way the depth study does. The projection keeps the merged
 * v1 schema so every rival-DAG dispatch in the runtime treats it exactly like
 * the sealed face-B design.
 *
 * Only four things differ from the sealed face B: the intervention move, the
 * per-arm delivery contract, this study's seed, and its calibration constants.
 * The reference arm keeps the sealed contract text byte for byte; its
 * adjudication question is the registered reference question, which adds the
 * clause forbidding the demanded exhibit on that turn.
 *
 * The delivery scope carries the revision-2 fix: the move fires on the first
 * intervention turn at or after the demanded exhibit is public, the same rule
 * in both arms. Without it the treatment move cannot be delivered at all.
 */
export function tutorStubFrameRefuserSatisfiableArmDesign(design, armId, { root = process.cwd() } = {}) {
  if (!isSatisfiableDesign(design)) {
    throw new Error('the satisfiable arm projection requires the frame-refuser satisfiable design');
  }
  if (!DEPTH_ARM_IDS.includes(armId)) {
    throw new Error(`frame-refuser satisfiable arm ${JSON.stringify(armId)} is not registered`);
  }
  const parent = sealedParentDesign(design, root);
  const faceB = tutorStubResistantLearnerMergedFaceDesign(parent.design, 'faceB');
  const arm = design.arms[armId];
  const move = armId === 'treatment' ? 'condition_discharge' : faceB.intervention.action;
  const sealedContract = faceB.tutorDeliveryContract;
  const enforcement = design.tutorDeliveryEnforcement;
  const armEnforcement = {
    ...structuredClone(sealedContract.enforcement),
    appliesWhen: enforcement.appliesWhen,
    scope: enforcement.scope,
    position: enforcement.position,
    check: {
      ...structuredClone(sealedContract.enforcement.check),
      adjudicatorSeat: structuredClone(enforcement.perArmAdjudication.adjudicatorSeat),
      question:
        armId === 'treatment'
          ? enforcement.perArmAdjudication.treatmentQuestion
          : enforcement.perArmAdjudication.referenceQuestion,
    },
    repairsAllowedPerEpisode: enforcement.repairsAllowedPerEpisode,
    exhaustionDisposition: enforcement.exhaustionDisposition,
    exhaustionNeverScored: enforcement.exhaustionNeverScored,
    typedFailureIsNotDeterminate: enforcement.typedFailureIsNotDeterminate,
    ...(armId === 'treatment'
      ? {
          exhaustionCode: 'tutor_stub_tutor_exhibit_discharge_non_delivery',
          repairInstruction: `Your candidate did not deliver the registered exhibit discharge. Rewrite the tutor turn now: ${arm.actionInstruction}`,
        }
      : {}),
  };
  // The treatment contract omits compactActionInstructions on purpose, as the
  // depth projection does: the compile falls back to the host's own compact
  // text, so there is one source rather than two copies that can drift.
  const tutorDeliveryContract =
    armId === 'treatment'
      ? {
          actionInstructions: { condition_discharge: arm.actionInstruction },
          registerInstructions: structuredClone(sealedContract.registerInstructions),
          enforcement: armEnforcement,
        }
      : { ...structuredClone(sealedContract), enforcement: armEnforcement };
  return {
    ...faceB,
    status: design.status,
    workplanItem: design.workplanItem,
    claimBoundary: design.claimBoundary,
    // The arm must carry THIS study's population, not the sealed face-B one:
    // its jobs run study code R2, and the minter refuses an R2 job whose
    // design does not register the exhibit mint. The concession condition is
    // resolved from the sealed face B, so it cannot drift from it.
    population: {
      ...structuredClone(design.population),
      triggerRegistration: faceB.population.triggerRegistration,
    },
    rivalDagPersona: tutorStubFrameRefuserSatisfiableRivalDagDesign(design, { root }).rivalDagPersona,
    satisfiableStudyId: design.studyId,
    satisfiableExecution: {
      studyId: design.studyId,
      armId,
      move,
      registeredMoveId: arm.id,
      hostActionFamily: arm.hostActionFamily,
      // Carried onto the arm so the runtime never has to re-derive when the
      // move may fire, and so a projection that lost the rule is visible.
      deliveryTimingRule: design.population.rivalDagPersona.demandSelectionRule.deliveryTiming.id,
    },
    intervention: {
      action: move,
      registeredMoveId: arm.id,
      definition: arm.definition,
      heldFixedAcrossRegisters: true,
    },
    tutorDeliveryContract,
    randomization: structuredClone(design.randomization),
    calibration: {
      ...faceB.calibration,
      ...SATISFIABLE_GATE_CONSTANTS,
      dialogues: design.calibration.perArm,
      completedRowsDenominator: true,
    },
    dispositions: structuredClone(design.dispositions),
    callAuthority: structuredClone(design.callAuthority),
  };
}

// Project one depth arm onto the sealed parent face-B execution design. The
// projection keeps the merged v1 schema so every rival-DAG dispatch in the
// runtime treats it exactly like the sealed face-B design; only the
// intervention move, the per-arm delivery contract, the depth randomization
// seed, and the depth calibration constants differ. The reference arm keeps
// the sealed contract text and instruction bytes unchanged; its adjudication
// question is the registered per-arm reference question, which adds the
// no-exhibit contamination clause the depth design measures.
export function tutorStubFrameRefuserDepthArmDesign(design, armId, { root = process.cwd() } = {}) {
  if (!isDepthDesign(design)) throw new Error('the depth arm projection requires the frame-refuser depth design');
  if (!DEPTH_ARM_IDS.includes(armId)) {
    throw new Error(`frame-refuser depth arm ${JSON.stringify(armId)} is not registered`);
  }
  const parent = sealedParentDesign(design, root);
  const faceB = tutorStubResistantLearnerMergedFaceDesign(parent.design, 'faceB');
  const arm = design.arms[armId];
  const move = armId === 'treatment' ? 'condition_discharge' : faceB.intervention.action;
  const sealedContract = faceB.tutorDeliveryContract;
  const enforcement = design.tutorDeliveryEnforcement;
  const armEnforcement = {
    ...structuredClone(sealedContract.enforcement),
    appliesWhen: enforcement.appliesWhen,
    scope: enforcement.scope,
    position: enforcement.position,
    check: {
      ...structuredClone(sealedContract.enforcement.check),
      adjudicatorSeat: structuredClone(enforcement.perArmAdjudication.adjudicatorSeat),
      question:
        armId === 'treatment'
          ? enforcement.perArmAdjudication.treatmentQuestion
          : enforcement.perArmAdjudication.referenceQuestion,
    },
    repairsAllowedPerEpisode: enforcement.repairsAllowedPerEpisode,
    exhaustionDisposition: enforcement.exhaustionDisposition,
    exhaustionNeverScored: enforcement.exhaustionNeverScored,
    typedFailureIsNotDeterminate: enforcement.typedFailureIsNotDeterminate,
    ...(armId === 'treatment'
      ? {
          exhaustionCode: 'tutor_stub_tutor_condition_discharge_non_delivery',
          repairInstruction: `Your candidate did not deliver the registered condition-discharge. Rewrite the tutor turn now: ${arm.actionInstruction}`,
        }
      : {}),
  };
  // The treatment contract omits compactActionInstructions on purpose: the
  // compile falls back to the host COMPACT_MOVE_INSTRUCTIONS entry, so the
  // compact text has one source instead of two copies that can drift.
  const tutorDeliveryContract =
    armId === 'treatment'
      ? {
          actionInstructions: { condition_discharge: arm.actionInstruction },
          registerInstructions: structuredClone(sealedContract.registerInstructions),
          enforcement: armEnforcement,
        }
      : { ...structuredClone(sealedContract), enforcement: armEnforcement };
  return {
    ...faceB,
    status: design.status,
    workplanItem: design.workplanItem,
    claimBoundary: design.claimBoundary,
    depthStudyId: design.studyId,
    depthExecution: {
      studyId: design.studyId,
      armId,
      move,
      registeredMoveId: arm.id,
      hostActionFamily: arm.hostActionFamily,
    },
    intervention: {
      action: move,
      registeredMoveId: arm.id,
      definition: arm.definition,
      heldFixedAcrossRegisters: true,
    },
    tutorDeliveryContract,
    randomization: structuredClone(design.randomization),
    calibration: {
      ...faceB.calibration,
      ...depthRevision(design).gateConstants,
      dialogues: design.calibration.perArm,
      completedRowsDenominator: true,
    },
    dispositions: structuredClone(design.dispositions),
    callAuthority: structuredClone(design.callAuthority),
  };
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

function buildFrameRefuserDepthJobs(design) {
  const seed = design.randomization.masterSeed;
  const revision = depthRevision(design);
  const repeatsPerWorld = revision.perArm / design.population.worlds.length;
  const jobs = [];
  for (const armId of DEPTH_ARM_IDS) {
    const arm = design.arms[armId];
    const move = armId === 'treatment' ? 'condition_discharge' : 'test_bounded_distinction';
    for (const world of design.population.worlds) {
      for (let repeat = 1; repeat <= repeatsPerWorld; repeat += 1) {
        // Revision 2 case ids are underscore-only: the sealed reader seat
        // must echo the case id byte-exactly, and the failed revision-1 run
        // showed it deterministically merging hyphen-underscore boundaries.
        if (design.revision >= 2 && !/^[a-z0-9_]+$/u.test(revision.caseId(armId, world, repeat))) {
          throw new Error('depth revision 2 case ids must be lowercase underscore-only');
        }
        jobs.push({
          id: revision.caseId(armId, world, repeat),
          study: 'R1',
          arm_id: armId,
          world,
          register: 'plain',
          action: move,
          registered_move_id: arm.id,
          pedagogical_move: move,
          host_action_family: tutorStubResistanceHostActionFamily(move),
          maximum_trigger_turn: design.population.maximumTriggerLearnerTurn,
          outcome_horizon_learner_turns: design.population.outcomeHorizonPostTriggerLearnerTurns,
          repeat,
        });
      }
    }
  }
  return orderedJobs(jobs, seed).map((job, index) => ({
    ...job,
    batch_id: `batch_${String(Math.floor(index / 4) + 1).padStart(2, '0')}`,
    seed: job.run_seed,
    realization: job.register,
    assignment_manifest_sha256: canonicalSha256({
      id: job.id,
      arm: job.arm_id,
      world: job.world,
      register: job.register,
      action: job.action,
      seed: job.run_seed,
    }),
    assignment_rank_sha256: job.order_sha256,
  }));
}

/**
 * Satisfiable-condition jobs. Same shape as the depth jobs, plus the one thing
 * this study needs to be true before a single call is made: every job carries
 * a demanded exhibit the tutor can actually enter into the record inside the
 * outcome horizon.
 *
 * Fail-closed. Minting the rival DAG and resolving the demand here means a
 * world that cannot supply one stops the PLAN BUILD, not the run — the defect
 * the predecessor study only discovered after paying for 38 dialogues.
 */
function buildFrameRefuserSatisfiableJobs(design, { root = process.cwd() } = {}) {
  const seed = design.randomization.masterSeed;
  const perArm = design.calibration.perArm;
  const repeatsPerWorld = perArm / design.population.worlds.length;
  const stem = design.randomization.caseIdStem;
  const maximumTriggerTurn = design.population.maximumTriggerLearnerTurn;
  const horizon = design.population.outcomeHorizonPostTriggerLearnerTurns;
  const mintDesign = tutorStubFrameRefuserSatisfiableRivalDagDesign(design, { root });
  const jobs = [];
  for (const armId of DEPTH_ARM_IDS) {
    const arm = design.arms[armId];
    const move = armId === 'treatment' ? 'condition_discharge' : 'test_bounded_distinction';
    for (const world of design.population.worlds) {
      for (let repeat = 1; repeat <= repeatsPerWorld; repeat += 1) {
        const id = `${stem}_${armId}_cal_${world}_r${repeat}`;
        if (!/^[a-z0-9_]+$/u.test(id)) {
          throw new Error('satisfiable case ids must be lowercase underscore-only');
        }
        // Resolve the demand at the LAST turn the trigger may fire: a premise
        // that qualifies then qualifies at every earlier trigger turn too, so
        // this is the strictest check the plan can make without knowing when
        // the trigger actually lands.
        const dag = mintTutorStubRivalLearnerDag({ design: mintDesign, job: { id, study: 'R2', world }, root });
        const demand = selectTutorStubDemandedExhibit({
          dag,
          triggerTurn: maximumTriggerTurn,
          outcomeHorizonPostTriggerLearnerTurns: horizon,
        });
        jobs.push({
          id,
          study: 'R2',
          arm_id: armId,
          world,
          register: 'plain',
          action: move,
          registered_move_id: arm.id,
          pedagogical_move: move,
          host_action_family: tutorStubResistanceHostActionFamily(move),
          maximum_trigger_turn: maximumTriggerTurn,
          outcome_horizon_learner_turns: horizon,
          demanded_exhibit: {
            rule: demand.rule,
            node_id: demand.demandedNodeId,
            premise_id: demand.demandedPremiseId,
            release_turn: demand.releaseTurn,
          },
          // The tutor cannot bring a premise forward, so the registered move
          // waits for it. Same floor in both arms: the contrast is what the
          // tutor does with an exhibit both tutors can see, not who saw one.
          delivery_timing_rule: SATISFIABLE_DELIVERY_TIMING_RULE,
          earliest_delivery_turn: demand.releaseTurn,
          latest_delivery_turn: maximumTriggerTurn + horizon,
          rival_dag_sha256: dag.sha256,
          repeat,
        });
      }
    }
  }
  return orderedJobs(jobs, seed).map((job, index) => ({
    ...job,
    batch_id: `batch_${String(Math.floor(index / 4) + 1).padStart(2, '0')}`,
    seed: job.run_seed,
    realization: job.register,
    assignment_manifest_sha256: canonicalSha256({
      id: job.id,
      arm: job.arm_id,
      world: job.world,
      register: job.register,
      action: job.action,
      demanded_premise: job.demanded_exhibit.premise_id,
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

export function buildTutorStubResistantLearnerCalibrationPlan(design, { root = process.cwd() } = {}) {
  const validation = validateTutorStubResistantLearnerDesign(design);
  if (!validation.valid) throw new Error(`resistant-learner design invalid: ${validation.issues.join('; ')}`);
  const merged = isMergedDesign(design);
  const depth = isDepthDesign(design);
  const satisfiable = isSatisfiableDesign(design);
  const jobs = satisfiable
    ? buildFrameRefuserSatisfiableJobs(design, { root })
    : depth
      ? buildFrameRefuserDepthJobs(design)
      : merged
        ? buildMergedJobs(design)
        : design.studyId === B1_ID
          ? buildB1Jobs(design)
          : buildR1Jobs(design);
  const expectedJobs = satisfiable
    ? design.calibration.dialogues
    : depth
      ? depthRevision(design).dialogues
      : merged
        ? 36
        : 18;
  if (jobs.length !== expectedJobs || new Set(jobs.map((job) => job.id)).size !== expectedJobs) {
    throw new Error(`resistant-learner calibration requires ${expectedJobs} unique jobs`);
  }
  const plan = {
    schema: satisfiable
      ? 'machinespirits.tutor-stub.frame-refuser-satisfiable-calibration-plan.v1'
      : depth
        ? `machinespirits.tutor-stub.frame-refuser-depth-calibration-plan.${depthRevision(design).artifactSchemaVersion}`
        : merged
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
  const armExecution = loaded.design.depthExecution || loaded.design.satisfiableExecution;
  if (armExecution) {
    // The depth and satisfiable studies both reassign the compiled pedagogical
    // move per arm. Only the in-memory runtime copy changes; the v9
    // registration file on disk keeps its own sealed assignment
    // (test_bounded_distinction).
    runtime.registration.design.factors.actionFit.assignments[loaded.design.population.baseCompatibilityId] = {
      matched: armExecution.move,
    };
  }
  runtime.realization = job.register;
  runtime.repeat = job.batch_id;
  state.resistanceActionRegisterStudy = {
    ...runtime,
    dynamic_confirmation: true,
    resistant_learner_calibration: true,
    // The RUNTIME study code, not the mint's. Both the depth and satisfiable
    // studies run the standing-rivalry runtime path and its trigger semantics,
    // so both stay 'R1' here; the satisfiable study's jobs carry study 'R2',
    // which selects the exhibit mint and nothing else. Setting 'R2' here would
    // silently route the trigger observation and semantic runtime elsewhere.
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
    ...(job.delivery_timing_rule
      ? {
          delivery_timing_rule: job.delivery_timing_rule,
          earliest_delivery_turn: job.earliest_delivery_turn,
          latest_delivery_turn: job.latest_delivery_turn,
          demanded_exhibit: structuredClone(job.demanded_exhibit),
          pending_intervention_trigger: null,
          intervention_turn: null,
        }
      : {}),
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
    ...(job.arm_id
      ? {
          armId: job.arm_id,
          depthStudyId: loaded.design.depthStudyId || null,
          satisfiableStudyId: loaded.design.satisfiableStudyId || null,
        }
      : {}),
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
  const executionDesign = isDepthDesign(loaded.design)
    ? tutorStubFrameRefuserDepthArmDesign(loaded.design, job.arm_id, { root })
    : isSatisfiableDesign(loaded.design)
      ? tutorStubFrameRefuserSatisfiableArmDesign(loaded.design, job.arm_id, { root })
      : isMergedDesign(loaded.design)
        ? tutorStubResistantLearnerMergedFaceDesign(loaded.design, job.face_id)
        : loaded.design;
  const executionLoaded = { ...loaded, design: executionDesign };
  const expectedTurns = job.maximum_trigger_turn + job.outcome_horizon_learner_turns;
  const expectedObservation = executionDesign.models.triggerObservation.semantics;
  const expectedAutoLearnerProfileId = isSatisfiableDesign(loaded.design)
    ? 'frame_refuser_exhibit'
    : b1
      ? 'bored'
      : 'frame_refuser';
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
    autoLearnerProfileId !== expectedAutoLearnerProfileId ||
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

const worldByIdCache = new Map();

function catalogRootWorld(root, worldId) {
  const key = `${root}:${worldId}`;
  if (!worldByIdCache.has(key)) {
    const worldDirectory = path.join(root, 'config', 'drama-derivation');
    const match = fs
      .readdirSync(worldDirectory)
      .filter((name) => /^world-.*\.yaml$/u.test(name))
      .map((name) => loadWorld(path.join(worldDirectory, name)))
      .find((world) => world.id === worldId);
    if (!match) throw new Error(`world ${worldId} is absent from the catalog`);
    worldByIdCache.set(key, match);
  }
  return worldByIdCache.get(key);
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

// Case-id stems of every archived depth calibration. A satisfiable case id
// that matched one of these could collide with a row from a failed run, and
// reusing such a row is resampling after a failure.
const ARCHIVED_DEPTH_CASE_ID_STEMS = Object.freeze(['depth-', 'depth_']);

/**
 * The satisfiable design's own seven pre-launch checks, run zero-call. This is
 * a PLAN preflight, not a launch preflight: it proves the plan is buildable and
 * every demand in it is dischargeable. It does not compile the runtime or probe
 * a route, because the design does not yet carry its per-arm delivery
 * enforcement text — that is the next design decision, not a code gap.
 *
 * The eighth registered check (clean detached launch checkout) is deliberately
 * absent: provenance is recorded at launch, never enforced here.
 */
export function runTutorStubFrameRefuserSatisfiablePlanPreflight({ loaded, root = process.cwd() } = {}) {
  const design = loaded?.design;
  if (!isSatisfiableDesign(design)) {
    throw new Error('the satisfiable plan preflight requires the frame-refuser satisfiable design');
  }
  const plan = buildTutorStubResistantLearnerCalibrationPlan(design, { root });
  const parent = sealedParentDesign(design, root);
  const faceB = mergedFace(parent.design, 'faceB');
  const mintDesign = tutorStubFrameRefuserSatisfiableRivalDagDesign(design, { root });
  const worldRegistry = auditRuntimeWorldRegistry(design.population.worlds, root);

  // Re-mint every job independently of the plan, so this checks the mint
  // rather than trusting what the plan build recorded.
  const mints = plan.jobs.map((job) => {
    const dag = mintTutorStubRivalLearnerDag({ design: mintDesign, job, root });
    const world = catalogRootWorld(root, job.world);
    const authoredPremises = new Set(world.proofPaths[0].premises);
    return {
      job_id: job.id,
      world: job.world,
      every_node_is_an_exhibit: dag.openNodes.every((node) => node.openNodeKind === 'exhibit'),
      every_node_resolves_to_an_authored_premise: dag.openNodes.every((node) =>
        authoredPremises.has(node.sourcePremiseId),
      ),
      // Re-resolve the demand from the fresh mint and compare it with what the
      // plan recorded, rather than reading the plan's own answer back.
      demand_matches_plan: (() => {
        const demand = selectTutorStubDemandedExhibit({
          dag,
          triggerTurn: job.maximum_trigger_turn,
          outcomeHorizonPostTriggerLearnerTurns: job.outcome_horizon_learner_turns,
        });
        return (
          demand.demandedNodeId === job.demanded_exhibit.node_id &&
          demand.demandedPremiseId === job.demanded_exhibit.premise_id &&
          demand.releaseTurn === job.demanded_exhibit.release_turn
        );
      })(),
      sha256_matches_plan: dag.sha256 === job.rival_dag_sha256,
    };
  });

  const perDialogue = faceB.attemptCeilings ?? parent.design.attemptCeilings;
  const plannedCalls = plan.jobs.length * Number(perDialogue.plannedCallsPerDialogue);
  const reservationCeiling = plan.jobs.length * Number(perDialogue.maximumReservationsPerDialogue);

  const checks = {
    // 1. Every assigned world yields a demanded exhibit; the plan build throws
    // otherwise, so reaching here already proves it. Recorded anyway.
    every_job_has_a_demanded_exhibit: plan.jobs.every(
      (job) => job.demanded_exhibit?.premise_id && Number.isInteger(job.demanded_exhibit.release_turn),
    ),
    demand_rule_is_the_implemented_rule: plan.jobs.every(
      (job) => job.demanded_exhibit.rule === TUTOR_STUB_DEMANDED_EXHIBIT_RULE,
    ),
    demanded_exhibit_inside_the_outcome_horizon: plan.jobs.every(
      (job) =>
        job.demanded_exhibit.release_turn > job.maximum_trigger_turn &&
        job.demanded_exhibit.release_turn <= job.maximum_trigger_turn + job.outcome_horizon_learner_turns,
    ),
    // 1b. The registered move must have a turn it can actually fire on: the
    // exhibit public, and still inside the horizon. Without this the treatment
    // move is undeliverable, which is the revision-1 defect.
    delivery_window_is_reachable: plan.jobs.every(
      (job) =>
        job.earliest_delivery_turn <= job.latest_delivery_turn &&
        job.delivery_timing_rule === SATISFIABLE_DELIVERY_TIMING_RULE,
    ),
    both_arms_share_the_delivery_floor: design.population.worlds.every((world) => {
      const floors = new Set(plan.jobs.filter((job) => job.world === world).map((job) => job.earliest_delivery_turn));
      return floors.size === 1;
    }),
    // 2. The mint is the exhibit mint, and every node is an authored premise.
    minted_nodes_are_exhibits: mints.every((mint) => mint.every_node_is_an_exhibit),
    minted_nodes_resolve_to_authored_premises: mints.every((mint) => mint.every_node_resolves_to_an_authored_premise),
    minted_dags_match_the_plan: mints.every((mint) => mint.sha256_matches_plan),
    demands_re_resolve_to_the_planned_exhibit: mints.every((mint) => mint.demand_matches_plan),
    // 3 and 4. Case-id shape, and no collision with an archived depth run.
    case_ids_underscore_only: plan.jobs.every((job) => /^[a-z0-9_]+$/u.test(job.id)),
    case_ids_use_the_registered_stem: plan.jobs.every((job) =>
      job.id.startsWith(`${design.randomization.caseIdStem}_`),
    ),
    case_ids_clear_of_archived_depth_runs: plan.jobs.every(
      (job) => !ARCHIVED_DEPTH_CASE_ID_STEMS.some((stem) => job.id.startsWith(stem)),
    ),
    // 5 and 6. The two things held byte-identical for comparability with the
    // measured 0.114 base: the ladder, and the reference arm's instruction.
    ladder_is_the_sealed_face_b_ladder: Array.isArray(faceB.measurement?.rungs) && faceB.measurement.rungs.length === 3,
    design_carries_no_ladder_of_its_own: design.measurement.rungs === undefined,
    reference_instruction_resolves_to_the_sealed_text: Boolean(
      String(faceB.tutorDeliveryContract?.actionInstructions?.test_bounded_distinction || '').trim(),
    ),
    // 7. Both sides of these products are independent registered constants:
    // per-dialogue from the parent, calibration totals from this design.
    planned_calls_match_design: plannedCalls === design.attemptCeilings.plannedCallsCalibration,
    reservations_within_ceiling: reservationCeiling <= design.attemptCeilings.calibrationMaximumReservations,
    // Allocation, and the worlds themselves.
    allocation_balanced: DEPTH_ARM_IDS.every((armId) =>
      design.population.worlds.every(
        (world) =>
          plan.jobs.filter((job) => job.arm_id === armId && job.world === world).length ===
          design.calibration.perArm / design.population.worlds.length,
      ),
    ),
    world_registry_passed: worldRegistry.passed,
    grants_no_model_calls: design.callAuthority.grantsModelCalls === false,
  };

  return {
    schema: 'machinespirits.tutor-stub.frame-refuser-satisfiable-plan-preflight.v1',
    status: Object.values(checks).every(Boolean) ? 'passed_zero_call' : 'failed',
    phase: 'plan',
    study_id: design.studyId,
    design: { path: loaded.relativePath ?? null, sha256: loaded.sha256 ?? null },
    plan,
    world_registry: worldRegistry,
    mints,
    planned_calls: plannedCalls,
    registered_planned_calls: design.attemptCeilings.plannedCallsCalibration,
    reservation_ceiling: reservationCeiling,
    registered_reservation_ceiling: design.attemptCeilings.calibrationMaximumReservations,
    checks,
    model_calls_executed: 0,
    production_writes: 0,
  };
}

/**
 * Compile both satisfiable arms through the runtime, zero-call. This is what
 * the depth study's compilation preflight does, and it catches the class of
 * defect a plan check cannot: an arm whose contract does not survive being
 * lowered onto the host, or whose adjudication question does not reach the
 * enforcement seat.
 */
function runTutorStubFrameRefuserSatisfiableCompilationPreflight({ loaded, root }) {
  const design = loaded.design;
  const plan = buildTutorStubResistantLearnerCalibrationPlan(design, { root });
  const armDesigns = Object.fromEntries(
    DEPTH_ARM_IDS.map((armId) => [armId, tutorStubFrameRefuserSatisfiableArmDesign(design, armId, { root })]),
  );
  const parent = sealedParentDesign(design, root);
  const parentRoutes = tutorStubResistantLearnerRuntimeModelRoutes(parent.design);
  const expectedModels = {
    tutor: parentRoutes.tutor,
    analysis: parentRoutes.analysis,
    analysisScope: parentRoutes.analysisScope,
    learner: parentRoutes.learner,
    cliEffort: parentRoutes.cliEffort,
    triggerObservation: parentRoutes.triggerObservationByFace.faceB,
    finalSemanticReaders: parentRoutes.finalSemanticReaders,
  };
  const modelRoute = {
    declared: armDesigns.treatment.models,
    runtime: expectedModels,
    passed: DEPTH_ARM_IDS.every((armId) => exactValues(armDesigns[armId].models, expectedModels)),
  };
  const worldRegistry = auditRuntimeWorldRegistry(design.population.worlds, root);
  const rivalDags = plan.jobs.map((job) => mintTutorStubRivalLearnerDag({ design: armDesigns[job.arm_id], job, root }));

  const rows = [];
  for (const armId of DEPTH_ARM_IDS) {
    const armDesign = armDesigns[armId];
    for (const world of design.population.worlds) {
      const configurationJob = plan.jobs.find((job) => job.arm_id === armId && job.world === world);
      for (const scene of ['bare', 'due_clue']) {
        const state = {
          trace: [],
          turns: [],
          history: [],
          register: { palette: ['warm', 'plain', 'ironic', 'sarcastic'], history: [], policy: 'field' },
          world: {},
        };
        configureR1({
          state,
          root,
          loaded: { ...loaded, design: armDesign },
          job: configurationJob,
          appendTraceEvent() {},
        });
        const compiled = compileTutorStubResistanceActionRegisterStudyAssignment(state.resistanceActionRegisterStudy);
        const progression = compileTutorStubTurnProgressionContract({
          ...preflightScene(scene),
          actionFamily: compiled.host_action_family,
          registeredQuestionRule: null,
        });
        const safety = safetyOverrideProbe(compiled);
        const rivalDag = mintTutorStubRivalLearnerDag({ design: armDesign, job: configurationJob, root });
        const personaPrompt = tutorStubRivalLearnerDagPrompt({ design: armDesign, job: configurationJob, root });
        const enforcementQuestion =
          state.resistanceActionRegisterStudy.design.tutorDeliveryContract.enforcement.check.question;
        const expectedQuestion =
          armId === 'treatment'
            ? design.tutorDeliveryEnforcement.perArmAdjudication.treatmentQuestion
            : design.tutorDeliveryEnforcement.perArmAdjudication.referenceQuestion;

        const issues = [];
        if (compiled.host_action_family !== armDesign.satisfiableExecution.hostActionFamily) {
          issues.push(`compiled host action family ${compiled.host_action_family} is not the registered one`);
        }
        if (enforcementQuestion !== expectedQuestion) {
          issues.push('the registered per-arm adjudication question did not reach the enforcement seat');
        }
        if (!safety.passed) issues.push('safety override probe failed');
        // The demand must be an exhibit at the point the learner speaks it,
        // and the persona prompt is where the learner reads it.
        if (rivalDag.openNodes.some((node) => node.openNodeKind !== 'exhibit')) {
          issues.push('the compiled rival DAG is not exhibit-minted');
        }
        if (!personaPrompt.includes(configurationJob.demanded_exhibit.node_id)) {
          issues.push('the demanded exhibit does not appear in the learner persona prompt');
        }
        rows.push({
          arm_id: armId,
          world,
          action: configurationJob.action,
          scene,
          compiled_move: compiled.pedagogical_move ?? null,
          host_action_family: compiled.host_action_family,
          question_allowed: progression.handoff_contract.question_allowed,
          safety,
          persona_prompt_sha256: sha256(personaPrompt),
          rival_dag_sha256: rivalDag.sha256,
          issues,
          passed: issues.length === 0,
        });
      }
    }
  }

  return {
    schema: 'machinespirits.tutor-stub.frame-refuser-satisfiable-compilation-preflight.v1',
    study: 'satisfiable',
    status:
      worldRegistry.passed &&
      modelRoute.passed &&
      rivalDags.length === design.calibration.dialogues &&
      rows.length === 8 &&
      rows.every((row) => row.passed)
        ? 'passed_zero_call'
        : 'failed',
    expected_rows: 8,
    world_registry: worldRegistry,
    model_route: modelRoute,
    rival_dag_count: rivalDags.length,
    rival_dag_set_sha256: sha256(rivalDags.map((dag) => dag.sha256).join('\n')),
    rows,
    model_calls: 0,
  };
}

function runTutorStubFrameRefuserDepthCompilationPreflight({ loaded, root }) {
  const design = loaded.design;
  const plan = buildTutorStubResistantLearnerCalibrationPlan(design);
  const armDesigns = Object.fromEntries(
    DEPTH_ARM_IDS.map((armId) => [armId, tutorStubFrameRefuserDepthArmDesign(design, armId, { root })]),
  );
  const parent = sealedParentDesign(design, root);
  const parentRoutes = tutorStubResistantLearnerRuntimeModelRoutes(parent.design);
  const expectedModels = {
    tutor: parentRoutes.tutor,
    analysis: parentRoutes.analysis,
    analysisScope: parentRoutes.analysisScope,
    learner: parentRoutes.learner,
    cliEffort: parentRoutes.cliEffort,
    triggerObservation: parentRoutes.triggerObservationByFace.faceB,
    finalSemanticReaders: parentRoutes.finalSemanticReaders,
  };
  const modelRoute = {
    declared: armDesigns.treatment.models,
    runtime: expectedModels,
    passed: DEPTH_ARM_IDS.every((armId) => exactValues(armDesigns[armId].models, expectedModels)),
  };
  const worldRegistry = auditRuntimeWorldRegistry(design.population.worlds, root);
  const rivalDags = plan.jobs.map((job) => mintTutorStubRivalLearnerDag({ design: armDesigns[job.arm_id], job, root }));
  // Both sides of these products are independent registered constants: the
  // per-dialogue ceilings come from the parent design, the calibration totals
  // from the depth file. A drift on either side fails here, before any call.
  const perDialogue = armDesigns.treatment.attemptCeilings;
  const attemptCeilingClosure = {
    planned_calls: plan.jobs.length * perDialogue.plannedCallsPerDialogue,
    registered_planned_calls_calibration: design.attemptCeilings.plannedCallsCalibration,
    planned_reservation_ceiling: plan.jobs.length * perDialogue.maximumReservationsPerDialogue,
    registered_calibration_maximum_reservations: design.attemptCeilings.calibrationMaximumReservations,
    passed:
      plan.jobs.length * perDialogue.plannedCallsPerDialogue === design.attemptCeilings.plannedCallsCalibration &&
      plan.jobs.length * perDialogue.maximumReservationsPerDialogue ===
        design.attemptCeilings.calibrationMaximumReservations,
  };
  const rows = [];
  for (const armId of DEPTH_ARM_IDS) {
    const armDesign = armDesigns[armId];
    for (const world of design.population.worlds) {
      const configurationJob = plan.jobs.find((job) => job.arm_id === armId && job.world === world);
      for (const scene of ['bare', 'due_clue']) {
        const state = {
          trace: [],
          turns: [],
          history: [],
          register: { palette: ['warm', 'plain', 'ironic', 'sarcastic'], history: [], policy: 'field' },
          world: {},
        };
        configureR1({
          state,
          root,
          loaded: { ...loaded, design: armDesign },
          job: configurationJob,
          appendTraceEvent() {},
        });
        const compiled = compileTutorStubResistanceActionRegisterStudyAssignment(state.resistanceActionRegisterStudy);
        const progression = compileTutorStubTurnProgressionContract({
          ...preflightScene(scene),
          actionFamily: compiled.host_action_family,
          registeredQuestionRule: null,
        });
        const safety = safetyOverrideProbe(compiled);
        const rivalDag = mintTutorStubRivalLearnerDag({ design: armDesign, job: configurationJob, root });
        const personaPrompt = tutorStubRivalLearnerDagPrompt({ design: armDesign, job: configurationJob, root });
        const registeredInstruction = armDesign.tutorDeliveryContract.actionInstructions[configurationJob.action];
        const enforcementQuestion =
          state.resistanceActionRegisterStudy.design.tutorDeliveryContract.enforcement.check.question;
        const expectedQuestionText =
          armId === 'treatment'
            ? design.tutorDeliveryEnforcement.perArmAdjudication.treatmentQuestion
            : design.tutorDeliveryEnforcement.perArmAdjudication.referenceQuestion;
        const issues = [];
        if (compiled.pedagogical_move !== configurationJob.action) issues.push('pedagogical_move_drift');
        if (compiled.assigned_realization !== 'plain') issues.push('assigned_realization_drift');
        if (compiled.instruction_source !== 'study_design_override')
          issues.push('depth_delivery_contract_not_compiled');
        if (compiled.action_instruction !== registeredInstruction) issues.push('registered_instruction_byte_drift');
        if (enforcementQuestion !== expectedQuestionText) issues.push('per_arm_adjudication_question_drift');
        if (!/concise neutral/iu.test(compiled.realization_contrast_instruction)) {
          issues.push('plain_register_contract_incomplete');
        }
        if (!safety.passed) issues.push('protected_affect_guard_failed');
        if (!personaPrompt.includes(rivalDag.sha256)) issues.push('rival_dag_prompt_binding_failed');
        if (armId === 'treatment') {
          // The depth registration holds its contrast on exhibit-presentation,
          // adjudicated per arm from tutor text; it registers no typed
          // question rule, and the treatment instruction bans only the
          // standing question. So the family's declarative default governs the
          // bare scene, and a staged due clue lawfully outranks the family
          // (the documented due-source precedence in
          // tutorStubTurnProgressionContract). Pin both outcomes so a change
          // in that precedence order surfaces here before any call.
          const expectedQuestionAllowed = scene === 'due_clue';
          if (progression.handoff_contract.question_allowed !== expectedQuestionAllowed) {
            issues.push('question_permission_drift');
          }
          if (
            !/named condition/iu.test(compiled.action_instruction) ||
            !/already-public/iu.test(compiled.action_instruction) ||
            !/exact same local test/iu.test(compiled.action_instruction) ||
            !/do not ask what would give/iu.test(compiled.action_instruction)
          ) {
            issues.push('condition_discharge_contract_incomplete');
          }
          // The registered treatment instruction is also the host default for
          // condition_discharge; the two copies must stay byte-identical so
          // an override loss can never silently deliver a different move.
          const hostDefault = compileTutorStubResistanceActionRegisterStudyAssignment({
            ...state.resistanceActionRegisterStudy,
            study_assignment_instruction_overrides: null,
          });
          if (hostDefault.action_instruction !== design.arms.treatment.actionInstruction) {
            issues.push('host_default_instruction_drifted_from_registration');
          }
        } else {
          if (progression.handoff_contract.question_allowed !== true) issues.push('question_permission_drift');
          if (
            !/disputed standing/iu.test(compiled.action_instruction) ||
            !/in its own words/iu.test(compiled.action_instruction) ||
            !/under protest/iu.test(compiled.action_instruction) ||
            !/wider frame disputed/iu.test(compiled.action_instruction) ||
            !/do not state the result/iu.test(compiled.action_instruction)
          ) {
            issues.push('standing_conditions_bridge_contract_incomplete');
          }
        }
        rows.push({
          arm_id: armId,
          study: design.studyId,
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
  }
  return {
    schema: `machinespirits.tutor-stub.frame-refuser-depth-compilation-preflight.${depthRevision(design).artifactSchemaVersion}`,
    study: design.studyId,
    status:
      worldRegistry.passed &&
      modelRoute.passed &&
      attemptCeilingClosure.passed &&
      rivalDags.length === depthRevision(design).dialogues &&
      rows.length === 8 &&
      rows.every((row) => row.passed)
        ? 'passed_zero_call'
        : 'failed',
    expected_rows: 8,
    world_registry: worldRegistry,
    model_route: modelRoute,
    attempt_ceiling_closure: attemptCeilingClosure,
    rival_dag_count: rivalDags.length,
    rival_dag_set_sha256: sha256(rivalDags.map((dag) => dag.sha256).join('\n')),
    rows,
    model_calls: 0,
    production_writes: 0,
  };
}

export function runTutorStubResistantLearnerCompilationPreflight({ loaded, root = process.cwd() } = {}) {
  if (isSatisfiableDesign(loaded?.design)) {
    return runTutorStubFrameRefuserSatisfiableCompilationPreflight({ loaded, root });
  }
  if (isDepthDesign(loaded?.design)) {
    return runTutorStubFrameRefuserDepthCompilationPreflight({ loaded, root });
  }
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
    // A technical loss is a unit whose child died without a typed outcome. The
    // sealed dispositions forbid any rerun, so the unit is disclosed here and
    // excluded from every denominator; it is accounted, not evidence.
    const technicalLosses = faceRows.filter((row) => row.status === 'failed');
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
        completed.length + retained.length + technicalLosses.length === dialoguesPerFace && typedFailureAccounting,
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
        technical_loss_rows: technicalLosses.length,
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
      technical_losses: {
        count: technicalLosses.length,
        case_ids: technicalLosses.map((row) => row.job.id),
        excluded_from_denominator: true,
        rerun_prohibited: true,
      },
      prohibited_case_ids: prohibited.map((row) => row.job.id),
      gates,
    };
  });
  const anyIndeterminate = faces.some((face) => face.status === 'measurement_indeterminate');
  const totalTechnicalLosses = faces.reduce((sum, face) => sum + face.technical_losses.count, 0);
  return {
    schema: 'machinespirits.tutor-stub.resistant-learner-merged-powered-report.v1',
    study_id: design.studyId,
    phase: 'powered',
    status: faces.every((face) => face.status === 'passed')
      ? 'passed'
      : anyIndeterminate
        ? 'measurement_indeterminate'
        : 'failed',
    ...(totalTechnicalLosses > 0
      ? { disclosed_amendments: ['technical_loss_units_accounted_never_rerun_excluded_from_denominators'] }
      : {}),
    faces,
    rows,
    calibration_only: false,
    powered_run_authorization: 'typed_operator_approval_attended_tty',
    calibration_rows_included: false,
    cross_face_pooling_allowed: false,
    claim_boundary: design.claimBoundary,
  };
}

function depthDeliverySummary(rows) {
  // A row is "adjudicated" when the delivery gate ran at least once on it; the
  // last enforcement event carries the post-repair verdict for the episode.
  const adjudicated = rows.filter((row) => Array.isArray(row.delivery) && row.delivery.length > 0);
  const delivered = adjudicated.filter((row) => row.delivery[row.delivery.length - 1].delivered === true);
  return {
    adjudicated: adjudicated.length,
    delivered: delivered.length,
    not_delivered: adjudicated.length - delivered.length,
  };
}

export function summarizeTutorStubFrameRefuserDepthCalibration({ rows, design, root = process.cwd() } = {}) {
  const arms = DEPTH_ARM_IDS.map((armId) => {
    const armDesign = tutorStubFrameRefuserDepthArmDesign(design, armId, { root });
    const armRows = rows.filter((row) => row.job.arm_id === armId);
    const completed = armRows.filter((row) => row.status === 'complete');
    const retained = armRows.filter((row) => row.status === 'retained_substantive_failure');
    const rules = armDesign.calibration;
    const endpoint = armDesign.measurement.endpointField;
    const determinate = completed.filter((row) => panelField(row, 'primary', endpoint)?.status === 'determinate');
    const rungCounts = Object.fromEntries(
      ['0', '1', '2'].map((rung) => [
        rung,
        determinate.filter((row) => panelField(row, 'primary', endpoint)?.value === rung).length,
      ]),
    );
    const agreement = mergedAgreementSummary(completed, armDesign);
    // Delivery is read over completed AND retained rows: a typed non-delivery
    // failure is exactly the case the delivered-contrast floors must see.
    const delivery = depthDeliverySummary([...completed, ...retained]);
    const prohibited = completed.filter((row) => panelField(row, 'fidelity', 'prohibited_delivery')?.value === 'yes');
    const jurisdictionRetained = completed.filter(
      (row) => panelField(row, 'primary', 'final_jurisdictional_dispute_retained')?.value === 'yes',
    ).length;
    const bridgeDelivered = completed.filter(
      (row) => panelField(row, 'fidelity', 'delivered_test_bounded_distinction')?.value === 'yes',
    ).length;
    const seatMinimum = rateFloorCount(
      completed.length,
      rules.minimumEligibleVoteRatePerSeatAndInstrument,
      rules.minimumEligibleVotesFloor,
    );
    const endpointPairs = agreement.endpoint_panel.pairwise_exact_agreements;
    const gates = {
      execution_and_typed_failure_accounting:
        completed.length + retained.length === rules.dialogues &&
        retained.every((row) => Boolean(row.registered_failure?.code)),
      determinate_outcome:
        determinate.length >=
        rateFloorCount(completed.length, rules.minimumDeterminateOutcomeRate, rules.minimumDeterminateOutcomeFloor),
      eligible_vote_rate_per_seat_and_instrument: Object.values(agreement.seat_eligibility).every((seat) =>
        Object.values(seat).every((count) => count === null || count >= seatMinimum),
      ),
      pairwise_exact_endpoint_agreement:
        endpointPairs.length === 3 &&
        endpointPairs.every(
          (pair) =>
            Number.isFinite(pair.conditional_exact_agreement) &&
            pair.conditional_exact_agreement >= rules.minimumPairwiseExactEndpointAgreement,
        ),
      ...(armId === 'treatment'
        ? {
            treatment_delivery_rate:
              delivery.adjudicated >= 1 &&
              delivery.delivered >= rateFloorCount(delivery.adjudicated, rules.minimumTreatmentDeliveryRate),
            treatment_any_adjudicated_delivery: delivery.delivered >= 1,
            // Revision 2 arm-separation bound: if the blind three-seat panel
            // reads a committed treatment turn as the sealed bridge move, the
            // arms have converged (the v7 defect class). Completed rows only;
            // the panel never sees the assignment.
            ...(design.revision >= 2
              ? {
                  treatment_bridge_read_bound:
                    completed.length >= 1 && bridgeDelivered <= completed.length * rules.maximumTreatmentBridgeReadRate,
                }
              : {}),
          }
        : // Revision 2 registers no reference-side gate here: the revision-1
          // contamination gate counted typed non-delivery failures (already
          // retained as failures) as contamination, double-charging one event.
          // Reference cleanliness is enforced by the bundled adjudication
          // question — a completed reference row exists only after the delivery
          // seat certified bridge-without-exhibit — and that certificate is
          // reported in the statistics below.
          design.revision >= 2
          ? {}
          : {
              // The reference adjudication question already forbids presenting an
              // exhibit, so every adjudicated non-delivery counts against the
              // contamination bound. That direction is conservative: it can only
              // overstate contamination, never hide it.
              reference_contamination_bound:
                delivery.adjudicated >= 1 &&
                delivery.not_delivered <= delivery.adjudicated * rules.maximumReferenceContaminationRate,
            }),
      no_confirmed_prohibited_delivery: prohibited.length === 0,
      jurisdiction_retained:
        jurisdictionRetained >=
        rateFloorCount(
          completed.length,
          rules.minimumJurisdictionRetainedRateOnCompletedRows,
          rules.minimumJurisdictionRetainedFloor,
        ),
    };
    return {
      arm_id: armId,
      registered_move_id: armDesign.depthExecution.registeredMoveId,
      pedagogical_move: armDesign.depthExecution.move,
      host_action_family: armDesign.depthExecution.hostActionFamily,
      status: Object.values(gates).every(Boolean) ? 'passed' : 'failed',
      gates,
      statistics: {
        completed_rows: completed.length,
        retained_typed_failures: retained.length,
        determinate: determinate.length,
        rung_counts: rungCounts,
        rung_2_rate: determinate.length ? rungCounts['2'] / determinate.length : null,
        delivery,
        confirmed_prohibited_deliveries: prohibited.length,
        jurisdiction_retained: jurisdictionRetained,
        delivered_test_bounded_distinction_report_only: bridgeDelivered,
        // Every completed row must carry a final delivered=true verdict from
        // the per-arm adjudication (the gate throws otherwise); recorded so a
        // reader can verify the reference cleanliness certificate per row.
        ...(design.revision >= 2
          ? {
              completed_delivery_certified: completed.filter(
                (row) =>
                  Array.isArray(row.delivery) &&
                  row.delivery.length > 0 &&
                  row.delivery[row.delivery.length - 1].delivered === true,
              ).length,
            }
          : {}),
      },
      agreement,
    };
  });
  const referenceArm = arms.find((arm) => arm.arm_id === 'reference');
  return {
    schema: `machinespirits.tutor-stub.frame-refuser-depth-calibration-report.${depthRevision(design).artifactSchemaVersion}`,
    study_id: design.studyId,
    status:
      arms.every((arm) => arm.status === 'passed') &&
      arms.reduce((sum, arm) => sum + arm.statistics.confirmed_prohibited_deliveries, 0) === 0
        ? 'passed'
        : 'failed',
    arms,
    rows,
    pooled_confirmed_prohibited_deliveries: arms.reduce(
      (sum, arm) => sum + arm.statistics.confirmed_prohibited_deliveries,
      0,
    ),
    sizing_update: {
      purpose: 'update the power table reference rung-2 rate for powered-run sizing; not an interim outcome analysis',
      reference_rung_2: referenceArm.statistics.rung_counts['2'],
      reference_determinate: referenceArm.statistics.determinate,
      reference_rung_2_rate: referenceArm.statistics.rung_2_rate,
    },
    calibration_only: true,
    powered_run_authorized: false,
    calibration_rows_poolable_into_powered_run: false,
    claim_boundary: design.claimBoundary,
  };
}

function satisfiableDischargeOpportunity(row) {
  const premiseId = row.job?.demanded_exhibit?.premise_id;
  const latestTurn = Number(row.job?.latest_delivery_turn);
  if (!premiseId || !Number.isFinite(latestTurn)) return false;
  return (row.release_pacing || []).some(
    (event) => Number(event.turn) <= latestTurn && (event.released_now || []).includes(premiseId),
  );
}

export function summarizeTutorStubFrameRefuserSatisfiableCalibration({ rows, design, root = process.cwd() } = {}) {
  const arms = DEPTH_ARM_IDS.map((armId) => {
    const armDesign = tutorStubFrameRefuserSatisfiableArmDesign(design, armId, { root });
    const armRows = rows.filter((row) => row.job.arm_id === armId);
    const completed = armRows.filter((row) => row.status === 'complete');
    const retained = armRows.filter((row) => row.status === 'retained_substantive_failure');
    const rules = armDesign.calibration;
    const endpoint = armDesign.measurement.endpointField;
    const determinate = completed.filter((row) => panelField(row, 'primary', endpoint)?.status === 'determinate');
    const rungCounts = Object.fromEntries(
      ['0', '1', '2'].map((rung) => [
        rung,
        determinate.filter((row) => panelField(row, 'primary', endpoint)?.value === rung).length,
      ]),
    );
    const agreement = mergedAgreementSummary(completed, armDesign);
    const delivery = depthDeliverySummary([...completed, ...retained]);
    const prohibited = completed.filter((row) => panelField(row, 'fidelity', 'prohibited_delivery')?.value === 'yes');
    const jurisdictionRetained = completed.filter(
      (row) => panelField(row, 'primary', 'final_jurisdictional_dispute_retained')?.value === 'yes',
    ).length;
    const bridgeDelivered = completed.filter(
      (row) => panelField(row, 'fidelity', 'delivered_test_bounded_distinction')?.value === 'yes',
    ).length;
    const dischargeOpportunity = completed.filter(satisfiableDischargeOpportunity).length;
    const seatMinimum = rateFloorCount(
      completed.length,
      rules.minimumEligibleVoteRatePerSeatAndInstrument,
      rules.minimumEligibleVotesFloor,
    );
    const endpointPairs = agreement.endpoint_panel.pairwise_exact_agreements;
    const gates = {
      execution_and_typed_failure_accounting:
        completed.length + retained.length === rules.dialogues &&
        retained.every((row) => Boolean(row.registered_failure?.code)),
      determinate_outcome:
        determinate.length >=
        rateFloorCount(completed.length, rules.minimumDeterminateOutcomeRate, rules.minimumDeterminateOutcomeFloor),
      eligible_vote_rate_per_seat_and_instrument: Object.values(agreement.seat_eligibility).every((seat) =>
        Object.values(seat).every((count) => count === null || count >= seatMinimum),
      ),
      pairwise_exact_endpoint_agreement:
        endpointPairs.length === 3 &&
        endpointPairs.every(
          (pair) =>
            Number.isFinite(pair.conditional_exact_agreement) &&
            pair.conditional_exact_agreement >= rules.minimumPairwiseExactEndpointAgreement,
        ),
      ...(armId === 'treatment'
        ? {
            treatment_delivery_rate:
              delivery.adjudicated >= 1 &&
              delivery.delivered >= rateFloorCount(delivery.adjudicated, rules.minimumTreatmentDeliveryRate),
            treatment_any_adjudicated_delivery: delivery.delivered >= 1,
            treatment_bridge_read_bound:
              completed.length >= 1 && bridgeDelivered <= completed.length * rules.maximumTreatmentBridgeReadRate,
            discharge_opportunity:
              completed.length >= 1 &&
              dischargeOpportunity >=
                rateFloorCount(completed.length, rules.minimumDischargeOpportunityRateOnCompletedTreatmentRows),
          }
        : {}),
      no_confirmed_prohibited_delivery: prohibited.length === 0,
      jurisdiction_retained:
        jurisdictionRetained >=
        rateFloorCount(
          completed.length,
          rules.minimumJurisdictionRetainedRateOnCompletedRows,
          rules.minimumJurisdictionRetainedFloor,
        ),
    };
    return {
      arm_id: armId,
      registered_move_id: armDesign.satisfiableExecution.registeredMoveId,
      pedagogical_move: armDesign.satisfiableExecution.move,
      host_action_family: armDesign.satisfiableExecution.hostActionFamily,
      status: Object.values(gates).every(Boolean) ? 'passed' : 'failed',
      gates,
      statistics: {
        completed_rows: completed.length,
        retained_typed_failures: retained.length,
        determinate: determinate.length,
        rung_counts: rungCounts,
        rung_2_rate: determinate.length ? rungCounts['2'] / determinate.length : null,
        delivery,
        confirmed_prohibited_deliveries: prohibited.length,
        jurisdiction_retained: jurisdictionRetained,
        delivered_test_bounded_distinction: bridgeDelivered,
        completed_delivery_certified: completed.filter(
          (row) =>
            Array.isArray(row.delivery) &&
            row.delivery.length > 0 &&
            row.delivery[row.delivery.length - 1].delivered === true,
        ).length,
        ...(armId === 'treatment'
          ? {
              demanded_exhibit_available_within_horizon: dischargeOpportunity,
              demanded_exhibit_unavailable_within_horizon: completed.length - dischargeOpportunity,
            }
          : {}),
      },
      agreement,
    };
  });
  const referenceArm = arms.find((arm) => arm.arm_id === 'reference');
  return {
    schema: 'machinespirits.tutor-stub.frame-refuser-satisfiable-calibration-report.v1',
    study_id: design.studyId,
    status:
      arms.every((arm) => arm.status === 'passed') &&
      arms.reduce((sum, arm) => sum + arm.statistics.confirmed_prohibited_deliveries, 0) === 0
        ? 'passed'
        : 'failed',
    arms,
    rows,
    pooled_confirmed_prohibited_deliveries: arms.reduce(
      (sum, arm) => sum + arm.statistics.confirmed_prohibited_deliveries,
      0,
    ),
    sizing_update: {
      purpose: 'update the power table reference rung-2 rate for powered-run sizing; not an interim outcome analysis',
      reference_rung_2: referenceArm.statistics.rung_counts['2'],
      reference_determinate: referenceArm.statistics.determinate,
      reference_rung_2_rate: referenceArm.statistics.rung_2_rate,
    },
    calibration_only: true,
    powered_run_authorized: false,
    calibration_rows_poolable_into_powered_run: false,
    claim_boundary: design.claimBoundary,
  };
}

export function summarizeTutorStubResistantLearnerCalibration({ rows, design, root = process.cwd() }) {
  if (isDepthDesign(design)) {
    return summarizeTutorStubFrameRefuserDepthCalibration({ rows, design, root });
  }
  if (isSatisfiableDesign(design)) {
    return summarizeTutorStubFrameRefuserSatisfiableCalibration({ rows, design, root });
  }
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
  summarizeTutorStubFrameRefuserDepthCalibration,
  summarizeTutorStubFrameRefuserSatisfiableCalibration,
  tutorStubFrameRefuserSatisfiableArmDesign,
  tutorStubFrameRefuserDepthArmDesign,
  buildTutorStubResistantLearnerPoweredPlan,
  configureTutorStubResistantLearnerCalibrationFromCli,
  loadTutorStubResistantLearnerDesign,
  runTutorStubFrameRefuserSatisfiablePlanPreflight,
  runTutorStubResistantLearnerCompilationPreflight,
  summarizeTutorStubResistantLearnerCalibration,
  summarizeTutorStubResistantLearnerMergedPoweredRun,
  tutorStubFrameRefuserR1Prompt,
  validateTutorStubResistantLearnerDesign,
};
