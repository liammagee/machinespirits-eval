#!/usr/bin/env node
/**
 * Plan 3 SFS audit: matched targeted/mismatched/generic learner flips.
 *
 * Selective Flip Score asks whether a simulated learner corrects a seeded
 * misconception selectively: it should flip after feedback that addresses the
 * misconception, and should not flip at the same rate after mismatched or
 * generic feedback.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
import {
  MISCONCEPTION_FAMILIES,
  loadTaggedPilotItems,
  simulateItemResponses,
} from './run-yoked-contingency-smoke.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const CONDITIONS = ['targeted', 'mismatched', 'generic'];

const DEFAULTS = {
  backend: 'codex',
  families: 'all',
  replicates: 10,
  maxCalls: null,
  outJson: path.join(ROOT, 'exports', 'plan3-sfs-audit', 'sfs-matched-feedback.json'),
  outMd: path.join(ROOT, 'exports', 'plan3-sfs-audit', 'sfs-matched-feedback.md'),
};

const TARGETED_FEEDBACK = {
  same_denominator_operation:
    'Your answer combined the denominators as if the denominator is another count to add. For same-denominator addition, keep the denominator as the size of the pieces and add only the numerators.',
  magnitude_denominator_bias:
    'Your answer treated the larger denominator as the larger amount. When the numerators are the same, the larger denominator means smaller pieces, so compare the size of the pieces.',
  equivalence_scaling:
    'Your answer did not preserve equivalent scaling. To make an equivalent fraction, multiply or divide the numerator and denominator by the same factor.',
  fraction_of_quantity:
    'Your answer treated the denominator like the final amount. A fraction of a quantity means split the whole into denominator-sized equal groups, then take the numerator number of groups.',
  part_whole_mapping:
    'Your answer counted the wrong whole. A fraction should name the selected equal parts over the total equal parts in the original whole.',
};

const GENERIC_FEEDBACK =
  'That answer is not accepted yet. Try the item again by slowing down, checking what the question is asking, and choosing the option that best fits the fractions.';

function parseArgs(argv) {
  const args = { ...DEFAULTS, write: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--backend') args.backend = argv[++i];
    else if (a === '--families') args.families = argv[++i];
    else if (a === '--replicates') args.replicates = Number(argv[++i]);
    else if (a === '--max-calls') args.maxCalls = Number(argv[++i]);
    else if (a === '--out-json') args.outJson = argv[++i];
    else if (a === '--out-md') args.outMd = argv[++i];
    else if (a === '--dry-run') args.backend = 'mock';
    else if (a === '--no-write') args.write = false;
    else if (a === '-h' || a === '--help') {
      console.log(`Usage: node scripts/run-plan3-sfs-audit.js [options]

Options:
  --backend <codex|claude-code[:model]|openrouter[:model]|agy[:model]|mock>
                           Learner-response generator (default: codex)
  --families <all|csv>     Misconception families to include (default: all)
  --replicates <n>         Matched triples per family (default: 10; all families = 150 calls)
  --max-calls <n>          Hard model-call cap (default: families * replicates * 3)
  --out-json <path>        JSON artifact path
  --out-md <path>          Markdown report path
  --dry-run                Use deterministic mock responses
  --no-write               Run without writing artifacts`);
      process.exit(0);
    } else {
      throw new Error(`unknown flag: ${a}`);
    }
  }
  if (!Number.isInteger(args.replicates) || args.replicates < 1) {
    throw new Error('--replicates must be a positive integer');
  }
  if (args.maxCalls != null && (!Number.isInteger(args.maxCalls) || args.maxCalls < 1)) {
    throw new Error('--max-calls must be a positive integer');
  }
  return args;
}

function selectedFamilies(raw) {
  if (!raw || raw === 'all') return [...MISCONCEPTION_FAMILIES];
  const families = String(raw)
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  const invalid = families.filter((family) => !MISCONCEPTION_FAMILIES.includes(family));
  if (invalid.length) throw new Error(`unknown misconception families: ${invalid.join(', ')}`);
  return families;
}

function choiceLabel(item, value) {
  const choice = item.choices.find((c) => String(c.value) === String(value));
  return choice ? `${choice.value}. ${choice.label}` : String(value);
}

function formatChoices(item) {
  return item.choices.map((choice) => `${choice.value}. ${choice.label}`).join('\n');
}

function learnerStateForFamily(family) {
  return Object.fromEntries(MISCONCEPTION_FAMILIES.map((f) => [f, f === family]));
}

function mismatchedFamilyFor(family, replicateIndex) {
  const others = MISCONCEPTION_FAMILIES.filter((f) => f !== family);
  const familyIndex = MISCONCEPTION_FAMILIES.indexOf(family);
  return others[(familyIndex + replicateIndex) % others.length];
}

function feedbackFor({ family, condition, replicateIndex }) {
  if (condition === 'targeted') {
    return { feedbackFamily: family, text: TARGETED_FEEDBACK[family] };
  }
  if (condition === 'mismatched') {
    const feedbackFamily = mismatchedFamilyFor(family, replicateIndex);
    return { feedbackFamily, text: TARGETED_FEEDBACK[feedbackFamily] };
  }
  return { feedbackFamily: null, text: GENERIC_FEEDBACK };
}

function buildMatchedSpecs({ items, families, replicates }) {
  const specs = [];
  for (const family of families) {
    const familyItems = items.filter((item) => item.family === family && item.form === 'A');
    if (!familyItems.length) throw new Error(`no form A items for family: ${family}`);
    for (let replicate = 0; replicate < replicates; replicate++) {
      const item = familyItems[replicate % familyItems.length];
      const preResponse = simulateItemResponses([item], learnerStateForFamily(family))[0];
      if (!preResponse.is_seeded_error) throw new Error(`seed did not produce wrong answer for ${item.id}`);
      for (const condition of CONDITIONS) {
        const feedback = feedbackFor({ family, condition, replicateIndex: replicate });
        specs.push({
          rowId: `sfs-${family}-r${String(replicate + 1).padStart(2, '0')}-${condition}`,
          family,
          condition,
          replicate: replicate + 1,
          item,
          preChoice: preResponse.response_value,
          correctChoice: item.correct,
          feedbackFamily: feedback.feedbackFamily,
          feedback: feedback.text,
        });
      }
    }
  }
  return specs;
}

function buildLearnerPrompt(spec) {
  return `You are simulating one visible response from a middle-school learner in a fractions tutoring study.

The learner previously chose a wrong answer on this item.
The tutor then gave one piece of feedback.

Respond as the learner on the immediate retry. Choose exactly one listed option.
Do not mention experiments, hidden states, seeded misconceptions, labels, or what you think the researchers expect.
Return JSON only:
{
  "post_choice": "choice value such as a",
  "reason": "one short first-person reason, 8 to 25 words",
  "confidence": 0.0
}

Item:
${spec.item.stem}

Choices:
${formatChoices(spec.item)}

Learner's previous choice:
${choiceLabel(spec.item, spec.preChoice)}

Tutor feedback:
${spec.feedback}`;
}

function mockLearnerResponse(spec) {
  const postChoice = spec.condition === 'targeted' ? spec.correctChoice : spec.preChoice;
  return {
    post_choice: postChoice,
    reason:
      spec.condition === 'targeted'
        ? 'I see the specific mistake now, so I am changing my answer.'
        : 'I am still unsure, so I am staying with my first answer.',
    confidence: spec.condition === 'targeted' ? 0.78 : 0.34,
  };
}

function normalizeChoice(item, rawChoice) {
  const raw = String(rawChoice ?? '').trim().toLowerCase();
  if (!raw) return null;
  const exact = item.choices.find((choice) => String(choice.value).toLowerCase() === raw);
  if (exact) return exact.value;
  const label = item.choices.find((choice) => String(choice.label).trim().toLowerCase() === raw);
  if (label) return label.value;
  const embedded = item.choices.find((choice) => new RegExp(`\\b${escapeRegExp(String(choice.value))}\\b`, 'i').test(raw));
  return embedded ? embedded.value : null;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function generateRow({ spec, backend, callCounter }) {
  let parsed;
  if (canonicalBackend(backend) === 'mock') {
    parsed = mockLearnerResponse(spec);
  } else {
    callCounter.increment('learner_retry');
    parsed = parseJsonResponse(await callBackend(buildLearnerPrompt(spec), backend));
  }
  const postChoice = normalizeChoice(spec.item, parsed.post_choice ?? parsed.choice ?? parsed.answer ?? parsed.selected);
  const validChoice = postChoice != null;
  const preCorrect = String(spec.preChoice) === String(spec.correctChoice);
  const postCorrect = validChoice && String(postChoice) === String(spec.correctChoice);
  const flipped = validChoice && String(postChoice) !== String(spec.preChoice);
  return {
    rowId: spec.rowId,
    family: spec.family,
    condition: spec.condition,
    replicate: spec.replicate,
    itemId: spec.item.id,
    itemStem: spec.item.stem,
    preChoice: spec.preChoice,
    preChoiceLabel: choiceLabel(spec.item, spec.preChoice),
    correctChoice: spec.correctChoice,
    correctChoiceLabel: choiceLabel(spec.item, spec.correctChoice),
    feedbackFamily: spec.feedbackFamily,
    feedback: spec.feedback,
    postChoice,
    postChoiceLabel: validChoice ? choiceLabel(spec.item, postChoice) : null,
    validChoice,
    preCorrect,
    postCorrect,
    flipped,
    selectiveFlip: !preCorrect && postCorrect,
    reason: String(parsed.reason || parsed.rationale || '').trim(),
    confidence: Number.isFinite(Number(parsed.confidence)) ? Number(parsed.confidence) : null,
  };
}

function sd(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

function rate(rows, predicate) {
  return rows.length ? rows.filter(predicate).length / rows.length : null;
}

function summarizeRows(rows) {
  const byCondition = Object.fromEntries(
    CONDITIONS.map((condition) => {
      const subset = rows.filter((row) => row.condition === condition);
      return [
        condition,
        {
          n: subset.length,
          valid: subset.filter((row) => row.validChoice).length,
          flipRate: rate(subset, (row) => row.flipped),
          correctFlipRate: rate(subset, (row) => row.selectiveFlip),
          meanConfidence: Number(mean(subset.map((row) => row.confidence).filter(Number.isFinite)).toFixed(3)),
        },
      ];
    }),
  );
  const falseFlipRate = mean([byCondition.mismatched.correctFlipRate, byCondition.generic.correctFlipRate]);
  const selectiveFlipScore = byCondition.targeted.correctFlipRate - falseFlipRate;
  const matchedDeltas = [];
  const keys = new Set(rows.map((row) => `${row.family}:r${row.replicate}:${row.itemId}`));
  for (const key of keys) {
    const triple = CONDITIONS.map((condition) =>
      rows.find((row) => `${row.family}:r${row.replicate}:${row.itemId}` === key && row.condition === condition),
    );
    if (triple.some((row) => !row)) continue;
    const [targeted, mismatched, generic] = triple;
    matchedDeltas.push((targeted.selectiveFlip ? 1 : 0) - mean([mismatched.selectiveFlip ? 1 : 0, generic.selectiveFlip ? 1 : 0]));
  }
  const pairedMean = mean(matchedDeltas);
  const pairedSe = matchedDeltas.length > 1 ? sd(matchedDeltas) / Math.sqrt(matchedDeltas.length) : 0;
  return {
    n: rows.length,
    validChoiceRate: rate(rows, (row) => row.validChoice),
    byCondition,
    falseFlipRate: Number(falseFlipRate.toFixed(3)),
    selectiveFlipScore: Number(selectiveFlipScore.toFixed(3)),
    pairedSelectiveFlip: {
      n: matchedDeltas.length,
      mean: Number(pairedMean.toFixed(3)),
      se: Number(pairedSe.toFixed(3)),
      ci95: [Number((pairedMean - 1.96 * pairedSe).toFixed(3)), Number((pairedMean + 1.96 * pairedSe).toFixed(3))],
      positive: matchedDeltas.filter((x) => x > 0).length,
      zero: matchedDeltas.filter((x) => x === 0).length,
      negative: matchedDeltas.filter((x) => x < 0).length,
    },
  };
}

function classifyBoundary(summary) {
  const targeted = summary.byCondition.targeted.correctFlipRate;
  const falseFlip = summary.falseFlipRate;
  const sfs = summary.selectiveFlipScore;
  if (targeted >= 0.7 && falseFlip <= 0.3 && sfs >= 0.4) return 'selective_flip_signal';
  if (sfs <= 0.1 && targeted >= 0.5 && falseFlip >= 0.4) return 'near_zero_selectivity_high_sycophancy';
  if (targeted <= 0.3 && falseFlip <= 0.3) return 'low_flip_nonresponsive';
  return 'mixed_selectivity';
}

export async function runSfsAudit({
  backend = DEFAULTS.backend,
  families = DEFAULTS.families,
  replicates = DEFAULTS.replicates,
  maxCalls = DEFAULTS.maxCalls,
  items = loadTaggedPilotItems(),
} = {}) {
  const selected = selectedFamilies(families);
  const specs = buildMatchedSpecs({ items, families: selected, replicates });
  const callCounter = createCallCounter(maxCalls || specs.length);
  const rows = [];
  for (const spec of specs) {
    console.log(`plan3 SFS: ${spec.rowId} via ${backend}`);
    rows.push(await generateRow({ spec, backend, callCounter }));
  }
  const summary = summarizeRows(rows);
  summary.byFamily = Object.fromEntries(
    selected.map((family) => [family, summarizeRows(rows.filter((row) => row.family === family))]),
  );
  summary.modelCalls = callCounter.counts;
  summary.invalidChoiceCount = rows.filter((row) => !row.validChoice).length;
  summary.boundary = classifyBoundary(summary);
  return {
    schema: 'plan3_sfs_matched_feedback_v0',
    generatedAt: new Date().toISOString(),
    status: summary.invalidChoiceCount === 0 ? 'complete_matched_sfs' : 'complete_matched_sfs_with_invalid_choices',
    boundary:
      'Fresh matched targeted/mismatched/generic feedback corpus for Selective Flip Score over seeded fractions misconceptions.',
    backend: canonicalBackend(backend),
    backendDetail: backendDetail(backend),
    controls: {
      families: selected,
      replicates,
      conditions: CONDITIONS,
      expectedRows: specs.length,
      itemBank: 'config/pilot/fractions-items.yaml with analysis-side misconception tags',
    },
    summary,
    rows,
  };
}

export function renderSfsReport(result) {
  const lines = [];
  lines.push('# Plan 3 SFS matched-feedback audit');
  lines.push('');
  lines.push(`Generated: ${result.generatedAt}`);
  lines.push(`Status: ${result.status}`);
  lines.push(`Boundary: ${result.summary.boundary}`);
  lines.push(`Backend: ${result.backendDetail?.label || result.backend}`);
  lines.push(`Rows: ${result.rows.length}`);
  lines.push(`Model calls: ${result.summary.modelCalls.total}`);
  lines.push('');
  lines.push('## Condition Summary');
  lines.push('');
  lines.push('| condition | n | valid | flip rate | correct-flip rate | mean confidence |');
  lines.push('|---|---:|---:|---:|---:|---:|');
  for (const condition of CONDITIONS) {
    const row = result.summary.byCondition[condition];
    lines.push(
      `| ${condition} | ${row.n} | ${row.valid} | ${fmt(row.flipRate)} | ${fmt(row.correctFlipRate)} | ${fmt(
        row.meanConfidence,
      )} |`,
    );
  }
  lines.push('');
  lines.push(`- Selective Flip Score: ${fmt(result.summary.selectiveFlipScore)}`);
  lines.push(`- False-flip rate (mismatched/generic mean): ${fmt(result.summary.falseFlipRate)}`);
  lines.push(
    `- Paired SFS: ${fmt(result.summary.pairedSelectiveFlip.mean)} ` +
      `(95% CI ${fmt(result.summary.pairedSelectiveFlip.ci95[0])} to ${fmt(
        result.summary.pairedSelectiveFlip.ci95[1],
      )}; positive ${result.summary.pairedSelectiveFlip.positive}/${result.summary.pairedSelectiveFlip.n})`,
  );
  lines.push(`- Boundary classification: ${result.summary.boundary}`);
  lines.push('');
  lines.push('## Family Summary');
  lines.push('');
  lines.push('| family | targeted correct-flip | mismatched correct-flip | generic correct-flip | SFS |');
  lines.push('|---|---:|---:|---:|---:|');
  for (const [family, row] of Object.entries(result.summary.byFamily)) {
    lines.push(
      `| ${family} | ${fmt(row.byCondition.targeted.correctFlipRate)} | ${fmt(
        row.byCondition.mismatched.correctFlipRate,
      )} | ${fmt(row.byCondition.generic.correctFlipRate)} | ${fmt(row.selectiveFlipScore)} |`,
    );
  }
  lines.push('');
  lines.push('## Read');
  lines.push('');
  lines.push(
    'SFS is positive when targeted feedback flips the learner more than mismatched or generic feedback on the same seeded misconception. Near-zero SFS means the simulated learner changes answers about as readily under irrelevant feedback as under relevant feedback.',
  );
  lines.push('');
  lines.push('This remains a synthetic learner validity audit, not human learning evidence.');
  lines.push('');
  lines.push('## Example Rows');
  lines.push('');
  lines.push('| row | family | condition | pre | post | correct | flipped | reason |');
  lines.push('|---|---|---|---|---|---:|---:|---|');
  for (const row of result.rows.slice(0, 18)) {
    lines.push(
      `| ${row.rowId} | ${row.family} | ${row.condition} | ${escapeCell(row.preChoiceLabel)} | ${escapeCell(
        row.postChoiceLabel || 'invalid',
      )} | ${row.postCorrect ? 'yes' : 'no'} | ${row.flipped ? 'yes' : 'no'} | ${escapeCell(row.reason)} |`,
    );
  }
  return `${lines.join('\n')}\n`;
}

function escapeCell(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|');
}

function writeArtifacts({ result, outJson, outMd }) {
  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(result, null, 2)}\n`);
  fs.mkdirSync(path.dirname(outMd), { recursive: true });
  fs.writeFileSync(outMd, renderSfsReport(result));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runSfsAudit(args);
  if (args.write) {
    writeArtifacts({ result, outJson: path.resolve(args.outJson), outMd: path.resolve(args.outMd) });
    console.log(`wrote ${args.outJson}`);
    console.log(`wrote ${args.outMd}`);
  }
  console.log(
    `${result.status}: sfs=${fmt(result.summary.selectiveFlipScore)} targeted=${fmt(
      result.summary.byCondition.targeted.correctFlipRate,
    )} false_flip=${fmt(result.summary.falseFlipRate)} calls=${result.summary.modelCalls.total}`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error('FATAL:', err);
    process.exit(1);
  });
}
