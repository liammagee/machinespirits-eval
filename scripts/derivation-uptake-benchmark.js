#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateUptakeBenchmark,
  renderUptakeBenchmarkMarkdown,
} from '../services/dramaticDerivation/uptakeNegotiation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUT = path.join(ROOT, 'exports/dramatic-derivation/layered-adaptation');

function usage() {
  return `Usage:
  node scripts/derivation-uptake-benchmark.js [--out exports/dramatic-derivation/layered-adaptation]

Runs zero-paid uptake negotiation controls and writes uptake-benchmark-report.{json,md}.
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
  const report = evaluateUptakeBenchmark();
  atomicWrite(path.join(opts.out, 'uptake-benchmark-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  atomicWrite(path.join(opts.out, 'uptake-benchmark-report.md'), renderUptakeBenchmarkMarkdown(report));
  console.log(`uptake benchmark wrote ${path.relative(ROOT, opts.out)}/uptake-benchmark-report.{json,md}`);
  console.log(`cases=${report.summary.count} passed=${report.summary.pass} failed=${report.summary.fail}`);
  if (!report.summary.allPassed) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
