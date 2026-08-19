import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildFrameRefuserOpportunityReport,
  buildResistanceAxisDiscriminationReport,
  readTutorStubResistanceAxisTrace,
} from '../scripts/analyze-tutor-stub-resistance-axis-calibration.js';
import { runPaidStudyEndpointPreflight } from './paidStudyEndpointPreflight.js';

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
  const learner =
    profile === 'frame_refuser' ? FRAME_REFUSALS[run - 1] : PRODUCTIVE_FRAME_DISPUTES[run - 1];
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

export function assembleTutorStubFrameRefuserOpportunityPreflight({ packets, contract }) {
  const cases = packets.flatMap((packet) => packet.cases);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'frame-refuser-opportunity-preflight-'));
  try {
    const traces = cases.map((row, index) => {
      const run = (index % 3) + 1;
      const directory = path.join(temporary, row.profile, 'traces', `field-r${run}`);
      fs.mkdirSync(directory, { recursive: true });
      const tracePath = path.join(directory, 'trace.jsonl');
      fs.writeFileSync(tracePath, `${row.traceEvents.map((event) => JSON.stringify(event)).join('\n')}\n`);
      return readTutorStubResistanceAxisTrace(tracePath);
    });
    const report = buildFrameRefuserOpportunityReport(
      traces,
      analyzerArgs(contract),
      registrationBinding(contract),
    );
    return {
      case_ids: cases.map((row) => row.case_id),
      endpoint_status: {
        frame_refuser_treatment_opportunity:
          report.gate.target.every((row) => typeof row.pass === 'boolean') ? 'complete' : 'incomplete',
        frame_defiant_productive_control:
          report.gate.control.every((row) => typeof row.pass === 'boolean') ? 'complete' : 'incomplete',
        distinct_public_prefix_assembly:
          typeof report.gate.distinctPrefixes.pass === 'boolean' ? 'complete' : 'incomplete',
      },
      report,
    };
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

export function runTutorStubFrameRefuserOpportunityEndpointPreflight(contract) {
  return runPaidStudyEndpointPreflight({
    contract,
    cases: buildTutorStubFrameRefuserOpportunitySyntheticCorpus(),
    buildPackets: buildTutorStubFrameRefuserOpportunityPreflightPackets,
    assemble: assembleTutorStubFrameRefuserOpportunityPreflight,
  });
}

export default {
  assembleTutorStubFrameRefuserOpportunityPreflight,
  assembleTutorStubResistanceAxisPreflight,
  buildTutorStubFrameRefuserOpportunityPreflightPackets,
  buildTutorStubFrameRefuserOpportunitySyntheticCorpus,
  buildTutorStubResistanceAxisPreflightPackets,
  buildTutorStubResistanceAxisSyntheticCorpus,
  runTutorStubFrameRefuserOpportunityEndpointPreflight,
  runTutorStubResistanceAxisEndpointPreflight,
};
