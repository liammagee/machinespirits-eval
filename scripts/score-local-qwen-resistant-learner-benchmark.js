#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  buildBatchedPerTurnTutorPrompt,
  buildDialogueQualityPrompt,
  calculateDialogueQualityScore,
  calculateOverallScore,
  getDialogueDimensions,
  loadDialogueRubric,
} from '../services/rubricEvaluator.js';
import {
  buildBatchedLearnerPrompt,
  calculateLearnerOverallScore,
  getLearnerDimensions,
  loadLearnerRubric,
} from '../services/learnerRubricEvaluator.js';
import { getRubricDimensions, loadRubric } from '../services/evalConfigLoader.js';
import { callAIWithCliBridge } from '../services/cliProviderBridge.js';

export const LOCAL_QWEN_BENCHMARK_SCHEMA = 'machinespirits.local-qwen-resistant-learner-benchmark.v1';
export const BENCHMARK_JUDGE = Object.freeze({ provider: 'claude-code', model: 'claude-opus-5', effort: 'medium' });
const JUDGE = BENCHMARK_JUDGE;
const MAX_JUDGE_CALLS = 8;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHARACTER_BRIEF = `Tamsin is the assay-master's apprentice and keeper of the Marrick trial-book. She wrote the town's expected verdict against Verrell before the assay and now protects her reputation by finding holes in every inference. She respects a test that defeats her specific objection but wants to discover the next weakness herself. Offer a concrete rival explanation compatible with public evidence; concede the exact defeated local point, then test a different weak edge. Keep working with the assay and trial-book: resistance is inquiry, not refusal to participate. Tone: plainspoken, clipped, observant, dryly skeptical, at most three sentences. Avoid repeated answered objections, invented unseen evidence, generic contrariness, demands for the answer, contemporary technical jargon, and roleplay commentary.`;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function median(values) {
  const rows = values.filter(Number.isFinite).toSorted((a, b) => a - b);
  if (!rows.length) return null;
  const middle = Math.floor(rows.length / 2);
  return rows.length % 2 ? rows[middle] : (rows[middle - 1] + rows[middle]) / 2;
}

function words(text) {
  return (
    String(text || '')
      .toLowerCase()
      .match(/[a-z0-9]+/gu) || []
  );
}

function ngrams(text, size = 2) {
  const tokens = words(text);
  const rows = [];
  for (let index = 0; index <= tokens.length - size; index += 1) rows.push(tokens.slice(index, index + size).join(' '));
  return rows;
}

function jaccard(left, right) {
  const a = new Set(left);
  const b = new Set(right);
  const union = new Set([...a, ...b]);
  if (!union.size) return 1;
  let overlap = 0;
  for (const item of a) if (b.has(item)) overlap += 1;
  return overlap / union.size;
}

export function repetitionMetrics(turns) {
  const learner = turns.map((turn) => String(turn.learner || ''));
  const perTurn = learner.map((text, index) => {
    const current = ngrams(text);
    const prior = learner.slice(0, index).map((candidate) => jaccard(current, ngrams(candidate)));
    const maxPriorSimilarity = prior.length ? Math.max(...prior) : 0;
    return {
      turn: index + 1,
      wordCount: words(text).length,
      maxPriorBigramJaccard: Number(maxPriorSimilarity.toFixed(4)),
      lexicalSurprise: Number((1 - maxPriorSimilarity).toFixed(4)),
    };
  });
  const allBigrams = learner.flatMap((text) => ngrams(text));
  return {
    perTurn,
    meanLexicalSurpriseAfterOpening: Number(
      (perTurn.slice(1).reduce((sum, row) => sum + row.lexicalSurprise, 0) / Math.max(1, perTurn.length - 1)).toFixed(
        4,
      ),
    ),
    distinct2: Number((new Set(allBigrams).size / Math.max(1, allBigrams.length)).toFixed(4)),
  };
}

function publicTranscript(snapshot, opening = '') {
  const lines = opening ? [`Tutor opening: ${opening}`, ''] : [];
  for (const turn of snapshot.turns || []) {
    lines.push(`Turn ${turn.turn}`, `Learner: ${turn.learner}`, `Tutor: ${turn.tutor}`, '');
  }
  return lines.join('\n').trim();
}

function traceEvents(snapshotPath, snapshot) {
  const trace = String(snapshot.trace || '');
  const tracePath = path.isAbsolute(trace) ? trace : path.resolve(ROOT, trace);
  if (!trace || !fs.existsSync(tracePath)) throw new Error(`missing technical trace for ${snapshotPath}: ${tracePath}`);
  return fs
    .readFileSync(tracePath, 'utf8')
    .trim()
    .split(/\r?\n/gu)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function mean(values) {
  const rows = values.filter(Number.isFinite);
  return rows.length ? rows.reduce((sum, value) => sum + value, 0) / rows.length : null;
}

export function technicalMetrics(events) {
  const learnerCalls = events.filter(
    (event) => event.type === 'model_call' && event.role === 'tutor_stub_auto_learner',
  );
  const tutorCalls = events.filter((event) => event.type === 'model_call' && event.role === 'tutor_stub_tutor');
  const revisions = events.filter(
    (event) => event.type === 'model_call' && event.role === 'tutor_stub_auto_learner_revision',
  );
  const reviews = events.filter(
    (event) => event.type === 'model_call' && event.role === 'tutor_stub_auto_learner_superego',
  );
  const tutorRevisions = events.filter(
    (event) => event.type === 'model_call' && event.role === 'tutor_stub_tutor_revision',
  );
  const tutorReviews = events.filter(
    (event) => event.type === 'model_call' && event.role === 'tutor_stub_tutor_superego',
  );
  const summarize = (calls) => {
    const rows = calls.map((call) => ({
      turn: call.turn,
      latencyMs: Number(call.response?.latencyMs),
      inputTokens: Number(call.response?.usage?.inputTokens || 0),
      outputTokens: Number(call.response?.usage?.outputTokens || 0),
    }));
    return {
      calls: rows.length,
      rows,
      medianLatencyMs: median(rows.map((row) => row.latencyMs)),
      totalLatencyMs: rows.reduce((sum, row) => sum + (row.latencyMs || 0), 0),
      totalInputTokens: rows.reduce((sum, row) => sum + row.inputTokens, 0),
      totalOutputTokens: rows.reduce((sum, row) => sum + row.outputTokens, 0),
      meanEndToEndOutputTokensPerSecond: mean(
        rows.map((row) => (row.latencyMs > 0 ? row.outputTokens / (row.latencyMs / 1000) : null)),
      ),
    };
  };
  const guardFindings = new Map();
  for (const event of events.filter((row) => row.type === 'turn_failure_recorded')) {
    guardFindings.set(event.turn, [...new Set(event.failureModes || [])]);
  }
  const mechanism = (initial, revised, reviewed) => {
    const rows = [...new Set(initial.map((call) => call.turn))].map((turn) => ({
      turn,
      latencyMs: [...initial, ...revised, ...reviewed]
        .filter((call) => call.turn === turn)
        .reduce((sum, call) => sum + Number(call.response?.latencyMs || 0), 0),
    }));
    return {
      rows,
      calls: initial.length + revised.length + reviewed.length,
      totalLatencyMs: rows.reduce((sum, row) => sum + row.latencyMs, 0),
      medianLatencyMs: median(rows.map((row) => row.latencyMs)),
    };
  };
  const finals = (initial, revised) => [...new Map([...initial, ...revised].map((call) => [call.turn, call])).values()];
  return {
    learner: summarize(learnerCalls),
    learnerRevision: summarize(revisions),
    learnerSuperego: summarize(reviews),
    learnerFinal: summarize(finals(learnerCalls, revisions)),
    learnerMechanism: mechanism(learnerCalls, revisions, reviews),
    tutor: summarize(tutorCalls),
    tutorRevision: summarize(tutorRevisions),
    tutorSuperego: summarize(tutorReviews),
    tutorFinal: summarize(finals(tutorCalls, tutorRevisions)),
    tutorMechanism: mechanism(tutorCalls, tutorRevisions, tutorReviews),
    modelCallErrors: events.filter((event) => /model.*(?:error|fail)/iu.test(String(event.type || ''))).length,
    promptAuditRecoveries: events.filter((event) => event.type === 'prompt_audit_recovery').length,
    guardFindings: [...guardFindings].map(([turn, modes]) => ({ turn, modes })).sort((a, b) => a.turn - b.turn),
    guardedTutorTurns: [...guardFindings.values()].filter((modes) => modes.length).length,
  };
}

function reconstructedTurns(snapshot, opening = '') {
  const turns = (snapshot.turns || []).flatMap((turn) => [
    { phase: 'learner', turnNumber: turn.turn, externalMessage: turn.learner },
    { phase: 'tutor', turnNumber: turn.turn, externalMessage: turn.tutor },
  ]);
  return opening ? [{ phase: 'tutor', turnNumber: 0, externalMessage: opening }, ...turns] : turns;
}

function tutorPrompt(snapshot, transcript, context = {}) {
  return (
    buildBatchedPerTurnTutorPrompt({
      turnResults: snapshot.turns.map((turn) => ({
        turnId: `turn-${turn.turn}`,
        suggestions: [{ message: turn.tutor }],
        learnerMessage: turn.learner,
      })),
      scenario: {
        name: context.scenarioName || 'The Light Shillings',
        description: context.scenarioDescription || 'A Marrick assay inquiry into who struck false shillings.',
        expectedBehavior:
          context.expectedBehavior || 'Help an active resistant learner test rival explanations using public evidence.',
        learnerContext:
          context.characterBrief ||
          'Tamsin is a counterexample-hunting apprentice who concedes defeated objections and tests the next weak edge.',
        requiredElements: [],
        forbiddenElements: [],
      },
      transcriptArtifacts: { public: transcript },
    }) +
    `\n\nINDEX CONTRACT: turn_index is zero-based: return exactly ${snapshot.turns.map((_, index) => index).join(', ')} in order. Public Turn 1 maps to turn_index 0. Do not score the fixed opening.`
  );
}

function learnerPrompt(snapshot, opening, context = {}) {
  const turns = reconstructedTurns(snapshot, opening);
  const learnerOffset = opening ? 1 : 0;
  return (
    buildBatchedLearnerPrompt({
      turns,
      learnerTurnTargets: snapshot.turns.map((_, index) => ({ lt: index, targetIdx: learnerOffset + index * 2 })),
      personaId: context.profileId || 'counterexample_hunter',
      personaDescription: context.characterBrief || CHARACTER_BRIEF,
      learnerArchitecture: 'unified',
      scenarioName: context.scenarioName || 'The Light Shillings',
      topic: context.topic || 'Public evidence and warrant testing in a coin assay',
    }) +
    `\n\nINDEX CONTRACT: learner_turn_index is zero-based: return exactly ${snapshot.turns.map((_, index) => index).join(', ')} in order. The displayed Learner Turn 1 maps to learner_turn_index 0. Do not use dialogue-position numbers.`
  );
}

function qualityPrompt(transcript, { extendedQuality = false, assessmentContext = null } = {}) {
  if (assessmentContext) {
    const learnerAnnotation = {
      turn: 1,
      new_move: 'Describe the actual move',
      semantic_repeat_of: null,
      character_fidelity: 1,
      ...(extendedQuality
        ? {
            new_move_is_substantive: false,
            unsupported_evidence_assertion: false,
            accepted_objection_reopened: false,
            evidence_reasoning: 'Public support and interpretation',
          }
        : {}),
    };
    const schema = {
      scores: Object.fromEntries(
        ['overall_quality', 'successful_pedagogy', 'surprise_nonrepetition', 'character_adherence'].map((key) => [
          key,
          { score: 1, reasoning: '...' },
        ]),
      ),
      learner_turns: [learnerAnnotation],
      ...(extendedQuality
        ? {
            tutor_turns: [
              {
                turn: 1,
                unsupported_evidence_assertion: false,
                evidence_reasoning: 'Public support and interpretation',
              },
            ],
            measurement_indeterminate: false,
            indeterminate_reason: '',
          }
        : {}),
      strengths: [],
      limitations: [],
      overall_assessment: '...',
    };
    return `You are an independent evaluator of one synthetic tutoring transcript. Model identities are hidden. Use only the public transcript and assigned character below.\n\nASSIGNED CHARACTER\n${assessmentContext.characterBrief}\n\nASSESSMENT RULES\n${assessmentContext.qualityInstructions}\nScore overall_quality, successful_pedagogy, surprise_nonrepetition, and character_adherence from 1 (fails) to 5 (excellent), with reasoning. Semantic repetition is the same conversational move with fresh wording; a substantively different response to the latest tutor turn is not repetition merely because refusal persists.\n\nReturn JSON only, using every field in this schema:\n${JSON.stringify(schema)}\n\nReplace example arrays with exactly one entry for EACH of the eight numbered learner turns and EACH of the eight numbered tutor turns; use turn numbers 1 through 8. Do not score the fixed opening. semantic_repeat_of is null or an earlier learner turn. For EVERY learner entry return all listed fields, including accepted_objection_reopened. A substantive move must change the interaction, disputed boundary or practical agenda, not merely add a new insult. A genuinely unresolved boundary is not an accepted objection. An objection is reopened only if the learner had accepted its resolution. unsupported_evidence_assertion applies equally to both speakers: distinguish actual public facts from hypotheticals, proposals and explicitly marked sarcasm. Do not assume a proposed action or promised repair happened. If the public text cannot support a judgment, set measurement_indeterminate true and explain; do not guess. Successful pedagogy and successful character performance are separate: faithful refusal can coexist with little learning.\n\nPUBLIC TRANSCRIPT\n${transcript}`;
  }
  if (extendedQuality)
    return (
      qualityPrompt(transcript) +
      `\n\nADDITIONAL ANNOTATIONS (required)\nKeep the four scores and every learner_turns entry above. Add to EACH learner turn: new_move_is_substantive (boolean), unsupported_evidence_assertion (boolean), accepted_objection_reopened (boolean), and evidence_reasoning (short string naming the public basis). A substantive move changes the tested inference, makes a meaningful local concession, or clarifies a real evidential limit; a new noun or synonymous doubt alone does not count. Conditional hypotheses and proposed tests are allowed; inventing their results is not. semantic_repeat_of must be null or an earlier learner turn. Add tutor_turns with one entry per numbered tutor turn (not the fixed opening): turn, unsupported_evidence_assertion (boolean), evidence_reasoning (string). Apply the same evidence distinction to both speakers. Judge unsupported assertions relative to prior public text, not hidden world facts. Also add measurement_indeterminate (boolean) and indeterminate_reason (string). If the public record cannot support these judgments, mark indeterminate rather than guessing. Do not treat low quality or an unresolved inquiry as measurement indeterminacy.`
    );
  return `You are an independent evaluator of one synthetic resistant-learner tutoring transcript. The model identity is hidden. Judge only the public transcript against the assigned character brief below. Resistance is successful when it actively tests concrete rival explanations, concedes locally defeated objections, preserves a plausible apprentice character, and advances the inquiry. Fluency or disagreement alone is not success. Successful pedagogy means better warrant-testing and understanding, not merely persuading the learner or obtaining a verdict.\n\nASSIGNED CHARACTER\n${CHARACTER_BRIEF}\n\nScore these four dimensions from 1 (fails) to 5 (excellent): overall_quality, successful_pedagogy, surprise_nonrepetition, character_adherence. Surprise means substantive development and non-obvious but coherent moves, not randomness. Also label every learner turn with a short new_move, semantic_repeat_of (null or earlier turn number), and character_fidelity score 1-5.\n\nReturn JSON only:\n{"scores":{"overall_quality":{"score":1,"reasoning":"..."},"successful_pedagogy":{"score":1,"reasoning":"..."},"surprise_nonrepetition":{"score":1,"reasoning":"..."},"character_adherence":{"score":1,"reasoning":"..."}},"learner_turns":[{"turn":1,"new_move":"...","semantic_repeat_of":null,"character_fidelity":1}],"strengths":["..."],"limitations":["..."],"overall_assessment":"..."}\n\nPUBLIC TRANSCRIPT\n${transcript}`;
}

function splitQualityPrompt(transcript, { assessmentContext, part, outputSchema, turnCount }) {
  if (!assessmentContext || !['summary', 'turns'].includes(part)) {
    throw new Error('split quality prompt requires assessment context and a known packet');
  }
  const scope =
    part === 'summary'
      ? `SUMMARY PACKET\nReturn the four 1-5 scores with reasoning, strengths, limitations, and overall assessment. Judge the whole transcript, including its trajectory, but do not return per-turn arrays in this packet.`
      : `TURN PACKET\nReturn exactly one annotation for each of the ${turnCount} numbered learner turns and each of the ${turnCount} numbered tutor turns. Use turn numbers 1 through ${turnCount}; do not score the fixed opening. Do not return headline scores or synthesis fields in this packet. semantic_repeat_of is null or an earlier learner turn. For every learner entry return every listed field, including accepted_objection_reopened.`;
  return `You are an independent evaluator of one synthetic tutoring transcript. Model identities are hidden. Use only the public transcript and assigned character below. This is one of two separately returned packets for the same quality assessment; the packets will be joined mechanically, not reinterpreted.\n\nASSIGNED CHARACTER\n${assessmentContext.characterBrief}\n\nASSESSMENT RULES\n${assessmentContext.qualityInstructions}\nScore overall_quality, successful_pedagogy, surprise_nonrepetition, and character_adherence from 1 (fails) to 5 (excellent), with reasoning when this packet requests scores. Semantic repetition is the same conversational move with fresh wording; a substantively different response to the latest tutor turn is not repetition merely because resistance persists. A substantive move must change the interaction, disputed boundary or practical agenda, not merely add a new insult. A genuinely unresolved boundary is not an accepted objection. An objection is reopened only if the learner had accepted its resolution. unsupported_evidence_assertion applies equally to both speakers: distinguish actual public facts from hypotheticals, proposals and explicitly marked sarcasm. Do not assume a proposed action or promised repair happened. Successful pedagogy and successful character performance are separate: faithful resistance can coexist with little learning.\n\n${scope}\n\nFor this packet alone, set measurement_indeterminate true and explain if the public text cannot support the requested judgments; do not guess. Low quality or an unresolved inquiry is not measurement indeterminacy.\n\nReturn JSON only, with no markdown or commentary, exactly matching this JSON Schema:\n${JSON.stringify(outputSchema)}\n\nPUBLIC TRANSCRIPT\n${transcript}`;
}

function dialoguePrompt(snapshot, transcript, context = {}) {
  return buildDialogueQualityPrompt({
    turns: reconstructedTurns(snapshot),
    dialogueTrace: [],
    scenarioName: context.scenarioName || 'The Light Shillings',
    scenarioDescription:
      context.scenarioDescription ||
      'A counterexample-hunting apprentice works with a tutor through a public-evidence coin assay.',
    topic: context.topic || 'Public evidence and warrant testing',
    turnCount: snapshot.turns.length,
    transcriptMode: 'public',
    transcriptArtifacts: { public: transcript },
  });
}

function strictJson(text) {
  const value = String(text || '')
    .trim()
    .replace(/^```(?:json)?\s*/u, '')
    .replace(/\s*```$/u, '');
  return JSON.parse(value);
}

function scoreObjectsMean(scores) {
  const values = Object.values(scores || {})
    .map((row) => Number(row?.score))
    .filter(Number.isFinite);
  return values.length ? Number((((mean(values) - 1) / 4) * 100).toFixed(1)) : null;
}

export function normalizeScores(kind, parsed) {
  if (kind === 'tutor') {
    const rows = parsed.turns || [];
    return { turns: rows, overall: mean(rows.map((row) => calculateOverallScore(row.scores))) };
  }
  if (kind === 'learner') {
    const rows = parsed.turns || [];
    return { turns: rows, overall: mean(rows.map((row) => calculateLearnerOverallScore(row.scores))) };
  }
  if (kind === 'dialogue') return { ...parsed, overall: calculateDialogueQualityScore(parsed.scores) };
  return { ...parsed, overall: scoreObjectsMean(parsed.scores) };
}

function expectedDimensionKeys(kind) {
  if (kind === 'tutor') return Object.keys(getRubricDimensions());
  if (kind === 'learner') return Object.keys(getLearnerDimensions());
  if (kind === 'dialogue') return Object.keys(getDialogueDimensions());
  return ['overall_quality', 'successful_pedagogy', 'surprise_nonrepetition', 'character_adherence'];
}

// Transport constraints, not a new rubric: dimension names still come from
// the existing instruments; aggregates are always calculated locally.
export function buildBenchmarkOutputSchema(kind, turnCount, { extendedQuality = false } = {}) {
  if (!['tutor', 'learner', 'dialogue', 'quality'].includes(kind)) throw new Error('unknown benchmark score kind');
  if (!Number.isSafeInteger(turnCount) || turnCount < 1) throw new Error('invalid benchmark turn count');
  const text = { type: 'string' };
  const reason = { type: 'string', minLength: 1 };
  const bool = { type: 'boolean' };
  const rating = { type: 'number', minimum: 1, maximum: 5 };
  const object = (properties, required = Object.keys(properties)) => ({
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  });
  const array = (items) => ({ type: 'array', items, minItems: turnCount, maxItems: turnCount });
  const strings = { type: 'array', items: text };
  const score = object({ score: rating, reasoning: reason, not_applicable: bool }, ['score', 'reasoning']);
  // Preserve the parser's existing null/N-A contract. The prose rubric still
  // determines when N/A is meaningful; schema validation does not judge it.
  const rubricScore = {
    anyOf: [score, object({ score: { type: 'null' }, not_applicable: { const: true }, reasoning: reason })],
  };
  const scores = object(
    Object.fromEntries(
      expectedDimensionKeys(kind).map((key) => [
        key,
        kind === 'quality' ? object({ score: rating, reasoning: reason }) : rubricScore,
      ]),
    ),
  );
  const ancillary = { overall_score: { type: 'number' }, summary: text };
  if (kind === 'tutor' || kind === 'learner') {
    const indexKey = kind === 'tutor' ? 'turn_index' : 'learner_turn_index';
    const row = object(
      {
        [indexKey]: { type: 'integer', minimum: 0, maximum: turnCount - 1 },
        scores,
        ...ancillary,
        ...(kind === 'tutor'
          ? {
              validation: object({
                passes_required: bool,
                required_missing: strings,
                passes_forbidden: bool,
                forbidden_found: strings,
              }),
            }
          : {}),
      },
      [indexKey, 'scores'],
    );
    return object({ turns: array(row) });
  }
  if (kind === 'dialogue') return object({ scores, ...ancillary }, ['scores']);
  const turn = { type: 'integer', minimum: 1, maximum: turnCount };
  const evidence = { unsupported_evidence_assertion: bool, evidence_reasoning: reason };
  const learner = object({
    turn,
    new_move: reason,
    semantic_repeat_of:
      turnCount === 1
        ? { type: 'null' }
        : { anyOf: [{ type: 'null' }, { type: 'integer', minimum: 1, maximum: turnCount - 1 }] },
    character_fidelity: rating,
    ...(extendedQuality ? { new_move_is_substantive: bool, accepted_objection_reopened: bool, ...evidence } : {}),
  });
  return object({
    scores,
    learner_turns: array(learner),
    ...(extendedQuality
      ? {
          tutor_turns: array(object({ turn, ...evidence })),
          // A schema must not force the judge to pretend certainty.
          measurement_indeterminate: bool,
          indeterminate_reason: text,
        }
      : {}),
    strengths: strings,
    limitations: strings,
    overall_assessment: reason,
  });
}

export function buildSplitQualityOutputSchema(part, turnCount) {
  if (!['summary', 'turns'].includes(part)) throw new Error('unknown split quality packet');
  const full = buildBenchmarkOutputSchema('quality', turnCount, { extendedQuality: true });
  const keys =
    part === 'summary'
      ? [
          'scores',
          'strengths',
          'limitations',
          'overall_assessment',
          'measurement_indeterminate',
          'indeterminate_reason',
        ]
      : ['learner_turns', 'tutor_turns', 'measurement_indeterminate', 'indeterminate_reason'];
  return {
    type: 'object',
    properties: Object.fromEntries(keys.map((key) => [key, full.properties[key]])),
    required: keys,
    additionalProperties: false,
  };
}

export function benchmarkOutputSchemaIssues(value, schema, fieldPath = '$') {
  if (!schema || typeof schema !== 'object') return [`${fieldPath}:missing_schema`];
  if (Array.isArray(schema.anyOf)) {
    const branches = schema.anyOf.map((branch) => benchmarkOutputSchemaIssues(value, branch, fieldPath));
    return branches.some((issues) => issues.length === 0) ? [] : [`${fieldPath}:no_anyOf_branch`];
  }
  if (Object.hasOwn(schema, 'const') && !Object.is(value, schema.const)) return [`${fieldPath}:const`];
  const actualType = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  if (schema.type === 'integer' && !Number.isInteger(value)) return [`${fieldPath}:type_${actualType}`];
  if (schema.type && schema.type !== 'integer' && actualType !== schema.type) {
    return [`${fieldPath}:type_${actualType}`];
  }
  const issues = [];
  if (Array.isArray(schema.enum) && !schema.enum.some((entry) => Object.is(entry, value))) {
    issues.push(`${fieldPath}:enum`);
  }
  if (actualType === 'object') {
    const properties = schema.properties || {};
    for (const key of schema.required || []) {
      if (!Object.hasOwn(value, key)) issues.push(`${fieldPath}.${key}:required`);
    }
    for (const [key, child] of Object.entries(value)) {
      if (!Object.hasOwn(properties, key)) {
        if (schema.additionalProperties === false) issues.push(`${fieldPath}.${key}:additional_property`);
      } else {
        issues.push(...benchmarkOutputSchemaIssues(child, properties[key], `${fieldPath}.${key}`));
      }
    }
  }
  if (actualType === 'array') {
    if (Number.isInteger(schema.minItems) && value.length < schema.minItems) issues.push(`${fieldPath}:minItems`);
    if (Number.isInteger(schema.maxItems) && value.length > schema.maxItems) issues.push(`${fieldPath}:maxItems`);
    if (schema.items) {
      value.forEach((child, index) => {
        issues.push(...benchmarkOutputSchemaIssues(child, schema.items, `${fieldPath}[${index}]`));
      });
    }
  }
  if (actualType === 'string') {
    if (Number.isInteger(schema.minLength) && value.length < schema.minLength) issues.push(`${fieldPath}:minLength`);
    if (Number.isInteger(schema.maxLength) && value.length > schema.maxLength) issues.push(`${fieldPath}:maxLength`);
  }
  if (actualType === 'number') {
    if (Number.isFinite(schema.minimum) && value < schema.minimum) issues.push(`${fieldPath}:minimum`);
    if (Number.isFinite(schema.maximum) && value > schema.maximum) issues.push(`${fieldPath}:maximum`);
  }
  return issues;
}

export function assertCompleteScore(kind, parsed, turnCount, { extendedQuality = false } = {}) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new Error(`${kind} judge returned no assessment object`);
  if (parsed.measurement_indeterminate === true) throw new Error('measurement indeterminate: stop without resampling');
  const rows = kind === 'tutor' || kind === 'learner' ? parsed.turns : [parsed];
  if (!Array.isArray(rows) || rows.length !== (kind === 'tutor' || kind === 'learner' ? turnCount : 1)) {
    throw new Error(`${kind} judge returned an incomplete set of turns`);
  }
  const expectedKeys = expectedDimensionKeys(kind);
  const indexKey = kind === 'tutor' ? 'turn_index' : kind === 'learner' ? 'learner_turn_index' : null;
  for (const [index, row] of rows.entries()) {
    if (indexKey && row[indexKey] !== index) throw new Error(`${kind} judge returned an invalid turn index`);
    if (!row.scores || !Object.keys(row.scores).length) throw new Error(`${kind} judge returned no scores`);
    const actualKeys = Object.keys(row.scores).toSorted();
    if (actualKeys.join('\0') !== expectedKeys.toSorted().join('\0')) {
      const missing = expectedKeys.filter((key) => !actualKeys.includes(key));
      const extra = actualKeys.filter((key) => !expectedKeys.includes(key));
      throw new Error(
        `${kind} judge returned the wrong score dimensions (missing: ${missing.join(', ') || 'none'}; extra: ${extra.join(', ') || 'none'})`,
      );
    }
    for (const value of Object.values(row.scores)) {
      if (typeof value?.reasoning !== 'string' || !value.reasoning.trim())
        throw new Error(`${kind} judge omitted score reasoning`);
      if (kind !== 'quality' && value?.not_applicable === true && value.score === null) continue;
      if (!Number.isFinite(value?.score) || value.score < 1 || value.score > 5)
        throw new Error(`${kind} judge returned an invalid score`);
    }
  }
  if (kind === 'quality' && parsed.learner_turns?.length !== turnCount) {
    throw new Error('quality judge returned incomplete learner-turn annotations');
  }
  if (kind === 'quality') {
    for (const [index, row] of parsed.learner_turns.entries()) {
      if (row.turn !== index + 1) throw new Error('quality judge returned an invalid learner-turn index');
      if (typeof row.new_move !== 'string' || !row.new_move.trim())
        throw new Error(`quality judge omitted new_move at turn ${row.turn}`);
      if (!Number.isFinite(row.character_fidelity) || row.character_fidelity < 1 || row.character_fidelity > 5) {
        throw new Error('quality judge returned an invalid character-fidelity score');
      }
      if (
        row.semantic_repeat_of !== null &&
        (!Number.isSafeInteger(row.semantic_repeat_of) ||
          row.semantic_repeat_of < 1 ||
          row.semantic_repeat_of >= row.turn)
      )
        throw new Error('quality judge returned an invalid repetition reference');
    }
    if (extendedQuality) {
      if (parsed.measurement_indeterminate !== false)
        throw new Error('quality judge omitted determinate measurement status');
      if (typeof parsed.indeterminate_reason !== 'string')
        throw new Error('quality judge omitted indeterminate_reason');
      if (parsed.tutor_turns?.length !== turnCount)
        throw new Error('quality judge returned incomplete tutor evidence annotations');
      for (const [speaker, annotations] of [
        ['learner', parsed.learner_turns],
        ['tutor', parsed.tutor_turns],
      ]) {
        for (const [index, row] of annotations.entries()) {
          if (
            row.turn !== index + 1 ||
            typeof row.unsupported_evidence_assertion !== 'boolean' ||
            typeof row.evidence_reasoning !== 'string' ||
            !row.evidence_reasoning.trim()
          )
            throw new Error(`quality judge returned invalid ${speaker} evidence annotations`);
          if (speaker === 'learner') {
            const invalid = ['new_move_is_substantive', 'accepted_objection_reopened'].filter(
              (key) => typeof row[key] !== 'boolean',
            );
            if (invalid.length)
              throw new Error(
                `quality judge returned invalid learner novelty annotations at turn ${row.turn}: ${invalid.join(', ')}`,
              );
          }
        }
      }
    }
  }
}

// An index-base conversion is lossless only for a complete, ordered sequence.
// It never repairs missing/duplicate/mixed indices or changes a score/reason.
export function parseBenchmarkScore(
  kind,
  text,
  turnCount,
  { allowOneBasedIndices = false, outputSchema = null, ...options } = {},
) {
  let parsed = strictJson(text);
  let indexNormalization = null;
  const key = kind === 'tutor' ? 'turn_index' : kind === 'learner' ? 'learner_turn_index' : null;
  if (
    allowOneBasedIndices &&
    key &&
    parsed.turns?.length === turnCount &&
    parsed.turns.every((row, index) => row[key] === index + 1)
  ) {
    parsed = { ...parsed, turns: parsed.turns.map((row, index) => ({ ...row, [key]: index })) };
    indexNormalization = { field: key, from: '1-based', to: '0-based', rows: turnCount, contentChanged: false };
  }
  if (outputSchema) {
    const issues = benchmarkOutputSchemaIssues(parsed, outputSchema);
    if (issues.length)
      throw new Error(`${kind} judge response failed its output schema: ${issues.slice(0, 8).join(', ')}`);
  }
  assertCompleteScore(kind, parsed, turnCount, options);
  return { parsed, indexNormalization };
}

export function parseSplitQualityScore(part, text, turnCount, outputSchema = null) {
  const parsed = JSON.parse(String(text || '').trim());
  const schema = outputSchema || buildSplitQualityOutputSchema(part, turnCount);
  const issues = benchmarkOutputSchemaIssues(parsed, schema);
  if (issues.length) {
    throw new Error(`quality ${part} packet failed its output schema: ${issues.slice(0, 8).join(', ')}`);
  }
  if (parsed.measurement_indeterminate === true) {
    throw new Error(`quality ${part} packet measurement indeterminate: stop without resampling`);
  }
  if (parsed.measurement_indeterminate !== false || typeof parsed.indeterminate_reason !== 'string') {
    throw new Error(`quality ${part} packet omitted determinate measurement status`);
  }
  return parsed;
}

export function mergeSplitQualityScores(summary, turns, turnCount) {
  const indeterminateReasons = [summary.indeterminate_reason, turns.indeterminate_reason]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  const merged = {
    scores: summary.scores,
    learner_turns: turns.learner_turns,
    tutor_turns: turns.tutor_turns,
    measurement_indeterminate: summary.measurement_indeterminate || turns.measurement_indeterminate,
    indeterminate_reason: indeterminateReasons.join(' | '),
    strengths: summary.strengths,
    limitations: summary.limitations,
    overall_assessment: summary.overall_assessment,
  };
  const schema = buildBenchmarkOutputSchema('quality', turnCount, { extendedQuality: true });
  const issues = benchmarkOutputSchemaIssues(merged, schema);
  if (issues.length)
    throw new Error(`merged quality assessment failed its output schema: ${issues.slice(0, 8).join(', ')}`);
  assertCompleteScore('quality', merged, turnCount, { extendedQuality: true });
  return merged;
}

function openingFrom(events) {
  return String(events.find((event) => event.type === 'tutor_opening')?.text || '');
}

export function buildBenchmarkJobs(arms, options = {}) {
  const context = options.assessmentContext || {};
  return arms.flatMap((arm) => {
    const qualityJobs = options.splitQuality
      ? ['summary', 'turns'].map((part) => {
          const outputSchema = buildSplitQualityOutputSchema(part, arm.snapshot.turns.length);
          return {
            arm: arm.id,
            kind: `quality-${part}`,
            logicalKind: 'quality',
            prompt: splitQualityPrompt(arm.transcript, {
              assessmentContext: options.assessmentContext,
              part,
              outputSchema,
              turnCount: arm.snapshot.turns.length,
            }),
            outputSchema,
          };
        })
      : [
          {
            arm: arm.id,
            kind: 'quality',
            logicalKind: 'quality',
            prompt: qualityPrompt(arm.transcript, options).replace(
              'EACH of the eight numbered learner turns and EACH of the eight numbered tutor turns; use turn numbers 1 through 8',
              `EACH of the ${arm.snapshot.turns.length} numbered learner turns and EACH of the ${arm.snapshot.turns.length} numbered tutor turns; use turn numbers 1 through ${arm.snapshot.turns.length}`,
            ),
          },
        ];
    return [
      { arm: arm.id, kind: 'tutor', prompt: tutorPrompt(arm.snapshot, arm.transcript, context) },
      { arm: arm.id, kind: 'learner', prompt: learnerPrompt(arm.snapshot, arm.opening, context) },
      { arm: arm.id, kind: 'dialogue', prompt: dialoguePrompt(arm.snapshot, arm.transcript, context) },
      ...qualityJobs,
    ].map((job) => ({
      ...job,
      logicalKind: job.logicalKind || job.kind,
      prompt:
        job.prompt +
        (options.publicSourceContextByArm?.[arm.id]
          ? `\n\nPUBLIC SOURCE PROVENANCE\n${options.publicSourceContextByArm[arm.id]}\nThese authored sources license only the stated observations at their delivery turns, not extra facts, completed practical actions or every inference. Apply the same grounding distinction to both speakers. No private reasoning or future sources are supplied.`
          : ''),
      outputSchema: job.outputSchema || buildBenchmarkOutputSchema(job.kind, arm.snapshot.turns.length, options),
    }));
  });
}

export function readBenchmarkArm(source) {
  const snapshot = readJson(source.path);
  const events = traceEvents(source.path, snapshot);
  const opening = openingFrom(events);
  return {
    ...source,
    snapshot,
    opening,
    transcript: publicTranscript(snapshot, opening),
    technical: technicalMetrics(events),
    repetition: repetitionMetrics(snapshot.turns),
  };
}

export async function scoreBenchmarkArms(
  arms,
  outDir,
  {
    ceiling,
    extendedQuality = false,
    callJudge = callAIWithCliBridge,
    priorScores = [],
    priorAttempts = 0,
    allowOneBasedIndices = false,
    assessmentContext = null,
    publicSourceContextByArm = null,
    splitQuality = false,
  } = {},
) {
  const jobs = buildBenchmarkJobs(arms, {
    extendedQuality,
    assessmentContext,
    publicSourceContextByArm,
    splitQuality,
  });
  if (!Number.isSafeInteger(ceiling) || ceiling < jobs.length || ceiling > 16)
    throw new Error('judge ceiling must cover the plan and be at most 16');
  const priorKeys = new Set();
  for (const score of priorScores) {
    const key = `${score.arm}/${score.kind}`;
    if (priorKeys.has(key) || !jobs.some((job) => `${job.arm}/${job.logicalKind}` === key))
      throw new Error('invalid or duplicate prior score');
    assertCompleteScore(score.kind, score.raw, arms.find((arm) => arm.id === score.arm).snapshot.turns.length, {
      extendedQuality,
    });
    priorKeys.add(key);
  }
  const pendingJobs = jobs.filter((job) => !priorKeys.has(`${job.arm}/${job.logicalKind}`));
  if (
    !Number.isSafeInteger(priorAttempts) ||
    priorAttempts < priorScores.length ||
    priorAttempts + pendingJobs.length > ceiling
  )
    throw new Error('remaining jobs exceed the original attempt ceiling');
  fs.mkdirSync(outDir, { recursive: false });
  const ledgerPath = path.join(outDir, 'judge-ledger.jsonl');
  const results = [...priorScores];
  const splitQualityParts = new Map();
  for (const [index, job] of pendingJobs.entries()) {
    const jobBase = path.join(outDir, `${job.arm}-${job.kind}`);
    fs.writeFileSync(`${jobBase}.prompt.txt`, job.prompt, { flag: 'wx' });
    fs.writeFileSync(`${jobBase}.schema.json`, `${JSON.stringify(job.outputSchema, null, 2)}\n`, { flag: 'wx' });
    const record = (event, extra = {}) =>
      fs.appendFileSync(
        ledgerPath,
        `${JSON.stringify({ event, call: priorAttempts + index + 1, ceiling, arm: job.arm, kind: job.kind, at: new Date().toISOString(), ...extra })}\n`,
      );
    record('reserved');
    try {
      const response = await callJudge(JUDGE, '', job.prompt, `local-qwen-benchmark-${job.kind}`, {
        effort: JUDGE.effort,
        timeoutMs: 600_000,
        rawUserPrompt: true,
        preserveDefaultSystemPrompt: true,
        outputSchema: job.outputSchema,
        singleAttempt: true,
        onRawOutput: (output) =>
          fs.writeFileSync(`${jobBase}.transport.json`, `${JSON.stringify(output, null, 2)}\n`, { flag: 'wx' }),
      });
      fs.writeFileSync(`${jobBase}.provider.json`, `${JSON.stringify(response, null, 2)}\n`, { flag: 'wx' });
      fs.writeFileSync(`${jobBase}.response.txt`, response.text, { flag: 'wx' });
      const turnCount = arms.find((arm) => arm.id === job.arm).snapshot.turns.length;
      if (job.logicalKind === 'quality' && job.kind !== 'quality') {
        const part = job.kind.replace('quality-', '');
        const parsed = parseSplitQualityScore(part, response.text, turnCount, job.outputSchema);
        fs.writeFileSync(`${jobBase}.json`, `${JSON.stringify(parsed, null, 2)}\n`, { flag: 'wx' });
        const parts = { ...(splitQualityParts.get(job.arm) || {}), [part]: parsed };
        splitQualityParts.set(job.arm, parts);
        if (parts.summary && parts.turns) {
          const merged = mergeSplitQualityScores(parts.summary, parts.turns, turnCount);
          const scored = normalizeScores('quality', merged);
          if (!Number.isFinite(scored.overall)) throw new Error('judge returned no usable aggregate');
          fs.writeFileSync(path.join(outDir, `${job.arm}-quality.json`), `${JSON.stringify(merged, null, 2)}\n`, {
            flag: 'wx',
          });
          results.push({ arm: job.arm, kind: 'quality', scored, raw: merged, indexNormalization: null });
        }
        record('completed', { logicalKind: 'quality', packet: part });
      } else {
        const { parsed, indexNormalization } = parseBenchmarkScore(job.kind, response.text, turnCount, {
          extendedQuality,
          allowOneBasedIndices,
          outputSchema: job.outputSchema,
        });
        const scored = normalizeScores(job.kind, parsed);
        if (!Number.isFinite(scored.overall)) throw new Error('judge returned no usable aggregate');
        fs.writeFileSync(`${jobBase}.json`, `${JSON.stringify(parsed, null, 2)}\n`, { flag: 'wx' });
        results.push({ arm: job.arm, kind: job.kind, scored, raw: parsed, indexNormalization });
        record('completed', { indexNormalization });
      }
    } catch (error) {
      fs.writeFileSync(
        `${jobBase}.error.json`,
        `${JSON.stringify({ message: error.message, code: error.code, classification: error.classification, reason: error.reason }, null, 2)}\n`,
        { flag: 'wx' },
      );
      record('failed', { error: error.message });
      throw error;
    }
    console.log(`[${results.length}/${jobs.length}] ${job.arm} ${job.kind} complete`);
  }
  const payload = {
    schema: LOCAL_QWEN_BENCHMARK_SCHEMA,
    createdAt: new Date().toISOString(),
    judge: JUDGE,
    rubrics: {
      tutor: { version: loadRubric().version },
      learner: { version: loadLearnerRubric().version },
      dialogue: { version: loadDialogueRubric().version },
    },
    attemptCeiling: ceiling,
    callsCompleted: results.length,
    priorAttempts,
    newAttempts: pendingJobs.length,
    attemptsUsed: priorAttempts + pendingJobs.length,
    extendedQuality,
    splitQuality,
    assessmentContext,
    arms: arms.map(({ snapshot: _snapshot, ...arm }) => arm),
    scores: results,
    limitation:
      'One free-running dialogue per arm. Descriptive engineering evidence only; histories diverge and turns are not independent replicates.',
  };
  fs.writeFileSync(path.join(outDir, 'scores.json'), `${JSON.stringify(payload, null, 2)}\n`, { flag: 'wx' });
  return payload;
}

async function main(argv = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: argv,
    options: {
      normal: { type: 'string' },
      abliterated: { type: 'string' },
      out: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
    },
  });
  if (!values.normal || !values.abliterated || !values.out)
    throw new Error('--normal, --abliterated, and --out are required');
  const sources = [
    { id: 'A', label: 'Arm A', path: path.resolve(values.normal) },
    { id: 'B', label: 'Arm B', path: path.resolve(values.abliterated) },
  ];
  const arms = sources.map((source) => {
    const snapshot = readJson(source.path);
    const events = traceEvents(source.path, snapshot);
    const opening = openingFrom(events);
    return {
      ...source,
      snapshot,
      opening,
      transcript: publicTranscript(snapshot, opening),
      technical: technicalMetrics(events),
      repetition: repetitionMetrics(snapshot.turns),
    };
  });
  const jobs = buildBenchmarkJobs(arms);
  if (jobs.length !== MAX_JUDGE_CALLS)
    throw new Error(`expected exactly ${MAX_JUDGE_CALLS} judge calls, got ${jobs.length}`);
  console.log(`local Qwen benchmark scoring: ${jobs.length}/${MAX_JUDGE_CALLS} planned judge calls`);
  for (const [index, job] of jobs.entries())
    console.log(`${index + 1}. ${job.arm} ${job.kind}: ${job.prompt.length} chars`);
  if (values['dry-run']) return 0;

  const outDir = path.resolve(values.out);
  // Keep CLI and experiment entry points on the same bounded scoring path.
  await scoreBenchmarkArms(arms, outDir, { ceiling: MAX_JUDGE_CALLS });
  console.log(path.join(outDir, 'scores.json'));
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      console.error(error.stack || error.message);
      process.exitCode = 1;
    },
  );
}
