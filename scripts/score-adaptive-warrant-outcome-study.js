#!/usr/bin/env node

/**
 * Zero-call scorer for the registered adaptive-warrant outcome study.
 *
 * Authority:
 *   docs/adaptation-refinement/v3-outcome-study-registration.md section 4
 *   docs/adaptation-refinement/relay/055a-reviewer-note-three-pins-before-go.md
 *   docs/adaptation-refinement/relay/055b-reviewer-note-measure1-reader-output-form.md
 *   docs/adaptation-refinement/relay/057-reviewer-ruling-standing-permission-binding-open.md section 5
 *
 * This file never launches a child process or a model call. It contains only
 * the two binding-independent run templates and deterministic scoring helpers.
 */

import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  OUTCOME_STUDY_DEFAULT_LEARNER_PROFILE,
  OUTCOME_STUDY_SUPPORTED_LEARNER_PROFILES,
} from '../services/adaptiveWarrantOutcomeLearnerProfiles.js';

import { isUnhedgedOwnVoiceClaim } from './run-adaptive-warrant-baseline-study.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const ADAPTIVE_WARRANT_OUTCOME_SCORE_SCHEMA = 'machinespirits.adaptation-refinement.warrant-outcome-score.v1';

export const OUTCOME_STUDY_READER_OUTPUT_FORM =
  'Measure 1 reader output form: path 1. Each frozen binary decision reader reports commitment_transition_warranted (yes/no); the harness compares the logged observe-arm revision_warranted decision with two-reader consensus. The public world ground-truth source is the SHA-pinned world YAML projected into the decision packet public_inquiry_brief, and the same source is used in every condition.';

export const OUTCOME_STUDY_RUN_CONFIGURATIONS = Object.freeze([
  Object.freeze({
    id: 'bare',
    warrant_gate_mode: 'observe',
    horizon: 8,
    learner_profile: 'low_agency',
    learner_analysis_prompt_profile: 'handbook_v1',
    cli_args: Object.freeze(['--turns', '8', '--no-stop-on-grounded', '--warrant-gate', 'observe']),
  }),
  Object.freeze({
    id: 'gated',
    warrant_gate_mode: 'active',
    horizon: 8,
    learner_profile: 'low_agency',
    learner_analysis_prompt_profile: 'handbook_v1',
    cli_args: Object.freeze(['--turns', '8', '--no-stop-on-grounded', '--warrant-gate', 'active']),
  }),
  Object.freeze({
    id: 'steering_only',
    warrant_gate_mode: 'active',
    warrant_challenge_resistance: 'unselectable',
    horizon: 8,
    learner_profile: 'low_agency',
    learner_analysis_prompt_profile: 'handbook_v1',
    cli_args: Object.freeze([
      '--turns',
      '8',
      '--no-stop-on-grounded',
      '--warrant-gate',
      'active',
      '--warrant-challenge-resistance',
      'unselectable',
    ]),
  }),
  Object.freeze({
    id: 'standing_permission',
    warrant_gate_mode: 'observe',
    horizon: 8,
    learner_profile: 'low_agency',
    learner_analysis_prompt_profile: 'handbook_v1',
    standing_instructions_file: 'docs/adaptation-refinement/outcome-study-a1/standing-permission-menu.json',
    cli_args: Object.freeze([
      '--turns',
      '8',
      '--no-stop-on-grounded',
      '--warrant-gate',
      'observe',
      '--standing-instructions-file',
      'docs/adaptation-refinement/outcome-study-a1/standing-permission-menu.txt',
    ]),
  }),
]);

/**
 * The A1 study ran one learner pole. The guarded extension runs the opposite
 * pole through the same runners rather than forking them, so the profile is a
 * parameter and the frozen table above stays the A1 default. Asking for the
 * default returns the frozen objects themselves, not copies, so no A1 artifact
 * can move by way of this seam.
 */
export { OUTCOME_STUDY_DEFAULT_LEARNER_PROFILE, OUTCOME_STUDY_SUPPORTED_LEARNER_PROFILES };

export function resolveOutcomeStudyRunConfigurations(learnerProfile = OUTCOME_STUDY_DEFAULT_LEARNER_PROFILE) {
  const profile = learnerProfile || OUTCOME_STUDY_DEFAULT_LEARNER_PROFILE;
  if (!OUTCOME_STUDY_SUPPORTED_LEARNER_PROFILES.includes(profile)) {
    throw new Error(
      `unsupported outcome-study learner profile ${profile}; expected one of ${OUTCOME_STUDY_SUPPORTED_LEARNER_PROFILES.join(', ')}`,
    );
  }
  if (profile === OUTCOME_STUDY_DEFAULT_LEARNER_PROFILE) return OUTCOME_STUDY_RUN_CONFIGURATIONS;
  return Object.freeze(
    OUTCOME_STUDY_RUN_CONFIGURATIONS.map((configuration) =>
      Object.freeze({ ...configuration, learner_profile: profile }),
    ),
  );
}

export const PRESENCE_CHANNEL_DIGEST_FIELDS = Object.freeze([
  'corpus_sha256',
  'extraction_schema_digest',
  'provider_response_schema_sha256',
  'one_case_response_schema_sha256',
  'one_case_packet_sha256',
  'preparer_sha256',
  'reader_digest',
]);

export const PRESENCE_CHANNEL_CAPS = Object.freeze({ response_cap: 14000, packet_cap: 60000 });

export const DECISION_READER_INSTRUMENT_BINDINGS = Object.freeze({
  handbook_sha256: '5673c14b8f2a2b17c599e947c87f6d03c10df6dcdbeadcb257d882f008902003',
  preparation_and_assembly_sha256: '332447730054e13f02d6d8af0d5c4a58130254e08abf838b87237df62d14fb95',
  reader_runner_sha256: 'c0a201300a66e32919d22aaac42e431f32bd1df595b582f7762928a148c2e6ad',
});

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : null;
}

function fileSha256(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function requireBoolean(value, label) {
  if (typeof value !== 'boolean') throw new Error(`${label} must be boolean`);
  return value;
}

function decisionLabel(value, label) {
  if (value === true || value === 'yes') return 'yes';
  if (value === false || value === 'no') return 'no';
  if (value === 'uncertain') return 'uncertain';
  throw new Error(`${label} must be yes, no, uncertain, or boolean`);
}

function maxRun(values) {
  const lengths = [];
  let current = 0;
  for (const value of values) {
    if (value) current += 1;
    else if (current) {
      lengths.push(current);
      current = 0;
    }
  }
  if (current) lengths.push(current);
  return { streak_lengths: lengths, maximum_streak: lengths.length ? Math.max(...lengths) : 0 };
}

function exactMode(values) {
  const counts = new Map();
  for (const value of values) {
    const key = JSON.stringify(value);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const maximum_count = counts.size ? Math.max(...counts.values()) : 0;
  return {
    denominator: values.length,
    maximum_count,
    maximum_share: ratio(maximum_count, values.length),
    saturated: values.length > 0 && maximum_count / values.length > 0.9,
  };
}

export function preflightOutcomePresenceChannel({ expected, observed } = {}) {
  const checks = {};
  for (const field of PRESENCE_CHANNEL_DIGEST_FIELDS) {
    const expectedValue = expected?.[field];
    const observedValue = observed?.[field];
    checks[field] = {
      expected: expectedValue ?? null,
      observed: observedValue ?? null,
      pass:
        typeof expectedValue === 'string' && /^[a-f0-9]{64}$/u.test(expectedValue) && observedValue === expectedValue,
    };
  }
  for (const field of Object.keys(PRESENCE_CHANNEL_CAPS)) {
    checks[field] = {
      expected: PRESENCE_CHANNEL_CAPS[field],
      observed: observed?.[field] ?? null,
      pass: expected?.[field] === PRESENCE_CHANNEL_CAPS[field] && observed?.[field] === PRESENCE_CHANNEL_CAPS[field],
    };
  }
  return {
    schema: 'machinespirits.adaptation-refinement.warrant-outcome-presence-preflight.v1',
    zero_model_calls: true,
    required_digest_count: PRESENCE_CHANNEL_DIGEST_FIELDS.length,
    required_cap_count: Object.keys(PRESENCE_CHANNEL_CAPS).length,
    status: Object.values(checks).every((check) => check.pass) ? 'passed' : 'failed',
    checks,
  };
}

export function preflightOutcomeDecisionReader(observed = {}) {
  const checks = Object.fromEntries(
    Object.entries(DECISION_READER_INSTRUMENT_BINDINGS).map(([field, expected]) => [
      field,
      { expected, observed: observed?.[field] ?? null, pass: observed?.[field] === expected },
    ]),
  );
  return {
    schema: 'machinespirits.adaptation-refinement.warrant-outcome-decision-reader-preflight.v1',
    zero_model_calls: true,
    status: Object.values(checks).every((check) => check.pass) ? 'passed' : 'failed',
    checks,
  };
}

export function verifyOutcomeDecisionReaderRunEvidence(runRecordPath) {
  const checks = {
    run_record_present: false,
    run_record_readable: false,
    run_status_complete: false,
    batches_present: false,
    batch_identities_unique: false,
  };
  const result = {
    schema: 'machinespirits.adaptation-refinement.warrant-outcome-decision-reader-run-evidence.v1',
    zero_model_calls: true,
    run_record_path: typeof runRecordPath === 'string' && runRecordPath.trim() ? runRecordPath : null,
    status: 'failed',
    checks,
    batches: [],
  };
  if (!result.run_record_path) return result;

  const resolvedRunPath = path.resolve(ROOT, result.run_record_path);
  checks.run_record_present = fs.existsSync(resolvedRunPath);
  if (!checks.run_record_present) return result;

  let run;
  try {
    run = JSON.parse(fs.readFileSync(resolvedRunPath, 'utf8'));
    checks.run_record_readable = true;
  } catch (error) {
    result.error = error.message;
    return result;
  }

  checks.run_status_complete = run?.status === 'complete';
  checks.batches_present = Array.isArray(run?.batches) && run.batches.length > 0;
  if (!checks.batches_present) return result;

  const identities = new Set();
  let duplicateIdentity = false;
  result.batches = run.batches.map((batch, index) => {
    const identity = `${batch?.reader_id ?? ''}:${batch?.batch_id ?? ''}`;
    const identityPresent = Boolean(batch?.reader_id?.trim?.() && batch?.batch_id?.trim?.());
    if (identities.has(identity)) duplicateIdentity = true;
    identities.add(identity);
    const responsePath =
      typeof batch?.response_path === 'string' && batch.response_path.trim()
        ? path.resolve(path.dirname(resolvedRunPath), batch.response_path)
        : null;
    const responsePresent = Boolean(responsePath && fs.existsSync(responsePath));
    const declaredHashValid = /^[a-f0-9]{64}$/u.test(batch?.response_sha256 || '');
    let observedHash = null;
    let responseHashMatch = false;
    if (responsePresent) {
      try {
        observedHash = fileSha256(responsePath);
        responseHashMatch = declaredHashValid && observedHash === batch.response_sha256;
      } catch {
        responseHashMatch = false;
      }
    }
    const prohibitedToolCountPresent =
      Object.hasOwn(batch || {}, 'prohibited_tool_event_count') && Number.isFinite(batch.prohibited_tool_event_count);
    const registeredModelParts = String(run?.model || '').split('.');
    const modelAttestationAccepted =
      batch?.model_independently_attested === true ||
      (batch?.model_attestation_basis === 'explicit_cli_model_argument_accepted_bridge_echo' &&
        batch?.returned_provider === registeredModelParts[0] &&
        batch?.returned_model === registeredModelParts.slice(1).join('.') &&
        batch?.model_independently_attested === false);
    const batchChecks = {
      identity_present: identityPresent,
      status_complete: batch?.status === 'complete',
      response_present: responsePresent,
      response_hash_declared: declaredHashValid,
      response_hash_match: responseHashMatch,
      model_attestation_accepted: modelAttestationAccepted,
      prohibited_tool_count_present: prohibitedToolCountPresent,
      prohibited_tool_count_zero: prohibitedToolCountPresent && batch.prohibited_tool_event_count === 0,
    };
    return {
      index,
      reader_id: batch?.reader_id ?? null,
      batch_id: batch?.batch_id ?? null,
      response_path: responsePath,
      expected_response_sha256: batch?.response_sha256 ?? null,
      observed_response_sha256: observedHash,
      status: Object.values(batchChecks).every(Boolean) ? 'passed' : 'failed',
      checks: batchChecks,
    };
  });
  checks.batch_identities_unique = !duplicateIdentity;
  result.status =
    Object.values(checks).every(Boolean) && result.batches.every((batch) => batch.status === 'passed')
      ? 'passed'
      : 'failed';
  return result;
}

export function guardVerbatimPromptBindings(bindings = []) {
  const rows = bindings.map((row) => ({
    source: row.source,
    expected: row.expected,
    observed: row.observed,
    pass: typeof row.expected === 'string' && row.observed === row.expected,
  }));
  return {
    status: rows.length > 0 && rows.every((row) => row.pass) ? 'passed' : 'failed',
    rows,
  };
}

export function guardNoPoolingFingerprints({ candidates = [], excluded = [] } = {}) {
  const excludedSet = new Set(excluded);
  const duplicates = candidates.filter((fingerprint, index) => candidates.indexOf(fingerprint) !== index);
  const overlaps = candidates.filter((fingerprint) => excludedSet.has(fingerprint));
  return {
    status: duplicates.length === 0 && overlaps.length === 0 ? 'passed' : 'failed',
    candidate_count: candidates.length,
    excluded_count: excluded.length,
    duplicates: [...new Set(duplicates)].sort(),
    overlaps: [...new Set(overlaps)].sort(),
  };
}

export function scoreOutcomeDecisionCases(cases = [], decisionReaderRunRecordPath) {
  const runEvidence = verifyOutcomeDecisionReaderRunEvidence(decisionReaderRunRecordPath);
  if (runEvidence.status !== 'passed') throw new Error('decision-reader run evidence failed closed');
  const scored = [];
  let nonConsensus = 0;
  for (const row of cases) {
    const left = decisionLabel(row.reader_a_decision, `${row.sample_id}:reader_a_decision`);
    const right = decisionLabel(row.reader_b_decision, `${row.sample_id}:reader_b_decision`);
    if (left !== right || left === 'uncertain') {
      nonConsensus += 1;
      continue;
    }
    const logged = decisionLabel(row.logged_observe_decision, `${row.sample_id}:logged_observe_decision`);
    scored.push({
      sample_id: row.sample_id,
      dialogue_id: row.dialogue_id,
      turn: row.turn,
      condition: row.condition,
      reader_consensus_decision: left,
      logged_observe_decision: logged,
      correct: logged === left,
    });
  }
  const correct = scored.filter((row) => row.correct).length;
  return {
    reader_output_form: OUTCOME_STUDY_READER_OUTPUT_FORM,
    decision_reader_run_evidence: runEvidence,
    total_cases: cases.length,
    consensus_cases: scored.length,
    non_consensus_cases: nonConsensus,
    correct,
    correctness_rate: ratio(correct, scored.length),
    cases: scored,
  };
}

function normalizeOutcomeTurn(row) {
  const gate = row.warrant_gate_decision || row.warrantGateDecision || null;
  const learnerSignal = row.learner_signal || gate?.learner_signal || null;
  const actionFamily =
    row.actual_action_family ||
    row.delivered_action_family ||
    row.deliveredResponseConfiguration?.action_family ||
    row.responseConfiguration?.action_family ||
    row.preFinalWarrantSelection?.action_family ||
    null;
  const closure = row.dialogue_closure || row.dialogueClosure || null;
  return {
    turn: Number(row.turn),
    learner_text: row.learner_text ?? row.learner ?? '',
    deference: requireBoolean(
      row.deference ?? learnerSignal?.deference_present,
      `turn ${row.turn}: deterministic compiler deference`,
    ),
    dag_total: Number(row.dag_total ?? row.stateObservation?.dag?.grounded_count),
    actual_action_family: actionFamily,
    typed_warrant_supported:
      row.typed_warrant_supported ??
      Boolean(gate?.revision_warranted && gate?.policy?.family === 'challenge_resistance'),
    closure_audit_ok: row.closure_audit_ok ?? closure?.audit?.ok ?? true,
    closes_dialogue: row.closes_dialogue ?? closure?.audit?.closesDialogue ?? false,
    closure_available: row.closure_available ?? closure?.frame?.available ?? false,
  };
}

// dropped_turns: turn numbers a committed reviewer ruling removed from the corpus
// (ruling 002, docs/adaptation-refinement/guarded-main-block/reviewer-ruling-002-
// unread-turn-measure-series.json). A dropped turn was never read, so it carries no
// validated learner signal and must leave every per-turn measure series entirely.
export function extractOutcomeDialogueFromTraceRows({ dialogue_id, condition, rows, dropped_turns = [] } = {}) {
  if (!['bare', 'gated', 'steering_only', 'standing_permission'].includes(condition)) {
    throw new Error(`unsupported outcome condition: ${condition}`);
  }
  const dropped = new Set((dropped_turns || []).map(Number));
  const turns = (rows || [])
    .filter((row) => row?.type === 'turn_complete' && row.turnRecord)
    .filter((row) => !dropped.has(Number(row.turnRecord.turn)))
    .map((row) => normalizeOutcomeTurn(row.turnRecord))
    .sort((left, right) => left.turn - right.turn);
  if (!turns.length) throw new Error(`${dialogue_id}: no turn_complete rows`);
  return { dialogue_id, condition, turns, dropped_turns: [...dropped].sort((a, b) => a - b) };
}

export function scoreOutcomeDialogue(dialogue) {
  const dropped = new Set((dialogue.dropped_turns || []).map(Number));
  const turns = [...(dialogue.turns || [])]
    .filter((row) => !dropped.has(Number(row.turn)))
    .map(normalizeOutcomeTurn)
    .sort((a, b) => a.turn - b.turn);
  if (!turns.length) throw new Error(`${dialogue.dialogue_id}: no turns`);
  const challengeTurns = turns.filter((row) => row.actual_action_family === 'challenge_resistance');
  const warrantedChallenges = challengeTurns.filter((row) => row.typed_warrant_supported);
  const deference = maxRun(turns.map((row) => row.deference));
  const ownVoice = turns.map((row) => isUnhedgedOwnVoiceClaim(row.learner_text));
  const breakIndex = ownVoice.findIndex(Boolean);
  const breakTurn = breakIndex < 0 ? null : turns[breakIndex].turn;
  const breakPersists = breakIndex < 0 ? false : ownVoice.slice(breakIndex).every(Boolean);
  const dagAtBreak = breakIndex < 0 ? null : turns[breakIndex].dag_total;
  const finalDag = turns.at(-1).dag_total;
  const recordGrowthAfterBreak =
    breakIndex < 0 || !Number.isFinite(dagAtBreak) || !Number.isFinite(finalDag) ? null : finalDag > dagAtBreak;
  const illegitimateClosures = turns.filter(
    (row) => row.closure_audit_ok !== true || (row.closes_dialogue && !row.closure_available),
  );
  return {
    dialogue_id: dialogue.dialogue_id,
    condition: dialogue.condition,
    turn_count: turns.length,
    ruled_dropped_turns: [...dropped].sort((a, b) => a - b),
    measure_2_warranted_challenge_rate: {
      warranted_challenge_turns: warrantedChallenges.length,
      challenge_turns: challengeTurns.length,
      decision_turns: turns.length,
      rate: warrantedChallenges.length / turns.length,
    },
    measure_3_sustained_deference: deference,
    measure_4_deference_break: { first_turn: breakTurn, persists_to_end: breakPersists },
    measure_5_record_growth_after_break: {
      observed: recordGrowthAfterBreak,
      dag_at_break: dagAtBreak,
      final_dag_total: Number.isFinite(finalDag) ? finalDag : null,
    },
    measure_6_closure_legitimacy: {
      legitimate: illegitimateClosures.length === 0,
      illegitimate_turns: illegitimateClosures.map((row) => row.turn),
    },
  };
}

export function scoreOutcomePresenceCases(cases = []) {
  const consensus = [];
  let inadmissible = 0;
  let nonConsensus = 0;
  for (const row of cases) {
    if (row.admissible_pair !== true) {
      inadmissible += 1;
      continue;
    }
    if (row.presence_grain_consensus !== true) {
      nonConsensus += 1;
      continue;
    }
    const presence = row.reader_a_presence || row.consensus_presence;
    if (typeof presence?.result_request !== 'boolean' || typeof presence?.proposed_test !== 'boolean') {
      inadmissible += 1;
      continue;
    }
    consensus.push({
      sample_id: row.sample_id,
      dialogue_id: row.dialogue_id,
      condition: row.condition,
      result_request: presence.result_request,
      proposed_test: presence.proposed_test,
    });
  }
  return {
    total_cases: cases.length,
    consensus_cases: consensus.length,
    non_consensus_cases: nonConsensus,
    inadmissible_cases: inadmissible,
    result_request_presence_rate: ratio(consensus.filter((row) => row.result_request).length, consensus.length),
    proposed_test_presence_rate: ratio(consensus.filter((row) => row.proposed_test).length, consensus.length),
    cases: consensus,
  };
}

export function assessOutcomePilotSaturation({ dialogueScores = [], presenceScore } = {}) {
  const presenceCases = presenceScore?.cases || [];
  return {
    denominator_rule: {
      measures_2_4: 'dialogues pooled across conditions',
      measures_7_8: 'consensus cases pooled across conditions; non-consensus and inadmissible cases excluded',
    },
    measure_2: exactMode(dialogueScores.map((row) => row.measure_2_warranted_challenge_rate.rate)),
    measure_3: exactMode(dialogueScores.map((row) => row.measure_3_sustained_deference.maximum_streak)),
    measure_4: exactMode(
      dialogueScores.map((row) => [
        row.measure_4_deference_break.first_turn,
        row.measure_4_deference_break.persists_to_end,
      ]),
    ),
    measure_7: exactMode(presenceCases.map((row) => row.result_request)),
    measure_8: exactMode(presenceCases.map((row) => row.proposed_test)),
  };
}

function generationTimeSemanticEvents(row) {
  return (
    row?.gate?.semantic_event_extraction?.events ||
    row?.shadow?.semantic_event_extraction?.events ||
    row?.semantic_event_extraction?.events ||
    []
  );
}

export function describeOutcomeMeasures7And8FromStoredEvents(cases = []) {
  const rows = cases.map((row) => {
    const acts = new Set(
      generationTimeSemanticEvents(row)
        .map((event) => event?.speech_act)
        .filter(Boolean),
    );
    return {
      sample_id: row.sample_id,
      dialogue_id: row.job_id ?? row.dialogue_id ?? null,
      turn: Number(row.turn),
      condition: row.condition,
      measure_7_result_request: acts.has('tutor_directed_public_result_request'),
      measure_8_proposed_test: acts.has('learner_proposed_test'),
    };
  });
  const conditions = [...new Set(rows.map((row) => row.condition))].sort();
  const summarize = (conditionRows, field) => {
    const present = conditionRows.filter((row) => row[field]).length;
    return { present, total: conditionRows.length, rate: ratio(present, conditionRows.length) };
  };
  return {
    inferential_role: 'report_only',
    validation_label: 'not reader-validated',
    source: 'stored_generation_time_semantic_events',
    zero_model_calls: true,
    total_cases: rows.length,
    measure_7_result_requests: {
      overall: summarize(rows, 'measure_7_result_request'),
      by_condition: Object.fromEntries(
        conditions.map((condition) => [
          condition,
          summarize(
            rows.filter((row) => row.condition === condition),
            'measure_7_result_request',
          ),
        ]),
      ),
    },
    measure_8_proposed_tests: {
      overall: summarize(rows, 'measure_8_proposed_test'),
      by_condition: Object.fromEntries(
        conditions.map((condition) => [
          condition,
          summarize(
            rows.filter((row) => row.condition === condition),
            'measure_8_proposed_test',
          ),
        ]),
      ),
    },
    cases: rows,
  };
}

export function scoreAdaptiveWarrantOutcomeMainBlock(input = {}) {
  const decisionPreflight = preflightOutcomeDecisionReader(input.decision_reader_preflight);
  if (decisionPreflight.status !== 'passed') throw new Error('decision-reader instrument digest preflight failed');
  const dialogueScores = (input.dialogues || []).map(scoreOutcomeDialogue);
  const decisionScore = scoreOutcomeDecisionCases(input.decision_cases || [], input.decision_reader_run_record_path);
  const descriptive = describeOutcomeMeasures7And8FromStoredEvents(input.generation_time_cases || []);
  return {
    schema: 'machinespirits.adaptation-refinement.warrant-outcome-main-block-score.v1',
    zero_model_calls: true,
    conditions_scored: [...new Set(dialogueScores.map((row) => row.condition))].sort(),
    reader_output_form: OUTCOME_STUDY_READER_OUTPUT_FORM,
    channels_fielded: { decision: true, presence: false },
    decision_reader_preflight: decisionPreflight,
    measure_1_decision_correctness: decisionScore,
    dialogue_measures_2_6: dialogueScores,
    descriptive_measures_7_8: descriptive,
  };
}

export function scoreAdaptiveWarrantSteeringDecomposition(input = {}) {
  const score = scoreAdaptiveWarrantOutcomeMainBlock(input);
  return {
    ...score,
    schema: 'machinespirits.adaptation-refinement.warrant-steering-decomposition-score.v1',
    conditions: ['gated', 'steering_only'],
  };
}

export function scoreAdaptiveWarrantOutcomeStudy(input = {}) {
  const preflight = preflightOutcomePresenceChannel(input.presence_preflight);
  if (preflight.status !== 'passed') throw new Error('presence-channel digest preflight failed');
  const decisionPreflight = preflightOutcomeDecisionReader(input.decision_reader_preflight);
  if (decisionPreflight.status !== 'passed') throw new Error('decision-reader instrument digest preflight failed');
  const dialogueScores = (input.dialogues || []).map(scoreOutcomeDialogue);
  const decisionScore = scoreOutcomeDecisionCases(input.decision_cases || [], input.decision_reader_run_record_path);
  const presenceScore = scoreOutcomePresenceCases(input.presence_cases || []);
  return {
    schema: ADAPTIVE_WARRANT_OUTCOME_SCORE_SCHEMA,
    zero_model_calls: true,
    conditions_scored: [...new Set(dialogueScores.map((row) => row.condition))].sort(),
    reader_output_form: OUTCOME_STUDY_READER_OUTPUT_FORM,
    decision_reader_preflight: decisionPreflight,
    presence_preflight: preflight,
    measure_1_decision_correctness: decisionScore,
    dialogue_measures_2_6: dialogueScores,
    presence_measures_7_8: presenceScore,
    pilot_saturation: assessOutcomePilotSaturation({ dialogueScores, presenceScore }),
  };
}

function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--input') {
    throw new Error(
      'Usage: node scripts/score-adaptive-warrant-outcome-study.js --input <prepared-zero-call-input.json>',
    );
  }
  const input = JSON.parse(fs.readFileSync(path.resolve(ROOT, args[1]), 'utf8'));
  process.stdout.write(`${JSON.stringify(scoreAdaptiveWarrantOutcomeStudy(input), null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`[outcome-study-scorer] ${error.message}`);
    process.exitCode = 1;
  }
}
