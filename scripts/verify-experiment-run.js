#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { verifyExperimentRun } from '../services/experimentRunArtifacts.js';

function main() {
  const { values } = parseArgs({
    options: {
      'run-dir': { type: 'string' },
      // Skip the presence contracts (draw minimums, required observed-model
      // roles) but keep every integrity check; for sealed-but-incomplete runs.
      'integrity-only': { type: 'boolean', default: false },
      json: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help || !values['run-dir']) {
    console.log('Usage: node scripts/verify-experiment-run.js --run-dir DIR [--integrity-only] [--json]');
    if (!values.help) process.exitCode = 1;
    return;
  }
  const runDir = path.resolve(values['run-dir']);
  const verification = verifyExperimentRun(runDir, { completeness: !values['integrity-only'] });
  const summary = {
    ok: verification.ok,
    runId: verification.plan?.runId || null,
    eventCount: verification.eventCount,
    artifactCount: verification.inventory.length,
    errors: verification.errors,
    warnings: verification.warnings,
    replay: {
      ok: verification.replay?.ok || false,
      jobs: verification.replay?.jobs?.length || 0,
      decisions: verification.replay?.decisions?.length || 0,
    },
  };
  if (values.json) process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  else if (summary.ok)
    console.log(`verified ${summary.runId}: ${summary.eventCount} events, ${summary.artifactCount} artifacts`);
  else console.error(`verification failed:\n- ${summary.errors.join('\n- ')}`);
  if (!summary.ok) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
