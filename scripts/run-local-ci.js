#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_BASE = 'origin/main';
const DEFAULT_HEAD = 'HEAD';
const VALID_PROFILES = new Set(['full', 'quick', 'node-tests']);
const VALID_SURFACE_MODES = new Set(['auto', 'always', 'never']);
const SURFACE_PATHS = [
  '.github/workflows/tutor-stub-surface-acceptance.yml',
  'desktop/',
  'electron-builder.yml',
  'fixtures/tutor-stub-surface-acceptance/',
  'package.json',
  'package-lock.json',
  'public/tutor/',
  'routes/tutorStubSessionRoutes.js',
  'scripts/run-tutor-stub-surface-acceptance.mjs',
  'scripts/tutor-stub-acceptance-server.mjs',
  'scripts/tutor-stub.js',
  'services/cliProviderBridge.js',
  'services/evalSurfaces.js',
  'services/tutorStubProcessSessionFactory.js',
  'services/tutorStubSessionHost.js',
  'services/tutorStubSurfaceAcceptanceContract.js',
];

const HELP = `Usage: npm run ci:local -- [options]

Profiles:
  --profile full        All local CI lanes (default)
  --profile quick       Contract, lint, validation, and workplan lanes
  --profile node-tests  Root shards and tutor-core under the current Node

Selection:
  --lane <id[,id]>      Run only named lanes (repeatable)
  --skip <id[,id]>      Omit named lanes (repeatable)
  --surface <mode>      auto (default), always, or never
  --node20-container    Add isolated Node 20 root/core parity through Docker

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
    profile: 'full',
    lanes: [],
    skip: [],
    install: true,
    offline: false,
    keepGoing: false,
    includeNode20: false,
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
    else if (argument === '--node20-container') options.includeNode20 = true;
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

export function pathTriggersSurfaceAcceptance(file) {
  return SURFACE_PATHS.some((candidate) => (candidate.endsWith('/') ? file.startsWith(candidate) : file === candidate));
}

function node20ContainerCommand(projectRoot) {
  const copyAndRun = [
    'set -eu',
    'mkdir -p /tmp/machinespirits-eval',
    'tar -C /source --exclude=.git --exclude=node_modules --exclude=desktop/node_modules --exclude=.test-tmp --exclude=coverage -cf - . | tar -C /tmp/machinespirits-eval -xf -',
    'cd /tmp/machinespirits-eval',
    'npm ci',
    'node scripts/run-local-ci.js --profile node-tests --no-install --offline --report-dir /tmp/local-ci-node20',
  ].join(' && ');
  return {
    program: 'docker',
    args: [
      'run',
      '--rm',
      '--init',
      '--mount',
      `type=bind,src=${projectRoot},dst=/source,readonly`,
      'node:20-bookworm',
      'bash',
      '-lc',
      copyAndRun,
    ],
  };
}

export function localCiLaneCatalog(options, projectRoot = PROJECT_ROOT) {
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

  const lintCommands = [];
  if (!options.offline) {
    lintCommands.push({
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
  lintCommands.push(npm('refs:check'), npm('lint'), npm('lint:cycles'), npm('format:check'));

  return [
    lane('install', 'Fresh dependency install', [{ program: 'npm', args: ['ci'] }]),
    lane(
      'contract',
      'Hermetic test contract',
      [npm('test:manifest'), npm('skills:permissions:check')],
      ['full', 'quick'],
    ),
    lane('lint', 'Ref, lint, cycle, and format checks', lintCommands, ['full', 'quick']),
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
      ['full', 'quick'],
    ),
    lane('workplan', 'Workplan source, diff, and link checks', workplanCommands, ['full', 'quick']),
    lane('surface', 'Shared web and packaged Electron acceptance', [
      npm('desktop:install'),
      npm('native:rebuild:node'),
      npm('tutor:stub:acceptance:web'),
      npm('desktop:rebuild'),
      npm('desktop:pack'),
      npm('tutor:stub:acceptance:packaged'),
      npm('native:rebuild:node', [], { always: true }),
    ]),
    lane('node20', 'Isolated Node 20 root/core parity', [node20ContainerCommand(projectRoot)], []),
  ];
}

function gitOutput(args, projectRoot) {
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
    child.once('exit', (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`git ${args.join(' ')} failed: ${stderr.trim()}`));
    });
  });
}

export async function changedFilesForRange(base, head, projectRoot = PROJECT_ROOT) {
  const outputs = await Promise.all([
    gitOutput(['diff', '--name-only', `${base}...${head}`], projectRoot),
    gitOutput(['diff', '--name-only'], projectRoot),
    gitOutput(['diff', '--cached', '--name-only'], projectRoot),
    gitOutput(['ls-files', '--others', '--exclude-standard'], projectRoot),
  ]);
  return [
    ...new Set(
      outputs
        .flatMap((output) => output.split('\n'))
        .map((file) => file.trim())
        .filter(Boolean),
    ),
  ].sort();
}

export function buildLocalCiPlan(options, { projectRoot = PROJECT_ROOT, changedFiles = [] } = {}) {
  const catalog = localCiLaneCatalog(options, projectRoot);
  const known = new Set(catalog.map((entry) => entry.id));
  for (const id of [...options.lanes, ...options.skip]) {
    if (!known.has(id)) throw new Error(`Unknown local CI lane: ${id}`);
  }

  const selected = options.lanes.length
    ? new Set(options.lanes)
    : new Set(catalog.filter((entry) => entry.profiles.includes(options.profile)).map((entry) => entry.id));
  if (!options.install) selected.delete('install');
  if (options.includeNode20) selected.add('node20');

  const surfaceRequired =
    options.surface === 'always' ||
    (options.surface === 'auto' && changedFiles.some((file) => pathTriggersSurfaceAcceptance(file)));
  const surfaceExplicit = options.lanes.includes('surface');
  selected.delete('surface');
  if (
    options.surface !== 'never' &&
    (surfaceExplicit || (!options.lanes.length && surfaceRequired && options.profile === 'full'))
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

  const changedFiles = await changedFilesForRange(options.base, options.head);
  const plan = buildLocalCiPlan(options, { changedFiles });
  if (plan.length === 0) throw new Error('Local CI plan selected no lanes');

  if (options.profile === 'full' && Number(process.versions.node.split('.')[0]) !== 22) {
    throw new Error(`The full local CI profile must run under Node 22; current runtime is ${process.version}`);
  }

  console.log(`local-ci: profile=${options.profile} base=${options.base} head=${options.head}`);
  console.log(`local-ci: changed files=${changedFiles.length}; lanes=${plan.map((entry) => entry.id).join(',')}`);
  if (options.dryRun) {
    for (const selectedLane of plan) {
      console.log(`\n[${selectedLane.id}] ${selectedLane.label}`);
      for (const command of selectedLane.commands) console.log(`  ${displayCommand(command)}`);
    }
    return;
  }

  const sourceSha = await gitOutput(['rev-parse', options.head], PROJECT_ROOT);
  const { report } = await executeLocalCiPlan(plan, options, { sourceSha });
  if (report.status !== 'passed') process.exitCode = 1;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(`local-ci: ${error.message}`);
    process.exitCode = 1;
  });
}
