#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { annotateReflexiveBranches } from '../src/deepReflexiveScoring.js';
import { runRubricComparison } from '../src/rubricComparison.js';
import {
  buildVariantSweepReport,
  DEFAULT_DISCIPLINARY_SCENARIOS,
  DEFAULT_HARD_SCENARIOS,
  DEFAULT_HELDOUT_HARD_SCENARIOS,
  DEFAULT_HIDDEN_STATE_TRAP_SCENARIOS,
  DEFAULT_SWEEP_CONDITIONS,
  renderVariantSweepHtml,
} from '../src/variantSweep.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function argValue(name) {
  const idx = process.argv.indexOf(`--${name}`);
  return idx === -1 ? null : process.argv[idx + 1];
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function csvArg(name, fallback) {
  return (argValue(name)?.split(',').map((s) => s.trim()).filter(Boolean)) || fallback;
}

function resolveOutDir(defaultRelative) {
  const explicit = argValue('out');
  return explicit ? path.resolve(explicit) : path.resolve(ROOT, defaultRelative);
}

const scenarioIds = csvArg('scenarios', hasFlag('traps')
  ? [...DEFAULT_HIDDEN_STATE_TRAP_SCENARIOS]
  : hasFlag('heldout')
    ? [...DEFAULT_HELDOUT_HARD_SCENARIOS]
    : hasFlag('hard')
      ? [...DEFAULT_HARD_SCENARIOS]
      : [...DEFAULT_DISCIPLINARY_SCENARIOS]);
const conditions = csvArg('conditions', [...DEFAULT_SWEEP_CONDITIONS]);
const baselineCondition = argValue('baseline') || 'static_codex';
const repeats = Number(argValue('repeats') || 2);
const outDir = resolveOutDir('outputs/variant-sweep');
const model = argValue('model');
const judgeModel = argValue('judge-model');
const parentJudgeModel = argValue('parent-judge-model');
const learnerMode = argValue('learner') || 'rule';
const timeoutMs = Number(argValue('timeout-ms') || 600_000);
const dryRun = hasFlag('dry-run');
const keepPrompts = hasFlag('keep-prompts') || dryRun;
const permutations = Number(argValue('permutations') || 10_000);
const deepReflexive = hasFlag('deep-reflexive');

fs.mkdirSync(outDir, { recursive: true });

const reports = [];
for (let repeat = 0; repeat < repeats; repeat++) {
  console.log(`Running sweep repeat ${repeat + 1}/${repeats}`);
  const report = await runRubricComparison({
    scenarioIds,
    conditions,
    learnerMode,
    model,
    judgeModel,
    parentJudgeModel,
    timeoutMs,
    dryRun,
    keepPrompts,
  });
  if (deepReflexive) {
    await annotateReflexiveBranches(report, {
      model: parentJudgeModel || judgeModel || model,
      timeoutMs,
      dryRun,
      keepPrompts,
    });
  }
  report.repeat = repeat;
  reports.push(report);
}

const sweep = buildVariantSweepReport({
  reports,
  scenarioIds,
  conditions,
  baselineCondition,
  learnerMode,
  dryRun,
  deepReflexive,
  model: model || 'codex-cli-default',
  judgeModel: judgeModel || model || 'codex-cli-default',
  parentJudgeModel: parentJudgeModel || judgeModel || model || 'codex-cli-default',
  permutations,
});

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const jsonPath = path.join(outDir, `variant-sweep-${stamp}.json`);
const htmlPath = path.join(outDir, `variant-sweep-${stamp}.html`);
fs.writeFileSync(jsonPath, `${JSON.stringify(sweep, null, 2)}\n`);
fs.writeFileSync(htmlPath, renderVariantSweepHtml(sweep));

console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${htmlPath}`);
for (const [target, summary] of Object.entries(sweep.targetSummaries)) {
  const parts = Object.entries(summary.publicStats)
    .map(([metric, stat]) => `${metric}=${stat.summary.meanDiff} p=${stat.summary.permutationP}`)
    .join(' ');
  console.log(`${target}: ${summary.decision.rationale}; ${parts}`);
}
if (sweep.recommendedCandidates.length > 0) {
  console.log(`Recommended: ${sweep.recommendedCandidates.map((c) => c.targetCondition).join(', ')}`);
} else {
  console.log('Recommended: none');
}
