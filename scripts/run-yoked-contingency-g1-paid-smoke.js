#!/usr/bin/env node
/**
 * Bounded paid-quota G1 smoke for the yoked-contingency design.
 *
 * G0 established that visible prose can be non-diagnostic while behavior
 * remains diagnosable. G1 tests whether same-state yoked tutor plans help more
 * than different-state yoked tutor plans under programmatic item outcomes.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MISCONCEPTION_FAMILIES,
  estimateStateFromBehavior,
  loadTaggedPilotItems,
  seedTable,
  simulateItemResponses,
} from './run-yoked-contingency-smoke.js';
import {
  FAMILY_DESCRIPTIONS,
  callBackend,
  canonicalBackend,
  createCallCounter,
  fmt,
  mean,
  parseJsonResponse,
} from './run-yoked-contingency-g0-paid-smoke.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

export const G1_ARM_LABELS = {
  contingent: 'contingent',
  same_seed_yoked: 'same-seed yoked',
  different_seed_yoked: 'different-seed yoked',
};

const DEFAULTS = {
  backend: 'codex',
  sessions: 3,
  planTurns: 4,
  maxCalls: 12,
  minDiagnosisDelta: 0.05,
  outJson: path.join(ROOT, 'exports', 'yoked-contingency-g1-paid-smoke.json'),
  outMd: path.join(ROOT, 'exports', 'yoked-contingency-g1-paid-smoke.md'),
};

export const G1_SESSION_SPECS = [
  { sessionId: 'g1-alpha-01', targetSeed: 'alpha', sameSeedSource: 'alpha_peer', differentSeedSource: 'beta' },
  { sessionId: 'g1-beta-01', targetSeed: 'beta', sameSeedSource: 'beta', differentSeedSource: 'alpha' },
  { sessionId: 'g1-gamma-01', targetSeed: 'gamma', sameSeedSource: 'gamma', differentSeedSource: 'alpha' },
];

function parseArgs(argv) {
  const args = { ...DEFAULTS, write: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--backend') args.backend = argv[++i];
    else if (a === '--sessions') args.sessions = Number(argv[++i]);
    else if (a === '--plan-turns') args.planTurns = Number(argv[++i]);
    else if (a === '--max-calls') args.maxCalls = Number(argv[++i]);
    else if (a === '--min-diagnosis-delta') args.minDiagnosisDelta = Number(argv[++i]);
    else if (a === '--out-json') args.outJson = argv[++i];
    else if (a === '--out-md') args.outMd = argv[++i];
    else if (a === '--dry-run') args.backend = 'mock';
    else if (a === '--no-write') args.write = false;
    else if (a === '-h' || a === '--help') {
      console.log(`Usage: node scripts/run-yoked-contingency-g1-paid-smoke.js [options]

Options:
  --backend <codex|claude-code|mock>  Tutor-plan generator (default: codex)
  --sessions <n>                      Sessions to run (default: 3)
  --plan-turns <n>                    Tutor plan turns per arm (default: 4)
  --max-calls <n>                     Hard model-call cap (default: 12)
  --min-diagnosis-delta <x>           Δ2 pass threshold (default: 0.05)
  --out-json <path>                   JSON artifact path
  --out-md <path>                     Markdown artifact path
  --dry-run                           Use mock plan generator
  --no-write                          Return result without writing artifacts`);
      process.exit(0);
    } else {
      throw new Error(`unknown flag: ${a}`);
    }
  }
  if (!Number.isInteger(args.sessions) || args.sessions < 1) throw new Error('--sessions must be a positive integer');
  if (!Number.isInteger(args.planTurns) || args.planTurns < 1)
    throw new Error('--plan-turns must be a positive integer');
  if (!Number.isInteger(args.maxCalls) || args.maxCalls < 1) throw new Error('--max-calls must be a positive integer');
  if (!Number.isFinite(args.minDiagnosisDelta)) throw new Error('--min-diagnosis-delta must be numeric');
  return args;
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

function visibleAffectForResponse(response) {
  return response.is_seeded_error
    ? 'I feel unsure about that one and would like help checking my thinking.'
    : 'I feel fairly confident, but I would still like to understand the pattern better.';
}

export function buildBehaviorLog({ learnerId, seedId, items, responses }) {
  const itemById = new Map(items.map((item) => [item.id, item]));
  return {
    learnerId,
    seedId,
    rows: responses.map((response) => {
      const item = itemById.get(response.item_id);
      const selected = selectedChoice(item, response);
      const correct = correctChoice(item);
      return {
        item_id: response.item_id,
        stem: item.stem,
        selected: `${selected.value}. ${selected.label}`,
        correct: `${correct.value}. ${correct.label}`,
        result: response.is_seeded_error ? 'not accepted' : 'accepted',
        visible_prose: visibleAffectForResponse(response),
      };
    }),
  };
}

export function buildTutorPlanPrompt({ sourceLog, planTurns }) {
  const familyList = MISCONCEPTION_FAMILIES.map((family) => `- ${family}: ${FAMILY_DESCRIPTIONS[family]}`).join('\n');
  const behaviorRows = sourceLog.rows
    .map(
      (row, index) => `${index + 1}. ${row.item_id}
Stem: ${row.stem}
Selected: ${row.selected}
Correct: ${row.correct}
Result: ${row.result}
Visible learner message: ${row.visible_prose}`,
    )
    .join('\n\n');

  return `You are making a short fractions tutoring plan from behavior logs.

Visible learner messages are affect-only. Infer the math need from selected answers, correct answers, and accepted/not-accepted results.

Choose exactly ${planTurns} micro-interventions. Each target_family must be one of the candidate family names below. Do not invent family names.

Candidate families:
${familyList}

Behavior log for source learner ${sourceLog.learnerId}:
${behaviorRows}

Return JSON only:
{
  "inferred_active_families": ["family_name"],
  "plan": [
    {"turn": 0, "target_family": "family_name", "intervention": "one concrete tutor move"}
  ],
  "rationale": "brief behavior-based reason"
}`;
}

function exactSameMembers(a, b) {
  if (a.length !== b.length) return false;
  const bs = new Set(b);
  return a.every((x) => bs.has(x));
}

function normalizePlan(parsed, { sourceLearnerId, arm, planTurns }) {
  const rawPlan = Array.isArray(parsed.plan) ? parsed.plan : [];
  const plan = rawPlan.slice(0, planTurns).map((step, index) => ({
    sourceLearnerId,
    arm,
    turn: Number.isInteger(step.turn) ? step.turn : index,
    targetFamily: String(step.target_family || step.targetFamily || '').trim(),
    intervention: String(step.intervention || step.text || '').trim(),
  }));
  const invalidTargetFamilies = plan
    .map((step) => step.targetFamily)
    .filter((family) => !MISCONCEPTION_FAMILIES.includes(family));
  const inferred = Array.isArray(parsed.inferred_active_families)
    ? parsed.inferred_active_families.filter((family) => MISCONCEPTION_FAMILIES.includes(family))
    : [];
  return {
    inferredActiveFamilies: inferred,
    plan,
    rationale: String(parsed.rationale || '').trim(),
    invalidTargetFamilies,
    planLengthValid: plan.length === planTurns,
  };
}

function mockTutorPlan({ sourceSeed, sourceLearnerId, arm, planTurns }) {
  const state = seedTable(sourceSeed);
  const active = MISCONCEPTION_FAMILIES.filter((family) => state[family]);
  const plan = [];
  for (let i = 0; i < planTurns; i++) {
    const targetFamily = active[i % active.length];
    plan.push({
      sourceLearnerId,
      arm,
      turn: i,
      targetFamily,
      intervention: `Mock intervention for ${targetFamily}`,
    });
  }
  return {
    inferredActiveFamilies: active,
    plan,
    rationale: 'mock plan from seeded behavior',
    invalidTargetFamilies: [],
    planLengthValid: true,
  };
}

async function generateTutorPlan({ sourceLog, sourceSeed, sourceLearnerId, arm, backend, planTurns, callCounter }) {
  if (canonicalBackend(backend) === 'mock') {
    return mockTutorPlan({ sourceSeed, sourceLearnerId, arm, planTurns });
  }
  callCounter.increment('tutor_plan');
  const raw = await callBackend(buildTutorPlanPrompt({ sourceLog, planTurns }), backend);
  const parsed = parseJsonResponse(raw);
  return normalizePlan(parsed, { sourceLearnerId, arm, planTurns });
}

function applyTutorPlan(learnerState, tutorPlan, { responsivenessWeight, yokedWeight }) {
  const mastery = Object.fromEntries(MISCONCEPTION_FAMILIES.map((family) => [family, 0]));
  for (const turn of tutorPlan) {
    if (!learnerState[turn.targetFamily]) continue;
    const increment = turn.arm === 'contingent' ? responsivenessWeight : yokedWeight;
    mastery[turn.targetFamily] = Math.min(1, mastery[turn.targetFamily] + increment);
  }
  return mastery;
}

function armSourceSpec(spec, arm) {
  if (arm === 'contingent') {
    return { sourceSeed: spec.targetSeed, sourceLearnerId: `${spec.sessionId}-target`, responsive: true };
  }
  if (arm === 'same_seed_yoked') {
    return { sourceSeed: spec.sameSeedSource, sourceLearnerId: `${spec.sessionId}-same-peer`, responsive: false };
  }
  if (arm === 'different_seed_yoked') {
    return {
      sourceSeed: spec.differentSeedSource,
      sourceLearnerId: `${spec.sessionId}-different-peer`,
      responsive: false,
    };
  }
  throw new Error(`unknown arm: ${arm}`);
}

function scoreResponses(responses) {
  return mean(responses.map((response) => response.expected_correct));
}

async function runG1Session({ spec, items, backend, planTurns, callCounter, responsivenessWeight, yokedWeight }) {
  const preItems = items.filter((item) => item.form === 'A');
  const postItems = items.filter((item) => item.form === 'B');
  const targetState = seedTable(spec.targetSeed);
  const targetActiveFamilies = MISCONCEPTION_FAMILIES.filter((family) => targetState[family]);
  const targetPreResponses = simulateItemResponses(preItems, targetState);
  const preScore = scoreResponses(targetPreResponses);

  const arms = [];
  for (const arm of ['contingent', 'same_seed_yoked', 'different_seed_yoked']) {
    const sourceSpec = armSourceSpec(spec, arm);
    const sourceState = seedTable(sourceSpec.sourceSeed);
    const sourceActiveFamilies = MISCONCEPTION_FAMILIES.filter((family) => sourceState[family]);
    const sourceResponses = simulateItemResponses(preItems, sourceState);
    const sourceBehaviorRecovered = estimateStateFromBehavior(sourceResponses)
      .filter((row) => row.predictedActive)
      .map((row) => row.family);
    const sourceLog = buildBehaviorLog({
      learnerId: sourceSpec.sourceLearnerId,
      seedId: sourceSpec.sourceSeed,
      items: preItems,
      responses: sourceResponses,
    });
    console.log(`g1 paid smoke: ${spec.sessionId} ${arm} plan via ${backend}`);
    const tutorPlan = await generateTutorPlan({
      sourceLog,
      sourceSeed: sourceSpec.sourceSeed,
      sourceLearnerId: sourceSpec.sourceLearnerId,
      arm,
      backend,
      planTurns,
      callCounter,
    });
    const mastery = applyTutorPlan(targetState, tutorPlan.plan, { responsivenessWeight, yokedWeight });
    const postResponses = simulateItemResponses(postItems, targetState, mastery);
    const postScore = scoreResponses(postResponses);
    const targetActiveTargets = tutorPlan.plan.filter((turn) => targetState[turn.targetFamily]).length;
    const targetInactiveTargets = tutorPlan.plan.filter(
      (turn) => MISCONCEPTION_FAMILIES.includes(turn.targetFamily) && !targetState[turn.targetFamily],
    ).length;
    arms.push({
      arm,
      label: G1_ARM_LABELS[arm],
      sourceSeed: sourceSpec.sourceSeed,
      sourceLearnerId: sourceSpec.sourceLearnerId,
      responsive: sourceSpec.responsive,
      sourceActiveFamilies,
      sourceBehaviorRecoveredActiveFamilies: sourceBehaviorRecovered,
      sourceBehaviorExact: exactSameMembers(sourceBehaviorRecovered, sourceActiveFamilies),
      inferredActiveFamilies: tutorPlan.inferredActiveFamilies,
      plan: tutorPlan.plan,
      planLengthValid: tutorPlan.planLengthValid,
      invalidTargetFamilies: tutorPlan.invalidTargetFamilies,
      rationale: tutorPlan.rationale,
      targetActiveTargets,
      targetInactiveTargets,
      mastery,
      preScore,
      postScore,
      gain: Number((postScore - preScore).toFixed(3)),
    });
  }

  const byArm = Object.fromEntries(arms.map((arm) => [arm.arm, arm]));
  return {
    sessionId: spec.sessionId,
    targetSeed: spec.targetSeed,
    targetActiveFamilies,
    arms,
    contrasts: {
      delta1_responsiveness: Number((byArm.contingent.gain - byArm.same_seed_yoked.gain).toFixed(3)),
      delta2_diagnosis: Number((byArm.same_seed_yoked.gain - byArm.different_seed_yoked.gain).toFixed(3)),
    },
  };
}

function scaledPassThreshold(sessionCount) {
  return sessionCount >= 9 ? 7 : 1;
}

export async function runG1PaidSmoke({
  backend = DEFAULTS.backend,
  sessions = DEFAULTS.sessions,
  planTurns = DEFAULTS.planTurns,
  maxCalls = DEFAULTS.maxCalls,
  minDiagnosisDelta = DEFAULTS.minDiagnosisDelta,
  items = loadTaggedPilotItems(),
  sessionSpecs = G1_SESSION_SPECS,
  responsivenessWeight = 0.5,
  yokedWeight = 0.32,
} = {}) {
  const selectedSpecs = [];
  for (let i = 0; i < sessions; i++) {
    const base = sessionSpecs[i % sessionSpecs.length];
    const repeat = Math.floor(i / sessionSpecs.length) + 1;
    selectedSpecs.push({
      ...base,
      sessionId:
        repeat === 1 ? base.sessionId : `${base.sessionId.replace(/-\\d+$/, '')}-${String(repeat).padStart(2, '0')}`,
    });
  }
  const callCounter = createCallCounter(maxCalls);
  const sessionRows = [];
  for (const spec of selectedSpecs) {
    sessionRows.push(
      await runG1Session({
        spec,
        items,
        backend,
        planTurns,
        callCounter,
        responsivenessWeight,
        yokedWeight,
      }),
    );
  }

  const flatArms = sessionRows.flatMap((session) => session.arms);
  const armsByLabel = Object.fromEntries(
    ['contingent', 'same_seed_yoked', 'different_seed_yoked'].map((arm) => [
      arm,
      flatArms.filter((row) => row.arm === arm),
    ]),
  );
  const meanGainByArm = Object.fromEntries(
    Object.entries(armsByLabel).map(([arm, rows]) => [arm, Number(mean(rows.map((row) => row.gain)).toFixed(3))]),
  );
  const sameSeedActiveTargets = mean(armsByLabel.same_seed_yoked.map((row) => row.targetActiveTargets));
  const differentSeedActiveTargets = mean(armsByLabel.different_seed_yoked.map((row) => row.targetActiveTargets));
  const delta1 = Number((meanGainByArm.contingent - meanGainByArm.same_seed_yoked).toFixed(3));
  const delta2 = Number((meanGainByArm.same_seed_yoked - meanGainByArm.different_seed_yoked).toFixed(3));
  const invalidPlanCount = flatArms.filter(
    (row) => row.invalidTargetFamilies.length > 0 || !row.planLengthValid,
  ).length;
  const sourceBehaviorExactCount = flatArms.filter((row) => row.sourceBehaviorExact).length;
  const sameGreaterSessionCount = sessionRows.filter((session) => {
    const byArm = Object.fromEntries(session.arms.map((arm) => [arm.arm, arm]));
    return byArm.same_seed_yoked.gain > byArm.different_seed_yoked.gain;
  }).length;
  const scaleRequiredSameGreater = scaledPassThreshold(sessionRows.length);
  const pass =
    sourceBehaviorExactCount === flatArms.length &&
    invalidPlanCount === 0 &&
    sameSeedActiveTargets > differentSeedActiveTargets &&
    delta2 >= minDiagnosisDelta &&
    delta1 >= 0 &&
    sameGreaterSessionCount >= scaleRequiredSameGreater;

  return {
    schema: 'yoked_contingency_g1_paid_smoke_v0_1',
    generatedAt: new Date().toISOString(),
    status: pass ? 'pass_g1_paid_smoke' : 'fail_g1_paid_smoke',
    boundary:
      sessionRows.length >= 9
        ? 'scaled paid-quota G1 follow-up; not a full battery and not a paper claim'
        : 'bounded paid-quota G1 smoke; not a full battery and not a paper claim',
    preregistration:
      sessionRows.length >= 9
        ? 'PLAN_2_0/yoked-contingency-g1-scaled-preregistration.md'
        : 'PLAN_2_0/yoked-contingency-g1-paid-smoke-preregistration.md',
    backend: canonicalBackend(backend),
    visibleProseProtocol: 'visible-affect',
    sessions: sessionRows,
    thresholds: {
      minDiagnosisDelta,
      requiredInvalidPlanCount: 0,
      requiredSourceBehaviorExactCount: flatArms.length,
      requiredSameGreaterSessionCount: scaleRequiredSameGreater,
    },
    summary: {
      sessionCount: sessionRows.length,
      armsPerSession: 3,
      planTurns,
      modelCalls: callCounter.counts,
      meanGainByArm,
      delta1_responsiveness: delta1,
      delta2_diagnosis: delta2,
      sameSeedActiveTargets: Number(sameSeedActiveTargets.toFixed(3)),
      differentSeedActiveTargets: Number(differentSeedActiveTargets.toFixed(3)),
      sameGreaterSessionCount,
      sourceBehaviorExactCount,
      invalidPlanCount,
    },
  };
}

export function renderG1PaidSmokeReport(result) {
  const lines = [];
  lines.push('# Yoked-contingency G1 paid smoke');
  lines.push('');
  lines.push(`Generated: ${result.generatedAt}`);
  lines.push(`Status: ${result.status}`);
  lines.push('');
  lines.push(`Boundary: ${result.boundary}.`);
  lines.push('');
  lines.push(`Preregistration: ${result.preregistration}`);
  lines.push(`Generator: ${result.backend}`);
  lines.push(`Visible prose protocol: ${result.visibleProseProtocol}`);
  lines.push(`Model calls: ${result.summary.modelCalls.total}`);
  lines.push('');
  lines.push('## Primary contrasts');
  lines.push('');
  lines.push(`- Δ1 responsiveness/coherence = ${fmt(result.summary.delta1_responsiveness)}`);
  lines.push(
    `- Δ2 diagnosis = ${fmt(result.summary.delta2_diagnosis)} (threshold >= ${fmt(result.thresholds.minDiagnosisDelta)})`,
  );
  lines.push('');
  lines.push('## Validity checks');
  lines.push('');
  lines.push(
    `- Source behavior exact: ${result.summary.sourceBehaviorExactCount}/${result.thresholds.requiredSourceBehaviorExactCount}`,
  );
  lines.push(`- Invalid or short plans: ${result.summary.invalidPlanCount}`);
  lines.push(`- Same-seed active targets: ${fmt(result.summary.sameSeedActiveTargets)}`);
  lines.push(`- Different-seed active targets: ${fmt(result.summary.differentSeedActiveTargets)}`);
  lines.push(
    `- Sessions where same-seed gain > different-seed gain: ${result.summary.sameGreaterSessionCount}/${result.summary.sessionCount}`,
  );
  lines.push('');
  lines.push('## Mean gains');
  lines.push('');
  lines.push('| Arm | Mean gain |');
  lines.push('|---|---:|');
  for (const arm of ['contingent', 'same_seed_yoked', 'different_seed_yoked']) {
    lines.push(`| ${G1_ARM_LABELS[arm]} | ${fmt(result.summary.meanGainByArm[arm])} |`);
  }
  lines.push('');
  lines.push('## Sessions');
  lines.push('');
  lines.push('| Session | Target seed | Contingent gain | Same-seed gain | Different-seed gain | Δ2 |');
  lines.push('|---|---|---:|---:|---:|---:|');
  for (const session of result.sessions) {
    const byArm = Object.fromEntries(session.arms.map((arm) => [arm.arm, arm]));
    lines.push(
      `| ${session.sessionId} | ${session.targetSeed} | ${fmt(byArm.contingent.gain)} | ${fmt(
        byArm.same_seed_yoked.gain,
      )} | ${fmt(byArm.different_seed_yoked.gain)} | ${fmt(session.contrasts.delta2_diagnosis)} |`,
    );
  }
  lines.push('');
  lines.push('## Read');
  lines.push('');
  if (result.status === 'pass_g1_paid_smoke') {
    lines.push(
      'The run supports the G1 diagnosis contrast under this bounded protocol: same-state yoked plans outperform different-state yoked plans on programmatic item outcomes.',
    );
  } else {
    lines.push(
      'Do not scale or interpret this as support for G1 without addressing the failed validity or contrast check.',
    );
  }
  lines.push('');
  return lines.join('\n');
}

export function writeG1PaidSmokeArtifacts({ result, outJson = DEFAULTS.outJson, outMd = DEFAULTS.outMd }) {
  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(result, null, 2)}\n`);
  fs.mkdirSync(path.dirname(outMd), { recursive: true });
  fs.writeFileSync(outMd, renderG1PaidSmokeReport(result));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runG1PaidSmoke(args);
  if (args.write) {
    writeG1PaidSmokeArtifacts({
      result,
      outJson: path.resolve(args.outJson),
      outMd: path.resolve(args.outMd),
    });
    console.log(`wrote ${args.outJson}`);
    console.log(`wrote ${args.outMd}`);
  }
  console.log(
    `${result.status}: Δ1=${fmt(result.summary.delta1_responsiveness)} Δ2=${fmt(
      result.summary.delta2_diagnosis,
    )} calls=${result.summary.modelCalls.total}`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error('FATAL:', err);
    process.exit(1);
  });
}
