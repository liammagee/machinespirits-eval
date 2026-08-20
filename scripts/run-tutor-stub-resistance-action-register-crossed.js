#!/usr/bin/env node

/**
 * Zero-call preparation surface for the resistance action/register study.
 *
 * This command deliberately has no live execution mode. It proves the frozen
 * endpoint and turns full source traces into exact-prefix branch plans. A
 * later digest-bound GO request must pin the actual source traces, model route,
 * budget, destination, and executable launch wrapper before any provider call.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  buildTutorStubResistanceActionRegisterPlan,
  extractTutorStubResistanceActionRegisterPrefix,
  loadTutorStubResistanceActionRegisterRegistration,
  prepareTutorStubResistanceActionRegisterFrozenBranch,
} from '../services/tutorStubResistanceActionRegisterStudy.js';
import { runTutorStubResistanceActionRegisterEndpointPreflight } from '../services/tutorStubResistanceActionRegisterPreflight.js';
import { loadWorld } from '../services/dramaticDerivation/world.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_REGISTRATION = 'config/tutor-stub-resistance-action-register-crossed-registration.v1.json';
const DEFAULT_ENDPOINT = 'config/paid-study-endpoints/tutor-stub-resistance-action-register-baseline.json';

function parseArgs(argv) {
  const options = { preflight: false, plan: false, json: false, stage: 'baseline' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (['--preflight', '--plan', '--json', '--help'].includes(arg)) {
      options[arg.slice(2)] = true;
      continue;
    }
    if (['--registration', '--endpoint-contract', '--prefix-manifest', '--stage'].includes(arg)) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value`);
      options[arg.slice(2)] = value;
      index += 1;
      continue;
    }
    throw new Error(`unknown argument ${arg}`);
  }
  return options;
}

function repoPath(value, label) {
  const relative = String(value || '').trim();
  if (!relative || path.isAbsolute(relative)) throw new Error(`${label} must be repository-relative`);
  const absolute = path.resolve(ROOT, relative);
  const resolvedRelative = path.relative(ROOT, absolute);
  if (resolvedRelative.startsWith('..') || path.isAbsolute(resolvedRelative)) {
    throw new Error(`${label} escapes the repository root`);
  }
  return absolute;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function buildTutorStubResistanceActionRegisterPrefixPlan({ registration, manifest }) {
  if (manifest?.schema !== 'machinespirits.tutor-stub.resistance-action-register-prefix-manifest.v1') {
    throw new Error('prefix manifest has an unsupported schema');
  }
  if (!Array.isArray(manifest.sources) || !manifest.sources.length) {
    throw new Error('prefix manifest requires source traces');
  }
  const prefixes = manifest.sources.map((source) =>
    extractTutorStubResistanceActionRegisterPrefix({
      tracePath: repoPath(source.trace, `prefix trace ${source.trace}`),
      profile: source.profile,
      observationSemantics:
        manifest.observationSemantics || registration.design?.trigger?.observationSemantics || undefined,
    }),
  );
  const plan = buildTutorStubResistanceActionRegisterPlan({
    registration,
    prefixes,
    stage: manifest.stage || 'baseline',
  });
  const world = loadWorld(path.join(ROOT, 'config/drama-derivation/world-005-marrick.yaml'));
  const prefixById = new Map(prefixes.map((prefix) => [prefix.id, prefix]));
  return {
    ...plan,
    jobs: plan.jobs.map((job) => {
      const branch = prepareTutorStubResistanceActionRegisterFrozenBranch({
        prefix: prefixById.get(job.prefix_id),
        registration,
        world,
        actionFit: job.treatment.action_fit,
        realization: job.treatment.realization,
        repeat: job.treatment.repeat,
      });
      const request = branch.bundle.request;
      return {
        ...job,
        exact_prefix_branch: {
          schema: branch.schema,
          frozen_bundle_prefix_sha256: branch.frozen_bundle_prefix_sha256,
          request_sha256: sha256(JSON.stringify(request)),
          treatment: branch.treatment,
          bundle: branch.bundle,
        },
      };
    }),
  };
}

export function runTutorStubResistanceActionRegisterZeroCall({
  registrationPath = DEFAULT_REGISTRATION,
  endpointContractPath = DEFAULT_ENDPOINT,
} = {}) {
  const loaded = loadTutorStubResistanceActionRegisterRegistration(repoPath(registrationPath, 'registration'));
  const contract = readJson(repoPath(endpointContractPath, 'endpoint contract'));
  if (contract.registration?.registration_sha256 !== loaded.sha256) {
    throw new Error('endpoint contract registration digest does not match the frozen registration');
  }
  const preflight = runTutorStubResistanceActionRegisterEndpointPreflight({
    contract,
    registration: loaded.registration,
  });
  return {
    schema: 'machinespirits.tutor-stub.resistance-action-register-zero-call-readiness.v1',
    status: 'passed_hold',
    model_calls: 0,
    production_writes: 0,
    registration: {
      path: path.relative(ROOT, loaded.path),
      sha256: loaded.sha256,
      status: loaded.registration.status,
    },
    endpoint_preflight: preflight,
    live_execution_available: false,
    live_execution_blocker:
      'A digest-bound GO request must pin source prefixes, model route, attempt ceiling, create-once destination, and launch wrapper.',
  };
}

function usage() {
  return `Usage:
  node scripts/run-tutor-stub-resistance-action-register-crossed.js --preflight [--json]
  node scripts/run-tutor-stub-resistance-action-register-crossed.js --plan --prefix-manifest <path> [--json]

This surface performs zero model calls and zero production writes. It has no
live execution mode; model-backed execution remains on HOLD.`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  const registrationPath = args.registration || DEFAULT_REGISTRATION;
  if (args.plan) {
    if (!args['prefix-manifest']) throw new Error('--plan requires --prefix-manifest');
    const loaded = loadTutorStubResistanceActionRegisterRegistration(repoPath(registrationPath, 'registration'));
    const manifest = readJson(repoPath(args['prefix-manifest'], 'prefix manifest'));
    if (args.stage) manifest.stage = args.stage;
    const plan = buildTutorStubResistanceActionRegisterPrefixPlan({
      registration: loaded.registration,
      manifest,
    });
    console.log(JSON.stringify(plan, null, 2));
    return;
  }
  const result = runTutorStubResistanceActionRegisterZeroCall({
    registrationPath,
    endpointContractPath: args['endpoint-contract'] || DEFAULT_ENDPOINT,
  });
  if (args.json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`resistance action/register readiness: ${result.status}`);
    console.log(`model calls: ${result.model_calls}; production writes: ${result.production_writes}`);
    console.log(`baseline cases: ${result.endpoint_preflight.registered_scale.cases}`);
    console.log(`live execution: HOLD (${result.live_execution_blocker})`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
