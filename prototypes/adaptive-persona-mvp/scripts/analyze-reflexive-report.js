#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  judgeReflexiveDeliberation,
  renderReflexiveDeepHtml,
} from '../src/reflexiveAnalysis.js';
import { judgePsychodynamicAdaptation } from '../src/psychodynamicRubric.js';
import { isReflexiveCondition } from '../src/reflexiveVariants.js';

function argValue(name) {
  const idx = process.argv.indexOf(`--${name}`);
  return idx === -1 ? null : process.argv[idx + 1];
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

const inputPath = argValue('input');
if (!inputPath) {
  console.error('Usage: analyze-reflexive-report.js --input <rubric-comparison.json> [--out <dir>] [--model <model>] [--dry-run]');
  process.exit(1);
}

const input = path.resolve(inputPath);
const outDir = path.resolve(argValue('out') || path.join(path.dirname(input), 'reflexive-deep-analysis'));
const model = argValue('model');
const timeoutMs = Number(argValue('timeout-ms') || 360_000);
const dryRun = hasFlag('dry-run');
const keepPrompts = hasFlag('keep-prompts') || dryRun;
const skipPsychodynamic = hasFlag('skip-psychodynamic');

const report = JSON.parse(fs.readFileSync(input, 'utf-8'));
let judged = 0;
let psychodynamicJudged = 0;

for (const scenario of report.results || []) {
  for (const [conditionName, condition] of Object.entries(scenario.conditions || {})) {
    if (!isReflexiveCondition(conditionName)) continue;
    for (const branchName of ['original', 'counterfactual']) {
      const branch = condition[branchName];
      if (!branch) continue;
      branch.reflexiveDeliberationJudge = await judgeReflexiveDeliberation({
        scenario,
        branch,
        model,
        timeoutMs,
        dryRun,
        keepPrompt: keepPrompts,
      });
      judged += 1;
      if (!skipPsychodynamic) {
        branch.psychodynamicAdaptationJudge = await judgePsychodynamicAdaptation({
          scenario,
          branch,
          model,
          timeoutMs,
          dryRun,
          keepPrompt: keepPrompts,
        });
        psychodynamicJudged += 1;
      }
    }
  }
}

report.reflexiveAnalysis = {
  generatedAt: new Date().toISOString(),
  sourceReport: input,
  judgedBranches: judged,
  psychodynamicJudgedBranches: psychodynamicJudged,
  model: model || 'codex-cli-default',
  dryRun,
};

fs.mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const jsonPath = path.join(outDir, `reflexive-deep-analysis-${stamp}.json`);
const htmlPath = path.join(outDir, `reflexive-deep-analysis-${stamp}.html`);
fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(htmlPath, renderReflexiveDeepHtml(report));

console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${htmlPath}`);
console.log(`Judged reflexive branches: ${judged}`);
console.log(`Judged psychodynamic branches: ${psychodynamicJudged}`);
