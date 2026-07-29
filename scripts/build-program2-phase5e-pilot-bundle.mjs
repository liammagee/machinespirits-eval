#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { buildProgram2Phase5ePilotBundle } from '../services/program2Phase5ePilotBundle.js';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');

function readPlanArtifact(file) {
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  return { artifact: value, plan: value.plan || value };
}

function resolveRoot(value) {
  return path.resolve(ROOT, value);
}

async function main() {
  const { values } = parseArgs({
    options: {
      'cohort-plan': { type: 'string', default: 'exports/program2-live-pilot-5e-r2/launch-plan.json' },
      'pilot-plan': { type: 'string', default: 'exports/program2-live-pilot-5e-r2-pilot/launch-plan.json' },
      'pilot-root': { type: 'string', default: 'exports/program2-live-pilot-5e-r2-pilot' },
      out: { type: 'string', default: 'exports/program2-live-pilot-5e-r2-pilot/pilot-bundle.json' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    console.log(
      'Usage: node scripts/build-program2-phase5e-pilot-bundle.mjs [--cohort-plan <launch-plan.json>] [--pilot-plan <launch-plan.json>] [--pilot-root <root>] [--out <pilot-bundle.json>]',
    );
    return;
  }
  const cohortPlanFile = resolveRoot(values['cohort-plan']);
  const pilotPlanFile = resolveRoot(values['pilot-plan']);
  for (const file of [cohortPlanFile, pilotPlanFile]) {
    if (!fs.existsSync(file)) throw new Error(`pilot-bundle input not found: ${path.relative(ROOT, file)}`);
  }
  const cohort = readPlanArtifact(cohortPlanFile);
  const pilot = readPlanArtifact(pilotPlanFile);
  const bundle = buildProgram2Phase5ePilotBundle({
    cohortPlan: cohort.plan,
    pilotPlan: pilot.plan,
    pilotRoot: resolveRoot(values['pilot-root']),
    repositoryRoot: ROOT,
    cohortSourceSha: cohort.artifact.sourceSha || cohort.artifact.launchSha || null,
    pilotSourceSha: pilot.artifact.launchSha || pilot.artifact.sourceSha || null,
  });
  const output = resolveRoot(values.out);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(bundle, null, 2)}\n`);
  console.log(`[phase5e-pilot-bundle] ${bundle.audit.status.toUpperCase()}; 0 model calls`);
  for (const entry of bundle.audit.checks) {
    console.log(`  ${entry.pass ? 'PASS' : 'FAIL'} ${entry.id}`);
  }
  console.log(`[phase5e-pilot-bundle] ${path.relative(ROOT, output)}`);
  if (bundle.audit.status !== 'pass') process.exitCode = 2;
}

if (path.resolve(process.argv[1] || '') === SCRIPT_PATH) await main();
