#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildRobustnessEvaluation,
  collectJsonFiles,
  loadRobustnessSources,
  renderRobustnessHtml,
  renderRobustnessMarkdown,
} from '../src/robustnessEvaluation.js';
import {
  DEFAULT_HARD_SCENARIOS,
  DEFAULT_HELDOUT_HARD_SCENARIOS,
  DEFAULT_HIDDEN_STATE_TRAP_SCENARIOS,
} from '../src/variantSweep.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function argValue(name) {
  const idx = process.argv.indexOf(`--${name}`);
  return idx === -1 ? null : process.argv[idx + 1];
}

function csvArg(name, fallback) {
  return (argValue(name)?.split(',').map((s) => s.trim()).filter(Boolean)) || fallback;
}

const inputs = csvArg('inputs', [path.join(ROOT, 'outputs')]);
const outDir = path.resolve(argValue('out') || path.join(ROOT, 'outputs', 'robustness-evaluation'));
const targetCondition = argValue('target') || 'controller_reflexive_psychodynamic_codex';
const baselineCondition = argValue('baseline') || 'static_codex';
const scenarioSet = argValue('scenario-set') || 'hard';
const permutations = Number(argValue('permutations') || 10_000);
const eligibleScenarioIds = scenarioSet === 'heldout'
  ? [...DEFAULT_HELDOUT_HARD_SCENARIOS]
  : scenarioSet === 'traps'
    ? [...DEFAULT_HIDDEN_STATE_TRAP_SCENARIOS]
  : scenarioSet === 'combined'
    ? [...DEFAULT_HARD_SCENARIOS, ...DEFAULT_HELDOUT_HARD_SCENARIOS, ...DEFAULT_HIDDEN_STATE_TRAP_SCENARIOS]
    : [...DEFAULT_HARD_SCENARIOS];

fs.mkdirSync(outDir, { recursive: true });

const files = collectJsonFiles(inputs);
const { summaries, parseErrors } = loadRobustnessSources(files);
const evaluation = buildRobustnessEvaluation({
  summaries,
  targetCondition,
  baselineCondition,
  eligibleScenarioIds,
  scenarioSetLabel: scenarioSet,
  permutations,
});
evaluation.inputs = inputs.map((input) => path.resolve(input));
evaluation.parseErrors = parseErrors;

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const jsonPath = path.join(outDir, `robustness-evaluation-${stamp}.json`);
const mdPath = path.join(outDir, `robustness-evaluation-${stamp}.md`);
const htmlPath = path.join(outDir, `robustness-evaluation-${stamp}.html`);

fs.writeFileSync(jsonPath, `${JSON.stringify(evaluation, null, 2)}\n`);
fs.writeFileSync(mdPath, renderRobustnessMarkdown(evaluation));
fs.writeFileSync(htmlPath, renderRobustnessHtml(evaluation));

console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${mdPath}`);
console.log(`Wrote ${htmlPath}`);
console.log(`Adaptive primary robust positive effect established: ${evaluation.robustPositive.established}`);
console.log(`Strict all-public-metric confirmation: ${evaluation.robustPositive.strictPublicEstablished}`);
console.log(evaluation.robustPositive.reason);
