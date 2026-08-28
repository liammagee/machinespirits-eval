#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { classifyCiChanges, fullCiClassification } from './ci-change-policy.js';
import {
  classifySurfaceAcceptance,
  packageManifestAtRef,
  pathTriggersSurfaceAcceptance,
} from './tutor-stub-surface-ci-policy.js';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_BASE = 'origin/main';
const DEFAULT_HEAD = 'HEAD';
const VALID_PROFILES = new Set(['auto', 'full', 'quick', 'node-tests']);
const VALID_SURFACE_MODES = new Set(['auto', 'always', 'never']);

const HELP = `Usage: npm run ci:local -- [options]

Profiles:
  --profile auto        Match hosted focused, validator-only, or full CI (default)
  --profile full        All local CI lanes
  --profile quick       Contract, lint, validation, and workplan lanes
  --profile node-tests  Root shards and tutor-core under the current Node

Selection:
  --lane <id[,id]>      Run only named lanes (repeatable)
  --skip <id[,id]>      Omit named lanes (repeatable)
  --surface <mode>      auto (default), always, or never
  --node24-container    Add isolated Node 24 root/core parity through Docker

Execution:
  --no-install          Reuse installed dependencies instead of npm ci
  --offline             Do not refresh managed refs before refs:check
  --keep-going          Run later lanes after a failure
  --base <ref>          Comparison base (default: origin/main)
  --head <ref>          Comparison head (default: HEAD)
  --pr-body-file <path> Also validate a saved PR body
  --report-dir <path>   Override the ignored report directory
  --dry-run             Print the resolved plan without executing it
  --list                List lane ids and exit
  --help                Show this help
`;

function splitValues(value) {
  return String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function valueAfter(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${option} requires a value`);
  return value;
}

export function parseLocalCiArgs(argv = []) {
  const options = {
    profile: 'auto',
    lanes: [],
    skip: [],
    install: true,
    offline: false,
    keepGoing: false,
    includeNode24: false,
    base: DEFAULT_BASE,
    head: DEFAULT_HEAD,
    prBodyFile: null,
    reportDir: null,
    surface: 'auto',
    dryRun: false,
    list: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const assign = (field, option) => {
      options[field] = valueAfter(argv, index, option);
      index += 1;
    };

    if (argument === '--profile') assign('profile', '--profile');
    else if (argument.startsWith('--profile=')) options.profile = argument.slice('--profile='.length);
    else if (argument === '--lane') {
      options.lanes.push(...splitValues(valueAfter(argv, index, '--lane')));
      index += 1;
    } else if (argument.startsWith('--lane=')) options.lanes.push(...splitValues(argument.slice('--lane='.length)));
    else if (argument === '--skip') {
      options.skip.push(...splitValues(valueAfter(argv, index, '--skip')));
      index += 1;
    } else if (argument.startsWith('--skip=')) options.skip.push(...splitValues(argument.slice('--skip='.length)));
    else if (argument === '--surface') assign('surface', '--surface');
    else if (argument.startsWith('--surface=')) options.surface = argument.slice('--surface='.length);
    else if (argument === '--base') assign('base', '--base');
    else if (argument.startsWith('--base=')) options.base = argument.slice('--base='.length);
    else if (argument === '--head') assign('head', '--head');
    else if (argument.startsWith('--head=')) options.head = argument.slice('--head='.length);
    else if (argument === '--pr-body-file') assign('prBodyFile', '--pr-body-file');
    else if (argument.startsWith('--pr-body-file=')) options.prBodyFile = argument.slice('--pr-body-file='.length);
    else if (argument === '--report-dir') assign('reportDir', '--report-dir');
    else if (argument.startsWith('--report-dir=')) options.reportDir = argument.slice('--report-dir='.length);
    else if (argument === '--no-install') options.install = false;
    else if (argument === '--offline') options.offline = true;
    else if (argument === '--keep-going') options.keepGoing = true;
    else if (argument === '--node24-container') options.includeNode24 = true;
    else if (argument === '--dry-run') options.dryRun = true;
    else if (argument === '--list') options.list = true;
    else if (argument === '--help' || argument === '-h') options.help = true;
    else throw new Error(`Unknown local CI option: ${argument}`);
  }

  if (!VALID_PROFILES.has(options.profile)) throw new Error(`Unknown local CI profile: ${options.profile}`);
  if (!VALID_SURFACE_MODES.has(options.surface)) throw new Error(`Unknown surface mode: ${options.surface}`);
  options.lanes = [...new Set(options.lanes)];
  options.skip = [...new Set(options.skip)];
  return options;
}

function npm(script, extra = [], overrides = {}) {
  return { program: process.platform === 'win32' ? 'npm.cmd' : 'npm', args: ['run', script, ...extra], ...overrides };
}

function lane(id, label, commands, profiles = ['full']) {
  return { id, label, commands, profiles };
}

export { pathTriggersSurfaceAcceptance };

export function resolveLocalCiProfile(options, changedFiles, { collectionOk = true, errors = [] } = {}) {
  const classification = collectionOk
    ? classifyCiChanges({ changedFiles })
    : fullCiClassification(`local changed-file collection failed: ${errors.join('; ') || 'unknown git error'}`);
  return {
    requestedProfile: options.profile,
    profile: options.profile === 'auto' ? classification.profile : options.profile,
    classification,
  };
}

export function classifyLocalSurfaceRequirement({
  surfaceMode,
  base,
  changedFileResult,
  projectRoot = PROJECT_ROOT,
  readBaseManifest = packageManifestAtRef,
  readHeadManifest = () => JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8')),
}) {
  if (surfaceMode === 'always') return { required: true, reason: 'surface validation explicitly required' };
  if (surfaceMode === 'never') return { required: false, reason: 'surface validation explicitly disabled' };
  if (!changedFileResult.ok) {
    return { required: true, reason: 'changed-file collection failed; surface impact is unknown' };
  }

  const changedFiles = changedFileResult.changedFiles;
  const packageChanged = changedFiles.includes('package.json');
  let baseManifest = null;
  let headManifest = null;
  if (packageChanged) {
    try {
      baseManifest = readBaseManifest(base, projectRoot);
      headManifest = readHeadManifest();
    } catch {
      return { required: true, reason: 'package comparison metadata is unavailable' };
    }
  }
  return classifySurfaceAcceptance({ changedFiles, baseManifest, headManifest });
}

function node24ContainerCommand(projectRoot) {
  const copyAndRun = [
    'set -eu',
    'mkdir -p /tmp/machinespirits-eval',
    'tar -C /source --exclude=.git --exclude=node_modules --exclude=.test-tmp --exclude=coverage -cf - . | tar -C /tmp/machinespirits-eval -xf -',
    'cd /tmp/machinespirits-eval',
    'npm ci',
    'node scripts/run-local-ci.js --profile node-tests --no-install --offline --report-dir /tmp/local-ci-node24',
  ].join(' && ');
  return {
    program: 'docker',
    args: [
      'run',
      '--rm',
      '--init',
      '--mount',
      `type=bind,src=${projectRoot},dst=/source,readonly`,
      'node:24-bookworm',
      'bash',
      '-lc',
      copyAndRun,
    ],
  };
}

export function localCiLaneCatalog(
  options,
  projectRoot = PROJECT_ROOT,
  { changedFiles = [], classification = null } = {},
) {
  const workplanCommands = [
    npm('wp:source-check'),
    npm('wp:test'),
    npm('wp:generated-pr-check', ['--', '--base', options.base, '--head', options.head]),
    npm('wp:commit-link', ['--', '--range', `${options.base}..${options.head}`]),
  ];
  if (options.prBodyFile) {
    workplanCommands.push(
      npm('wp:pr-link', [
        '--',
        '--body-file',
        path.resolve(projectRoot, options.prBodyFile),
        '--head-ref',
        options.head,
      ]),
    );
  }

  const refGovernanceCommands = [];
  if (!options.offline) {
    refGovernanceCommands.push({
      program: 'git',
      args: [
        'fetch',
        'origin',
        '+refs/heads/archive/*:refs/remotes/origin/archive/*',
        '+refs/tags/*:refs/tags/*',
        '--prune',
      ],
    });
  }
  refGovernanceCommands.push(npm('refs:check'));

  const lintCommands = [
    npm('lint'),
    npm('lint:tutor-core'),
    npm('lint:cycles'),
    npm('format:check'),
    npm('format:check:tutor-core'),
  ];

  const focusedValidationArgs = [
    'scripts/ci-change-policy.js',
    '--base',
    options.base,
    '--head',
    options.head,
    ...changedFiles.flatMap((file) => ['--changed-file', file]),
    '--validate-focused',
  ];
  const focusedCommands = [{ program: 'node', args: focusedValidationArgs }];
  if (classification?.authorizationRequired) {
    focusedCommands.push({
      program: 'node',
      args: ['--test', 'tests/tutorStubResistantProfileStudyGoRequest.test.js'],
    });
  }

  const validatorCommands = [{ program: 'node', args: focusedValidationArgs }];
  if (classification?.validatorTests.length) {
    validatorCommands.push({ program: 'node', args: ['--test', ...classification.validatorTests] });
  }
  if (classification?.validatorPaths.length) {
    validatorCommands.push(
      { program: './node_modules/.bin/eslint', args: classification.validatorPaths },
      { program: './node_modules/.bin/prettier', args: ['--check', ...classification.validatorPaths] },
    );
  }

  const validationProfiles = ['full', 'quick'];
  if (classification?.validationRequired && ['focused', 'validator-only'].includes(options.profile)) {
    validationProfiles.push(options.profile);
  }
  const refGovernanceRequired =
    options.requestedProfile === 'full' ||
    classification?.refGovernanceRequired === true ||
    (!classification && options.profile === 'full');
  const refGovernanceProfiles = refGovernanceRequired ? ['full', 'quick', 'focused', 'validator-only'] : [];

  return [
    lane(
      'install',
      'Fresh dependency install',
      [{ program: 'npm', args: ['ci'] }],
      ['full', 'focused', 'validator-only'],
    ),
    lane(
      'contract',
      'Hermetic test contract',
      [
        npm('test:manifest'),
        npm('skills:permissions:check'),
        {
          program: 'node',
          args: ['--test', 'tests/ciChangePolicy.test.js', 'tests/localCiRunner.test.js'],
        },
      ],
      ['full', 'quick', 'focused', 'validator-only'],
    ),
    lane('focused', 'Focused authored-metadata checks', focusedCommands, ['focused']),
    lane('validator-only', 'Focused validator checks', validatorCommands, ['validator-only']),
    lane('ref-governance', 'Managed ref governance', refGovernanceCommands, refGovernanceProfiles),
    lane('lint', 'Lint, cycle, and format checks', lintCommands, ['full', 'quick']),
    lane(
      'node-tests',
      `Root shards and tutor-core (Node ${process.versions.node})`,
      [
        npm('test:root', ['--', '--shard=1/2', '--quiet']),
        npm('test:root', ['--', '--shard=2/2', '--quiet']),
        npm('test:core', ['--', '--quiet']),
      ],
      ['full', 'node-tests'],
    ),
    lane('concurrency', 'PTY and application lifecycle lanes', [npm('test:pty:ci'), npm('test:lifecycle:ci')]),
    lane('coverage', 'Risk-based coverage floors', [npm('test:coverage:risk')]),
    lane(
      'validation',
      'Content and paper-claim validation',
      [npm('content:validate'), npm('paper:provable-discourse:smoke')],
      validationProfiles,
    ),
    lane('workplan', 'Workplan source, diff, and link checks', workplanCommands, [
      'full',
      'quick',
      'focused',
      'validator-only',
    ]),
    lane('surface', 'Browser tutor-surface acceptance', [npm('tutor:stub:acceptance:web')]),
    lane('node24', 'Isolated Node 24 root/core parity', [node24ContainerCommand(projectRoot)], []),
  ];
}

function gitOutput(args, projectRoot, { trim = true } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { cwd: projectRoot, encoding: 'utf8', shell: false });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.once('error', reject);
    // `exit` can precede the final stdout/stderr data; `close` waits for both pipes.
    child.once('close', (code) => {
      if (code === 0) resolve(trim ? stdout.trim() : stdout);
      else reject(new Error(`git ${args.join(' ')} failed: ${stderr.trim()}`));
    });
  });
}

export async function changedFilesForRange(base, head, projectRoot = PROJECT_ROOT) {
  const queries = [
    ['range', ['diff', '--no-renames', '--name-only', '-z', `${base}...${head}`]],
    ['unstaged', ['diff', '--no-renames', '--name-only', '-z']],
    ['staged', ['diff', '--cached', '--no-renames', '--name-only', '-z']],
    ['untracked', ['ls-files', '--others', '--exclude-standard', '-z']],
  ];
  const results = await Promise.allSettled(queries.map(([, args]) => gitOutput(args, projectRoot, { trim: false })));
  const changedFiles = new Set();
  const errors = [];
  for (let index = 0; index < results.length; index += 1) {
    const result = results[index];
    const [label] = queries[index];
    if (result.status === 'rejected') {
      errors.push(`${label}: ${result.reason.message}`);
      continue;
    }
    for (const file of result.value.split('\0').filter(Boolean)) changedFiles.add(file);
  }
  return { ok: errors.length === 0, changedFiles: [...changedFiles].sort(), errors };
}

export function buildLocalCiPlan(
  options,
  { projectRoot = PROJECT_ROOT, changedFiles = [], surfaceRequired = null, classification = null } = {},
) {
  if (options.profile === 'auto') {
    throw new Error('Local CI auto profile must be resolved before building the plan');
  }
  if (['focused', 'validator-only'].includes(options.profile) && classification?.profile !== options.profile) {
    throw new Error(`Local CI ${options.profile} plan requires a matching hosted classification`);
  }
  const catalog = localCiLaneCatalog(options, projectRoot, { changedFiles, classification });
  const known = new Set(catalog.map((entry) => entry.id));
  for (const id of [...options.lanes, ...options.skip]) {
    if (!known.has(id)) throw new Error(`Unknown local CI lane: ${id}`);
  }

  const selected = options.lanes.length
    ? new Set(options.lanes)
    : new Set(catalog.filter((entry) => entry.profiles.includes(options.profile)).map((entry) => entry.id));
  if (!options.install) selected.delete('install');
  if (options.includeNode24) selected.add('node24');

  const resolvedSurfaceRequired =
    options.surface === 'always' ||
    (options.surface === 'auto' &&
      (surfaceRequired ?? changedFiles.some((file) => pathTriggersSurfaceAcceptance(file))));
  const surfaceExplicit = options.lanes.includes('surface');
  selected.delete('surface');
  if (
    options.surface !== 'never' &&
    (surfaceExplicit || (!options.lanes.length && resolvedSurfaceRequired && options.profile === 'full'))
  ) {
    selected.add('surface');
  }

  for (const id of options.skip) selected.delete(id);
  return catalog.filter((entry) => selected.has(entry.id));
}

function quote(value) {
  return /^[A-Za-z0-9_./:=@+-]+$/u.test(value) ? value : JSON.stringify(value);
}

export function displayCommand(command) {
  const env = Object.entries(command.env || {})
    .map(([key, value]) => `${key}=${quote(String(value))}`)
    .join(' ');
  return [env, command.program, ...command.args.map(quote)].filter(Boolean).join(' ');
}

export function localCiEnvironment(projectRoot, commandEnv = {}) {
  return {
    ...process.env,
    CI: '1',
    npm_config_cache: path.join(os.tmpdir(), 'machinespirits-local-ci', path.basename(projectRoot), 'npm-cache'),
    ...commandEnv,
  };
}

function executeCommand(command, projectRoot) {
  return new Promise((resolve, reject) => {
    const child = spawn(command.program, command.args, {
      cwd: projectRoot,
      env: localCiEnvironment(projectRoot, command.env),
      stdio: 'inherit',
      shell: false,
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code: code ?? 1, signal: signal || null }));
  });
}

function timestampForPath(date) {
  return date.toISOString().replace(/[:.]/gu, '-');
}

export function renderLocalCiMarkdown(report) {
  const lines = [
    '# Local CI report',
    '',
    `- Status: **${report.status}**`,
    `- Source: \`${report.sourceSha}\``,
    `- Node: \`${report.node}\``,
    `- Profile: \`${report.profile}\``,
    `- Base/head: \`${report.base}\` ... \`${report.head}\``,
    `- Started: ${report.startedAt}`,
    `- Finished: ${report.finishedAt}`,
    '',
    '| Lane | Status | Seconds |',
    '|---|---:|---:|',
    ...report.lanes.map((entry) => `| ${entry.id} | ${entry.status} | ${(entry.durationMs / 1000).toFixed(1)} |`),
    '',
  ];
  for (const laneResult of report.lanes) {
    lines.push(`## ${laneResult.id}`, '');
    for (const command of laneResult.commands) {
      lines.push(`- \`${command.display}\` — ${command.status} (${(command.durationMs / 1000).toFixed(1)}s)`);
    }
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

function writeReport(reportDir, report) {
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(path.join(reportDir, 'summary.json'), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(reportDir, 'summary.md'), renderLocalCiMarkdown(report));
}

export async function executeLocalCiPlan(
  plan,
  options,
  { projectRoot = PROJECT_ROOT, execute = executeCommand, now = () => new Date(), sourceSha = 'unknown' } = {},
) {
  const started = now();
  const reportDir = options.reportDir
    ? path.resolve(projectRoot, options.reportDir)
    : path.join(projectRoot, '.test-tmp', 'local-ci', timestampForPath(started));
  const report = {
    schemaVersion: 1,
    status: 'running',
    profile: options.profile,
    base: options.base,
    head: options.head,
    sourceSha,
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
    startedAt: started.toISOString(),
    finishedAt: null,
    lanes: [],
  };

  for (const selectedLane of plan) {
    const laneStarted = now();
    const laneResult = { id: selectedLane.id, status: 'running', durationMs: 0, commands: [] };
    report.lanes.push(laneResult);
    console.log(`\n== local-ci:${selectedLane.id} — ${selectedLane.label}`);

    let commandFailed = false;
    for (const command of selectedLane.commands) {
      const commandStarted = now();
      const display = displayCommand(command);
      if (commandFailed && !command.always) {
        laneResult.commands.push({
          display,
          status: 'skipped',
          exitCode: null,
          signal: null,
          error: null,
          durationMs: 0,
        });
        continue;
      }
      console.log(`$ ${display}`);
      let result;
      try {
        result = await execute(command, projectRoot);
      } catch (error) {
        result = { code: 1, signal: null, error: error.message };
      }
      const commandFinished = now();
      const status = result.code === 0 ? 'passed' : 'failed';
      laneResult.commands.push({
        display,
        status,
        exitCode: result.code,
        signal: result.signal,
        error: result.error || null,
        durationMs: commandFinished.getTime() - commandStarted.getTime(),
      });
      if (result.code !== 0) {
        laneResult.status = 'failed';
        commandFailed = true;
      }
    }

    const laneFinished = now();
    laneResult.durationMs = laneFinished.getTime() - laneStarted.getTime();
    if (laneResult.status === 'running') laneResult.status = 'passed';
    if (laneResult.status === 'failed' && !options.keepGoing) break;
  }

  const finished = now();
  report.finishedAt = finished.toISOString();
  report.status = report.lanes.some((entry) => entry.status === 'failed') ? 'failed' : 'passed';
  writeReport(reportDir, report);
  console.log(`\nlocal-ci: ${report.status}; report ${path.relative(projectRoot, reportDir)}/summary.md`);
  return { report, reportDir };
}

function listLanes(options) {
  for (const entry of localCiLaneCatalog(options)) console.log(`${entry.id.padEnd(12)} ${entry.label}`);
}

async function main() {
  const options = parseLocalCiArgs(process.argv.slice(2));
  if (options.help) {
    console.log(HELP);
    return;
  }
  if (options.list) {
    listLanes(options);
    return;
  }

  const changedFileResult = await changedFilesForRange(options.base, options.head);
  const changedFiles = changedFileResult.changedFiles;
  const selection = resolveLocalCiProfile(options, changedFiles, {
    collectionOk: changedFileResult.ok,
    errors: changedFileResult.errors,
  });
  const resolvedOptions = { ...options, profile: selection.profile, requestedProfile: selection.requestedProfile };
  let surfaceRequired = false;
  if (options.surface === 'auto') {
    const classification = classifyLocalSurfaceRequirement({
      surfaceMode: options.surface,
      base: options.base,
      changedFileResult,
    });
    surfaceRequired = classification.required;
    console.log(`local-ci: surface=${classification.required ? 'required' : 'skipped'} (${classification.reason})`);
  }
  const plan = buildLocalCiPlan(resolvedOptions, {
    changedFiles,
    surfaceRequired,
    classification: selection.classification,
  });
  if (plan.length === 0) throw new Error('Local CI plan selected no lanes');

  if (resolvedOptions.profile === 'full' && Number(process.versions.node.split('.')[0]) !== 22) {
    throw new Error(`The full local CI profile must run under Node 22; current runtime is ${process.version}`);
  }

  console.log(
    `local-ci: profile=${selection.requestedProfile}->${selection.profile} (${selection.classification.reason}) base=${options.base} head=${options.head}`,
  );
  console.log(`local-ci: changed files=${changedFiles.length}; lanes=${plan.map((entry) => entry.id).join(',')}`);
  if (options.dryRun) {
    for (const selectedLane of plan) {
      console.log(`\n[${selectedLane.id}] ${selectedLane.label}`);
      for (const command of selectedLane.commands) console.log(`  ${displayCommand(command)}`);
    }
    return;
  }

  let sourceSha = 'unresolved';
  try {
    sourceSha = await gitOutput(['rev-parse', options.head], PROJECT_ROOT);
  } catch {
    // A full plan remains runnable and its range-dependent checks fail closed.
  }
  const { report } = await executeLocalCiPlan(plan, resolvedOptions, { sourceSha });
  if (report.status !== 'passed') process.exitCode = 1;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(`local-ci: ${error.message}`);
    process.exitCode = 1;
  });
}
