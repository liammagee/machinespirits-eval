import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildResistanceAxisDiscriminationReport } from '../scripts/analyze-tutor-stub-resistance-axis-calibration.js';
import { runPaidStudyEndpointPreflight } from './paidStudyEndpointPreflight.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROFILES = ['diligent', 'low_agency', 'bored', 'skeptical', 'low_trust_skeptic', 'frame_defiant'];
const MODEL = 'codex.gpt-5.6-luna';

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

export default {
  assembleTutorStubResistanceAxisPreflight,
  buildTutorStubResistanceAxisPreflightPackets,
  buildTutorStubResistanceAxisSyntheticCorpus,
  runTutorStubResistanceAxisEndpointPreflight,
};
