#!/usr/bin/env node
/**
 * Pre-push gate for the CI lint lane.
 *
 * Runs `npm run lint:all` — root and tutor-core ESLint, the import-cycle
 * check, and both Prettier checks, matching CI's lint job — before the push
 * leaves the machine, and blocks the push when they fail. Ref governance is a
 * separately selected CI/local-CI lane. See
 * services/lintPrePushHook.js for why this one blocks where the
 * workplan-trailer hook only reports.
 *
 *   npm run lint:hook:install     # chain it into the pre-push hook
 *   npm run lint:hook:uninstall   # take it back out
 *
 * `git push --no-verify` skips every pre-push hook, which is the escape
 * hatch if one is ever needed — with a stated reason.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  installLintPrePushHook,
  lintPrePushInputCarriesCommits,
  parseLintPrePushInput,
  uninstallLintPrePushHook,
} from '../services/lintPrePushHook.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NAME = 'lint pre-push hook';
const LINT_SCRIPT = 'lint:all';

function usage() {
  return `Usage: node scripts/lint-hook.js <command>

Commands:
  install     Preserve any existing pre-push hook and install the lint wrapper
  uninstall   Remove the managed wrapper and restore the preserved pre-push hook
  pre-push    Run the CI lint lane and block the push on failure (called by the installed Git hook)
  help        Show this help`;
}

function runGit(args) {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || '').trim();
    throw new Error(`git ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`);
  }
  return String(result.stdout || '').trim();
}

function managedHookPath() {
  const value = runGit(['rev-parse', '--git-path', 'hooks/pre-push']);
  return path.isAbsolute(value) ? value : path.resolve(ROOT, value);
}

/**
 * Git pipes the ref updates in on stdin. Run by hand from a terminal there is
 * nothing to read and `readFileSync(0)` would block forever, so treat a TTY as
 * an empty push rather than hanging.
 */
function readPushUpdates() {
  if (process.stdin.isTTY) return [];
  return parseLintPrePushInput(fs.readFileSync(0, 'utf8'));
}

function prePush() {
  const updates = readPushUpdates();
  if (updates.length > 0 && !lintPrePushInputCarriesCommits(updates)) {
    console.error(`${NAME}: only deletions pushed — nothing to lint`);
    return;
  }
  let scripts = {};
  try {
    scripts = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts || {};
  } catch {
    scripts = {};
  }
  if (!scripts[LINT_SCRIPT]) {
    console.error(`${NAME}: this checkout has no "${LINT_SCRIPT}" script — skipping`);
    return;
  }
  console.error(`${NAME}: npm run ${LINT_SCRIPT} (eslint, import cycles, prettier — the CI lint lane)`);
  const result = spawnSync('npm', ['run', LINT_SCRIPT], { cwd: ROOT, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    console.error('');
    console.error(`${NAME}: push blocked — the CI lint lane would fail on this push.`);
    console.error('Fix mechanically, then push again:');
    console.error('');
    console.error('  npm run lint:fix && npm run format');
    console.error('');
    process.exitCode = 1;
  }
}

function main() {
  const command = process.argv[2] || 'help';
  if (command === 'help' || command === '--help') {
    console.log(usage());
    return;
  }
  if (command === 'install') {
    const result = installLintPrePushHook(managedHookPath());
    console.log(`${NAME}: ${result.status} at ${result.target}`);
    if (result.preserved) console.log(`preserved prior hook: ${result.sidecar}`);
    return;
  }
  if (command === 'uninstall') {
    const result = uninstallLintPrePushHook(managedHookPath());
    console.log(`${NAME}: ${result.status} at ${result.target}`);
    if (result.restored) console.log(`restored prior hook from: ${result.sidecar}`);
    return;
  }
  if (command === 'pre-push') {
    prePush();
    return;
  }
  throw new Error(`unknown command ${command}`);
}

try {
  main();
} catch (error) {
  console.error(`${NAME} error: ${error.message}`);
  process.exitCode = 2;
}
