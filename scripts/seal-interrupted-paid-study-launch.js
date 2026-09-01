#!/usr/bin/env node

import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

import { sealInterruptedPaidStudyLaunch } from '../services/paidStudyLaunchContract.js';

export const SEAL_INTERRUPTED_PAID_STUDY_USAGE = `Usage:
  node scripts/seal-interrupted-paid-study-launch.js \
    --study-id <study-id> \
    --study-state-root /absolute/path/to/.paid-study-state \
    --destination /absolute/path/to/interrupted-create-once-run \
    --reason <plain-language-technical-reason>

This zero-call closeout verifies that the recorded launcher process is dead,
atomically claims its stale lease, appends matching technical-failure seals to
the run and study ledgers, and releases only that exact lease. It never edits or
deletes prior ledger events and never admits a recovery launch.`;

export function main(argv = process.argv.slice(2), overrides = {}) {
  const { values } = parseArgs({
    args: argv,
    options: {
      'study-id': { type: 'string' },
      'study-state-root': { type: 'string' },
      destination: { type: 'string' },
      reason: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
    allowPositionals: false,
  });
  if (values.help) {
    process.stdout.write(`${SEAL_INTERRUPTED_PAID_STUDY_USAGE}\n`);
    return null;
  }
  if (!values['study-id'] || !values['study-state-root'] || !values.destination || !values.reason) {
    throw new Error(`all closeout arguments are required\n\n${SEAL_INTERRUPTED_PAID_STUDY_USAGE}`);
  }
  const result = (overrides.seal || sealInterruptedPaidStudyLaunch)({
    studyId: values['study-id'],
    studyStateRoot: path.resolve(values['study-state-root']),
    destination: path.resolve(values.destination),
    reason: values.reason,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  try {
    main();
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}
