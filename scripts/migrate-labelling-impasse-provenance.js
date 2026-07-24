#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  inspectImpasseProvenanceArtifacts,
  migrateImpasseProvenanceArtifacts,
} from '../services/labellingImpasseProvenance.js';
import { IMPASSE_RATER_PREFIX, resolveImpasseWorkspace } from '../services/labellingGameStore.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function usage() {
  return `Usage:
  npm run labelling-game:impasse-provenance -- --check [--json]
  npm run labelling-game:impasse-provenance -- --apply --accept-current-corpus [--json]

The apply command explicitly binds every impasse rater sidecar to the currently
configured corpus. Review --check output before accepting a changed corpus.`;
}

export function parseArgs(argv) {
  const options = { apply: false, check: false, json: false, acceptCurrentCorpus: false };
  for (const token of argv) {
    if (token === '--apply') options.apply = true;
    else if (token === '--check') options.check = true;
    else if (token === '--json') options.json = true;
    else if (token === '--accept-current-corpus') options.acceptCurrentCorpus = true;
    else if (token === '--help' || token === '-h') options.help = true;
    else throw new Error(`unknown argument: ${token}`);
  }
  if (options.apply && options.check) throw new Error('choose either --check or --apply');
  if (!options.apply) options.check = true;
  if (options.apply && !options.acceptCurrentCorpus) {
    throw new Error('--apply requires --accept-current-corpus');
  }
  return options;
}

function printHuman(report, { apply }) {
  for (const entry of report.entries || []) {
    process.stdout.write(`${entry.status.padEnd(20)} ${path.relative(process.cwd(), entry.path)}\n`);
    if (entry.error) process.stdout.write(`  ${entry.code}: ${entry.error}\n`);
  }
  const counts = report.counts;
  process.stdout.write(
    `\nCurrent ${counts.current}; migration required ${counts.migration_required}; mismatched ${counts.mismatch}; invalid ${counts.invalid}.\n`,
  );
  if (apply) process.stdout.write(`Migrated ${report.migrated.length}; unresolved ${report.unresolved.length}.\n`);
}

export function run(argv = process.argv.slice(2), env = process.env) {
  const options = parseArgs(argv);
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  const workspace = resolveImpasseWorkspace(env);
  const shared = {
    sourcePath: workspace.sourcePath,
    source: path.relative(ROOT, workspace.sourcePath),
    outputDir: workspace.outputDir,
    prefix: IMPASSE_RATER_PREFIX,
  };
  const report = options.apply
    ? migrateImpasseProvenanceArtifacts({ ...shared, acceptCurrentCorpus: options.acceptCurrentCorpus })
    : inspectImpasseProvenanceArtifacts(shared);
  if (options.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else printHuman(report, options);
  if (options.apply) return report.success ? 0 : 2;
  if (report.counts.invalid) return 2;
  if (report.counts.migration_required || report.counts.mismatch) return 1;
  return 0;
}

if (path.resolve(process.argv[1] || '') === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    process.exitCode = run();
  } catch (error) {
    process.stderr.write(`${error.message}\n\n${usage()}\n`);
    process.exitCode = 2;
  }
}
