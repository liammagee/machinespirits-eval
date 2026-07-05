#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateTaskLoopHeldoutGate,
  renderTaskLoopHeldoutGateMarkdown,
} from '../services/dramaticDerivation/taskLoopHeldoutGate.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_FIXTURES = path.join(ROOT, 'tests/fixtures/taskloop-heldout-artifacts.json');
const DEFAULT_OUT = path.join(ROOT, 'exports/dramatic-derivation/layered-adaptation');

function usage() {
  return `Usage:
  node scripts/derivation-taskloop-heldout-gate.js [--fixtures tests/fixtures/taskloop-heldout-artifacts.json] [--out exports/dramatic-derivation/layered-adaptation] [--min-improvement 0.25]

Runs the zero-paid held-out task/session artifact gate and writes taskloop-heldout-gate-report.{json,md}.
`;
}

export function parseArgs(argv = []) {
  const opts = { fixtures: DEFAULT_FIXTURES, out: DEFAULT_OUT, minImprovement: 0.25, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') return { ...opts, help: true };
    if (arg === '--fixtures') {
      opts.fixtures = path.resolve(ROOT, argv[++i]);
      continue;
    }
    if (arg === '--out') {
      opts.out = path.resolve(ROOT, argv[++i]);
      continue;
    }
    if (arg === '--min-improvement') {
      opts.minImprovement = Number(argv[++i]);
      continue;
    }
    throw new Error(`Unknown argument ${arg}\n${usage()}`);
  }
  return opts;
}

function atomicWrite(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

function loadFixtureFile(file) {
  const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
  const artifacts = Array.isArray(payload) ? payload : payload.artifacts;
  if (!Array.isArray(artifacts)) throw new Error(`Fixture file ${file} does not contain an artifacts array`);
  return { payload, artifacts };
}

function sourceExists(sourceArtifact) {
  if (typeof sourceArtifact !== 'string' || sourceArtifact.startsWith('/') || sourceArtifact.includes('..')) {
    return false;
  }
  return fs.existsSync(path.resolve(ROOT, sourceArtifact));
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  if (opts.help) {
    console.log(usage());
    return;
  }
  if (!Number.isFinite(opts.minImprovement)) {
    console.error('--min-improvement must be numeric');
    process.exit(1);
  }

  const { payload, artifacts } = loadFixtureFile(opts.fixtures);
  const report = evaluateTaskLoopHeldoutGate(artifacts, {
    minImprovement: opts.minImprovement,
    sourceExists,
  });
  report.fixture = {
    schema: payload.schema || null,
    split: payload.split || null,
    source: path.relative(ROOT, opts.fixtures),
    policy: payload.policy || null,
  };

  atomicWrite(path.join(opts.out, 'taskloop-heldout-gate-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  atomicWrite(path.join(opts.out, 'taskloop-heldout-gate-report.md'), renderTaskLoopHeldoutGateMarkdown(report));
  console.log(`task-loop held-out gate wrote ${path.relative(ROOT, opts.out)}/taskloop-heldout-gate-report.{json,md}`);
  console.log(
    `artifacts=${report.summary.count} adaptive=${report.summary.adaptivePass} fixed=${report.summary.fixedPass} delta=${report.summary.improvement.toFixed(
      3,
    )} publicOnlyFail=${report.summary.publicOnlyFail} proofDrift=${report.summary.proofControlChanged}`,
  );
  if (!report.summary.allPassed) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
