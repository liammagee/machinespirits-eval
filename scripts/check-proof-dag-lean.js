#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { loadWorld } from '../services/dramaticDerivation/world.js';
import {
  checkLeanCertificate,
  findLeanTool,
  generateLeanCertificate,
  writeLeanCertificate,
} from '../services/dramaticDerivation/leanCertificate.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const DEFAULT_WORLD = 'config/drama-derivation/world-001-nocturne.yaml';
const DEFAULT_PROJECT = 'tools/proof-dag-lean';
const DEFAULT_OUT = 'tools/proof-dag-lean/ProofDag/Generated/World001Nocturne.lean';

function usage() {
  return `Usage: node scripts/check-proof-dag-lean.js [options]

Generate and optionally check the authored proof-DAG Lean certificate.

Options:
  --world <path>          World YAML to certify (default: ${DEFAULT_WORLD})
  --project <path>        Lake project directory (default: ${DEFAULT_PROJECT})
  --out <path>            Generated Lean file (default: ${DEFAULT_OUT})
  --timeout-ms <n>        Lean check timeout (default: 30000)
  --no-check              Generate only; do not run lake env lean
  --require-lake          Fail if lake is unavailable instead of skipping
  --help                  Show this help
`;
}

function parseArgs(argv) {
  const out = {
    world: DEFAULT_WORLD,
    project: DEFAULT_PROJECT,
    out: DEFAULT_OUT,
    timeoutMs: 30000,
    check: true,
    requireLake: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      out.help = true;
    } else if (arg === '--no-check') {
      out.check = false;
    } else if (arg === '--require-lake') {
      out.requireLake = true;
    } else if (arg === '--world') {
      out.world = argv[++i];
    } else if (arg === '--project') {
      out.project = argv[++i];
    } else if (arg === '--out') {
      out.out = argv[++i];
    } else if (arg === '--timeout-ms') {
      out.timeoutMs = Number(argv[++i]);
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  if (!Number.isFinite(out.timeoutMs) || out.timeoutMs <= 0) {
    throw new Error('--timeout-ms must be a positive number');
  }
  return out;
}

function resolveRepoPath(value) {
  return path.isAbsolute(value) ? value : path.join(ROOT, value);
}

function printPathSummary(certificate) {
  for (const row of certificate.pathSummaries) {
    console.log(
      `  ${row.pathId}: ${row.proofFactCount} proof facts; premises ${row.premiseIds.join(', ') || '(none)'}`,
    );
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(usage());
    return;
  }

  const worldPath = resolveRepoPath(args.world);
  const projectDir = resolveRepoPath(args.project);
  const leanFile = resolveRepoPath(args.out);
  const world = loadWorld(worldPath);
  const certificate = generateLeanCertificate(world, {
    sourcePath: path.relative(ROOT, worldPath),
  });
  writeLeanCertificate(leanFile, certificate.lean);

  console.log(`Generated ${path.relative(ROOT, leanFile)}`);
  console.log(`World ${certificate.worldId}: ${certificate.theoremCount} authored proof-path theorem(s)`);
  printPathSummary(certificate);

  if (!args.check) return;

  const lakeBin = findLeanTool('lake');
  const result = checkLeanCertificate({
    projectDir,
    leanFile,
    lakeBin,
    timeoutMs: args.timeoutMs,
  });

  if (result.skipped) {
    console.warn(`Lean check skipped: ${result.reason}`);
    if (args.requireLake) process.exitCode = 1;
    return;
  }

  console.log(`Lean command: ${result.command}`);
  if (!result.ok) {
    console.error(`Lean certificate check failed for ${certificate.worldId}.`);
    console.error('The generated theorem names map to authored proof paths as printed above.');
    if (result.stdout) console.error(result.stdout.trim());
    if (result.stderr) console.error(result.stderr.trim());
    if (result.error) console.error(result.error);
    process.exitCode = 1;
    return;
  }

  console.log('Lean certificate check passed.');
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
