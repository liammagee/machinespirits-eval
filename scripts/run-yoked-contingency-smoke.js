#!/usr/bin/env node
/**
 * Zero-cost yoked-contingency smoke for the adaptation-ecology G1 design.
 *
 * This is not an empirical result. It is a deterministic wiring harness that
 * pins the causal estimand before any paid generation:
 *   Δ1 = contingent - same-seed-yoked      (responsiveness/coherence term)
 *   Δ2 = same-seed-yoked - different-seed-yoked (diagnosis term)
 *
 * It uses the pilot fractions item IDs with analysis-side misconception tags so
 * the production pilot item bank remains unchanged.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as pilotItemBank from '../services/pilotItemBank.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

export const MISCONCEPTION_FAMILIES = [
  'same_denominator_operation',
  'magnitude_denominator_bias',
  'equivalence_scaling',
  'fraction_of_quantity',
  'part_whole_mapping',
];

const FAMILY_BY_ITEM_ID = {
  'fr-a-001': 'same_denominator_operation',
  'fr-a-002': 'same_denominator_operation',
  'fr-a-003': 'magnitude_denominator_bias',
  'fr-a-004': 'part_whole_mapping',
  'fr-a-005': 'equivalence_scaling',
  'fr-a-006': 'fraction_of_quantity',
  'fr-a-007': 'magnitude_denominator_bias',
  'fr-a-008': 'same_denominator_operation',
  'fr-a-009': 'equivalence_scaling',
  'fr-a-010': 'fraction_of_quantity',
  'fr-b-001': 'same_denominator_operation',
  'fr-b-002': 'same_denominator_operation',
  'fr-b-003': 'magnitude_denominator_bias',
  'fr-b-004': 'part_whole_mapping',
  'fr-b-005': 'equivalence_scaling',
  'fr-b-006': 'fraction_of_quantity',
  'fr-b-007': 'magnitude_denominator_bias',
  'fr-b-008': 'same_denominator_operation',
  'fr-b-009': 'equivalence_scaling',
  'fr-b-010': 'fraction_of_quantity',
};

const SEED_TABLES = {
  alpha: ['same_denominator_operation', 'magnitude_denominator_bias'],
  alpha_peer: ['same_denominator_operation', 'magnitude_denominator_bias'],
  beta: ['equivalence_scaling', 'fraction_of_quantity'],
  gamma: ['part_whole_mapping', 'equivalence_scaling'],
};

const ARM_LABELS = {
  contingent: 'contingent',
  same_seed_yoked: 'same-seed yoked',
  different_seed_yoked: 'different-seed yoked',
};

function parseArgs(argv) {
  const args = {
    outJson: path.join(ROOT, 'exports', 'yoked-contingency-smoke.json'),
    outMd: path.join(ROOT, 'exports', 'yoked-contingency-smoke.md'),
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out-json') args.outJson = argv[++i];
    else if (a === '--out-md') args.outMd = argv[++i];
    else if (a === '-h' || a === '--help') {
      console.log(`Usage: node scripts/run-yoked-contingency-smoke.js [options]

Options:
  --out-json <path>  JSON artifact path (default: exports/yoked-contingency-smoke.json)
  --out-md <path>    Markdown report path (default: exports/yoked-contingency-smoke.md)`);
      process.exit(0);
    } else {
      throw new Error(`unknown flag: ${a}`);
    }
  }
  return args;
}

function mean(xs) {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
}

function fmt(x, digits = 3) {
  return Number.isFinite(x) ? x.toFixed(digits) : 'n/a';
}

function wrongChoice(item) {
  return item.choices.find((choice) => choice.value !== item.correct)?.value || null;
}

export function loadTaggedPilotItems() {
  const forms = pilotItemBank.loadItems().forms;
  const rows = [];
  for (const [form, items] of Object.entries(forms)) {
    for (const item of items) {
      const family = FAMILY_BY_ITEM_ID[item.id];
      if (!family) throw new Error(`no yoked-contingency misconception family for item ${item.id}`);
      rows.push({ ...item, form, family });
    }
  }
  return rows;
}

export function seedTable(seedId) {
  const families = SEED_TABLES[seedId];
  if (!families) throw new Error(`unknown seed table: ${seedId}`);
  return Object.fromEntries(MISCONCEPTION_FAMILIES.map((family) => [family, families.includes(family)]));
}

export function simulateItemResponses(items, learnerState, masteryByFamily = {}) {
  return items.map((item, position) => {
    const hasMisconception = learnerState[item.family] === true;
    const mastery = masteryByFamily[item.family] || 0;
    const expectedCorrect = hasMisconception ? 0.15 + 0.75 * mastery : 0.9;
    return {
      item_id: item.id,
      item_position: position,
      family: item.family,
      response_value: hasMisconception && mastery < 0.95 ? wrongChoice(item) : item.correct,
      expected_correct: Number(expectedCorrect.toFixed(3)),
      is_seeded_error: hasMisconception && mastery < 0.95,
    };
  });
}

export function estimateStateFromBehavior(responses) {
  const byFamily = new Map();
  for (const response of responses) {
    const bucket = byFamily.get(response.family) || { family: response.family, n: 0, seededErrors: 0 };
    bucket.n += 1;
    if (response.is_seeded_error) bucket.seededErrors += 1;
    byFamily.set(response.family, bucket);
  }
  return [...byFamily.values()]
    .map((bucket) => ({
      family: bucket.family,
      errorRate: bucket.seededErrors / bucket.n,
      predictedActive: bucket.seededErrors / bucket.n >= 0.5,
    }))
    .sort((a, b) => b.errorRate - a.errorRate || a.family.localeCompare(b.family));
}

export function estimateStateFromProse(proseTurns) {
  const text = proseTurns.join(' ').toLowerCase();
  return MISCONCEPTION_FAMILIES.map((family) => ({
    family,
    evidenceHits: (text.match(new RegExp(family, 'g')) || []).length,
    predictedActive: false,
  }));
}

export function buildTutorPlan({ sourceLearnerId, seedId, responsive }) {
  const state = seedTable(seedId);
  const active = MISCONCEPTION_FAMILIES.filter((family) => state[family]);
  const targets = [active[0], active[1], active[0], active[1]].filter(Boolean);
  return targets.map((targetFamily, turn) => ({
    sourceLearnerId,
    turn,
    targetFamily,
    responsive,
    text: responsive
      ? `I am responding to your last answer by testing ${targetFamily} with a short check.`
      : `Here is the next check from another learner's session about ${targetFamily}.`,
  }));
}

function applyTutorPlan(learnerState, tutorPlan, { responsivenessWeight }) {
  const mastery = Object.fromEntries(MISCONCEPTION_FAMILIES.map((family) => [family, 0]));
  for (const turn of tutorPlan) {
    if (!learnerState[turn.targetFamily]) continue;
    const increment = turn.responsive ? 0.5 : responsivenessWeight;
    mastery[turn.targetFamily] = Math.min(1, mastery[turn.targetFamily] + increment);
  }
  return mastery;
}

export function runYokedContingencyExperiment({
  items = loadTaggedPilotItems(),
  targetSeed = 'alpha',
  sameSeedSource = 'alpha_peer',
  differentSeedSource = 'beta',
  responsivenessWeight = 0.32,
} = {}) {
  const preItems = items.filter((item) => item.form === 'A');
  const postItems = items.filter((item) => item.form === 'B');
  const targetState = seedTable(targetSeed);
  const targetProse = [
    'I am not sure why this one feels different.',
    'I might be mixing up the steps, but I cannot name the pattern.',
  ];
  const preResponses = simulateItemResponses(preItems, targetState);
  const proseProbe = estimateStateFromProse(targetProse);
  const behaviorProbe = estimateStateFromBehavior(preResponses);

  const armSpecs = [
    {
      arm: 'contingent',
      sourceSeed: targetSeed,
      sourceLearnerId: 'target-learner',
      responsive: true,
    },
    {
      arm: 'same_seed_yoked',
      sourceSeed: sameSeedSource,
      sourceLearnerId: 'same-seed-peer',
      responsive: false,
    },
    {
      arm: 'different_seed_yoked',
      sourceSeed: differentSeedSource,
      sourceLearnerId: 'different-seed-peer',
      responsive: false,
    },
  ];

  const arms = armSpecs.map((spec) => {
    const tutorPlan = buildTutorPlan({
      sourceLearnerId: spec.sourceLearnerId,
      seedId: spec.sourceSeed,
      responsive: spec.responsive,
    });
    const mastery = applyTutorPlan(targetState, tutorPlan, { responsivenessWeight });
    const postResponses = simulateItemResponses(postItems, targetState, mastery);
    const preScore = mean(preResponses.map((r) => r.expected_correct));
    const postScore = mean(postResponses.map((r) => r.expected_correct));
    return {
      ...spec,
      label: ARM_LABELS[spec.arm],
      tutorPlan,
      mastery,
      preScore,
      postScore,
      gain: Number((postScore - preScore).toFixed(3)),
      targetedActiveFamilies: tutorPlan.filter((turn) => targetState[turn.targetFamily]).length,
      targetedInactiveFamilies: tutorPlan.filter((turn) => !targetState[turn.targetFamily]).length,
    };
  });

  const byArm = Object.fromEntries(arms.map((arm) => [arm.arm, arm]));
  const contrasts = {
    delta1_responsiveness: Number((byArm.contingent.gain - byArm.same_seed_yoked.gain).toFixed(3)),
    delta2_diagnosis: Number((byArm.same_seed_yoked.gain - byArm.different_seed_yoked.gain).toFixed(3)),
  };

  return {
    schema: 'yoked_contingency_smoke_v0_1',
    generatedAt: new Date().toISOString(),
    status: 'mock_wiring_only_not_empirical',
    targetSeed,
    sameSeedSource,
    differentSeedSource,
    probes: {
      prose: proseProbe,
      behavior: behaviorProbe,
      behaviorRecoveredActiveFamilies: behaviorProbe.filter((row) => row.predictedActive).map((row) => row.family),
    },
    arms,
    contrasts,
    reads: {
      g0:
        proseProbe.every((row) => !row.predictedActive) &&
        behaviorProbe.filter((row) => row.predictedActive).length === Object.values(targetState).filter(Boolean).length
          ? 'mock_pass_opacity_plus_diagnosability'
          : 'mock_fail_probe',
      g1:
        contrasts.delta2_diagnosis > 0
          ? 'mock_headroom_exists_when_diagnosis_is_yoked_correctly'
          : 'mock_no_diagnosis_headroom',
    },
  };
}

export function renderYokedContingencyReport(result) {
  const lines = [];
  lines.push('# Yoked-contingency smoke');
  lines.push('');
  lines.push(`Generated: ${result.generatedAt}`);
  lines.push('');
  lines.push('This is a deterministic plumbing check, not a paid generation result and not a paper claim.');
  lines.push('');
  lines.push('## Avenues 1-4');
  lines.push('');
  lines.push('| Avenue | Current smoke verdict | Evidence |');
  lines.push('|---|---|---|');
  lines.push(
    `| 1. State validity | ${result.reads.g0} | Prose predicts ${result.probes.prose.filter((row) => row.predictedActive).length} active families; behavior predicts ${result.probes.behaviorRecoveredActiveFamilies.join(', ')}. |`,
  );
  lines.push(
    '| 2. Policy validity | wired | Tutor plans carry explicit target misconception families; same-seed plans target active families, different-seed plans do not. |',
  );
  lines.push(
    '| 3. Realization/yoking validity | wired | Same-seed and different-seed arms replay tutor plans generated for other learners while the target learner remains live in the state update. |',
  );
  lines.push(
    '| 4. Outcome validity | wired | Pre/post scores are computed from item-family correctness, not from an LLM judge. |',
  );
  lines.push('');
  lines.push('## Arms');
  lines.push('');
  lines.push('| Arm | Source seed | Responsive? | Active targets | Inactive targets | Pre | Post | Gain |');
  lines.push('|---|---|---:|---:|---:|---:|---:|---:|');
  for (const arm of result.arms) {
    lines.push(
      `| ${arm.label} | ${arm.sourceSeed} | ${arm.responsive ? 'yes' : 'no'} | ${arm.targetedActiveFamilies} | ${arm.targetedInactiveFamilies} | ${fmt(arm.preScore)} | ${fmt(arm.postScore)} | ${fmt(arm.gain)} |`,
    );
  }
  lines.push('');
  lines.push('## Contrasts');
  lines.push('');
  lines.push(`- Δ1 responsiveness/coherence = ${fmt(result.contrasts.delta1_responsiveness)}`);
  lines.push(`- Δ2 diagnosis = ${fmt(result.contrasts.delta2_diagnosis)}`);
  lines.push(`- Mock read: ${result.reads.g1}`);
  lines.push('');
  lines.push('## Boundary');
  lines.push('');
  lines.push(
    'This harness proves the causal geometry is executable under deterministic item outcomes. The next real step would be an attended G0 generation gate for opaque-but-diagnosable seeded learners, then the paid G1 yoked run only if G0 passes.',
  );
  lines.push('');
  return lines.join('\n');
}

export function writeYokedContingencyArtifacts({ outJson, outMd } = {}) {
  const result = runYokedContingencyExperiment();
  const report = renderYokedContingencyReport(result);
  if (outJson) {
    fs.mkdirSync(path.dirname(outJson), { recursive: true });
    fs.writeFileSync(outJson, `${JSON.stringify(result, null, 2)}\n`);
  }
  if (outMd) {
    fs.mkdirSync(path.dirname(outMd), { recursive: true });
    fs.writeFileSync(outMd, report);
  }
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = writeYokedContingencyArtifacts({
    outJson: path.resolve(args.outJson),
    outMd: path.resolve(args.outMd),
  });
  console.log(`wrote ${args.outJson}`);
  console.log(`wrote ${args.outMd}`);
  console.log(`Δ1=${fmt(result.contrasts.delta1_responsiveness)} Δ2=${fmt(result.contrasts.delta2_diagnosis)}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error('FATAL:', err);
    process.exit(1);
  });
}
