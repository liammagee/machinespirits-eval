#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
  auditTutorStubPointOfActionCompliance,
  buildTutorStubPointOfActionTurn,
  TUTOR_STUB_POINT_OF_ACTION_ARMS,
  TUTOR_STUB_POINT_OF_ACTION_DETECTOR_VERSION,
  tutorStubPointOfActionPlaceboAudit,
} from '../services/tutorStubPointOfActionCoaching.js';
import { learnerProfilePrompt } from './tutor-stub-learner-profile-contracts.js';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');

export const STEP4_POINT_OF_ACTION_SPEC = Object.freeze({
  schema: 'machinespirits.tutor-stub.step4-point-of-action-plan.v1',
  preregistration: 'POINT-OF-ACTION-COACHING-PREREGISTRATION.md',
  world: 'world_005_marrick',
  policy: 'bland',
  profiles: Object.freeze(['proof_skipper', 'affective_resistant']),
  tutorFamilies: Object.freeze(['codex.gpt-5.6-sol', 'claude-code.sonnet-5']),
  supportingModel: 'codex.gpt-5.6-terra',
  repeats: 5,
  runSeed: 20260714,
  safetyTurns: 40,
  primaryHorizon: 16,
  triggerWindow: Object.freeze([3, 24]),
  dagMode: 'strict_dag',
  registerTemperature: 0.15,
  registerOverlayThreshold: 0.7,
  dagFactDropout: 0,
  dagFactDropoutSeed: 1,
  releaseSpeed: 1,
  maxTokens: 4096,
  historyTurns: 4,
});

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalJson(value[key])]));
  }
  return value;
}

function sha256(value) {
  const input = Buffer.isBuffer(value)
    ? value
    : typeof value === 'string'
      ? value
      : JSON.stringify(canonicalJson(value));
  return createHash('sha256').update(input).digest('hex');
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function deterministicShuffle(rows, seed) {
  const result = [...rows];
  const random = mulberry32(seed);
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function slug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '');
}

function flagValue(command, flag) {
  const index = command.indexOf(flag);
  return index >= 0 ? command[index + 1] : null;
}

function commandForJob(job, outputRoot) {
  const traceDir = path.join(outputRoot, 'traces', job.id);
  return [
    process.execPath,
    'scripts/tutor-stub.js',
    '--auto-learner',
    '--auto-turns',
    'until-grounded',
    '--auto-safety-turns',
    String(STEP4_POINT_OF_ACTION_SPEC.safetyTurns),
    '--model',
    job.tutorFamily,
    '--classifier-model',
    STEP4_POINT_OF_ACTION_SPEC.supportingModel,
    '--learner-record-model',
    STEP4_POINT_OF_ACTION_SPEC.supportingModel,
    '--auto-learner-model',
    STEP4_POINT_OF_ACTION_SPEC.supportingModel,
    '--auto-learner-profile',
    learnerProfilePrompt(job.profile),
    '--tutor-learner-dag',
    '--world',
    STEP4_POINT_OF_ACTION_SPEC.world,
    '--dag-mode',
    STEP4_POINT_OF_ACTION_SPEC.dagMode,
    '--register-policy',
    STEP4_POINT_OF_ACTION_SPEC.policy,
    '--register-palette',
    'all',
    '--register-temperature',
    String(STEP4_POINT_OF_ACTION_SPEC.registerTemperature),
    '--register-overlay-threshold',
    String(STEP4_POINT_OF_ACTION_SPEC.registerOverlayThreshold),
    '--dag-fact-dropout',
    String(STEP4_POINT_OF_ACTION_SPEC.dagFactDropout),
    '--dag-fact-dropout-seed',
    String(STEP4_POINT_OF_ACTION_SPEC.dagFactDropoutSeed),
    '--release-speed',
    String(STEP4_POINT_OF_ACTION_SPEC.releaseSpeed),
    '--run-seed',
    String(STEP4_POINT_OF_ACTION_SPEC.runSeed),
    '--eval-repeat',
    String(job.repeat),
    '--eval-job-id',
    job.id,
    '--trace-dir',
    traceDir,
    '--max-tokens',
    String(STEP4_POINT_OF_ACTION_SPEC.maxTokens),
    '--history-turns',
    String(STEP4_POINT_OF_ACTION_SPEC.historyTurns),
    '--point-of-action-arm',
    job.arm,
    '--dag',
    '--no-stream',
    '--no-interim-animation',
    '--learner',
    `Frozen Step 4 ${job.profile} repeat ${job.repeat}/${STEP4_POINT_OF_ACTION_SPEC.repeats}.`,
  ];
}

export function buildStep4PointOfActionPlan({ outputRoot = 'exports/tutor-stub-step4-claim-runs' } = {}) {
  const cells = [];
  for (let repeat = 1; repeat <= STEP4_POINT_OF_ACTION_SPEC.repeats; repeat += 1) {
    for (const tutorFamily of STEP4_POINT_OF_ACTION_SPEC.tutorFamilies) {
      for (const profile of STEP4_POINT_OF_ACTION_SPEC.profiles) {
        for (const arm of TUTOR_STUB_POINT_OF_ACTION_ARMS) {
          cells.push({ repeat, tutorFamily, profile, arm });
        }
      }
    }
  }
  const jobs = deterministicShuffle(cells, STEP4_POINT_OF_ACTION_SPEC.runSeed).map((cell, index) => {
    const id = [
      `step4-${String(index + 1).padStart(2, '0')}`,
      slug(cell.tutorFamily),
      cell.profile,
      cell.arm,
      `r${cell.repeat}`,
    ].join('-');
    const job = { ordinal: index + 1, id, ...cell };
    return {
      ...job,
      command: commandForJob(job, outputRoot),
    };
  });
  return {
    ...STEP4_POINT_OF_ACTION_SPEC,
    detectorVersion: TUTOR_STUB_POINT_OF_ACTION_DETECTOR_VERSION,
    arms: [...TUTOR_STUB_POINT_OF_ACTION_ARMS],
    outputRoot,
    ordering: 'seeded Fisher-Yates over the complete balanced 2 x 2 x 4 x 5 matrix',
    jobs,
  };
}

export function validateStep4PointOfActionPlan(plan) {
  const errors = [];
  if (plan.jobs.length !== 80) errors.push(`expected 80 jobs, found ${plan.jobs.length}`);
  const cellCounts = new Map();
  for (const job of plan.jobs) {
    const key = [job.tutorFamily, job.profile, job.arm].join('|');
    cellCounts.set(key, (cellCounts.get(key) || 0) + 1);
    for (const flag of ['--classifier-model', '--learner-record-model', '--auto-learner-model']) {
      if (flagValue(job.command, flag) !== STEP4_POINT_OF_ACTION_SPEC.supportingModel) {
        errors.push(`${job.id} changed fixed supporting seam ${flag}`);
      }
    }
    if (flagValue(job.command, '--model') !== job.tutorFamily) errors.push(`${job.id} tutor-family flag mismatch`);
    if (flagValue(job.command, '--point-of-action-arm') !== job.arm) errors.push(`${job.id} arm flag mismatch`);
    if (flagValue(job.command, '--run-seed') !== String(STEP4_POINT_OF_ACTION_SPEC.runSeed)) {
      errors.push(`${job.id} run-seed mismatch`);
    }
  }
  for (const tutorFamily of STEP4_POINT_OF_ACTION_SPEC.tutorFamilies) {
    for (const profile of STEP4_POINT_OF_ACTION_SPEC.profiles) {
      for (const arm of TUTOR_STUB_POINT_OF_ACTION_ARMS) {
        const key = [tutorFamily, profile, arm].join('|');
        if (cellCounts.get(key) !== STEP4_POINT_OF_ACTION_SPEC.repeats) {
          errors.push(`${key} expected ${STEP4_POINT_OF_ACTION_SPEC.repeats} jobs, found ${cellCounts.get(key) || 0}`);
        }
      }
    }
  }
  return {
    ok: errors.length === 0,
    errors,
    jobCount: plan.jobs.length,
    balancedCellCount: cellCounts.size,
    fixedSupportingSeams: errors.every((error) => !error.includes('supporting seam')),
  };
}

export function runStep4ZeroModelFixtures() {
  const t1 = buildTutorStubPointOfActionTurn({
    arm: 'compiled_constraint',
    turn: 8,
    stagnation: 0.75,
    proposedActionFamily: 'probe_evidence',
    previousActionFamilies: ['probe_evidence', 'probe_evidence', 'probe_evidence', 'probe_evidence'],
    evidenceUse: 'omits_warrant',
    duePremises: ['p_due'],
  });
  const t2 = buildTutorStubPointOfActionTurn({
    arm: 'side_coach',
    turn: 9,
    stagnation: 0.2,
    proposedActionFamily: 'probe_evidence',
    previousActionFamilies: ['orient', 'probe_evidence', 'reanchor_public_evidence', 'probe_evidence'],
    evidenceUse: 'overleaps_evidence',
  });
  const negative = buildTutorStubPointOfActionTurn({
    arm: 'triggered_placebo',
    turn: 10,
    stagnation: 0.59,
    proposedActionFamily: 'probe_evidence',
    previousActionFamilies: ['probe_evidence', 'probe_evidence', 'probe_evidence', 'probe_evidence'],
    evidenceUse: 'links_evidence_to_rule',
  });
  const nearClosure = buildTutorStubPointOfActionTurn({
    arm: 'side_coach',
    turn: 11,
    stagnation: 0.9,
    proposedActionFamily: 'probe_evidence',
    previousActionFamilies: ['probe_evidence', 'probe_evidence', 'probe_evidence', 'probe_evidence'],
    evidenceUse: 'omits_warrant',
    nearClosure: true,
  });
  const glossary = buildTutorStubPointOfActionTurn({
    arm: 'side_coach',
    turn: 12,
    stagnation: 0.9,
    proposedActionFamily: 'probe_evidence',
    previousActionFamilies: ['probe_evidence', 'probe_evidence', 'probe_evidence', 'probe_evidence'],
    evidenceUse: 'none',
    unresolvedTerms: ['kettle queue'],
  });
  const releaseCompliance = auditTutorStubPointOfActionCompliance({
    turn: t1,
    tutorText: 'I am bringing in the due public premise now.',
    releasedPremiseCount: 1,
    realizedActionFamily: 'stage_next_step',
  });
  const warrantCompliance = auditTutorStubPointOfActionCompliance({
    turn: t2,
    tutorText: 'Which public record connects that claim to the rule?',
    releasedPremiseCount: 0,
    realizedActionFamily: 'answer_accountably',
    guardsPassed: true,
  });
  const noReleaseFailure = auditTutorStubPointOfActionCompliance({
    turn: t1,
    tutorText: 'Let us keep looking.',
    releasedPremiseCount: 0,
    realizedActionFamily: 'probe_evidence',
  });
  const placebo = tutorStubPointOfActionPlaceboAudit();
  const checks = {
    positive_t1: t1.assigned_trigger === 'stagnant_repeat',
    cofire_priority_t1: t1.cofire && t1.assignment_priority === 1,
    positive_t2: t2.assigned_trigger === 'warrant_skip',
    negative_case: negative.assigned_trigger === null,
    near_closure_suppression: nearClosure.assigned_trigger === null && nearClosure.suppression.near_closure,
    glossary_suppression: glossary.assigned_trigger === null && glossary.suppression.unresolved_glossary,
    release_compliance: releaseCompliance?.compliant === true,
    no_release_noncompliance: noReleaseFailure?.compliant === false,
    warrant_compliance: warrantCompliance?.compliant === true,
    placebo_target_free_and_matched: Object.values(placebo).every(
      (row) => row.target_free && row.token_count_matched,
    ),
  };
  return {
    ok: Object.values(checks).every(Boolean),
    checks,
    placebo,
    fixtures: { t1, t2, negative, nearClosure, glossary, releaseCompliance, warrantCompliance, noReleaseFailure },
  };
}

function renderMarkdown(artifact, jsonPath) {
  const validationRows = Object.entries(artifact.fixtures.checks)
    .map(([name, passed]) => `| \`${name}\` | ${passed ? 'PASS' : 'FAIL'} |`)
    .join('\n');
  return `# Step 4 point-of-action zero-model gate\n\n` +
    `- Status: **${artifact.ok ? 'PASS' : 'FAIL'}**\n` +
    `- Model calls: **0**\n` +
    `- Planned claim-bearing dialogues: **${artifact.plan.jobs.length}**\n` +
    `- Detector: \`${artifact.plan.detectorVersion}\`\n` +
    `- Plan SHA-256: \`${artifact.planSha256}\`\n` +
    `- JSON: \`${path.relative(ROOT, jsonPath)}\`\n` +
    `- Paid launch: **locked; requires \`--launch-approved --expected-sha <clean-commit>\`**\n\n` +
    `| Check | Result |\n|---|---|\n${validationRows}\n\n` +
    `All non-speaking seams are fixed to \`${STEP4_POINT_OF_ACTION_SPEC.supportingModel}\`. ` +
    `The speaking tutor is the only model-family factor.\n`;
}

function gitOutput(args) {
  const result = spawnSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed`);
  return result.stdout.trim();
}

function assertLaunchAuthorization(expectedSha) {
  if (!/^[0-9a-f]{40}$/u.test(expectedSha || '')) {
    throw new Error('--launch-approved also requires --expected-sha with the exact 40-character clean commit SHA');
  }
  const head = gitOutput(['rev-parse', 'HEAD']);
  if (head !== expectedSha) throw new Error(`launch SHA mismatch: expected ${expectedSha}, checkout is ${head}`);
  const dirty = gitOutput(['status', '--porcelain']);
  if (dirty) throw new Error('paid launch requires a clean checkout');
  return head;
}

async function runCommand(command, ordinal, total) {
  console.log(`[step4] ${ordinal}/${total} ${command.at(-4) || ''}`);
  await new Promise((resolve, reject) => {
    const child = spawn(command[0], command.slice(1), { cwd: ROOT, env: process.env, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) reject(new Error(`child stopped by ${signal}`));
      else if (code !== 0) reject(new Error(`child exited ${code}`));
      else resolve();
    });
  });
}

async function main() {
  const { values } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      'launch-approved': { type: 'boolean', default: false },
      'expected-sha': { type: 'string', default: '' },
      'output-dir': { type: 'string', default: '' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    console.log('Usage: node scripts/run-step4-point-of-action-gate.js [--dry-run] [--launch-approved --expected-sha <sha>] [--output-dir <dir>]');
    return;
  }
  if (values['dry-run'] && values['launch-approved']) throw new Error('choose either --dry-run or --launch-approved');
  const launch = Boolean(values['launch-approved']);
  const outputRoot = path.resolve(
    ROOT,
    values['output-dir'] || (launch ? 'exports/tutor-stub-step4-claim-runs' : 'exports/tutor-stub-step4-dry-run'),
  );
  const plan = buildStep4PointOfActionPlan({ outputRoot });
  const validation = validateStep4PointOfActionPlan(plan);
  const fixtures = runStep4ZeroModelFixtures();
  const artifact = {
    schema: 'machinespirits.tutor-stub.step4-zero-model-gate.v1',
    generatedAt: new Date().toISOString(),
    mode: launch ? 'paid_launch' : 'zero_model_dry_run',
    modelCallsBeforeArtifact: 0,
    launchAuthorized: launch,
    ok: validation.ok && fixtures.ok,
    planSha256: sha256(plan),
    validation,
    fixtures,
    plan,
  };
  if (!artifact.ok) throw new Error(`Step 4 gate failed: ${[...validation.errors].join('; ')}`);
  fs.mkdirSync(outputRoot, { recursive: true });
  const jsonPath = path.join(outputRoot, launch ? 'launch-plan.json' : 'zero-model-dry-run.json');
  const markdownPath = path.join(outputRoot, launch ? 'launch-plan.md' : 'zero-model-dry-run.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify(artifact, null, 2)}\n`);
  fs.writeFileSync(markdownPath, renderMarkdown(artifact, jsonPath));
  if (!launch) {
    const manifestPath = path.join(
      ROOT,
      'config/adaptive-tutor-evidence/tutor-stub-step4-zero-model-dry-run.manifest.json',
    );
    fs.writeFileSync(
      manifestPath,
      `${JSON.stringify(
        {
          schema: 'machinespirits.tutor-stub.step4-zero-model-gate-manifest.v1',
          generatedAt: artifact.generatedAt,
          status: 'pass',
          modelCalls: 0,
          jobCount: plan.jobs.length,
          planSha256: artifact.planSha256,
          artifact: path.relative(ROOT, jsonPath),
          artifactSha256: sha256(fs.readFileSync(jsonPath)),
          command: 'npm run tutor:stub:step4 -- --dry-run',
          paidLaunchStatus: 'locked_pending_explicit_user_approval',
        },
        null,
        2,
      )}\n`,
    );
    console.log(`[step4] zero-model gate PASS; 0 model calls; ${plan.jobs.length} jobs planned`);
    console.log(`[step4] ${path.relative(ROOT, jsonPath)}`);
    console.log(`[step4] ${path.relative(ROOT, manifestPath)}`);
    return;
  }
  const launchSha = assertLaunchAuthorization(values['expected-sha']);
  artifact.launchSha = launchSha;
  for (const job of plan.jobs) await runCommand(job.command, job.ordinal, plan.jobs.length);
}

if (path.resolve(process.argv[1] || '') === SCRIPT_PATH) {
  try {
    await main();
  } catch (error) {
    console.error(`[step4] ${error.message}`);
    process.exit(1);
  }
}
