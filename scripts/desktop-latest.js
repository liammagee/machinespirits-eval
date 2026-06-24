#!/usr/bin/env node
/**
 * desktop-latest.js — run up the latest Scriptorium desktop app off `main`.
 *
 * The desktop app lives in a sibling git worktree (branch `desktop-dev`) whose
 * node_modules carries the Electron-ABI native modules, kept separate from the
 * main checkout's Node-ABI build so `npm test` / `eval-cli` and the app don't
 * clobber each other. `desktop-dev` mirrors `main`; it is not a divergent branch.
 *
 * This script, run from anywhere in the repo:
 *   1. locates the worktree checked out on `desktop-dev`,
 *   2. fast-forwards it to local `main` (fails loudly if it has diverged), and
 *   3. launches `desktop:dev` there.
 *
 * Pass `--no-launch` (or set MS_DESKTOP_LATEST_NO_LAUNCH=1) to sync only.
 */
import { execFileSync, spawn } from 'node:child_process';

const DESKTOP_BRANCH = 'desktop-dev';
const SOURCE_BRANCH = 'main';
const noLaunch = process.argv.includes('--no-launch') || process.env.MS_DESKTOP_LATEST_NO_LAUNCH === '1';

const log = (m) => console.log(`[desktop:latest] ${m}`);
const die = (m) => {
  console.error(`[desktop:latest] ${m}`);
  process.exit(1);
};

const git = (args, opts = {}) => execFileSync('git', args, { encoding: 'utf8', ...opts }).trim();

// 1. Find the worktree checked out on DESKTOP_BRANCH (parse `worktree`/`branch` blocks).
let target = null;
let cur = {};
for (const line of git(['worktree', 'list', '--porcelain']).split('\n')) {
  if (line.startsWith('worktree ')) cur = { path: line.slice('worktree '.length) };
  else if (line.startsWith('branch ')) {
    if (line.slice('branch '.length).replace('refs/heads/', '') === DESKTOP_BRANCH) {
      target = cur.path;
      break;
    }
  } else if (line === '') cur = {};
}
if (!target) {
  die(`no worktree is on '${DESKTOP_BRANCH}'.\n` + `  Create one:  git worktree add ../ms-electron ${DESKTOP_BRANCH}`);
}
log(`worktree: ${target}`);

// 2. Fast-forward the desktop branch to local main (no merge commits).
try {
  const out = git(['merge', '--ff-only', SOURCE_BRANCH], { cwd: target });
  log(out.split('\n')[0] || `already up to date with ${SOURCE_BRANCH}`);
} catch (e) {
  die(
    `could not fast-forward ${DESKTOP_BRANCH} to ${SOURCE_BRANCH}:\n` +
      `${(e.stderr || e.message || '').trim()}\n` +
      `  Resolve by hand in ${target} (it may have diverged from ${SOURCE_BRANCH}).`,
  );
}

// 3. Launch the app from the worktree (its node_modules has the Electron-ABI natives).
if (noLaunch) {
  log('--no-launch: synced only, not starting the app.');
  process.exit(0);
}
log('launching desktop:dev …');
const child = spawn('npm', ['run', 'desktop:dev'], { cwd: target, stdio: 'inherit' });
child.on('error', (err) => die(`failed to launch: ${err.message}`));
child.on('exit', (code) => process.exit(code ?? 0));
