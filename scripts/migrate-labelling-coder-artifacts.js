#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  inspectLabellingCoderArtifacts,
  migrateLabellingCoderArtifacts,
} from '../services/labellingCoderArtifactMigration.js';

function usage() {
  return `Usage:
  npm run labelling-game:coder-artifacts -- --check [--json]
  npm run labelling-game:coder-artifacts -- --apply (--mapping <file> | --accept-inferred) [--json]

Mapping files are JSON objects keyed by dataset and legacy artifact suffix:
{
  "superego-taxonomy": { "rater-A": "Rater A" },
  "tutor-stub-impasses": { "impasse-rater": "Impasse Rater" }
}`;
}

export function parseArgs(argv) {
  const options = { apply: false, check: false, json: false, acceptInferred: false, mappingPath: null };
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (token === '--apply') options.apply = true;
    else if (token === '--check') options.check = true;
    else if (token === '--json') options.json = true;
    else if (token === '--accept-inferred') options.acceptInferred = true;
    else if (token === '--mapping') options.mappingPath = argv[++index];
    else if (token === '--help' || token === '-h') options.help = true;
    else throw new Error(`unknown argument: ${token}`);
  }
  if (options.apply && options.check) throw new Error('choose either --check or --apply');
  if (!options.apply) options.check = true;
  if (options.apply && !options.mappingPath && !options.acceptInferred) {
    throw new Error('--apply requires --mapping <file> or --accept-inferred');
  }
  return options;
}

function loadMapping(mappingPath) {
  if (!mappingPath) return {};
  return JSON.parse(fs.readFileSync(path.resolve(mappingPath), 'utf8'));
}

function printHuman(report, { apply }) {
  const entries = report.entries || [];
  for (const entry of entries) {
    const source = path.relative(process.cwd(), entry.source_path);
    const target = entry.target_path ? path.relative(process.cwd(), entry.target_path) : '-';
    process.stdout.write(
      `${entry.status.padEnd(22)} ${entry.dataset_id.padEnd(22)} ${entry.coder_id || '-'}\n` +
        `  ${source}${source === target ? '' : ` -> ${target}`}\n`,
    );
  }
  if (apply) {
    process.stdout.write(`\nMigrated ${report.migrated.length}; unresolved ${report.unresolved.length}.\n`);
  } else {
    const counts = report.counts;
    process.stdout.write(
      `\nCurrent ${counts.current}; ready ${counts.ready}; confirmation required ${counts.confirmation_required}; collisions ${counts.collision}; invalid ${counts.invalid}.\n`,
    );
  }
}

export function run(argv = process.argv.slice(2), env = process.env) {
  const options = parseArgs(argv);
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  const mapping = loadMapping(options.mappingPath);
  const report = options.apply
    ? migrateLabellingCoderArtifacts({ env, mapping, acceptInferred: options.acceptInferred })
    : inspectLabellingCoderArtifacts({ env, mapping });
  if (options.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else printHuman(report, options);
  if (options.apply) return report.success ? 0 : 2;
  if (report.counts.collision || report.counts.invalid) return 2;
  if (report.counts.confirmation_required || report.counts.ready) return 1;
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
