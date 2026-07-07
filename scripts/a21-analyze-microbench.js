#!/usr/bin/env node
/**
 * A21 action-value report renderer.
 *
 * Reads JSONL trial rows from the zero-paid microbench runner and emits a
 * compact markdown report plus JSON analysis. This does not patch runtime
 * policy or authorize a paid run.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { analyzeA21Trials } from '../services/dramaticDerivation/index.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const OUT_DIR = 'exports/dramatic-derivation/a21-action-value';
const DEFAULT_TRIALS = path.join(OUT_DIR, 'microbench-trials.jsonl');
const DEFAULT_FIXTURE = path.join(OUT_DIR, 'hethel-trigger-fixture.json');
const DEFAULT_OUT = path.join(OUT_DIR, 'action-value-report.md');
const DEFAULT_JSON_OUT = path.join(OUT_DIR, 'action-value-report.json');

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fallback;
}

function flag(name) {
  return process.argv.includes(`--${name}`);
}

function rel(file) {
  return path.relative(ROOT, file);
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function readJsonl(file) {
  return readFileSync(file, 'utf8')
    .split(/\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function fmt(value, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return Number.isInteger(n) ? String(n) : n.toFixed(digits);
}

function componentNames(analysis) {
  const names = new Set();
  for (const row of analysis.actionSummaries || []) {
    for (const key of Object.keys(row.componentMeans || {})) names.add(key);
  }
  return [...names];
}

function renderMarkdown({ analysis, trialsPath, fixturePath, command }) {
  const lines = [];
  lines.push('# A21 Action-Value Microbench Report');
  lines.push('');
  lines.push(`Generated: ${analysis.generatedAt}`);
  lines.push('');
  lines.push('## Boundary');
  lines.push('');
  lines.push('- Status: zero-paid deterministic microbench.');
  lines.push('- Runtime policy changes: none.');
  lines.push('- Fresh paid validation: blocked until replay gates are explicitly implemented and pass.');
  lines.push('- Selector/H/V defaults: unchanged.');
  lines.push('');
  lines.push('## Sources');
  lines.push('');
  lines.push(`- Trials: \`${rel(trialsPath)}\``);
  lines.push(`- Fixture: \`${rel(fixturePath)}\``);
  lines.push(`- Fixture hash: \`${analysis.fixtureHash}\``);
  lines.push(`- Command: \`${command}\``);
  lines.push(`- Assignment probability: ${fmt(analysis.assignmentProbability)}`);
  lines.push('');
  lines.push('## Decision');
  lines.push('');
  lines.push(`- Category: \`${analysis.decisionCategory}\``);
  lines.push(`- Top action(s): ${analysis.topActionIds.map((id) => `\`${id}\``).join(', ') || 'none'}`);
  lines.push(`- Best mean reward: ${fmt(analysis.bestMeanReward)}`);
  lines.push('');
  lines.push(
    'This is an action-value result, not a production policy promotion. If a patch is proposed later, it must be separately gated by Hethel replay against hidden+proofDebt.',
  );
  lines.push('');
  lines.push('## Action Summary');
  lines.push('');
  lines.push(
    '| action | family | n | mean reward | mean D delta | owns target | uses released evidence | on-schedule release | delayed release | aporia | non-leak | generator | failures |',
  );
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const row of analysis.actionSummaries || []) {
    const failures = Object.entries(row.failureLabels || {})
      .map(([label, count]) => `${label}:${count}`)
      .join(', ');
    lines.push(
      `| ${row.actionId} | ${row.moveFamily || ''} | ${row.n} | ${fmt(row.meanReward)} | ${fmt(row.meanDDelta)} | ` +
        `${fmt(row.targetDependencyOwnedRate)} | ${fmt(row.learnerUsesReleasedEvidenceRate)} | ${fmt(row.releaseOnScheduleRate)} | ` +
        `${fmt(row.delayedReleaseRate)} | ${fmt(row.aporiaRate)} | ${fmt(row.nonLeakPassRate)} | ` +
        `${fmt(row.generatorComplianceRate)} | ${failures} |`,
    );
  }
  lines.push('');
  lines.push('## Reward Component Means');
  lines.push('');
  const components = componentNames(analysis);
  lines.push(`| action | ${components.join(' | ')} |`);
  lines.push(`|---|${components.map(() => '---:').join('|')}|`);
  for (const row of analysis.actionSummaries || []) {
    lines.push(`| ${row.actionId} | ${components.map((name) => fmt(row.componentMeans?.[name] || 0)).join(' | ')} |`);
  }
  lines.push('');
  lines.push('## Reward Weights');
  lines.push('');
  for (const [key, value] of Object.entries(analysis.rewardWeights || {})) {
    lines.push(`- ${key}: ${value}`);
  }
  lines.push('');
  lines.push('## Interpretation');
  lines.push('');
  if (analysis.decisionCategory === 'release_beats_diagnostic') {
    lines.push(
      'The deterministic fixture favors releasing the due public point over repeating the diagnostic. This matches the contrastive Hethel autopsy: the failed overlay was locally compliant but starved proof progress, while the hidden+proofDebt success advanced by releasing `p_point`.',
    );
  } else if (analysis.decisionCategory === 'hidden_action_best') {
    lines.push(
      'The hidden+proofDebt action is best or tied-best in the local table, so A21 currently explains the reliability baseline rather than improving it.',
    );
  } else if (analysis.decisionCategory === 'repair_beats_release') {
    lines.push(
      'The deterministic fixture favors repair before release. Treat this as simulator-sensitive until replay checks prove that repair does not leak or delay a required release.',
    );
  } else {
    lines.push('The deterministic fixture does not yet justify a policy patch.');
  }
  lines.push('');
  lines.push('## Caveats');
  lines.push('');
  lines.push('- The learner-state simulator is finite-state and deterministic.');
  lines.push(
    '- The report ranks local transition value only; final grounding still requires replay and fresh first-pass validation.',
  );
  lines.push(
    '- The fixture retains observed hidden/failed contrasts as provenance but does not encode a winner in the action set.',
  );
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function main() {
  const smoke = flag('smoke');
  const trialsPath = path.resolve(
    ROOT,
    arg('trials', smoke ? path.join(OUT_DIR, 'microbench-trials-smoke.jsonl') : DEFAULT_TRIALS),
  );
  const fixturePath = path.resolve(ROOT, arg('fixture', DEFAULT_FIXTURE));
  const outPath = path.resolve(
    ROOT,
    arg('out', smoke ? path.join(OUT_DIR, 'action-value-report-smoke.md') : DEFAULT_OUT),
  );
  const jsonOutPath = path.resolve(
    ROOT,
    arg('json-out', smoke ? path.join(OUT_DIR, 'action-value-report-smoke.json') : DEFAULT_JSON_OUT),
  );
  const trials = readJsonl(trialsPath);
  const fixture = existsSync(fixturePath) ? readJson(fixturePath) : null;
  const command = `node scripts/a21-analyze-microbench.js --trials ${rel(trialsPath)} --out ${rel(outPath)}`;
  const analysis = analyzeA21Trials({ trials, fixture, command });
  mkdirSync(path.dirname(outPath), { recursive: true });
  mkdirSync(path.dirname(jsonOutPath), { recursive: true });
  writeFileSync(jsonOutPath, `${JSON.stringify(analysis, null, 2)}\n`);
  writeFileSync(outPath, renderMarkdown({ analysis, trialsPath, fixturePath, command }));
  console.log(`report: ${rel(outPath)}`);
  console.log(`json:   ${rel(jsonOutPath)}`);
  console.log(`decision: ${analysis.decisionCategory}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
