#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';
import { evaluateAdaptiveStateValidityV2 } from '../services/adaptiveTutor/stateValidityMetricsV2.js';
import { validateAdaptiveStateStage2Run } from '../services/adaptiveTutor/stateBenchmarkStage2Lineage.js';

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
  return `Usage: node scripts/analyze-adaptive-state-validity-v2.js --run <sealed-s2-dir> --s0-parent <sealed-s0-dir> --parent <sealed-s1-dir> [options]

Verifies the complete S0 -> paid S1 -> fixed-eight paid S2 artifact chain.
The final gate remains fail-closed until deterministic S2 split/prediction/
report regeneration is implemented. A loose report, planning-only run, mock
run, partial run, or unsealed run is rejected.

Options:
  --config <path>  Default: config/adaptive-state-benchmark-v2.yaml
  --out <dir>      Default: a derived sibling of the immutable S2 run
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
  if (arg(argv, 'report', null) || has(argv, 'report')) {
    throw new Error('Bare --report input is forbidden; provide --run and --parent sealed transactions');
  }
  const runArg = arg(argv, 'run', null);
  const s0ParentArg = arg(argv, 's0-parent', null);
  const parentArg = arg(argv, 'parent', null);
  if (!runArg || !s0ParentArg || !parentArg) throw new Error('--run, --s0-parent, and --parent are required');
  const runDir = resolveFromRoot(runArg);
  const s0RunDir = resolveFromRoot(s0ParentArg);
  const parentRunDir = resolveFromRoot(parentArg);
  const configPath = resolveFromRoot(arg(argv, 'config', DEFAULT_CONFIG));
  const config = yaml.parse(fs.readFileSync(configPath, 'utf8'));
  const { report } = validateAdaptiveStateStage2Run({
    runDir,
    parentRunDir,
    s0RunDir,
    config,
    configPath,
    repoRoot: ROOT,
  });
  const decision = evaluateAdaptiveStateValidityV2(report, config);
  if (has(argv, 'stdout')) {
    process.stdout.write(`${JSON.stringify(decision, null, 2)}\n`);
    return;
  }
  const defaultOut = path.join(path.dirname(runDir), `${path.basename(runDir)}-validity-decision`);
  const out = resolveFromRoot(arg(argv, 'out', defaultOut));
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
