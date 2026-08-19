#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { findLinkedId, loadKnownItems } from './lib/workplanLink.js';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VALID_CI_MODES = new Set(['auto', 'quick', 'full']);
const HOSTED_WORKFLOWS = new Set([
  'CI',
  'Validation Framework',
  'Workplan validation',
  'Tutor-stub surface acceptance',
]);
const EVIDENCE_START = '<!-- local-ci-pr-create:start -->';
const EVIDENCE_END = '<!-- local-ci-pr-create:end -->';

const HELP = `Usage: npm run pr:create -- --title <title> --workplan <id|N/A> [options]

Required:
  --title <title>          Pull-request title
  --workplan <id|N/A>     Workplan item named by the final PR body

Body:
  --body-file <path>      Use an existing body (copied before annotation)
  --ref-impact <value>    Ref/version classification for a generated body (default: N/A)

Admission:
  --ci <mode>             auto (default), quick, or full
  --wait-seconds <n>      Hosted-check attachment window in auto mode (default: 60)
  --poll-seconds <n>      Hosted-check polling interval (default: 5)
  --offline               Suppress managed-ref fetches inside local CI
  --no-install            Reuse root dependencies if a full gate is required

PR:
  --base <branch>         GitHub base branch (default: main)
  --draft                 Preserve the created PR as a draft
  --dry-run               Validate state/body and print the resolved plan only
  --help                  Show this help
`;

function valueAfter(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${option} requires a value`);
  return value;
}

function nonNegativeNumber(value, option, { positive = false } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || (positive && number === 0)) {
    throw new Error(`${option} must be ${positive ? 'a positive' : 'a non-negative'} number`);
  }
  return number;
}

export function parsePrCreateArgs(argv = []) {
  const options = {
    title: null,
    workplan: null,
    bodyFile: null,
    refImpact: 'N/A',
    ci: 'auto',
    base: 'main',
    waitSeconds: 60,
    pollSeconds: 5,
    offline: false,
    noInstall: false,
    draft: false,
    dryRun: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const assign = (field, option) => {
      options[field] = valueAfter(argv, index, option);
      index += 1;
    };
    if (argument === '--title') assign('title', '--title');
    else if (argument.startsWith('--title=')) options.title = argument.slice('--title='.length);
    else if (argument === '--workplan') assign('workplan', '--workplan');
    else if (argument.startsWith('--workplan=')) options.workplan = argument.slice('--workplan='.length);
    else if (argument === '--body-file') assign('bodyFile', '--body-file');
    else if (argument.startsWith('--body-file=')) options.bodyFile = argument.slice('--body-file='.length);
    else if (argument === '--ref-impact') assign('refImpact', '--ref-impact');
    else if (argument.startsWith('--ref-impact=')) options.refImpact = argument.slice('--ref-impact='.length);
    else if (argument === '--ci') assign('ci', '--ci');
    else if (argument.startsWith('--ci=')) options.ci = argument.slice('--ci='.length);
    else if (argument === '--base') assign('base', '--base');
    else if (argument.startsWith('--base=')) options.base = argument.slice('--base='.length);
    else if (argument === '--wait-seconds') assign('waitSeconds', '--wait-seconds');
    else if (argument.startsWith('--wait-seconds=')) options.waitSeconds = argument.slice('--wait-seconds='.length);
    else if (argument === '--poll-seconds') assign('pollSeconds', '--poll-seconds');
    else if (argument.startsWith('--poll-seconds=')) options.pollSeconds = argument.slice('--poll-seconds='.length);
    else if (argument === '--offline') options.offline = true;
    else if (argument === '--no-install') options.noInstall = true;
    else if (argument === '--draft') options.draft = true;
    else if (argument === '--dry-run') options.dryRun = true;
    else if (argument === '--help' || argument === '-h') options.help = true;
    else throw new Error(`Unknown PR creation option: ${argument}`);
  }

  if (options.help) return options;
  options.title = String(options.title || '').trim();
  options.workplan = String(options.workplan || '').trim();
  options.base = String(options.base || '').trim();
  options.refImpact = String(options.refImpact || '').trim();
  if (!options.title) throw new Error('--title is required');
  if (!options.workplan) throw new Error('--workplan is required');
  if (!options.base) throw new Error('--base cannot be empty');
  if (!options.refImpact) throw new Error('--ref-impact cannot be empty');
  if (!VALID_CI_MODES.has(options.ci)) throw new Error(`Unknown PR CI mode: ${options.ci}`);
  options.waitSeconds = nonNegativeNumber(options.waitSeconds, '--wait-seconds');
  options.pollSeconds = nonNegativeNumber(options.pollSeconds, '--poll-seconds', { positive: true });
  return options;
}

export function buildDefaultPrBody({ title, workplan, refImpact = 'N/A' }) {
  return `## Summary

- ${title}

Workplan item: ${workplan}

Ref impact: ${refImpact}

CI boundary impact: pending

## Verification

- Local PR admission gate: pending

Tutor PR benchmark: pending
`;
}

function normalizeWorkplan(value) {
  return /^(?:n\/?a|none|not applicable)$/iu.test(value) ? 'N/A' : value;
}

export function validatePrBodyWorkplan(body, expectedWorkplan, knownItems = loadKnownItems()) {
  const expected = normalizeWorkplan(expectedWorkplan);
  const result = findLinkedId(body, new Set(knownItems.keys()));
  if (!result.ok)
    throw new Error(`PR body does not name a valid workplan item (${result.values.join(' | ') || 'none found'})`);
  if (expected === 'N/A' && result.kind !== 'na')
    throw new Error(`PR body names ${result.id}; expected Workplan item: N/A`);
  if (expected !== 'N/A' && (result.kind !== 'id' || result.id !== expected)) {
    throw new Error(`PR body names ${result.kind === 'id' ? result.id : 'N/A'}; expected ${expected}`);
  }
  return result;
}

export function hasHostedCiChecks(checks = []) {
  return checks.some((check) => {
    if (HOSTED_WORKFLOWS.has(String(check.workflowName || ''))) return true;
    const label = String(check.name || check.context || '');
    return /^(?:Node (?:20|22) shard [12]\/2|Lint, cycles, and format|Risk-based coverage|Workplan validation|Validation Framework|Browser tutor surface)/u.test(
      label,
    );
  });
}

function replaceEvidenceBlock(body, block) {
  const expression = new RegExp(`${EVIDENCE_START}[\\s\\S]*?${EVIDENCE_END}\\n?`, 'u');
  const withoutExisting = body.replace(expression, '').trimEnd();
  return `${withoutExisting}\n\n${block}\n`;
}

export function appendLocalCiEvidence(body, { reportPath, sourceSha, reason }) {
  const block = `${EVIDENCE_START}
## Full local CI evidence

- Full local CI: **PASS**
- Source SHA: \`${sourceSha}\`
- Local report: \`${reportPath}\`
- ${reason || 'GitHub hosted checks did not attach during the bounded wait; the PR remained draft until this fallback passed.'}
${EVIDENCE_END}`;
  return replaceEvidenceBlock(body, block);
}

function markQuickAdmissionPassed(body, sourceSha) {
  const passed = `- Local PR admission gate: **PASS** (quick profile, source \`${sourceSha}\`)`;
  return body
    .replace('- [ ] Local PR admission gate passed', passed)
    .replace('- Local PR admission gate: pending', passed);
}

export function assertLocalCiReport(report, { sourceSha, profile }) {
  if (!report || report.status !== 'passed') throw new Error(`${profile} local CI did not produce a passing report`);
  if (report.sourceSha !== sourceSha) {
    throw new Error(`${profile} local CI report is for ${report.sourceSha || 'unknown'}, expected ${sourceSha}`);
  }
  if (profile && report.profile !== profile) {
    throw new Error(`local CI report profile is ${report.profile || 'unknown'}, expected ${profile}`);
  }
  return report;
}

function runProcess(program, args, { cwd = PROJECT_ROOT, stream = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, {
      cwd,
      env: { ...process.env, CI: '1' },
      shell: false,
      stdio: stream ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    if (!stream) {
      child.stdout.on('data', (chunk) => {
        stdout += chunk;
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk;
      });
    }
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code: code ?? 1, signal: signal || null, stdout, stderr }));
  });
}

function successfulOutput(result, label) {
  if (result.code !== 0) {
    const detail = String(result.stderr || result.stdout || '').trim();
    throw new Error(`${label} failed${detail ? `: ${detail}` : ''}`);
  }
  return String(result.stdout || '').trim();
}

function defaultDependencies(projectRoot = PROJECT_ROOT) {
  return {
    projectRoot,
    now: () => Date.now(),
    sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    git: (args, options = {}) => runProcess('git', args, { cwd: projectRoot, stream: options.stream }),
    gh: (args, options = {}) => runProcess('gh', args, { cwd: projectRoot, stream: options.stream }),
    async localCi({ profile, bodyPath, reportDir, offline, noInstall }) {
      const args = ['scripts/run-local-ci.js'];
      if (profile === 'quick') args.push('--profile', 'quick', '--no-install');
      else if (noInstall) args.push('--no-install');
      if (offline) args.push('--offline');
      args.push('--pr-body-file', bodyPath, '--report-dir', reportDir);
      const result = await runProcess(process.execPath, args, { cwd: projectRoot, stream: true });
      successfulOutput(result, `${profile} local CI`);
      return JSON.parse(fs.readFileSync(path.join(reportDir, 'summary.json'), 'utf8'));
    },
  };
}

function parseJson(output, label) {
  try {
    return JSON.parse(output);
  } catch (error) {
    throw new Error(`${label} returned invalid JSON: ${error.message}`);
  }
}

function pullRequestUrl(output) {
  const match = String(output).match(/https:\/\/github\.com\/[^\s]+\/pull\/\d+/u);
  if (!match) throw new Error('gh pr create did not return a pull-request URL');
  return match[0];
}

function remoteHeadSha(output, branch) {
  const line = String(output)
    .split(/\r?\n/u)
    .find((entry) => entry.trim().endsWith(`refs/heads/${branch}`));
  return line ? line.trim().split(/\s+/u)[0] : null;
}

async function gitText(deps, args, label) {
  return successfulOutput(await deps.git(args), label || `git ${args.join(' ')}`);
}

async function ghText(deps, args, label) {
  return successfulOutput(await deps.gh(args), label || `gh ${args.join(' ')}`);
}

function reportLocation(projectRoot, reportDir) {
  return path.relative(projectRoot, path.join(reportDir, 'summary.md')).split(path.sep).join('/');
}

async function runGate(deps, { profile, bodyPath, reportDir, headSha, options }) {
  const report = await deps.localCi({
    profile,
    bodyPath,
    reportDir,
    offline: options.offline,
    noInstall: options.noInstall,
  });
  return assertLocalCiReport(report, { sourceSha: headSha, profile });
}

async function assertStableHead(deps, expectedSha) {
  const currentSha = await gitText(deps, ['rev-parse', 'HEAD'], 'recheck HEAD');
  if (currentSha !== expectedSha)
    throw new Error(`HEAD changed during local admission: ${currentSha}, expected ${expectedSha}`);
  const dirty = await gitText(deps, ['status', '--porcelain=v1', '--untracked-files=all'], 'recheck worktree');
  if (dirty) throw new Error(`worktree changed during local admission:\n${dirty}`);
}

async function readPrView(deps, prUrl, headSha) {
  const output = await ghText(
    deps,
    ['pr', 'view', prUrl, '--json', 'number,url,isDraft,headRefOid,statusCheckRollup,state'],
    'read pull request',
  );
  const view = parseJson(output, 'gh pr view');
  if (view.headRefOid !== headSha) {
    throw new Error(`PR head is ${view.headRefOid || 'unknown'}, expected ${headSha}`);
  }
  return view;
}

async function waitForHostedChecks(deps, { prUrl, headSha, waitSeconds, pollSeconds }) {
  const deadline = deps.now() + waitSeconds * 1000;
  while (true) {
    const view = await readPrView(deps, prUrl, headSha);
    if (hasHostedCiChecks(view.statusCheckRollup)) return { attached: true, view };
    const remaining = deadline - deps.now();
    if (remaining <= 0) return { attached: false, view };
    await deps.sleep(Math.min(pollSeconds * 1000, remaining));
  }
}

export async function orchestratePrCreation(
  options,
  { deps = defaultDependencies(PROJECT_ROOT), knownItems = loadKnownItems() } = {},
) {
  const { projectRoot } = deps;
  const branch = await gitText(deps, ['branch', '--show-current'], 'resolve current branch');
  if (!branch) throw new Error('PR creation requires a named branch');
  if (branch === options.base || branch === 'main' || branch === 'master') {
    throw new Error(`refusing to create a PR from protected branch ${branch}`);
  }
  const dirty = await gitText(deps, ['status', '--porcelain=v1', '--untracked-files=all'], 'inspect worktree');
  if (dirty) throw new Error(`worktree must be clean before PR creation:\n${dirty}`);
  const headSha = await gitText(deps, ['rev-parse', 'HEAD'], 'resolve HEAD');
  const baseRef = `origin/${options.base}`;
  successfulOutput(await deps.git(['fetch', 'origin', options.base, '--prune'], { stream: true }), `fetch ${baseRef}`);
  const ancestor = await deps.git(['merge-base', '--is-ancestor', baseRef, 'HEAD']);
  if (ancestor.code !== 0) throw new Error(`branch is not synchronized with ${baseRef}; update it before PR creation`);
  const commitCount = Number(await gitText(deps, ['rev-list', '--count', `${baseRef}..HEAD`], 'count PR commits'));
  if (!Number.isInteger(commitCount) || commitCount < 1) throw new Error(`branch has no commits beyond ${baseRef}`);

  const existing = parseJson(
    await ghText(
      deps,
      ['pr', 'list', '--head', branch, '--state', 'open', '--json', 'number,url,isDraft,headRefOid'],
      'check existing pull requests',
    ),
    'gh pr list',
  );
  if (existing.length > 0)
    throw new Error(`branch already has an open PR: ${existing[0].url || `#${existing[0].number}`}`);

  const workRoot = path.join(projectRoot, '.test-tmp', 'pr-create', headSha);
  fs.mkdirSync(workRoot, { recursive: true });
  const bodyPath = path.join(workRoot, 'body.md');
  const initialBody = options.bodyFile
    ? fs.readFileSync(path.resolve(projectRoot, options.bodyFile), 'utf8')
    : buildDefaultPrBody(options);
  validatePrBodyWorkplan(initialBody, options.workplan, knownItems);
  fs.writeFileSync(bodyPath, initialBody.endsWith('\n') ? initialBody : `${initialBody}\n`);

  const quickReportDir = path.join(workRoot, 'quick');
  if (options.dryRun) {
    return {
      dryRun: true,
      branch,
      headSha,
      bodyPath,
      plan: [
        'quick local CI',
        'push with hooks',
        'create draft PR',
        options.ci === 'auto' ? 'hosted-check wait/full fallback' : `${options.ci} policy`,
      ],
    };
  }

  console.log(`pr:create: quick local admission for ${headSha.slice(0, 12)}`);
  const quickReport = await runGate(deps, {
    profile: 'quick',
    bodyPath,
    reportDir: quickReportDir,
    headSha,
    options,
  });

  let fullReport = null;
  let fullReportDir = null;
  let body = markQuickAdmissionPassed(fs.readFileSync(bodyPath, 'utf8'), headSha);
  fs.writeFileSync(bodyPath, body);
  if (options.ci === 'full') {
    fullReportDir = path.join(workRoot, 'full');
    console.log('pr:create: explicit full local admission');
    fullReport = await runGate(deps, { profile: 'full', bodyPath, reportDir: fullReportDir, headSha, options });
    body = appendLocalCiEvidence(body, {
      reportPath: reportLocation(projectRoot, fullReportDir),
      sourceSha: headSha,
      reason: 'Full local admission was explicitly requested before PR creation.',
    });
    fs.writeFileSync(bodyPath, body);
  }

  await assertStableHead(deps, headSha);
  console.log(`pr:create: pushing ${branch} with configured hooks`);
  successfulOutput(await deps.git(['push', '-u', 'origin', `HEAD:refs/heads/${branch}`], { stream: true }), 'git push');
  const remoteSha = remoteHeadSha(
    await gitText(deps, ['ls-remote', '--heads', 'origin', `refs/heads/${branch}`], 'read remote branch'),
    branch,
  );
  if (remoteSha !== headSha) throw new Error(`remote branch is ${remoteSha || 'missing'}, expected ${headSha}`);

  const prOutput = await ghText(
    deps,
    [
      'pr',
      'create',
      '--base',
      options.base,
      '--head',
      branch,
      '--title',
      options.title,
      '--body-file',
      bodyPath,
      '--draft',
    ],
    'create draft pull request',
  );
  const prUrl = pullRequestUrl(prOutput);
  console.log(`pr:create: draft ${prUrl}`);

  let hostedChecksAttached = false;
  let fallbackUsed = false;
  try {
    if (options.ci === 'auto') {
      const hosted = await waitForHostedChecks(deps, {
        prUrl,
        headSha,
        waitSeconds: options.waitSeconds,
        pollSeconds: options.pollSeconds,
      });
      hostedChecksAttached = hosted.attached;
      if (!hosted.attached) {
        fallbackUsed = true;
        fullReportDir = path.join(workRoot, 'full');
        console.log('pr:create: no hosted CI attached; running full local fallback');
        fullReport = await runGate(deps, { profile: 'full', bodyPath, reportDir: fullReportDir, headSha, options });
        body = appendLocalCiEvidence(fs.readFileSync(bodyPath, 'utf8'), {
          reportPath: reportLocation(projectRoot, fullReportDir),
          sourceSha: headSha,
        });
        fs.writeFileSync(bodyPath, body);
        successfulOutput(await deps.gh(['pr', 'edit', prUrl, '--body-file', bodyPath]), 'annotate pull request');
      }
    }

    if (!options.draft) {
      successfulOutput(await deps.gh(['pr', 'ready', prUrl]), 'mark pull request ready');
    }
  } catch (error) {
    throw new Error(`${error.message}; draft PR remains at ${prUrl}`);
  }

  const finalView = await readPrView(deps, prUrl, headSha);
  return {
    dryRun: false,
    branch,
    headSha,
    remoteSha,
    prUrl,
    prNumber: finalView.number,
    isDraft: finalView.isDraft,
    hostedChecksAttached,
    fallbackUsed,
    quickReport,
    fullReport,
    quickReportPath: reportLocation(projectRoot, quickReportDir),
    fullReportPath: fullReportDir ? reportLocation(projectRoot, fullReportDir) : null,
  };
}

async function main() {
  const options = parsePrCreateArgs(process.argv.slice(2));
  if (options.help) {
    console.log(HELP);
    return;
  }
  const result = await orchestratePrCreation(options);
  if (result.dryRun) {
    console.log(`pr:create: dry run for ${result.branch} at ${result.headSha}`);
    for (const step of result.plan) console.log(`  - ${step}`);
    return;
  }
  console.log(`pr:create: ${result.isDraft ? 'draft' : 'ready'} ${result.prUrl}`);
  console.log(`pr:create: quick report ${result.quickReportPath}`);
  if (result.fullReportPath) console.log(`pr:create: full report ${result.fullReportPath}`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(`pr:create: ${error.message}`);
    process.exitCode = 1;
  });
}
