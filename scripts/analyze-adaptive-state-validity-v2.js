#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';
import { evaluateAdaptiveStateValidityV2 } from '../services/adaptiveTutor/stateValidityMetricsV2.js';

const SCRIPT = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT), '..');
const DEFAULT_CONFIG = path.join(ROOT, 'config', 'adaptive-state-benchmark-v2.yaml');

function arg(argv, name, fallback = null) {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] && !argv[index + 1].startsWith('--') ? argv[index + 1] : fallback;
}

function has(argv, name) {
  return argv.includes(`--${name}`);
}

function resolveFromRoot(value) {
  return path.isAbsolute(value) ? value : path.resolve(ROOT, value);
}

function usage() {
  return `Usage: node scripts/analyze-adaptive-state-validity-v2.js --report <precomputed-lane-report.json> [options]

Applies the frozen deterministic v2 gate to a precomputed confirmation report.
It does not fit the prediction head or make model calls.

Options:
  --config <path>  Default: config/adaptive-state-benchmark-v2.yaml
  --out <dir>      Default: directory containing --report
  --stdout         Print decision JSON without writing files
  --help           Show this help
`;
}

function writeExclusive(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  try {
    fs.writeFileSync(filePath, content, { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (error?.code === 'EEXIST') throw new Error(`Refusing to overwrite v2 validity decision at ${filePath}`);
    throw error;
  }
}

export function renderAdaptiveStateValidityV2Decision(decision) {
  const lines = [
    '# Adaptive learner-state validity v2 decision',
    '',
    `Verdict: \`${decision.verdict}\``,
    `Selected representation: \`${decision.selected_representation || 'none'}\``,
    '',
    '## Deterministic reasons',
    '',
    ...(decision.reasons || []).map((reason) => `- \`${reason.code}\``),
    '',
    `Contract SHA-256: \`${decision.contract_sha256}\``,
    `Report SHA-256: \`${decision.report_content_sha256}\``,
    '',
    '> This is a learner-state prediction verdict, not a tutoring-efficacy or human-learning result.',
    '',
  ];
  return lines.join('\n');
}

async function main(argv = process.argv.slice(2)) {
  if (has(argv, 'help')) {
    process.stdout.write(usage());
    return;
  }
  const reportArg = arg(argv, 'report', null);
  if (!reportArg) throw new Error('--report is required');
  const reportPath = resolveFromRoot(reportArg);
  const configPath = resolveFromRoot(arg(argv, 'config', DEFAULT_CONFIG));
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const config = yaml.parse(fs.readFileSync(configPath, 'utf8'));
  const decision = evaluateAdaptiveStateValidityV2(report, config);
  if (has(argv, 'stdout')) {
    process.stdout.write(`${JSON.stringify(decision, null, 2)}\n`);
    return;
  }
  const out = resolveFromRoot(arg(argv, 'out', path.dirname(reportPath)));
  const jsonPath = path.join(out, 'adaptive-state-validity-v2-decision.json');
  const markdownPath = path.join(out, 'adaptive-state-validity-v2-decision.md');
  writeExclusive(jsonPath, `${JSON.stringify(decision, null, 2)}\n`);
  writeExclusive(markdownPath, renderAdaptiveStateValidityV2Decision(decision));
  process.stdout.write(`${decision.verdict}: ${decision.selected_representation || 'no selected representation'}\n`);
  process.stdout.write(`${path.relative(ROOT, jsonPath)}\n${path.relative(ROOT, markdownPath)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
  });
}
