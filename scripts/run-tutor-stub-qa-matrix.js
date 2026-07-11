#!/usr/bin/env node
/**
 * Reproducible tutor-stub QA matrix.
 *
 * Runs the normal tutor-stub auto-eval report for each automated learner
 * profile, then builds a consolidated policy x learner robustness report.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  learnerProfileSuite,
  learnerProfileSuiteIds,
  learnerProfileSuiteNames,
  normalizeLearnerProfileSuiteId,
} from './tutor-stub-learner-profile-contracts.js';
import {
  normalizePolicyName,
  normalizePolicySuiteId,
  tutorStubPolicySuite,
  tutorStubPolicySuiteNames,
  tutorStubPolicySuitePolicies,
} from './tutor-stub-policy-suites.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const { values: args } = parseArgs({
  options: {
    suite: { type: 'string', default: 'core' },
    'profile-suite': { type: 'string', default: 'core' },
    profiles: { type: 'string', default: '' },
    policies: { type: 'string', default: '' },
    runs: { type: 'string', default: '1' },
    turns: { type: 'string', default: 'until-grounded' },
    'safety-turns': { type: 'string', default: '120' },
    model: { type: 'string', default: process.env.TUTOR_STUB_EVAL_MODEL || 'codex.gpt-5.5' },
    'analysis-model': { type: 'string', default: process.env.TUTOR_STUB_EVAL_ANALYSIS_MODEL || 'codex.gpt-5.5' },
    'auto-learner-model': {
      type: 'string',
      default:
        process.env.TUTOR_STUB_EVAL_AUTO_LEARNER_MODEL || process.env.TUTOR_STUB_AUTO_LEARNER_MODEL || 'codex.gpt-5.5',
    },
    world: { type: 'string', default: process.env.TUTOR_STUB_EVAL_WORLD || 'world_005_marrick' },
    'trace-dir': { type: 'string', default: '' },
    parallelism: { type: 'string', default: process.env.TUTOR_STUB_EVAL_PARALLELISM || '6' },
    'progress-interval': { type: 'string', default: process.env.TUTOR_STUB_EVAL_PROGRESS_INTERVAL || '30' },
    'register-palette': { type: 'string', default: 'all' },
    'cli-effort': { type: 'string', default: process.env.TUTOR_STUB_EVAL_CLI_EFFORT || 'low' },
    'max-tokens': { type: 'string', default: process.env.TUTOR_STUB_EVAL_MAX_TOKENS || '4096' },
    'history-turns': { type: 'string', default: process.env.TUTOR_STUB_EVAL_HISTORY_TURNS || '4' },
    'baseline-policy': { type: 'string', default: 'bland' },
    'first-message': { type: 'string', default: '' },
    'from-dir': { type: 'string', default: '' },
    'interleave-policies': { type: 'boolean', default: false },
    'pressure-turns': { type: 'string', default: '' },
    'print-plan': { type: 'boolean', default: false },
    json: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    'keep-going': { type: 'boolean', default: false },
    'no-analyze': { type: 'boolean', default: false },
    'no-html-report': { type: 'boolean', default: false },
    'no-ledger': { type: 'boolean', default: false },
    'no-dag': { type: 'boolean', default: false },
    'no-memory-summary': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

function usage() {
  console.log(`Usage:
  npm run tutor:stub:qa -- [options]

Options:
  --suite <controls|core|pressure|sentinel|headroom|adaptive|frontier|audit>
                         policy suite when --policies is omitted (default: core)
                         controls = bland/random/negative calibration
                         core = routine baseline + discrete adaptive comparison
                         pressure = field + negative screen for pressure-sensitive learners
                         sentinel = representative five-policy discrimination ladder
                         headroom = outcome contrast on discriminable stress profiles under a
                                    binding cap (defaults --profile-suite sentinel and
                                    --safety-turns 40 unless passed explicitly)
                         adaptive = adaptive-only sweep without controls
                         frontier = baseline + rich/continuous state policies
                         audit = expensive all-policy sweep ("focused", "full", and "all" aliases accepted)
  --profile-suite <core|sentinel|stress|audit>
                         learner profile suite when --profiles is omitted (default: core)
                         core = routine policy robustness
                         sentinel = cheap profile-discrimination screen
                         stress = targeted failure-mode probes
                         audit = expensive all-profile audit ("all" is accepted as an alias)
  --profiles <csv>       automated learner profiles
                         overrides --profile-suite
  --policies <csv>       explicit policies; overrides --suite
  --runs <n>             repetitions per policy and learner profile (default: 1)
  --turns <n|until-grounded>
  --safety-turns <n>     runaway guard for until-grounded (default: 120)
  --parallelism <n>      child dialogues per learner-profile auto-eval (default: 6)
  --trace-dir <path>     New QA artifact root; live plans are create-once
                         (default: .tutor-stub-auto-eval/qa-matrix-<timestamp>)
  --from-dir <path>      build only consolidated QA reports from existing summaries;
                         preserve any existing qa-plan.json
  --baseline-policy <p>  same-learner comparison baseline (default: bland)
  --dry-run              pass --dry-run to auto-eval children
  --print-plan           print the reproducible plan and exit
  --json                 JSON output for --print-plan
  --no-analyze           skip consolidated qa-matrix.md/json
  --keep-going           continue after a failed profile run
`);
}

function csv(value) {
  return String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function positiveInt(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function normalizeProfileName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/-/gu, '_');
}

function safeTimestampForFile(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function safeSlug(value) {
  return String(value || 'run')
    .replace(/[^a-z0-9._-]+/giu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 80);
}

function resolvePath(value) {
  return path.isAbsolute(value) ? value : path.join(ROOT, value);
}

function policyList() {
  if (args.policies) return csv(args.policies).map(normalizePolicyName);
  const suite = normalizePolicySuiteId(args.suite || 'core');
  const policies = tutorStubPolicySuitePolicies(suite);
  if (!policies) {
    throw new Error(
      `Unknown --suite ${args.suite}. Known: ${tutorStubPolicySuiteNames({ includeAliases: true }).join(', ')}`,
    );
  }
  return policies;
}

// The headroom suite exists to create outcome variance: discriminable stress
// profiles + a binding cap. Without both, its contrast collapses back to the
// all-policies-ground-at-the-floor ceiling, so resolve its companion defaults
// unless the caller explicitly overrode them on the command line.
function explicitCliFlag(name) {
  return process.argv.some((token) => token === `--${name}` || token.startsWith(`--${name}=`));
}

function resolveHeadroomDefaults() {
  if (args.policies || normalizePolicySuiteId(args.suite || 'core') !== 'headroom') return;
  if (!args.profiles && !explicitCliFlag('profile-suite')) args['profile-suite'] = 'sentinel';
  if (!explicitCliFlag('safety-turns')) args['safety-turns'] = '40';
}

function profileList() {
  if (!args.profiles) {
    const suite = normalizeLearnerProfileSuiteId(args['profile-suite'] || 'core');
    const profiles = learnerProfileSuiteIds(suite);
    if (!profiles) {
      throw new Error(
        `Unknown --profile-suite ${args['profile-suite']}. Known: ${learnerProfileSuiteNames({ includeAliases: true }).join(', ')}`,
      );
    }
    return profiles;
  }
  const profiles = csv(args.profiles).map(normalizeProfileName);
  if (!profiles.length) throw new Error('--profiles must include at least one learner profile');
  return profiles;
}

function qaRootDir() {
  if (args['from-dir']) return resolvePath(args['from-dir']);
  if (args['trace-dir']) return resolvePath(args['trace-dir']);
  return path.join(ROOT, '.tutor-stub-auto-eval', `qa-matrix-${safeTimestampForFile()}`);
}

function pushOptionalFlag(command, flag, value) {
  if (value !== undefined && value !== null && String(value) !== '') command.push(flag, String(value));
}

function autoEvalArgsForProfile({ profile, traceDir, policies }) {
  const command = [
    'scripts/run-tutor-stub-auto-eval.js',
    '--runs',
    String(positiveInt(args.runs, '--runs')),
    '--policies',
    policies.join(','),
    '--parallelism',
    String(positiveInt(args.parallelism, '--parallelism')),
    '--progress-interval',
    String(positiveInt(args['progress-interval'], '--progress-interval')),
    '--turns',
    args.turns,
    '--safety-turns',
    String(positiveInt(args['safety-turns'], '--safety-turns')),
    '--model',
    args.model,
    '--analysis-model',
    args['analysis-model'],
    '--auto-learner-model',
    args['auto-learner-model'],
    '--auto-learner-profile-id',
    profile,
    '--world',
    args.world,
    '--trace-dir',
    traceDir,
    '--register-palette',
    args['register-palette'],
    '--keep-going',
  ];
  pushOptionalFlag(command, '--cli-effort', args['cli-effort']);
  pushOptionalFlag(command, '--max-tokens', args['max-tokens']);
  pushOptionalFlag(command, '--history-turns', args['history-turns']);
  pushOptionalFlag(command, '--pressure-turns', args['pressure-turns']);
  if (args['interleave-policies']) command.push('--interleave-policies');
  pushOptionalFlag(command, '--first-message', args['first-message']);
  if (args['dry-run']) command.push('--dry-run');
  if (args['no-html-report']) command.push('--no-html-report');
  if (args['no-ledger']) command.push('--no-ledger');
  if (args['no-dag']) command.push('--no-dag');
  if (args['no-memory-summary']) command.push('--no-memory-summary');
  return command;
}

function buildPlanWarnings({ policySuite, profileSuite, profiles, policies, runs }) {
  const warnings = [];
  if (policySuite?.id === 'audit') {
    warnings.push(
      'audit runs every register policy, including controls and continuous policies; use it as an expensive periodic audit, not as the default policy comparison.',
    );
  }
  if (policySuite?.id === 'adaptive') {
    warnings.push(
      'adaptive omits bland/random/negative controls; use core, frontier, or audit when same-run baselines matter.',
    );
  }
  if (profileSuite?.id === 'audit') {
    warnings.push(
      'audit runs every core and stress profile; use it as an expensive periodic audit, not as the default policy comparison.',
    );
  }
  if (profiles.includes('affective_resistant') && !policies.includes('negative')) {
    warnings.push('affective_resistant separates best when the policy set includes a pressure arm such as negative.');
  }
  if (policySuite?.id === 'headroom') {
    if (profileSuite?.id === 'core') {
      warnings.push(
        'headroom on the core profiles runs against near-clone learners (discrimination gate fail); use the sentinel or stress profile suites.',
      );
    }
    if (args.turns === 'until-grounded' && positiveInt(args['safety-turns'], '--safety-turns') > 60) {
      warnings.push(
        'headroom needs a binding turn cap to create outcome variance; with --safety-turns above 60 every policy likely grounds at the ceiling again.',
      );
    }
  }
  const rowCount = profiles.length * policies.length * runs;
  if (rowCount >= 100) {
    warnings.push(
      `this plan expands to ${rowCount} dialogue rows; dry-run first and prefer sentinel/core unless the audit is intentional.`,
    );
  }
  return warnings;
}

function buildPlan({ rootDir = qaRootDir() } = {}) {
  const profiles = profileList();
  const policies = policyList();
  const policySuite = args.policies ? null : tutorStubPolicySuite(args.suite || 'core');
  const profileSuite = args.profiles ? null : learnerProfileSuite(args['profile-suite'] || 'core');
  const runs = positiveInt(args.runs, '--runs');
  const jobs = profiles.map((profile, index) => {
    const traceDir = path.join(rootDir, safeSlug(profile));
    return {
      ordinal: index + 1,
      profile,
      traceDir: path.relative(ROOT, traceDir),
      command: ['node', ...autoEvalArgsForProfile({ profile, traceDir, policies })],
    };
  });
  return {
    schema: 'machinespirits.tutor-stub.qa-matrix-plan.v1',
    generatedAt: new Date().toISOString(),
    suite: args.policies ? 'custom' : policySuite.id,
    policySuite: args.policies ? 'custom' : policySuite.id,
    policySuitePurpose: args.policies ? 'Explicit policy list supplied by --policies.' : policySuite.purpose,
    policySuiteCost: args.policies ? 'custom' : policySuite.cost,
    policySuiteAliases: args.policies ? [] : policySuite.aliases,
    profileSuite: args.profiles ? 'custom' : profileSuite.id,
    profileSuitePurpose: args.profiles ? 'Explicit profile list supplied by --profiles.' : profileSuite.purpose,
    profileSuiteCost: args.profiles ? 'custom' : profileSuite.cost,
    profileSuiteAliases: args.profiles ? [] : profileSuite.aliases,
    dryRun: Boolean(args['dry-run']),
    rootDir: path.relative(ROOT, rootDir),
    profiles,
    policies,
    baselinePolicy: normalizePolicyName(args['baseline-policy']) || 'bland',
    runs,
    turns: args.turns,
    safetyTurns: positiveInt(args['safety-turns'], '--safety-turns'),
    interleavePolicies: Boolean(args['interleave-policies']),
    pressureTurns: args['pressure-turns'] || null,
    parallelism: positiveInt(args.parallelism, '--parallelism'),
    model: args.model,
    analysisModel: args['analysis-model'],
    autoLearnerModel: args['auto-learner-model'],
    world: args.world,
    expectedDialogueRows: profiles.length * policies.length * runs,
    warnings: buildPlanWarnings({ policySuite, profileSuite, profiles, policies, runs }),
    outputs: {
      plan: path.relative(ROOT, path.join(rootDir, 'qa-plan.json')),
      markdown: path.relative(ROOT, path.join(rootDir, 'qa-matrix.md')),
      json: path.relative(ROOT, path.join(rootDir, 'qa-matrix.json')),
    },
    jobs,
  };
}

function renderPlanMarkdown(plan) {
  const lines = [
    '# Tutor Stub QA Matrix Plan',
    '',
    `Generated: ${plan.generatedAt}`,
    `Root: ${plan.rootDir}`,
    `Policy suite: ${plan.policySuite}`,
    `Policy suite purpose: ${plan.policySuitePurpose}`,
    `Profile suite: ${plan.profileSuite}`,
    `Profile suite purpose: ${plan.profileSuitePurpose}`,
    `Profiles: ${plan.profiles.join(', ')}`,
    `Policies: ${plan.policies.join(', ')}`,
    `Runs: ${plan.runs}`,
    `Expected dialogue rows: ${plan.expectedDialogueRows}`,
    `Dry run: ${plan.dryRun ? 'yes' : 'no'}`,
    '',
  ];
  if (plan.warnings.length) {
    lines.push('Warnings:', '');
    for (const warning of plan.warnings) lines.push(`- ${warning}`);
    lines.push('');
  }
  lines.push('| # | Profile | Trace Dir | Command |', '|---:|---|---|---|');
  for (const job of plan.jobs) {
    lines.push(`| ${job.ordinal} | ${job.profile} | ${job.traceDir} | \`${job.command.join(' ')}\` |`);
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function walkSummaryFiles(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  const files = [];
  const stack = [rootDir];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!['logs', 'traces'].includes(entry.name) && !entry.name.endsWith('-field-svg')) stack.push(entryPath);
      } else if (/^auto-eval-.*\.json$/u.test(entry.name)) {
        files.push(entryPath);
      }
    }
  }
  return files.sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs || a.localeCompare(b));
}

function runCommand(command, { label }) {
  console.log(`[qa-matrix] ${label}`);
  console.log(`[qa-matrix] ${command.map((part) => JSON.stringify(part)).join(' ')}`);
  const result = spawnSync(process.execPath, command.slice(1), {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.error) throw result.error;
  return result.status || 0;
}

function runAnalyzer({ rootDir, summaryFiles, json }) {
  const outPath = path.join(rootDir, json ? 'qa-matrix.json' : 'qa-matrix.md');
  const command = [
    'node',
    'scripts/analyze-tutor-stub-auto-evals.js',
    ...summaryFiles,
    '--qa',
    '--baseline-policy',
    normalizePolicyName(args['baseline-policy']) || 'bland',
    '--out',
    outPath,
  ];
  if (json) command.push('--json');
  if (args['dry-run']) command.push('--include-dry-run');
  const status = runCommand(command, { label: `build ${path.basename(outPath)}` });
  if (status !== 0) throw new Error(`Analyzer failed with status ${status}`);
  return outPath;
}

function writeFrozenPlan(planPath, plan) {
  try {
    fs.writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`, { flag: 'wx' });
  } catch (error) {
    if (error?.code === 'EEXIST') {
      throw new Error(
        `Refusing to overwrite frozen QA plan at ${planPath}; use a new --trace-dir for a live run or --from-dir to rebuild reports`,
      );
    }
    throw error;
  }
}

function main() {
  if (args.help) {
    usage();
    return;
  }
  resolveHeadroomDefaults();
  const rootDir = qaRootDir();
  const plan = buildPlan({ rootDir });
  if (args['print-plan']) {
    process.stdout.write(args.json ? `${JSON.stringify(plan, null, 2)}\n` : renderPlanMarkdown(plan));
    return;
  }

  fs.mkdirSync(rootDir, { recursive: true });
  const planPath = path.join(rootDir, 'qa-plan.json');
  if (args['from-dir']) {
    console.log(
      fs.existsSync(planPath)
        ? `[qa-matrix] report-only mode; preserved ${planPath}`
        : `[qa-matrix] report-only mode; no qa-plan.json written under ${rootDir}`,
    );
  } else {
    for (const warning of plan.warnings) {
      console.warn(`[qa-matrix] warning: ${warning}`);
    }
    writeFrozenPlan(planPath, plan);
    console.log(`[qa-matrix] wrote ${planPath}`);
    for (const job of plan.jobs) {
      const status = runCommand(job.command, { label: `profile ${job.profile} (${job.ordinal}/${plan.jobs.length})` });
      if (status !== 0 && !args['keep-going']) {
        throw new Error(`Profile ${job.profile} failed with status ${status}`);
      }
    }
  }

  const summaryFiles = walkSummaryFiles(rootDir);
  if (!summaryFiles.length) {
    throw new Error(`No auto-eval summaries found under ${path.relative(ROOT, rootDir)}`);
  }

  if (!args['no-analyze']) {
    const markdownPath = runAnalyzer({ rootDir, summaryFiles, json: false });
    const jsonPath = runAnalyzer({ rootDir, summaryFiles, json: true });
    console.log(`[qa-matrix] report ${markdownPath}`);
    console.log(`[qa-matrix] report ${jsonPath}`);
  }
}

try {
  main();
} catch (error) {
  console.error(`[qa-matrix] error: ${error.message}`);
  process.exit(1);
}
