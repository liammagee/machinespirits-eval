import { buildTutorStubProfileDiscriminationReport } from '../scripts/analyze-tutor-stub-profile-discrimination.js';
import { runPaidStudyEndpointPreflight } from './paidStudyEndpointPreflight.js';
import { resistantLearnerObservationMarkers } from './resistantLearnerObservation.js';

const PROFILES = ['diligent', 'low_agency', 'bored', 'skeptical', 'low_trust_skeptic', 'frame_defiant'];
const MODEL = 'codex.gpt-5.6-luna';

const PROFILE_TEXT = {
  diligent: 'The mark links the public evidence to the stated rule.',
  low_agency: 'Is it okay if I say the mark is the same?',
  bored: 'Sure. Whatever.',
  skeptical: 'Why does that conclusion follow from the public mark?',
  low_trust_skeptic: 'I do not trust that conclusion; show how the public evidence supports it.',
  frame_defiant: 'I reject the premise of this exercise. You do not get to set the question that way.',
};

const PROFILE_FRAMES = {
  diligent: {
    requestType: 'conceptual_clarity_request',
    discourseMove: 'inference',
    evidenceUse: 'links_evidence_to_rule',
    epistemicStance: 'grounded',
    agency: 'self_correcting',
    affectClass: 'regulated',
    conceptualScore: 5,
    epistemicReadinessScore: 5,
    fieldScore: 0.9,
    bottleneck: 'grounded_asserted_secret',
    coverage: 1,
    missingPremises: 0,
  },
  low_agency: {
    requestType: 'resistance_or_low_agency',
    discourseMove: 'question',
    evidenceUse: 'none',
    epistemicStance: 'receptive',
    agency: 'passive',
    affectClass: 'uncertain',
    conceptualScore: 2,
    epistemicReadinessScore: 2,
    fieldScore: 0.2,
    bottleneck: 'release_or_pacing_gap',
    coverage: 0.1,
    missingPremises: 6,
  },
  bored: {
    requestType: 'off_task_or_mixed',
    discourseMove: 'off_task',
    evidenceUse: 'none',
    epistemicStance: 'resistant',
    agency: 'complying',
    affectClass: 'other',
    conceptualScore: 2,
    epistemicReadinessScore: 2,
    fieldScore: 0.2,
    bottleneck: 'release_or_pacing_gap',
    coverage: 0.1,
    missingPremises: 6,
  },
  skeptical: {
    requestType: 'conceptual_clarity_request',
    discourseMove: 'question',
    evidenceUse: 'cites_public_evidence',
    epistemicStance: 'exploratory',
    agency: 'steering',
    affectClass: 'regulated',
    conceptualScore: 4,
    epistemicReadinessScore: 4,
    fieldScore: 0.6,
    bottleneck: 'warrant_gap',
    coverage: 0.5,
    missingPremises: 3,
  },
  low_trust_skeptic: {
    requestType: 'resistance_or_low_agency',
    discourseMove: 'challenge',
    evidenceUse: 'cites_public_evidence',
    epistemicStance: 'resistant',
    agency: 'steering',
    affectClass: 'resistant',
    conceptualScore: 3,
    epistemicReadinessScore: 3,
    fieldScore: 0.4,
    bottleneck: 'trust_or_warrant_gap',
    coverage: 0.35,
    missingPremises: 4,
  },
  frame_defiant: {
    requestType: 'authority_refusal_or_status_challenge',
    discourseMove: 'challenge',
    evidenceUse: 'none',
    epistemicStance: 'resistant',
    agency: 'steering',
    affectClass: 'resistant',
    conceptualScore: 3,
    epistemicReadinessScore: 3,
    fieldScore: 0.4,
    bottleneck: 'warrant_gap',
    coverage: 0.4,
    missingPremises: 4,
  },
};

function syntheticTurn(profile, turn) {
  const frame = PROFILE_FRAMES[profile];
  const markers = resistantLearnerObservationMarkers({
    learnerText: PROFILE_TEXT[profile],
    classification: {
      request_type: frame.requestType,
      discourse_move: frame.discourseMove,
      evidence_use: frame.evidenceUse,
      epistemic_stance: frame.epistemicStance,
      agency: frame.agency,
    },
  });
  return {
    turn,
    classifier: {
      requestType: frame.requestType,
      discourseMove: frame.discourseMove,
      evidenceUse: frame.evidenceUse,
      epistemicStance: frame.epistemicStance,
      agency: frame.agency,
      affectClass: frame.affectClass,
      conceptualScore: frame.conceptualScore,
      epistemicReadinessScore: frame.epistemicReadinessScore,
    },
    field: { score: frame.fieldScore },
    dag: {
      bottleneck: frame.bottleneck,
      bestPathCoverage: frame.coverage,
      missingPremiseCount: frame.missingPremises,
    },
    register: { policy: 'field', selected: 'warm', distribution: [] },
    markers,
  };
}

export function buildTutorStubResistantProfileDiscriminationSyntheticCorpus() {
  return PROFILES.flatMap((profile) =>
    Array.from({ length: 3 }, (_, index) => {
      const repeat = index + 1;
      const frame = PROFILE_FRAMES[profile];
      return {
        case_id: `${profile}:field:${repeat}`,
        arm: profile,
        schema: 'machinespirits.tutor-stub.compacted-trace.v2',
        sourceTrace: `synthetic-zero-call/${profile}/field-r${repeat}.jsonl`,
        run: {
          profile,
          policy: 'field',
          runKey: `${profile}-field-r${repeat}`,
          turnCount: 8,
          world: 'world_005_marrick',
          modelRef: MODEL,
          model: 'gpt-5.6-luna',
          provider: 'codex',
          analysisModelRef: MODEL,
          analysisModel: MODEL,
          learnerModelRef: MODEL,
          learnerModel: MODEL,
        },
        final: {
          bestPathCoverage: frame.coverage,
          missingPremiseCount: frame.missingPremises,
          bottleneck: frame.bottleneck,
          groundedClosure: profile === 'diligent',
        },
        turns: Array.from({ length: 8 }, (_, turnIndex) => syntheticTurn(profile, turnIndex + 1)),
      };
    }),
  );
}

export function buildTutorStubResistantProfileDiscriminationPreflightPackets(cases) {
  return PROFILES.map((profile) => {
    const rows = cases.filter((row) => row.arm === profile);
    return {
      schema: 'machinespirits.tutor-stub.resistant-profile-discrimination-preflight-packet.v1',
      packet_id: profile,
      case_ids: rows.map((row) => row.case_id),
      cases: rows,
    };
  });
}

function analyzerArgs(contract) {
  const registration = contract.registration;
  return {
    traceRoot: '',
    compactedRoot: '',
    targetAverageCosine: registration.target_average_pairwise_cosine,
    targetMaxToControl: registration.target_max_similarity_to_control,
    controlProfile: registration.control_profile,
    gateProfiles: registration.gate_profiles,
    requirePooled: true,
    requiredTraces: contract.registered_scale.cases,
    requiredProfiles: registration.required_profiles,
    requiredRunsPerProfile: registration.required_runs_per_profile,
    requiredTurns: registration.required_turns,
    requiredPolicies: registration.required_policies,
    requiredModels: registration.required_models,
  };
}

export function assembleTutorStubResistantProfileDiscriminationPreflight({ packets, contract }) {
  const cases = packets.flatMap((packet) => packet.cases);
  const report = buildTutorStubProfileDiscriminationReport(cases, analyzerArgs(contract));
  const conditioned = new Map(report.gate.conditioned.profiles.map((row) => [row.profile, row]));
  const profileSummaries = new Map(report.profiles.map((row) => [row.profile, row]));
  const profileEndpointComplete = (profile) => {
    const gate = conditioned.get(profile);
    const summary = profileSummaries.get(profile);
    return Boolean(
      gate &&
      summary?.observability &&
      Number.isFinite(gate.maxProbeSimilarity) &&
      Number.isFinite(gate.signatureTargetPassRate) &&
      typeof gate.nearestNeighborEvaluable === 'boolean',
    );
  };
  const endpointStatus = {
    pooled_profile_discrimination:
      Number.isFinite(report.summary.averagePairwiseCosine) &&
      Number.isFinite(report.summary.maxSimilarityToControl) &&
      typeof report.gate.pooled.pass === 'boolean'
        ? 'complete'
        : 'incomplete',
    bored_contract_gate: profileEndpointComplete('bored') ? 'complete' : 'incomplete',
    frame_defiant_contract_gate: profileEndpointComplete('frame_defiant') ? 'complete' : 'incomplete',
  };
  return {
    case_ids: cases.map((row) => row.case_id),
    endpoint_status: Object.fromEntries(
      contract.endpoints.map((endpoint) => [endpoint.id, endpointStatus[endpoint.id]]),
    ),
    report,
  };
}

export function runTutorStubResistantProfileDiscriminationEndpointPreflight(contract) {
  return runPaidStudyEndpointPreflight({
    contract,
    cases: buildTutorStubResistantProfileDiscriminationSyntheticCorpus(),
    buildPackets: buildTutorStubResistantProfileDiscriminationPreflightPackets,
    assemble: assembleTutorStubResistantProfileDiscriminationPreflight,
  });
}

export default {
  assembleTutorStubResistantProfileDiscriminationPreflight,
  buildTutorStubResistantProfileDiscriminationPreflightPackets,
  buildTutorStubResistantProfileDiscriminationSyntheticCorpus,
  runTutorStubResistantProfileDiscriminationEndpointPreflight,
};
