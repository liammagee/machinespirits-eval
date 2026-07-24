#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { createIsolatedPaths } from './run-hermetic-tests.js';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_CONFIG_PATH = path.join(PROJECT_ROOT, 'config', 'coverage-risk-floors.json');
const DEFAULT_OUTPUT_DIR = path.join(PROJECT_ROOT, 'coverage', 'risk');
const METRICS = ['lines', 'branches', 'functions'];

function percentage(covered, found) {
  return found === 0 ? 100 : Number(((covered / found) * 100).toFixed(2));
}

function normalizeSourcePath(source, projectRoot = PROJECT_ROOT) {
  const decoded = source.startsWith('file:') ? fileURLToPath(source) : source;
  return path.relative(projectRoot, path.resolve(projectRoot, decoded)).split(path.sep).join('/');
}

export function parseLcov(content, projectRoot = PROJECT_ROOT) {
  const records = new Map();
  let current = null;

  const finish = () => {
    if (!current) return;
    const source = normalizeSourcePath(current.source, projectRoot);
    records.set(source, {
      source,
      lines: { found: current.LF, covered: current.LH },
      branches: { found: current.BRF, covered: current.BRH },
      functions: { found: current.FNF, covered: current.FNH },
    });
    current = null;
  };

  for (const line of String(content).split(/\r?\n/u)) {
    if (line.startsWith('SF:')) {
      finish();
      current = { source: line.slice(3), LF: 0, LH: 0, BRF: 0, BRH: 0, FNF: 0, FNH: 0 };
      continue;
    }
    if (line === 'end_of_record') {
      finish();
      continue;
    }
    if (!current) continue;
    const match = line.match(/^(LF|LH|BRF|BRH|FNF|FNH):(\d+)$/u);
    if (match) current[match[1]] = Number(match[2]);
  }
  finish();
  return records;
}

export function summarizeGroupCoverage(group, records) {
  const missingSources = group.sources.filter((source) => !records.has(source));
  const totals = Object.fromEntries(METRICS.map((metric) => [metric, { found: 0, covered: 0, pct: 0 }]));

  for (const source of group.sources) {
    const record = records.get(source);
    if (!record) continue;
    for (const metric of METRICS) {
      totals[metric].found += record[metric].found;
      totals[metric].covered += record[metric].covered;
    }
  }
  for (const metric of METRICS) {
    totals[metric].pct = percentage(totals[metric].covered, totals[metric].found);
  }

  const failures = [];
  for (const source of missingSources) failures.push(`missing source: ${source}`);
  for (const metric of METRICS) {
    if (totals[metric].pct < group.floors[metric]) {
      failures.push(`${metric} ${totals[metric].pct}% is below ${group.floors[metric]}%`);
    }
  }

  return {
    id: group.id,
    label: group.label,
    runner: group.runner,
    sources: group.sources,
    floors: group.floors,
    coverage: totals,
    missingSources,
    passed: failures.length === 0,
    failures,
  };
}

export function buildNodeCoverageArgs(group, lcovPath) {
  return [
    '--test',
    '--test-concurrency=1',
    '--experimental-test-coverage',
    ...group.sources.map((source) => `--test-coverage-include=${source}`),
    '--test-reporter=spec',
    '--test-reporter-destination=stdout',
    '--test-reporter=lcov',
    `--test-reporter-destination=${lcovPath}`,
    ...group.tests,
  ];
}

export function buildVitestCoverageArgs(group, reportsDirectory, projectRoot = PROJECT_ROOT) {
  return [
    path.join(projectRoot, 'node_modules', 'vitest', 'vitest.mjs'),
    'run',
    ...group.tests,
    '--coverage.enabled=true',
    '--coverage.provider=v8',
    '--coverage.reporter=text-summary',
    '--coverage.reporter=lcov',
    `--coverage.reportsDirectory=${reportsDirectory}`,
    ...group.sources.map((source) => `--coverage.include=${source}`),
  ];
}

export function parseCoverageArgs(argv = []) {
  const selectedGroups = [];
  let outputDir = DEFAULT_OUTPUT_DIR;
  let configPath = DEFAULT_CONFIG_PATH;
  const nextValue = (option, index) => {
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${option} requires a value`);
    return value;
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--group') {
      selectedGroups.push(nextValue('--group', index));
      index += 1;
    } else if (argument.startsWith('--group=')) {
      selectedGroups.push(argument.slice('--group='.length));
    } else if (argument === '--out') {
      outputDir = path.resolve(nextValue('--out', index));
      index += 1;
    } else if (argument.startsWith('--out=')) {
      outputDir = path.resolve(argument.slice('--out='.length));
    } else if (argument === '--config') {
      configPath = path.resolve(nextValue('--config', index));
      index += 1;
    } else if (argument.startsWith('--config=')) {
      configPath = path.resolve(argument.slice('--config='.length));
    } else {
      throw new Error(`Unknown coverage argument: ${argument}`);
    }
  }
  return { selectedGroups, outputDir, configPath };
}

function versionAtLeast(actual, required) {
  const left = actual.replace(/^v/u, '').split('.').map(Number);
  const right = required.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    if ((left[index] || 0) > (right[index] || 0)) return true;
    if ((left[index] || 0) < (right[index] || 0)) return false;
  }
  return true;
}

function loadConfiguration(configPath) {
  const raw = fs.readFileSync(configPath, 'utf8');
  const config = JSON.parse(raw);
  if (config.schema_version !== 1 || !Array.isArray(config.groups) || config.groups.length === 0) {
    throw new Error(`Invalid risk coverage configuration: ${configPath}`);
  }
  const groupIds = new Set();
  for (const group of config.groups) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(group.id || '') || !['node', 'vitest'].includes(group.runner)) {
      throw new Error(`Invalid coverage group: ${group.id}`);
    }
    if (groupIds.has(group.id)) throw new Error(`Duplicate coverage group: ${group.id}`);
    groupIds.add(group.id);
    if (!group.sources?.length || !group.tests?.length)
      throw new Error(`Coverage group ${group.id} has no sources or tests`);
    for (const metric of METRICS) {
      if (!Number.isFinite(group.floors?.[metric]))
        throw new Error(`Coverage group ${group.id} has no ${metric} floor`);
    }
  }
  return { config, raw };
}

function runChild(args, env, projectRoot = PROJECT_ROOT) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: projectRoot,
      env,
      stdio: 'inherit',
      shell: false,
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (signal) reject(new Error(`coverage child terminated by ${signal}`));
      else resolve(code ?? 1);
    });
  });
}

async function runGroup(group, outputDir, projectRoot = PROJECT_ROOT) {
  const groupOutputDir = path.join(outputDir, group.id);
  fs.mkdirSync(groupOutputDir, { recursive: true });
  const hermeticRoot = fs.mkdtempSync(path.join(os.tmpdir(), `machinespirits-coverage-${group.id}-`));
  const env = {
    ...process.env,
    ...createIsolatedPaths(hermeticRoot),
    MACHINESPIRITS_HERMETIC_TEST_ROOT: hermeticRoot,
    VITEST_SKIP_INSTALL_CHECKS: '1',
  };
  const lcovPath = path.join(groupOutputDir, 'lcov.info');

  console.log(`\n[coverage:risk] ${group.label} (${group.runner})`);
  try {
    const args =
      group.runner === 'node'
        ? buildNodeCoverageArgs(group, lcovPath)
        : buildVitestCoverageArgs(group, groupOutputDir, projectRoot);
    const code = await runChild(args, env, projectRoot);
    if (code !== 0) throw new Error(`Coverage tests for ${group.id} exited with code ${code}`);
    if (!fs.existsSync(lcovPath)) throw new Error(`Coverage runner did not produce ${lcovPath}`);

    const records = parseLcov(fs.readFileSync(lcovPath, 'utf8'), projectRoot);
    const summary = summarizeGroupCoverage(group, records);
    fs.writeFileSync(path.join(groupOutputDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
    return summary;
  } finally {
    fs.rmSync(hermeticRoot, { recursive: true, force: true });
  }
}

export function renderCoverageMarkdown(report) {
  const lines = [
    '# Risk coverage report',
    '',
    `- Generated: ${report.generated_at}`,
    `- Configuration SHA-256: \`${report.config_sha256}\``,
    `- Result: **${report.passed ? 'PASS' : 'FAIL'}**`,
    '',
    '| Risk group | Lines | Branches | Functions | Result |',
    '|---|---:|---:|---:|:---:|',
  ];
  for (const group of report.groups) {
    const value = (metric) => `${group.coverage[metric].pct}% / ${group.floors[metric]}%`;
    lines.push(
      `| ${group.label} | ${value('lines')} | ${value('branches')} | ${value('functions')} | ${group.passed ? 'PASS' : 'FAIL'} |`,
    );
  }
  const failures = report.groups.flatMap((group) => group.failures.map((failure) => `- **${group.id}:** ${failure}`));
  if (failures.length) lines.push('', '## Failures', '', ...failures);
  return `${lines.join('\n')}\n`;
}

export async function runRiskCoverage(argv = process.argv.slice(2), projectRoot = PROJECT_ROOT) {
  const options = parseCoverageArgs(argv);
  const { config, raw } = loadConfiguration(options.configPath);
  if (!versionAtLeast(process.version, config.minimum_node_version)) {
    throw new Error(`Risk coverage needs Node >=${config.minimum_node_version}; found ${process.version}`);
  }

  const knownIds = new Set(config.groups.map((group) => group.id));
  for (const id of options.selectedGroups) {
    if (!knownIds.has(id)) throw new Error(`Unknown risk coverage group: ${id}`);
  }
  const groups = options.selectedGroups.length
    ? config.groups.filter((group) => options.selectedGroups.includes(group.id))
    : config.groups;

  fs.mkdirSync(options.outputDir, { recursive: true });
  const summaries = [];
  for (const group of groups) summaries.push(await runGroup(group, options.outputDir, projectRoot));

  const report = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    config_sha256: createHash('sha256').update(raw).digest('hex'),
    node_version: process.version,
    passed: summaries.every((summary) => summary.passed),
    groups: summaries,
  };
  fs.writeFileSync(path.join(options.outputDir, 'summary.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  const markdown = renderCoverageMarkdown(report);
  fs.writeFileSync(path.join(options.outputDir, 'summary.md'), markdown, 'utf8');
  console.log(`\n${markdown}`);
  return report.passed ? 0 : 1;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  runRiskCoverage()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(`[coverage:risk] ${error.message}`);
      process.exitCode = 1;
    });
}
