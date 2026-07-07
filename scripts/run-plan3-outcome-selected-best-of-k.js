#!/usr/bin/env node
/**
 * Plan 3 optional probe #11: bounded outcome-selected best-of-K.
 *
 * This instantiates the Plan 3 selection question on the repo's existing
 * hard-transfer misconception lattice: generate K whole-episode tutoring plans,
 * score each by mechanical hard-transfer expected correctness, and compare
 * single-K1, model/self-opinion-selected, and outcome-selected choices.
 *
 * Boundary: this is the bounded harness version, not the full cell40/cell100
 * N=24-53 3-way run.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MISCONCEPTION_FAMILIES,
  estimateStateFromBehavior,
  seedTable,
  simulateItemResponses,
} from './run-yoked-contingency-smoke.js';
import { loadG2Items } from './run-yoked-contingency-g2-independent-outcome.js';
import {
  FAMILY_DESCRIPTIONS,
  backendDetail,
  callBackend,
  canonicalBackend,
  createCallCounter,
  fmt,
  mean,
  parseJsonResponse,
} from './run-yoked-contingency-g0-paid-smoke.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const DEFAULTS = {
  backend: 'codex',
  sessions: 3,
  k: 3,
  planTurns: 4,
  maxCalls: 9,
  outJson: path.join(ROOT, 'exports', 'plan3-optional-probes', 'outcome-selected-best-of-k.json'),
  outMd: path.join(ROOT, 'exports', 'plan3-optional-probes', 'outcome-selected-best-of-k.md'),
};

const SESSION_SPECS = [
  { sessionId: 'plan3-os-alpha-01', targetSeed: 'alpha' },
  { sessionId: 'plan3-os-beta-01', targetSeed: 'beta' },
  { sessionId: 'plan3-os-gamma-01', targetSeed: 'gamma' },
];

function parseArgs(argv) {
  const args = { ...DEFAULTS, write: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--backend') args.backend = argv[++i];
    else if (a === '--sessions') args.sessions = Number(argv[++i]);
    else if (a === '--k') args.k = Number(argv[++i]);
    else if (a === '--plan-turns') args.planTurns = Number(argv[++i]);
    else if (a === '--max-calls') args.maxCalls = Number(argv[++i]);
    else if (a === '--out-json') args.outJson = argv[++i];
    else if (a === '--out-md') args.outMd = argv[++i];
    else if (a === '--dry-run') args.backend = 'mock';
    else if (a === '--no-write') args.write = false;
    else if (a === '-h' || a === '--help') {
      console.log(`Usage: node scripts/run-plan3-outcome-selected-best-of-k.js [options]

Options:
  --backend <codex|claude-code[:model]|openrouter[:model]|agy[:model]|mock>
  --sessions <n>          Sessions to run (default: 3)
  --k <n>                 Candidate episodes per session (default: 3)
  --plan-turns <n>        Micro-interventions per episode (default: 4)
  --max-calls <n>         Hard model-call cap (default: 9)
  --out-json <path>       JSON artifact path
  --out-md <path>         Markdown artifact path
  --dry-run               Use deterministic mock candidates`);
      process.exit(0);
    } else {
      throw new Error(`unknown flag: ${a}`);
    }
  }
  for (const [name, value] of [
    ['--sessions', args.sessions],
    ['--k', args.k],
    ['--plan-turns', args.planTurns],
    ['--max-calls', args.maxCalls],
  ]) {
    if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`);
  }
  return args;
}

function scoreResponses(responses) {
  return mean(responses.map((response) => response.expected_correct));
}

function selectedChoice(item, response) {
  return (
    item.choices.find((choice) => String(choice.value) === String(response.response_value)) || {
      value: response.response_value,
      label: String(response.response_value),
    }
  );
}

function correctChoice(item) {
  return (
    item.choices.find((choice) => String(choice.value) === String(item.correct)) || {
      value: item.correct,
      label: String(item.correct),
    }
  );
}

function buildBehaviorLog({ seedId, items, responses, learnerId }) {
  const itemById = new Map(items.map((item) => [item.id, item]));
  return (
    responses
      .map((response, index) => {
        const item = itemById.get(response.item_id);
        const selected = selectedChoice(item, response);
        const correct = correctChoice(item);
        return `${index + 1}. ${item.id}
Stem: ${item.stem}
Selected: ${selected.value}. ${selected.label}
Correct: ${correct.value}. ${correct.label}
Result: ${response.is_seeded_error ? 'not accepted' : 'accepted'}`;
      })
      .join('\n\n') + `\n\nLearner id: ${learnerId}; seed: ${seedId}`
  );
}

function buildCandidatePrompt({ sessionId, candidateIndex, behaviorLog, planTurns }) {
  const families = MISCONCEPTION_FAMILIES.map((family) => `- ${family}: ${FAMILY_DESCRIPTIONS[family]}`).join('\n');
  const styles = [
    'minimal diagnostic hints; avoid worked solutions',
    'explicit conceptual repair with one short worked contrast',
    'learner-owned reasoning and transfer checks',
    'metacognitive reflection plus targeted practice',
  ];
  const style = styles[(candidateIndex - 1) % styles.length];
  return `You are generating candidate ${candidateIndex} in an outcome-selected best-of-K tutoring probe.

Task: make a ${planTurns}-turn fractions tutoring episode plan from behavior logs.
Candidate style: ${style}.

Candidate families:
${families}

Behavior log for ${sessionId}:
${behaviorLog}

Return JSON only:
{
  "self_score": 0.0,
  "plan": [
    {"turn": 0, "target_family": "family_name", "intervention": "one concrete tutor move"}
  ],
  "rationale": "brief reason"
}`;
}

function normalizePlan(parsed, { candidateIndex, planTurns }) {
  const rawPlan = Array.isArray(parsed.plan) ? parsed.plan : [];
  const plan = rawPlan.slice(0, planTurns).map((step, index) => ({
    turn: Number.isInteger(step.turn) ? step.turn : index,
    targetFamily: String(step.target_family || step.targetFamily || '').trim(),
    intervention: String(step.intervention || step.text || '').trim(),
  }));
  const invalidTargetFamilies = plan
    .map((step) => step.targetFamily)
    .filter((family) => !MISCONCEPTION_FAMILIES.includes(family));
  return {
    candidateIndex,
    selfScore: Number.isFinite(Number(parsed.self_score ?? parsed.selfScore))
      ? Number(parsed.self_score ?? parsed.selfScore)
      : 0,
    plan,
    rationale: String(parsed.rationale || '').trim(),
    invalidTargetFamilies,
    planLengthValid: plan.length === planTurns,
  };
}

function mockCandidate({ candidateIndex, targetState, planTurns }) {
  const active = MISCONCEPTION_FAMILIES.filter((family) => targetState[family]);
  const inactive = MISCONCEPTION_FAMILIES.filter((family) => !targetState[family]);
  const pattern =
    candidateIndex % 3 === 1
      ? [active[0], inactive[0], active[0], inactive[1]]
      : candidateIndex % 3 === 2
        ? [active[0], active[1], active[0], active[1]]
        : [inactive[0], inactive[1], active[1], inactive[2]];
  return {
    candidateIndex,
    selfScore: candidateIndex % 3 === 1 ? 0.82 : candidateIndex % 3 === 2 ? 0.68 : 0.74,
    plan: pattern
      .slice(0, planTurns)
      .filter(Boolean)
      .map((targetFamily, turn) => ({
        turn,
        targetFamily,
        intervention: `Mock candidate ${candidateIndex} targets ${targetFamily}.`,
      })),
    rationale: 'deterministic mock candidate',
    invalidTargetFamilies: [],
    planLengthValid: true,
  };
}

async function generateCandidate({
  backend,
  callCounter,
  sessionId,
  candidateIndex,
  behaviorLog,
  targetState,
  planTurns,
}) {
  if (canonicalBackend(backend) === 'mock') return mockCandidate({ candidateIndex, targetState, planTurns });
  callCounter.increment('candidate_episode');
  const raw = await callBackend(buildCandidatePrompt({ sessionId, candidateIndex, behaviorLog, planTurns }), backend);
  return normalizePlan(parseJsonResponse(raw), { candidateIndex, planTurns });
}

function scoreCandidate({ candidate, preScore, postItems, targetState }) {
  const mastery = Object.fromEntries(MISCONCEPTION_FAMILIES.map((family) => [family, 0]));
  for (const turn of candidate.plan) {
    if (!targetState[turn.targetFamily]) continue;
    mastery[turn.targetFamily] = Math.min(1, mastery[turn.targetFamily] + 0.5);
  }
  const postResponses = simulateItemResponses(postItems, targetState, mastery);
  const postScore = scoreResponses(postResponses);
  return {
    ...candidate,
    mastery,
    postScore: Number(postScore.toFixed(3)),
    gain: Number((postScore - preScore).toFixed(3)),
    activeTargets: candidate.plan.filter((turn) => targetState[turn.targetFamily]).length,
    inactiveTargets: candidate.plan.filter(
      (turn) => MISCONCEPTION_FAMILIES.includes(turn.targetFamily) && !targetState[turn.targetFamily],
    ).length,
  };
}

function chooseBy(candidates, scoreFn) {
  return [...candidates].sort((a, b) => scoreFn(b) - scoreFn(a) || a.candidateIndex - b.candidateIndex)[0];
}

async function runSession({ spec, items, backend, k, planTurns, callCounter }) {
  const preItems = items.filter((item) => item.form === 'A');
  const postItems = items.filter((item) => item.form === 'B');
  const targetState = seedTable(spec.targetSeed);
  const preResponses = simulateItemResponses(preItems, targetState);
  const preScore = scoreResponses(preResponses);
  const behaviorLog = buildBehaviorLog({
    seedId: spec.targetSeed,
    learnerId: `${spec.sessionId}-target`,
    items: preItems,
    responses: preResponses,
  });
  const recovered = estimateStateFromBehavior(preResponses)
    .filter((row) => row.predictedActive)
    .map((row) => row.family);
  const candidates = [];
  for (let i = 1; i <= k; i++) {
    console.log(`plan3 outcome-selected: ${spec.sessionId} candidate ${i}/${k} via ${backend}`);
    const candidate = await generateCandidate({
      backend,
      callCounter,
      sessionId: spec.sessionId,
      candidateIndex: i,
      behaviorLog,
      targetState,
      planTurns,
    });
    candidates.push(scoreCandidate({ candidate, preScore, postItems, targetState }));
  }
  const single = candidates[0];
  const opinion = chooseBy(candidates, (candidate) => candidate.selfScore);
  const outcome = chooseBy(candidates, (candidate) => candidate.gain);
  return {
    sessionId: spec.sessionId,
    targetSeed: spec.targetSeed,
    targetActiveFamilies: MISCONCEPTION_FAMILIES.filter((family) => targetState[family]),
    behaviorRecoveredActiveFamilies: recovered,
    preScore: Number(preScore.toFixed(3)),
    candidates,
    selected: {
      single_k1: single.candidateIndex,
      opinion_best_of_k: opinion.candidateIndex,
      outcome_selected_k: outcome.candidateIndex,
    },
    gains: {
      single_k1: single.gain,
      opinion_best_of_k: opinion.gain,
      outcome_selected_k: outcome.gain,
    },
    deltas: {
      outcome_minus_single: Number((outcome.gain - single.gain).toFixed(3)),
      outcome_minus_opinion: Number((outcome.gain - opinion.gain).toFixed(3)),
    },
  };
}

export async function runOutcomeSelectedProbe({
  backend = DEFAULTS.backend,
  sessions = DEFAULTS.sessions,
  k = DEFAULTS.k,
  planTurns = DEFAULTS.planTurns,
  maxCalls = DEFAULTS.maxCalls,
  items = loadG2Items({ posttestProfile: 'hard-transfer' }),
} = {}) {
  const callCounter = createCallCounter(maxCalls);
  const selectedSpecs = [];
  for (let i = 0; i < sessions; i++) {
    const base = SESSION_SPECS[i % SESSION_SPECS.length];
    const repeat = Math.floor(i / SESSION_SPECS.length) + 1;
    selectedSpecs.push({ ...base, sessionId: repeat === 1 ? base.sessionId : `${base.sessionId}-r${repeat}` });
  }
  const sessionRows = [];
  for (const spec of selectedSpecs) {
    sessionRows.push(await runSession({ spec, items, backend, k, planTurns, callCounter }));
  }
  const meanGain = (key) => Number(mean(sessionRows.map((row) => row.gains[key])).toFixed(3));
  const meanD = (key) => Number(mean(sessionRows.map((row) => row.deltas[key])).toFixed(3));
  const outcomeBeatsOpinion = sessionRows.filter((row) => row.deltas.outcome_minus_opinion > 0).length;
  const invalidPlanCount = sessionRows
    .flatMap((row) => row.candidates)
    .filter((candidate) => candidate.invalidTargetFamilies.length || !candidate.planLengthValid).length;
  const hardPass =
    invalidPlanCount === 0 &&
    meanD('outcome_minus_single') > 0 &&
    meanD('outcome_minus_opinion') > 0 &&
    outcomeBeatsOpinion >= Math.ceil(sessionRows.length / 2);
  return {
    schema: 'plan3_outcome_selected_best_of_k_v0',
    generatedAt: new Date().toISOString(),
    status: hardPass ? 'pass_bounded_outcome_selection' : 'null_or_inconclusive_bounded_outcome_selection',
    boundary: 'bounded Plan 3 probe on the hard-transfer misconception lattice; not the full cell40/cell100 3-way run',
    backend: canonicalBackend(backend),
    backendDetail: backendDetail(backend),
    controls: { sessions: sessionRows.length, k, planTurns },
    sessions: sessionRows,
    summary: {
      modelCalls: callCounter.counts,
      invalidPlanCount,
      meanGainBySelector: {
        single_k1: meanGain('single_k1'),
        opinion_best_of_k: meanGain('opinion_best_of_k'),
        outcome_selected_k: meanGain('outcome_selected_k'),
      },
      meanOutcomeMinusSingle: meanD('outcome_minus_single'),
      meanOutcomeMinusOpinion: meanD('outcome_minus_opinion'),
      outcomeBeatsOpinion,
    },
  };
}

export function renderOutcomeSelectedReport(result) {
  const lines = [];
  lines.push('# Plan 3 outcome-selected best-of-K probe');
  lines.push('');
  lines.push(`Generated: ${result.generatedAt}`);
  lines.push(`Status: ${result.status}`);
  lines.push('');
  lines.push(`Boundary: ${result.boundary}.`);
  lines.push(`Backend: ${result.backendDetail?.label || result.backend}`);
  lines.push(`Model calls: ${result.summary.modelCalls.total}`);
  lines.push('');
  lines.push('## Selector Means');
  lines.push('');
  lines.push('| selector | mean gain |');
  lines.push('|---|---:|');
  for (const [selector, gain] of Object.entries(result.summary.meanGainBySelector)) {
    lines.push(`| ${selector} | ${fmt(gain)} |`);
  }
  lines.push('');
  lines.push(`- Outcome minus single-K1: ${fmt(result.summary.meanOutcomeMinusSingle)}`);
  lines.push(`- Outcome minus opinion-best-K: ${fmt(result.summary.meanOutcomeMinusOpinion)}`);
  lines.push(
    `- Sessions where outcome beats opinion: ${result.summary.outcomeBeatsOpinion}/${result.controls.sessions}`,
  );
  lines.push('');
  lines.push('## Sessions');
  lines.push('');
  lines.push('| session | active families | single | opinion | outcome | Δ outcome-opinion |');
  lines.push('|---|---|---:|---:|---:|---:|');
  for (const row of result.sessions) {
    lines.push(
      `| ${row.sessionId} | ${row.targetActiveFamilies.join(', ')} | ${fmt(row.gains.single_k1)} | ${fmt(
        row.gains.opinion_best_of_k,
      )} | ${fmt(row.gains.outcome_selected_k)} | ${fmt(row.deltas.outcome_minus_opinion)} |`,
    );
  }
  lines.push('');
  lines.push('## Read');
  lines.push('');
  if (result.status === 'pass_bounded_outcome_selection') {
    lines.push(
      'Outcome selection adds value over both single-K1 and model/self-opinion selection in this bounded run.',
    );
  } else {
    lines.push(
      'Bounded run does not show outcome-selection headroom over opinion selection; scale only if the failure mode is instrumentation, not ceiling.',
    );
  }
  lines.push('');
  return lines.join('\n');
}

function writeArtifacts({ result, outJson, outMd }) {
  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(result, null, 2)}\n`);
  fs.mkdirSync(path.dirname(outMd), { recursive: true });
  fs.writeFileSync(outMd, renderOutcomeSelectedReport(result));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runOutcomeSelectedProbe(args);
  if (args.write) {
    writeArtifacts({ result, outJson: path.resolve(args.outJson), outMd: path.resolve(args.outMd) });
    console.log(`wrote ${args.outJson}`);
    console.log(`wrote ${args.outMd}`);
  }
  console.log(
    `${result.status}: outcome-single=${fmt(result.summary.meanOutcomeMinusSingle)} outcome-opinion=${fmt(
      result.summary.meanOutcomeMinusOpinion,
    )} calls=${result.summary.modelCalls.total}`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error('FATAL:', err);
    process.exit(1);
  });
}
