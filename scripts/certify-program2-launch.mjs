#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import yaml from 'yaml';

import { buildProgram2LaunchCertificate } from '../services/program2ExperimentSafety.js';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');

function resolveRoot(value) {
  return path.resolve(ROOT, value);
}

function readStructured(file) {
  const text = fs.readFileSync(file, 'utf8');
  return /\.ya?ml$/iu.test(file) ? yaml.parse(text) : JSON.parse(text);
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function bindFile(file, role) {
  return { role, file: path.relative(ROOT, file), sha256: sha256File(file) };
}

function gitHead() {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
}

function genericPlanValidation(plan) {
  const errors = [];
  if (!plan || typeof plan !== 'object') errors.push('plan is not an object');
  if (!Array.isArray(plan?.jobs) || plan.jobs.length === 0) errors.push('plan has no jobs');
  const ids = (plan?.jobs || []).map((job) => String(job?.id || ''));
  if (ids.some((id) => !id)) errors.push('plan contains a job without an id');
  if (new Set(ids).size !== ids.length) errors.push('plan contains duplicate job ids');
  if (!Number.isFinite(Number(plan?.primaryHorizon))) errors.push('plan primaryHorizon is missing');
  if (!Number.isFinite(Number(plan?.safetyTurns)) || Number(plan.safetyTurns) < 1) {
    errors.push('plan safetyTurns must be positive');
  }
  if (!Number.isFinite(Number(plan?.maxTokens)) || Number(plan.maxTokens) < 1) {
    errors.push('plan maxTokens must be positive');
  }
  return { ok: errors.length === 0, errors };
}

function loadPilotBundle(file) {
  const bundle = readStructured(file);
  const rows = Array.isArray(bundle?.rows) ? bundle.rows : [];
  const audit = bundle?.audit || bundle?.provenanceAudit || null;
  const expectedPlanSha256 = bundle?.expectedPlanSha256 || bundle?.planSha256 || null;
  return {
    rows,
    expectedSourceSha: bundle?.expectedSourceSha || bundle?.audit?.plan?.sourceSha || null,
    evidenceFiles: Array.isArray(bundle?.evidenceBindings?.files)
      ? bundle.evidenceBindings.files.map((entry) => ({ ...entry }))
      : [],
    provenance: {
      audit,
      expectedPlanSha256,
      bound: Boolean(expectedPlanSha256 && audit?.plan?.sha256 === expectedPlanSha256),
    },
  };
}

function printSummary(certificate, reportPath) {
  const reachability = certificate.checks.staticReachability;
  console.log(`[program2-certificate] ${certificate.status.toUpperCase()} (${certificate.phase})`);
  console.log(
    `[program2-certificate] static coverage ${reachability.maxCoverageAtHorizon.toFixed(3)} ` +
      `at turn ${reachability.horizon}; threshold ${reachability.coverageThreshold.toFixed(3)}`,
  );
  if (certificate.phase === 'cohort') {
    const pilot = certificate.checks.exactPipelinePilot;
    console.log(
      `[program2-certificate] exact-pipeline pilot ${pilot.pass ? 'PASS' : 'FAIL'}; ` +
        `${pilot.exactPipelineRows} sealed rows; ${pilot.missingGroups.length} missing profile/cell groups`,
    );
  }
  console.log(
    `[program2-certificate] hard caps: ${certificate.budget.maxJobs} jobs, ` +
      `${certificate.budget.maxAttemptsPerJob} attempts/job, ` +
      `${certificate.budget.maxProviderCalls} provider calls, ` +
      `${certificate.budget.maxReservedOutputTokens} reserved output tokens`,
  );
  console.log(`[program2-certificate] ${path.relative(ROOT, reportPath)}`);
}

export function buildCertificateFromFiles({
  planFile,
  worldFile,
  phase,
  pilotBundleFiles = [],
  gateSpecFile = null,
  sourceSha = gitHead(),
} = {}) {
  const planArtifact = readStructured(planFile);
  const plan = planArtifact?.plan || planArtifact;
  const world = readStructured(worldFile);
  const pilots = pilotBundleFiles.map(loadPilotBundle);
  const pilotEvidenceFiles = pilots
    .flatMap((pilot) => pilot.evidenceFiles)
    .map((entry) => {
      const file = resolveRoot(entry.file);
      const relative = path.relative(ROOT, file);
      if (!entry.file || relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error(`pilot evidence escapes repository root: ${entry.file || 'missing'}`);
      }
      if (!fs.existsSync(file)) throw new Error(`pilot evidence not found: ${entry.file}`);
      if (entry.sha256 && sha256File(file) !== entry.sha256) {
        throw new Error(`pilot evidence hash mismatch: ${entry.file}`);
      }
      return bindFile(file, entry.role || 'pilot_trace');
    });
  const gateSpec = gateSpecFile ? readStructured(gateSpecFile) : {};
  return buildProgram2LaunchCertificate({
    phase,
    plan,
    sourceSha,
    world,
    pilotRows: pilots.flatMap((pilot) => pilot.rows),
    pilotAudits: pilots.map((pilot) => ({
      ...pilot.provenance,
      bound: pilot.provenance.bound && pilot.expectedSourceSha === sourceSha,
    })),
    gateSpec,
    planValidation: genericPlanValidation(plan),
    evidenceBindings: {
      files: [
        bindFile(planFile, 'launch_plan'),
        bindFile(worldFile, 'world'),
        ...(gateSpecFile ? [bindFile(gateSpecFile, 'gate_spec')] : []),
        ...pilotBundleFiles.map((file, index) => bindFile(file, `pilot_bundle:${index + 1}`)),
        ...pilotEvidenceFiles,
      ],
    },
  });
}

async function main() {
  const { values } = parseArgs({
    options: {
      'plan-file': { type: 'string', default: '' },
      'world-file': { type: 'string', default: '' },
      phase: { type: 'string', default: 'cohort' },
      'pilot-bundle': { type: 'string', multiple: true, default: [] },
      'gate-spec-file': { type: 'string', default: '' },
      'source-sha': { type: 'string', default: '' },
      report: { type: 'string', default: '' },
      'report-only': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    console.log(
      'Usage: node scripts/certify-program2-launch.mjs --plan-file <zero-model-plan.json> --world-file <world.yaml> --phase pilot|cohort [--pilot-bundle <bundle.json> ...] [--gate-spec-file <gates.json>] [--source-sha <sha>] [--report <file>] [--report-only]',
    );
    return;
  }
  if (!['pilot', 'cohort'].includes(values.phase)) throw new Error('--phase must be pilot or cohort');
  if (!values['plan-file'] || !values['world-file']) {
    throw new Error('--plan-file and --world-file are required');
  }
  const planFile = resolveRoot(values['plan-file']);
  const worldFile = resolveRoot(values['world-file']);
  const pilotBundleFiles = values['pilot-bundle'].map(resolveRoot);
  const gateSpecFile = values['gate-spec-file'] ? resolveRoot(values['gate-spec-file']) : null;
  for (const file of [planFile, worldFile, ...pilotBundleFiles, ...(gateSpecFile ? [gateSpecFile] : [])]) {
    if (!fs.existsSync(file)) throw new Error(`certificate input not found: ${file}`);
  }
  const certificate = buildCertificateFromFiles({
    planFile,
    worldFile,
    phase: values.phase,
    pilotBundleFiles,
    gateSpecFile,
    sourceSha: values['source-sha'] || gitHead(),
  });
  const reportPath = resolveRoot(values.report || 'exports/program2-launch-certificate.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(certificate, null, 2)}\n`);
  printSummary(certificate, reportPath);
  if (certificate.status !== 'pass' && !values['report-only']) process.exitCode = 2;
}

if (path.resolve(process.argv[1] || '') === SCRIPT_PATH) await main();
