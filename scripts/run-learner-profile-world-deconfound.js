#!/usr/bin/env node

/**
 * Certify and execute the prospective learner-profile/world deconfound cohort.
 *
 * The plan builder remains zero-model and non-authorizing. This runner adds a
 * second, operator-supplied authorization certificate and refuses to launch
 * unless the checkout is the exact clean origin/main commit named by the plan.
 * Every job is attempted once; an interrupted or failed job is never restarted
 * by this command.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { verifyLearnerProfileWorldDeconfoundDelivery } from './prepare-learner-profile-world-deconfound.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLAN_SCHEMA = 'machinespirits.tutor-stub.learner-profile-world-deconfound-plan.v1';
const CERTIFICATE_SCHEMA = 'machinespirits.tutor-stub.learner-profile-world-deconfound-certificate.v2';
const STATE_SCHEMA = 'machinespirits.tutor-stub.learner-profile-world-deconfound-launch-state.v1';

function fail(message) {
  throw new Error(`learner-profile world deconfound runner: ${message}`);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`cannot read ${label} ${filePath}: ${error.message}`);
  }
}

function git(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) fail(`git ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporary, filePath);
}

function findFiles(root, predicate) {
  if (!fs.existsSync(root)) return [];
  const found = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(target);
      else if (predicate(target)) found.push(target);
    }
  };
  walk(root);
  return found.sort();
}

function traceIsSealed(filePath) {
  try {
    return fs
      .readFileSync(filePath, 'utf8')
      .trim()
      .split('\n')
      .some((line) => JSON.parse(line).type === 'run_end');
  } catch {
    return false;
  }
}

export function validateAuthorizationStatement(statement, plan) {
  const text = String(statement || '').trim();
  const required = [
    ['authorization', /\bI authorize\b/iu],
    ['twenty-dialogue scope', /\b(?:20|twenty)[ -]dialogue\b/iu],
    ['source SHA', new RegExp(plan.sourceSha, 'iu')],
    ['Anthropic destination', /\bAnthropic\b/iu],
    ['Anthropic tutor model', /claude-code\.claude-sonnet-5/iu],
    ['public world material', /(?:public|derived).*world/iu],
    ['dialogue history', /dialogue history/iu],
    ['OpenAI destination', /\bOpenAI\b/iu],
    ['OpenAI learner model', /codex\.gpt-5\.6-terra/iu],
    ['OpenAI analysis model', /codex\.gpt-5\.6-sol/iu],
    ['private simulated learner profiles', /private simulated learner (?:profiles|briefs)/iu],
    ['learner-record payloads', /learner-record/iu],
    ['DAG payloads', /\bDAG\b/u],
    ['classification payloads', /classification payloads/iu],
    ['one attempt per job', /(?:one attempt per job|no job reruns)/iu],
  ];
  const missing = required.filter(([, pattern]) => !pattern.test(text)).map(([label]) => label);
  if (missing.length) fail(`authorization statement is missing: ${missing.join(', ')}`);
  return text;
}

export function validateFrozenPlan(plan) {
  if (plan?.schema !== PLAN_SCHEMA) fail(`plan schema must be ${PLAN_SCHEMA}`);
  if (!/^[0-9a-f]{40}$/u.test(plan.sourceSha || '')) fail('plan must pin a full source SHA');
  if (!/^[0-9a-f]{64}$/u.test(plan.planHash || '')) fail('plan must pin its plan hash');
  if (plan.jobs?.length !== 20) fail(`plan must contain exactly 20 jobs, found ${plan.jobs?.length || 0}`);
  if (plan.attemptsPerJob !== 1) fail('plan must allow exactly one attempt per job');
  if (new Set(plan.jobs.map((job) => job.id)).size !== 20) fail('plan job ids must be unique');
  const outputRoot = path.resolve(ROOT, plan.outputDir || '');
  if (outputRoot !== ROOT && !outputRoot.startsWith(`${ROOT}${path.sep}`)) {
    fail('plan output directory must stay inside the repository');
  }
  for (const job of plan.jobs) {
    const archiveIndex = job.argv.indexOf('--artifact-archive');
    if (archiveIndex < 0 || job.argv[archiveIndex + 1] !== 'required') {
      fail(`${job.id} does not require live artifact archival`);
    }
    const budgetIndex = job.argv.indexOf('--model-call-budget');
    if (budgetIndex < 0 || Number(job.argv[budgetIndex + 1]) !== 220) {
      fail(`${job.id} does not retain the frozen 220-call admission bound`);
    }
  }
  return plan;
}

export function buildLaunchCertificate(plan, planBytes, { authorizationStatement = null, deliveryVerified = 0 } = {}) {
  validateFrozenPlan(plan);
  const authorization = authorizationStatement ? validateAuthorizationStatement(authorizationStatement, plan) : null;
  if (deliveryVerified !== 4)
    fail(`certificate requires delivery verification for all four cells, found ${deliveryVerified}`);
  return {
    schema: CERTIFICATE_SCHEMA,
    status: authorization ? 'authorized' : 'prepared_not_authorized',
    sourceSha: plan.sourceSha,
    planHash: plan.planHash,
    launchPlanSha256: sha256(planBytes),
    jobs: plan.jobs.length,
    attemptsPerJob: plan.attemptsPerJob,
    deliveryVerified,
    externalPayloadBoundary: plan.externalPayloadBoundary,
    authorization: authorization
      ? {
          statementSha256: sha256(authorization),
          statement: authorization,
        }
      : null,
    certifiedAt: new Date().toISOString(),
  };
}

export function validateLaunchCertificate(plan, planBytes, certificate) {
  validateFrozenPlan(plan);
  if (certificate?.schema !== CERTIFICATE_SCHEMA) fail(`certificate schema must be ${CERTIFICATE_SCHEMA}`);
  if (certificate.status !== 'authorized') fail('certificate is not authorized');
  if (certificate.sourceSha !== plan.sourceSha) fail('certificate source SHA does not match the plan');
  if (certificate.planHash !== plan.planHash) fail('certificate plan hash does not match the plan');
  if (certificate.launchPlanSha256 !== sha256(planBytes)) fail('launch-plan bytes changed after certification');
  if (certificate.jobs !== 20 || certificate.attemptsPerJob !== 1 || certificate.deliveryVerified !== 4) {
    fail('certificate does not retain the frozen cohort, attempt, and delivery bounds');
  }
  const statement = validateAuthorizationStatement(certificate.authorization?.statement, plan);
  if (certificate.authorization.statementSha256 !== sha256(statement)) fail('authorization statement hash changed');
  return certificate;
}

export function verifyCleanMainSource(plan, { root = ROOT } = {}) {
  const head = git(root, ['rev-parse', 'HEAD']);
  const originMain = git(root, ['rev-parse', 'origin/main']);
  const dirty = git(root, ['status', '--porcelain', '--untracked-files=no']);
  if (head !== plan.sourceSha) fail(`HEAD ${head} does not match certified source ${plan.sourceSha}`);
  if (originMain !== head) fail(`certified source must be current origin/main; origin/main is ${originMain}`);
  if (dirty) fail('tracked working tree must be clean before launch');
  return head;
}

function parseArgs(argv) {
  const args = {
    plan: null,
    certificate: null,
    authorizationFile: null,
    prepareCertificate: false,
    launch: false,
    parallelism: 2,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--plan') args.plan = path.resolve(argv[++index]);
    else if (arg === '--certificate') args.certificate = path.resolve(argv[++index]);
    else if (arg === '--authorization-file') args.authorizationFile = path.resolve(argv[++index]);
    else if (arg === '--prepare-certificate') args.prepareCertificate = true;
    else if (arg === '--launch') args.launch = true;
    else if (arg === '--parallelism') args.parallelism = Number(argv[++index]);
    else fail(`unknown argument: ${arg}`);
  }
  if (!args.plan) fail('--plan is required');
  if (args.prepareCertificate === args.launch) fail('choose exactly one of --prepare-certificate or --launch');
  if (!Number.isInteger(args.parallelism) || args.parallelism < 1 || args.parallelism > 4) {
    fail('--parallelism must be an integer from 1 to 4');
  }
  return args;
}

async function runJob(job, record, { root, logDir, saveState }) {
  const traceRoot = path.resolve(root, job.traceDir);
  if (fs.existsSync(traceRoot) && findFiles(traceRoot, () => true).length) {
    fail(`${job.id} trace directory is not empty; refusing a second attempt`);
  }
  fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, `${job.id}.log`);
  const log = fs.createWriteStream(logPath, { flags: 'wx' });
  record.status = 'running';
  record.startedAt = new Date().toISOString();
  record.log = path.relative(root, logPath);
  saveState();

  const child = spawn(process.execPath, job.argv, {
    cwd: root,
    env: { ...process.env, ...job.environment },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.pipe(log, { end: false });
  child.stderr.pipe(log, { end: false });
  const exit = await new Promise((resolve) => child.once('exit', (code, signal) => resolve({ code, signal })));
  log.end();

  const traces = findFiles(traceRoot, (file) => file.endsWith('.jsonl'));
  const sealedTraces = traces.filter(traceIsSealed);
  record.finishedAt = new Date().toISOString();
  record.exitCode = exit.code;
  record.signal = exit.signal;
  record.traces = traces.map((file) => path.relative(root, file));
  record.status = exit.code === 0 && traces.length === 1 && sealedTraces.length === 1 ? 'sealed' : 'failed';
  if (record.status === 'failed') {
    record.failure = exit.code !== 0 ? `process exited ${exit.code ?? exit.signal}` : 'trace did not seal exactly once';
  }
  saveState();
}

export async function launchCohort(plan, certificate, { root = ROOT, parallelism = 2 } = {}) {
  const outputRoot = path.resolve(root, plan.outputDir);
  const statePath = path.join(outputRoot, 'launch-state.json');
  if (fs.existsSync(statePath)) fail('launch-state.json already exists; this runner never restarts a cohort');
  const logDir = path.join(outputRoot, 'runner-logs');
  if (fs.existsSync(logDir) && findFiles(logDir, () => true).length) {
    fail('runner log directory is not empty; refusing a second attempt');
  }
  for (const job of plan.jobs) {
    const traceRoot = path.resolve(root, job.traceDir);
    if (fs.existsSync(traceRoot) && findFiles(traceRoot, () => true).length) {
      fail(`${job.id} trace directory is not empty; refusing a second attempt`);
    }
  }
  const state = {
    schema: STATE_SCHEMA,
    status: 'running',
    sourceSha: plan.sourceSha,
    planHash: plan.planHash,
    certificateSha256: sha256(JSON.stringify(certificate)),
    startedAt: new Date().toISOString(),
    parallelism,
    attemptsPerJob: 1,
    jobs: plan.jobs.map((job) => ({
      id: job.id,
      cell: job.cell,
      persona: job.persona,
      world: job.world,
      status: 'queued',
    })),
  };
  const saveState = () => writeJsonAtomic(statePath, state);
  saveState();

  let cursor = 0;
  const workers = Array.from({ length: Math.min(parallelism, plan.jobs.length) }, async () => {
    while (cursor < plan.jobs.length) {
      const index = cursor;
      cursor += 1;
      const job = plan.jobs[index];
      const record = state.jobs[index];
      process.stdout.write(`start ${index + 1}/${plan.jobs.length} ${job.id}\n`);
      await runJob(job, record, { root, logDir, saveState });
      process.stdout.write(`${record.status} ${index + 1}/${plan.jobs.length} ${job.id}\n`);
    }
  });
  await Promise.all(workers);
  state.finishedAt = new Date().toISOString();
  state.sealed = state.jobs.filter((job) => job.status === 'sealed').length;
  state.failed = state.jobs.filter((job) => job.status === 'failed').length;
  state.status = state.failed === 0 && state.sealed === plan.jobs.length ? 'completed' : 'completed_with_failures';
  saveState();
  process.stdout.write(`cohort ${state.status}: ${state.sealed} sealed, ${state.failed} failed\n`);
  return state;
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const planBytes = fs.readFileSync(args.plan);
  const plan = validateFrozenPlan(JSON.parse(planBytes));
  if (args.prepareCertificate) {
    verifyCleanMainSource(plan);
    const authorizationStatement = args.authorizationFile ? fs.readFileSync(args.authorizationFile, 'utf8') : null;
    const deliveryVerified = verifyLearnerProfileWorldDeconfoundDelivery(plan).length;
    const certificate = buildLaunchCertificate(plan, planBytes, {
      authorizationStatement,
      deliveryVerified,
    });
    const certificatePath = args.certificate || path.join(path.dirname(args.plan), 'launch-certificate.json');
    writeJsonAtomic(certificatePath, certificate);
    process.stdout.write(`${certificate.status}: ${path.relative(ROOT, certificatePath)}\n`);
    return certificate;
  }

  const certificatePath = args.certificate || path.join(path.dirname(args.plan), 'launch-certificate.json');
  const certificate = validateLaunchCertificate(plan, planBytes, readJson(certificatePath, 'certificate'));
  verifyCleanMainSource(plan);
  return launchCohort(plan, certificate, { parallelism: args.parallelism });
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
