#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateHumanHandoffProbe,
  renderHumanHandoffProbeMarkdown,
} from '../services/dramaticDerivation/humanHandoff.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUT = path.join(ROOT, 'exports/dramatic-derivation/layered-adaptation');

function usage() {
  return `Usage:
  node scripts/derivation-human-handoff-probe.js [--out exports/dramatic-derivation/layered-adaptation]

Runs zero-paid human/hybrid handoff controls and writes human-handoff-probe-report.{json,md}.
`;
}

export function parseArgs(argv = []) {
  const opts = { out: DEFAULT_OUT, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') return { ...opts, help: true };
    if (arg === '--out') {
      opts.out = path.resolve(ROOT, argv[++i]);
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
  const report = evaluateHumanHandoffProbe();
  atomicWrite(path.join(opts.out, 'human-handoff-probe-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  atomicWrite(path.join(opts.out, 'human-handoff-probe-report.md'), renderHumanHandoffProbeMarkdown(report));
  console.log(`human handoff probe wrote ${path.relative(ROOT, opts.out)}/human-handoff-probe-report.{json,md}`);
  console.log(
    `cases=${report.summary.count} pass=${report.summary.pass} publicOnlyFail=${report.summary.publicOnlyFail} nonAdvisory=${report.summary.nonAdvisoryRows} handoff=${report.summary.handoffRecommendations} optional=${report.summary.optionalReviewRecommendations}`,
  );
  if (!report.summary.allPassed) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
