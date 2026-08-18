#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { OUTCOME_STUDY_SUPPORTED_LEARNER_PROFILES } from '../services/adaptiveWarrantOutcomeLearnerProfiles.js';
import { resistantLearnerObservationMarkers } from '../services/resistantLearnerObservation.js';
import { learnerProfileContract, learnerProfilePrompt } from './tutor-stub-learner-profile-contracts.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_REGISTRATION = path.join(
  ROOT,
  'config',
  'tutor-stub-resistant-profile-discrimination-registration.v1.json',
);

function parseArgs(argv) {
  const args = { registration: DEFAULT_REGISTRATION, traceDir: '', json: false, out: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--registration') args.registration = path.resolve(argv[++index] || '');
    else if (token === '--trace-dir') args.traceDir = String(argv[++index] || '').trim();
    else if (token === '--out') args.out = path.resolve(argv[++index] || '');
    else if (token === '--json') args.json = true;
    else if (token === '--help' || token === '-h') {
      console.log(`Usage:
  node scripts/prepare-tutor-stub-resistant-profile-discrimination.js [options]

Options:
  --registration <json>  frozen registration (default: config v1)
  --trace-dir <path>     override the zero-call dry-run artifact root
  --json                 emit machine-readable preflight report
  --out <file>           write the report instead of stdout

This command only asks the QA runner to print its dry plan. It never starts a
dialogue or makes a model call.`);
      process.exit(0);
    } else throw new Error(`Unknown option: ${token}`);
  }
  return args;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalJson(value[key])]),
  );
}

function equal(left, right) {
  return JSON.stringify(canonicalJson(left)) === JSON.stringify(canonicalJson(right));
}

function assertion(checks, name, condition, detail) {
  if (!condition) throw new Error(`${name}: ${detail}`);
  checks.push({ name, pass: true, detail });
}

function indexAfter(command, flag) {
  const index = command.indexOf(flag);
  return index < 0 ? null : command[index + 1];
}

function buildQaArgs(registration, traceDir) {
  const design = registration.design;
  return [
    '--policies',
    design.policies.join(','),
    '--profiles',
    design.profiles.join(','),
    '--runs',
    String(design.runsPerCell),
    '--run-seed',
    String(design.runSeed),
    '--turns',
    design.turns,
    '--safety-turns',
    String(design.safetyTurns),
    '--model',
    design.models.tutor,
    '--analysis-model',
    design.models.analysis,
    '--auto-learner-model',
    design.models.learner,
    '--model-call-budget',
    String(design.modelCallBudgetPerDialogue),
    '--world',
    design.world,
    '--dag-mode',
    design.dagMode,
    '--register-palette',
    design.registerPalette,
    '--register-overlay-threshold',
    String(design.registerOverlayThreshold),
    '--release-speed',
    String(design.releaseSpeed),
    '--cli-effort',
    design.cliEffort,
    '--history-turns',
    String(design.historyTurns),
    '--max-tokens',
    String(design.maxTokens),
    '--parallelism',
    String(design.parallelism),
    '--progress-interval',
    String(design.progressIntervalSeconds),
    '--trace-dir',
    traceDir,
    '--no-ledger',
    '--no-html-report',
    '--no-memory-summary',
    '--no-analyze',
    '--dry-run',
  ];
}

function validateProtectedProfiles(registration, checks) {
  assertion(
    checks,
    'outcome-study-registry-frozen',
    equal(OUTCOME_STUDY_SUPPORTED_LEARNER_PROFILES, registration.preservation.outcomeStudySupportedProfiles),
    `outcome driver remains ${registration.preservation.outcomeStudySupportedProfiles.join(', ')}`,
  );
  for (const [profileId, pins] of Object.entries(registration.preservation.protectedProfiles)) {
    const contract = learnerProfileContract(profileId);
    assertion(checks, `${profileId}-contract-present`, Boolean(contract), `${profileId} contract exists`);
    assertion(
      checks,
      `${profileId}-contract-hash`,
      sha256(JSON.stringify(contract)) === pins.contractSha256,
      `${profileId} contract matches ${pins.contractSha256}`,
    );
    assertion(
      checks,
      `${profileId}-prompt-hash`,
      sha256(learnerProfilePrompt(profileId)) === pins.promptSha256,
      `${profileId} prompt matches ${pins.promptSha256}`,
    );
  }
}

function validateNewProfileContracts(registration, checks) {
  for (const profileId of registration.design.newProfiles) {
    const contract = learnerProfileContract(profileId);
    const gate = registration.gates.profiles[profileId];
    assertion(checks, `${profileId}-contract-present`, Boolean(contract), `${profileId} contract exists`);
    assertion(
      checks,
      `${profileId}-nearest-neighbor`,
      contract.discriminationGate.expectedNearestNeighbor === gate.expectedNearestNeighbor &&
        registration.design.expectedNearestNeighbors[profileId] === gate.expectedNearestNeighbor,
      `${profileId} expects ${gate.expectedNearestNeighbor}`,
    );
    assertion(
      checks,
      `${profileId}-contract-gates`,
      contract.discriminationGate.maxCosineToDiligent === gate.maxCosineToDiligent &&
        contract.discriminationGate.minSignatureTargetPassRate === gate.minimumSignatureTargetPassRate &&
        contract.observabilityContract.mustShowByTurn === gate.mustShowByTurn &&
        contract.observabilityContract.minEligibleRate === gate.minimumMarkerRate,
      `${profileId} registration matches the active v4 contract`,
    );
    assertion(
      checks,
      `${profileId}-marker`,
      contract.observabilityContract.markerClauses.some((clause) =>
        clause.some((group) => group.field === gate.marker && group.values.includes(true)),
      ),
      `${profileId} uses public marker ${gate.marker}`,
    );
  }

  const boredMarkers = resistantLearnerObservationMarkers({
    learnerText: 'Sure. Whatever.',
    classification: {
      request_type: 'off_task_or_mixed',
      discourse_move: 'off_task',
      evidence_use: 'none',
      epistemic_stance: 'resistant',
      agency: 'complying',
    },
  });
  const lowAgencyNearMiss = resistantLearnerObservationMarkers({
    learnerText: 'Is it okay if I say the mark is the same?',
    classification: {
      request_type: 'resistance_or_low_agency',
      discourse_move: 'question',
      evidence_use: 'none',
      epistemic_stance: 'receptive',
      agency: 'passive',
    },
  });
  assertion(
    checks,
    'bored-public-marker-smoke',
    boredMarkers.boredWithholding === true && lowAgencyNearMiss.boredWithholding === false,
    'flat withholding is observed and permission seeking is excluded',
  );

  const defiantMarkers = resistantLearnerObservationMarkers({
    learnerText: 'I reject the premise of this exercise. You do not get to set the question that way.',
    classification: {
      request_type: 'authority_refusal_or_status_challenge',
      discourse_move: 'challenge',
      evidence_use: 'none',
      epistemic_stance: 'resistant',
      agency: 'steering',
    },
  });
  const skepticalNearMiss = resistantLearnerObservationMarkers({
    learnerText: 'Why does that conclusion follow from the mark?',
    classification: {
      request_type: 'conceptual_clarity_request',
      discourse_move: 'question',
      evidence_use: 'cites_public_evidence',
      epistemic_stance: 'exploratory',
      agency: 'steering',
    },
  });
  assertion(
    checks,
    'frame-defiant-public-marker-smoke',
    defiantMarkers.frameJurisdictionDispute === true && skepticalNearMiss.frameJurisdictionDispute === false,
    'jurisdictional refusal is observed and evidence skepticism is excluded',
  );
}

function validatePlan(registration, plan, checks) {
  const design = registration.design;
  assertion(checks, 'qa-plan-dry-run', plan.dryRun === true, 'QA plan and every child remain in dry-run mode');
  assertion(checks, 'qa-plan-profiles', equal(plan.profiles, design.profiles), 'profile order is frozen');
  assertion(checks, 'qa-plan-policies', equal(plan.policies, design.policies), 'policy set is frozen');
  assertion(
    checks,
    'qa-plan-size',
    plan.expectedDialogueRows === design.expectedDialogues && plan.runs === design.runsPerCell,
    `${design.expectedDialogues} dialogue rows are planned`,
  );
  const scalarPins = {
    runSeed: design.runSeed,
    turns: design.turns,
    safetyTurns: design.safetyTurns,
    world: design.world,
    dagMode: design.dagMode,
    registerPalette: design.registerPalette,
    model: design.models.tutor,
    analysisModel: design.models.analysis,
    autoLearnerModel: design.models.learner,
    modelCallBudget: design.modelCallBudgetPerDialogue,
    cliEffort: design.cliEffort,
    historyTurns: design.historyTurns,
    maxTokens: design.maxTokens,
    registerOverlayThreshold: design.registerOverlayThreshold,
    releaseSpeed: design.releaseSpeed,
    parallelism: design.parallelism,
    progressIntervalSeconds: design.progressIntervalSeconds,
  };
  for (const [field, expected] of Object.entries(scalarPins)) {
    assertion(checks, `qa-plan-${field}`, plan[field] === expected, `${field} is pinned to ${expected}`);
  }
  assertion(
    checks,
    'qa-plan-total-budget',
    plan.expectedDialogueRows * plan.modelCallBudget === design.maxPlannedModelAttempts,
    `total attempt ceiling is ${design.maxPlannedModelAttempts}`,
  );
  assertion(
    checks,
    'qa-plan-child-guards',
    plan.jobs.length === design.profiles.length &&
      plan.jobs.every(
        (job) =>
          job.command.includes('--dry-run') &&
          indexAfter(job.command, '--auto-learner-profile-id') === job.profile &&
          indexAfter(job.command, '--model') === design.models.tutor &&
          indexAfter(job.command, '--analysis-model') === design.models.analysis &&
          indexAfter(job.command, '--auto-learner-model') === design.models.learner &&
          indexAfter(job.command, '--model-call-budget') === String(design.modelCallBudgetPerDialogue) &&
          indexAfter(job.command, '--dag-mode') === design.dagMode &&
          indexAfter(job.command, '--register-palette') === design.registerPalette &&
          indexAfter(job.command, '--turns') === design.turns &&
          indexAfter(job.command, '--safety-turns') === String(design.safetyTurns) &&
          indexAfter(job.command, '--world') === design.world &&
          indexAfter(job.command, '--cli-effort') === design.cliEffort &&
          indexAfter(job.command, '--history-turns') === String(design.historyTurns) &&
          indexAfter(job.command, '--max-tokens') === String(design.maxTokens) &&
          indexAfter(job.command, '--register-overlay-threshold') === String(design.registerOverlayThreshold) &&
          indexAfter(job.command, '--release-speed') === String(design.releaseSpeed),
      ),
    'every child command is dry and carries budget, DAG, and safe-palette pins',
  );
}

function formatMarkdown(report) {
  const lines = [
    '# Resistant Learner Profile Discrimination Preflight',
    '',
    `Registration: \`${report.registration}\``,
    `Registration SHA-256: \`${report.registrationSha256}\``,
    `Status: **${report.pass ? 'PASS' : 'FAIL'}**`,
    `Model calls authorized: **${report.authorization.modelCallsAuthorized ? 'yes' : 'no'}**`,
    '',
    '## Checks',
    '',
  ];
  for (const check of report.checks) lines.push(`- ${check.pass ? 'PASS' : 'FAIL'} — ${check.name}: ${check.detail}`);
  lines.push('', '## Zero-call orchestration dry run', '', '```bash', report.commands.dryRun.join(' '), '```', '');
  lines.push('## Post-run analyzer (still blocked on a separately authorized live artifact)', '', '```bash');
  lines.push(report.commands.analyze.join(' '), '```', '');
  lines.push('This preflight starts no dialogue and makes no model call.', '');
  return `${lines.join('\n')}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const registrationText = fs.readFileSync(args.registration, 'utf8');
  const registration = JSON.parse(registrationText);
  const checks = [];

  assertion(
    checks,
    'registration-schema',
    registration.schema === 'machinespirits.tutor-stub.resistant-profile-discrimination-registration.v1',
    registration.schema,
  );
  assertion(
    checks,
    'no-live-authorization',
    registration.authorization.modelCallsAuthorized === false && registration.authorization.liveRunAuthorized === false,
    'registration authorizes neither model calls nor a live run',
  );
  assertion(
    checks,
    'historical-evidence-read-only',
    registration.preservation.historicalEvidenceMode === 'read_only_no_rejudge_no_pool_no_rewrite',
    registration.preservation.historicalEvidenceMode,
  );
  validateProtectedProfiles(registration, checks);
  validateNewProfileContracts(registration, checks);

  const traceDir = args.traceDir || registration.design.dryRunArtifactRoot;
  const qaArgs = buildQaArgs(registration, traceDir);
  const plan = JSON.parse(
    execFileSync(process.execPath, ['scripts/run-tutor-stub-qa-matrix.js', ...qaArgs, '--print-plan', '--json'], {
      cwd: ROOT,
      encoding: 'utf8',
      env: process.env,
    }),
  );
  validatePlan(registration, plan, checks);

  const liveRoot = '{separately-authorized-live-artifact-root}';
  const report = {
    schema: 'machinespirits.tutor-stub.resistant-profile-discrimination-preflight.v1',
    pass: true,
    registration: path.relative(ROOT, args.registration),
    registrationSha256: sha256(registrationText),
    authorization: registration.authorization,
    checks,
    plan,
    commands: {
      dryRun: ['node', 'scripts/run-tutor-stub-qa-matrix.js', ...qaArgs],
      analyze: [
        'node',
        'scripts/analyze-tutor-stub-profile-discrimination.js',
        '--trace-root',
        liveRoot,
        '--write-compacted',
        `${liveRoot}/compacted-traces`,
        '--target-average-cosine',
        String(registration.gates.pooled.averagePairwiseCosineMax),
        '--target-max-to-control',
        String(registration.gates.pooled.maxSimilarityToDiligent),
        '--control-profile',
        registration.design.controlProfile,
        '--gate-profiles',
        registration.design.newProfiles.join(','),
        '--require-pooled',
        '--required-traces',
        String(registration.gates.assembly.requiredDialogues),
        '--required-profiles',
        registration.design.profiles.join(','),
        '--required-runs-per-profile',
        String(registration.gates.assembly.requiredRunsPerProfile),
        '--required-turns',
        registration.design.turns,
        '--required-policies',
        registration.design.policies.join(','),
        '--required-tutor-model',
        registration.design.models.tutor,
        '--required-analysis-model',
        registration.design.models.analysis,
        '--required-learner-model',
        registration.design.models.learner,
        '--json',
        '--out',
        `${liveRoot}/profile-discrimination.json`,
      ],
    },
  };

  const output = args.json ? `${JSON.stringify(report, null, 2)}\n` : formatMarkdown(report);
  if (args.out) {
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, output);
  } else process.stdout.write(output);
}

try {
  main();
} catch (error) {
  console.error(`error: ${error.message}`);
  process.exit(1);
}
