#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

import { callAIWithCliBridge } from '../services/cliProviderBridge.js';
import { resolveModel } from '../services/evalConfigLoader.js';
import { buildTutorStubResistantLearnerFinalHorizonPacket } from '../services/tutorStubResistantLearnerSemanticRuntime.js';
import { dispatchTutorStubCliBridgeRequest } from '../services/tutorStubCliRequest.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_RUN_ROOT =
  '/Users/lmagee/Dev/machinespirits/machinespirits-eval-private/artifacts/tutor-stub-live/resistant-learner-merged-calibration-v4-2026-08-25';
const DEFAULT_OUT =
  '/Users/lmagee/Dev/machinespirits/machinespirits-eval-private/artifacts/tutor-stub-analysis/resistant-learner-v4-v5-candidate-replay-2026-08-26';
const DESIGN_PATH = 'config/tutor-stub-resistant-learner-merged-design.v4.json';
const READER_SEATS = Object.freeze([
  Object.freeze({ id: 'reader_sol', modelRef: 'codex.gpt-5.6-sol', effort: 'low' }),
  Object.freeze({ id: 'reader_luna', modelRef: 'codex.gpt-5.6-luna', effort: 'low' }),
]);
const TIE_AUDITOR = Object.freeze({ id: 'tie_auditor', modelRef: 'codex.gpt-5.6-sol', effort: 'high' });
const MAX_REPETITIONS = 2;
const COMPLETED_DIALOGUES = 32;
const CANDIDATES = Object.freeze([
  Object.freeze({ id: 'plant_visible', label: 'Move 1a: disclosed planted nodes' }),
  Object.freeze({ id: 'transcript_only', label: 'Move 1b: public-transcript-only ladder' }),
  Object.freeze({ id: 'mechanical_tiebreak', label: 'Move 1c: mechanical origin screen plus semantic tie-break' }),
  Object.freeze({ id: 'bridge_verdict_reuse', label: 'Move 2: enforcement verdict supplies rung 1' }),
]);

export const RESISTANT_LEARNER_V4_REPLAY_ATTEMPT_CEILING =
  CANDIDATES.length * COMPLETED_DIALOGUES * MAX_REPETITIONS * (READER_SEATS.length * 2 + 1);

const SYSTEM_PROMPT =
  'You are an independent exploratory semantic reader. Judge only the supplied material. Use no tools, infer no hidden assignment, and return only the requested JSON object.';
const TIE_SYSTEM_PROMPT =
  'You are an independent tie auditor for an exploratory replay. Use only the supplied packet, candidate contract, and two blinded reader records. Return only the requested JSON object.';

export const RESISTANT_LEARNER_V4_REPLAY_USAGE = `Usage:
  node scripts/replay-tutor-stub-resistant-learner-v4-candidates.js --dry-run \\
    --run-root ${DEFAULT_RUN_ROOT} \\
    --out ${DEFAULT_OUT}

  node scripts/replay-tutor-stub-resistant-learner-v4-candidates.js --launch \\
    --run-root ${DEFAULT_RUN_ROOT} \\
    --out ${DEFAULT_OUT} \\
    --repetitions 2 --parallelism 8

This exploratory replay reads the sealed V4 root without writing to it. It generates no dialogue,
launches no calibration or study, and makes only fresh-context semantic-reader calls over already-
public transcripts. Two repetitions plan 512 low-effort reader records and at most 256 high-effort
tie-audit records. One outcome-blind retry is allowed only when a transport call produces no accepted
response, for a hard ceiling of ${RESISTANT_LEARNER_V4_REPLAY_ATTEMPT_CEILING} attempts. Results are directional and stack-bounded.`;

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

function tracePath(runRoot, row) {
  return path.join(runRoot, row.trace);
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

function replayOutputSchema({ caseId, candidateId, repetition, faceId, bridgeMode = false }) {
  const values = bridgeMode ? ['rung2_yes', 'rung2_no', 'indeterminate'] : ['0', '1', '2', 'indeterminate'];
  return {
    type: 'object',
    additionalProperties: false,
    required: ['case_id', 'candidate_id', 'repetition', 'face_id', 'value', 'confidence', 'evidence_quotes'],
    properties: {
      case_id: { type: 'string', enum: [caseId] },
      candidate_id: { type: 'string', enum: [candidateId] },
      repetition: { type: 'integer', enum: [repetition] },
      face_id: { type: 'string', enum: [faceId] },
      value: { type: 'string', enum: values },
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

function tieOutputSchema({ caseId, candidateId, repetition, faceId, bridgeMode = false }) {
  const values = bridgeMode ? ['rung2_yes', 'rung2_no', 'indeterminate'] : ['0', '1', '2', 'indeterminate'];
  return {
    type: 'object',
    additionalProperties: false,
    required: ['case_id', 'candidate_id', 'repetition', 'face_id', 'value', 'reason'],
    properties: {
      case_id: { type: 'string', enum: [caseId] },
      candidate_id: { type: 'string', enum: [candidateId] },
      repetition: { type: 'integer', enum: [repetition] },
      face_id: { type: 'string', enum: [faceId] },
      value: { type: 'string', enum: values },
      reason: { type: 'string', minLength: 1 },
    },
  };
}

const FACE_A_PUBLIC_ANCHORS = Object.freeze({
  0: 'Score 0 when the learner’s strongest turn remains only on the rival objective, reports boredom, assent, or refusal, or repeats a tutor’s already stated conclusion, without supplying a learner-authored condition or bounded proposition about the tutor-world objective.',
  1: 'Score 1 when the learner names a specific, checkable condition that the tutor-world public record would need to satisfy, but does not claim what any existing public item establishes. A sentence that both names a condition and applies existing evidence is rung 2.',
  2: 'Score 2 when the learner applies an existing public item to state a bounded proposition about the tutor-world objective, including a negative or limiting proposition such as supports X but not Y, or constructs a cross-world analogy that states the tutor-world item’s evidential consequence. Withholding the final conclusion or retaining the rival objective does not lower the rung. Near-verbatim repetition of a tutor’s already stated evidential conclusion does not qualify.',
});

const FACE_B_PUBLIC_ANCHORS = Object.freeze({
  0: 'Score 0 when the learner only repeats or rotates a standing objection or evidence demand and does not answer the offered local test on its own terms: no learner clause states what that test or public item would show, support, or rule out, and the learner neither takes nor applies a local test step.',
  1: 'Score 1 when the learner answers the offered local test propositionally, in its own words, by stating what it would show, support, or rule out, or by identifying a precise limitation on its evidential reach, while remaining conditional or demanding and not beginning, committing to, or applying the test. A standing refusal in the same sentence does not lower the rung. A near-verbatim tutor echo without an added evidential relation or limitation remains rung 0.',
  2: 'Score 2 when the learner actually begins, undertakes, or presently commits to the offered local public test, or applies an observed public result to a bounded conclusion, while the wider-frame reservation is explicit in the same turn or remains unretracted. A hypothetical, counterfactual, or demand that the tutor first produce the evidence is rung 1, not rung 2.',
});

const FACE_B_PLANT_ANCHORS = Object.freeze({
  0: 'Score 0 when the strongest learner contribution is semantically contained in a disclosed planted warrant node or prior tutor wording and the learner neither applies an observed public result nor begins or presently commits to the offered local test. Rewording, combining planted nodes, or adding a standing refusal does not raise the rung.',
  1: 'Score 1 when the learner supplies a concrete standing condition or evidential relation about the offered local test that is not semantically contained in any disclosed planted node or prior tutor wording, but remains conditional or demanding and does not apply a result or begin or commit to the test.',
  2: 'Score 2 when the learner begins, undertakes, or presently commits to the offered local public test, or applies an observed public result to a bounded conclusion, while the wider-frame reservation is explicit in the same turn or remains unretracted. Merely saying what a test could or would show is not rung 2.',
});

const FACE_A_PLANT_ANCHORS = Object.freeze({
  0: 'Score 0 when the strongest learner contribution is semantically contained in a disclosed rival node or prior tutor wording, remains only on the rival objective, or supplies no learner-authored tutor-world condition or bounded proposition.',
  1: 'Score 1 when the learner states a specific checkable tutor-world condition not semantically contained in a disclosed rival node or prior tutor wording, but does not apply an existing public item.',
  2: 'Score 2 when the learner applies an existing public tutor-world item to a bounded tutor-world proposition or constructs a cross-world bridge with an explicit tutor-world evidential consequence. Retaining the rival objective does not lower the rung.',
});

function mechanicalOriginScreen(publicPacket, openNodes) {
  const plants = openNodes.map((node) => ({ id: node.id, text: fold(node.task).toLowerCase() }));
  return Object.fromEntries(
    Object.entries(publicPacket)
      .filter(([sourceId]) => sourceId === 'trigger' || sourceId.startsWith('post_'))
      .map(([sourceId, text]) => {
        const normalized = fold(text).toLowerCase();
        const exactPlantIds = plants
          .filter(
            (plant) => normalized === plant.text || normalized.includes(plant.text) || plant.text.includes(normalized),
          )
          .map((plant) => plant.id);
        const priorTutorExact = Object.entries(publicPacket)
          .filter(([id]) => id === 'intervention' || id.startsWith('tutor_'))
          .some(([, tutorText]) => fold(tutorText).toLowerCase() === normalized);
        return [
          sourceId,
          {
            exact_plant_ids: exactPlantIds,
            exact_prior_tutor_turn: priorTutorExact,
            disposition:
              exactPlantIds.length > 0 || priorTutorExact ? 'mechanically_matched' : 'semantic_tie_break_required',
          },
        ];
      }),
  );
}

function candidateContract({ candidateId, faceId, openNodes, publicPacket, bridgeAccepted }) {
  if (candidateId === 'bridge_verdict_reuse' && faceId === 'faceB') {
    return {
      mode: 'rung2_only',
      visibility: 'public transcript only; enforcement verdict concealed from the readers',
      bridge_verdict_for_aggregation: bridgeAccepted ? 'accepted_quote_verified' : 'not_accepted',
      question:
        'Does the public transcript show the learner actually beginning, undertaking, or presently committing to the offered local test, or applying an observed public result to a bounded conclusion, while the wider-frame reservation remains explicit or unretracted? Merely stating conditionally what a test could show is rung2_no.',
    };
  }
  const publicAnchors = faceId === 'faceA' ? FACE_A_PUBLIC_ANCHORS : FACE_B_PUBLIC_ANCHORS;
  if (candidateId === 'transcript_only' || candidateId === 'bridge_verdict_reuse') {
    return {
      mode: 'exact_rung',
      visibility: 'public transcript only',
      anchors: publicAnchors,
      jurisdiction_rule:
        faceId === 'faceB'
          ? 'A standing refusal in the same turn is recorded in a separate jurisdiction field and does not lower engagement.'
          : 'Retained selective attention is separate from the engagement rung and does not lower a tutor-world proposition.',
    };
  }
  if (candidateId === 'plant_visible') {
    return {
      mode: 'exact_rung',
      visibility: 'public transcript plus disclosed planted node list; material change from V4',
      anchors: faceId === 'faceA' ? FACE_A_PLANT_ANCHORS : FACE_B_PLANT_ANCHORS,
      planted_nodes: openNodes.map(({ id, task }) => ({ id, task })),
    };
  }
  if (candidateId === 'mechanical_tiebreak') {
    return {
      mode: 'exact_rung',
      visibility:
        'public transcript plus planted nodes and deterministic exact-origin screen for semantic tie-break; material change from V4',
      anchors: faceId === 'faceA' ? FACE_A_PLANT_ANCHORS : FACE_B_PLANT_ANCHORS,
      deterministic_origin_screen: mechanicalOriginScreen(publicPacket, openNodes),
      planted_nodes: openNodes.map(({ id, task }) => ({ id, task })),
      tie_break_rule:
        'The mechanical screen certifies literal identity only. For semantic_tie_break_required spans, decide whether the contribution is plant-derived or transcript-new before applying the anchors. If that origin cannot be defended, return indeterminate.',
    };
  }
  throw new Error(`unknown replay candidate ${candidateId}`);
}

function oneEvent(events, predicate, label) {
  const matches = events.filter(predicate);
  if (matches.length !== 1) throw new Error(`expected one ${label}, found ${matches.length}`);
  return matches[0];
}

function groupBy(values, keyFor) {
  const grouped = new Map();
  for (const value of values) {
    const key = keyFor(value);
    const bucket = grouped.get(key) || [];
    bucket.push(value);
    grouped.set(key, bucket);
  }
  return grouped;
}

function loadReplayCases(runRoot) {
  const report = readJsonReadonly(path.join(runRoot, 'report.json'));
  const design = readJsonReadonly(path.join(ROOT, DESIGN_PATH));
  if (report?.execution?.source_commit !== '85bf3e76c97a509187c59b48a1febbda0be8a4d6') {
    throw new Error('replay requires the sealed V4 source commit');
  }
  if (design?.revision !== 4 || design?.attemptCeilings?.calibrationMaximumReservations !== 6912) {
    throw new Error('replay requires the sealed revision-4 design');
  }
  const rows = report.rows.filter((row) => row.status === 'complete');
  if (rows.length !== COMPLETED_DIALOGUES) throw new Error(`expected ${COMPLETED_DIALOGUES} complete rows`);
  const cases = rows.map((row) => {
    const jobRoot = path.join(runRoot, 'jobs', row.job.id);
    const transcriptPath = path.join(jobRoot, 'transcript.json');
    const dagPath = path.join(jobRoot, 'rival-learner-dag.json');
    const traceFile = tracePath(runRoot, row);
    const transcript = readJsonReadonly(transcriptPath);
    const rivalDag = readJsonReadonly(dagPath);
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
    const acceptedBridge = events.find(
      (event) => event.type === 'rival_dag_bridge_step_enforcement' && event.taken === true,
    );
    return {
      caseId: row.job.id,
      faceId: row.job.face_id,
      study: row.job.study,
      row,
      publicPacket,
      openNodes: rivalDag.openNodes,
      bridgeAccepted: Boolean(acceptedBridge),
      bridgeQuote: acceptedBridge?.quote || null,
      packetSha256: canonicalSha256(publicPacket),
      sourceSha256: sha256(
        Buffer.concat([readFileReadonly(transcriptPath), readFileReadonly(traceFile), readFileReadonly(dagPath)]),
      ),
    };
  });
  const counts = Object.fromEntries(
    ['faceA', 'faceB'].map((faceId) => [faceId, cases.filter((row) => row.faceId === faceId).length]),
  );
  if (counts.faceA !== 18 || counts.faceB !== 14)
    throw new Error(`completed face counts drifted: ${JSON.stringify(counts)}`);
  return { report, design, cases };
}

function buildReplayTask({ candidate, replayCase, repetition, seat }) {
  const contract = candidateContract({
    candidateId: candidate.id,
    faceId: replayCase.faceId,
    openNodes: replayCase.openNodes,
    publicPacket: replayCase.publicPacket,
    bridgeAccepted: replayCase.bridgeAccepted,
  });
  const bridgeMode = contract.mode === 'rung2_only';
  const evidenceRule = bridgeMode
    ? 'For rung2_yes copy at least one unique verbatim public learner quote; for rung2_no or indeterminate use null.'
    : 'For rung 1 or 2 copy at least one unique verbatim public learner quote; for rung 0 or indeterminate use null.';
  const prompt = {
    schema: 'machinespirits.tutor-stub.resistant-learner-v4-candidate-replay-prompt.v1',
    exploratory: true,
    registered: false,
    directional_stack_bounded: true,
    case_id: replayCase.caseId,
    face_id: replayCase.faceId,
    candidate_id: candidate.id,
    candidate_label: candidate.label,
    repetition,
    reader: seat,
    independence: {
      fresh_context: true,
      other_reader_output_visible: false,
      shared_notes: false,
      generator_analysis_visible: false,
    },
    instructions: [
      bridgeMode
        ? contract.question
        : 'Assign the highest defensible engagement rung reached anywhere in the fixed public horizon.',
      evidenceRule,
      'Use high or medium confidence for a determinate value. Use low confidence for indeterminate.',
    ],
    candidate_contract: contract,
    public_packet: replayCase.publicPacket,
    packet_sha256: replayCase.packetSha256,
  };
  return {
    candidate,
    replayCase,
    repetition,
    seat,
    bridgeMode,
    prompt,
    outputSchema: replayOutputSchema({
      caseId: replayCase.caseId,
      candidateId: candidate.id,
      repetition,
      faceId: replayCase.faceId,
      bridgeMode,
    }),
  };
}

function parseStructuredText(text) {
  const value = JSON.parse(String(text || '').trim());
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('reader returned no JSON object');
  return value;
}

function validateReplayOutput(task, output) {
  const expectedKeys = ['candidate_id', 'case_id', 'confidence', 'evidence_quotes', 'face_id', 'repetition', 'value'];
  const issues = [];
  if (JSON.stringify(Object.keys(output).sort()) !== JSON.stringify(expectedKeys)) issues.push('keys_not_exact');
  if (
    output.case_id !== task.replayCase.caseId ||
    output.candidate_id !== task.candidate.id ||
    output.face_id !== task.replayCase.faceId ||
    output.repetition !== task.repetition
  ) {
    issues.push('identity_mismatch');
  }
  const values = task.bridgeMode ? ['rung2_yes', 'rung2_no', 'indeterminate'] : ['0', '1', '2', 'indeterminate'];
  if (!values.includes(output.value)) issues.push('value_invalid');
  const determinate = output.value !== 'indeterminate';
  if (determinate ? !['high', 'medium'].includes(output.confidence) : output.confidence !== 'low') {
    issues.push('confidence_invalid');
  }
  const needsEvidence = task.bridgeMode ? output.value === 'rung2_yes' : ['1', '2'].includes(output.value);
  if (needsEvidence) {
    if (!Array.isArray(output.evidence_quotes) || output.evidence_quotes.length === 0) issues.push('evidence_missing');
    else if (!output.evidence_quotes.every((quote) => exactPublicQuote(task.replayCase.publicPacket, quote))) {
      issues.push('evidence_invalid');
    }
  } else if (output.evidence_quotes !== null) {
    issues.push('evidence_must_be_null');
  }
  return { valid: issues.length === 0 && determinate, issues };
}

function derivedRung(task, output) {
  if (!task.bridgeMode) return output.value;
  if (output.value === 'indeterminate') return 'indeterminate';
  if (output.value === 'rung2_yes') return '2';
  return task.replayCase.bridgeAccepted ? '1' : '0';
}

function createCallBudget({ ceiling = RESISTANT_LEARNER_V4_REPLAY_ATTEMPT_CEILING } = {}) {
  let attempts = 0;
  let completed = 0;
  let failed = 0;
  return {
    reserve() {
      if (attempts >= ceiling) throw new Error('candidate replay hard attempt ceiling exhausted before model call');
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
      systemPrompt: role.includes('_tie_audit_') ? TIE_SYSTEM_PROMPT : SYSTEM_PROMPT,
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
    return { attempt, error: error.message };
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

function summarizeRecords(records, { candidateId, repetition, faceId }) {
  const selected = records.filter(
    (record) => record.candidate_id === candidateId && record.repetition === repetition && record.face_id === faceId,
  );
  const byCase = groupBy(selected, (record) => record.case_id);
  const rows = [...byCase.entries()].map(([caseId, caseRecords]) => {
    const sol = caseRecords.find((record) => record.reader_id === 'reader_sol');
    const luna = caseRecords.find((record) => record.reader_id === 'reader_luna');
    const jointlyEligible = sol?.valid === true && luna?.valid === true;
    const exact = jointlyEligible && sol.derived_rung === luna.derived_rung;
    return {
      case_id: caseId,
      jointly_eligible: jointlyEligible,
      exact,
      determinate: exact,
      value: exact ? sol.derived_rung : 'indeterminate',
      reader_sol: sol?.derived_rung || 'missing',
      reader_luna: luna?.derived_rung || 'missing',
    };
  });
  const completed = faceId === 'faceA' ? 18 : 14;
  const seatMinimum = Math.max(8, Math.ceil(completed * 0.8));
  const jointMinimum = Math.max(8, Math.ceil(completed * 0.7));
  const eligibleSol = selected.filter((record) => record.reader_id === 'reader_sol' && record.valid).length;
  const eligibleLuna = selected.filter((record) => record.reader_id === 'reader_luna' && record.valid).length;
  const jointlyEligible = rows.filter((row) => row.jointly_eligible).length;
  const exact = rows.filter((row) => row.exact).length;
  const determinate = rows.filter((row) => row.determinate).length;
  const agreement = jointlyEligible ? exact / jointlyEligible : null;
  const determinateMinimum = Math.max(8, Math.ceil(completed * 0.8));
  return {
    candidate_id: candidateId,
    repetition,
    face_id: faceId,
    completed_rows: completed,
    reader_eligibility: { reader_sol: eligibleSol, reader_luna: eligibleLuna, required_per_seat: seatMinimum },
    jointly_eligible: jointlyEligible,
    jointly_eligible_required: jointMinimum,
    exact_agreements: exact,
    conditional_exact_agreement: agreement,
    conditional_exact_agreement_required: 0.8,
    determinate,
    determinate_required: determinateMinimum,
    determinate_rate: determinate / completed,
    rung_counts: Object.fromEntries(
      ['0', '1', '2'].map((rung) => [rung, rows.filter((row) => row.value === rung).length]),
    ),
    floors: {
      reader_eligibility: eligibleSol >= seatMinimum && eligibleLuna >= seatMinimum,
      jointly_eligible: jointlyEligible >= jointMinimum,
      exact_agreement: agreement !== null && agreement >= 0.8,
      determinacy: determinate >= determinateMinimum,
    },
    rows,
  };
}

export function buildReplayPlan({ runRoot = DEFAULT_RUN_ROOT, out = DEFAULT_OUT, repetitions = 2 } = {}) {
  if (!path.isAbsolute(runRoot) || !path.isAbsolute(out)) throw new Error('run root and out must be absolute paths');
  if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > MAX_REPETITIONS) {
    throw new Error(`repetitions must be 1..${MAX_REPETITIONS}`);
  }
  const loaded = loadReplayCases(runRoot);
  const tasks = [];
  for (let repetition = 1; repetition <= repetitions; repetition += 1) {
    for (const candidate of CANDIDATES) {
      for (const replayCase of loaded.cases) {
        for (const seat of READER_SEATS) tasks.push(buildReplayTask({ candidate, replayCase, repetition, seat }));
      }
    }
  }
  const maximumTieAudits = CANDIDATES.length * loaded.cases.length * repetitions;
  return {
    loaded,
    tasks,
    plan: {
      schema: 'machinespirits.tutor-stub.resistant-learner-v4-candidate-replay-plan.v1',
      status: 'planned_existing_text_adjudication_only',
      registered: false,
      study_or_calibration_launch: false,
      dialogue_generation: false,
      run_root: runRoot,
      run_root_access: 'read_only',
      out,
      out_create_once: true,
      repetitions,
      candidates: CANDIDATES,
      completed_dialogues: loaded.cases.length,
      completed_by_face: { faceA: 18, faceB: 14 },
      reader_seats: READER_SEATS,
      tie_auditor: TIE_AUDITOR,
      planned_reader_calls: tasks.length,
      maximum_reader_transport_retries: tasks.length,
      maximum_tie_audits: maximumTieAudits,
      hard_attempt_ceiling: tasks.length * 2 + maximumTieAudits,
      source_report_sha256: sha256(readFileReadonly(path.join(runRoot, 'report.json'))),
      sealed_design_sha256: sha256(readFileReadonly(path.join(ROOT, DESIGN_PATH))),
      packets: loaded.cases.map((row) => ({ case_id: row.caseId, packet_sha256: row.packetSha256 })),
      model_calls_executed: 0,
    },
  };
}

export async function executeReplay({ built, parallelism = 8, callBridge = callAIWithCliBridge } = {}) {
  const { out } = built.plan;
  if (fs.existsSync(out)) throw new Error('candidate replay destination is create-once');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.mkdirSync(out, { recursive: false });
  const ledgerPath = path.join(out, 'replay-ledger.jsonl');
  writeOnce(ledgerPath, '');
  writeOnce(path.join(out, 'replay-plan.json'), built.plan);
  const budget = createCallBudget({ ceiling: built.plan.hard_attempt_ceiling });
  appendJsonLine(ledgerPath, { at: new Date().toISOString(), type: 'replay_started', ...budget.status() });
  let progress = 0;
  const records = await mapConcurrent(built.tasks, parallelism, async (task) => {
    const role = `tutor_stub_resistant_learner_v4_candidate_${task.candidate.id}_${task.repetition}_${task.replayCase.caseId}_${task.seat.id}`;
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
        validation = validateReplayOutput(task, output);
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
    if (progress % 16 === 0 || progress === built.tasks.length) {
      process.stdout.write(
        `reader replay ${progress}/${built.tasks.length}; attempts ${budget.status().attempts}/${built.plan.hard_attempt_ceiling}\n`,
      );
    }
    const record = {
      case_id: task.replayCase.caseId,
      face_id: task.replayCase.faceId,
      candidate_id: task.candidate.id,
      repetition: task.repetition,
      reader_id: task.seat.id,
      model_ref: task.seat.modelRef,
      effort: task.seat.effort,
      attempt: call.attempt,
      call_attempts: call.calls.map((entry) => ({ attempt: entry.attempt, error: entry.error || null })),
      packet_sha256: task.replayCase.packetSha256,
      prompt_sha256: canonicalSha256(task.prompt),
      output,
      valid: validation.valid,
      issues: validation.issues,
      derived_rung: output ? derivedRung(task, output) : 'indeterminate',
      response_envelope: call.response || null,
      call_error: call.error || null,
    };
    appendJsonLine(ledgerPath, { at: new Date().toISOString(), type: 'reader_record', ...record });
    return record;
  });

  const grouped = groupBy(records, (record) => `${record.candidate_id}\0${record.repetition}\0${record.case_id}`);
  const disagreements = [...grouped.values()].filter((caseRecords) => {
    const sol = caseRecords.find((record) => record.reader_id === 'reader_sol');
    const luna = caseRecords.find((record) => record.reader_id === 'reader_luna');
    return sol?.valid && luna?.valid && sol.derived_rung !== luna.derived_rung;
  });
  let tieProgress = 0;
  const tieAudits = await mapConcurrent(disagreements, parallelism, async (caseRecords) => {
    const sol = caseRecords.find((record) => record.reader_id === 'reader_sol');
    const luna = caseRecords.find((record) => record.reader_id === 'reader_luna');
    const replayCase = built.loaded.cases.find((row) => row.caseId === sol.case_id);
    const candidate = CANDIDATES.find((row) => row.id === sol.candidate_id);
    const contract = candidateContract({
      candidateId: candidate.id,
      faceId: replayCase.faceId,
      openNodes: replayCase.openNodes,
      publicPacket: replayCase.publicPacket,
      bridgeAccepted: replayCase.bridgeAccepted,
    });
    const bridgeMode = contract.mode === 'rung2_only';
    const prompt = {
      schema: 'machinespirits.tutor-stub.resistant-learner-v4-candidate-tie-audit-prompt.v1',
      exploratory: true,
      registered: false,
      directional_stack_bounded: true,
      case_id: replayCase.caseId,
      candidate_id: candidate.id,
      repetition: sol.repetition,
      face_id: replayCase.faceId,
      candidate_contract: contract,
      public_packet: replayCase.publicPacket,
      blinded_reader_records: [
        {
          reader: 'seat_x',
          value: sol.output.value,
          confidence: sol.output.confidence,
          evidence_quotes: sol.output.evidence_quotes,
        },
        {
          reader: 'seat_y',
          value: luna.output.value,
          confidence: luna.output.confidence,
          evidence_quotes: luna.output.evidence_quotes,
        },
      ],
      instruction:
        'Audit the disagreement under the candidate contract. This audit is descriptive and does not alter exact agreement or determinacy.',
    };
    const call = await callFreshWithTechnicalRetry({
      prompt,
      outputSchema: tieOutputSchema({
        caseId: replayCase.caseId,
        candidateId: candidate.id,
        repetition: sol.repetition,
        faceId: replayCase.faceId,
        bridgeMode,
      }),
      seat: TIE_AUDITOR,
      role: `tutor_stub_resistant_learner_tie_audit_${candidate.id}_${sol.repetition}_${replayCase.caseId}`,
      budget,
      callBridge,
    });
    let output = null;
    let error = call.error || null;
    if (call.response) {
      try {
        output = parseStructuredText(call.response.text);
      } catch (parseError) {
        error = parseError.message;
      }
    }
    tieProgress += 1;
    if (tieProgress % 8 === 0 || tieProgress === disagreements.length) {
      process.stdout.write(
        `tie audit ${tieProgress}/${disagreements.length}; attempts ${budget.status().attempts}/${built.plan.hard_attempt_ceiling}\n`,
      );
    }
    const audit = {
      case_id: replayCase.caseId,
      face_id: replayCase.faceId,
      candidate_id: candidate.id,
      repetition: sol.repetition,
      model_ref: TIE_AUDITOR.modelRef,
      effort: TIE_AUDITOR.effort,
      attempt: call.attempt,
      call_attempts: call.calls.map((entry) => ({ attempt: entry.attempt, error: entry.error || null })),
      reader_values: { reader_sol: sol.derived_rung, reader_luna: luna.derived_rung },
      output,
      error,
      prompt_sha256: canonicalSha256(prompt),
    };
    appendJsonLine(ledgerPath, { at: new Date().toISOString(), type: 'tie_audit', ...audit });
    return audit;
  });

  const metrics = [];
  for (let repetition = 1; repetition <= built.plan.repetitions; repetition += 1) {
    for (const candidate of CANDIDATES) {
      for (const faceId of ['faceA', 'faceB']) {
        metrics.push(summarizeRecords(records, { candidateId: candidate.id, repetition, faceId }));
      }
    }
  }
  const report = {
    schema: 'machinespirits.tutor-stub.resistant-learner-v4-candidate-replay-report.v1',
    exploratory: true,
    registered: false,
    directional_stack_bounded: true,
    generated_at: new Date().toISOString(),
    source_run_root: built.plan.run_root,
    source_access: 'read_only',
    study_or_calibration_launched: false,
    dialogue_generated: false,
    models: { readers: READER_SEATS, tie_auditor: TIE_AUDITOR },
    repetitions: built.plan.repetitions,
    baseline: {
      faceA: { exact_agreement: 12 / 18, determinate: 12, determinate_floor: 15 },
      faceB: { exact_agreement: 5 / 11, determinate: 5, determinate_floor: 12 },
    },
    call_budget: budget.status(),
    reader_records: records,
    tie_audits: tieAudits,
    metrics,
  };
  writeOnce(path.join(out, 'replay-report.json'), report);
  appendJsonLine(ledgerPath, {
    at: new Date().toISOString(),
    type: 'replay_sealed',
    ...budget.status(),
    reader_records: records.length,
    tie_audits: tieAudits.length,
  });
  return report;
}

export async function main(argv = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: argv,
    options: {
      launch: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      'run-root': { type: 'string', default: DEFAULT_RUN_ROOT },
      out: { type: 'string', default: DEFAULT_OUT },
      repetitions: { type: 'string', default: '2' },
      parallelism: { type: 'string', default: '8' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  process.stdout.write(`${RESISTANT_LEARNER_V4_REPLAY_USAGE}\n`);
  if (values.help || (!values.launch && !values['dry-run'])) return;
  if (values.launch && values['dry-run']) throw new Error('choose exactly one of --launch or --dry-run');
  const repetitions = Number(values.repetitions);
  const parallelism = Number(values.parallelism);
  if (!Number.isInteger(parallelism) || parallelism < 1 || parallelism > 16) {
    throw new Error('parallelism must be 1..16');
  }
  const built = buildReplayPlan({ runRoot: values['run-root'], out: values.out, repetitions });
  if (fs.existsSync(built.plan.out)) throw new Error('candidate replay destination is create-once');
  if (values['dry-run']) {
    process.stdout.write(`${JSON.stringify(built.plan, null, 2)}\n`);
    return;
  }
  const report = await executeReplay({ built, parallelism });
  process.stdout.write(`${JSON.stringify({ call_budget: report.call_budget, metrics: report.metrics }, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}
