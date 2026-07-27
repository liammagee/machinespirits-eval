#!/usr/bin/env node
/**
 * Pre-push reporter for the workplan trailer rule.
 *
 * The same check that CI runs on `push`, run before the push instead of after.
 * See services/workplanTrailerPrePushHook.js for why it reports rather than
 * rejects, and scripts/check-commit-workplan-trailer.js for the rule itself.
 *
 *   npm run wp:trailer-hook:install     # chain it into the pre-push hook
 *   npm run wp:trailer-hook:uninstall   # take it back out
 *
 * `git push --no-verify` skips every pre-push hook, which is the escape hatch
 * if one is ever needed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  classifyWorkplanTrailerHookOutcome,
  installWorkplanTrailerPrePushHook,
  parseWorkplanTrailerPrePushInput,
  resolveWorkplanTrailerHookEnforcement,
  selectWorkplanTrailerPushRanges,
  uninstallWorkplanTrailerPrePushHook,
} from '../services/workplanTrailerPrePushHook.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NAME = 'workplan-trailer hook';
const CHECKER = 'scripts/check-commit-workplan-trailer.js';

function usage() {
  return `Usage: node scripts/workplan-trailer-hook.js <command>

Commands:
  install     Preserve any existing pre-push hook and install the trailer wrapper
  uninstall   Remove the managed wrapper and restore the preserved pre-push hook
  pre-push    Report unlinked commits bound for main (called by the installed Git hook)
  help        Show this help

Environment:
  WORKPLAN_TRAILER_HOOK_ENFORCEMENT   report_only (default) or blocking`;
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
  return parseWorkplanTrailerPrePushInput(fs.readFileSync(0, 'utf8'));
}

function prePush() {
  const enforcement = resolveWorkplanTrailerHookEnforcement();
  const { checks, skipped } = selectWorkplanTrailerPushRanges({ updates: readPushUpdates() });
  for (const { update, reason } of skipped) {
    if (update.remoteRef.startsWith('refs/heads/')) console.error(`${NAME}: skipping ${update.remoteRef} — ${reason}`);
  }
  if (checks.length === 0) return;

  let unlinked = 0;
  for (const check of checks) {
    console.error(
      `${NAME}: checking ${check.remoteOid.slice(0, 8)}..${check.localOid.slice(0, 8)} -> ${check.remoteRef}`,
    );
    const result = spawnSync(process.execPath, [CHECKER, '--range', check.range], { cwd: ROOT, stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) unlinked += 1;
  }

  const outcome = classifyWorkplanTrailerHookOutcome(unlinked, enforcement);
  if (outcome === 'allow') return;
  if (outcome === 'block') {
    throw new Error(`${unlinked} pushed range(s) contain unlinked commits`);
  }
  console.error('');
  console.error(`${NAME}: reporting only — the push continues.`);
  console.error('Amend the trailer now while you still can, or accept that CI will report this');
  console.error('after the commits land and record them on their card instead:');
  console.error('');
  console.error('  git commit --amend --trailer "Workplan-item: <id>"');
  console.error('');
  console.error('Set WORKPLAN_TRAILER_HOOK_ENFORCEMENT=blocking to have this reject the push.');
}

function main() {
  const command = process.argv[2] || 'help';
  if (command === 'help' || command === '--help') {
    console.log(usage());
    return;
  }
  if (command === 'install') {
    const result = installWorkplanTrailerPrePushHook(managedHookPath());
    console.log(`${NAME}: ${result.status} at ${result.target}`);
    if (result.preserved) console.log(`preserved prior hook: ${result.sidecar}`);
    return;
  }
  if (command === 'uninstall') {
    const result = uninstallWorkplanTrailerPrePushHook(managedHookPath());
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
