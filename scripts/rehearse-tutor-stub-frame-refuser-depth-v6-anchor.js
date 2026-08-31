#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

import { callAIWithCliBridge } from '../services/cliProviderBridge.js';
import { resolveModel } from '../services/evalConfigLoader.js';
import { resolveTutorStubArtifactArchiveDirectory } from '../services/tutorStubArtifactArchive.js';
import { buildTutorStubResistantLearnerFinalHorizonPacket } from '../services/tutorStubResistantLearnerSemanticRuntime.js';
import { dispatchTutorStubCliBridgeRequest } from '../services/tutorStubCliRequest.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRATION_PATH = 'config/tutor-stub-resistant-learner-merged-semantic-registration.v6.json';
const REGISTRATION_SHA256 = '3972dde8735edb0aef3e78c8fa1d8eed8afb19de9b639e79abaf84c0283d09c9';
const DIAGNOSIS_NOTE_PATH = 'notes/2026-08-30-frame-refuser-depth-v6-diagnosis.md';
const DIAGNOSIS_NOTE_SHA256 = 'a988e49a1229283f4f10947c99b3d58dd618258663f79a96507ad92e9cbf10f6';
const ORDER_SEED = '2026083002';
const CANDIDATE_ID = 'depth_v6_anchor';
const FACE_ID = 'faceB';

const RUN_ROOTS = Object.freeze({
  v4: Object.freeze({
    directory: 'artifacts/tutor-stub-live/frame-refuser-depth-gate1-v4-2026-08-27',
    sourceCommit: 'c83596b8ea3c17881de70db19e7416761545be3e',
  }),
  v5: Object.freeze({
    directory: 'artifacts/tutor-stub-live/frame-refuser-depth-gate1-v5-2026-08-30',
    sourceCommit: 'd22fd9b6cd44ee837cfee4874bfa85b4c80711d0',
  }),
});

export const DEPTH_V6_REHEARSAL_READER_SEATS = Object.freeze([
  Object.freeze({ id: 'reader_a', modelRef: 'codex.gpt-5.6-sol', effort: 'low' }),
  Object.freeze({ id: 'reader_b', modelRef: 'claude-code.sonnet-5', effort: 'low' }),
  Object.freeze({ id: 'reader_c', modelRef: 'claude-code.opus-5', effort: 'low' }),
]);

// The four draft amendment surfaces, frozen verbatim from the merged diagnosis
// note (sha pinned above). The rehearsal tests exactly this text; any drift
// between these constants and the note is a defect in this script.
const AMENDMENT_A_RUNG2_ANCHOR_CLAUSE =
  "Applying a completed public result reaches rung 2 only when the turn applies it to support or rule out the local warrant proposition itself. A concessive application — granting in indicative voice what a completed public result supports at an intermediate node while asserting in the same turn that the path from that node to the local warrant proposition remains unproved, lacks standing, or awaits a further requirement — is rung 1, however specific the concession and however public the result: such a turn's product is a limitation or missing-result requirement, not a local step. Read the direction of the turn's closing clause: a turn that closes by narrowing what remains unproved is rung 1; a turn that closes by beginning the offered test, committing to it now, or settling the local proposition with the applied result is rung 2.";
const AMENDMENT_B_RUNG1_ANCHOR_MIRROR =
  'A concessive application of a completed public result — granting what it supports at an intermediate node while converting the grant into a narrower unproved-path requirement in the same turn — is rung 1 when that requirement is new to the public transcript.';
const AMENDMENT_C_WORKED_EXAMPLE = Object.freeze({
  quote:
    'You have no standing to set the premise or test yet; the hose test supports a pressure-opened release during the pressure window, but the direct traced path from that release to the ceiling mark remains unproved.',
  rung: '1',
  why: 'Disputed replay boundary, rung 1 versus 2: the learner applies a completed public result in indicative voice, but concessively — the grant of the pressure-window release is converted, in the same sentence, into a narrower unproved-path requirement, and the turn closes by narrowing what remains unproved. The application neither begins the offered test nor settles the local proposition; a completed exhibit and indicative mood do not lift a concessive application above rung 1.',
});
const AMENDMENT_D_WORKED_EXAMPLE = Object.freeze({
  quote:
    "The hose test's pressure-window release, joined to the dye's traced route, now supports the fitting as the ceiling mark's source; my reservation on your wider answer frame stands.",
  rung: '2',
  why: 'The same completed public results, applied in the closing clause to support the local warrant proposition itself, with the wider reservation retained. The contrast with the archived rung-1 example is only the direction of the closing clause: settling the proposition rather than narrowing what remains unproved.',
});
const AMENDMENT_C_SOURCE_CASE = 'depth_reference_cal5_world_030_rowan_flat_r9';
const AMENDMENT_C_SOURCE_ID = 'post_4';

// Archived panel votes are embedded so the loader can fail closed if the
// archived reports and this roster ever disagree. Sixteen split rows and
// fourteen unanimous controls, exactly the diagnosis note's roster.
function rosterRow(caseId, run, role, votes) {
  return Object.freeze({ caseId, run, role, archivedVotes: Object.freeze(votes) });
}
export const DEPTH_V6_REHEARSAL_ROSTER = Object.freeze([
  rosterRow('depth_reference_cal5_world_030_rowan_flat_r2', 'v5', 'split', {
    reader_a: '2',
    reader_b: '1',
    reader_c: '1',
  }),
  rosterRow('depth_reference_cal5_world_030_rowan_flat_r5', 'v5', 'split', {
    reader_a: '2',
    reader_b: '1',
    reader_c: '1',
  }),
  rosterRow('depth_reference_cal5_world_030_rowan_flat_r9', 'v5', 'split', {
    reader_a: '2',
    reader_b: '1',
    reader_c: '1',
  }),
  rosterRow('depth_treatment_cal5_world_005_marrick_r10', 'v5', 'split', {
    reader_a: '2',
    reader_b: '1',
    reader_c: '1',
  }),
  rosterRow('depth_treatment_cal5_world_030_rowan_flat_r1', 'v5', 'split', {
    reader_a: '1',
    reader_b: '2',
    reader_c: '1',
  }),
  rosterRow('depth_treatment_cal5_world_030_rowan_flat_r7', 'v5', 'split', {
    reader_a: '2',
    reader_b: '1',
    reader_c: '1',
  }),
  rosterRow('depth_treatment_cal5_world_030_rowan_flat_r10', 'v5', 'split', {
    reader_a: '2',
    reader_b: '1',
    reader_c: '1',
  }),
  rosterRow('depth_reference_cal4_world_005_marrick_r6', 'v4', 'split', {
    reader_a: '0',
    reader_b: '1',
    reader_c: '1',
  }),
  rosterRow('depth_reference_cal4_world_030_rowan_flat_r3', 'v4', 'split', {
    reader_a: '2',
    reader_b: '1',
    reader_c: '1',
  }),
  rosterRow('depth_reference_cal4_world_030_rowan_flat_r5', 'v4', 'split', {
    reader_a: '1',
    reader_b: '2',
    reader_c: '1',
  }),
  rosterRow('depth_reference_cal4_world_030_rowan_flat_r6', 'v4', 'split', {
    reader_a: '2',
    reader_b: '1',
    reader_c: '1',
  }),
  rosterRow('depth_treatment_cal4_world_005_marrick_r8', 'v4', 'split', {
    reader_a: '0',
    reader_b: '1',
    reader_c: '1',
  }),
  rosterRow('depth_treatment_cal4_world_030_rowan_flat_r1', 'v4', 'split', {
    reader_a: '2',
    reader_b: '1',
    reader_c: '1',
  }),
  rosterRow('depth_treatment_cal4_world_030_rowan_flat_r8', 'v4', 'split', {
    reader_a: '1',
    reader_b: '0',
    reader_c: '1',
  }),
  rosterRow('depth_treatment_cal4_world_030_rowan_flat_r10', 'v4', 'split', {
    reader_a: '2',
    reader_b: '1',
    reader_c: '1',
  }),
  rosterRow('depth_treatment_cal4_world_030_rowan_flat_r12', 'v4', 'split', {
    reader_a: '1',
    reader_b: '1',
    reader_c: '2',
  }),
  rosterRow('depth_treatment_cal4_world_030_rowan_flat_r7', 'v4', 'control', {
    reader_a: '1',
    reader_b: '1',
    reader_c: '1',
  }),
  rosterRow('depth_treatment_cal4_world_030_rowan_flat_r11', 'v4', 'control', {
    reader_a: '1',
    reader_b: '1',
    reader_c: '1',
  }),
  rosterRow('depth_treatment_cal4_world_030_rowan_flat_r5', 'v4', 'control', {
    reader_a: '1',
    reader_b: '1',
    reader_c: '1',
  }),
  rosterRow('depth_reference_cal4_world_005_marrick_r12', 'v4', 'control', {
    reader_a: '1',
    reader_b: '1',
    reader_c: '1',
  }),
  rosterRow('depth_reference_cal4_world_030_rowan_flat_r12', 'v4', 'control', {
    reader_a: '1',
    reader_b: '1',
    reader_c: '1',
  }),
  rosterRow('depth_reference_cal4_world_030_rowan_flat_r4', 'v4', 'control', {
    reader_a: '1',
    reader_b: '1',
    reader_c: '1',
  }),
  rosterRow('depth_treatment_cal5_world_005_marrick_r7', 'v5', 'control', {
    reader_a: '1',
    reader_b: '1',
    reader_c: '1',
  }),
  rosterRow('depth_treatment_cal5_world_005_marrick_r3', 'v5', 'control', {
    reader_a: '1',
    reader_b: '1',
    reader_c: '1',
  }),
  rosterRow('depth_treatment_cal5_world_030_rowan_flat_r3', 'v5', 'control', {
    reader_a: '1',
    reader_b: '1',
    reader_c: '1',
  }),
  rosterRow('depth_reference_cal5_world_005_marrick_r12', 'v5', 'control', {
    reader_a: '1',
    reader_b: '1',
    reader_c: '1',
  }),
  rosterRow('depth_reference_cal5_world_005_marrick_r6', 'v5', 'control', {
    reader_a: '1',
    reader_b: '1',
    reader_c: '1',
  }),
  rosterRow('depth_reference_cal5_world_005_marrick_r7', 'v5', 'control', {
    reader_a: '1',
    reader_b: '1',
    reader_c: '1',
  }),
  rosterRow('depth_treatment_cal5_world_005_marrick_r11', 'v5', 'control', {
    reader_a: '2',
    reader_b: '2',
    reader_c: '2',
  }),
  rosterRow('depth_reference_cal4_world_030_rowan_flat_r10', 'v4', 'control', {
    reader_a: '2',
    reader_b: '2',
    reader_c: '2',
  }),
]);

const SYSTEM_PROMPT =
  'You are an independent exploratory semantic reader. Judge only the supplied material. Use no tools, infer no hidden assignment, and return only the requested JSON object.';

export const DEPTH_V6_REHEARSAL_USAGE = `Frame-refuser depth v6 anchor rehearsal (burned transcripts; directional only):
  node scripts/rehearse-tutor-stub-frame-refuser-depth-v6-anchor.js --dry-run
  node scripts/rehearse-tutor-stub-frame-refuser-depth-v6-anchor.js --launch --parallelism 6

Re-adjudicates 16 archived split rows and 14 unanimous controls from the sealed v4 and v5
frame-refuser depth Gate-1 calibrations with the three sealed reader seats, under the sealed
v6 registration protocol amended by the four draft anchor surfaces frozen in
${DIAGNOSIS_NOTE_PATH}. Reads the sealed run roots without writing to them, generates no
dialogue, and launches no calibration or study. Plans 90 reader records with one
outcome-blind transport retry each, for a hard ceiling of 180 attempts. Success criteria
are fixed in the note; anything less than both criteria kills revision 6.`;

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

function readFileReadonly(filePath, encoding = null) {
  const descriptor = fs.openSync(filePath, 'r');
  try {
    return fs.readFileSync(descriptor, encoding || undefined);
  } finally {
    fs.closeSync(descriptor);
  }
}

function readJsonReadonly(filePath) {
  return JSON.parse(readFileReadonly(filePath, 'utf8'));
}

function readJsonLinesReadonly(filePath) {
  return readFileReadonly(filePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function writeOnce(filePath, value) {
  fs.writeFileSync(filePath, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`, {
    flag: 'wx',
  });
}

function appendJsonLine(filePath, value) {
  fs.appendFileSync(filePath, `${JSON.stringify(value)}\n`);
}

function fold(value) {
  return String(value || '')
    .replace(/[“”]/gu, '"')
    .replace(/[‘’]/gu, "'")
    .replace(/[–—]/gu, '-')
    .replace(/\u00a0/gu, ' ')
    .normalize('NFKC');
}

function exactPublicQuote(packet, quote) {
  if (!quote || typeof quote !== 'object' || Array.isArray(quote)) return false;
  if (JSON.stringify(Object.keys(quote).sort()) !== JSON.stringify(['source_id', 'text'])) return false;
  if (!Object.hasOwn(packet, quote.source_id)) return false;
  const source = fold(packet[quote.source_id]);
  const text = fold(quote.text);
  const index = text ? source.indexOf(text) : -1;
  return index >= 0 && index === source.lastIndexOf(text);
}

function oneEvent(events, predicate, label) {
  const matches = events.filter(predicate);
  if (matches.length !== 1) throw new Error(`expected one ${label}, found ${matches.length}`);
  return matches[0];
}

function modalValue(votes) {
  const counts = new Map();
  for (const value of Object.values(votes)) counts.set(value, (counts.get(value) || 0) + 1);
  const winner = [...counts.entries()].find(([, count]) => count >= 2);
  if (!winner) throw new Error('roster row lacks a modal value');
  return winner[0];
}

function deviantSeat(row) {
  const modal = modalValue(row.archivedVotes);
  const deviants = Object.entries(row.archivedVotes).filter(([, value]) => value !== modal);
  if (row.role === 'split') {
    if (deviants.length !== 1) throw new Error(`${row.caseId}: split row must have exactly one deviant seat`);
    return { seatId: deviants[0][0], value: deviants[0][1], modal };
  }
  if (deviants.length !== 0) throw new Error(`${row.caseId}: control row must be unanimous`);
  return { seatId: null, value: null, modal };
}

function isV5SolHigh(row) {
  const { seatId, value } = deviantSeat(row);
  return row.run === 'v5' && seatId === 'reader_a' && value === '2';
}

export function loadAmendedFaceContract(root = ROOT) {
  const registrationPath = path.join(root, REGISTRATION_PATH);
  const registrationBytes = readFileReadonly(registrationPath);
  if (sha256(registrationBytes) !== REGISTRATION_SHA256) {
    throw new Error('sealed v6 semantic registration bytes drifted from the pinned sha256');
  }
  const registration = JSON.parse(registrationBytes.toString('utf8'));
  if (registration.version !== 6) throw new Error('rehearsal requires merged semantic registration version 6');
  const face = registration.instrument.faces[FACE_ID];
  if (!face?.rungs || !face?.rungAnchors || !face?.echoGuard || !Array.isArray(face?.workedExamples)) {
    throw new Error(`sealed v6 registration lacks the ${FACE_ID} instrument surfaces`);
  }
  if (Number(face.horizonPostTriggerLearnerTurns) !== 8) {
    throw new Error('sealed v6 faceB horizon drifted from 8 post-trigger learner turns');
  }
  return {
    registration,
    contract: {
      mode: 'exact_rung',
      registration: REGISTRATION_PATH,
      registration_version: registration.version,
      amendment:
        'sealed v6 protocol plus the four draft anchor surfaces frozen in the frame-refuser depth v6 diagnosis note; anchors amended, no rung definition, endpoint, or disposition moved',
      visibility: 'public transcript only; learner sources only for endpoint evidence',
      endpoint_definition: registration.instrument.endpointDefinition,
      rungs: face.rungs,
      echo_guard: face.echoGuard,
      anchors: {
        0: face.rungAnchors['0'],
        1: `${face.rungAnchors['1']} ${AMENDMENT_B_RUNG1_ANCHOR_MIRROR}`,
        2: `${face.rungAnchors['2']} ${AMENDMENT_A_RUNG2_ANCHOR_CLAUSE}`,
      },
      worked_examples: [...face.workedExamples, AMENDMENT_C_WORKED_EXAMPLE, AMENDMENT_D_WORKED_EXAMPLE],
      jurisdiction_rule:
        'A standing refusal in the same turn is separate from engagement and does not lower a qualifying local-test clause.',
      evidence_contract: registration.evidenceContract.promptInstruction,
    },
  };
}

export function loadRehearsalCases({ archiveRoot, root = ROOT } = {}) {
  const noteBytes = readFileReadonly(path.join(root, DIAGNOSIS_NOTE_PATH));
  if (sha256(noteBytes) !== DIAGNOSIS_NOTE_SHA256) {
    throw new Error('diagnosis note bytes drifted from the pinned sha256');
  }
  const rowsById = new Map();
  const runReports = {};
  for (const [runTag, runRoot] of Object.entries(RUN_ROOTS)) {
    const absoluteRoot = path.join(archiveRoot, runRoot.directory);
    const reportPath = path.join(absoluteRoot, 'report.json');
    const reportBytes = readFileReadonly(reportPath);
    const report = JSON.parse(reportBytes.toString('utf8'));
    if (report?.execution?.source_commit !== runRoot.sourceCommit) {
      throw new Error(`${runTag} run root is not the sealed source commit ${runRoot.sourceCommit}`);
    }
    runReports[runTag] = { root: absoluteRoot, reportSha256: sha256(reportBytes) };
    for (const row of report.rows || []) rowsById.set(row.job.id, { runTag, absoluteRoot, row });
  }
  const cases = DEPTH_V6_REHEARSAL_ROSTER.map((rosterEntry) => {
    const found = rowsById.get(rosterEntry.caseId);
    if (!found) throw new Error(`${rosterEntry.caseId}: not present in the archived reports`);
    if (found.runTag !== rosterEntry.run) throw new Error(`${rosterEntry.caseId}: run tag drifted`);
    const { row, absoluteRoot } = found;
    if (row.status !== 'complete') throw new Error(`${rosterEntry.caseId}: archived row is not complete`);
    const primary = row.outcome?.primary;
    const field = primary?.fields?.final_graded_engagement_rung;
    if (!field) throw new Error(`${rosterEntry.caseId}: archived row lacks the graded endpoint`);
    const archivedSeatEvidence = [];
    for (const seat of primary.seats || []) {
      const validation = seat.validation?.fields?.final_graded_engagement_rung;
      if (!validation) throw new Error(`${rosterEntry.caseId}: seat ${seat.judge_id} lacks endpoint validation`);
      if (validation.value !== rosterEntry.archivedVotes[seat.judge_id]) {
        throw new Error(
          `${rosterEntry.caseId}: archived ${seat.judge_id} vote ${validation.value} disagrees with the embedded roster`,
        );
      }
      for (const evidence of validation.evidence || []) {
        archivedSeatEvidence.push({ seatId: seat.judge_id, source_id: evidence.source_id, text: evidence.text });
      }
    }
    const { modal } = deviantSeat(rosterEntry);
    if (field.value !== modal) {
      throw new Error(`${rosterEntry.caseId}: archived modal ${field.value} disagrees with the embedded roster`);
    }
    const jobRoot = path.join(absoluteRoot, 'jobs', row.job.id);
    const transcriptPath = path.join(jobRoot, 'transcript.json');
    const traceFile = path.join(absoluteRoot, row.trace);
    const transcript = readJsonReadonly(transcriptPath);
    const events = readJsonLinesReadonly(traceFile);
    const intervention = oneEvent(
      events,
      (event) => event.type === 'resistance_action_register_intervention_applied' && event.jobId === row.job.id,
      `${row.job.id} intervention`,
    );
    const triggerTurn = Number(intervention.turn);
    const horizon = Number(row.job.outcome_horizon_learner_turns);
    const outcome = oneEvent(
      events,
      (event) =>
        event.type === 'resistance_action_register_outcome_learner_turn' &&
        event.jobId === row.job.id &&
        Number(event.turn) === triggerTurn + horizon,
      `${row.job.id} final public learner outcome`,
    );
    if (!String(outcome.learnerText || '').trim()) {
      throw new Error(`${row.job.id} lacks its final public learner turn`);
    }
    const state = {
      turns: transcript.turns,
      resistanceActionRegisterStudy: {
        trigger_turn: triggerTurn,
        outcome_horizon_learner_turns: horizon,
      },
    };
    const publicPacket = buildTutorStubResistantLearnerFinalHorizonPacket(state, outcome.learnerText);
    for (const evidence of archivedSeatEvidence) {
      const source = fold(publicPacket[evidence.source_id] || '');
      if (!source.includes(fold(evidence.text))) {
        throw new Error(
          `${row.job.id}: archived ${evidence.seatId} evidence from ${evidence.source_id} does not land in the rebuilt packet`,
        );
      }
    }
    return {
      caseId: row.job.id,
      run: rosterEntry.run,
      role: rosterEntry.role,
      archivedVotes: rosterEntry.archivedVotes,
      archivedModal: modal,
      publicPacket,
      packetSha256: canonicalSha256(publicPacket),
      sourceSha256: sha256(Buffer.concat([readFileReadonly(transcriptPath), readFileReadonly(traceFile)])),
    };
  });
  const splitCases = cases.filter((row) => row.role === 'split');
  const controlCases = cases.filter((row) => row.role === 'control');
  if (splitCases.length !== 16 || controlCases.length !== 14) {
    throw new Error(`roster drifted: ${splitCases.length} splits, ${controlCases.length} controls`);
  }
  const solHigh = DEPTH_V6_REHEARSAL_ROSTER.filter(isV5SolHigh);
  if (solHigh.length !== 6) throw new Error(`expected six v5 sol-high split rows, found ${solHigh.length}`);
  const rung2Controls = controlCases.filter((row) => row.archivedModal === '2');
  if (rung2Controls.length !== 2) throw new Error('expected exactly two unanimous rung-2 controls');
  const anchorSourceCase = cases.find((row) => row.caseId === AMENDMENT_C_SOURCE_CASE);
  if (
    !fold(anchorSourceCase.publicPacket[AMENDMENT_C_SOURCE_ID] || '').includes(fold(AMENDMENT_C_WORKED_EXAMPLE.quote))
  ) {
    throw new Error('worked example (c) does not match its archived source turn');
  }
  return { cases, runReports };
}

function rehearsalOutputSchema({ caseId }) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['case_id', 'candidate_id', 'repetition', 'face_id', 'value', 'confidence', 'evidence_quotes'],
    properties: {
      case_id: { type: 'string', enum: [caseId] },
      candidate_id: { type: 'string', enum: [CANDIDATE_ID] },
      repetition: { type: 'integer', enum: [1] },
      face_id: { type: 'string', enum: [FACE_ID] },
      value: { type: 'string', enum: ['0', '1', '2', 'indeterminate'] },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      evidence_quotes: {
        anyOf: [
          { type: 'null' },
          {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['source_id', 'text'],
              properties: {
                source_id: { type: 'string', minLength: 1 },
                text: { type: 'string', minLength: 1 },
              },
            },
          },
        ],
      },
    },
  };
}

export function buildRehearsalTask({ rehearsalCase, seat, contract }) {
  const prompt = {
    schema: 'machinespirits.tutor-stub.frame-refuser-depth-v6-anchor-rehearsal-prompt.v1',
    exploratory: true,
    registered: false,
    directional_stack_bounded: true,
    case_id: rehearsalCase.caseId,
    face_id: FACE_ID,
    candidate_id: CANDIDATE_ID,
    candidate_label: 'Sealed v6 protocol plus the frozen concessive-application anchor surfaces (a)-(d)',
    repetition: 1,
    reader: seat,
    independence: {
      fresh_context: true,
      other_reader_output_visible: false,
      shared_notes: false,
      generator_analysis_visible: false,
    },
    instructions: [
      'Assign the highest defensible engagement rung reached anywhere in the fixed public horizon.',
      'For rung 1 or 2 copy at least one unique verbatim public learner quote; for rung 0 or indeterminate use null.',
      'Use high or medium confidence for a determinate value. Use low confidence for indeterminate.',
    ],
    candidate_contract: contract,
    public_packet: rehearsalCase.publicPacket,
    packet_sha256: rehearsalCase.packetSha256,
  };
  return {
    rehearsalCase,
    seat,
    prompt,
    outputSchema: rehearsalOutputSchema({ caseId: rehearsalCase.caseId }),
  };
}

function parseStructuredText(text) {
  const value = JSON.parse(String(text || '').trim());
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('reader returned no JSON object');
  return value;
}

export function validateRehearsalOutput(task, output) {
  const expectedKeys = ['candidate_id', 'case_id', 'confidence', 'evidence_quotes', 'face_id', 'repetition', 'value'];
  const issues = [];
  if (JSON.stringify(Object.keys(output).sort()) !== JSON.stringify(expectedKeys)) issues.push('keys_not_exact');
  if (
    output.case_id !== task.rehearsalCase.caseId ||
    output.candidate_id !== CANDIDATE_ID ||
    output.face_id !== FACE_ID ||
    output.repetition !== 1
  ) {
    issues.push('identity_mismatch');
  }
  if (!['0', '1', '2', 'indeterminate'].includes(output.value)) issues.push('value_invalid');
  const determinate = output.value !== 'indeterminate';
  if (determinate ? !['high', 'medium'].includes(output.confidence) : output.confidence !== 'low') {
    issues.push('confidence_invalid');
  }
  const needsEvidence = ['1', '2'].includes(output.value);
  if (needsEvidence) {
    if (!Array.isArray(output.evidence_quotes) || output.evidence_quotes.length === 0) issues.push('evidence_missing');
    else if (!output.evidence_quotes.every((quote) => exactPublicQuote(task.rehearsalCase.publicPacket, quote))) {
      issues.push('evidence_invalid');
    } else if (
      output.evidence_quotes.some(
        (quote) => quote.source_id !== 'trigger' && !String(quote.source_id || '').startsWith('post_'),
      )
    ) {
      issues.push('endpoint_evidence_source_not_public_learner_turn');
    }
  } else if (output.evidence_quotes !== null) {
    issues.push('evidence_must_be_null');
  }
  return { valid: issues.length === 0 && determinate, issues };
}

function createCallBudget({ ceiling }) {
  let attempts = 0;
  let completed = 0;
  let failed = 0;
  return {
    reserve() {
      if (attempts >= ceiling) throw new Error('rehearsal hard attempt ceiling exhausted before model call');
      attempts += 1;
      return attempts;
    },
    complete() {
      completed += 1;
    },
    fail() {
      failed += 1;
    },
    status() {
      return { attempts, completed, failed, ceiling };
    },
  };
}

async function callFresh({ prompt, outputSchema, seat, role, budget, callBridge = callAIWithCliBridge }) {
  const attempt = budget.reserve();
  const resolved = resolveModel(seat.modelRef);
  try {
    const response = await dispatchTutorStubCliBridgeRequest(callBridge, {
      resolved,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: JSON.stringify(prompt),
      role,
      messageHistory: [],
      effort: seat.effort,
      outputSchema,
    });
    budget.complete();
    return {
      attempt,
      response: {
        text: response.text,
        provider: response.provider,
        model: response.model,
        effort: response.effort || response.reasoningEffort || null,
        structuredOutput: response.structuredOutput === true,
        prohibitedToolEventCount: Number(response.prohibitedToolEventCount || 0),
        prohibitedToolEventCountObserved:
          Object.hasOwn(response, 'prohibitedToolEventCount') && Number.isInteger(response.prohibitedToolEventCount),
      },
    };
  } catch (error) {
    budget.fail();
    return {
      attempt,
      error: error.message,
      errorDetail: {
        code: error.code || null,
        classification: error.classification || null,
        stdoutText: error.stdoutText || null,
        stderrText: error.stderrText || null,
      },
    };
  }
}

async function callFreshWithTechnicalRetry(options) {
  const calls = [];
  for (let callIndex = 1; callIndex <= 2; callIndex += 1) {
    const call = await callFresh(options);
    calls.push(call);
    if (call.response) return { ...call, calls };
    if (callIndex < 2) await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return { ...calls.at(-1), calls };
}

async function mapConcurrent(items, parallelism, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(parallelism, items.length) }, () => worker()));
  return results;
}

export function evaluateRehearsalCriteria(cases, records) {
  const bySeatCase = new Map(records.map((record) => [`${record.case_id}\0${record.reader_id}`, record]));
  const rungFor = (caseId, seatId) => {
    const record = bySeatCase.get(`${caseId}\0${seatId}`);
    if (!record) return 'missing';
    return record.valid ? record.output.value : 'invalid';
  };
  const splitRows = cases
    .filter((row) => row.role === 'split')
    .map((row) => {
      const { seatId, value } = deviantSeat(row);
      const rehearsalVotes = Object.fromEntries(
        DEPTH_V6_REHEARSAL_READER_SEATS.map((seat) => [seat.id, rungFor(row.caseId, seat.id)]),
      );
      return {
        case_id: row.caseId,
        run: row.run,
        archived_modal: row.archivedModal,
        archived_votes: row.archivedVotes,
        deviant_seat: seatId,
        archived_deviant_value: value,
        v5_sol_high: isV5SolHigh(row),
        rehearsal_votes: rehearsalVotes,
        deviant_seat_resolved: rehearsalVotes[seatId] === row.archivedModal,
        unanimous_at_archived_modal: DEPTH_V6_REHEARSAL_READER_SEATS.every(
          (seat) => rehearsalVotes[seat.id] === row.archivedModal,
        ),
      };
    });
  const controlRows = cases
    .filter((row) => row.role === 'control')
    .map((row) => {
      const rehearsalVotes = Object.fromEntries(
        DEPTH_V6_REHEARSAL_READER_SEATS.map((seat) => [seat.id, rungFor(row.caseId, seat.id)]),
      );
      const kept = DEPTH_V6_REHEARSAL_READER_SEATS.every((seat) => rehearsalVotes[seat.id] === row.archivedModal);
      return {
        case_id: row.caseId,
        run: row.run,
        archived_unanimous_value: row.archivedModal,
        rung2_control: row.archivedModal === '2',
        rehearsal_votes: rehearsalVotes,
        kept_unanimously: kept,
        demotions:
          row.archivedModal === '2'
            ? DEPTH_V6_REHEARSAL_READER_SEATS.filter((seat) => rehearsalVotes[seat.id] !== '2').map((seat) => seat.id)
            : [],
      };
    });
  const resolvedSplits = splitRows.filter((row) => row.deviant_seat_resolved).length;
  const resolvedV5SolHigh = splitRows.filter((row) => row.v5_sol_high && row.deviant_seat_resolved).length;
  const keptControls = controlRows.filter((row) => row.kept_unanimously).length;
  const rung2Controls = controlRows.filter((row) => row.rung2_control);
  const rung2Demotions = rung2Controls.flatMap((row) => row.demotions.map((seatId) => `${row.case_id}:${seatId}`));
  const resolution = {
    resolved_splits: resolvedSplits,
    resolved_required: 13,
    v5_sol_high_resolved: resolvedV5SolHigh,
    v5_sol_high_required: 5,
    pass: resolvedSplits >= 13 && resolvedV5SolHigh >= 5,
  };
  const stability = {
    controls_kept_unanimously: keptControls,
    controls_required: 12,
    rung2_controls_kept: rung2Controls.filter((row) => row.kept_unanimously).length,
    rung2_demotions: rung2Demotions,
    pass: keptControls >= 12 && rung2Demotions.length === 0,
  };
  return {
    resolution,
    stability,
    verdict: resolution.pass && stability.pass ? 'pass_register_revision_6' : 'kill_no_revision_6_construct_finding',
    split_rows: splitRows,
    control_rows: controlRows,
  };
}

export function buildRehearsalPlan({ archiveRoot, out, root = ROOT } = {}) {
  if (!path.isAbsolute(archiveRoot) || !path.isAbsolute(out)) {
    throw new Error('archive root and out must be absolute paths');
  }
  const loaded = loadRehearsalCases({ archiveRoot, root });
  const { contract } = loadAmendedFaceContract(root);
  const tasks = [];
  for (const rehearsalCase of loaded.cases) {
    for (const seat of DEPTH_V6_REHEARSAL_READER_SEATS) {
      tasks.push(buildRehearsalTask({ rehearsalCase, seat, contract }));
    }
  }
  tasks.sort((left, right) => {
    const leftKey = sha256(`${left.rehearsalCase.caseId}:${left.seat.id}:${ORDER_SEED}`);
    const rightKey = sha256(`${right.rehearsalCase.caseId}:${right.seat.id}:${ORDER_SEED}`);
    return leftKey < rightKey ? -1 : 1;
  });
  return {
    loaded,
    contract,
    tasks,
    plan: {
      schema: 'machinespirits.tutor-stub.frame-refuser-depth-v6-anchor-rehearsal-plan.v1',
      mode: 'depth_v6_anchor_rehearsal',
      status: 'planned_existing_text_adjudication_only',
      registered: false,
      study_or_calibration_launch: false,
      dialogue_generation: false,
      run_roots: Object.fromEntries(
        Object.entries(RUN_ROOTS).map(([runTag, runRoot]) => [
          runTag,
          {
            path: path.join(archiveRoot, runRoot.directory),
            source_commit: runRoot.sourceCommit,
            report_sha256: loaded.runReports[runTag].reportSha256,
          },
        ]),
      ),
      run_root_access: 'read_only',
      out,
      out_create_once: true,
      repetitions: 1,
      roster: {
        splits: 16,
        v5_sol_high_splits: 6,
        controls: 14,
        rung2_controls: 2,
        cases: loaded.cases.map((row) => ({
          case_id: row.caseId,
          run: row.run,
          role: row.role,
          archived_modal: row.archivedModal,
          archived_votes: row.archivedVotes,
          packet_sha256: row.packetSha256,
          source_sha256: row.sourceSha256,
        })),
      },
      reader_seats: DEPTH_V6_REHEARSAL_READER_SEATS,
      order_seed: ORDER_SEED,
      planned_reader_calls: tasks.length,
      maximum_reader_transport_retries: tasks.length,
      hard_attempt_ceiling: tasks.length * 2,
      sealed_registration: { path: REGISTRATION_PATH, sha256: REGISTRATION_SHA256, version: 6 },
      diagnosis_note: { path: DIAGNOSIS_NOTE_PATH, sha256: DIAGNOSIS_NOTE_SHA256 },
      amendment_surfaces: {
        a_rung2_anchor_clause: AMENDMENT_A_RUNG2_ANCHOR_CLAUSE,
        b_rung1_anchor_mirror: AMENDMENT_B_RUNG1_ANCHOR_MIRROR,
        c_worked_example: AMENDMENT_C_WORKED_EXAMPLE,
        d_worked_example: AMENDMENT_D_WORKED_EXAMPLE,
      },
      success_criteria: {
        resolution:
          'previously-deviant seat votes the archived modal on at least 13 of 16 split rows, including at least 5 of the 6 v5 sol-high rows',
        stability:
          'archived unanimous value kept unanimously on at least 12 of 14 controls, and both rung-2 controls keep rung 2 with no seat demoting',
        kill: 'anything less on either criterion kills revision 6; the disagreement is recorded as a construct finding',
      },
      directional_limit:
        'burned v4/v5 depth calibration transcripts; anchor surfaces drafted after observing the archived split votes; worked example (c) is the disputed turn of roster row depth_reference_cal5_world_030_rowan_flat_r9; rehearsal only, no row reused for any outcome claim',
      model_calls_executed: 0,
    },
  };
}

export async function executeRehearsal({ built, parallelism = 6, callBridge = callAIWithCliBridge } = {}) {
  const { out } = built.plan;
  if (fs.existsSync(out)) throw new Error('rehearsal destination is create-once');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.mkdirSync(out, { recursive: false });
  const ledgerPath = path.join(out, 'replay-ledger.jsonl');
  writeOnce(ledgerPath, '');
  writeOnce(path.join(out, 'replay-plan.json'), built.plan);
  const budget = createCallBudget({ ceiling: built.plan.hard_attempt_ceiling });
  appendJsonLine(ledgerPath, { at: new Date().toISOString(), type: 'rehearsal_started', ...budget.status() });
  let progress = 0;
  const records = await mapConcurrent(built.tasks, parallelism, async (task) => {
    const role = `tutor_stub_frame_refuser_depth_v6_anchor_rehearsal_${task.rehearsalCase.caseId}_${task.seat.id}`;
    const call = await callFreshWithTechnicalRetry({
      prompt: task.prompt,
      outputSchema: task.outputSchema,
      seat: task.seat,
      role,
      budget,
      callBridge,
    });
    let output = null;
    let validation = { valid: false, issues: [call.error || 'reader_call_failed'] };
    if (call.response) {
      try {
        output = parseStructuredText(call.response.text);
        validation = validateRehearsalOutput(task, output);
        if (
          call.response.effort !== task.seat.effort ||
          call.response.structuredOutput !== true ||
          call.response.prohibitedToolEventCountObserved !== true ||
          call.response.prohibitedToolEventCount !== 0
        ) {
          validation = { valid: false, issues: [...validation.issues, 'model_envelope_invalid'] };
        }
      } catch (error) {
        validation = { valid: false, issues: [error.message] };
      }
    }
    progress += 1;
    if (progress % 10 === 0 || progress === built.tasks.length) {
      process.stdout.write(
        `rehearsal reads ${progress}/${built.tasks.length}; attempts ${budget.status().attempts}/${built.plan.hard_attempt_ceiling}\n`,
      );
    }
    const record = {
      case_id: task.rehearsalCase.caseId,
      face_id: FACE_ID,
      candidate_id: CANDIDATE_ID,
      role: task.rehearsalCase.role,
      repetition: 1,
      reader_id: task.seat.id,
      model_ref: task.seat.modelRef,
      effort: task.seat.effort,
      attempt: call.attempt,
      call_attempts: call.calls.map((entry) => ({
        attempt: entry.attempt,
        error: entry.error || null,
        error_detail: entry.errorDetail || null,
      })),
      packet_sha256: task.rehearsalCase.packetSha256,
      prompt_sha256: canonicalSha256(task.prompt),
      output,
      valid: validation.valid,
      issues: validation.issues,
      response_envelope: call.response || null,
      call_error: call.error || null,
    };
    appendJsonLine(ledgerPath, { at: new Date().toISOString(), type: 'reader_record', ...record });
    return record;
  });
  const criteria = evaluateRehearsalCriteria(built.loaded.cases, records);
  const report = {
    schema: 'machinespirits.tutor-stub.frame-refuser-depth-v6-anchor-rehearsal-report.v1',
    exploratory: true,
    registered: false,
    directional_stack_bounded: true,
    generated_at: new Date().toISOString(),
    run_roots: built.plan.run_roots,
    source_access: 'read_only',
    study_or_calibration_launched: false,
    dialogue_generated: false,
    mode: built.plan.mode,
    models: { readers: built.plan.reader_seats },
    call_budget: budget.status(),
    invalid_records: records.filter((record) => !record.valid).length,
    success_criteria: built.plan.success_criteria,
    criteria_evaluation: {
      resolution: criteria.resolution,
      stability: criteria.stability,
      verdict: criteria.verdict,
    },
    split_rows: criteria.split_rows,
    control_rows: criteria.control_rows,
    directional_limit: built.plan.directional_limit,
    reader_records: records,
  };
  writeOnce(path.join(out, 'replay-report.json'), report);
  appendJsonLine(ledgerPath, {
    at: new Date().toISOString(),
    type: 'rehearsal_sealed',
    ...budget.status(),
    reader_records: records.length,
    verdict: criteria.verdict,
  });
  return report;
}

export async function main(argv = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: argv,
    options: {
      launch: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      'archive-root': { type: 'string' },
      out: { type: 'string' },
      parallelism: { type: 'string', default: '6' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  process.stdout.write(`${DEPTH_V6_REHEARSAL_USAGE}\n`);
  if (values.help || (!values.launch && !values['dry-run'])) return;
  if (values.launch && values['dry-run']) throw new Error('choose exactly one of --launch or --dry-run');
  const parallelism = Number(values.parallelism);
  if (!Number.isInteger(parallelism) || parallelism < 1 || parallelism > 16) {
    throw new Error('parallelism must be 1..16');
  }
  const archiveRoot =
    values['archive-root'] || resolveTutorStubArtifactArchiveDirectory(null, { cwd: ROOT, repoRoot: ROOT });
  if (!archiveRoot) throw new Error('archive root not found; pass --archive-root');
  const out =
    values.out ||
    path.join(archiveRoot, 'artifacts', 'tutor-stub-analysis', 'frame-refuser-depth-v6-anchor-rehearsal-2026-08-30');
  const built = buildRehearsalPlan({ archiveRoot: path.resolve(archiveRoot), out: path.resolve(out) });
  if (fs.existsSync(built.plan.out)) throw new Error('rehearsal destination is create-once');
  if (values['dry-run']) {
    process.stdout.write(`${JSON.stringify(built.plan, null, 2)}\n`);
    return;
  }
  const report = await executeRehearsal({ built, parallelism });
  process.stdout.write(
    `${JSON.stringify(
      {
        call_budget: report.call_budget,
        invalid_records: report.invalid_records,
        criteria_evaluation: report.criteria_evaluation,
      },
      null,
      2,
    )}\n`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}
