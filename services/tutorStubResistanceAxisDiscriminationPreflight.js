import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildFrameRefuserOpportunityReport,
  buildResistanceAxisDiscriminationReport,
  frameRefuserOpportunityObservationSemantics,
  readTutorStubResistanceAxisTrace,
} from '../scripts/analyze-tutor-stub-resistance-axis-calibration.js';
import { runPaidStudyEndpointPreflight } from './paidStudyEndpointPreflight.js';
import {
  FRAME_DEFIANT_ADHERENCE_EXHAUSTED_CODE,
  classifyFrameDefiantAdherenceExhaustion,
} from './resistantLearnerObservation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROFILES = ['diligent', 'low_agency', 'bored', 'skeptical', 'low_trust_skeptic', 'frame_defiant'];
const MODEL = 'codex.gpt-5.6-luna';
const FRAME_OPPORTUNITY_PROFILES = ['frame_refuser', 'frame_defiant'];

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function markers(profile, turn) {
  return {
    effortWithholding: profile === 'bored',
    tutorChoiceDeference: profile === 'low_agency',
    evidentialWarrantChallenge: profile === 'skeptical' || profile === 'low_trust_skeptic',
    authorityEpistemicDistrust: profile === 'low_trust_skeptic' && turn <= 2,
    frameJurisdictionDispute: profile === 'frame_defiant',
  };
}

export function buildTutorStubResistanceAxisSyntheticCorpus() {
  return PROFILES.flatMap((profile) =>
    Array.from({ length: 3 }, (_, index) => {
      const run = index + 1;
      return {
        case_id: `${profile}:field:${run}`,
        arm: profile,
        file: path.join('synthetic-zero-call', profile, 'traces', `field-r${run}`, 'trace.jsonl'),
        profile,
        policy: 'field',
        models: { tutor: MODEL, analysis: MODEL, learner: MODEL },
        turns: Array.from({ length: 8 }, (_, turnIndex) => ({
          turn: turnIndex + 1,
          markers: markers(profile, turnIndex + 1),
        })),
      };
    }),
  );
}

export function buildTutorStubResistanceAxisPreflightPackets(cases) {
  return PROFILES.map((profile) => {
    const rows = cases.filter((row) => row.profile === profile);
    return {
      schema: 'machinespirits.tutor-stub.resistance-axis-preflight-packet.v1',
      packet_id: profile,
      case_ids: rows.map((row) => row.case_id),
      cases: rows,
    };
  });
}

function registrationBinding(contract) {
  const relativePath = contract.registration.registration_path;
  const filePath = path.join(ROOT, relativePath);
  const bytes = fs.readFileSync(filePath);
  const observed = sha256(bytes);
  if (observed !== contract.registration.registration_sha256) {
    throw new Error(`axis registration digest mismatch: expected ${contract.registration.registration_sha256}`);
  }
  return {
    path: relativePath,
    sha256: observed,
    registration: JSON.parse(bytes.toString('utf8')),
  };
}

function analyzerArgs(contract) {
  return {
    traces: [],
    out: '',
    registration: contract.registration.registration_path,
    registeredReport: '',
    requiredRegisteredReportSha256: '',
    requiredTraces: contract.registered_scale.cases,
    requiredProfiles: contract.registration.required_profiles,
    requiredRunsPerProfile: contract.registration.required_runs_per_profile,
    requiredTurns: contract.registration.required_turns,
    requiredPolicies: contract.registration.required_policies,
    requiredModels: contract.registration.required_models,
  };
}

export function assembleTutorStubResistanceAxisPreflight({ packets, contract }) {
  const cases = packets.flatMap((packet) => packet.cases);
  const report = buildResistanceAxisDiscriminationReport(cases, analyzerArgs(contract), registrationBinding(contract));
  const primary = new Map(report.gate.coPrimary.map((row) => [row.profile, row]));
  const lowTrust = report.gate.diagnostics.find((row) => row.profile === 'low_trust_skeptic');
  return {
    case_ids: cases.map((row) => row.case_id),
    endpoint_status: {
      bored_effort_investment_gate: typeof primary.get('bored')?.pass === 'boolean' ? 'complete' : 'incomplete',
      frame_legitimacy_gate: typeof primary.get('frame_defiant')?.pass === 'boolean' ? 'complete' : 'incomplete',
      low_trust_epistemic_trust_diagnostic:
        Number.isFinite(lowTrust?.axes?.epistemic_trust) && lowTrust?.contributesToPass === false
          ? 'complete'
          : 'incomplete',
    },
    report,
  };
}

export function runTutorStubResistanceAxisEndpointPreflight(contract) {
  return runPaidStudyEndpointPreflight({
    contract,
    cases: buildTutorStubResistanceAxisSyntheticCorpus(),
    buildPackets: buildTutorStubResistanceAxisPreflightPackets,
    assemble: assembleTutorStubResistanceAxisPreflight,
  });
}

const FRAME_REFUSALS = Object.freeze([
  'I reject this test, and I will not answer inside it.',
  'I do not accept your authority to set this question, so I will not take the proposed step.',
  'You do not get to define the governing frame, and I will not proceed under it.',
]);

const PRODUCTIVE_FRAME_DISPUTES = Object.freeze([
  'I reject the frame, but the public assay supports testing whether this mark came from the same die.',
  'I do not accept your setting this question, but the clipped edge still warrants comparing the two blanks.',
  'You do not get to define the governing test, but the public flaw supports checking the graver match.',
]);

const PROSPECTIVE_FRAME_OPPORTUNITY_ROWS = Object.freeze({
  frame_refuser: Object.freeze([
    Object.freeze({
      triggerTurn: 2,
      learner:
        'I reject your demand that we choose a matter or term on your framing, and I will not supply evidence or an answer under it.',
    }),
    Object.freeze({
      triggerTurn: 1,
      learner: 'I reject your question as the governing test, and I will not name a hand or supply evidence under it.',
    }),
    Object.freeze({
      triggerTurn: 1,
      learner:
        'I reject the coin-first test as your governing frame, and I will not examine it or offer evidence under it.',
    }),
  ]),
  frame_defiant: Object.freeze([
    Object.freeze({
      triggerTurn: 1,
      learner:
        'I do not accept your right to fix the question as “whose hand” before we have examined any public evidence; let us first agree which trial-book matter may properly be tested.',
    }),
    Object.freeze({
      triggerTurn: 2,
      learner:
        'I do not accept that you get to set the coin as the compulsory test; if you propose one bounded feature to examine, name it, and I will consider whether that test is properly framed.',
    }),
    Object.freeze({
      triggerTurn: 1,
      learner:
        'I do not accept that the town’s verdict fixes the question or puts Verrell’s hand before the assay; let us first examine a public record that could bear on who struck the coin.',
    }),
  ]),
});

function frameOpportunityClassification(contentBearing) {
  return {
    request_type: 'authority_refusal_or_status_challenge',
    discourse_move: contentBearing ? 'hypothesis' : 'challenge',
    evidence_use: contentBearing ? 'links_evidence_to_rule' : 'none',
    epistemic_stance: 'resistant',
    agency: 'steering',
  };
}

function frameOpportunityEvents(profile, run) {
  const learner = profile === 'frame_refuser' ? FRAME_REFUSALS[run - 1] : PRODUCTIVE_FRAME_DISPUTES[run - 1];
  const firstClassification = frameOpportunityClassification(profile === 'frame_defiant');
  const events = [
    {
      type: 'run_start',
      runId: `${profile}:field:${run}`,
      metadata: {
        world: { id: 'world_005_marrick' },
        autoLearner: { profileId: profile, modelRef: MODEL },
        modelRef: MODEL,
        classifier: { modelRef: MODEL },
      },
    },
  ];
  for (let turn = 1; turn <= 8; turn += 1) {
    const turnLearner = turn === 1 ? learner : `The public comparison remains available at step ${turn}.`;
    const classification =
      turn === 1
        ? firstClassification
        : {
            request_type: 'synthetic',
            discourse_move: 'inference',
            evidence_use: 'links_evidence_to_rule',
            epistemic_stance: 'engaged',
            agency: 'steering',
          };
    events.push({
      type: 'turn_complete',
      turn,
      turnId: `${profile}:field:${run}:t${turn}`,
      turnRecord: {
        turn,
        turnId: `${profile}:field:${run}:t${turn}`,
        learner: turnLearner,
        tutor: 'Continue with the nearest public comparison.',
        classification: { turn: classification },
        registerSelection: { policy: 'field' },
      },
    });
  }
  events.push({ type: 'run_end', reason: 'synthetic_zero_call_preflight' });
  return events;
}

function prospectiveFrameOpportunityEvents(profile, run) {
  const row = PROSPECTIVE_FRAME_OPPORTUNITY_ROWS[profile][run - 1];
  const events = [
    {
      type: 'run_start',
      runId: `${profile}:field:${run}`,
      metadata: {
        world: { id: 'world_005_marrick' },
        autoLearner: { profileId: profile, modelRef: MODEL },
        modelRef: MODEL,
        classifier: { modelRef: MODEL },
      },
    },
    {
      type: 'tutor_opening',
      text: 'The assayer sets the clipped shilling beside the trial book. Which public mark should govern the next comparison?',
    },
  ];
  for (let turn = 1; turn <= 8; turn += 1) {
    const atTrigger = turn === row.triggerTurn;
    const learner = atTrigger
      ? row.learner
      : turn < row.triggerTurn
        ? 'Before deciding, I want to know which public comparison is actually available.'
        : `The public comparison remains available at step ${run}.${turn}.`;
    const classification = atTrigger
      ? frameOpportunityClassification(false)
      : turn < row.triggerTurn
        ? {
            request_type: 'stepwise_support_request',
            discourse_move: 'question',
            evidence_use: 'none',
            epistemic_stance: 'exploratory',
            agency: 'steering',
          }
        : {
            request_type: 'synthetic',
            discourse_move: 'inference',
            evidence_use: 'links_evidence_to_rule',
            epistemic_stance: 'engaged',
            agency: 'steering',
          };
    events.push({
      type: 'turn_complete',
      turn,
      turnId: `${profile}:field:${run}:t${turn}`,
      turnRecord: {
        turn,
        turnId: `${profile}:field:${run}:t${turn}`,
        learner,
        tutor: 'Keep the wider frame open and test only the nearest public comparison.',
        classification: { turn: classification },
        registerSelection: { policy: 'field' },
      },
    });
  }
  events.push({ type: 'run_end', reason: 'prospective_zero_call_preflight' });
  return events;
}

function frameDefiantAdherenceExhaustionAudit(profile) {
  if (profile !== 'frame_defiant') return { applicable: false, classification: null };
  return {
    applicable: true,
    classification: classifyFrameDefiantAdherenceExhaustion({ profile, repairAttempts: 2 }),
  };
}

export function buildTutorStubFrameRefuserOpportunitySyntheticCorpus() {
  return FRAME_OPPORTUNITY_PROFILES.flatMap((profile) =>
    Array.from({ length: 3 }, (_, index) => {
      const run = index + 1;
      return {
        case_id: `${profile}:field:${run}`,
        arm: profile,
        profile,
        policy: 'field',
        models: { tutor: MODEL, analysis: MODEL, learner: MODEL },
        turns: 8,
        traceEvents: frameOpportunityEvents(profile, run),
      };
    }),
  );
}

export function buildTutorStubFrameRefuserOpportunityV2SyntheticCorpus() {
  return FRAME_OPPORTUNITY_PROFILES.flatMap((profile) =>
    Array.from({ length: 3 }, (_, index) => {
      const run = index + 1;
      return {
        case_id: `${profile}:field:${run}`,
        arm: profile,
        profile,
        policy: 'field',
        models: { tutor: MODEL, analysis: MODEL, learner: MODEL },
        turns: 8,
        traceEvents: prospectiveFrameOpportunityEvents(profile, run),
        adherenceExhaustionAudit: frameDefiantAdherenceExhaustionAudit(profile),
      };
    }),
  );
}

export function buildTutorStubFrameRefuserOpportunityPreflightPackets(cases) {
  return FRAME_OPPORTUNITY_PROFILES.map((profile) => {
    const rows = cases.filter((row) => row.profile === profile);
    return {
      schema: 'machinespirits.tutor-stub.frame-refuser-opportunity-preflight-packet.v1',
      packet_id: profile,
      case_ids: rows.map((row) => row.case_id),
      cases: rows,
    };
  });
}

export function buildTutorStubFrameRefuserOpportunityV2PreflightPackets(cases) {
  return FRAME_OPPORTUNITY_PROFILES.map((profile) => {
    const rows = cases.filter((row) => row.profile === profile);
    return {
      schema: 'machinespirits.tutor-stub.frame-refuser-opportunity-preflight-packet.v2',
      packet_id: profile,
      case_ids: rows.map((row) => row.case_id),
      cases: rows,
    };
  });
}

export function assembleTutorStubFrameRefuserOpportunityPreflight({ packets, contract }) {
  const cases = packets.flatMap((packet) => packet.cases);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'frame-refuser-opportunity-preflight-'));
  try {
    const binding = registrationBinding(contract);
    const observationSemantics = frameRefuserOpportunityObservationSemantics(binding.registration);
    const traces = cases.map((row, index) => {
      const run = (index % 3) + 1;
      const directory = path.join(temporary, row.profile, 'traces', `field-r${run}`);
      fs.mkdirSync(directory, { recursive: true });
      const tracePath = path.join(directory, 'trace.jsonl');
      fs.writeFileSync(tracePath, `${row.traceEvents.map((event) => JSON.stringify(event)).join('\n')}\n`);
      return readTutorStubResistanceAxisTrace(tracePath, { observationSemantics });
    });
    const report = buildFrameRefuserOpportunityReport(traces, analyzerArgs(contract), binding);
    const endpointStatus = {
      frame_refuser_treatment_opportunity: report.gate.target.every((row) => typeof row.pass === 'boolean')
        ? 'complete'
        : 'incomplete',
      frame_defiant_productive_control: report.gate.control.every((row) => typeof row.pass === 'boolean')
        ? 'complete'
        : 'incomplete',
      distinct_public_prefix_assembly:
        typeof report.gate.distinctPrefixes.pass === 'boolean' ? 'complete' : 'incomplete',
    };
    const adherenceEndpoint = contract.endpoints.find(
      (endpoint) => endpoint.id === 'frame_defiant_adherence_exhaustion_typed_failure',
    );
    const adherenceAudits = cases
      .filter((row) => row.profile === 'frame_defiant')
      .map((row) => ({ caseId: row.case_id, ...row.adherenceExhaustionAudit }));
    if (adherenceEndpoint) {
      endpointStatus[adherenceEndpoint.id] = adherenceAudits.every(
        (row) =>
          row.applicable === true &&
          row.classification?.code === FRAME_DEFIANT_ADHERENCE_EXHAUSTED_CODE &&
          row.classification?.profile === 'frame_defiant' &&
          row.classification?.repairAttempts === 2 &&
          row.classification?.disposition === 'technical_failure_no_public_candidate' &&
          row.classification?.publishPublicCandidate === false,
      )
        ? 'complete'
        : 'incomplete';
    }
    return {
      case_ids: cases.map((row) => row.case_id),
      endpoint_status: endpointStatus,
      adherence_exhaustion_audit: adherenceAudits,
      report,
    };
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

export function runTutorStubFrameRefuserOpportunityEndpointPreflight(contract) {
  const prospectiveV2 = contract.registration?.registration_path?.endsWith('.v2.json');
  return runPaidStudyEndpointPreflight({
    contract,
    cases: prospectiveV2
      ? buildTutorStubFrameRefuserOpportunityV2SyntheticCorpus()
      : buildTutorStubFrameRefuserOpportunitySyntheticCorpus(),
    buildPackets: prospectiveV2
      ? buildTutorStubFrameRefuserOpportunityV2PreflightPackets
      : buildTutorStubFrameRefuserOpportunityPreflightPackets,
    assemble: assembleTutorStubFrameRefuserOpportunityPreflight,
  });
}

export default {
  assembleTutorStubFrameRefuserOpportunityPreflight,
  assembleTutorStubResistanceAxisPreflight,
  buildTutorStubFrameRefuserOpportunityPreflightPackets,
  buildTutorStubFrameRefuserOpportunitySyntheticCorpus,
  buildTutorStubFrameRefuserOpportunityV2PreflightPackets,
  buildTutorStubFrameRefuserOpportunityV2SyntheticCorpus,
  buildTutorStubResistanceAxisPreflightPackets,
  buildTutorStubResistanceAxisSyntheticCorpus,
  runTutorStubFrameRefuserOpportunityEndpointPreflight,
  runTutorStubResistanceAxisEndpointPreflight,
};
