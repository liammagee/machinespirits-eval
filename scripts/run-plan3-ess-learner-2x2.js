#!/usr/bin/env node
/**
 * Plan 3 optional probe #9: bounded ESS learner 2x2.
 *
 * Crosses tutor prompt family (base/recognition) with learner endpoint
 * (roleplay-like vs epistemically constrained state, ESS) on the existing
 * hard-transfer misconception lattice.
 *
 * Default boundary: a bounded lattice probe. With --sessions 30, this
 * instantiates the Plan 3 N≈120 follow-up as 30 sessions x 4 2x2 cells.
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
  planTurns: 4,
  maxCalls: 6,
  outJson: path.join(ROOT, 'exports', 'plan3-optional-probes', 'ess-learner-2x2.json'),
  outMd: path.join(ROOT, 'exports', 'plan3-optional-probes', 'ess-learner-2x2.md'),
};

const SESSION_SPECS = [
  { sessionId: 'plan3-ess-alpha-01', targetSeed: 'alpha' },
  { sessionId: 'plan3-ess-beta-01', targetSeed: 'beta' },
  { sessionId: 'plan3-ess-gamma-01', targetSeed: 'gamma' },
];

const LATTICE_SESSION_SPECS = MISCONCEPTION_FAMILIES.flatMap((familyA, i) =>
  MISCONCEPTION_FAMILIES.slice(i + 1).map((familyB) => ({
    sessionId: `plan3-ess-${familyA.replaceAll('_', '-')}-${familyB.replaceAll('_', '-')}`,
    targetSeed: `pair:${familyA}+${familyB}`,
    targetFamilies: [familyA, familyB],
  })),
);

function parseArgs(argv) {
  const args = { ...DEFAULTS, write: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--backend') args.backend = argv[++i];
    else if (a === '--sessions') args.sessions = Number(argv[++i]);
    else if (a === '--plan-turns') args.planTurns = Number(argv[++i]);
    else if (a === '--max-calls') args.maxCalls = Number(argv[++i]);
    else if (a === '--out-json') args.outJson = argv[++i];
    else if (a === '--out-md') args.outMd = argv[++i];
    else if (a === '--dry-run') args.backend = 'mock';
    else if (a === '--no-write') args.write = false;
    else if (a === '-h' || a === '--help') {
      console.log(`Usage: node scripts/run-plan3-ess-learner-2x2.js [options]

Options:
  --backend <codex|claude-code[:model]|openrouter[:model]|agy[:model]|mock>
  --sessions <n>          Sessions to run (default: 3)
  --plan-turns <n>        Micro-interventions per tutor plan (default: 4)
  --max-calls <n>         Hard model-call cap (default: 6)
  --out-json <path>       JSON artifact path
  --out-md <path>         Markdown artifact path
  --dry-run               Use deterministic mock tutor plans`);
      process.exit(0);
    } else {
      throw new Error(`unknown flag: ${a}`);
    }
  }
  for (const [name, value] of [
    ['--sessions', args.sessions],
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

function sd(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

function pairedMeanSummary(xs) {
  const m = mean(xs);
  const se = xs.length > 1 ? sd(xs) / Math.sqrt(xs.length) : 0;
  return {
    mean: Number(m.toFixed(3)),
    se: Number(se.toFixed(3)),
    ci95: [Number((m - 1.96 * se).toFixed(3)), Number((m + 1.96 * se).toFixed(3))],
    positive: xs.filter((x) => x > 0).length,
    negative: xs.filter((x) => x < 0).length,
    zero: xs.filter((x) => x === 0).length,
  };
}

function stateFromSpec(spec) {
  if (Array.isArray(spec.targetFamilies)) {
    return Object.fromEntries(MISCONCEPTION_FAMILIES.map((family) => [family, spec.targetFamilies.includes(family)]));
  }
  return seedTable(spec.targetSeed);
}

function buildSessionSpecs(sessions) {
  if (sessions <= SESSION_SPECS.length) {
    return SESSION_SPECS.slice(0, sessions);
  }
  const selectedSpecs = [];
  for (let i = 0; i < sessions; i++) {
    const base = LATTICE_SESSION_SPECS[i % LATTICE_SESSION_SPECS.length];
    const repeat = Math.floor(i / LATTICE_SESSION_SPECS.length) + 1;
    selectedSpecs.push({
      ...base,
      sessionId: `${base.sessionId}-r${String(repeat).padStart(2, '0')}`,
    });
  }
  return selectedSpecs;
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

function buildBehaviorRows({ items, responses }) {
  const itemById = new Map(items.map((item) => [item.id, item]));
  return responses
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
    .join('\n\n');
}

function buildTutorPrompt({ sessionId, condition, behaviorRows, planTurns }) {
  const families = MISCONCEPTION_FAMILIES.map((family) => `- ${family}: ${FAMILY_DESCRIPTIONS[family]}`).join('\n');
  const conditionBlock =
    condition === 'recognition'
      ? `Use a recognition-oriented stance: ask for learner-owned reasoning, preserve agency, and make each correction contingent on visible evidence.`
      : `Use a concise baseline tutoring stance: explain the relevant rule clearly and give short practice checks.`;
  return `You are generating a ${condition} tutor plan for a Plan 3 ESS learner probe.

${conditionBlock}

Make exactly ${planTurns} micro-interventions. Each target_family must be one candidate family.

Candidate families:
${families}

Behavior log for ${sessionId}:
${behaviorRows}

Return JSON only:
{
  "plan": [
    {"turn": 0, "target_family": "family_name", "intervention": "one concrete tutor move"}
  ],
  "rationale": "brief behavior-based reason"
}`;
}

function normalizePlan(parsed, { condition, planTurns }) {
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
    condition,
    plan,
    rationale: String(parsed.rationale || '').trim(),
    invalidTargetFamilies,
    planLengthValid: plan.length === planTurns,
  };
}

function mockPlan({ condition, targetState, planTurns }) {
  const active = MISCONCEPTION_FAMILIES.filter((family) => targetState[family]);
  const inactive = MISCONCEPTION_FAMILIES.filter((family) => !targetState[family]);
  const pattern =
    condition === 'recognition'
      ? [active[0], active[1], active[0], active[1]]
      : [active[0], inactive[0], active[0], inactive[1]];
  return {
    condition,
    plan: pattern.slice(0, planTurns).filter(Boolean).map((targetFamily, turn) => ({
      turn,
      targetFamily,
      intervention: `Mock ${condition} intervention for ${targetFamily}.`,
    })),
    rationale: 'deterministic mock plan',
    invalidTargetFamilies: [],
    planLengthValid: true,
  };
}

async function generateTutorPlan({ backend, callCounter, condition, sessionId, behaviorRows, targetState, planTurns }) {
  if (canonicalBackend(backend) === 'mock') return mockPlan({ condition, targetState, planTurns });
  callCounter.increment(`${condition}_plan`);
  const raw = await callBackend(buildTutorPrompt({ sessionId, condition, behaviorRows, planTurns }), backend);
  return normalizePlan(parseJsonResponse(raw), { condition, planTurns });
}

function applyRoleplayLearner({ targetState, plan }) {
  const mastery = Object.fromEntries(MISCONCEPTION_FAMILIES.map((family) => [family, 0]));
  const anyActiveTarget = plan.some((turn) => targetState[turn.targetFamily]);
  for (const family of MISCONCEPTION_FAMILIES.filter((f) => targetState[f])) {
    if (anyActiveTarget) mastery[family] = Math.min(1, mastery[family] + 0.25);
  }
  for (const turn of plan) {
    if (targetState[turn.targetFamily]) mastery[turn.targetFamily] = Math.min(1, mastery[turn.targetFamily] + 0.45);
  }
  return mastery;
}

function applyEssLearner({ targetState, plan }) {
  const mastery = Object.fromEntries(MISCONCEPTION_FAMILIES.map((family) => [family, 0]));
  for (const turn of plan) {
    if (!targetState[turn.targetFamily]) continue;
    mastery[turn.targetFamily] = Math.min(1, mastery[turn.targetFamily] + 0.5);
  }
  return mastery;
}

function scorePlanWithLearner({ learnerMode, targetState, plan, preScore, postItems }) {
  const mastery =
    learnerMode === 'ess'
      ? applyEssLearner({ targetState, plan })
      : applyRoleplayLearner({ targetState, plan });
  const postResponses = simulateItemResponses(postItems, targetState, mastery);
  const postScore = scoreResponses(postResponses);
  const activeFamilies = MISCONCEPTION_FAMILIES.filter((family) => targetState[family]);
  return {
    learnerMode,
    mastery,
    clearedFamilies: activeFamilies.filter((family) => mastery[family] >= 0.95),
    partiallyAddressedFamilies: activeFamilies.filter((family) => mastery[family] > 0 && mastery[family] < 0.95),
    postScore: Number(postScore.toFixed(3)),
    gain: Number((postScore - preScore).toFixed(3)),
  };
}

async function runSession({ spec, items, backend, planTurns, callCounter }) {
  const preItems = items.filter((item) => item.form === 'A');
  const postItems = items.filter((item) => item.form === 'B');
  const targetState = stateFromSpec(spec);
  const preResponses = simulateItemResponses(preItems, targetState);
  const preScore = scoreResponses(preResponses);
  const behaviorRows = buildBehaviorRows({ items: preItems, responses: preResponses });
  const recovered = estimateStateFromBehavior(preResponses).filter((row) => row.predictedActive).map((row) => row.family);
  const conditions = [];
  for (const condition of ['base', 'recognition']) {
    console.log(`plan3 ESS 2x2: ${spec.sessionId} ${condition} plan via ${backend}`);
    const generated = await generateTutorPlan({
      backend,
      callCounter,
      condition,
      sessionId: spec.sessionId,
      behaviorRows,
      targetState,
      planTurns,
    });
    const roleplay = scorePlanWithLearner({
      learnerMode: 'roleplay',
      targetState,
      plan: generated.plan,
      preScore,
      postItems,
    });
    const ess = scorePlanWithLearner({
      learnerMode: 'ess',
      targetState,
      plan: generated.plan,
      preScore,
      postItems,
    });
    conditions.push({
      condition,
      plan: generated.plan,
      rationale: generated.rationale,
      invalidTargetFamilies: generated.invalidTargetFamilies,
      planLengthValid: generated.planLengthValid,
      activeTargets: generated.plan.filter((turn) => targetState[turn.targetFamily]).length,
      inactiveTargets: generated.plan.filter(
        (turn) => MISCONCEPTION_FAMILIES.includes(turn.targetFamily) && !targetState[turn.targetFamily],
      ).length,
      learners: { roleplay, ess },
    });
  }
  return {
    sessionId: spec.sessionId,
    targetSeed: spec.targetSeed,
    targetActiveFamilies: MISCONCEPTION_FAMILIES.filter((family) => targetState[family]),
    behaviorRecoveredActiveFamilies: recovered,
    preScore: Number(preScore.toFixed(3)),
    conditions,
  };
}

export async function runEssProbe({
  backend = DEFAULTS.backend,
  sessions = DEFAULTS.sessions,
  planTurns = DEFAULTS.planTurns,
  maxCalls = DEFAULTS.maxCalls,
  items = loadG2Items({ posttestProfile: 'hard-transfer' }),
} = {}) {
  const callCounter = createCallCounter(maxCalls);
  const selectedSpecs = buildSessionSpecs(sessions);
  const sessionRows = [];
  for (const spec of selectedSpecs) {
    sessionRows.push(await runSession({ spec, items, backend, planTurns, callCounter }));
  }
  const cells = {};
  for (const condition of ['base', 'recognition']) {
    for (const learnerMode of ['roleplay', 'ess']) {
      const rows = sessionRows.map((session) => {
        const c = session.conditions.find((row) => row.condition === condition);
        return c.learners[learnerMode];
      });
      cells[`${condition}_${learnerMode}`] = {
        meanGain: Number(mean(rows.map((row) => row.gain)).toFixed(3)),
        meanClearedFamilies: Number(mean(rows.map((row) => row.clearedFamilies.length)).toFixed(3)),
      };
    }
  }
  const invalidPlanCount = sessionRows
    .flatMap((session) => session.conditions)
    .filter((condition) => condition.invalidTargetFamilies.length || !condition.planLengthValid).length;
  const recognitionEssLift = Number((cells.recognition_ess.meanGain - cells.base_ess.meanGain).toFixed(3));
  const roleplayInflation = Number(
    (mean([cells.base_roleplay.meanGain, cells.recognition_roleplay.meanGain]) -
      mean([cells.base_ess.meanGain, cells.recognition_ess.meanGain])).toFixed(3),
  );
  const cellObservations = sessionRows.length * 4;
  const boundary =
    cellObservations >= 120
      ? 'Plan 3 ESS follow-up on the hard-transfer misconception lattice; N≈120 cell observations, synthetic learner-outcome validity test'
      : 'bounded Plan 3 ESS learner probe on the hard-transfer misconception lattice; not the full N≈120 run';
  const sessionDeltas = sessionRows.map((session) => {
    const base = session.conditions.find((row) => row.condition === 'base');
    const recognition = session.conditions.find((row) => row.condition === 'recognition');
    return {
      sessionId: session.sessionId,
      recognitionEssDelta: Number((recognition.learners.ess.gain - base.learners.ess.gain).toFixed(3)),
      baseRoleplayMinusEss: Number((base.learners.roleplay.gain - base.learners.ess.gain).toFixed(3)),
      recognitionRoleplayMinusEss: Number((recognition.learners.roleplay.gain - recognition.learners.ess.gain).toFixed(3)),
    };
  });
  return {
    schema: 'plan3_ess_learner_2x2_v0',
    generatedAt: new Date().toISOString(),
    status: invalidPlanCount === 0 ? 'complete_bounded_ess_2x2' : 'invalid_plan_bounded_ess_2x2',
    boundary,
    backend: canonicalBackend(backend),
    backendDetail: backendDetail(backend),
    controls: {
      sessions: sessionRows.length,
      cellObservations,
      uniqueTargetStates: new Set(sessionRows.map((row) => row.targetActiveFamilies.join('|'))).size,
      planTurns,
    },
    sessions: sessionRows,
    summary: {
      modelCalls: callCounter.counts,
      invalidPlanCount,
      cells,
      recognitionEssLift,
      pairedRecognitionEssLift: pairedMeanSummary(sessionDeltas.map((row) => row.recognitionEssDelta)),
      roleplayInflation,
      pairedRoleplayInflation: pairedMeanSummary(
        sessionDeltas.flatMap((row) => [row.baseRoleplayMinusEss, row.recognitionRoleplayMinusEss]),
      ),
      sessionDeltas,
    },
  };
}

export function renderEssReport(result) {
  const lines = [];
  lines.push('# Plan 3 ESS learner 2x2 probe');
  lines.push('');
  lines.push(`Generated: ${result.generatedAt}`);
  lines.push(`Status: ${result.status}`);
  lines.push('');
  lines.push(`Boundary: ${result.boundary}.`);
  lines.push(`Backend: ${result.backendDetail?.label || result.backend}`);
  lines.push(`Model calls: ${result.summary.modelCalls.total}`);
  lines.push(`Cell observations: ${result.controls.cellObservations}`);
  lines.push(`Unique target states: ${result.controls.uniqueTargetStates}`);
  lines.push('');
  lines.push('## 2x2 Cell Means');
  lines.push('');
  lines.push('| tutor condition | learner endpoint | mean gain | mean cleared families |');
  lines.push('|---|---|---:|---:|');
  for (const condition of ['base', 'recognition']) {
    for (const learnerMode of ['roleplay', 'ess']) {
      const cell = result.summary.cells[`${condition}_${learnerMode}`];
      lines.push(`| ${condition} | ${learnerMode} | ${fmt(cell.meanGain)} | ${fmt(cell.meanClearedFamilies)} |`);
    }
  }
  lines.push('');
  lines.push(`- Recognition lift under ESS: ${fmt(result.summary.recognitionEssLift)}`);
  lines.push(
    `- Paired recognition lift under ESS: ${fmt(result.summary.pairedRecognitionEssLift.mean)} ` +
      `(95% CI ${fmt(result.summary.pairedRecognitionEssLift.ci95[0])} to ${fmt(
        result.summary.pairedRecognitionEssLift.ci95[1],
      )}; positive ${result.summary.pairedRecognitionEssLift.positive}/${result.controls.sessions})`,
  );
  lines.push(`- Roleplay inflation over ESS: ${fmt(result.summary.roleplayInflation)}`);
  lines.push(
    `- Paired roleplay inflation over ESS: ${fmt(result.summary.pairedRoleplayInflation.mean)} ` +
      `(95% CI ${fmt(result.summary.pairedRoleplayInflation.ci95[0])} to ${fmt(
        result.summary.pairedRoleplayInflation.ci95[1],
      )})`,
  );
  lines.push('');
  lines.push('## Sessions');
  lines.push('');
  lines.push('| session | active families | base active targets | recognition active targets | base ESS gain | recognition ESS gain |');
  lines.push('|---|---|---:|---:|---:|---:|');
  for (const session of result.sessions) {
    const base = session.conditions.find((row) => row.condition === 'base');
    const recog = session.conditions.find((row) => row.condition === 'recognition');
    lines.push(
      `| ${session.sessionId} | ${session.targetActiveFamilies.join(', ')} | ${base.activeTargets} | ${
        recog.activeTargets
      } | ${fmt(base.learners.ess.gain)} | ${fmt(recog.learners.ess.gain)} |`,
    );
  }
  lines.push('');
  lines.push('## Read');
  lines.push('');
  lines.push(
    'ESS constrains learner improvement to families actually addressed by the tutor plan; roleplay allows broader spillover. Treat roleplay inflation as an instrument-validity warning, not a tutor effect.',
  );
  lines.push('');
  return lines.join('\n');
}

function writeArtifacts({ result, outJson, outMd }) {
  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(result, null, 2)}\n`);
  fs.mkdirSync(path.dirname(outMd), { recursive: true });
  fs.writeFileSync(outMd, renderEssReport(result));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runEssProbe(args);
  if (args.write) {
    writeArtifacts({ result, outJson: path.resolve(args.outJson), outMd: path.resolve(args.outMd) });
    console.log(`wrote ${args.outJson}`);
    console.log(`wrote ${args.outMd}`);
  }
  console.log(
    `${result.status}: recognition_ess_lift=${fmt(result.summary.recognitionEssLift)} roleplay_inflation=${fmt(
      result.summary.roleplayInflation,
    )} calls=${result.summary.modelCalls.total}`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error('FATAL:', err);
    process.exit(1);
  });
}
