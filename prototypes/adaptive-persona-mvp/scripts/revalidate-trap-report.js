#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAssessmentScenarios } from '../src/assessmentHarness.js';
import { validateOutcomeTask } from '../src/dynamicLearner.js';
import {
  buildVariantSweepReport,
  renderVariantSweepHtml,
} from '../src/variantSweep.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function argValue(name) {
  const idx = process.argv.indexOf(`--${name}`);
  return idx === -1 ? null : process.argv[idx + 1];
}

const input = argValue('input');
if (!input) {
  console.error('Usage: revalidate-trap-report.js --input <variant-sweep.json> [--out <dir>]');
  process.exit(1);
}

const inputPath = path.resolve(input);
const source = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const outDir = path.resolve(argValue('out') || path.join(ROOT, 'outputs', 'trap-report-revalidated'));
const scenarioIds = [
  ...(source.scenarioIds || []),
  ...new Set((source.reports || []).flatMap((report) =>
    (report.results || []).map((result) => result.scenarioId))),
].filter(Boolean);
const scenarios = Object.fromEntries(
  loadAssessmentScenarios({ scenarioIds }).map((scenario) => [scenario.id, scenario]),
);
const changes = [];

for (const report of source.reports || []) {
  for (const result of report.results || []) {
    const scenario = scenarios[result.scenarioId];
    if (!scenario) continue;
    for (const [conditionName, condition] of Object.entries(result.conditions || {})) {
      for (const branchName of ['original', 'counterfactual']) {
        const branch = condition[branchName];
        if (!branch?.outcomeTask) continue;
        const rawSuccess = branch.outcomeTask.raw_success ?? branch.outcomeTask.success;
        const previousSuccess = branch.outcomeTask.success;
        const validation = validateOutcomeTask({
          scenario,
          transcript: branch.transcript || [],
          outcome: {
            ...branch.outcomeTask,
            success: rawSuccess,
          },
        });
        if (!validation.applicable) continue;
        branch.outcomeTask.raw_success = rawSuccess;
        branch.outcomeTask.validation = validation;
        branch.outcomeTask.success = validation.success;
        if (branch.outcomeTask.success !== previousSuccess) {
          changes.push({
            scenarioId: result.scenarioId,
            condition: conditionName,
            branchName,
            previousSuccess,
            nextSuccess: branch.outcomeTask.success,
            reason: validation.reason,
          });
        }
      }
    }
  }
}

const rebuilt = buildVariantSweepReport({
  reports: source.reports || [],
  scenarioIds: source.scenarioIds || scenarioIds,
  conditions: source.conditions,
  baselineCondition: source.baselineCondition,
  learnerMode: source.learnerMode,
  dryRun: source.dryRun,
  deepReflexive: source.deepReflexive,
  model: source.model,
  judgeModel: source.judgeModel,
  parentJudgeModel: source.parentJudgeModel,
  permutations: source.permutations,
});
rebuilt.revalidatedFrom = inputPath;
rebuilt.revalidation = {
  changedOutcomes: changes,
  note: 'Trap outcome validation recomputed from saved transcripts; no LLM calls were rerun.',
};

fs.mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const jsonPath = path.join(outDir, `variant-sweep-revalidated-${stamp}.json`);
const htmlPath = path.join(outDir, `variant-sweep-revalidated-${stamp}.html`);
fs.writeFileSync(jsonPath, `${JSON.stringify(rebuilt, null, 2)}\n`);
fs.writeFileSync(htmlPath, renderVariantSweepHtml(rebuilt));

console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${htmlPath}`);
console.log(`Changed outcomes: ${changes.length}`);
for (const [target, summary] of Object.entries(rebuilt.targetSummaries || {})) {
  const parts = Object.entries(summary.publicStats)
    .map(([metric, stat]) => `${metric}=${stat.summary.meanDiff}`)
    .join(' ');
  console.log(`${target}: ${summary.decision.rationale}; ${parts}`);
}
