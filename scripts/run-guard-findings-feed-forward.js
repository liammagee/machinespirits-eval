#!/usr/bin/env node

import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { requiredTutorStubArtifactArchiveArgs } from '../services/tutorStubArtifactArchive.js';
import {
  extractTutorStubEffectiveAdvisoryIssues,
  summarizeTutorStubGuardFindingRecurrence,
  tutorStubGuardFindingKey,
} from '../services/tutorStubGuardFindingsFeedForward.js';
import { parseTutorStubShowcaseTrace, readTutorStubShowcaseTrace } from '../services/tutorStubShowcase.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA = 'machinespirits.tutor-stub.guard-findings-feed-forward-pilot.v1';
const CERTIFICATE_SCHEMA = 'machinespirits.tutor-stub.guard-findings-feed-forward-certificate.v1';
const MODEL = 'codex.gpt-5.6-luna';
const WORLD = 'world_030_rowan_flat';
const PROFILES = Object.freeze(['false_memory', 'low_agency']);
const ARMS = Object.freeze(['control', 'feed_forward']);
const REPEATS = 3;
const TURN_CAP = 12;
const MODEL_CALL_BUDGET = 60;
const MAX_MODEL_CALLS = PROFILES.length * ARMS.length * REPEATS * MODEL_CALL_BUDGET;
const DEFAULT_OUTPUT_DIR = path.join(ROOT, 'exports', 'tutor-stub-guard-feed-forward', 'pilot-a1');
const TIMEOUT_MS = 30 * 60 * 1000;

function fail(message) {
  throw new Error(`guard-findings feed-forward pilot: ${message}`);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])]),
  );
}

function hashObject(value) {
  return sha256(JSON.stringify(canonicalize(value)));
}

function git(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) fail(`git ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

function assertCleanSource(root) {
  const dirty = git(root, ['status', '--short']);
  if (dirty) fail('certificate preparation and launch require a clean committed worktree');
  return git(root, ['rev-parse', 'HEAD']);
}

function relativeOutputDir(outputDir) {
  const relative = path.relative(ROOT, outputDir).split(path.sep).join('/');
  if (!relative || relative.startsWith('../')) fail('output directory must stay inside the repository');
  return relative;
}

function jobArgv({ arm, profile, repeat, traceDir }) {
  return [
    'scripts/tutor-stub.js',
    '--lab',
    'automated_eval',
    '--auto-learner',
    '--world',
    WORLD,
    '--all-models',
    MODEL,
    '--auto-learner-profile',
    profile,
    '--dag',
    '--tutor-learner-dag',
    '--dag-mode',
    'strict_dag',
    '--register-policy',
    'field',
    '--register-temperature',
    '0.15',
    '--no-light-adaptation',
    '--no-committee',
    '--dag-fact-dropout',
    '0',
    '--dag-fact-dropout-seed',
    String(repeat + 1),
    '--release-speed',
    '1',
    '--run-seed',
    String(repeat + 1),
    '--eval-repeat',
    String(repeat + 1),
    '--eval-job-id',
    `${profile}-${arm}-d${repeat + 1}`,
    '--auto-turns',
    String(TURN_CAP),
    '--auto-safety-turns',
    String(TURN_CAP + 4),
    '--history-turns',
    '4',
    '--max-tokens',
    '2000',
    '--cli-effort',
    'medium',
    '--model-call-budget',
    String(MODEL_CALL_BUDGET),
    '--acknowledge-research-use',
    '--training-reuse',
    'off',
    '--no-turn-feedback',
    '--no-remember-settings',
    '--no-stream',
    '--no-interim-animation',
    arm === 'feed_forward' ? '--guard-findings-feed-forward' : '--no-guard-findings-feed-forward',
    '--trace-dir',
    traceDir,
    ...requiredTutorStubArtifactArchiveArgs(),
  ];
}

export function buildGuardFindingsFeedForwardPlan({ sourceSha, outputDir = DEFAULT_OUTPUT_DIR } = {}) {
  if (!sourceSha) fail('source SHA is required');
  const outputDirRelative = relativeOutputDir(path.resolve(outputDir));
  const jobs = [];
  for (const profile of PROFILES) {
    for (let repeat = 0; repeat < REPEATS; repeat += 1) {
      // Alternate order within each profile so one arm is not always later in
      // the quota window. Pairing is by profile + repeat and shares run seeds.
      const orderedArms = repeat % 2 === 0 ? ARMS : [...ARMS].reverse();
      for (const arm of orderedArms) {
        const id = `${profile}-${arm}-d${repeat + 1}`;
        const traceDir = path.posix.join(outputDirRelative, 'traces', id);
        jobs.push({
          id,
          pairId: `${profile}-d${repeat + 1}`,
          arm,
          profile,
          repeat: repeat + 1,
          world: WORLD,
          traceDir,
          modelCallBudget: MODEL_CALL_BUDGET,
          argv: jobArgv({ arm, profile, repeat, traceDir }),
        });
      }
    }
  }
  const plan = {
    schema: SCHEMA,
    status: 'prepared_not_authorized',
    workplanItem: 'guard-findings-feed-forward',
    sourceSha,
    outputDir: outputDirRelative,
    design: {
      kind: 'paired_feasibility_screen',
      world: WORLD,
      profiles: PROFILES,
      arms: ARMS,
      repeats: REPEATS,
      dialogues: jobs.length,
      turnCap: TURN_CAP,
      pairedSeed: true,
      primaryEndpoint:
        'same finding key recurs in the effective advisory issues on the immediately following delivered tutor turn',
      qualityGuardrails: [
        'new advisory findings per next turn',
        'advisory findings per tutor turn',
        'original candidate delivery share',
        'deterministic fallback share',
        'grounded closure and mean turns',
      ],
      inferenceBoundary:
        'descriptive feasibility screen; no treatment-effect claim or default-policy change from this cohort alone',
    },
    routing: {
      allModelBackedRoles: MODEL,
      effort: 'medium',
      committee: false,
      guardBoundaryPolicy: 'shadow_advisory',
    },
    externalPayloadBoundary: {
      openai:
        'Rowan Flat tutor/world material, tutor prompts, public dialogue history, ordinary recovery payloads, private simulated learner profiles, learner-record, DAG, and classification payloads through the Codex CLI',
      local: 'deterministic guard audits, recurrence analysis, certificate checks, and artifact assembly',
      otherExternalProviders: 'none',
    },
    attemptsPerJob: 1,
    maxModelCalls: MAX_MODEL_CALLS,
    jobs,
  };
  plan.planHash = hashObject(plan);
  return plan;
}

function writePlanAndCertificate(plan, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const planPath = path.join(outputDir, 'launch-plan.json');
  const serializedPlan = `${JSON.stringify(plan, null, 2)}\n`;
  fs.writeFileSync(planPath, serializedPlan);
  const certificate = {
    schema: CERTIFICATE_SCHEMA,
    status: 'pass',
    createdAt: new Date().toISOString(),
    sourceSha: plan.sourceSha,
    planPath: path.relative(ROOT, planPath).split(path.sep).join('/'),
    planFileSha256: sha256(serializedPlan),
    planHash: plan.planHash,
    jobs: plan.jobs.length,
    attemptsPerJob: plan.attemptsPerJob,
    maxModelCalls: plan.maxModelCalls,
    zeroModelChecks: {
      uniqueJobIds: new Set(plan.jobs.map((job) => job.id)).size === plan.jobs.length,
      pairedCellsComplete: plan.jobs.length === PROFILES.length * ARMS.length * REPEATS,
      singleProvider: plan.routing.allModelBackedRoles === MODEL,
      committeeDisabled: plan.routing.committee === false,
      sourceCleanAndCommitted: true,
    },
  };
  if (Object.values(certificate.zeroModelChecks).some((value) => value !== true)) {
    fail(`certificate checks failed: ${JSON.stringify(certificate.zeroModelChecks)}`);
  }
  const certificatePath = path.join(outputDir, 'launch-certificate.json');
  fs.writeFileSync(certificatePath, `${JSON.stringify(certificate, null, 2)}\n`);
  return { certificate, certificatePath, planPath };
}

function verifyCertificate(certificatePath) {
  const certificate = JSON.parse(fs.readFileSync(certificatePath, 'utf8'));
  if (certificate.schema !== CERTIFICATE_SCHEMA || certificate.status !== 'pass')
    fail('launch certificate is not valid');
  const planPath = path.resolve(ROOT, certificate.planPath);
  const planRaw = fs.readFileSync(planPath, 'utf8');
  if (sha256(planRaw) !== certificate.planFileSha256) fail('launch plan bytes do not match the certificate');
  const plan = JSON.parse(planRaw);
  if (plan.planHash !== certificate.planHash) fail('launch plan hash does not match the certificate');
  if (plan.sourceSha !== assertCleanSource(ROOT) || plan.sourceSha !== certificate.sourceSha) {
    fail('current clean source SHA does not match the certificate');
  }
  if (plan.jobs.length !== certificate.jobs || plan.attemptsPerJob !== 1) fail('certified job ceiling changed');
  return { certificate, plan, planPath };
}

function verifyDryRun(plan) {
  const seen = new Set();
  const verified = [];
  for (const job of plan.jobs) {
    const cell = `${job.profile}:${job.arm}`;
    if (seen.has(cell)) continue;
    seen.add(cell);
    const result = spawnSync(process.execPath, [...job.argv, '--dry-run'], {
      cwd: ROOT,
      env: { ...process.env, NO_COLOR: '1', TUTOR_STUB_GUARD_POLICY: 'shadow_advisory' },
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
    if (result.status !== 0) fail(`dry-run failed for ${job.id}: ${result.stderr || result.stdout}`);
    const dryRun = JSON.parse(result.stdout);
    const options = dryRun.sessionRecipe?.config?.options || {};
    if (dryRun.world?.id !== WORLD) fail(`${job.id}: wrong world in dry-run`);
    if (dryRun.modelRef !== MODEL || dryRun.autoLearner?.modelRef !== MODEL) fail(`${job.id}: model routing drifted`);
    if (options['guard-findings-feed-forward'] !== (job.arm === 'feed_forward')) {
      fail(`${job.id}: treatment flag did not reach the session recipe`);
    }
    if (dryRun.committee?.enabled) fail(`${job.id}: committee unexpectedly enabled`);
    if (dryRun.lab?.admission?.researchUseAcknowledged !== true) fail(`${job.id}: research-use admission missing`);
    verified.push({ cell, job: job.id, configHash: dryRun.sessionRecipe.configHash });
  }
  return verified;
}

function runJob(job) {
  return new Promise((resolve) => {
    const traceDir = path.resolve(ROOT, job.traceDir);
    fs.mkdirSync(traceDir, { recursive: true });
    const child = spawn(process.execPath, job.argv, {
      cwd: ROOT,
      env: { ...process.env, NO_COLOR: '1', TUTOR_STUB_GUARD_POLICY: 'shadow_advisory' },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderrTail = '';
    child.stderr.on('data', (chunk) => {
      stderrTail = `${stderrTail}${chunk}`.slice(-4000);
    });
    const timer = setTimeout(() => child.kill('SIGKILL'), TIMEOUT_MS);
    child.on('close', (exitCode) => {
      clearTimeout(timer);
      resolve({ exitCode, stderrTail });
    });
  });
}

function extractJobResult(job) {
  const { tracePath, rows } = readTutorStubShowcaseTrace(path.resolve(ROOT, job.traceDir));
  const dialogue = parseTutorStubShowcaseTrace(rows);
  const turnRecords = rows.filter((row) => row.type === 'turn_complete' && row.turnRecord).map((row) => row.turnRecord);
  return {
    tracePath: path.relative(ROOT, tracePath).split(path.sep).join('/'),
    publicTurns: (dialogue.turns || []).map((turn) => ({
      index: turn.index ?? null,
      learner: turn.learner?.text || '',
      tutor: turn.tutor?.text || '',
    })),
    turnCount: dialogue.turnCount ?? turnRecords.length,
    stopReason: dialogue.stopReason || null,
    modelCalls: dialogue.modelCalls ?? null,
    closure: dialogue.closure || null,
    guardTurns: turnRecords.map((turn) => ({
      tutorTurn: turn.tutorTurn ?? turn.index ?? null,
      tutorGuardAccounting: turn.tutorGuardAccounting || null,
      guardFindingsFeedForward: turn.guardFindingsFeedForward || null,
    })),
  };
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function summarizeArm(rows, arm) {
  const dialogues = rows.filter((row) => row.arm === arm && row.status === 'complete');
  const turns = dialogues.flatMap((row) => row.guardTurns || []);
  const recurrence = dialogues.map((row) => summarizeTutorStubGuardFindingRecurrence(row.guardTurns || []));
  const eligible = recurrence.reduce((sum, row) => sum + row.eligible, 0);
  const repeated = recurrence.reduce((sum, row) => sum + row.repeated, 0);
  const newFindings = [];
  for (const dialogue of dialogues) {
    for (let index = 0; index < dialogue.guardTurns.length - 1; index += 1) {
      const current = new Set(
        extractTutorStubEffectiveAdvisoryIssues(dialogue.guardTurns[index]).map(tutorStubGuardFindingKey),
      );
      const next = extractTutorStubEffectiveAdvisoryIssues(dialogue.guardTurns[index + 1]).map(
        tutorStubGuardFindingKey,
      );
      newFindings.push(...next.filter((key) => !current.has(key)));
    }
  }
  const originalCandidateDeliveries = turns.filter(
    (turn) => turn.tutorGuardAccounting?.finalDelivery?.source === 'original_candidate',
  ).length;
  const deterministicFallbacks = turns.filter(
    (turn) => turn.tutorGuardAccounting?.finalDelivery?.deterministicFallback === true,
  ).length;
  const advisoryFindings = turns.reduce((sum, turn) => sum + extractTutorStubEffectiveAdvisoryIssues(turn).length, 0);
  return {
    arm,
    dialogues: dialogues.length,
    tutorTurns: turns.length,
    eligiblePriorFindings: eligible,
    repeatedFindings: repeated,
    clearedFindings: eligible - repeated,
    recurrenceRate: eligible ? repeated / eligible : null,
    newFindingsOnNextTurns: newFindings.length,
    newFindingsPerTutorTurn: turns.length ? newFindings.length / turns.length : null,
    advisoryFindingsPerTutorTurn: turns.length ? advisoryFindings / turns.length : null,
    originalCandidateDeliveryShare: turns.length ? originalCandidateDeliveries / turns.length : null,
    deterministicFallbackShare: turns.length ? deterministicFallbacks / turns.length : null,
    groundedClosures: dialogues.filter((row) => row.closure?.grounded === true).length,
    meanTurns: mean(dialogues.map((row) => Number(row.turnCount || 0))),
    feedForwardAppliedTurns: turns.filter((turn) => turn.guardFindingsFeedForward?.applied === true).length,
  };
}

function writeReport(outputDir, plan, rows) {
  const arms = ARMS.map((arm) => summarizeArm(rows, arm));
  const byArm = Object.fromEntries(arms.map((row) => [row.arm, row]));
  const recurrenceDifference =
    byArm.feed_forward.recurrenceRate === null || byArm.control.recurrenceRate === null
      ? null
      : byArm.feed_forward.recurrenceRate - byArm.control.recurrenceRate;
  const report = {
    schema: 'machinespirits.tutor-stub.guard-findings-feed-forward-report.v1',
    sourceSha: plan.sourceSha,
    planHash: plan.planHash,
    status:
      rows.length === plan.jobs.length && rows.every((row) => row.status === 'complete') ? 'complete' : 'incomplete',
    inferenceBoundary: plan.design.inferenceBoundary,
    arms,
    primary: {
      estimand: 'feed-forward recurrence rate minus control recurrence rate; negative favors feed-forward',
      recurrenceRateDifference: recurrenceDifference,
      opportunityAdequacy: arms.every((arm) => arm.eligiblePriorFindings >= 10),
    },
    technicalFailures: rows
      .filter((row) => row.status !== 'complete')
      .map((row) => ({
        id: row.id,
        status: row.status,
        exitCode: row.exitCode,
        error: row.error || null,
      })),
  };
  fs.writeFileSync(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  const pct = (value) => (value === null ? 'unmeasured' : `${(value * 100).toFixed(1)}%`);
  const markdown = [
    '# Guard findings feed-forward — paired feasibility screen',
    '',
    `Source \`${report.sourceSha}\`; ${rows.length}/${plan.jobs.length} dialogues recorded.`,
    '',
    '| Arm | Dialogues | Turns | Prior-finding opportunities | Recurrence | New findings / turn | Original draft shipped | Fallback | Grounded closure |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|',
    ...arms.map(
      (arm) =>
        `| ${arm.arm} | ${arm.dialogues} | ${arm.tutorTurns} | ${arm.eligiblePriorFindings} | ${pct(arm.recurrenceRate)} | ${arm.newFindingsPerTutorTurn?.toFixed(2) ?? '—'} | ${pct(arm.originalCandidateDeliveryShare)} | ${pct(arm.deterministicFallbackShare)} | ${arm.groundedClosures}/${arm.dialogues} |`,
    ),
    '',
    `Primary descriptive difference: ${recurrenceDifference === null ? 'unmeasured' : `${(recurrenceDifference * 100).toFixed(1)} percentage points`} (negative favors feed-forward).`,
    '',
    report.inferenceBoundary,
    '',
  ].join('\n');
  fs.writeFileSync(path.join(outputDir, 'report.md'), markdown);
  return report;
}

function parseArgs(argv) {
  const args = { outputDir: DEFAULT_OUTPUT_DIR, prepareCertificate: false, launchCertificate: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--output-dir') args.outputDir = path.resolve(argv[++index]);
    else if (arg === '--prepare-certificate') args.prepareCertificate = true;
    else if (arg === '--launch-certificate') args.launchCertificate = path.resolve(argv[++index]);
    else fail(`unknown argument: ${arg}`);
  }
  if (args.prepareCertificate === Boolean(args.launchCertificate)) {
    fail('choose exactly one of --prepare-certificate or --launch-certificate <path>');
  }
  return args;
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.prepareCertificate) {
    const sourceSha = assertCleanSource(ROOT);
    const plan = buildGuardFindingsFeedForwardPlan({ sourceSha, outputDir: args.outputDir });
    const delivery = verifyDryRun(plan);
    const artifacts = writePlanAndCertificate(plan, args.outputDir);
    process.stdout.write(
      `certificate PASS; 0 model calls; ${plan.jobs.length} jobs; maximum ${plan.maxModelCalls} model calls\n` +
        `delivery verified: ${delivery.length}/${PROFILES.length * ARMS.length} unique cells\n` +
        `plan: ${path.relative(ROOT, artifacts.planPath)}\n` +
        `certificate: ${path.relative(ROOT, artifacts.certificatePath)}\n`,
    );
    return;
  }

  const { plan } = verifyCertificate(args.launchCertificate);
  const outputDir = path.resolve(ROOT, plan.outputDir);
  const resultsPath = path.join(outputDir, 'results.jsonl');
  if (fs.existsSync(resultsPath) && fs.readFileSync(resultsPath, 'utf8').trim()) {
    fail('results already exist; this frozen pilot does not resume or rerun jobs');
  }
  fs.mkdirSync(outputDir, { recursive: true });
  for (const [index, job] of plan.jobs.entries()) {
    const startedAt = Date.now();
    const execution = await runJob(job);
    let row;
    try {
      const result = extractJobResult(job);
      row = {
        id: job.id,
        pairId: job.pairId,
        arm: job.arm,
        profile: job.profile,
        repeat: job.repeat,
        status: execution.exitCode === 0 ? 'complete' : 'aborted',
        exitCode: execution.exitCode,
        wallClockMs: Date.now() - startedAt,
        ...result,
      };
    } catch (error) {
      row = {
        id: job.id,
        pairId: job.pairId,
        arm: job.arm,
        profile: job.profile,
        repeat: job.repeat,
        status: 'technical_failure',
        exitCode: execution.exitCode,
        wallClockMs: Date.now() - startedAt,
        error: error.message,
        stderrTail: execution.stderrTail,
      };
    }
    fs.appendFileSync(resultsPath, `${JSON.stringify(row)}\n`);
    process.stderr.write(
      `${index + 1}/${plan.jobs.length} ${job.id}: ${row.status}; turns=${row.turnCount ?? '—'} calls=${row.modelCalls ?? '—'}\n`,
    );
    if (row.status !== 'complete') break;
  }
  const rows = fs
    .readFileSync(resultsPath, 'utf8')
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const report = writeReport(outputDir, plan, rows);
  process.stdout.write(`${report.status}: ${path.relative(ROOT, path.join(outputDir, 'report.md'))}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error}\n`);
    process.exitCode = 1;
  });
}
